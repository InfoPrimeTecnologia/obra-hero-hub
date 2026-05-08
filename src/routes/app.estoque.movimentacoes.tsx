import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, ArrowUpDown } from "lucide-react";
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

export const Route = createFileRoute("/app/estoque/movimentacoes")({ component: Page });

type Mov = {
  id: string; tipo: string; origem: string; quantidade: number; custo_unitario: number;
  data: string; observacoes: string | null;
  produto_id: string; almoxarifado_id: string; almoxarifado_destino_id: string | null;
};
type Produto = { id: string; nome: string; unidade: string };
type Almox = { id: string; nome: string };

const initial = {
  tipo: "entrada", produto_id: "", almoxarifado_id: "", almoxarifado_destino_id: "",
  quantidade: 0, custo_unitario: 0, data: new Date().toISOString().slice(0, 10), observacoes: "",
};

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<Mov[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [almox, setAlmox] = useState<Almox[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initial);

  const load = async () => {
    const [m, p, a] = await Promise.all([
      supabase.from("estoque_movimentacoes").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("produtos").select("id,nome,unidade").eq("ativo", true).order("nome"),
      supabase.from("almoxarifados").select("id,nome").eq("ativo", true).order("nome"),
    ]);
    if (m.error) return toast.error(m.error.message);
    setItems((m.data ?? []) as Mov[]);
    setProdutos((p.data ?? []) as Produto[]);
    setAlmox((a.data ?? []) as Almox[]);
  };
  useEffect(() => { void load(); }, []);

  const reset = () => setForm(initial);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.produto_id || !form.almoxarifado_id) return toast.error("Selecione produto e almoxarifado");
    if (form.tipo === "transferencia" && !form.almoxarifado_destino_id) return toast.error("Selecione destino");
    setSaving(true);
    const customer_id = await getCurrentCustomerId();
    if (!customer_id) { setSaving(false); return toast.error("Conta não identificada"); }
    const base = {
      customer_id, produto_id: form.produto_id, almoxarifado_id: form.almoxarifado_id,
      quantidade: Number(form.quantidade), custo_unitario: Number(form.custo_unitario),
      data: form.data, observacoes: form.observacoes || null, origem: "manual", created_by: user!.id,
    };
    if (form.tipo === "transferencia") {
      const { error: e1 } = await supabase.from("estoque_movimentacoes").insert({
        ...base, tipo: "transferencia_saida", almoxarifado_destino_id: form.almoxarifado_destino_id,
      });
      if (e1) { setSaving(false); return toast.error(e1.message); }
      const { error: e2 } = await supabase.from("estoque_movimentacoes").insert({
        ...base, tipo: "transferencia_entrada", almoxarifado_id: form.almoxarifado_destino_id,
      });
      if (e2) { setSaving(false); return toast.error(e2.message); }
    } else {
      const { error } = await supabase.from("estoque_movimentacoes").insert({ ...base, tipo: form.tipo });
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false);
    toast.success("Movimentação registrada");
    reset(); setOpen(false); void load();
  };

  const prodMap = new Map(produtos.map((p) => [p.id, p]));
  const almoxMap = new Map(almox.map((a) => [a.id, a]));
  const tipoLabel = (t: string) => ({
    entrada: "Entrada", saida: "Saída", ajuste: "Ajuste",
    transferencia_saida: "Transf. saída", transferencia_entrada: "Transf. entrada",
  })[t] ?? t;

  return (
    <div>
      <PageHeader title="Movimentações" description="Entradas, saídas, ajustes e transferências de estoque"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Nova movimentação</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Tipo *</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="saida">Saída</SelectItem>
                        <SelectItem value="ajuste">Ajuste (qtd. ± direta)</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Data</Label>
                    <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Produto *</Label>
                  <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{form.tipo === "transferencia" ? "Origem" : "Almoxarifado"} *</Label>
                    <Select value={form.almoxarifado_id} onValueChange={(v) => setForm({ ...form, almoxarifado_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{almox.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                    </Select></div>
                  {form.tipo === "transferencia" && (
                    <div className="space-y-2"><Label>Destino *</Label>
                      <Select value={form.almoxarifado_destino_id} onValueChange={(v) => setForm({ ...form, almoxarifado_destino_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{almox.filter((a) => a.id !== form.almoxarifado_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                      </Select></div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Quantidade *</Label>
                    <Input type="number" step="0.01" required value={form.quantidade}
                      onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Custo unitário</Label>
                    <Input type="number" step="0.01" value={form.custo_unitario}
                      onChange={(e) => setForm({ ...form, custo_unitario: Number(e.target.value) })} /></div>
                </div>
                <div className="space-y-2"><Label>Observações</Label>
                  <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="space-y-2 p-8">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Sem movimentações.</CardContent></Card>
        ) : items.map((m) => {
          const p = prodMap.get(m.produto_id);
          const a = almoxMap.get(m.almoxarifado_id);
          return (
            <Card key={m.id}><CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <ArrowUpDown className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    {tipoLabel(m.tipo)} · {p?.nome ?? "—"} · {Number(m.quantidade).toFixed(2)} {p?.unidade}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a?.nome ?? "—"} · {m.data} · {m.origem}
                    {Number(m.custo_unitario) > 0 && ` · R$ ${Number(m.custo_unitario).toFixed(2)}/un`}
                  </p>
                </div>
              </div>
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}
