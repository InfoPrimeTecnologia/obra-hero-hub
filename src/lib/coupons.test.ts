import { describe, expect, it } from "vitest";
import { applyPercent, couponError, type CouponRow } from "./coupons";

const base: CouponRow = { id: "1", code: "X", percent: 20, expires_at: "2026-12-31", max_uses: 2, is_active: true };
const ok = { usesCount: 0, alreadyUsedByCustomer: false, today: "2026-10-13" };

describe("cupons", () => {
  it("aplica a porcentagem escolhida", () => {
    expect(applyPercent(109.9, 20)).toEqual({ discount: 21.98, final: 87.92 });
  });
  it("bloqueia após a data de validade", () => {
    expect(couponError(base, { ...ok, today: "2027-01-01" })).toBe("Cupom expirado");
  });
  it("bloqueia ao atingir o máximo de usos", () => {
    expect(couponError(base, { ...ok, usesCount: 2 })).toBe("Cupom esgotado");
  });
  it("permite só 1 uso por empresa", () => {
    expect(couponError(base, { ...ok, alreadyUsedByCustomer: true })).toBe("Sua empresa já utilizou este cupom");
  });
  it("aceita cupom válido", () => {
    expect(couponError(base, ok)).toBeNull();
  });
});
