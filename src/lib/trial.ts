export const TRIAL_DAYS = 5;
export const TRIAL_CREDITS = 100;

export function normalizeTrialEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Último dia (YYYY-MM-DD) com acesso liberado no teste grátis. */
export function trialAccessUntil(start: Date, days = TRIAL_DAYS): string {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function trialBlockReason(opts: {
  email: string;
  usedEmails: string[];
  customerHasSubscription: boolean;
}): string | null {
  const email = normalizeTrialEmail(opts.email);
  if (!email) return "Não foi possível identificar seu e-mail.";
  if (opts.usedEmails.map(normalizeTrialEmail).includes(email))
    return "Este e-mail já utilizou o teste grátis.";
  if (opts.customerHasSubscription)
    return "O teste grátis é só para empresas que ainda não tiveram uma assinatura.";
  return null;
}
