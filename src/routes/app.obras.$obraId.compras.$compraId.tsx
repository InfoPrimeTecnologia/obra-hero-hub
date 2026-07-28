import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus, ArrowLeft, Trash2, Pencil, Receipt, AlertTriangle,
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
  forma_pagamento: string | null;
  cartao_id: string | null;
  qtd_parcelas: number | null;
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
  etapa_id: string | null;
  subetapa_id: string | null;
};
type Etapa = { id: string; nome: string };
type Subetapa = { id: string; etapa_id: string; nome: string };
type Cartao = { id: string; nome: string; ultimos_4: string | null; dia_fechamento: number; dia_vencimento: number };
type ContaPagarLite = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  fatura_cartao_id: string | null;
};

const brl = (n: number) => `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

/** Formata "YYYY-MM-DD" como dd/mm/yyyy sem passar por Date (evita bug de timezone). */
function fmtBR(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
/** Data de hoje em "YYYY-MM-DD" no fuso local. */
function hojeYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


/** Calcula vencimentos de fatura de cartão para N parcelas a partir da data da compra. */
function calcularVencimentosCartao(dataCompra: string, dias: { fechamento: number; vencimento: number }, n: number): string[] {
  const [ay, am, ad] = dataCompra.split("-").map(Number);
  const base = new Date(ay, am - 1, ad);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const ref = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
    let y = ref.getFullYear();
    let m = ref.getMonth() + 1;
    if (ref.getDate() > dias.fechamento) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    // vencimento
    let vy = y, vm = m;
    if (dias.vencimento <= dias.fechamento) {
      vm += 1;
      if (vm > 12) { vm = 1; vy += 1; }
    }
    const lastDay = new Date(vy, vm, 0).getDate();
    const day = Math.min(dias.vencimento, lastDay);
    out.push(`${vy}-${String(vm).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

function calcularVencimentosIntervalo(dataPrimeira: string, intervaloDias: number, n: number): string[] {
  const [y, m, d] = dataPrimeira.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(base);
    if (intervaloDias === 30) {
      dt.setMonth(base.getMonth() + i);
    } else {
      dt.setDate(base.getDate() + i * intervaloDias);
    }
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
  }
  return out;
}


