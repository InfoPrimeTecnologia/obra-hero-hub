import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Wallet } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/faturas")({
  component: FaturasObraPage,
});

type Fatura = {
  id: string;
  cartao_id: string;
  status: string;
  valor_total: number;
  dt_vencimento: string | null;
  competencia: string | null;
};
type Cartao = { id: string; nome: string };
type ContaBancaria = { id: string; nome: string; banco: string | null; obra_id: string | null };

function fmtBR(ymd: string | null | undefined) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function hojeYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function FaturasObraPage() {
  const { obraId } = Route.useParams();
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [pagando, setPagando] = useState<Fatura | null>(null);
  const [payForm, setPayForm] = useState({ conta_bancaria_id: "", data: hojeYMD() });
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const { data: comp } = await supabase
      .from("compras")
      .select("cartao_id")
      .eq("obra_id", obraId)
      .not("cartao_id", "is", null);
    const cartaoIds = Array.from(new Set((comp ?? []).map((c: any) => c.cartao_id))).filter(Boolean);

    // Contas bancárias da própria obra (+ globais, sem obra vinculada)
    const { data: cbs } = await supabase
      .from("contas_bancarias")
      .select("id,nome,banco,obra_id")
      .eq("ativo", true)
      .or(`obra_id.eq.${obraId},obra_id.is.null`)
      .order("nome");
    setContas((cbs as ContaBancaria[]) ?? []);

    if (cartaoIds.length === 0) {
      setFaturas([]);
      setCartoes([]);
      return;
    }
    const [{ data: f }, { data: c }] = await Promise.all([
      supabase
        .from("faturas_cartao")
        .select("id,cartao_id,status,valor_total,dt_vencimento,competencia")
        .in("cartao_id", cartaoIds)
        .order("dt_vencimento", { ascending: false }),
      supabase.from("cartoes").select("id,nome").in("id", cartaoIds),
    ]);
    setFaturas((f as Fatura[]) ?? []);
    setCartoes((c as Cartao[]) ?? []);
  };

  useEffect(() => { void carregar(); }, [obraId]);

  const abrirPagamento = (f: Fatura) => {
    setPagando(f);
    setPayForm({ conta_bancaria_id: "", data: hojeYMD() });
  };

  const pagarFatura = async () => {
    if (!pagando) return;
    if (!payForm.conta_bancaria_id) return toast.error("Escolha a conta bancária da obra");
    setSalvando(true);
    try {
      const f = pagando;
      if (f.status === "aberta") {
        const { error } = await supabase.from("faturas_cartao").update({ status: "fechada" }).eq("id", f.id);
        if (error) throw error;
      }
      const { data: cp } = await supabase
        .from("contas_pagar").select("id").eq("fatura_cartao_id", f.id).maybeSingle();
      if (!cp?.id) throw new Error("Conta a pagar da fatura não encontrada");

      const { error: e1 } = await supabase.from("contas_pagar").update({
        status: "pago",
        pago_em: payForm.data,
        valor_pago: f.valor_total,
        conta_bancaria_id: payForm.conta_bancaria_id,
        obra_id: obraId,
      }).eq("id", cp.id);
      if (e1) throw e1;

      await supabase.from("faturas_cartao").update({
        status: "paga",
        valor_pago: f.valor_total,
        pago_em: new Date().toISOString(),
      }).eq("id", f.id);
      await supabase.from("compra_parcelas").update({
        status: "pago",
        pago_em: new Date().toISOString(),
      }).eq("fatura_cartao_id", f.id);

      toast.success("Fatura paga — debitada na conta da obra");
      setPagando(null);
      void carregar();
    } catch (err: any) {
      toast.error("Erro", { description: err?.message ?? String(err) });
    } finally {
      setSalvando(false);
    }
  };

  const cartaoNome = (id: string) => cartoes.find((c) => c.id === id)?.nome ?? "—";
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title="Faturas de cartão"
        info="Faturas dos cartões usados nesta obra. Pague a fatura aqui mesmo, escolhendo a conta bancária da obra que será debitada."
        description="Faturas dos cartões usados em compras desta obra"
        actions={
          <Button asChild variant="outline">
            <Link to="/app/faturas-cartao">
              <ExternalLink className="mr-2 h-4 w-4" /> Ver todas
            </Link>
          </Button>
        }
      />
      <div className="space-y-3 p-8">
        {faturas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Esta obra ainda não tem compras feitas em cartão.
            </CardContent>
          </Card>
        ) : (
          faturas.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{cartaoNome(f.cartao_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.competencia ?? "—"}
                    {f.dt_vencimento ? ` • venc. ${fmtBR(f.dt_vencimento)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={f.status === "paga" ? "default" : "outline"}>{f.status}</Badge>
                  <span className="font-semibold tabular-nums">{brl(Number(f.valor_total))}</span>
                  {f.status !== "paga" && (
                    <Button size="sm" onClick={() => abrirPagamento(f)}>
                      <Wallet className="mr-2 h-4 w-4" /> Pagar fatura
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={pagando !== null} onOpenChange={(v) => !v && setPagando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagar fatura</DialogTitle></DialogHeader>
          {pagando && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{cartaoNome(pagando.cartao_id)} · {pagando.competencia ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Total {brl(Number(pagando.valor_total))}</p>
              </div>
              <div className="space-y-2">
                <Label>Conta bancária da obra *</Label>
                <Select value={payForm.conta_bancaria_id} onValueChange={(v) => setPayForm({ ...payForm, conta_bancaria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta que vai debitar" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}{c.banco ? ` — ${c.banco}` : ""}{c.obra_id ? "" : " (global)"}
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
                O valor será debitado da conta escolhida e aparecerá no caixa desta obra.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagando(null)}>Cancelar</Button>
            <Button onClick={pagarFatura} disabled={salvando}>{salvando ? "Pagando..." : "Confirmar pagamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
