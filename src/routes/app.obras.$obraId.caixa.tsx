import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { downloadCsv, fmtNum } from "@/lib/csv-export";
import { exportCaixaBancosPdf } from "@/lib/pdf-reports";
import { TrendingUp, ArrowLeftRight, Banknote, Plus, Undo2, FileDown, Wallet, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { estornarLancamentoAtomico } from "@/lib/estorno-financeiro";
import { toast } from "sonner";
import { fmtDataBR, hojeISO } from "@/lib/date-br";

export const Route = createFileRoute("/app/obras/$obraId/caixa")({
  component: CaixaObraPage,
});

type Lanc = {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  descricao: string;
  conta_bancaria_id: string;
  estornado: boolean | null;
  estorno_de_id: string | null;
  conta_pagar_id: string | null;
  customer_id: string;
};
type Conta = { id: string; nome: string; saldo_atual: number };

function CaixaObraPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const hoje = hojeISO();
  const ini = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [de, setDe] = useState(ini);
  const [ate, setAte] = useState(hoje);
  const [contas, setContas] = useState<Conta[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [openEntrada, setOpenEntrada] = useState(false);
  const [entrada, setEntrada] = useState({
    valor: "",
    data: hoje,
    conta_bancaria_id: "",
    descricao: "",
  });

  const carregar = async () => {
    const [{ data: cb }, { data: l }] = await Promise.all([
      supabase
        .from("contas_bancarias")
        .select("id,nome,saldo_atual")
        .eq("ativo", true)
        .or(`obra_id.eq.${obraId},obra_id.is.null`),
      supabase
        .from("lancamentos")
        .select("id,tipo,valor,data,descricao,conta_bancaria_id,estornado,estorno_de_id,conta_pagar_id,customer_id")
        .eq("obra_id", obraId)
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: false }),
    ]);
    setContas((cb as Conta[]) ?? []);
    setLancs((l as Lanc[]) ?? []);
  };

  const estornarLancamento = async (l: Lanc) => {
    const motivo = window.prompt("Motivo do estorno:");
    if (!motivo || !motivo.trim()) return;

    try {
      const result = await estornarLancamentoAtomico(l.id, motivo);
      const token = result?.[0]?.estorno_token;
      if (!token) throw new Error("O banco não retornou o identificador do estorno");

      if (l.conta_pagar_id) {
        const { data: cp } = await supabase
          .from("contas_pagar").select("id,compra_id,fatura_cartao_id").eq("id", l.conta_pagar_id).maybeSingle();
        const { error: e3 } = await supabase.from("contas_pagar").update({
          status: "pendente",
          pago_em: null,
          valor_pago: 0,
          conta_bancaria_id: null,
          estornado: true,
          estorno_token: token,
          estornado_em: new Date().toISOString(),
          estornado_por: user!.id,
          motivo_estorno: motivo.trim(),
        } as any).eq("id", l.conta_pagar_id);
        if (e3) throw e3;

        if (cp?.compra_id) {
          await supabase.from("compras").update({ status: "pendente" }).eq("id", cp.compra_id);
        }
        if (cp?.fatura_cartao_id) {
          await supabase.from("faturas_cartao")
            .update({ status: "fechada", valor_pago: 0, pago_em: null })
            .eq("id", cp.fatura_cartao_id);
          await supabase.from("compra_parcelas")
            .update({ status: "pendente", pago_em: null })
            .eq("fatura_cartao_id", cp.fatura_cartao_id);
        }
        toast.success("Estorno realizado — conta/fatura voltou para pendente");
      } else {
        toast.success("Lançamento estornado");
      }
      void carregar();
    } catch (err: any) {
      toast.error("Não foi possível estornar", { description: err?.message ?? String(err) });
    }
  };



  useEffect(() => {
    void carregar();
  }, [obraId, de, ate]);

  const lancarEntrada = async (e: FormEvent) => {
    e.preventDefault();
    if (!entrada.conta_bancaria_id) return toast.error("Selecione a conta");
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_user_id", user!.id)
      .maybeSingle();
    if (!customer) return toast.error("Conta não identificada");
    const { error } = await supabase.from("lancamentos").insert({
      customer_id: customer.id,
      tipo: "entrada",
      valor: Number(entrada.valor || 0),
      data: entrada.data,
      descricao: entrada.descricao || "Entrada",
      conta_bancaria_id: entrada.conta_bancaria_id,
      obra_id: obraId,
    });
    if (error) return toast.error(error.message);
    toast.success("Entrada lançada");
    setOpenEntrada(false);
    setEntrada({ valor: "", data: hoje, conta_bancaria_id: "", descricao: "" });
    void carregar();
  };

  // O extrato preserva o par contábil, mas os indicadores operacionais ignoram
  // tanto o lançamento cancelado quanto o contralançamento do estorno.
  const lancamentosEfetivos = lancs.filter(
    (l) => !l.estornado && !l.estorno_de_id && !l.descricao.startsWith("ESTORNO:"),
  );
  const entradas = lancamentosEfetivos
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saidas = lancamentosEfetivos
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + Number(l.valor), 0);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const contaNome = (id: string) => contas.find((c) => c.id === id)?.nome ?? "—";
  const saldoAtual = contas.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);

  const exportarExcel = () => {
    let acumulado = 0;
    const rows = lancs.map((l) => {
      const sinal = l.tipo === "entrada" ? 1 : -1;
      if (!l.estornado) acumulado += sinal * Number(l.valor);
      return [
        fmtDataBR(l.data),
        l.estornado ? "estornado" : l.estorno_de_id || l.descricao.startsWith("ESTORNO:") ? "estorno" : l.tipo,
        l.descricao,
        contaNome(l.conta_bancaria_id),
        fmtNum(sinal * Number(l.valor)),
        fmtNum(acumulado),
      ];
    });
    rows.push([]);
    rows.push(["Entradas", "", "", "", fmtNum(entradas), ""]);
    rows.push(["Saídas", "", "", "", fmtNum(saidas), ""]);
    rows.push(["Saldo do período", "", "", "", fmtNum(entradas - saidas), ""]);
    rows.push(["Saldo atual das contas", "", "", "", fmtNum(saldoAtual), ""]);
    downloadCsv(`caixa-bancos-${de}-a-${ate}`, rows, [
      "Data",
      "Tipo",
      "Descrição",
      "Conta",
      "Valor",
      "Acumulado",
    ]);
  };


  return (
    <div>
      <PageHeader
        title="Caixa e bancos"
        info="Movimentações financeiras (entradas e saídas) desta obra por conta bancária ou caixa. Base para o fluxo de caixa da obra."
        description="Movimentações financeiras vinculadas a esta obra"
        actions={
          <div className="flex gap-2">
            <Dialog open={openEntrada} onOpenChange={setOpenEntrada}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Entrada
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova entrada</DialogTitle>
                </DialogHeader>
                <form onSubmit={lancarEntrada} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Conta *</Label>
                    <Select
                      value={entrada.conta_bancaria_id}
                      onValueChange={(v) => setEntrada((p) => ({ ...p, conta_bancaria_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {contas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Valor *</Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        value={entrada.valor}
                        onChange={(e) => setEntrada((p) => ({ ...p, valor: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data *</Label>
                      <Input
                        required
                        type="date"
                        value={entrada.data}
                        onChange={(e) => setEntrada((p) => ({ ...p, data: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      rows={2}
                      value={entrada.descricao}
                      onChange={(e) =>
                        setEntrada((p) => ({ ...p, descricao: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Lançar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button asChild variant="outline">
              <Link to="/app/transferencias">
                <ArrowLeftRight className="mr-2 h-4 w-4" /> Transferir
              </Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Entradas</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(entradas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <TrendingUp className="h-4 w-4 rotate-180" />
                <span className="text-xs">Saídas</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(saidas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground">Saldo do período</span>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  entradas - saidas >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {brl(entradas - saidas)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Banknote className="h-4 w-4" /> Extrato
            </h3>
            {lancs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento no período.</p>
            ) : (
              <div className="space-y-1">
                {lancs.map((l) => (
                  <div
                    key={l.id}
                    className={`flex items-center justify-between border-b py-1 text-sm ${
                      l.estornado ? "opacity-50 line-through" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={l.tipo === "entrada" ? "default" : "secondary"}>
                        {l.estorno_de_id ? "estorno" : l.tipo}
                      </Badge>
                      <span>{fmtDataBR(l.data)}</span>
                      <span className="text-muted-foreground">{l.descricao}</span>
                      <span className="text-xs text-muted-foreground">
                        • {contaNome(l.conta_bancaria_id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={l.tipo === "entrada" ? "text-emerald-600" : "text-destructive"}
                      >
                        {l.tipo === "entrada" ? "+" : "-"} {brl(Number(l.valor))}
                      </span>
                      {!l.estornado && !l.estorno_de_id && !l.descricao.startsWith("ESTORNO:") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Estornar — devolve o valor à conta e reabre a compra"
                          onClick={() => void estornarLancamento(l)}
                        >
                          <Undo2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

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
