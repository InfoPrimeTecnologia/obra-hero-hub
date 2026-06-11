import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/obras/$obraId/gantt")({
  component: GanttPage,
});

type Etapa = {
  id: string;
  nome: string;
  ordem: number;
  dt_inicio_prevista: string | null;
  dt_fim_prevista: string | null;
  dt_inicio_real: string | null;
  dt_fim_real: string | null;
  percentual: number;
};

const DAY = 86400000;
const parseD = (s: string | null) => (s ? new Date(s + "T00:00:00").getTime() : null);
const fmt = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

type Status = "nao_planejada" | "prevista" | "andamento" | "concluida" | "atrasada";

const statusOf = (et: Etapa): Status => {
  const ini = parseD(et.dt_inicio_prevista);
  const fim = parseD(et.dt_fim_prevista);
  const hoje = Date.now();
  if (Number(et.percentual) >= 100 || et.dt_fim_real) return "concluida";
  if (!ini || !fim) return "nao_planejada";
  if (hoje < ini) return "prevista";
  if (hoje > fim) return "atrasada";
  return "andamento";
};

const statusLabel: Record<Status, string> = {
  nao_planejada: "Não planejada",
  prevista: "Prevista",
  andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

const statusColor: Record<Status, string> = {
  nao_planejada: "bg-muted text-muted-foreground",
  prevista: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  andamento: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  concluida: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
  atrasada: "bg-red-500/20 text-red-800 dark:text-red-300",
};

const barColor: Record<Status, string> = {
  nao_planejada: "bg-muted",
  prevista: "bg-blue-400",
  andamento: "bg-amber-400",
  concluida: "bg-emerald-500",
  atrasada: "bg-red-500",
};

function GanttPage() {
  const { obraId } = Route.useParams();
  const [obraNome, setObraNome] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from("obras").select("name").eq("id", obraId).maybeSingle();
      if (o) setObraNome(o.name);
      const { data } = await supabase
        .from("orcamento_etapas")
        .select("*")
        .eq("obra_id", obraId)
        .order("ordem");
      setEtapas((data ?? []) as Etapa[]);
    })();
  }, [obraId]);

  const { minT, maxT, totalDays, planejadas } = useMemo(() => {
    const planejadas = etapas.filter((e) => e.dt_inicio_prevista && e.dt_fim_prevista);
    if (planejadas.length === 0) {
      const now = Date.now();
      return { minT: now, maxT: now + 30 * DAY, totalDays: 30, planejadas };
    }
    const todas = planejadas.flatMap((e) => [
      parseD(e.dt_inicio_prevista)!,
      parseD(e.dt_fim_prevista)!,
      parseD(e.dt_inicio_real) ?? parseD(e.dt_inicio_prevista)!,
      parseD(e.dt_fim_real) ?? parseD(e.dt_fim_prevista)!,
    ]);
    const minT = Math.min(...todas, Date.now()) - 2 * DAY;
    const maxT = Math.max(...todas, Date.now()) + 2 * DAY;
    return { minT, maxT, totalDays: Math.ceil((maxT - minT) / DAY), planejadas };
  }, [etapas]);

  const pct = (t: number) => ((t - minT) / (maxT - minT)) * 100;
  const hojePct = pct(Date.now());

  // gera marcadores de meses
  const marcadores = useMemo(() => {
    const arr: { t: number; label: string }[] = [];
    const d = new Date(minT);
    d.setDate(1);
    while (d.getTime() < maxT) {
      arr.push({
        t: d.getTime(),
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      });
      d.setMonth(d.getMonth() + 1);
    }
    return arr;
  }, [minT, maxT]);

  return (
    <div>
      <PageHeader
        title="Gantt"
        description={obraNome ? `Cronograma — ${obraNome}` : "Cronograma da obra"}
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/obras/$obraId/orcamento" params={{ obraId }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-8">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-xs">
            <span className="text-muted-foreground">Legenda:</span>
            {(["prevista", "andamento", "concluida", "atrasada", "nao_planejada"] as Status[]).map((s) => (
              <Badge key={s} className={statusColor[s]} variant="secondary">
                {statusLabel[s]}
              </Badge>
            ))}
            <span className="ml-auto text-muted-foreground">
              {totalDays} dias • {fmt(minT)} → {fmt(maxT)}
            </span>
          </CardContent>
        </Card>

        {etapas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Sem etapas. Cadastre etapas em Orçamento.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="flex border-b">
                <div className="w-56 shrink-0 border-r p-3 text-xs font-medium text-muted-foreground">
                  Etapa
                </div>
                <div className="relative flex-1">
                  <div className="flex h-10 items-center text-xs text-muted-foreground">
                    {marcadores.map((m) => (
                      <div
                        key={m.t}
                        className="absolute -translate-x-1/2 border-l border-border pl-1"
                        style={{ left: `${pct(m.t)}%`, top: 4, height: 32 }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {etapas.map((et) => {
                const s = statusOf(et);
                const ini = parseD(et.dt_inicio_prevista);
                const fim = parseD(et.dt_fim_prevista);
                const iniR = parseD(et.dt_inicio_real);
                const fimR = parseD(et.dt_fim_real);
                return (
                  <div key={et.id} className="flex border-b last:border-b-0">
                    <div className="w-56 shrink-0 border-r p-3">
                      <p className="truncate text-sm font-medium">{et.nome}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge className={statusColor[s]} variant="secondary">
                          {statusLabel[s]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {Number(et.percentual).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="relative flex-1" style={{ minHeight: 56 }}>
                      {/* linha hoje */}
                      <div
                        className="pointer-events-none absolute top-0 z-10 h-full border-l-2 border-red-500/70"
                        style={{ left: `${hojePct}%` }}
                        title="Hoje"
                      />
                      {ini && fim && (
                        <div
                          className={`absolute top-2 h-5 rounded ${barColor[s]} opacity-80`}
                          style={{
                            left: `${pct(ini)}%`,
                            width: `${Math.max(pct(fim) - pct(ini), 0.5)}%`,
                          }}
                          title={`Previsto: ${fmt(ini)} → ${fmt(fim)}`}
                        >
                          <div
                            className="h-full rounded bg-foreground/30"
                            style={{ width: `${Number(et.percentual)}%` }}
                          />
                        </div>
                      )}
                      {iniR && (fimR || ini) && (
                        <div
                          className="absolute top-9 h-2 rounded bg-foreground/60"
                          style={{
                            left: `${pct(iniR)}%`,
                            width: `${Math.max(pct(fimR ?? Date.now()) - pct(iniR), 0.5)}%`,
                          }}
                          title={`Real: ${fmt(iniR)} → ${fimR ? fmt(fimR) : "em andamento"}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {planejadas.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhuma etapa com datas previstas. Edite as etapas no Orçamento para popular o cronograma.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
