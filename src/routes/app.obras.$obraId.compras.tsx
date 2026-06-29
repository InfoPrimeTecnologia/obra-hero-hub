import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, ArrowLeft, ShoppingCart, Eye, UserPlus, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/compras")({
  component: ComprasPage,
});

type Compra = {
  id: string;
  numero: string | null;
  descricao: string | null;
  forma_pagamento: string;
  valor_total: number;
  data_compra: string;
  status: string;
  qtd_parcelas: number;
  fornecedor_id: string | null;
  cartao_id: string | null;
  etapa_id: string | null;
  subetapa_id: string | null;
};
type Item = {
  id: string;
  compra_id: string;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};
type Fornecedor = { id: string; nome: string };
type Cartao = { id: string; nome: string };
type Etapa = { id: string; nome: string; ordem: number };
type Subetapa = { id: string; etapa_id: string; nome: string; ordem: number };

const formaLabels: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", boleto: "Boleto",
  cartao: "Cartão", transferencia: "Transferência",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ComprasPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Compra[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [subetapas, setSubetapas] = useState<Subetapa[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novoFornOpen, setNovoFornOpen] = useState(false);
  const [savingForn, setSavingForn] = useState(false);
  const [novoForn, setNovoForn] = useState({ nome: "", cpf_cnpj: "", telefone: "", email: "" });
  const [expEtapa, setExpEtapa] = useState<Record<string, boolean>>({});
  const [expSub, setExpSub] = useState<Record<string, boolean>>({});
  const [expCompra, setExpCompra] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    fornecedor_id: "",
    descricao: "",
    forma_pagamento: "dinheiro",
    cartao_id: "",
    qtd_parcelas: "1",
    data_compra: new Date().toISOString().slice(0, 10),
    data_primeira_parcela: new Date().toISOString().slice(0, 10),
    etapa_id: "",
    subetapa_id: "",
  });

  const carregar = async () => {
    const [{ data: cs }, { data: fs }, { data: ks }, { data: es }, { data: ss }] = await Promise.all([
      supabase.from("compras").select("*").eq("obra_id", obraId).order("data_compra", { ascending: false }),
      supabase.from("fornecedores").select("id,nome").eq("ativo", true).order("nome"),
      supabase.from("cartoes").select("id,nome").eq("ativo", true).order("nome"),
      supabase.from("orcamento_etapas").select("id,nome,ordem").eq("obra_id", obraId).order("ordem"),
      supabase.from("orcamento_subetapas").select("id,etapa_id,nome,ordem").order("ordem"),
    ]);
    const compras = (cs ?? []) as Compra[];
    setItems(compras);
    setFornecedores((fs ?? []) as Fornecedor[]);
    setCartoes((ks ?? []) as Cartao[]);
    setEtapas((es ?? []) as Etapa[]);
    setSubetapas((ss ?? []) as Subetapa[]);
    // buscar itens das compras
    if (compras.length) {
      const ids = compras.map((c) => c.id);
      const { data: its } = await supabase
        .from("compra_itens")
        .select("id,compra_id,descricao,unidade,quantidade,valor_unitario,valor_total")
        .in("compra_id", ids);
      setItens((its ?? []) as Item[]);
    } else {
      setItens([]);
    }
  };

  useEffect(() => { void carregar(); }, [obraId]);

  const subsDoForm = subetapas.filter((s) => s.etapa_id === form.etapa_id);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.etapa_id || !form.subetapa_id) {
      return toast.error("Selecione a etapa e a subetapa do orçamento");
    }
    setSaving(true);
    const { data: customer } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    if (!customer) { setSaving(false); return toast.error("Conta não identificada"); }
    const { data, error } = await supabase.from("compras").insert({
      customer_id: customer.id,
      obra_id: obraId,
      fornecedor_id: form.fornecedor_id || null,
      descricao: form.descricao || null,
      forma_pagamento: form.forma_pagamento,
      cartao_id: form.forma_pagamento === "cartao" ? (form.cartao_id || null) : null,
      qtd_parcelas: Number(form.qtd_parcelas) || 1,
      data_compra: form.data_compra,
      data_primeira_parcela: form.data_primeira_parcela,
      etapa_id: form.etapa_id,
      subetapa_id: form.subetapa_id,
      created_by: user!.id,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Compra criada. Adicione itens.");
    setOpen(false);
    navigate({ to: "/app/obras/$obraId/compras/$compraId", params: { obraId, compraId: data!.id } });
  };

  const excluirCompra = async (c: Compra) => {
    // remove dependências e a compra
    const { error: e1 } = await supabase.from("compra_parcelas").delete().eq("compra_id", c.id);
    if (e1) return toast.error("Erro ao remover parcelas", { description: e1.message });
    // medições e seus itens
    const { data: meds } = await supabase.from("medicoes").select("id").eq("compra_id", c.id);
    if (meds?.length) {
      const mids = meds.map((m: any) => m.id);
      await supabase.from("medicao_itens").delete().in("medicao_id", mids);
      await supabase.from("medicoes").delete().in("id", mids);
    }
    // recebimentos e itens de recebimento
    const { data: recs } = await supabase.from("recebimentos").select("id").eq("compra_id", c.id);
    if (recs?.length) {
      const rids = recs.map((r: any) => r.id);
      await supabase.from("recebimento_itens").delete().in("recebimento_id", rids);
      await supabase.from("recebimentos").delete().in("id", rids);
    }
    await supabase.from("compra_itens").delete().eq("compra_id", c.id);
    await supabase.from("compra_notas_fiscais").delete().eq("compra_id", c.id);
    const { error } = await supabase.from("compras").delete().eq("id", c.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Compra excluída");
    void carregar();
  };

  const cadastrarFornecedor = async (e: FormEvent) => {
    e.preventDefault();
    if (!novoForn.nome.trim()) return toast.error("Informe o nome do fornecedor");
    setSavingForn(true);
    const { data: customer } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    if (!customer) { setSavingForn(false); return toast.error("Conta não identificada"); }
    const { data, error } = await supabase.from("fornecedores").insert({
      customer_id: customer.id,
      created_by: user!.id,
      nome: novoForn.nome.trim(),
      cpf_cnpj: novoForn.cpf_cnpj || null,
      telefone: novoForn.telefone || null,
      email: novoForn.email || null,
    }).select("id,nome").single();
    setSavingForn(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Fornecedor cadastrado");
    setFornecedores((prev) => [...prev, data as Fornecedor].sort((a, b) => a.nome.localeCompare(b.nome)));
    setForm((f) => ({ ...f, fornecedor_id: data!.id }));
    setNovoForn({ nome: "", cpf_cnpj: "", telefone: "", email: "" });
    setNovoFornOpen(false);
  };

  // ===== Árvore Etapa → Subetapa → Compra → Itens =====
  const tree = useMemo(() => {
    const semEtapa: Compra[] = [];
    const byEtapa = new Map<string, Compra[]>();
    for (const c of items) {
      if (!c.etapa_id) { semEtapa.push(c); continue; }
      const list = byEtapa.get(c.etapa_id) ?? [];
      list.push(c);
      byEtapa.set(c.etapa_id, list);
    }
    return { byEtapa, semEtapa };
  }, [items]);

  const totalGeral = items.reduce((s, c) => s + Number(c.valor_total), 0);
  const itensDaCompra = (cid: string) => itens.filter((i) => i.compra_id === cid);

  return (
    <div>
      <PageHeader
        title="Compras"
        description="Árvore: Etapa › Subetapa › Compra › Itens"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/obras"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Nova compra</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova compra</DialogTitle></DialogHeader>
                <form onSubmit={criar} className="space-y-3">
                  <div className="space-y-2"><Label>Fornecedor</Label>
                    <div className="flex gap-2">
                      <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder={fornecedores.length ? "Selecione (opcional)" : "Nenhum cadastrado"} /></SelectTrigger>
                        <SelectContent>{fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" onClick={() => setNovoFornOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Novo
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Descrição</Label>
                    <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Etapa do orçamento *</Label>
                      <Select value={form.etapa_id} onValueChange={(v) => setForm({ ...form, etapa_id: v, subetapa_id: "" })}>
                        <SelectTrigger><SelectValue placeholder={etapas.length ? "Selecione" : "Cadastre no orçamento"} /></SelectTrigger>
                        <SelectContent>{etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Subetapa *</Label>
                      <Select value={form.subetapa_id} onValueChange={(v) => setForm({ ...form, subetapa_id: v })} disabled={!form.etapa_id}>
                        <SelectTrigger><SelectValue placeholder={form.etapa_id ? (subsDoForm.length ? "Selecione" : "Sem subetapas") : "Escolha a etapa"} /></SelectTrigger>
                        <SelectContent>{subsDoForm.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Forma de pagamento *</Label>
                      <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(formaLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Parcelas *</Label>
                      <Input type="number" min={1} required value={form.qtd_parcelas}
                        onChange={(e) => setForm({ ...form, qtd_parcelas: e.target.value })} />
                    </div>
                  </div>
                  {form.forma_pagamento === "cartao" && (
                    <div className="space-y-2"><Label>Cartão *</Label>
                      <Select value={form.cartao_id} onValueChange={(v) => setForm({ ...form, cartao_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Data da compra *</Label>
                      <Input type="date" required value={form.data_compra}
                        onChange={(e) => setForm({ ...form, data_compra: e.target.value })} /></div>
                    <div className="space-y-2"><Label>1ª parcela *</Label>
                      <Input type="date" required value={form.data_primeira_parcela}
                        onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={novoFornOpen} onOpenChange={setNovoFornOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Cadastrar fornecedor</DialogTitle></DialogHeader>
                <form onSubmit={cadastrarFornecedor} className="space-y-3">
                  <div className="space-y-2"><Label>Nome *</Label>
                    <Input required value={novoForn.nome}
                      onChange={(e) => setNovoForn({ ...novoForn, nome: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>CPF/CNPJ</Label>
                      <Input value={novoForn.cpf_cnpj}
                        onChange={(e) => setNovoForn({ ...novoForn, cpf_cnpj: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Telefone</Label>
                      <Input value={novoForn.telefone}
                        onChange={(e) => setNovoForn({ ...novoForn, telefone: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2"><Label>E-mail</Label>
                    <Input type="email" value={novoForn.email}
                      onChange={(e) => setNovoForn({ ...novoForn, email: e.target.value })} /></div>
                  <DialogFooter>
                    <Button type="submit" disabled={savingForn}>{savingForn ? "Salvando..." : "Salvar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="space-y-3 p-8">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total geral (compras)</p>
              <p className="text-2xl font-bold tabular-nums">{brl(totalGeral)}</p>
            </div>
            <p className="text-xs text-muted-foreground">Árvore: Etapa → Subetapa → Compra → Itens</p>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma compra registrada.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {etapas.map((et) => {
              const compras = tree.byEtapa.get(et.id) ?? [];
              if (compras.length === 0) return null;
              const totalEt = compras.reduce((s, c) => s + Number(c.valor_total), 0);
              const isOpenEt = expEtapa[et.id] ?? true;
              const subsDessaEtapa = subetapas.filter((s) => s.etapa_id === et.id);
              return (
                <Card key={et.id}>
                  <CardContent className="p-0">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 p-4 hover:bg-accent/40"
                      onClick={() => setExpEtapa({ ...expEtapa, [et.id]: !isOpenEt })}
                    >
                      <div className="flex items-center gap-2">
                        {isOpenEt ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground">Etapa</p>
                          <p className="font-semibold">{et.nome}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-semibold tabular-nums">{brl(totalEt)}</p>
                      </div>
                    </button>

                    {isOpenEt && (
                      <div className="border-t">
                        {subsDessaEtapa.map((sb) => {
                          const cs = compras.filter((c) => c.subetapa_id === sb.id);
                          if (cs.length === 0) return null;
                          const totalSb = cs.reduce((s, c) => s + Number(c.valor_total), 0);
                          const isOpenSb = expSub[sb.id] ?? true;
                          return (
                            <div key={sb.id} className="border-b last:border-b-0">
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 bg-muted/30 px-4 py-3 pl-10 hover:bg-accent/40"
                                onClick={() => setExpSub({ ...expSub, [sb.id]: !isOpenSb })}
                              >
                                <div className="flex items-center gap-2">
                                  {isOpenSb ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  <div className="text-left">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Subetapa</p>
                                    <p className="text-sm font-medium">{sb.nome}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] text-muted-foreground">Total</p>
                                  <p className="text-sm font-semibold tabular-nums">{brl(totalSb)}</p>
                                </div>
                              </button>

                              {isOpenSb && (
                                <div className="divide-y">
                                  {cs.map((c) => {
                                    const f = fornecedores.find((x) => x.id === c.fornecedor_id);
                                    const isOpenC = expCompra[c.id] ?? false;
                                    const its = itensDaCompra(c.id);
                                    return (
                                      <div key={c.id} className="pl-16 pr-4 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <button
                                            type="button"
                                            className="flex flex-1 items-center gap-3 text-left"
                                            onClick={() => setExpCompra({ ...expCompra, [c.id]: !isOpenC })}
                                          >
                                            {isOpenC ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <ShoppingCart className="h-4 w-4 text-primary" />
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-medium">
                                                {c.descricao || "Compra"}
                                                {c.numero && <span className="ml-1 text-muted-foreground">#{c.numero}</span>}
                                              </p>
                                              <p className="truncate text-xs text-muted-foreground">
                                                {new Date(c.data_compra).toLocaleDateString("pt-BR")}
                                                {f ? ` · ${f.nome}` : ""} · {formaLabels[c.forma_pagamento]} · {c.qtd_parcelas}x
                                              </p>
                                            </div>
                                          </button>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold tabular-nums">{brl(Number(c.valor_total))}</span>
                                            <Badge variant={c.status === "recebida" ? "default" : "secondary"}>{c.status}</Badge>
                                            <Button asChild variant="outline" size="sm">
                                              <Link to="/app/obras/$obraId/compras/$compraId" params={{ obraId, compraId: c.id }}>
                                                <Eye className="mr-2 h-4 w-4" /> Abrir
                                              </Link>
                                            </Button>
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" title="Excluir compra">
                                                  <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    Esta ação remove a compra, seus itens, parcelas, recebimentos e medições. Não pode ser desfeita.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => void excluirCompra(c)}>Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        </div>
                                        {isOpenC && (
                                          <div className="mt-2 ml-7 rounded-md border bg-muted/20 p-2">
                                            {its.length === 0 ? (
                                              <p className="text-xs text-muted-foreground">Sem itens nesta compra.</p>
                                            ) : (
                                              <div className="space-y-1">
                                                {its.map((it) => (
                                                  <div key={it.id} className="flex items-center justify-between text-xs">
                                                    <span className="truncate">
                                                      {it.descricao}
                                                      <span className="ml-2 text-muted-foreground">
                                                        {Number(it.quantidade)} {it.unidade ?? ""} × {brl(Number(it.valor_unitario))}
                                                      </span>
                                                    </span>
                                                    <span className="font-medium tabular-nums">{brl(Number(it.valor_total))}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {tree.semEtapa.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="mb-2 text-sm font-semibold text-muted-foreground">Sem etapa vinculada</p>
                  <div className="space-y-1">
                    {tree.semEtapa.map((c) => {
                      const f = fornecedores.find((x) => x.id === c.fornecedor_id);
                      return (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">
                            {c.descricao || "Compra"}{f ? ` · ${f.nome}` : ""}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium tabular-nums">{brl(Number(c.valor_total))}</span>
                            <Button asChild variant="outline" size="sm">
                              <Link to="/app/obras/$obraId/compras/$compraId" params={{ obraId, compraId: c.id }}>
                                <Eye className="mr-2 h-4 w-4" /> Abrir
                              </Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Excluir compra">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação remove a compra, seus itens, parcelas, recebimentos e medições. Não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void excluirCompra(c)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
