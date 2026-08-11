import { supabase } from "@/integrations/supabase/client";

/**
 * Exclui uma compra e TUDO que ela gerou (cascata manual — o schema não tem ON DELETE).
 * Ordem importa: contas a pagar -> parcelas -> faturas órfãs -> itens/NF/medições -> compra.
 */
export async function excluirCompraCascata(compraId: string): Promise<string | null> {
  // 1. parcelas (guarda as faturas afetadas para limpeza posterior)
  const { data: parcelas } = await supabase
    .from("compra_parcelas")
    .select("id,fatura_cartao_id")
    .eq("compra_id", compraId);
  const parcelaIds = (parcelas ?? []).map((p: any) => p.id);
  const faturaIds = Array.from(
    new Set((parcelas ?? []).map((p: any) => p.fatura_cartao_id).filter(Boolean)),
  ) as string[];

  // 2. contas a pagar geradas pela compra ou pelas suas parcelas
  const { error: eCp } = await supabase.from("contas_pagar").delete().eq("compra_id", compraId);
  if (eCp) return eCp.message;
  if (parcelaIds.length) {
    await supabase.from("contas_pagar").delete().in("compra_parcela_id", parcelaIds);
  }

  const { error: eParc } = await supabase.from("compra_parcelas").delete().eq("compra_id", compraId);
  if (eParc) return eParc.message;

  // 3. medições / recebimentos / itens / notas
  const { data: meds } = await supabase.from("medicoes").select("id").eq("compra_id", compraId);
  if (meds?.length) {
    const mids = meds.map((m: any) => m.id);
    await supabase.from("medicao_itens").delete().in("medicao_id", mids);
    await supabase.from("medicoes").delete().in("id", mids);
  }
  const { data: recs } = await supabase.from("recebimentos").select("id").eq("compra_id", compraId);
  if (recs?.length) {
    const rids = recs.map((r: any) => r.id);
    await supabase.from("recebimento_itens").delete().in("recebimento_id", rids);
    await supabase.from("recebimentos").delete().in("id", rids);
  }
  await supabase.from("compra_itens").delete().eq("compra_id", compraId);
  await supabase.from("compra_notas_fiscais").delete().eq("compra_id", compraId);

  // 4. a compra
  const { error } = await supabase.from("compras").delete().eq("id", compraId);
  if (error) return error.message;

  // 5. faturas que ficaram sem nenhuma parcela: remove conta a pagar e a própria fatura
  await limparFaturasVazias(faturaIds);
  return null;
}

/** Remove faturas de cartão que não têm mais parcelas (e as contas a pagar delas). */
export async function limparFaturasVazias(faturaIds: string[]) {
  if (!faturaIds.length) return;
  const { data: restantes } = await supabase
    .from("compra_parcelas")
    .select("fatura_cartao_id")
    .in("fatura_cartao_id", faturaIds);
  const aindaUsadas = new Set((restantes ?? []).map((p: any) => p.fatura_cartao_id));
  const vazias = faturaIds.filter((id) => !aindaUsadas.has(id));
  if (!vazias.length) return;
  await supabase.from("contas_pagar").delete().in("fatura_cartao_id", vazias).neq("status", "pago");
  await supabase.from("faturas_cartao").delete().in("id", vazias).neq("status", "paga");
}
