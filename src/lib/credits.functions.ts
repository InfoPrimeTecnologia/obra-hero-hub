import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Helpers ----------
async function getCustomerId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao identificar a conta: ${error.message}`);
  if (!data) throw new Error("Conta não identificada");
  return data.id;
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// ---------- Public read ----------
export const getMyCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const customerId = await getCustomerId(supabase, userId);
    const [{ data: bal, error: balErr }, { data: tx, error: txErr }] = await Promise.all([
      supabase.from("customer_credits").select("saldo, updated_at").eq("customer_id", customerId).maybeSingle(),
      supabase
        .from("credit_transactions")
        .select("id, tipo, delta, saldo_apos, action_key, descricao, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (balErr) throw new Error(`Falha ao carregar saldo: ${balErr.message}`);
    if (txErr) throw new Error(`Falha ao carregar extrato: ${txErr.message}`);
    return {
      saldo: bal?.saldo ?? 0,
      atualizadoEm: bal?.updated_at ?? null,
      transactions: tx ?? [],
    };
  });

export const listCreditPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("credit_packages")
      .select("*")
      .eq("ativo", true)
      .order("ordem")
      .order("valor_brl");
    if (error) throw new Error(`Falha ao carregar pacotes: ${error.message}`);
    return data ?? [];
  });

// ---------- Recarga (cria fatura Asaas) ----------
const RechargeSchema = z.object({
  packageId: z.string().uuid(),
  billingType: z.enum(["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"]).default("PIX"),
});

export const createCreditRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RechargeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const customerId = await getCustomerId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pkg, error: pkgErr } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", data.packageId)
      .eq("ativo", true)
      .maybeSingle();
    if (pkgErr || !pkg) throw new Error("Pacote não encontrado");

    const { asaasFetch, onlyDigits } = await import("./asaas.server");

    // Garante customer no Asaas
    const { data: cust } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();
    if (!cust) throw new Error("Empresa não encontrada");

    let asaasCustomerId = cust.asaas_customer_id as string | null;
    if (!asaasCustomerId) {
      const cpfCnpj = onlyDigits(cust.cpf_cnpj);
      if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
        throw new Error("CPF/CNPJ inválido — atualize o cadastro da empresa");
      }
      const created = await asaasFetch<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: cust.company_name || cust.name,
          email: cust.email,
          cpfCnpj,
          mobilePhone: onlyDigits(cust.whatsapp || cust.phone) || undefined,
          externalReference: cust.id,
        }),
      });
      await supabase.from("customers").update({ asaas_customer_id: created.id }).eq("id", customerId);
      asaasCustomerId = created.id;
    }

    // Cria fatura local primeiro para termos um id estável
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueStr = dueDate.toISOString().slice(0, 10);

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        customer_id: customerId,
        description: `Recarga ${pkg.creditos} créditos (${pkg.nome})`,
        amount: pkg.valor_brl,
        status: "pending",
        payment_method: data.billingType === "BOLETO" ? "boleto" : data.billingType === "PIX" ? "pix" : data.billingType === "CREDIT_CARD" ? "credit_card" : "undefined",
        due_date: dueStr,
      })
      .select("*")
      .single();
    if (invErr || !inv) throw new Error(invErr?.message ?? "Falha ao criar fatura");

    // Cria payment no Asaas referenciando a fatura
    const externalRef = `credit_recharge:${pkg.id}:${customerId}:${inv.id}`;
    const pay = await asaasFetch<{
      id: string;
      invoiceUrl?: string;
      bankSlipUrl?: string;
    }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: data.billingType,
        value: Number(pkg.valor_brl),
        dueDate: dueStr,
        description: `Recarga de ${pkg.creditos} créditos — Assistente IA`,
        externalReference: externalRef,
      }),
    });

    await supabase
      .from("invoices")
      .update({
        asaas_payment_id: pay.id,
        invoice_url: pay.invoiceUrl ?? null,
        bank_slip_url: pay.bankSlipUrl ?? null,
        payment_link: pay.invoiceUrl ?? null,
      })
      .eq("id", inv.id);

    return {
      invoiceId: inv.id,
      paymentUrl: pay.invoiceUrl ?? null,
      bankSlipUrl: pay.bankSlipUrl ?? null,
    };
  });

// ---------- Admin: pacotes ----------
const PackageSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(120),
  valor_brl: z.number().min(0),
  creditos: z.number().int().min(1),
  destaque: z.boolean().default(false),
  ativo: z.boolean().default(true),
  ordem: z.number().int().default(0),
});

export const adminListPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Sem permissão");
    const { data } = await context.supabase
      .from("credit_packages")
      .select("*")
      .order("ordem")
      .order("valor_brl");
    return data ?? [];
  });

export const adminUpsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PackageSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Sem permissão");
    if (data.id) {
      const { error } = await context.supabase.from("credit_packages").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("credit_packages").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Sem permissão");
    const { error } = await context.supabase.from("credit_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: custos por ação ----------
export const adminListActionCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Sem permissão");
    const { data } = await context.supabase.from("credit_action_costs").select("*").order("action_key");
    return data ?? [];
  });

const ActionCostSchema = z.object({
  id: z.string().uuid(),
  custo: z.number().int().min(0),
  ativo: z.boolean().optional(),
  descricao: z.string().optional(),
});

export const adminUpdateActionCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ActionCostSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Sem permissão");
    const patch: any = { custo: data.custo };
    if (data.ativo !== undefined) patch.ativo = data.ativo;
    if (data.descricao !== undefined) patch.descricao = data.descricao;
    const { error } = await context.supabase.from("credit_action_costs").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: ajuste manual ----------
const AdjustSchema = z.object({
  customerId: z.string().uuid(),
  delta: z.number().int(),
  motivo: z.string().min(3).max(255),
});

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AdjustSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Sem permissão");
    const { data: rpc, error } = await context.supabase.rpc("admin_apply_credit_delta", {
      _customer_id: data.customerId,
      _delta: data.delta,
      _motivo: data.motivo,
    });
    if (error) throw new Error(error.message);
    const saldo = Array.isArray(rpc) ? rpc[0]?.saldo : (rpc as any)?.saldo;
    return { saldo: saldo ?? 0, alreadyApplied: false };
  });

export const adminSearchCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { q: string }) => z.object({ q: z.string().max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Sem permissão");
    const q = data.q.trim();
    const { data: rows } = await context.supabase
      .from("customers")
      .select("id, name, company_name, email")
      .or(`name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20);
    return rows ?? [];
  });

