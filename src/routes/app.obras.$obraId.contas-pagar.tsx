import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Receipt, CheckCircle2, Trash2, Undo2 } from "lucide-react";
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
import { hojeISO } from "@/lib/date-br";

export const Route = createFileRoute("/app/obras/$obraId/contas-pagar")({
  component: ContasPagarObra,
});

type CP = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  fornecedor_id: string | null;
  estornado?: boolean | null;
  origem?: string | null;
  fatura_cartao_id?: string | null;
};

type Fatura = {
  id: string;
  cartao_id: string;
  competencia: string;
  dt_vencimento: string;
  valor_total: number;
  status: string;
  valor_obra: number;
  parcela_ids: string[];
};

function ContasPagarObra() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const [items, setItems] = useState<CP[]>([]);
  const [fornec, setFornec] = useState<{ id: string; nome: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; nome: string }[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string; obra_id: string | null }[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [cartoes, setCartoes] = useState<{ id: string; nome: string; ultimos_4: string | null }[]>([]);
  const [payingFat, setPayingFat] = useState<Fatura | null>(null);
  const [salvandoFat, setSalvandoFat] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "pago">("pendente");
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<CP | null>(null);
  const [estornando, setEstornando] = useState<CP | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    vencimento: hojeISO(),
    categoria_id: "",
    fornecedor_id: "",
    observacoes: "",
  });
  const [pagto, setPagto] = useState({
    data: hojeISO(),
    conta_bancaria_id: "",
  });

  const carregar = async () => {
    const [{ data }, { data: f }, { data: c }, { data: cb }, { data: cts }] = await Promise.all([
      supabase
        .from("contas_pagar")
        .select("id,descricao,valor,vencimento,status,fornecedor_id,estornado,origem,fatura_cartao_id")
        .eq("obra_id", obraId)
        .order("vencimento"),
      supabase.from("fornecedores").select("id,nome").eq("ativo", true).order("nome"),
      supabase
        .from("categorias_financeiras")
        .select("id,nome")
        .eq("tipo", "despesa")
        .eq("ativo", true),
      supabase
        .from("contas_bancarias")
        .select("id,nome,obra_id")
        .eq("ativo", true)
        .or(`obra_id.eq.${obraId},obra_id.is.null`)
        .order("nome"),
      supabase.from("cartoes").select("id,nome,ultimos_4").eq("ativo", true).order("nome"),
    ]);
    setItems((data as CP[]) ?? []);
    setFornec((f as any) ?? []);
    setCats((c as any) ?? []);
    setContas((cb as any) ?? []);
    setCartoes((cts as any) ?? []);

    // Faturas de cartão com parcelas de compras desta obra (valor rateado por obra)
    const { data: compras } = await supabase.from("compras").select("id").eq("obra_id", obraId);
    const compraIds = (compras ?? []).map((x: any) => x.id);
    if (compraIds.length) {
      const { data: parc } = await supabase
        .from("compra_parcelas").select("id,valor,fatura_cartao_id").in("compra_id", compraIds);
      const porFatura = new Map<string, { valor: number; ids: string[] }>();
      for (const p of (parc ?? []) as any[]) {
        if (!p.fatura_cartao_id) continue;
        const acc = porFatura.get(p.fatura_cartao_id) ?? { valor: 0, ids: [] };
        acc.valor += Number(p.valor || 0);
        acc.ids.push(p.id);
        porFatura.set(p.fatura_cartao_id, acc);
      }
      const fatIds = Array.from(porFatura.keys());
      if (fatIds.length) {
        const { data: fats } = await supabase
          .from("faturas_cartao")
          .select("id,cartao_id,competencia,dt_vencimento,valor_total,status")
          .in("id", fatIds)
          .order("dt_vencimento");
        setFaturas(
          ((fats ?? []) as any[]).map((x) => ({
            ...x,
            valor_obra: porFatura.get(x.id)?.valor ?? 0,
            parcela_ids: porFatura.get(x.id)?.ids ?? [],
          })) as Fatura[],
        );
        return;
      }
    }
    setFaturas([]);
  };

  useEffect(() => {
    void carregar();
  }, [obraId]);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_user_id", user!.id)
      .maybeSingle();
    if (!customer) return toast.error("Conta não identificada");
    const { error } = await supabase.from("contas_pagar").insert({
      customer_id: customer.id,
      descricao: form.descricao,
      valor: Number(form.valor || 0),
      vencimento: form.vencimento,
      categoria_id: form.categoria_id || null,
      fornecedor_id: form.fornecedor_id || null,
      obra_id: obraId,
      observacoes: form.observacoes || null,
      status: "pendente",
      origem: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Conta criada");
    setOpen(false);
    setForm({
      descricao: "",
      valor: "",
      vencimento: hojeISO(),
      categoria_id: "",
      fornecedor_id: "",
      observacoes: "",
    });
    void carregar();
  };

  const pagar = async () => {
    if (!paying) return;
    if (!pagto.conta_bancaria_id) return toast.error("Selecione a conta bancária");
    const { error } = await supabase
      .from("contas_pagar")
      .update({
        status: "pago",
        pago_em: pagto.data,
        valor_pago: paying.valor,
        conta_bancaria_id: pagto.conta_bancaria_id,
      })
      .eq("id", paying.id);
    if (error) return toast.error(error.message);
    toast.success("Conta paga");
    setPaying(null);
    void carregar();
  };

  const nomeCartao = (id: string) => {
    const c = cartoes.find((x) => x.id === id);
    if (!c) return "Cartão";
    return c.ultimos_4 ? `${c.nome} •••• ${c.ultimos_4}` : c.nome;
  };

  // Conta a pagar da fatura referente a ESTA obra
  const cpDaFatura = (faturaId: string) =>
    items.find((i) => i.fatura_cartao_id === faturaId) ?? null;

  const statusFaturaObra = (f: Fatura) => {
    const cp = cpDaFatura(f.id);
    if (cp) return cp.status === "pago" ? "paga" : "pendente";
    return f.status === "paga" ? "paga" : "pendente";
  };

  const pagarFatura = async () => {
    if (!payingFat) return;
    if (!pagto.conta_bancaria_id) return toast.error("Selecione a conta bancária da obra");
    setSalvandoFat(true);
    try {
      const f = payingFat;
      if (f.status === "aberta") {
        const { error } = await supabase.from("faturas_cartao").update({ status: "fechada" }).eq("id", f.id);
        if (error) throw error;
      }
      let cp: { id: string } | null = null;
      for (let i = 0; i < 3 && !cp?.id; i++) {
        const { data } = await supabase
          .from("contas_pagar").select("id")
          .eq("fatura_cartao_id", f.id).eq("obra_id", obraId).maybeSingle();
        cp = (data as any) ?? null;
        if (!cp?.id) await new Promise((r) => setTimeout(r, 400));
      }
      if (!cp?.id) {
        // Fallback: cria a conta a pagar da fatura nesta obra (somente a parte da obra)
        const { data: cust } = await supabase
          .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
        const { data: nova, error: eNova } = await supabase.from("contas_pagar").insert({
          customer_id: cust!.id,
          fatura_cartao_id: f.id,
          obra_id: obraId,
          descricao: `Fatura ${nomeCartao(f.cartao_id)} - ${f.competencia}`,
          valor: f.valor_obra,
          vencimento: f.dt_vencimento,
          status: "pendente",
          origem: "fatura_cartao",
        }).select("id").single();
        if (eNova) throw eNova;
        cp = nova as any;
      }

      const { error: e1 } = await supabase.from("contas_pagar").update({
        status: "pago",
        pago_em: pagto.data,
        valor: f.valor_obra,
        valor_pago: f.valor_obra,
        conta_bancaria_id: pagto.conta_bancaria_id,
        obra_id: obraId,
      }).eq("id", cp!.id);
      if (e1) throw e1;

      // Somente as parcelas desta obra são quitadas
      if (f.parcela_ids.length) {
        await supabase.from("compra_parcelas").update({
          status: "pago",
          pago_em: new Date().toISOString(),
        }).in("id", f.parcela_ids);
      }

      // A fatura só fica paga quando todas as obras quitarem a sua parte
      const { count: pendentes } = await supabase
        .from("compra_parcelas")
        .select("id", { count: "exact", head: true })
        .eq("fatura_cartao_id", f.id)
        .neq("status", "pago");
      if (!pendentes) {
        await supabase.from("faturas_cartao").update({
          status: "paga",
          valor_pago: f.valor_total,
          pago_em: new Date().toISOString(),
        }).eq("id", f.id);
      }

      toast.success("Parte desta obra na fatura paga e debitada da conta da obra");
      setPayingFat(null);
      void carregar();
    } catch (err: any) {
      toast.error("Erro", { description: err?.message ?? String(err) });
    } finally {
      setSalvandoFat(false);
    }
  };

  const estornarFatura = async (f: Fatura) => {
    const motivo = window.prompt("Motivo do estorno da fatura:");
    if (!motivo || !motivo.trim()) return;
    try {
      const { data: cp } = await supabase
        .from("contas_pagar").select("id")
        .eq("fatura_cartao_id", f.id).eq("obra_id", obraId).maybeSingle();

      if (cp?.id) {
        const { data: lancs } = await supabase
          .from("lancamentos").select("*").eq("conta_pagar_id", cp.id).eq("estornado", false);
        let token: string | null = null;
        for (const l of lancs ?? []) {
          const result = await estornarLancamentoAtomico(l.id, motivo);
          token = result?.[0]?.estorno_token ?? null;
          if (!token) throw new Error("O banco não retornou o identificador do estorno");
        }
        if (!token) throw new Error("Nenhum pagamento disponível para estorno");
        const { error: e1 } = await supabase.from("contas_pagar").update({
          status: "pendente",
          pago_em: null,
          valor_pago: 0,
          conta_bancaria_id: null,
          estornado: true,
          estorno_token: token,
          estornado_em: new Date().toISOString(),
          estornado_por: user!.id,
          motivo_estorno: motivo.trim(),
        } as any).eq("id", cp.id);
        if (e1) throw e1;
      }

      const { error: e2 } = await supabase.from("faturas_cartao")
        .update({ status: "fechada", valor_pago: 0, pago_em: null }).eq("id", f.id);
      if (e2) throw e2;
      if (f.parcela_ids.length) {
        await supabase.from("compra_parcelas")
          .update({ status: "pendente", pago_em: null }).in("id", f.parcela_ids);
      }

      toast.success("Pagamento da fatura estornado — valor devolvido à conta");
      void carregar();
    } catch (err: any) {
      toast.error("Erro ao estornar fatura", { description: err?.message ?? String(err) });
    }
  };





  const estornarBaixa = async () => {
    if (!estornando) return;
    if (!motivoEstorno.trim()) return toast.error("Informe o motivo");
    const { data: lancs } = await supabase
      .from("lancamentos").select("id")
      .eq("conta_pagar_id", estornando.id).eq("estornado", false);
    if (!lancs?.length) return toast.error("Nenhum pagamento disponível para estorno");
    let token: string | null = null;
    for (const l of lancs) {
      const result = await estornarLancamentoAtomico(l.id, motivoEstorno);
      token = result?.[0]?.estorno_token ?? null;
      if (!token) return toast.error("O banco não retornou o identificador do estorno");
    }
    const { error } = await supabase.from("contas_pagar").update({
      status: "pendente",
      pago_em: null,
      valor_pago: 0,
      conta_bancaria_id: null,
      estornado: true,
      estorno_token: token,
      estornado_em: new Date().toISOString(),
      estornado_por: user!.id,
      motivo_estorno: motivoEstorno,
    } as any).eq("id", estornando.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Pagamento estornado — conta voltou a pendente");
    setEstornando(null); setMotivoEstorno(""); void carregar();
  };

  const excluir = async (cp: CP) => {
    if (cp.status !== "pendente") return toast.error("Só é possível excluir contas pendentes");
    if (!confirm(`Excluir a conta "${cp.descricao}"?`)) return;
    const { error } = await supabase.from("contas_pagar").delete().eq("id", cp.id);
    if (error) return toast.error(error.message);
    toast.success("Conta excluída"); void carregar();
  };

  const fmtBR = (ymd: string) => { const [y,m,d]=ymd.slice(0,10).split("-"); return `${d}/${m}/${y}`; };


  // Faturas de cartão que ainda têm parcelas desta obra aparecem no bloco próprio.
  // Contas ligadas a faturas que não existem mais (órfãs) voltam para a lista normal,
  // senão ficam invisíveis aqui mas contando no dashboard.
  const fatIdsBloco = new Set(faturas.map((f) => f.id));
  const semFatura = items.filter((i) => !i.fatura_cartao_id || !fatIdsBloco.has(i.fatura_cartao_id));
  const filtrados = semFatura.filter((i) => filtro === "todos" || i.status === filtro);

  // "Todos" mostra apenas faturas ainda em aberto; as pagas ficam no filtro "pago"
  const faturasVisiveis = faturas.filter((f) =>
    filtro === "pago" ? statusFaturaObra(f) === "paga" : statusFaturaObra(f) === "pendente",
  );
  const totalFaturasObra = faturasVisiveis.reduce((s, f) => s + Number(f.valor_obra || 0), 0);
  const total =
    filtrados.reduce((s, i) => s + Number(i.valor || 0), 0) + totalFaturasObra;
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fornName = (id: string | null) =>
    id ? fornec.find((f) => f.id === id)?.nome ?? "—" : "—";

  return (
    <div>
      <PageHeader
        title="Contas a pagar"
        info="Lista todas as parcelas geradas pelas compras da obra, além de contas cadastradas manualmente. Você pode marcar como paga, editar valores e vincular meio de pagamento (conta bancária ou cartão)."
        description="Contas a pagar vinculadas a esta obra"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova conta a pagar</DialogTitle>
              </DialogHeader>
              <form onSubmit={criar} className="space-y-3">
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input
                    required
                    value={form.descricao}
                    onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input
                      required
                      type="number"
                      step="0.01"
                      value={form.valor}
                      onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento *</Label>
                    <Input
                      required
                      type="date"
                      value={form.vencimento}
                      onChange={(e) => setForm((p) => ({ ...p, vencimento: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Select
                    value={form.fornecedor_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, fornecedor_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornec.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={form.categoria_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, categoria_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    rows={2}
                    value={form.observacoes}
                    onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(["pendente", "pago", "todos"] as const).map((f) => (
              <Button
                key={f}
                variant={filtro === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltro(f)}
              >
                {f === "todos" ? "Todos" : f === "pago" ? "Pagos" : "Pendentes"}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-semibold">{brl(total)}</span>
          </p>
        </div>

        {faturasVisiveis.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Faturas de cartão desta obra
              </p>
              {faturasVisiveis.map((f) => {
                const st = statusFaturaObra(f);
                return (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {nomeCartao(f.cartao_id)} · {f.competencia}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence {fmtBR(f.dt_vencimento)} · Parte desta obra:{" "}
                      <span className="font-semibold text-foreground">{brl(Number(f.valor_obra))}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Fatura total do cartão (todas as obras): {brl(Number(f.valor_total))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={st === "paga" ? "default" : f.status === "fechada" ? "secondary" : "outline"}>
                      {st === "paga" ? "Paga" : f.status === "fechada" ? "Fechada" : "Aberta"}
                    </Badge>
                    {st !== "paga" ? (
                      <Button size="sm" onClick={() => { setPayingFat(f); setPagto({ data: hojeISO(), conta_bancaria_id: "" }); }}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Pagar parte da obra
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" title="Estornar pagamento da fatura" onClick={() => void estornarFatura(f)}>
                        <Undo2 className="mr-2 h-4 w-4 text-destructive" /> Estornar
                      </Button>
                    )}

                  </div>
                </div>
                );
              })}
            </CardContent>
          </Card>
        )}


        {filtrados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-8 w-8 opacity-50" /> Nenhuma conta nesse filtro.
            </CardContent>
          </Card>
        ) : (
          filtrados.map((cp) => (
            <Card key={cp.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{cp.descricao}</p>
                    <Badge
                      variant={
                        cp.status === "pago"
                          ? "default"
                          : cp.status === "cancelado"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {cp.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fornName(cp.fornecedor_id)} • venc. {fmtBR(cp.vencimento)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{brl(Number(cp.valor))}</span>
                  {cp.status === "pendente" && (
                    <>
                      <Button size="sm" onClick={() => setPaying(cp)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Pagar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(cp)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  {cp.status === "pago" && (
                    <Button size="sm" variant="outline" onClick={() => setEstornando(cp)}>
                      <Undo2 className="mr-2 h-4 w-4" /> Estornar
                    </Button>
                  )}
                </div>


              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar baixa em {paying?.descricao}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Conta bancária da obra *</Label>
              <Select
                value={pagto.conta_bancaria_id}
                onValueChange={(v) => setPagto((p) => ({ ...p, conta_bancaria_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}{c.obra_id ? "" : " (global)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={pagto.data}
                onChange={(e) => setPagto((p) => ({ ...p, data: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={pagar}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingFat} onOpenChange={(o) => !o && setPayingFat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar fatura do cartão</DialogTitle>
          </DialogHeader>
          {payingFat && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{nomeCartao(payingFat.cartao_id)} · {payingFat.competencia}</p>
                <p className="text-xs text-muted-foreground">
                  Parte desta obra: <span className="font-semibold text-foreground">{brl(Number(payingFat.valor_obra))}</span>
                  {" "}· Fatura total {brl(Number(payingFat.valor_total))}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Conta bancária da obra *</Label>
                <Select
                  value={pagto.conta_bancaria_id}
                  onValueChange={(v) => setPagto((p) => ({ ...p, conta_bancaria_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}{c.obra_id ? "" : " (global)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data do pagamento</Label>
                <Input type="date" value={pagto.data}
                  onChange={(e) => setPagto((p) => ({ ...p, data: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={pagarFatura} disabled={salvandoFat}>
              {salvandoFat ? "Pagando..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={!!estornando} onOpenChange={(v) => { if (!v) { setEstornando(null); setMotivoEstorno(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A conta volta para <strong>pendente</strong>, o valor é devolvido à conta bancária e um
              lançamento de estorno fica registrado no caixa da obra.
            </p>
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea rows={2} value={motivoEstorno} onChange={(e) => setMotivoEstorno(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={estornarBaixa}>Confirmar estorno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
