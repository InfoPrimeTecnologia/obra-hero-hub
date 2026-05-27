// Asaas API helper — server only
const SANDBOX = "https://sandbox.asaas.com/api/v3";
const PRODUCTION = "https://api.asaas.com/v3";

/**
 * Detecta automaticamente o ambiente a partir do prefixo da API key:
 *  - $aact_prod_  → produção
 *  - $aact_hmlg_  → sandbox
 *  - qualquer outro → usa ASAAS_ENV (default sandbox)
 * Isso evita o erro comum de configurar a key de produção mas esquecer o ASAAS_ENV.
 */
export function asaasEnv(): "production" | "sandbox" {
  const key = process.env.ASAAS_API_KEY ?? "";
  if (key.startsWith("$aact_prod_")) return "production";
  if (key.startsWith("$aact_hmlg_")) return "sandbox";
  const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

export function asaasBaseUrl(): string {
  return asaasEnv() === "production" ? PRODUCTION : SANDBOX;
}

export function asaasHeaders(): Record<string, string> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada");
  return {
    "Content-Type": "application/json",
    access_token: key,
    "User-Agent": "Mestre360/1.0",
  };
}

export async function asaasFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${asaasBaseUrl()}${path}`;
  const resp = await fetch(url, {
    ...init,
    headers: { ...asaasHeaders(), ...(init.headers ?? {}) },
  });
  const text = await resp.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  // Log estruturado para facilitar diagnóstico em produção
  console.log(
    `[asaas] ${init.method ?? "GET"} ${path} → ${resp.status} (env=${asaasEnv()})`,
  );
  if (!resp.ok) {
    console.error(`[asaas] erro:`, text?.slice(0, 500));
    const msg =
      (body as { errors?: Array<{ description?: string }> })?.errors?.[0]
        ?.description ??
      `Asaas HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export type AsaasBillingType = "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";
export type AsaasCycle =
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

export function mapCycle(
  cycle: "monthly" | "quarterly" | "semiannual" | "annual",
): AsaasCycle {
  switch (cycle) {
    case "monthly":
      return "MONTHLY";
    case "quarterly":
      return "QUARTERLY";
    case "semiannual":
      return "SEMIANNUALLY";
    case "annual":
      return "YEARLY";
  }
}
