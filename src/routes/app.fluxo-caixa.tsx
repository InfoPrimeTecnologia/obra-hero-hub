import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useObraSelecionada } from "@/lib/obra-context";
import { ObraScopeBadge } from "@/components/app/ObraScopeBadge";
import { toast } from "sonner";
import { fmtDataBR } from "@/lib/date-br";

export const Route = createFileRoute("/app/fluxo-caixa")({
  component: FluxoCaixaPage,
});

type Lanc = { id: string; tipo: string; valor: number; data: string; descricao: string; conta_bancaria_id: string; conciliado: boolean; estornado: boolean; estorno_de_id: string | null };
type CP = { valor: number; vencimento: string; status: string; descricao: string };
type CR = { valor: number; vencimento: string; status: string; descricao: string };

function FluxoCaixaPage() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const { obra } = useObraSelecionada();
  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(fimMes);
  const [contas, setContas] = useState<{ id: string; nome: string; saldo_atual: number }[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cps, setCps] = useState<CP[]>([]);
  const [crs, setCrs] = useState<CR[]>([]);

  const carregar = async () => {
    let qL = supabase.from("lancamentos").select("*").gte("data", de).lte("data", ate).order("data");
    let qP = supabase.from("contas_pagar").select("valor,vencimento,status,descricao").eq("status", "pendente").gte("vencimento", de).lte("vencimento", ate);
    let qR = supabase.from("contas_receber").select("valor,vencimento,status,descricao").eq("status", "pendente").gte("vencimento", de).lte("vencimento", ate);
    if (obra) {
      qL = qL.eq("obra_id", obra.id);
      qP = qP.eq("obra_id", obra.id);
      qR = qR.eq("obra_id", obra.id);
    }
    const [{ data: cb }, { data: l }, { data: cp }, { data: cr }] = await Promise.all([
      supabase.from("contas_bancarias").select("id,nome,saldo_atual").eq("ativo", true),
      qL, qP, qR,
    ]);
    setContas((cb ?? []) as any);
    setLancs((l ?? []) as Lanc[]);
    setCps((cp ?? []) as CP[]);
    setCrs((cr ?? []) as CR[]);
  };

  useEffect(() => { void carregar().catch((e) => toast.error(e.message)); }, [de, ate, obra?.id]);

  const realizado = useMemo(() => {
    const efetivos = lancs.filter(
      (l) => !l.estornado && !l.estorno_de_id && !l.descricao.startsWith("ESTORNO:"),
    );
    const entradas = efetivos.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
    const saidas = efetivos.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [lancs]);

  const previsto = useMemo(() => {
    const entradas = crs.reduce((s, c) => s + Number(c.valor), 0);
    const saidas = cps.reduce((s, c) => s + Number(c.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [cps, crs]);

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual), 0);

  return (
    <div>
      <PageHeader
        title="Fluxo de caixa"
        info="Projeção e realizado de entradas e saídas por período. Agrupa todas as obras e contas."
        description="Realizado vs previsto, por período"
      />
      <div className="space-y-4 p-8">
        <ObraScopeBadge />
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div className="space-y-1"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><Wallet className="h-4 w-4" /><span className="text-xs">Saldo total</span></div>
            <p className="mt-1 text-2xl font-bold">R$ {saldoTotal.toFixed(2)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600"><TrendingUp className="h-4 w-4" /><span className="text-xs">Entradas (real)</span></div>
            <p className="mt-1 text-2xl font-bold">R$ {realizado.entradas.toFixed(2)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive"><TrendingDown className="h-4 w-4" /><span className="text-xs">Saídas (real)</span></div>
            <p className="mt-1 text-2xl font-bold">R$ {realizado.saidas.toFixed(2)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <span className="text-xs text-muted-foreground">Resultado período</span>
            <p className={`mt-1 text-2xl font-bold ${realizado.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              R$ {realizado.saldo.toFixed(2)}
            </p>
          </CardContent></Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-semibold">Saldos por conta</h3>
              <div className="space-y-2">
                {contas.map(c => (
                  <div key={c.id} className="flex justify-between border-b pb-1 text-sm">
                    <span>{c.nome}</span>
                    <span className="font-semibold">R$ {Number(c.saldo_atual).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-semibold">Previsto no período</h3>
              <div className="flex justify-between text-sm"><span>A receber</span><span className="font-semibold text-emerald-600">+ R$ {previsto.entradas.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>A pagar</span><span className="font-semibold text-destructive">- R$ {previsto.saidas.toFixed(2)}</span></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-sm font-bold">
                <span>Saldo previsto</span>
                <span className={previsto.saldo >= 0 ? "text-emerald-600" : "text-destructive"}>R$ {previsto.saldo.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold">Lançamentos do período</h3>
            {lancs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento no período.</p>
            ) : (
              <div className="space-y-1">
                {lancs.map(l => (
                  <div key={l.id} className={`flex items-center justify-between border-b py-1 text-sm ${l.estornado ? "opacity-50 line-through" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant={l.tipo === "entrada" ? "default" : "secondary"}>{l.tipo}</Badge>
                      <span>{fmtDataBR(l.data)}</span>
                      <span className="text-muted-foreground">{l.descricao}</span>
                    </div>
                    <span className={l.tipo === "entrada" ? "text-emerald-600" : "text-destructive"}>
                      {l.tipo === "entrada" ? "+" : "-"} R$ {Number(l.valor).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
