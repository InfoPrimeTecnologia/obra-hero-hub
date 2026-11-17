import { beforeEach, describe, expect, it, vi } from "vitest";
const gate = vi.hoisted(() => ({ allowed: true, choice: "granted" as string | null }));
vi.mock("./consent", () => ({ canTrack: async () => gate.allowed, readChoice: () => gate.choice }));

describe("Meta cadastro", () => {
  beforeEach(() => {
    vi.resetModules();
    gate.allowed = true;
    gate.choice = "granted";
    vi.stubGlobal("window", { location: { pathname: "/login" } });
    vi.stubGlobal("document", { createElement: () => ({}), head: { appendChild: vi.fn() } });
  });
  it("envia CompleteRegistration para o Pixel 1757137038715296 uma única vez", async () => {
    const { trackAccountCreated } = await import("./meta-pixel");
    await trackAccountCreated("new-account");
    await trackAccountCreated("new-account");
    const events = window.fbq?.queue.filter(args => args[0] === "trackSingle");
    expect(events).toHaveLength(1);
    expect(events?.[0]?.slice(0, 3)).toEqual(["trackSingle", "1757137038715296", "CompleteRegistration"]);
    expect(events?.[0]?.[4]).toEqual({ eventID: "new-account" });
  });
  it("recusa impede carregamento e envio; aceite posterior não reenvia cadastro bloqueado", async () => {
    gate.allowed = false;
    gate.choice = "denied";
    const { trackAccountCreated, syncMetaPermission } = await import("./meta-pixel");
    await trackAccountCreated("blocked-account");
    expect(window.fbq).toBeUndefined();
    gate.allowed = true;
    gate.choice = "granted";
    await syncMetaPermission();
    expect(window.fbq?.queue.filter(args => args[0] === "trackSingle")).toHaveLength(0);
  });
  it("retirada de consentimento revoga novos envios", async () => {
    const { trackAccountCreated, syncMetaPermission } = await import("./meta-pixel");
    await trackAccountCreated("first-account");
    gate.allowed = false;
    gate.choice = "denied";
    await syncMetaPermission();
    await trackAccountCreated("second-account");
    expect(window.fbq?.queue).toContainEqual(["consent", "revoke"]);
    expect(window.fbq?.queue.filter(args => args[0] === "trackSingle")).toHaveLength(1);
  });
});