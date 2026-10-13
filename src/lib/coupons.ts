// Regras de cupom: desconto percentual só na 1ª mensalidade.
export type CouponRow = {
  id: string;
  code: string;
  percent: number;
  expires_at: string | null;
  max_uses: number | null;
  is_active: boolean;
};

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export function generateCouponCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (const n of arr) s += chars[n % chars.length];
  return `M360-${s}`;
}

/** Retorna mensagem de erro, ou null se o cupom pode ser usado. */
export function couponError(
  c: CouponRow | null,
  opts: { usesCount: number; alreadyUsedByCustomer: boolean; today: string },
): string | null {
  if (!c || !c.is_active) return "Cupom inválido";
  if (c.expires_at && c.expires_at < opts.today) return "Cupom expirado";
  if (c.max_uses != null && opts.usesCount >= c.max_uses) return "Cupom esgotado";
  if (opts.alreadyUsedByCustomer) return "Sua empresa já utilizou este cupom";
  return null;
}

export function applyPercent(amount: number, percent: number) {
  const discount = Math.round(amount * (percent / 100) * 100) / 100;
  const final = Math.max(0, Math.round((amount - discount) * 100) / 100);
  return { discount: Math.round((amount - final) * 100) / 100, final };
}
