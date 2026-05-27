import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  asaasFetch,
  mapCycle,
  onlyDigits,
  type AsaasBillingType,
} from "./asaas.server";

type AsaasCustomerResp = { id: string };
type AsaasPaymentResp = {
  id: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate: string;
  value: number;
};
type AsaasSubscriptionResp = {
  id: string;
  status: string;
  nextDueDate: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAsaasCustomer(supabase: any, customerId: string): Promise<string> {
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();
  if (error || !customer) throw new Error("Empresa não encontrada");
  if (customer.asaas_customer_id) return customer.asaas_customer_id as string;

  const cpfCnpj = onlyDigits(customer.cpf_cnpj);
  if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
    throw new Error("CPF/CNPJ inválido — atualize o cadastro da empresa");
  }

  const created = await asaasFetch<AsaasCustomerResp>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: customer.company_name || customer.name,
      email: customer.email,
      cpfCnpj,
      mobilePhone: onlyDigits(customer.whatsapp || customer.phone) || undefined,
      postalCode: onlyDigits(customer.address_zip) || undefined,
      address: customer.address_street || undefined,
      addressNumber: customer.address_number || undefined,
      complement: customer.address_complement || undefined,
      province: customer.address_neighborhood || undefined,
      externalReference: customer.id,
    }),
  });

  await supabase
    .from("customers")
    .update({ asaas_customer_id: created.id })
    .eq("id", customer.id);

  return created.id;
}

const SubscribeSchema = z.object({
  customerId: z.string().uuid(),
  planId: z.string().uuid(),
  billingType: z.enum(["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"]).default("UNDEFINED"),
  dueDay: z.number().int().min(1).max(28).optional(),
  // Período da assinatura escolhido pelo cliente (override do plano).
  // monthly = preço cheio; semiannual = 6x com 5% off; annual = 12x com 10% off.
  billingPeriod: z.enum(["monthly", "semiannual", "annual"]).optional(),
});

