import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ListTree, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/obras/$obraId/relatorios/orcado-realizado")({
  component: RelOrcadoReal,
});


type Etapa = { id: string; nome: string; ordem: number | null };
type Sub = {
  id: string;
  etapa_id: string;
  nome: string;
  valor_orcado: number;
};

function RelOrcadoReal() {
  const { obraId } = Route.useParams();
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [realizadoPorSub, setRealizadoPorSub] = useState<Record<string, number>>({});
  const [realizadoSemSub, setRealizadoSemSub] = useState(0);
  const [comprasMensais, setComprasMensais] = useState<{ mes: string; valor: number }[]>([]);
  const [medicoesMensais, setMedicoesMensais] = useState<{ mes: string; valor: number }[]>([]);


  useEffect(() => {
    void (async () => {
      const { data: et } = await supabase
        .from("orcamento_etapas")
        .select("id,nome,ordem")
        .eq("obra_id", obraId)
        .order("ordem");
      setEtapas((et as Etapa[]) ?? []);
      const etapaIds = (et ?? []).map((e: any) => e.id);
      if (etapaIds.length > 0) {
        const { data: sb } = await supabase
          .from("orcamento_subetapas")
          .select("id,etapa_id,nome,valor_orcado")
          .in("etapa_id", etapaIds);
        setSubs((sb as Sub[]) ?? []);
      }

      const { data: compras } = await supabase
        .from("compras")
        .select("id")
        .eq("obra_id", obraId);
      const compraIds = (compras ?? []).map((c: any) => c.id);
      const map: Record<string, number> = {};
      let semSub = 0;
      if (compraIds.length > 0) {
        const { data: itens } = await supabase
          .from("compra_itens")
          .select("subetapa_id,quantidade,valor_unitario,compra_id")
          .in("compra_id", compraIds);
        (itens ?? []).forEach((i: any) => {
          const total = Number(i.quantidade || 0) * Number(i.valor_unitario || 0);
          if (i.subetapa_id) map[i.subetapa_id] = (map[i.subetapa_id] ?? 0) + total;
          else semSub += total;
        });
      }

      setRealizadoPorSub(map);
      setRealizadoSemSub(semSub);
    })();
  }, [obraId]);

  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalOrcado = subs.reduce((s, x) => s + Number(x.valor_orcado || 0), 0);
  const totalRealizado =
    Object.values(realizadoPorSub).reduce((s, v) => s + v, 0) + realizadoSemSub;

  return (
    <div>
      <PageHeader
        title="Orçado x Realizado"
        description="Compare o orçamento com as compras lançadas na obra"
      />
      <div className="space-y-4 p-8">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground">Orçado total</span>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(totalOrcado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground">Realizado total</span>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(totalRealizado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground">Saldo</span>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  totalOrcado - totalRealizado >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {brl(totalOrcado - totalRealizado)}
              </p>
            </CardContent>
          </Card>
        </div>

        {etapas.map((etapa) => {
          const etSubs = subs.filter((s) => s.etapa_id === etapa.id);
          const orc = etSubs.reduce((s, x) => s + Number(x.valor_orcado || 0), 0);
          const real = etSubs.reduce((s, x) => s + (realizadoPorSub[x.id] ?? 0), 0);
          const pct = orc > 0 ? Math.min(100, (real / orc) * 100) : 0;
          return (
            <Card key={etapa.id}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-2 font-semibold">
                    <ListTree className="h-4 w-4 text-primary" /> {etapa.nome}
                  </p>
                  <Badge variant={real > orc ? "destructive" : "outline"}>
                    {pct.toFixed(0)}%
                  </Badge>
                </div>
                <Progress value={pct} className="mb-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Orçado: {brl(orc)}</span>
                  <span>Realizado: {brl(real)}</span>
                  <span>Saldo: {brl(orc - real)}</span>
                </div>
                {etSubs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {etSubs.map((s) => {
                      const r = realizadoPorSub[s.id] ?? 0;
                      const o = Number(s.valor_orcado || 0);
                      return (
                        <div
                          key={s.id}
                          className="flex justify-between border-b py-1 text-xs"
                        >
                          <span>{s.nome}</span>
                          <span className="text-muted-foreground">
                            {brl(r)} / {brl(o)}{" "}
                            <span className={r > o ? "text-destructive" : ""}>
                              ({o > 0 ? ((r / o) * 100).toFixed(0) : "—"}%)
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {etapas.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Esta obra ainda não tem orçamento cadastrado.
            </CardContent>
          </Card>
        )}

        {realizadoSemSub > 0 && (
          <Card>
            <CardContent className="p-4 text-sm">
              <p className="font-medium text-destructive">
                Atenção: {brl(realizadoSemSub)} em compras sem subetapa vinculada
              </p>
              <p className="text-muted-foreground">
                Vincule esses itens a subetapas no orçamento para um comparativo preciso.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
