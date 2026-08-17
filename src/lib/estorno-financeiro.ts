import { supabase } from "@/integrations/supabase/client";

export async function estornarLancamentoAtomico(lancamentoId: string, motivo: string) {
  const { data, error } = await supabase.rpc("estornar_lancamento", {
    _lancamento_id: lancamentoId,
    _motivo: motivo.trim(),
  });

  if (error) throw error;
  return data;
}