function CompraDetalhePage() {
  const { obraId, compraId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [compra, setCompra] = useState<Compra | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [subetapas, setSubetapas] = useState<Subetapa[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagarLite[]>([]);
  const [parcelasCartao, setParcelasCartao] = useState<number>(0);
  const [excluindoCompra, setExcluindoCompra] = useState(false);

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

  const [openGerar, setOpenGerar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [aVista, setAVista] = useState(false);
  const [gerarForm, setGerarForm] = useState({
    data_emissao: hojeYMD(),
    data_primeira_parcela: hojeYMD(),
    forma_pagamento: "boleto",
    cartao_id: "",
    qtd_parcelas: "1",
    intervalo_dias: "30",
    observacoes: "",
    quantidades: {} as Record<string, string>,
  });


  const carregar = async () => {
    const [{ data: c }, { data: is }, { data: es }, { data: subs }, { data: cts }, { data: cps }, { data: parc }] = await Promise.all([
      supabase.from("compras").select("*").eq("id", compraId).single(),
      supabase.from("compra_itens").select("*").eq("compra_id", compraId).order("created_at"),
      supabase.from("orcamento_etapas").select("id,nome").eq("obra_id", obraId).order("ordem"),
      supabase.from("orcamento_subetapas").select("id,etapa_id,nome").order("ordem"),
      supabase.from("cartoes").select("id,nome,ultimos_4,dia_fechamento,dia_vencimento").eq("ativo", true).order("nome"),
      supabase.from("contas_pagar").select("id,descricao,valor,vencimento,status,fatura_cartao_id").eq("compra_id", compraId).order("vencimento"),
      supabase.from("compra_parcelas").select("id,status").eq("compra_id", compraId),
    ]);
    setCompra(c as Compra | null);
    setItens((is ?? []) as Item[]);
    setEtapas((es ?? []) as Etapa[]);
    setSubetapas((subs ?? []) as Subetapa[]);
    setCartoes((cts ?? []) as Cartao[]);
    setContasPagar((cps ?? []) as ContaPagarLite[]);
    setParcelasCartao((parc ?? []).length);

    // Sincroniza status da compra: considera contas_pagar (não-cartão) e compra_parcelas (cartão)
    if (c) {
      const list = (cps ?? []) as ContaPagarLite[];
      const parcList = (parc ?? []) as { status: string }[];
      let novo = "pendente";
      if (list.length > 0) {
        const pagas = list.filter((p) => p.status === "pago").length;
        if (pagas === list.length) novo = "paga";
        else if (pagas > 0) novo = "parcial";
        else novo = "faturada";
      } else if (parcList.length > 0) {
        const pagas = parcList.filter((p) => p.status === "pago").length;
        if (pagas === parcList.length) novo = "paga";
        else if (pagas > 0) novo = "parcial";
        else novo = "faturada";
      }
      if ((c as Compra).status !== novo) {
        await supabase.from("compras").update({ status: novo }).eq("id", compraId);
      }
    }
  };
  useEffect(() => { void carregar(); }, [compraId]);


  const totalItens = useMemo(
    () => itens.reduce((s, i) => s + Number(i.valor_total), 0),
    [itens]
  );

  const jaFaturada = contasPagar.length > 0 || parcelasCartao > 0;

  const excluirCompra = async () => {
    if (jaFaturada) return toast.error("Exclua as contas a pagar antes");
    if (!confirm("Excluir esta compra e todos os seus itens? Esta ação não pode ser desfeita.")) return;
    setExcluindoCompra(true);
    // Cascata manual (sem FK ON DELETE definida no schema)
    await supabase.from("compra_notas_fiscais").delete().eq("compra_id", compraId);
    await supabase.from("compra_itens").delete().eq("compra_id", compraId);
    const { error } = await supabase.from("compras").delete().eq("id", compraId);
    setExcluindoCompra(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Compra excluída");
    navigate({ to: "/app/obras/$obraId/compras", params: { obraId } });
  };


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
  type ItemPayload = {
    descricao: string; unidade: string | null;
    quantidade: number; valor_unitario: number; valor_total: number;
    etapa_id: string; subetapa_id: string;
  };
  const persistirItem = async (
    payload: ItemPayload,
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

    let delta = valorItem;
    if (editingItem) {
      const mesmaSub = editingItem.subetapa_id === itemForm.subetapa_id;
      if (mesmaSub) delta = valorItem - Number(editingItem.valor_total ?? 0);
    }
    if (delta > 0) {
      const check = await checkOrcamentoAlert(itemForm.subetapa_id, delta, compra.customer_id);
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
  };

  // ==== GERAR CONTAS A PAGAR ====
  const preview = useMemo(() => {
    if (!compra) return { total: 0, parcelas: [] as { n: number; venc: string; valor: number }[] };
    let total = 0;
    for (const it of itens) {
      const q = Number(gerarForm.quantidades[it.id] || 0);
      if (q > 0) total += q * Number(it.valor_unitario);
    }
    const n = Math.max(1, parseInt(gerarForm.qtd_parcelas || "1", 10));
    let vencs: string[] = [];
    if (gerarForm.forma_pagamento === "cartao" && gerarForm.cartao_id) {
      const cart = cartoes.find((c) => c.id === gerarForm.cartao_id);
      if (cart) vencs = calcularVencimentosCartao(compra.data_compra, { fechamento: cart.dia_fechamento, vencimento: cart.dia_vencimento }, n);
    } else {
      const dias = Math.max(1, parseInt(gerarForm.intervalo_dias || "30", 10));
      vencs = calcularVencimentosIntervalo(gerarForm.data_primeira_parcela, dias, n);
    }
    const vp = Math.round((total / n) * 100) / 100;
    const parcelas = vencs.map((v, i) => ({
      n: i + 1,
      venc: v,
      valor: i === n - 1 ? Number((total - vp * (n - 1)).toFixed(2)) : vp,
    }));
    return { total, parcelas };
  }, [gerarForm, itens, compra, cartoes]);

  const gerarContasPagar = async (e: FormEvent) => {
    e.preventDefault();
    if (!compra) return;
    if (preview.total <= 0) return toast.error("Informe quantidade em ao menos um item");
    if (gerarForm.forma_pagamento === "cartao" && !gerarForm.cartao_id) {
      return toast.error("Selecione o cartão");
    }
    setGerando(true);

    const nParc = preview.parcelas.length;
    const isCartao = gerarForm.forma_pagamento === "cartao";

    // Atualiza compra com dados financeiros (uso pelo trigger de cartão)
    await supabase.from("compras").update({
      forma_pagamento: gerarForm.forma_pagamento,
      cartao_id: isCartao ? gerarForm.cartao_id : null,
      qtd_parcelas: nParc,
      data_primeira_parcela: isCartao ? null : gerarForm.data_primeira_parcela,
    }).eq("id", compraId);

    if (isCartao) {
      // Insere em compra_parcelas → trigger cria fatura e (ao fechar) conta a pagar.
      // Trigger recalcula vencimento pela regra do cartão.
      const rows = preview.parcelas.map((p) => ({
        customer_id: compra.customer_id,
        compra_id: compraId,
        numero: p.n,
        vencimento: p.venc,
        valor: p.valor,
        status: "pendente",
      }));
      const { error } = await supabase.from("compra_parcelas").insert(rows);
      if (error) { setGerando(false); return toast.error("Erro", { description: error.message }); }
      toast.success(`${nParc} parcela(s) lançada(s) na fatura do cartão`);
    } else {
      // Insere direto em contas_pagar
      const rows = preview.parcelas.map((p) => ({
        customer_id: compra.customer_id,
        obra_id: compra.obra_id,
        fornecedor_id: compra.fornecedor_id,
        compra_id: compraId,
        descricao: `${compra.descricao || "Compra"} - Parcela ${p.n}/${nParc}`,
        valor: p.valor,
        vencimento: p.venc,
        status: "pendente",
        origem: "compra",
        observacoes: `Emissão ${gerarForm.data_emissao} · ${gerarForm.forma_pagamento}${gerarForm.observacoes ? ` · ${gerarForm.observacoes}` : ""}`,
        created_by: user!.id,
      }));
      const { error } = await supabase.from("contas_pagar").insert(rows);
      if (error) { setGerando(false); return toast.error("Erro", { description: error.message }); }
      toast.success(`${nParc} conta(s) a pagar gerada(s) — ${brl(preview.total)}`);
    }

    setGerando(false);
    setOpenGerar(false);
    setGerarForm({
      data_emissao: new Date().toISOString().slice(0, 10),
      data_primeira_parcela: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      forma_pagamento: "boleto",
      cartao_id: "",
      qtd_parcelas: "1",
      intervalo_dias: "30",
      observacoes: "",
      quantidades: {},
    });
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
          const parcInfo = compra.qtd_parcelas && compra.qtd_parcelas > 0 ? ` · ${compra.qtd_parcelas}x` : "";
          const base = `${new Date(compra.data_compra).toLocaleDateString("pt-BR")}${parcInfo} · ${brl(Number(compra.valor_total))}`;
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
            <Button size="sm" onClick={() => { if (openItem) { setOpenItem(false); resetItemForm(); } else { resetItemForm(); setOpenItem(true); } }}>
              <Plus className="mr-2 h-4 w-4" /> {openItem ? "Fechar" : "Adicionar item"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {openItem && (
              <form onSubmit={salvarItem} className="space-y-3 rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {editingItem ? "Editar item" : "Novo item"}
                </p>
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
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setOpenItem(false); resetItemForm(); }}>Cancelar</Button>
                  <Button type="submit" size="sm">Salvar</Button>
                </div>
              </form>
            )}
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

            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item.</p>
            ) : itens.map((i) => {
              const etapa = etapas.find((e) => e.id === i.etapa_id);
              const sub = subetapas.find((s) => s.id === i.subetapa_id);
              return (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {i.descricao} <span className="text-muted-foreground">· {Number(i.quantidade)} {i.unidade ?? ""} × R$ {Number(i.valor_unitario).toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {etapa ? etapa.nome : ""}{sub ? ` › ${sub.nome}` : ""}
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

        {/* CONTAS A PAGAR */}
        <Card className={jaFaturada ? "" : "border-destructive/60 bg-destructive/5"}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                {!jaFaturada && <AlertTriangle className="h-4 w-4 text-destructive" />}
                Contas a pagar geradas
              </CardTitle>
              {!jaFaturada && (
                <p className="text-xs font-medium text-destructive">
                  Compra ainda não faturada — gere as contas a pagar.
                </p>
              )}
            </div>
            <Dialog open={openGerar} onOpenChange={setOpenGerar}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={itens.length === 0 || jaFaturada}
                  title={jaFaturada ? "Contas a pagar já geradas — exclua-as primeiro para refazer" : undefined}>
                  <Receipt className="mr-2 h-4 w-4" />
                  {jaFaturada ? "Contas a pagar já geradas" : "Gerar contas a pagar"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Gerar contas a pagar</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Informe a quantidade a medir de cada item e os dados financeiros.
                  </p>
                </DialogHeader>
                <form onSubmit={gerarContasPagar} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Quantidade a medir por item</Label>
                    {itens.map((it) => (
                      <div key={it.id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">
                          {it.descricao}{" "}
                          <span className="text-muted-foreground">
                            (até {Number(it.quantidade)} {it.unidade ?? ""})
                          </span>
                        </span>
                        <Input
                          type="number" step="0.01" className="w-28"
                          value={gerarForm.quantidades[it.id] ?? ""}
                          onChange={(e) => setGerarForm({ ...gerarForm, quantidades: { ...gerarForm.quantidades, [it.id]: e.target.value } })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados financeiros</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Data de emissão *</Label>
                        <Input type="date" required value={gerarForm.data_emissao}
                          onChange={(e) => setGerarForm({ ...gerarForm, data_emissao: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Meio de pagamento *</Label>
                        <Select value={gerarForm.forma_pagamento} onValueChange={(v) => setGerarForm({ ...gerarForm, forma_pagamento: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boleto">Boleto</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="transferencia">Transferência</SelectItem>
                            <SelectItem value="cartao">Cartão de crédito</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {gerarForm.forma_pagamento === "cartao" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Cartão *</Label>
                          <Select value={gerarForm.cartao_id} onValueChange={(v) => setGerarForm({ ...gerarForm, cartao_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {cartoes.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.ultimos_4 ? `${c.nome} •••• ${c.ultimos_4}` : c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">
                            Vencimentos calculados pela regra do cartão (fechamento/vencimento).
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Nº de parcelas *</Label>
                          <Input type="number" min={1} required value={gerarForm.qtd_parcelas}
                            onChange={(e) => setGerarForm({ ...gerarForm, qtd_parcelas: e.target.value })} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>1ª parcela vence *</Label>
                          <Input type="date" required value={gerarForm.data_primeira_parcela}
                            onChange={(e) => setGerarForm({ ...gerarForm, data_primeira_parcela: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº de parcelas *</Label>
                          <Input type="number" min={1} required value={gerarForm.qtd_parcelas}
                            onChange={(e) => setGerarForm({ ...gerarForm, qtd_parcelas: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Intervalo (dias) *</Label>
                          <Input type="number" min={1} required value={gerarForm.intervalo_dias}
                            onChange={(e) => setGerarForm({ ...gerarForm, intervalo_dias: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>

                  {preview.total > 0 && (
                    <div className="rounded-md border p-3 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Preview · Total {brl(preview.total)}
                      </p>
                      {preview.parcelas.map((p) => (
                        <div key={p.n} className="flex justify-between text-xs">
                          <span>Parcela {p.n}/{preview.parcelas.length} — vence {new Date(p.venc).toLocaleDateString("pt-BR")}</span>
                          <span className="tabular-nums font-medium">{brl(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea rows={2} value={gerarForm.observacoes}
                      onChange={(e) => setGerarForm({ ...gerarForm, observacoes: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={gerando}>{gerando ? "Gerando..." : "Gerar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {contasPagar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta a pagar gerada.</p>
            ) : contasPagar.map((cp) => (
              <div key={cp.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{cp.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence {new Date(cp.vencimento).toLocaleDateString("pt-BR")}
                    {cp.fatura_cartao_id ? " · via fatura do cartão" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={cp.status === "pago" ? "default" : "secondary"}>
                    {cp.status === "pago" ? "Paga" : "A pagar"}
                  </Badge>
                  <span className="text-sm font-semibold">{brl(Number(cp.valor))}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* NOTAS FISCAIS */}
        <NotasFiscaisSection compraId={compraId} customerId={compra.customer_id} />
      </div>

      {/* Alerta de estouro de orçamento */}
      <AlertDialog open={!!alertOrc} onOpenChange={(o) => { if (!o) { setAlertOrc(null); setPendingItemPayload(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertOrc?.ultrapassa ? "Orçamento estourado" : "Orçamento próximo do limite"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Este lançamento vai colocar a subetapa <strong>{alertOrc?.subetapaNome}</strong>{" "}
                  em <strong>{alertOrc?.pctFuturo.toFixed(1)}%</strong> do orçamento
                  (limite de alerta: {alertOrc?.threshold}%).
                </p>
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <div>Orçado: <strong>{brlAlert(alertOrc?.orcado ?? 0)}</strong></div>
                  <div>Gasto atual: {brlAlert(alertOrc?.gastoAtual ?? 0)} ({alertOrc?.pctAtual.toFixed(1)}%)</div>
                  <div>Após este lançamento: <strong>{brlAlert(alertOrc?.novoGasto ?? 0)}</strong></div>
                </div>
                <p className="text-muted-foreground">Deseja continuar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingItemPayload) {
                  await persistirItem(
                    pendingItemPayload.payload,
                    pendingItemPayload.isEdit,
                    pendingItemPayload.editingId,
                  );
                }
                setAlertOrc(null); setPendingItemPayload(null);
              }}
            >
              Confirmar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NotasFiscaisSection({ compraId, customerId }: { compraId: string; customerId: string }) {
  const { hasFeature } = usePlanModules();
  return <CompraNotasFiscais compraId={compraId} customerId={customerId} empresarial={hasFeature("nf_xml")} />;
}