// ---------- Server-only helpers (usados pelo assistente e pelo webhook) ----------

/**
 * Aplica um delta de crédito de forma atômica via RPC-like (lê saldo, atualiza, registra extrato).
 * Usa supabaseAdmin para garantir consistência (bypassa RLS).
 */
export async function applyCreditDelta(
  supabaseAdmin: any,
  opts: {
    customerId: string;
    delta: number;
    tipo: "recarga" | "consumo" | "ajuste" | "estorno";
    actionKey?: string;
    descricao?: string;
    invoiceId?: string;
    userId?: string;
  },
) {
  const { customerId, delta, tipo, actionKey, descricao, invoiceId, userId } = opts;

  // Idempotência para recargas vinculadas a fatura
  if (tipo === "recarga" && invoiceId) {
    const { data: exist } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, saldo_apos")
      .eq("invoice_id", invoiceId)
      .eq("tipo", "recarga")
      .maybeSingle();
    if (exist) return { saldo: exist.saldo_apos, alreadyApplied: true };
  }

  // Upsert do saldo
  const { data: cur } = await supabaseAdmin
    .from("customer_credits")
    .select("saldo")
    .eq("customer_id", customerId)
    .maybeSingle();
  const saldoAtual = cur?.saldo ?? 0;
  const novoSaldo = saldoAtual + delta;
  if (novoSaldo < 0) throw new Error("Saldo de créditos insuficiente");

  if (cur) {
    const { error } = await supabaseAdmin
      .from("customer_credits")
      .update({ saldo: novoSaldo, updated_at: new Date().toISOString() })
      .eq("customer_id", customerId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("customer_credits")
      .insert({ customer_id: customerId, saldo: novoSaldo });
    if (error) throw new Error(error.message);
  }

  await supabaseAdmin.from("credit_transactions").insert({
    customer_id: customerId,
    tipo,
    delta,
    saldo_apos: novoSaldo,
    action_key: actionKey ?? null,
    descricao: descricao ?? null,
    invoice_id: invoiceId ?? null,
    user_id: userId ?? null,
  });

  return { saldo: novoSaldo, alreadyApplied: false };
}

export async function getActionCost(supabase: any, actionKey: string): Promise<number> {
  const { data } = await supabase
    .from("credit_action_costs")
    .select("custo, ativo")
    .eq("action_key", actionKey)
    .maybeSingle();
  if (!data || !data.ativo) return 0;
  return data.custo as number;
}

export async function getBalance(supabase: any, customerId: string): Promise<number> {
  const { data } = await supabase
    .from("customer_credits")
    .select("saldo")
    .eq("customer_id", customerId)
    .maybeSingle();
  return data?.saldo ?? 0;
}
