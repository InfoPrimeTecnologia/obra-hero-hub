import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Sem permissão");
}

// ---------- Invoices ----------
const ListInvoicesSchema = z.object({
  status: z.enum(["all", "pending", "paid", "overdue", "canceled", "refunded"]).default("all"),
  q: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const adminListInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListInvoicesSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("invoices")
      .select("id, customer_id, description, amount, status, payment_method, due_date, paid_at, asaas_payment_id, invoice_url, created_at, customers(name, company_name, email)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.q && data.q.trim()) {
      const s = data.q.trim();
      q = q.or(`description.ilike.%${s}%,asaas_payment_id.ilike.%${s}%,id.eq.${/^[0-9a-f-]{36}$/i.test(s) ? s : "00000000-0000-0000-0000-000000000000"}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Sync helper (shared logic with webhook) ----------
function mapStatus(s?: string): "pending" | "paid" | "overdue" | "canceled" | "refunded" {
  switch (s) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "REFUND_REQUESTED":
      return "refunded";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "canceled";
    default:
      return "pending";
  }
}
function mapMethod(s?: string): "boleto" | "credit_card" | "pix" | "transfer" | "undefined" {
  switch (s) {
    case "BOLETO": return "boleto";
    case "PIX": return "pix";
    case "CREDIT_CARD": return "credit_card";
    default: return "undefined";
  }
}

async function syncOneInvoice(supabaseAdmin: any, invoiceId: string) {
  const { data: inv, error: invErr } = await supabaseAdmin
    .from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (invErr) throw new Error(invErr.message);
  if (!inv) throw new Error("Fatura não encontrada");
  if (!inv.asaas_payment_id) {
    return { invoiceId, skipped: true, reason: "sem asaas_payment_id" };
  }

  const { asaasFetch } = await import("./asaas.server");
  let pay: any;
  try {
    pay = await asaasFetch<any>(`/payments/${inv.asaas_payment_id}`);
  } catch (e: any) {
    return { invoiceId, error: e.message ?? "falha ao consultar Asaas" };
  }

  const newStatus = mapStatus(pay.status);
  const wasPaid = inv.status === "paid";

  await supabaseAdmin.from("invoices").update({
    status: newStatus,
    payment_method: mapMethod(pay.billingType),
    invoice_url: pay.invoiceUrl ?? inv.invoice_url,
    bank_slip_url: pay.bankSlipUrl ?? inv.bank_slip_url,
    payment_link: pay.invoiceUrl ?? inv.payment_link,
    paid_at: newStatus === "paid"
      ? new Date(pay.paymentDate ?? pay.clientPaymentDate ?? Date.now()).toISOString()
      : null,
  }).eq("id", inv.id);

  let credited = false;
  let creditsAdded = 0;
  if (newStatus === "paid") {
    const ref = (pay.externalReference ?? "") as string;
    if (ref.startsWith("credit_recharge:")) {
      const [, pkgId, custId] = ref.split(":");
      if (pkgId && custId) {
        const { data: pkg } = await supabaseAdmin
          .from("credit_packages")
          .select("creditos, nome")
          .eq("id", pkgId)
          .maybeSingle();
        if (pkg) {
          const { applyCreditDelta } = await import("@/lib/credits.functions");
          const r = await applyCreditDelta(supabaseAdmin, {
            customerId: custId,
            delta: pkg.creditos,
            tipo: "recarga",
            descricao: `Recarga: ${pkg.nome} (+${pkg.creditos} créditos) [sync admin]`,
            invoiceId: inv.id,
          });
          credited = !r.alreadyApplied;
          creditsAdded = r.alreadyApplied ? 0 : pkg.creditos;
        }
      }
    }
  }

  return {
    invoiceId,
    asaasPaymentId: inv.asaas_payment_id,
    asaasStatus: pay.status,
    previousStatus: inv.status,
    newStatus,
    wasPaid,
    credited,
    creditsAdded,
  };
}

export const adminSyncInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { invoiceId: string }) =>
    z.object({ invoiceId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await syncOneInvoice(supabaseAdmin, data.invoiceId);
  });

export const adminSyncPendingInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { days?: number }) =>
    z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date();
    since.setDate(since.getDate() - data.days);
    const { data: invs } = await supabaseAdmin
      .from("invoices")
      .select("id")
      .in("status", ["pending", "overdue"])
      .not("asaas_payment_id", "is", null)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    const results: any[] = [];
    for (const row of invs ?? []) {
      try {
        results.push(await syncOneInvoice(supabaseAdmin, row.id));
      } catch (e: any) {
        results.push({ invoiceId: row.id, error: e.message });
      }
    }
    return {
      total: results.length,
      updated: results.filter((r) => r.newStatus && r.newStatus !== r.previousStatus).length,
      credited: results.filter((r) => r.credited).length,
      results,
    };
  });

// ---------- Webhook events ----------
const ListEventsSchema = z.object({
  provider: z.string().max(50).optional(),
  processed: z.enum(["all", "yes", "no", "error"]).default("all"),
  q: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const adminListWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListEventsSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.processed === "yes") q = q.eq("processed", true).is("error", null);
    if (data.processed === "no") q = q.eq("processed", false).is("error", null);
    if (data.processed === "error") q = q.not("error", "is", null);
    if (data.q && data.q.trim()) {
      const s = data.q.trim();
      q = q.or(`external_id.ilike.%${s}%,event_type.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWebhookStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ count: total }, { count: errors }, { count: pending }, { data: last }] = await Promise.all([
      supabaseAdmin.from("webhook_events").select("*", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("webhook_events").select("*", { count: "exact", head: true }).gte("created_at", since).not("error", "is", null),
      supabaseAdmin.from("webhook_events").select("*", { count: "exact", head: true }).eq("processed", false).is("error", null),
      supabaseAdmin.from("webhook_events").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);
    return {
      last24h: total ?? 0,
      errors24h: errors ?? 0,
      pending: pending ?? 0,
      lastReceivedAt: last?.[0]?.created_at ?? null,
    };
  });
