import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Notification = {
  id: string;
  type: "conta_vencendo" | "fatura_fechando" | "rdo_atrasado" | "orcamento_estourado";
  title: string;
  description: string;
  href: string;
  severity: "info" | "warning" | "critical";
  date?: string;
};

// Limite (%) de aviso de estouro de orçamento por subetapa.
// TODO: mover para tabela de configurações da empresa.
const BUDGET_ALERT_THRESHOLD = 0.85;

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date();
    const in3 = iso(addDays(today, 3));
    const todayStr = iso(today);
    const sevenAgo = iso(addDays(today, -7));

    const [contasRes, faturasRes, obrasRes] = await Promise.all([
      supabase
        .from("contas_pagar")
        .select("id,descricao,vencimento,valor,status,obra_id")
        .neq("status", "pago")
        .lte("vencimento", in3)
        .order("vencimento", { ascending: true })
        .limit(20),
      supabase
        .from("faturas_cartao")
        .select("id,competencia,dt_fechamento,valor_total,status,cartao_id")
        .eq("status", "aberta")
        .lte("dt_fechamento", in3)
        .gte("dt_fechamento", todayStr)
        .order("dt_fechamento", { ascending: true })
        .limit(20),
      supabase
        .from("obras")
        .select("id,name,status")
        .eq("status", "ativa")
        .limit(50),
    ]);

    const out: Notification[] = [];

    (contasRes.data ?? []).forEach((c: any) => {
      const vencida = c.vencimento < todayStr;
      out.push({
        id: `cp-${c.id}`,
        type: "conta_vencendo",
        title: vencida ? "Conta vencida" : "Conta vencendo",
        description: `${c.descricao ?? "Sem descrição"} — R$ ${Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        href: "/app/contas-pagar",
        severity: vencida ? "critical" : "warning",
        date: c.vencimento,
      });
    });

    (faturasRes.data ?? []).forEach((f: any) => {
      out.push({
        id: `fat-${f.id}`,
        type: "fatura_fechando",
        title: "Fatura fechando",
        description: `${f.competencia} — R$ ${Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        href: "/app/faturas-cartao",
        severity: "info",
        date: f.dt_fechamento,
      });
    });

    // Obras sem RDO há ≥7 dias
    const obras = obrasRes.data ?? [];
    if (obras.length > 0) {
      const obraIds = obras.map((o: any) => o.id);
      const { data: rdos } = await supabase
        .from("rdos")
        .select("obra_id,data")
        .in("obra_id", obraIds)
        .order("data", { ascending: false });
      const lastByObra = new Map<string, string>();
      (rdos ?? []).forEach((r: any) => {
        if (!lastByObra.has(r.obra_id)) lastByObra.set(r.obra_id, r.data);
      });
      obras.forEach((o: any) => {
        const last = lastByObra.get(o.id);
        if (!last || last < sevenAgo) {
          out.push({
            id: `rdo-${o.id}`,
            type: "rdo_atrasado",
            title: "RDO atrasado",
            description: `${o.name} — ${last ? `último em ${last}` : "nenhum RDO ainda"}`,
            href: `/app/obras/${o.id}/rdo`,
            severity: "warning",
            date: last ?? undefined,
          });
        }
      });
    }

    // Alertas de estouro de orçamento por subetapa
    if (obras.length > 0) {
      const obraIds = obras.map((o: any) => o.id);
      const obraNameById = new Map<string, string>(obras.map((o: any) => [o.id, o.name]));
      const [subRes, compRes] = await Promise.all([
        supabase
          .from("orcamento_subetapas")
          .select("id,nome,valor_orcado,etapa_id,orcamento_etapas!inner(obra_id)")
          .in("orcamento_etapas.obra_id", obraIds),
        supabase
          .from("compras")
          .select("subetapa_id,valor_total,obra_id")
          .in("obra_id", obraIds)
          .not("subetapa_id", "is", null),
      ]);
      const gastoPorSub = new Map<string, number>();
      (compRes.data ?? []).forEach((c: any) => {
        gastoPorSub.set(c.subetapa_id, (gastoPorSub.get(c.subetapa_id) ?? 0) + Number(c.valor_total ?? 0));
      });
      (subRes.data ?? []).forEach((s: any) => {
        const orcado = Number(s.valor_orcado ?? 0);
        if (orcado <= 0) return;
        const gasto = gastoPorSub.get(s.id) ?? 0;
        const pct = gasto / orcado;
        if (pct < BUDGET_ALERT_THRESHOLD) return;
        const obraId = s.orcamento_etapas?.obra_id as string | undefined;
        const obraName = obraId ? obraNameById.get(obraId) ?? "Obra" : "Obra";
        const estourou = pct >= 1;
        out.push({
          id: `orc-${s.id}`,
          type: "orcamento_estourado",
          title: estourou ? "Orçamento estourado" : "Orçamento próximo do limite",
          description: `${obraName} • ${s.nome} — ${(pct * 100).toFixed(0)}% (R$ ${gasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R$ ${orcado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`,
          href: obraId ? `/app/obras/${obraId}/compras` : "/app/obras",
          severity: estourou ? "critical" : "warning",
        });
      });
    }

    setItems(out);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const i = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { items, loading, reload: load };
}