export const createAsaasSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SubscribeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: must be admin or owner of this customer
    const [{ data: roles }, { data: ownedCust }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("customers")
        .select("id")
        .eq("id", data.customerId)
        .eq("owner_user_id", userId)
        .maybeSingle(),
    ]);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin && !ownedCust) throw new Error("Sem permissão");

    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", data.planId)
      .single();
    if (planErr || !plan) throw new Error("Plano não encontrado");

    const asaasCustomerId = await ensureAsaasCustomer(supabase, data.customerId);

    const dueDay = data.dueDay ?? new Date().getDate();
    const safeDueDay = Math.min(Math.max(dueDay, 1), 28);
    const today = new Date();
    const nextDue = new Date(today.getFullYear(), today.getMonth(), safeDueDay);
    if (nextDue <= today) nextDue.setMonth(nextDue.getMonth() + 1);
    const nextDueStr = nextDue.toISOString().slice(0, 10);

    // Determina ciclo/valor a partir do período escolhido (override do plano).
    // Considera plan.price como preço mensal base.
    const monthlyPrice = Number(plan.price);
    const period = data.billingPeriod ?? (plan.cycle as "monthly" | "semiannual" | "annual");
    let effectiveCycle: "monthly" | "semiannual" | "annual" = "monthly";
    let effectiveValue = monthlyPrice;
    if (period === "semiannual") {
      effectiveCycle = "semiannual";
      effectiveValue = Math.round(monthlyPrice * 6 * 0.95 * 100) / 100;
    } else if (period === "annual") {
      effectiveCycle = "annual";
      effectiveValue = Math.round(monthlyPrice * 12 * 0.9 * 100) / 100;
    }

    const sub = await asaasFetch<AsaasSubscriptionResp>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: data.billingType,
        value: effectiveValue,
        nextDueDate: nextDueStr,
        cycle: mapCycle(effectiveCycle),
        description: `Assinatura ${plan.name}`,
        externalReference: data.customerId,
      }),
    });

    const { data: inserted, error: insErr } = await supabase
      .from("subscriptions")
      .insert({
        customer_id: data.customerId,
        plan_id: data.planId,
        // criada como active no Asaas; acesso só libera após fatura paga (gate)
        status: "active",
        cycle: effectiveCycle,
        price: effectiveValue,
        due_day: safeDueDay,
        next_due_date: nextDueStr,
        asaas_subscription_id: sub.id,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Busca os pagamentos já gerados pela assinatura e cria as faturas locais.
    // Se a assinatura ainda não gerou um payment (acontece ocasionalmente),
    // forçamos a criação de uma cobrança avulsa para a primeira parcela —
    // assim o cliente sempre vê uma fatura imediatamente.
    let firstPayments: AsaasPaymentResp[] = [];
    try {
      const payments = await asaasFetch<{ data: AsaasPaymentResp[] }>(
        `/subscriptions/${sub.id}/payments`,
        { method: "GET" },
      );
      firstPayments = payments?.data ?? [];
    } catch (err) {
      console.error("[asaas] falha ao listar payments da subscription:", err);
    }

    if (firstPayments.length === 0) {
      try {
        const forced = await asaasFetch<AsaasPaymentResp>("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: asaasCustomerId,
            billingType: data.billingType,
            value: effectiveValue,
            dueDate: nextDueStr,
            description: `Assinatura ${plan.name}`,
            externalReference: inserted.id,
          }),
        });
        firstPayments = [forced];
        console.log(`[asaas] payment fallback criado id=${forced.id}`);
      } catch (err) {
        console.error("[asaas] falha ao criar payment fallback:", err);
      }
    }

    const rows = firstPayments.map((p) => ({
      customer_id: data.customerId,
      subscription_id: inserted.id,
      description: `Assinatura ${plan.name}`,
      amount: Number(p.value),
      due_date: p.dueDate,
      status: "pending" as const,
      payment_method: (data.billingType === "BOLETO"
        ? "boleto"
        : data.billingType === "PIX"
          ? "pix"
          : data.billingType === "CREDIT_CARD"
            ? "credit_card"
            : "undefined") as "boleto" | "pix" | "credit_card" | "undefined",
      asaas_payment_id: p.id,
      invoice_url: p.invoiceUrl ?? null,
      bank_slip_url: p.bankSlipUrl ?? null,
      payment_link: p.invoiceUrl ?? null,
    }));
    if (rows.length > 0) {
      const { error: invErr } = await supabase.from("invoices").insert(rows);
      if (invErr) console.error("[asaas] erro ao inserir faturas locais:", invErr);
    }

    console.log(
      `[asaas] subscription criada id=${sub.id} valor=${effectiveValue} faturas=${rows.length}`,
    );

    return { subscriptionId: inserted.id, asaasId: sub.id };
  });

const ChargeSchema = z.object({
  invoiceId: z.string().uuid(),
  billingType: z.enum(["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"]).default("UNDEFINED"),
});

export const createAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ChargeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) throw new Error("Apenas admin pode gerar cobranças avulsas");

    const { data: inv, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .single();
    if (error || !inv) throw new Error("Fatura não encontrada");
    if (inv.asaas_payment_id) throw new Error("Fatura já enviada ao Asaas");

    const asaasCustomerId = await ensureAsaasCustomer(supabase, inv.customer_id);

    const pay = await asaasFetch<AsaasPaymentResp>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: data.billingType,
        value: Number(inv.amount),
        dueDate: inv.due_date,
        description: inv.description ?? "Cobrança",
        externalReference: inv.id,
      }),
    });

    await supabase
      .from("invoices")
      .update({
        asaas_payment_id: pay.id,
        invoice_url: pay.invoiceUrl ?? null,
        bank_slip_url: pay.bankSlipUrl ?? null,
        payment_link: pay.invoiceUrl ?? null,
        payment_method:
          data.billingType === "BOLETO"
            ? "boleto"
            : data.billingType === "PIX"
              ? "pix"
              : data.billingType === "CREDIT_CARD"
                ? "credit_card"
                : "undefined",
      })
      .eq("id", inv.id);

    return { asaasPaymentId: pay.id, invoiceUrl: pay.invoiceUrl };
  });
