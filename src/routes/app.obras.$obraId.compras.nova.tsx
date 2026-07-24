import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { UserPlus, FolderPlus, FileUp, Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { parseNotaFiscal, type NfParsed, type NfItem } from "@/lib/nota-fiscal.functions";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type Search = { etapa?: string; subetapa?: string };

export const Route = createFileRoute("/app/obras/$obraId/compras/nova")({
  component: NovaCompraPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    etapa: typeof s.etapa === "string" ? s.etapa : undefined,
    subetapa: typeof s.subetapa === "string" ? s.subetapa : undefined,
  }),
});

type Fornecedor = { id: string; nome: string; cpf_cnpj?: string | null };
type Etapa = { id: string; nome: string };
type Subetapa = { id: string; etapa_id: string; nome: string; ordem: number };

type ItemLinha = {
  key: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  valor_unitario: string;
};

const novaLinha = (): ItemLinha => ({
  key: crypto.randomUUID(),
  descricao: "",
  unidade: "",
  quantidade: "",
  valor_unitario: "",
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function NovaCompraPage() {
  const { obraId } = Route.useParams();
  const { etapa: etapaSearch, subetapa: subetapaSearch } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const parseNf = useServerFn(parseNotaFiscal);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [subetapas, setSubetapas] = useState<Subetapa[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedNf, setParsedNf] = useState<NfParsed | null>(null);
  const [nfFile, setNfFile] = useState<{ base64: string; mimeType: string; filename: string } | null>(null);

  const [novoFornOpen, setNovoFornOpen] = useState(false);
  const [novoForn, setNovoForn] = useState({ nome: "", cpf_cnpj: "", telefone: "", email: "" });
  const [savingForn, setSavingForn] = useState(false);

  const [novaSubOpen, setNovaSubOpen] = useState(false);
  const [novaSub, setNovaSub] = useState({ nome: "", tipo: "material", valor_orcado: "0" });
  const [savingSub, setSavingSub] = useState(false);

  const [form, setForm] = useState({
    fornecedor_id: "",
    descricao: "",
    natureza: "material" as "material" | "servico" | "equipamento",
    data_compra: new Date().toISOString().slice(0, 10),
    etapa_id: etapaSearch ?? "",
    subetapa_id: subetapaSearch ?? "",
  });

  const [itens, setItens] = useState<ItemLinha[]>([novaLinha()]);

  useEffect(() => {
    void (async () => {
      const [{ data: owned }, { data: memberOf }] = await Promise.all([
        supabase.from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle(),
        supabase.from("customer_members").select("customer_id").eq("user_id", user!.id).eq("status", "ativo").maybeSingle(),
      ]);
      const cid = owned?.id ?? memberOf?.customer_id ?? null;
      setCustomerId(cid);
      const [{ data: fs }, { data: es }, { data: ss }] = await Promise.all([
        supabase.from("fornecedores").select("id,nome,cpf_cnpj").eq("ativo", true).order("nome"),
        supabase.from("orcamento_etapas").select("id,nome,ordem").eq("obra_id", obraId).order("ordem"),
        supabase.from("orcamento_subetapas").select("id,etapa_id,nome,ordem").order("ordem"),
      ]);
      setFornecedores((fs ?? []) as Fornecedor[]);
      setEtapas((es ?? []) as Etapa[]);
      setSubetapas((ss ?? []) as Subetapa[]);
    })();
  }, [obraId, user]);

  const subsDoForm = subetapas.filter((s) => s.etapa_id === form.etapa_id);

  const totalItens = itens.reduce((s, i) => {
    const q = Number(i.quantidade) || 0;
    const v = Number(i.valor_unitario) || 0;
    return s + q * v;
  }, 0);

  const atualizarLinha = (key: string, patch: Partial<ItemLinha>) => {
    setItens((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const removerLinha = (key: string) => {
    setItens((prev) => (prev.length === 1 ? [novaLinha()] : prev.filter((l) => l.key !== key)));
  };
  const adicionarLinha = () => setItens((prev) => [...prev, novaLinha()]);

  const handleImportNf = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const mimeType = file.type || (file.name.toLowerCase().endsWith(".xml") ? "application/xml" : "application/octet-stream");
      const parsed = await parseNf({ data: { fileBase64: base64, mimeType, filename: file.name } });
      setParsedNf(parsed);
      setNfFile({ base64, mimeType, filename: file.name });
      let fornecedorId = form.fornecedor_id;
      if (parsed.fornecedor.cnpj) {
        const match = fornecedores.find((f) => (f.cpf_cnpj ?? "").replace(/\D/g, "") === parsed.fornecedor.cnpj);
        if (match) fornecedorId = match.id;
        else if (customerId) {
          const { data: novo } = await supabase.from("fornecedores").insert({
            customer_id: customerId, created_by: user!.id,
            nome: parsed.fornecedor.nome, cpf_cnpj: parsed.fornecedor.cnpj,
          }).select("id,nome,cpf_cnpj").single();
          if (novo) {
            setFornecedores((p) => [...p, novo as Fornecedor].sort((a, b) => a.nome.localeCompare(b.nome)));
            fornecedorId = (novo as Fornecedor).id;
          }
        }
      }
      setForm((f) => ({
        ...f,
        fornecedor_id: fornecedorId,
        descricao: `NF ${parsed.numero ?? ""}${parsed.serie ? "/" + parsed.serie : ""} — ${parsed.fornecedor.nome}`.trim(),
        data_compra: parsed.emissao ?? f.data_compra,
      }));
      if (parsed.itens.length > 0) {
        setItens(parsed.itens.map((i: NfItem) => ({
          key: crypto.randomUUID(),
          descricao: i.descricao,
          unidade: i.unidade ?? "",
          quantidade: String(i.quantidade),
          valor_unitario: String(i.valor_unitario),
        })));
      }
      toast.success(`Nota lida (${parsed.itens.length} itens)`);
    } catch (e: any) {
      toast.error("Falha ao ler nota", { description: e?.message ?? String(e) });
    } finally {
      setImporting(false);
    }
  };

  const cadastrarFornecedor = async (e: FormEvent) => {
    e.preventDefault();
    if (!novoForn.nome.trim() || !customerId) return;
    setSavingForn(true);
    const { data, error } = await supabase.from("fornecedores").insert({
      customer_id: customerId, created_by: user!.id,
      nome: novoForn.nome.trim(),
      cpf_cnpj: novoForn.cpf_cnpj || null,
      telefone: novoForn.telefone || null,
      email: novoForn.email || null,
    }).select("id,nome").single();
    setSavingForn(false);
    if (error) return toast.error("Erro", { description: error.message });
    setFornecedores((p) => [...p, data as Fornecedor].sort((a, b) => a.nome.localeCompare(b.nome)));
    setForm((f) => ({ ...f, fornecedor_id: data!.id }));
    setNovoForn({ nome: "", cpf_cnpj: "", telefone: "", email: "" });
    setNovoFornOpen(false);
    toast.success("Fornecedor cadastrado");
  };

  const criarSubetapa = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.etapa_id || !novaSub.nome.trim() || !customerId) return;
    setSavingSub(true);
    const ordem = subetapas.filter((s) => s.etapa_id === form.etapa_id).reduce((m, s) => Math.max(m, s.ordem), 0) + 1;
    const { data, error } = await supabase.from("orcamento_subetapas").insert({
      customer_id: customerId, created_by: user!.id,
      etapa_id: form.etapa_id,
      nome: novaSub.nome.trim(),
      tipo: novaSub.tipo,
      valor_orcado: Number(novaSub.valor_orcado) || 0,
      ordem,
    }).select("id,etapa_id,nome,ordem").single();
    setSavingSub(false);
    if (error) return toast.error("Erro", { description: error.message });
    setSubetapas((p) => [...p, data as Subetapa]);
    setForm((f) => ({ ...f, subetapa_id: (data as Subetapa).id }));
    setNovaSubOpen(false);
    setNovaSub({ nome: "", tipo: "material", valor_orcado: "0" });
    toast.success("Subetapa criada");
  };

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.etapa_id || !form.subetapa_id) return toast.error("Selecione etapa e subetapa");
    if (!customerId) return toast.error("Conta não identificada");

    const linhasValidas = itens
      .map((l) => {
        const q = Number(l.quantidade) || 0;
        const v = Number(l.valor_unitario) || 0;
        return { linha: l, q, v, total: q * v };
      })
      .filter((r) => r.linha.descricao.trim() && r.q > 0);

    if (linhasValidas.length === 0) {
      return toast.error("Adicione ao menos um item com descrição e quantidade");
    }

    setSaving(true);
    const total = linhasValidas.reduce((s, r) => s + r.total, 0);

    const { data, error } = await supabase.from("compras").insert({
      customer_id: customerId,
      obra_id: obraId,
      fornecedor_id: form.fornecedor_id || null,
      descricao: form.descricao || null,
      natureza: form.natureza,
      qtd_parcelas: 0,
      valor_total: total,
      data_compra: form.data_compra,
      etapa_id: form.etapa_id,
      subetapa_id: form.subetapa_id,
      status: "pendente",
      created_by: user!.id,
    } as never).select("id").single();

    if (error) { setSaving(false); return toast.error("Erro", { description: error.message }); }
    const compraId = data!.id;

    const itensPayload = linhasValidas.map((r) => ({
      customer_id: customerId,
      compra_id: compraId,
      etapa_id: form.etapa_id,
      subetapa_id: form.subetapa_id,
      descricao: r.linha.descricao.trim(),
      unidade: r.linha.unidade.trim() || null,
      quantidade: r.q,
      valor_unitario: r.v,
      valor_total: r.total,
    }));
    const { error: eItens } = await supabase.from("compra_itens").insert(itensPayload);
    if (eItens) toast.error("Itens não inseridos", { description: eItens.message });

    if (parsedNf && nfFile) {
      let arquivoUrl: string | null = null;
      const bin = Uint8Array.from(atob(nfFile.base64), (c) => c.charCodeAt(0));
      const path = `${customerId}/${compraId}/${Date.now()}-${nfFile.filename}`;
      const { error: eUp } = await supabase.storage.from("notas-fiscais").upload(path, bin, {
        contentType: nfFile.mimeType, upsert: false,
      });
      if (!eUp) arquivoUrl = path;
      await supabase.from("compra_notas_fiscais").insert({
        customer_id: customerId, compra_id: compraId,
        numero: parsedNf.numero, serie: parsedNf.serie, chave: parsedNf.chave,
        valor: parsedNf.valor_total, emitida_em: parsedNf.emissao,
        arquivo_url: arquivoUrl, arquivo_nome: nfFile.filename,
        created_by: user!.id,
      });
    }

    setSaving(false);
    toast.success("Compra criada");
    navigate({ to: "/app/obras/$obraId/compras/$compraId", params: { obraId, compraId } });
  };

  return (
    <div>
      <PageHeader title="Nova compra" description="Preencha o cabeçalho e os itens. Os dados financeiros serão informados depois, ao gerar as contas a pagar." />
      <div className="p-8">
        <div className="mb-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/obras/$obraId/compras" params={{ obraId }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={criar} className="space-y-5">
              <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium">Importar Nota Fiscal</p>
                    <p className="text-xs text-muted-foreground">XML da NFe, PDF do DANFE ou foto — preenche cabeçalho e itens.</p>
                  </div>
                  <label className="inline-flex items-center">
                    <input type="file" accept=".xml,application/xml,text/xml,application/pdf,image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportNf(f); e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" disabled={importing} asChild>
                      <span>{importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo...</> : <><FileUp className="mr-2 h-4 w-4" /> Enviar arquivo</>}</span>
                    </Button>
                  </label>
                </div>
                {parsedNf && (
                  <div className="mt-3 rounded bg-background/60 p-2 text-xs">
                    <p><strong>{parsedNf.fornecedor.nome}</strong>{parsedNf.fornecedor.cnpj ? ` · CNPJ ${parsedNf.fornecedor.cnpj}` : ""}</p>
                    <p className="text-muted-foreground">NF {parsedNf.numero ?? "—"} · {parsedNf.itens.length} itens · {brl(Number(parsedNf.valor_total))}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <div className="flex gap-2">
                  <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                    <SelectContent>{fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setNovoFornOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" /> Novo
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Etapa *</Label>
                  <Select value={form.etapa_id} onValueChange={(v) => setForm({ ...form, etapa_id: v, subetapa_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Subetapa *</Label>
                    {form.etapa_id && (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setNovaSubOpen(true)}>
                        <FolderPlus className="mr-1 inline h-3 w-3" /> Nova
                      </button>
                    )}
                  </div>
                  <Select value={form.subetapa_id} onValueChange={(v) => setForm({ ...form, subetapa_id: v })} disabled={!form.etapa_id}>
                    <SelectTrigger><SelectValue placeholder={form.etapa_id ? (subsDoForm.length ? "Selecione" : "Sem subetapas") : "Escolha a etapa"} /></SelectTrigger>
                    <SelectContent>{subsDoForm.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Natureza *</Label>
                  <Select value={form.natureza} onValueChange={(v) => setForm({ ...form, natureza: v as typeof form.natureza })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="equipamento">Equipamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Data da compra *</Label>
                  <Input type="date" required value={form.data_compra} onChange={(e) => setForm({ ...form, data_compra: e.target.value })} />
                </div>
              </div>

              {/* ITENS INLINE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Itens</Label>
                  <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar item
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-left w-24">QTD</th>
                        <th className="p-2 text-left w-24">UND</th>
                        <th className="p-2 text-left w-32">Valor unit.</th>
                        <th className="p-2 text-right w-32">Total</th>
                        <th className="w-10 p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((l) => {
                        const q = Number(l.quantidade) || 0;
                        const v = Number(l.valor_unitario) || 0;
                        return (
                          <tr key={l.key} className="border-t">
                            <td className="p-1"><Input placeholder="Ex.: Cimento CP-II 50kg" value={l.descricao}
                              onChange={(e) => atualizarLinha(l.key, { descricao: e.target.value })} /></td>
                            <td className="p-1"><Input type="number" step="0.01" min={0} placeholder="0" value={l.quantidade}
                              onChange={(e) => atualizarLinha(l.key, { quantidade: e.target.value })} /></td>
                            <td className="p-1"><Input placeholder="un/kg/m" value={l.unidade}
                              onChange={(e) => atualizarLinha(l.key, { unidade: e.target.value })} /></td>
                            <td className="p-1"><Input type="number" step="0.01" min={0} placeholder="0,00" value={l.valor_unitario}
                              onChange={(e) => atualizarLinha(l.key, { valor_unitario: e.target.value })} /></td>
                            <td className="p-2 text-right tabular-nums">{brl(q * v)}</td>
                            <td className="p-1 text-center">
                              <Button type="button" variant="ghost" size="sm" onClick={() => removerLinha(l.key)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={4} className="p-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Total geral
                        </td>
                        <td className="p-2 text-right font-semibold tabular-nums">{brl(totalItens)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button asChild variant="outline" type="button">
                  <Link to="/app/obras/$obraId/compras" params={{ obraId }}>Cancelar</Link>
                </Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar compra"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={novoFornOpen} onOpenChange={setNovoFornOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar fornecedor</DialogTitle></DialogHeader>
          <form onSubmit={cadastrarFornecedor} className="space-y-3">
            <div className="space-y-2"><Label>Nome *</Label>
              <Input required value={novoForn.nome} onChange={(e) => setNovoForn({ ...novoForn, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>CPF/CNPJ</Label>
                <Input value={novoForn.cpf_cnpj} onChange={(e) => setNovoForn({ ...novoForn, cpf_cnpj: e.target.value })} /></div>
              <div className="space-y-2"><Label>Telefone</Label>
                <Input value={novoForn.telefone} onChange={(e) => setNovoForn({ ...novoForn, telefone: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>E-mail</Label>
              <Input type="email" value={novoForn.email} onChange={(e) => setNovoForn({ ...novoForn, email: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={savingForn}>{savingForn ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={novaSubOpen} onOpenChange={setNovaSubOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova subetapa</DialogTitle></DialogHeader>
          <form onSubmit={criarSubetapa} className="space-y-3">
            <div className="space-y-2"><Label>Nome *</Label>
              <Input required value={novaSub.nome} onChange={(e) => setNovaSub({ ...novaSub, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Tipo</Label>
                <Select value={novaSub.tipo} onValueChange={(v) => setNovaSub({ ...novaSub, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="mao_obra">Mão de obra</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Valor orçado (R$)</Label>
                <Input type="number" step="0.01" min={0} value={novaSub.valor_orcado} onChange={(e) => setNovaSub({ ...novaSub, valor_orcado: e.target.value })} />
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={savingSub}>{savingSub ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
