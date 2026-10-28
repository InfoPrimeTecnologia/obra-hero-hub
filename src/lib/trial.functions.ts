import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyCreditDelta } from "./credits.functions";
import { TRIAL_CREDITS, TRIAL_DAYS, normalizeTrialEmail, trialAccessUntil, trialBlockReason } from "./trial";

async function loadContext(supabase: any, userId: string, claims: any) {
  const { data: cust } = await supabase
    .from("customers")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!cust) throw new Error("Somente o dono da empresa pode iniciar o teste grátis.");
  const email = normalizeTrialEmail(claims?.email);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: used } = await supabaseAdmin
    .from("trial_registrations")
    .select("email, customer_id")
    .or(`email.ilike.${email.replace(/[,()]/g, "")},customer_id.eq.${cust.id}`);
  const { count } = await supabaseAdmin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", cust.id);
  const usedEmails = (used ?? []).map((r: any) => r.email);
  const reason =
    (used ?? []).some((r: any) => r.customer_id === cust.id)
      ? "Esta empresa já utilizou o teste grátis."
      : trialBlockReason({ email, usedEmails, customerHasSubscription: (count ?? 0) > 0 });
  return { customerId: cust.id as string, email, reason, supabaseAdmin };
}

export const getTrialEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { reason } = await loadContext(context.supabase, context.userId, context.claims);
      return { eligible: !reason, reason, days: TRIAL_DAYS, credits: TRIAL_CREDITS };
    } catch (e: any) {
      return { eligible: false, reason: e.message as string, days: TRIAL_DAYS, credits: TRIAL_CREDITS };
    }
  });

export const startFreeTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { customerId, email, reason, supabaseAdmin } = await loadContext(
      context.supabase,
      context.userId,
      context.claims,
    );
    if (reason) throw new Error(reason);

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, name")
      .eq("is_active", true)
      .order("price", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) throw new Error("Nenhum plano disponível para o teste.");

    const now = new Date();
    const until = trialAccessUntil(now);

    // Registra primeiro: o índice único por e-mail impede dois testes em paralelo.
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("trial_registrations")
      .insert({
        email,
        customer_id: customerId,
        user_id: context.userId,
        plan_id: plan.id,
        credits: TRIAL_CREDITS,
        ends_at: `${until}T23:59:59Z`,
      })
      .select("id")
      .single();
    if (regErr) throw new Error("Este e-mail ou empresa já utilizou o teste grátis.");

    // Assinatura sem renovação: acesso vale até o fim do teste.
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        customer_id: customerId,
        plan_id: plan.id,
        status: "canceled",
        cycle: "monthly",
        price: 0,
        due_day: Math.min(28, now.getUTCDate()),
        next_due_date: until,
        access_until: until,
        cancel_at_period_end: true,
        canceled_at: now.toISOString(),
        is_trial: true,
      })
      .select("id")
      .single();
    if (subErr) {
      await supabaseAdmin.from("trial_registrations").delete().eq("id", reg.id);
      throw new Error(subErr.message);
    }
    await supabaseAdmin.from("invoices").insert({
      customer_id: customerId,
      subscription_id: sub.id,
      description: `Teste grátis ${TRIAL_DAYS} dias — ${plan.name}`,
      amount: 0,
      status: "paid",
      due_date: now.toISOString().slice(0, 10),
      paid_at: now.toISOString(),
    });
    await supabaseAdmin.from("trial_registrations").update({ subscription_id: sub.id }).eq("id", reg.id);
    await applyCreditDelta(supabaseAdmin, {
      customerId,
      delta: TRIAL_CREDITS,
      tipo: "ajuste",
      actionKey: "trial_grant",
      descricao: `Créditos do teste grátis (${TRIAL_DAYS} dias)`,
      userId: context.userId,
    });
    return { ok: true, until, plan: plan.name };
  });
