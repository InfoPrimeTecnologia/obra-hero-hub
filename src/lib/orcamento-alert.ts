import { supabase } from "@/integrations/supabase/client";

export type OrcamentoAlertResult = {
  shouldWarn: boolean;
  orcado: number;
  gastoAtual: number;
  novoGasto: number;
  pctAtual: number;
  pctFuturo: number;
  threshold: number;
  subetapaNome: string;
  ultrapassa: boolean;
};

/**
 * Verifica se o novo valor a ser lançado ultrapassará o limite de alerta
 * configurado (em %) para a subetapa.
 *
 * @param subetapaId  Subetapa alvo do lançamento
 * @param novoValor   Valor a ser adicionado (não incluir o valor já existente do próprio item em edição — passe o delta)
 * @param customerId  Empresa dona (para pegar o threshold configurado)
 * @param excludeCompraId Ignorar valores desta compra (útil ao editar)
 */
export async function checkOrcamentoAlert(
  subetapaId: string,
  novoValor: number,
  customerId: string,
  excludeCompraId?: string,
): Promise<OrcamentoAlertResult> {
  const [{ data: sub }, { data: cust }, { data: comps }] = await Promise.all([
    supabase
      .from("orcamento_subetapas")
      .select("id,nome,valor_orcado")
      .eq("id", subetapaId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("alerta_subetapa_pct")
      .eq("id", customerId)
      .maybeSingle(),
    (() => {
      let q = supabase
        .from("compra_itens")
        .select("valor_total,compra_id")
        .eq("subetapa_id", subetapaId);
      if (excludeCompraId) q = q.neq("compra_id", excludeCompraId);
      return q;
    })(),
  ]);

  const orcado = Number((sub as { valor_orcado?: number } | null)?.valor_orcado ?? 0);
  const threshold = Number((cust as { alerta_subetapa_pct?: number } | null)?.alerta_subetapa_pct ?? 90);
  const gastoAtual = (comps ?? []).reduce(
    (s, r: { valor_total?: number | null }) => s + Number(r.valor_total ?? 0),
    0,
  );
  const gastoFuturo = gastoAtual + novoValor;
  const pctAtual = orcado > 0 ? (gastoAtual / orcado) * 100 : 0;
  const pctFuturo = orcado > 0 ? (gastoFuturo / orcado) * 100 : 0;

  return {
    shouldWarn: orcado > 0 && pctFuturo >= threshold && pctAtual < 100 ? true : orcado > 0 && pctFuturo >= threshold,
    orcado,
    gastoAtual,
    novoGasto: gastoFuturo,
    pctAtual,
    pctFuturo,
    threshold,
    subetapaNome: (sub as { nome?: string } | null)?.nome ?? "subetapa",
    ultrapassa: orcado > 0 && gastoFuturo > orcado,
  };
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
