import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, ClipboardCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCurrentCustomerId } from "@/lib/customer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/estoque/requisicoes")({ component: Page });

type Req = {
  id: string; numero: number; data: string; status: string; obra_id: string; almoxarifado_id: string | null;
  solicitante: string | null; observacoes: string | null;
};
type Item = { id: string; produto_id: string; quantidade: number; qtd_atendida: number; observacoes: string | null };
type Produto = { id: string; nome: string; unidade: string };
type Obra = { id: string; name: string };
type Almox = { id: string; nome: string; obra_id: string | null };

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [almox, setAlmox] = useState<Almox[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ obra_id: "", almoxarifado_id: "", solicitante: "", data: new Date().toISOString().slice(0, 10), observacoes: "" });
  const [linhas, setLinhas] = useState<{ produto_id: string; quantidade: number }[]>([]);
  const [detail, setDetail] = useState<Req | null>(null);
  const [detailItens, setDetailItens] = useState<Item[]>([]);

  const load = async () => {
    const [r, p, o, a] = await Promise.all([
      supabase.from("requisicoes").select("*").order("created_at", { ascending: false }),
      supabase.from("produtos").select("id,nome,unidade").eq("ativo", true).order("nome"),
      supabase.from("obras").select("id,name").order("name"),
      supabase.from("almoxarifados").select("id,nome,obra_id").eq("ativo", true).order("nome"),
    ]);
    if (r.error) return toast.error(r.error.message);
    setItems((r.data ?? []) as Req[]);
    setProdutos((p.data ?? []) as Produto[]);
    setObras((o.data ?? []) as Obra[]);
    setAlmox((a.data ?? []) as Almox[]);
  };
  useEffect(() => { void load(); }, []);

  const reset = () => { setForm({ obra_id: "", almoxarifado_id: "", solicitante: "", data: new Date().toISOString().slice(0, 10), observacoes: "" }); setLinhas([]); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.obra_id) return toast.error("Selecione a obra");
    if (linhas.length === 0) return toast.error("Adicione ao menos um item");
    setSaving(true);
    const customer_id = await getCurrentCustomerId();
    if (!customer_id) { setSaving(false); return toast.error("Conta não identificada"); }
    const numero = (items[0]?.numero ?? 0) + 1;
    const { data: req, error } = await supabase.from("requisicoes").insert({
      customer_id, obra_id: form.obra_id, almoxarifado_id: form.almoxarifado_id || null,
      solicitante: form.solicitante || null, data: form.data, observacoes: form.observacoes || null,
      numero, created_by: user!.id,
    }).select().single();
    if (error || !req) { setSaving(false); return toast.error(error?.message); }
    const { error: ei } = await supabase.from("requisicao_itens").insert(
      linhas.map((l) => ({ customer_id, requisicao_id: req.id, produto_id: l.produto_id, quantidade: Number(l.quantidade) }))
    );
    setSaving(false);
    if (ei) return toast.error(ei.message);
    toast.success("Requisição criada");
    reset(); setOpen(false); void load();
  };

  const openDetail = async (r: Req) => {
    setDetail(r);
    const { data } = await supabase.from("requisicao_itens").select("*").eq("requisicao_id", r.id);
    setDetailItens((data ?? []) as Item[]);
  };

  const atender = async () => {
    if (!detail) return;
    if (!detail.almoxarifado_id) return toast.error("Defina o almoxarifado da requisição antes de atender");
    const customer_id = await getCurrentCustomerId();
    if (!customer_id) return;
    // gera saída de estoque para cada item ainda não atendido
    for (const it of detailItens) {
      const restante = Number(it.quantidade) - Number(it.qtd_atendida);
      if (restante <= 0) continue;
      const { error } = await supabase.from("estoque_movimentacoes").insert({
        customer_id, produto_id: it.produto_id, almoxarifado_id: detail.almoxarifado_id,
        tipo: "saida", origem: "requisicao", requisicao_id: detail.id, obra_id: detail.obra_id,
        quantidade: restante, custo_unitario: 0, data: new Date().toISOString().slice(0, 10),
        observacoes: `Atend. requisição #${detail.numero}`, created_by: user!.id,
      });
      if (error) return toast.error(error.message);
      await supabase.from("requisicao_itens").update({ qtd_atendida: Number(it.quantidade) }).eq("id", it.id);
    }
    await supabase.from("requisicoes").update({ status: "atendida" }).eq("id", detail.id);
    toast.success("Requisição atendida"); setDetail(null); void load();
  };

  const remove = async (id: string) => {
    await supabase.from("requisicao_itens").delete().eq("requisicao_id", id);
    await supabase.from("requisicoes").delete().eq("id", id);
    toast.success("Removida"); void load();
  };

  const obraName = (id: string) => obras.find((o) => o.id === id)?.name ?? "—";
  const prodMap = new Map(produtos.map((p) => [p.id, p]));

  return (
    <div>
      <PageHeader title="Requisições de Material" description="Solicitações de saída do estoque por obra"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Nova requisição</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Nova requisição</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Obra *</Label>
                    <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Data</Label>
                    <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Almoxarifado</Label>
                    <Select value={form.almoxarifado_id || "none"} onValueChange={(v) => setForm({ ...form, almoxarifado_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Definir depois</SelectItem>
                        {almox.filter((a) => !a.obra_id || a.obra_id === form.obra_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Solicitante</Label>
                    <Input value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label>Itens</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setLinhas([...linhas, { produto_id: "", quantidade: 1 }])}>+ item</Button>
                  </div>
                  {linhas.map((l, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Select value={l.produto_id} onValueChange={(v) => {
                        const c = [...linhas]; c[idx] = { ...c[idx], produto_id: v }; setLinhas(c);
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                        <SelectContent>{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" step="0.01" className="w-28" value={l.quantidade}
                        onChange={(e) => { const c = [...linhas]; c[idx] = { ...c[idx], quantidade: Number(e.target.value) }; setLinhas(c); }} />
                      <Button type="button" size="icon" variant="ghost" onClick={() => setLinhas(linhas.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2"><Label>Observações</Label>
                  <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="space-y-2 p-8">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma requisição.</CardContent></Card>
        ) : items.map((r) => (
          <Card key={r.id}><CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">#{r.numero} · {obraName(r.obra_id)}</p>
                <p className="text-xs text-muted-foreground">{r.data} · {r.status} · {r.solicitante ?? "—"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openDetail(r)}>Ver / Atender</Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Requisição #{detail?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {detailItens.map((it) => (
              <div key={it.id} className="flex justify-between rounded border p-2">
                <span>{prodMap.get(it.produto_id)?.nome ?? "—"}</span>
                <span className="text-muted-foreground">
                  {Number(it.qtd_atendida).toFixed(2)} / {Number(it.quantidade).toFixed(2)} {prodMap.get(it.produto_id)?.unidade}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            {detail?.status !== "atendida" && (
              <Button onClick={atender}>Atender (gera saída de estoque)</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
