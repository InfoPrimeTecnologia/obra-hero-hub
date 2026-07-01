import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DuplicateSchema = z.object({
  sourceObraId: z.string().uuid(),
  newName: z.string().min(2),
  includePlanejamento: z.boolean().default(false),
});

/**
 * Duplica uma obra existente, copiando dados base + orçamento (etapas + subetapas).
 * A nova obra nasce com status="ativa" e datas reais zeradas.
 */
export const duplicateObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DuplicateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;

    // 1) Carrega obra origem e valida acesso
    const { data: source, error: srcErr } = await sb
      .from("obras")
      .select("*")
      .eq("id", data.sourceObraId)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!source) throw new Error("Obra de origem não encontrada");

    const { data: access } = await sb.rpc("user_has_customer_access", {
      _user: context.userId,
      _cust: source.customer_id,
    });
    if (!access) throw new Error("Sem acesso a esta obra");

    // 2) Cria nova obra
    const { data: nova, error: novaErr } = await sb
      .from("obras")
      .insert({
        customer_id: source.customer_id,
        empresa_id: source.empresa_id,
        name: data.newName,
        description: source.description,
        contact_name: source.contact_name,
        contact_email: source.contact_email,
        contact_whatsapp: source.contact_whatsapp,
        address_street: source.address_street,
        address_number: source.address_number,
        address_complement: source.address_complement,
        address_neighborhood: source.address_neighborhood,
        address_city: source.address_city,
        address_state: source.address_state,
        address_zip: source.address_zip,
        status: "ativa",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (novaErr) throw new Error(novaErr.message);

    // 3) Copia etapas e subetapas mantendo mapeamento
    const { data: etapas } = await sb
      .from("orcamento_etapas")
      .select("*")
      .eq("obra_id", source.id)
      .order("ordem");

    let etapasCount = 0;
    let subetapasCount = 0;
    const etapaIdMap = new Map<string, string>();

    for (const et of etapas ?? []) {
      const { data: novaEtapa, error: etErr } = await sb
        .from("orcamento_etapas")
        .insert({
          customer_id: source.customer_id,
          obra_id: nova.id,
          nome: et.nome,
          ordem: et.ordem,
          percentual: data.includePlanejamento ? et.percentual : 0,
          dt_inicio_prevista: data.includePlanejamento ? et.dt_inicio_prevista : null,
          dt_fim_prevista: data.includePlanejamento ? et.dt_fim_prevista : null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (etErr) throw new Error(etErr.message);
      etapaIdMap.set(et.id, novaEtapa.id);
      etapasCount += 1;
    }

    if (etapaIdMap.size > 0) {
      const { data: subs } = await sb
        .from("orcamento_subetapas")
        .select("*")
        .in("etapa_id", Array.from(etapaIdMap.keys()));

      if (subs && subs.length > 0) {
        const payload = subs.map((s) => ({
          customer_id: source.customer_id,
          etapa_id: etapaIdMap.get(s.etapa_id)!,
          nome: s.nome,
          ordem: s.ordem,
          tipo: s.tipo,
          valor_orcado: s.valor_orcado,
          created_by: context.userId,
        }));
        const { error: subErr } = await sb.from("orcamento_subetapas").insert(payload);
        if (subErr) throw new Error(subErr.message);
        subetapasCount = payload.length;
      }
    }

    return { obraId: nova.id, etapasCount, subetapasCount };
  });
