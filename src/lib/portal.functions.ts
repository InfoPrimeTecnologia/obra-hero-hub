import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Público — leitura por token (sem auth)
// ============================================================
export const getPortalData = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: obra, error: obraErr } = await supabaseAdmin
      .from("obras")
      .select(
        "id,name,description,address_city,address_state,address_neighborhood,status,foto_url,start_date,expected_end_date,customer_id,empresa_id,portal_ativo",
      )
      .eq("portal_token", data.token)
      .eq("portal_ativo", true)
      .maybeSingle();

    if (obraErr) throw new Error(obraErr.message);
    if (!obra) return { obra: null } as const;

    const [empresaRes, etapasRes, rdosRes, medRes] = await Promise.all([
      obra.empresa_id
        ? supabaseAdmin
            .from("empresas")
            .select("nome,logo_url")
            .eq("id", obra.empresa_id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabaseAdmin
        .from("orcamento_etapas")
        .select(
          "id,nome,ordem,percentual,dt_inicio_prevista,dt_fim_prevista,dt_inicio_real,dt_fim_real",
        )
        .eq("obra_id", obra.id)
        .order("ordem", { ascending: true }),
      supabaseAdmin
        .from("rdos")
        .select("id,data,clima_manha,clima_tarde,condicao,responsavel,observacoes")
        .eq("obra_id", obra.id)
        .order("data", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("medicoes_obra")
        .select("id,numero,data,valor_total,status")
        .eq("obra_id", obra.id)
        .order("data", { ascending: false })
        .limit(6),
    ]);

    const rdoIds = (rdosRes.data ?? []).map((r: any) => r.id);
    const { data: fotos } = rdoIds.length
      ? await supabaseAdmin
          .from("rdo_anexos")
          .select("id,rdo_id,storage_path,legenda,tipo")
          .in("rdo_id", rdoIds)
          .eq("tipo", "foto")
      : { data: [] as any[] };

    // bucket obra-fotos é público → URL direta
    const supabaseUrl = process.env.SUPABASE_URL ?? "";
    const fotosComUrl = (fotos ?? []).map((f: any) => ({
      id: f.id,
      rdo_id: f.rdo_id,
      legenda: f.legenda,
      url: `${supabaseUrl}/storage/v1/object/public/obra-fotos/${f.storage_path}`,
    }));

    // avanço físico médio = média dos percentuais das etapas
    const etapas = etapasRes.data ?? [];
    const avancoFisico =
      etapas.length > 0
        ? etapas.reduce((a: number, e: any) => a + Number(e.percentual ?? 0), 0) / etapas.length
        : 0;

    return {
      obra: {
        id: obra.id,
        name: obra.name,
        description: obra.description,
        cidade: [obra.address_city, obra.address_state].filter(Boolean).join(" / "),
        bairro: obra.address_neighborhood,
        status: obra.status,
        foto_url: obra.foto_url,
        start_date: obra.start_date,
        expected_end_date: obra.expected_end_date,
      },
      empresa: empresaRes?.data ?? null,
      avancoFisico,
      etapas,
      rdos: rdosRes.data ?? [],
      fotos: fotosComUrl,
      medicoes: medRes.data ?? [],
    } as const;
  });

// ============================================================
// Autenticado — ativa/desativa portal, rotaciona token
// ============================================================
export const togglePortalObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ obraId: z.string().uuid(), ativar: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: { portal_ativo: boolean; portal_token?: string } = {
      portal_ativo: data.ativar,
    };
    if (data.ativar) {
      patch.portal_token = crypto.randomUUID();
    }
    const { data: updated, error } = await context.supabase
      .from("obras")
      .update(patch)
      .eq("id", data.obraId)
      .select("portal_token,portal_ativo")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const getPortalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ obraId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: obra, error } = await context.supabase
      .from("obras")
      .select("portal_token,portal_ativo")
      .eq("id", data.obraId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return obra;
  });
