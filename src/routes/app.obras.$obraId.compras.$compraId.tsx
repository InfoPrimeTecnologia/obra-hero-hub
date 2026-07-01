import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus, ArrowLeft, Trash2, Package, CheckCircle2, Ruler, Pencil, Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { CompraNotasFiscais } from "@/components/app/CompraNotasFiscais";
import { usePlanModules } from "@/lib/use-plan-modules";
import { checkOrcamentoAlert, brl as brlAlert, type OrcamentoAlertResult } from "@/lib/orcamento-alert";


export const Route = createFileRoute("/app/obras/$obraId/compras/$compraId")({
  component: CompraDetalhePage,
});

type Compra = {
  id: string;
  customer_id: string;
  obra_id: string;
  fornecedor_id: string | null;
  descricao: string | null;
  forma_pagamento: string;
  cartao_id: string | null;
  qtd_parcelas: number;
  valor_total: number;
  data_compra: string;
  data_primeira_parcela: string | null;
  status: string;
  observacoes: string | null;
  etapa_id: string | null;
  subetapa_id: string | null;
};
type Item = {
  id: string;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  qtd_recebida: number;
  qtd_medida: number;
  etapa_id: string | null;
  subetapa_id: string | null;
};
type Parcela = {
  id: string;
  numero: number;
  vencimento: string;
  valor: number;
  status: string;
  pago_em: string | null;
  fatura_cartao_id: string | null;
};
type Etapa = { id: string; nome: string };
type Subetapa = { id: string; etapa_id: string; nome: string };
type Recebimento = { id: string; data: string; recebido_por: string | null; observacoes: string | null };
type Medicao = { id: string; numero: number; data: string; valor_total: number; observacoes: string | null };

