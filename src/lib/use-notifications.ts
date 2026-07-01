import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Notification = {
  id: string;
  type: "conta_vencendo" | "fatura_fechando" | "rdo_atrasado" | "orcamento_estourado" | "compra_pendente_aprovacao";
  title: string;
  description: string;
  href: string;
  severity: "info" | "warning" | "critical";
  date?: string;
};

// Fallback quando a empresa ainda não tem configuração.
const DEFAULT_BUDGET_THRESHOLD_PCT = 90;

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const READ_STORAGE_KEY = "mestre360:notifications:read";

function loadReadIds(userId: string | undefined): Set<string> {
  if (!userId || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`${READ_STORAGE_KEY}:${userId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveReadIds(userId: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(`${READ_STORAGE_KEY}:${userId}`, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(user?.id));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setReadIds(loadReadIds(user?.id));
  }, [user?.id]);

  const markRead = (id: string) => {
    if (!user?.id) return;
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadIds(user.id, next);
      return next;
    });
  };
  const markAllRead = () => {
    if (!user?.id) return;
    const next = new Set(items.map((n) => n.id));
    setReadIds(next);
    saveReadIds(user.id, next);
  };

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
      const [subRes, compRes, custRes] = await Promise.all([
        supabase
          .from("orcamento_subetapas")
          .select("id,nome,valor_orcado,etapa_id,orcamento_etapas!inner(obra_id)")
          .in("orcamento_etapas.obra_id", obraIds),
        supabase
          .from("compras")
          .select("subetapa_id,valor_total,obra_id")
          .in("obra_id", obraIds)
          .not("subetapa_id", "is", null),
        supabase
          .from("customers")
          .select("alerta_subetapa_pct")
          .limit(1)
          .maybeSingle(),
      ]);
      const thresholdPct = Number(
        (custRes.data as { alerta_subetapa_pct?: number } | null)?.alerta_subetapa_pct
          ?? DEFAULT_BUDGET_THRESHOLD_PCT,
      );
      const threshold = thresholdPct / 100;
      const gastoPorSub = new Map<string, number>();
      (compRes.data ?? []).forEach((c: any) => {
        gastoPorSub.set(c.subetapa_id, (gastoPorSub.get(c.subetapa_id) ?? 0) + Number(c.valor_total ?? 0));
      });
      (subRes.data ?? []).forEach((s: any) => {
        const orcado = Number(s.valor_orcado ?? 0);
        if (orcado <= 0) return;
        const gasto = gastoPorSub.get(s.id) ?? 0;
        const pct = gasto / orcado;
        if (pct < threshold) return;
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

    // Compras pendentes de aprovação (para quem pode aprovar)
    const [{ data: owned }, { data: memberOf }] = await Promise.all([
      supabase.from("customers").select("id").eq("owner_user_id", user.id).maybeSingle(),
      supabase.from("customer_members").select("customer_id,pode_aprovar_compras").eq("user_id", user.id).eq("status", "ativo").maybeSingle(),
    ]);
    const isApprover = !!owned || !!memberOf?.pode_aprovar_compras;
    if (isApprover) {
      const { data: pend } = await supabase
        .from("compras")
        .select("id,descricao,valor_total,obra_id,data_compra")
        .eq("aprovacao_status", "pendente")
        .order("data_compra", { ascending: false })
        .limit(20);
      (pend ?? []).forEach((c: any) => {
        out.push({
          id: `apr-${c.id}`,
          type: "compra_pendente_aprovacao",
          title: "Compra pendente de aprovação",
          description: `${c.descricao ?? "Compra"} — R$ ${Number(c.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          href: `/app/obras/${c.obra_id}/compras`,
          severity: "warning",
          date: c.data_compra,
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
