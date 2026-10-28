import { describe, expect, it } from "vitest";
import { TRIAL_CREDITS, TRIAL_DAYS, trialAccessUntil, trialBlockReason } from "./trial";

describe("teste grátis", () => {
  it("dura 5 dias com 100 créditos", () => {
    expect(TRIAL_DAYS).toBe(5);
    expect(TRIAL_CREDITS).toBe(100);
    expect(trialAccessUntil(new Date("2026-10-28T12:00:00Z"))).toBe("2026-11-02");
  });
  it("bloqueia e-mail que já usou, ignorando maiúsculas", () => {
    expect(
      trialBlockReason({ email: "Joao@X.com ", usedEmails: ["joao@x.com"], customerHasSubscription: false }),
    ).not.toBeNull();
  });
  it("libera e-mail novo sem assinatura", () => {
    expect(
      trialBlockReason({ email: "novo@x.com", usedEmails: ["joao@x.com"], customerHasSubscription: false }),
    ).toBeNull();
  });
  it("bloqueia empresa que já teve assinatura", () => {
    expect(
      trialBlockReason({ email: "novo@x.com", usedEmails: [], customerHasSubscription: true }),
    ).not.toBeNull();
  });
});
