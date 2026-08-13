import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Receipt, Wallet, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/faturas-cartao")({
  component: FaturasCartaoPage,
});

type Fatura = {
  id: string;
  cartao_id: string;
  competencia: string;
  dt_fechamento: string;
  dt_vencimento: string;
  valor_total: number;
  valor_pago: number | null;
  status: string;
};

type Cartao = { id: string; nome: string; ultimos_4: string | null };
type ContaBancaria = { id: string; nome: string; banco: string | null };

function fmtBR(ymd: string | null | undefined) {
  if (!ymd) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function hojeYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const statusVariant = (s: string) =>
  s === "paga" ? "default" : s === "fechada" ? "secondary" : "outline";

const statusLabel = (s: string) =>
  s === "paga" ? "Paga" : s === "fechada" ? "Fechada" : "Aberta";

function FaturasCartaoPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [cpByFatura, setCpByFatura] = useState<Record<string, string>>({});
  const [rateio, setRateio] = useState<Record<string, { obra: string; valor: number }[]>>({});
  const [faturaComObra, setFaturaComObra] = useState<Record<string, boolean>>({});
  const [filtroCartao, setFiltroCartao] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const [pagando, setPagando] = useState<Fatura | null>(null);
  const [payForm, setPayForm] = useState({ conta_bancaria_id: "", data: hojeYMD() });
  const [salvandoPag, setSalvandoPag] = useState(false);

  const carregar = async () => {
    const [{ data: fs }, { data: cs }, { data: cbs }] = await Promise.all([
      supabase.from("faturas_cartao").select("*").order("dt_vencimento", { ascending: false }),
      supabase.from("cartoes").select("id,nome,ultimos_4").eq("ativo", true).order("nome"),
      supabase.from("contas_bancarias").select("id,nome,banco").eq("ativo", true).order("nome"),
    ]);
    setFaturas((fs ?? []) as Fatura[]);
    setCartoes((cs ?? []) as Cartao[]);
    setContas((cbs ?? []) as ContaBancaria[]);
    const ids = (fs ?? []).map((f: any) => f.id);
    if (ids.length) {
      const [{ data: cps }, { data: parc }] = await Promise.all([
        supabase.from("contas_pagar").select("id,fatura_cartao_id").in("fatura_cartao_id", ids),
        supabase.from("compra_parcelas").select("valor,fatura_cartao_id,compra_id").in("fatura_cartao_id", ids),
      ]);
      const map: Record<string, string> = {};
      (cps ?? []).forEach((c: any) => { if (c.fatura_cartao_id && !map[c.fatura_cartao_id]) map[c.fatura_cartao_id] = c.id; });
      setCpByFatura(map);

      // Rateio por obra: a fatura da empresa é a soma das faturas de cada obra
      const compraIds = Array.from(new Set((parc ?? []).map((p: any) => p.compra_id)));
      const obraPorCompra: Record<string, string | null> = {};
      const nomeObra: Record<string, string> = {};
      if (compraIds.length) {
        const { data: compras } = await supabase.from("compras").select("id,obra_id").in("id", compraIds);
        (compras ?? []).forEach((c: any) => { obraPorCompra[c.id] = c.obra_id; });
        const obraIds = Array.from(new Set(Object.values(obraPorCompra).filter(Boolean))) as string[];
        if (obraIds.length) {
          const { data: obras } = await supabase.from("obras").select("id,name").in("id", obraIds);
          (obras ?? []).forEach((o: any) => { nomeObra[o.id] = o.name; });
        }
      }
      const rat: Record<string, { obra: string; valor: number }[]> = {};
      const comObra: Record<string, boolean> = {};
      for (const p of (parc ?? []) as any[]) {
        if (!p.fatura_cartao_id) continue;
        const oId = obraPorCompra[p.compra_id];
        if (oId) comObra[p.fatura_cartao_id] = true;
        const label = oId ? nomeObra[oId] ?? "Obra" : "Sem obra";
        const arr = rat[p.fatura_cartao_id] ?? [];
        const found = arr.find((x) => x.obra === label);
        if (found) found.valor += Number(p.valor || 0);
        else arr.push({ obra: label, valor: Number(p.valor || 0) });
        rat[p.fatura_cartao_id] = arr;
      }
      setRateio(rat);
      setFaturaComObra(comObra);
    }

  };
  useEffect(() => { void carregar(); }, []);

  const fechar = async (f: Fatura) => {
    const { error } = await supabase
      .from("faturas_cartao")
      .update({ status: "fechada" })
      .eq("id", f.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Fatura fechada — conta a pagar gerada");
    void carregar();
  };

  const abrirPagamento = (f: Fatura) => {
    setPagando(f);
    setPayForm({ conta_bancaria_id: "", data: hojeYMD() });
  };

  const pagarFatura = async () => {
    if (!pagando) return;
    if (!payForm.conta_bancaria_id) return toast.error("Escolha a conta bancária");
    setSalvandoPag(true);
    try {
      let f = pagando;
      // Se ainda aberta, fecha primeiro para o trigger criar a conta a pagar
      if (f.status === "aberta") {
        const { error } = await supabase.from("faturas_cartao").update({ status: "fechada" }).eq("id", f.id);
        if (error) throw error;
      }
      // Busca todas as contas a pagar da fatura (uma por obra) ainda em aberto
      let cps: { id: string; valor: number; status: string }[] = [];
      for (let i = 0; i < 3 && cps.length === 0; i++) {
        const { data } = await supabase
          .from("contas_pagar").select("id,valor,status").eq("fatura_cartao_id", f.id);
        cps = ((data ?? []) as any[]).map((c) => ({ id: c.id, valor: Number(c.valor || 0), status: c.status }));
        if (cps.length === 0) await new Promise((r) => setTimeout(r, 400));
      }
      const pendentes = cps.filter((c) => c.status !== "pago");
      if (pendentes.length === 0) throw new Error("Conta a pagar da fatura não encontrada");

      // Baixa todas as partes (obras) → trigger cp_baixa_to_lancamento debita a conta bancária
      for (const cp of pendentes) {
        const { error: e1 } = await supabase.from("contas_pagar").update({
          status: "pago",
          pago_em: payForm.data,
          valor_pago: cp.valor,
          conta_bancaria_id: payForm.conta_bancaria_id,
        }).eq("id", cp.id);
        if (e1) throw e1;
      }

      // Marca a fatura e as parcelas da compra como pagas
      await supabase.from("faturas_cartao").update({
        status: "paga",
        valor_pago: f.valor_total,
        pago_em: new Date().toISOString(),
      }).eq("id", f.id);
      await supabase.from("compra_parcelas").update({
        status: "pago",
        pago_em: new Date().toISOString(),
      }).eq("fatura_cartao_id", f.id);

      toast.success("Fatura paga e lançada no banco");
      setPagando(null);
      void carregar();
    } catch (err: any) {
      toast.error("Erro", { description: err?.message ?? String(err) });
    } finally {
      setSalvandoPag(false);
    }
  };

  const nomeCartao = (id: string) => {
    const c = cartoes.find((x) => x.id === id);
    if (!c) return "Cartão";
    return c.ultimos_4 ? `${c.nome} •••• ${c.ultimos_4}` : c.nome;
  };

  /** Fatura sem nenhuma parcela vinculada (sobrou de compras excluídas). */
  const faturaVazia = (f: Fatura) =>
    (rateio[f.id]?.length ?? 0) === 0 && Number(f.valor_total || 0) === 0 && f.status !== "paga";

  const excluirFatura = async (f: Fatura) => {
    await supabase.from("contas_pagar").delete().eq("fatura_cartao_id", f.id).neq("status", "pago");
    const { error } = await supabase.from("faturas_cartao").delete().eq("id", f.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Fatura vazia removida");
    void carregar();
  };

  const filtradas = faturas.filter((f) =>
    (filtroCartao === "todos" || f.cartao_id === filtroCartao) &&
    (filtroStatus === "todos" || f.status === filtroStatus)
  );


  return (
    <div>
      <PageHeader
        title="Faturas de cartão"
        info="Faturas fechadas de cada cartão, com detalhamento das compras. Registre o pagamento da fatura para dar baixa em todas as parcelas."
        description="Faturas geradas automaticamente a partir das compras no cartão"
      />
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap gap-3">
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cartões</SelectItem>
              {cartoes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{nomeCartao(c.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="fechada">Fechada</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtradas.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma fatura encontrada. Lance uma compra no cartão para gerar automaticamente.
          </CardContent></Card>
        ) : filtradas.map((f) => {
          const cpId = cpByFatura[f.id];
          return (
            <Card key={f.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {nomeCartao(f.cartao_id)} · {f.competencia}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fechamento {fmtBR(f.dt_fechamento)} ·
                      Vence {fmtBR(f.dt_vencimento)} ·
                      Total R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    {(rateio[f.id]?.length ?? 0) > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {rateio[f.id]!.map((r) => (
                          `${r.obra}: R$ ${r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        )).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(f.status) as any}>{statusLabel(f.status)}</Badge>
                  {faturaVazia(f) && <Badge variant="outline">sem compras</Badge>}
                  {cpId && (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/app/contas-pagar"><Receipt className="mr-2 h-4 w-4" /> Ver conta</Link>
                    </Button>
                  )}
                  {faturaVazia(f) && (
                    <Button variant="ghost" size="sm" onClick={() => excluirFatura(f)} title="Excluir fatura vazia">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}

                  {f.status === "aberta" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm"><CheckCircle2 className="mr-2 h-4 w-4" /> Fechar</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Fechar fatura?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ao fechar, será criada uma conta a pagar com vencimento em{" "}
                            {fmtBR(f.dt_vencimento)}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => fechar(f)}>Fechar fatura</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {f.status !== "paga" && (
                    <Button size="sm" onClick={() => abrirPagamento(f)}>
                      <Wallet className="mr-2 h-4 w-4" /> Pagar fatura
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={pagando !== null} onOpenChange={(v) => !v && setPagando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar fatura</DialogTitle>
          </DialogHeader>
          {pagando && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{nomeCartao(pagando.cartao_id)} · {pagando.competencia}</p>
                <p className="text-xs text-muted-foreground">
                  Total R$ {Number(pagando.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Conta bancária *</Label>
                <Select value={payForm.conta_bancaria_id} onValueChange={(v) => setPayForm({ ...payForm, conta_bancaria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta que vai debitar" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}{c.banco ? ` — ${c.banco}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data do pagamento *</Label>
                <Input type="date" value={payForm.data} onChange={(e) => setPayForm({ ...payForm, data: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                O valor será debitado da conta escolhida. Se precisar reverter, use "Estornar" em Contas a pagar.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagando(null)}>Cancelar</Button>
            <Button onClick={pagarFatura} disabled={salvandoPag}>{salvandoPag ? "Pagando..." : "Confirmar pagamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
