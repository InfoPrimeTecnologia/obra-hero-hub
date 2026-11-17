import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { getActionCost } from "./credits.functions";

function pricingClient(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  return { from: vi.fn().mockReturnValue(query), query };
}

describe("internal credit pricing", () => {
  it("preserves configured costs for active actions", async () => {
    const client = pricingClient({ custo: 7, ativo: true });
    expect(await getActionCost(client, "chat_message")).toBe(7);
    expect(client.from).toHaveBeenCalledWith("credit_action_costs");
    expect(client.query.select).toHaveBeenCalledWith("custo, ativo");
    expect(client.query.eq).toHaveBeenCalledWith("action_key", "chat_message");
  });

  it("does not turn a denied pricing query into a free action", async () => {
    const client = pricingClient(null, { message: "internal permission details" });
    await expect(getActionCost(client, "chat_message")).rejects.toThrow(
      "Não foi possível consultar o custo de créditos. Tente novamente.",
    );
  });

  it("preserves free inactive and unconfigured actions", async () => {
    expect(await getActionCost(pricingClient({ custo: 7, ativo: false }), "disabled")).toBe(0);
    expect(await getActionCost(pricingClient(null), "unconfigured")).toBe(0);
  });
});