function CompraDetalhePage() {
  const { obraId, compraId } = Route.useParams();
  const { user } = useAuth();
  const [compra, setCompra] = useState<Compra | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [subetapas, setSubetapas] = useState<Subetapa[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);

  const [openItem, setOpenItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({
    descricao: "", unidade: "", quantidade: "1", valor_unitario: "0",
    etapa_id: "", subetapa_id: "",
  });

  const [novoSubOpen, setNovoSubOpen] = useState(false);
  const [novoSubNome, setNovoSubNome] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  const [alertOrc, setAlertOrc] = useState<OrcamentoAlertResult | null>(null);
  const [pendingItemPayload, setPendingItemPayload] = useState<{
    payload: {
      descricao: string; unidade: string | null;
      quantidade: number; valor_unitario: number; valor_total: number;
      etapa_id: string; subetapa_id: string;
    };
    isEdit: boolean;
    editingId?: string;
  } | null>(null);

  const [openReceb, setOpenReceb] = useState(false);
  const [recebForm, setRecebForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    recebido_por: "", observacoes: "",
    quantidades: {} as Record<string, string>,
  });

  const [openMed, setOpenMed] = useState(false);
  const [medForm, setMedForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    observacoes: "",
    quantidades: {} as Record<string, string>,
  });


  const carregar = async () => {
    const [{ data: c }, { data: is }, { data: ps }, { data: es }, { data: subs }, { data: rs }, { data: ms }] = await Promise.all([
      supabase.from("compras").select("*").eq("id", compraId).single(),
      supabase.from("compra_itens").select("*").eq("compra_id", compraId).order("created_at"),
      supabase.from("compra_parcelas").select("*").eq("compra_id", compraId).order("numero"),
      supabase.from("orcamento_etapas").select("id,nome").eq("obra_id", obraId).order("ordem"),
      supabase.from("orcamento_subetapas").select("id,etapa_id,nome").order("ordem"),
      supabase.from("recebimentos").select("*").eq("compra_id", compraId).order("data", { ascending: false }),
      supabase.from("medicoes").select("*").eq("compra_id", compraId).order("numero"),
    ]);
    setCompra(c as Compra | null);
    setItens((is ?? []) as Item[]);
    setParcelas((ps ?? []) as Parcela[]);
    setEtapas((es ?? []) as Etapa[]);
    setSubetapas((subs ?? []) as Subetapa[]);
    setRecebimentos((rs ?? []) as Recebimento[]);
    setMedicoes((ms ?? []) as Medicao[]);
  };

  useEffect(() => { void carregar(); }, [compraId]);

  const totalItens = useMemo(
    () => itens.reduce((s, i) => s + Number(i.valor_total), 0),
    [itens]
  );

  // ==== ITENS ====
  const resetItemForm = () => {
    setEditingItem(null);
    setItemForm({
      descricao: "", unidade: "", quantidade: "1", valor_unitario: "0",
      etapa_id: compra?.etapa_id ?? "",
      subetapa_id: compra?.subetapa_id ?? "",
    });
  };
  const abrirEdicaoItem = (i: Item) => {
    setEditingItem(i);
    setItemForm({
      descricao: i.descricao, unidade: i.unidade ?? "",
      quantidade: String(i.quantidade), valor_unitario: String(i.valor_unitario),
      etapa_id: i.etapa_id ?? compra?.etapa_id ?? "",
      subetapa_id: i.subetapa_id ?? compra?.subetapa_id ?? "",
    });
    setOpenItem(true);
  };
  const persistirItem = async (
    payload: Record<string, unknown>,
    isEdit: boolean,
    editingId?: string,
  ) => {
    if (!compra) return;
    if (isEdit && editingId) {
      const { error } = await supabase.from("compra_itens").update(payload).eq("id", editingId);
      if (error) return toast.error("Erro", { description: error.message });
    } else {
      const { error } = await supabase.from("compra_itens").insert({
        ...payload, compra_id: compraId, customer_id: compra.customer_id,
      });
      if (error) return toast.error("Erro", { description: error.message });
    }
    await recalcularTotalCompra();
    resetItemForm(); setOpenItem(false); toast.success("Item salvo"); void carregar();
  };

  const salvarItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!compra) return;
    if (!itemForm.etapa_id || !itemForm.subetapa_id) {
      return toast.error("Selecione a etapa e a subetapa do item");
    }
    const qtd = Number(itemForm.quantidade) || 0;
    const vu = Number(itemForm.valor_unitario) || 0;
    const valorItem = qtd * vu;
    const payload = {
      descricao: itemForm.descricao, unidade: itemForm.unidade || null,
      quantidade: qtd, valor_unitario: vu, valor_total: valorItem,
      etapa_id: itemForm.etapa_id,
      subetapa_id: itemForm.subetapa_id,
    };

    // Delta do lançamento: se editando, subtrai o valor antigo (se subetapa é a mesma)
    let delta = valorItem;
    if (editingItem) {
      const mesmaSub = editingItem.subetapa_id === itemForm.subetapa_id;
      if (mesmaSub) delta = valorItem - Number(editingItem.valor_total ?? 0);
    }
    if (delta > 0) {
      const check = await checkOrcamentoAlert(
        itemForm.subetapa_id,
        delta,
        compra.customer_id,
      );
      if (check.shouldWarn) {
        setAlertOrc(check);
        setPendingItemPayload({ payload, isEdit: !!editingItem, editingId: editingItem?.id });
        return;
      }
    }
    await persistirItem(payload, !!editingItem, editingItem?.id);
  };

  const criarSubetapaInline = async () => {
    if (!compra || !itemForm.etapa_id) return toast.error("Selecione uma etapa primeiro");
    if (!novoSubNome.trim()) return toast.error("Informe o nome da subetapa");
    setSavingSub(true);
    const ordem = subetapas.filter((s) => s.etapa_id === itemForm.etapa_id).length + 1;
    const { data, error } = await supabase.from("orcamento_subetapas").insert({
      customer_id: compra.customer_id, etapa_id: itemForm.etapa_id,
      nome: novoSubNome.trim(), ordem,
    }).select("id,etapa_id,nome").single();
    setSavingSub(false);
    if (error) return toast.error("Erro", { description: error.message });
    setSubetapas((prev) => [...prev, data as Subetapa]);
    setItemForm((f) => ({ ...f, subetapa_id: data!.id }));
    setNovoSubNome(""); setNovoSubOpen(false);
    toast.success("Subetapa criada");
  };

  const excluirItem = async (id: string) => {
    const { error } = await supabase.from("compra_itens").delete().eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    await recalcularTotalCompra();
    toast.success("Item removido"); void carregar();
  };

  const recalcularTotalCompra = async () => {
    const { data } = await supabase.from("compra_itens").select("valor_total").eq("compra_id", compraId);
    const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.valor_total), 0);
    await supabase.from("compras").update({ valor_total: total }).eq("id", compraId);
    // regenera parcelas
    if (compra) await regerarParcelas(total);
  };

  const regerarParcelas = async (total: number) => {
    if (!compra) return;
    await supabase.from("compra_parcelas").delete().eq("compra_id", compraId).eq("status", "pendente");
    const qtd = compra.qtd_parcelas;
    const start = compra.data_primeira_parcela ? new Date(compra.data_primeira_parcela) : new Date(compra.data_compra);
    const valor = Number((total / qtd).toFixed(2));
    const rows: any[] = [];
    for (let n = 1; n <= qtd; n++) {
      const v = new Date(start);
      v.setMonth(v.getMonth() + (n - 1));
      const valorFinal = n === qtd ? Number((total - valor * (qtd - 1)).toFixed(2)) : valor;
      rows.push({
        customer_id: compra.customer_id, compra_id: compraId, numero: n,
        vencimento: v.toISOString().slice(0, 10), valor: valorFinal, status: "pendente",
      });
    }
    if (rows.length) await supabase.from("compra_parcelas").insert(rows);
  };

  // ==== PARCELAS ====
  const togglePagamento = async (p: Parcela) => {
    const novo = p.status === "pago" ? "pendente" : "pago";
    const { error } = await supabase.from("compra_parcelas").update({
      status: novo, pago_em: novo === "pago" ? new Date().toISOString() : null,
    }).eq("id", p.id);
    if (error) return toast.error("Erro", { description: error.message });
    void carregar();
  };

  // ==== RECEBIMENTO ====
  const salvarRecebimento = async (e: FormEvent) => {
    e.preventDefault();
    if (!compra) return;
    const { data: rec, error } = await supabase.from("recebimentos").insert({
      customer_id: compra.customer_id, compra_id: compraId,
      data: recebForm.data, recebido_por: recebForm.recebido_por || null,
      observacoes: recebForm.observacoes || null, created_by: user!.id,
    }).select("id").single();
    if (error) return toast.error("Erro", { description: error.message });
    const linhas: any[] = [];
    for (const it of itens) {
      const q = Number(recebForm.quantidades[it.id] || 0);
      if (q > 0) {
        linhas.push({
          customer_id: compra.customer_id, recebimento_id: rec!.id,
          compra_item_id: it.id, quantidade: q,
        });
        await supabase.from("compra_itens").update({
          qtd_recebida: Number(it.qtd_recebida) + q,
        }).eq("id", it.id);
      }
    }
    if (linhas.length) await supabase.from("recebimento_itens").insert(linhas);
    // marca compra como recebida se tudo recebido
    const totalRec = itens.reduce((s, i) => s + Number(i.qtd_recebida) + Number(recebForm.quantidades[i.id] || 0), 0);
    const totalQtd = itens.reduce((s, i) => s + Number(i.quantidade), 0);
    if (totalQtd > 0 && totalRec >= totalQtd) {
      await supabase.from("compras").update({ status: "recebida" }).eq("id", compraId);
    }
    setOpenReceb(false);
    setRecebForm({ data: new Date().toISOString().slice(0, 10), recebido_por: "", observacoes: "", quantidades: {} });
    toast.success("Recebimento registrado"); void carregar();
  };

  // ==== MEDIÇÃO ====
  const salvarMedicao = async (e: FormEvent) => {
    e.preventDefault();
    if (!compra) return;
    let total = 0;
    const linhas: any[] = [];
    for (const it of itens) {
      const q = Number(medForm.quantidades[it.id] || 0);
      if (q > 0) {
        const v = q * Number(it.valor_unitario);
        total += v;
        linhas.push({
          customer_id: compra.customer_id, compra_item_id: it.id,
          quantidade: q, valor: v,
        });
      }
    }
    if (linhas.length === 0) return toast.error("Informe quantidade em ao menos um item");
    const numero = (medicoes[medicoes.length - 1]?.numero ?? 0) + 1;
    const { data: med, error } = await supabase.from("medicoes").insert({
      customer_id: compra.customer_id, compra_id: compraId,
      numero, data: medForm.data, valor_total: total,
      observacoes: medForm.observacoes || null, created_by: user!.id,
    }).select("id").single();
    if (error) return toast.error("Erro", { description: error.message });
    const itensPayload = linhas.map((l) => ({ ...l, medicao_id: med!.id }));
    await supabase.from("medicao_itens").insert(itensPayload);
    for (const l of linhas) {
      const it = itens.find((i) => i.id === l.compra_item_id)!;
      await supabase.from("compra_itens").update({
        qtd_medida: Number(it.qtd_medida) + Number(l.quantidade),
      }).eq("id", it.id);
    }
    setOpenMed(false);
    setMedForm({ data: new Date().toISOString().slice(0, 10), observacoes: "", quantidades: {} });
    toast.success(`Medição #${numero} registrada (R$ ${total.toFixed(2)})`); void carregar();
  };

  const desfazerMedicao = async (med: Medicao) => {
    if (!compra) return;
    if (!confirm(`Desfazer medição #${med.numero}? Os itens serão revertidos.`)) return;
    // buscar itens da medição
    const { data: linhas, error: e1 } = await supabase
      .from("medicao_itens").select("*").eq("medicao_id", med.id);
    if (e1) return toast.error("Erro", { description: e1.message });
    // reverter qtd_medida em cada compra_item
    for (const l of linhas ?? []) {
      const it = itens.find((i) => i.id === l.compra_item_id);
      if (!it) continue;
      const novaQtd = Math.max(0, Number(it.qtd_medida) - Number(l.quantidade));
      await supabase.from("compra_itens").update({ qtd_medida: novaQtd }).eq("id", it.id);
    }
    // deletar itens da medição e a medição
    await supabase.from("medicao_itens").delete().eq("medicao_id", med.id);
    const { error: e2 } = await supabase.from("medicoes").delete().eq("id", med.id);
    if (e2) return toast.error("Erro", { description: e2.message });
    toast.success(`Medição #${med.numero} desfeita`);
    void carregar();
  };

  if (!compra) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  const subsDoForm = subetapas.filter((s) => s.etapa_id === itemForm.etapa_id);

  return (
    <div>
      <PageHeader
        title={compra.descricao || "Compra"}
        description={(() => {
          const et = etapas.find((x) => x.id === compra.etapa_id);
          const sb = subetapas.find((x) => x.id === compra.subetapa_id);
          const base = `${new Date(compra.data_compra).toLocaleDateString("pt-BR")} · ${compra.qtd_parcelas}x · R$ ${Number(compra.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
          return et || sb ? `${base} · ${et?.nome ?? ""}${sb ? ` › ${sb.nome}` : ""}` : base;
        })()}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/obras/$obraId/compras" params={{ obraId }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {/* ITENS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Itens</CardTitle>
            <Dialog open={openItem} onOpenChange={(v) => { setOpenItem(v); if (!v) resetItemForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetItemForm}><Plus className="mr-2 h-4 w-4" /> Adicionar item</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingItem ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
                <form onSubmit={salvarItem} className="space-y-3">
                  <div className="space-y-2"><Label>Descrição *</Label>
                    <Input required value={itemForm.descricao} onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>Unidade</Label>
                      <Input value={itemForm.unidade} onChange={(e) => setItemForm({ ...itemForm, unidade: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Quantidade *</Label>
                      <Input type="number" step="0.01" required value={itemForm.quantidade} onChange={(e) => setItemForm({ ...itemForm, quantidade: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Valor unitário *</Label>
                      <Input type="number" step="0.01" required value={itemForm.valor_unitario} onChange={(e) => setItemForm({ ...itemForm, valor_unitario: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Etapa *</Label>
                      <Select value={itemForm.etapa_id} onValueChange={(v) => setItemForm({ ...itemForm, etapa_id: v, subetapa_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Subetapa *</Label>
                        <button type="button" className="text-xs text-primary hover:underline disabled:opacity-50"
                          disabled={!itemForm.etapa_id} onClick={() => setNovoSubOpen(true)}>+ nova</button>
                      </div>
                      <Select value={itemForm.subetapa_id} onValueChange={(v) => setItemForm({ ...itemForm, subetapa_id: v })} disabled={!itemForm.etapa_id}>
                        <SelectTrigger><SelectValue placeholder={itemForm.etapa_id ? "Selecione" : "Escolha a etapa"} /></SelectTrigger>
                        <SelectContent>{subsDoForm.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={novoSubOpen} onOpenChange={(v) => { setNovoSubOpen(v); if (!v) setNovoSubNome(""); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova subetapa</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input autoFocus value={novoSubNome} onChange={(e) => setNovoSubNome(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void criarSubetapaInline(); } }} />
                    <p className="text-xs text-muted-foreground">
                      Será criada dentro da etapa selecionada e ficará disponível no orçamento.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={criarSubetapaInline} disabled={savingSub}>{savingSub ? "Salvando..." : "Criar"}</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>

          </CardHeader>
          <CardContent className="space-y-2">
            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item.</p>
            ) : itens.map((i) => {
              const etapa = etapas.find((e) => e.id === i.etapa_id);
              return (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {i.descricao} <span className="text-muted-foreground">· {Number(i.quantidade)} {i.unidade ?? ""} × R$ {Number(i.valor_unitario).toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {etapa ? `${etapa.nome} · ` : ""}
                      Recebido: {Number(i.qtd_recebida)} / {Number(i.quantidade)} ·
                      Medido: {Number(i.qtd_medida)} / {Number(i.quantidade)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">R$ {Number(i.valor_total).toFixed(2)}</span>
                    <Button variant="ghost" size="sm" onClick={() => abrirEdicaoItem(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => excluirItem(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end pt-2 text-sm">
              <span className="font-semibold">Total: R$ {totalItens.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* PARCELAS */}
        <Card>
          <CardHeader><CardTitle className="text-base">Parcelas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {parcelas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Adicione itens para gerar as parcelas.</p>
            ) : parcelas.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Parcela {p.numero}/{compra.qtd_parcelas}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence {new Date(p.vencimento).toLocaleDateString("pt-BR")}
                    {p.pago_em && ` · Pago em ${new Date(p.pago_em).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const hoje = new Date().toISOString().slice(0, 10);
                    const atrasada = p.status !== "pago" && p.vencimento < hoje;
                    const label = p.status === "pago" ? "Paga" : atrasada ? "Atrasada" : "A pagar";
                    const variant = p.status === "pago" ? "default" : atrasada ? "destructive" : "secondary";
                    return <Badge variant={variant as "default" | "destructive" | "secondary"}>{label}</Badge>;
                  })()}
                  <span className="text-sm font-semibold">R$ {Number(p.valor).toFixed(2)}</span>
                  <Button variant="outline" size="sm" onClick={() => togglePagamento(p)}>
                    {p.status === "pago" ? "Estornar" : "Marcar pago"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RECEBIMENTOS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recebimentos</CardTitle>
            <Dialog open={openReceb} onOpenChange={setOpenReceb}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={itens.length === 0}><Package className="mr-2 h-4 w-4" /> Registrar recebimento</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader>
                <form onSubmit={salvarRecebimento} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Data *</Label>
                      <Input type="date" required value={recebForm.data} onChange={(e) => setRecebForm({ ...recebForm, data: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Recebido por</Label>
                      <Input value={recebForm.recebido_por} onChange={(e) => setRecebForm({ ...recebForm, recebido_por: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidades recebidas</Label>
                    {itens.map((it) => (
                      <div key={it.id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">{it.descricao} <span className="text-muted-foreground">(faltam {Number(it.quantidade) - Number(it.qtd_recebida)})</span></span>
                        <Input type="number" step="0.01" className="w-28" value={recebForm.quantidades[it.id] ?? ""}
                          onChange={(e) => setRecebForm({ ...recebForm, quantidades: { ...recebForm.quantidades, [it.id]: e.target.value } })} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2"><Label>Observações</Label>
                    <Textarea rows={2} value={recebForm.observacoes} onChange={(e) => setRecebForm({ ...recebForm, observacoes: e.target.value })} /></div>
                  <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {recebimentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum recebimento.</p>
            ) : recebimentos.map((r) => (
              <div key={r.id} className="rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {new Date(r.data).toLocaleDateString("pt-BR")}
                  {r.recebido_por && <span className="text-muted-foreground">· {r.recebido_por}</span>}
                </p>
                {r.observacoes && <p className="text-xs text-muted-foreground mt-1">{r.observacoes}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* MEDIÇÕES */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Medições</CardTitle>
            <Dialog open={openMed} onOpenChange={setOpenMed}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={itens.length === 0}><Ruler className="mr-2 h-4 w-4" /> Nova medição</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nova medição</DialogTitle></DialogHeader>
                <form onSubmit={salvarMedicao} className="space-y-3">
                  <div className="space-y-2"><Label>Data *</Label>
                    <Input type="date" required value={medForm.data} onChange={(e) => setMedForm({ ...medForm, data: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>Quantidade medida</Label>
                    {itens.map((it) => (
                      <div key={it.id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">{it.descricao} <span className="text-muted-foreground">(restam {Number(it.quantidade) - Number(it.qtd_medida)})</span></span>
                        <Input type="number" step="0.01" className="w-28" value={medForm.quantidades[it.id] ?? ""}
                          onChange={(e) => setMedForm({ ...medForm, quantidades: { ...medForm.quantidades, [it.id]: e.target.value } })} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2"><Label>Observações</Label>
                    <Textarea rows={2} value={medForm.observacoes} onChange={(e) => setMedForm({ ...medForm, observacoes: e.target.value })} /></div>
                  <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {medicoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma medição.</p>
            ) : medicoes.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Medição #{m.numero} · {new Date(m.data).toLocaleDateString("pt-BR")}</p>
                  {m.observacoes && <p className="text-xs text-muted-foreground">{m.observacoes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">R$ {Number(m.valor_total).toFixed(2)}</span>
                  <Button variant="ghost" size="sm" onClick={() => desfazerMedicao(m)} title="Desfazer medição">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* NOTAS FISCAIS */}
        <NotasFiscaisSection compraId={compraId} customerId={compra.customer_id} />
      </div>

    </div>
  );
}

function NotasFiscaisSection({ compraId, customerId }: { compraId: string; customerId: string }) {
  const { hasFeature } = usePlanModules();
  return <CompraNotasFiscais compraId={compraId} customerId={customerId} empresarial={hasFeature("nf_xml")} />;
}

