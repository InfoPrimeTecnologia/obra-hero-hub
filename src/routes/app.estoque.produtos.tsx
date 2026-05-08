import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Package, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCurrentCustomerId } from "@/lib/customer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/estoque/produtos")({ component: Page });

type Produto = {
  id: string; codigo: string | null; nome: string; descricao: string | null;
  unidade: string; categoria: string | null; custo_medio: number; estoque_minimo: number; ativo: boolean;
};

const initial = { codigo: "", nome: "", descricao: "", unidade: "un", categoria: "", estoque_minimo: 0 };

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<Produto[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(initial);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Produto[]);
  };
  useEffect(() => { void load(); }, []);

  const reset = () => { setForm(initial); setEditing(null); };
  const edit = (p: Produto) => {
    setEditing(p);
    setForm({
      codigo: p.codigo ?? "", nome: p.nome, descricao: p.descricao ?? "",
      unidade: p.unidade, categoria: p.categoria ?? "", estoque_minimo: Number(p.estoque_minimo),
    });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      codigo: form.codigo || null, nome: form.nome, descricao: form.descricao || null,
      unidade: form.unidade || "un", categoria: form.categoria || null,
      estoque_minimo: Number(form.estoque_minimo) || 0,
    };
    if (editing) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Produto atualizado");
    } else {
      const customer_id = await getCurrentCustomerId();
      if (!customer_id) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("produtos").insert({ ...payload, customer_id, created_by: user!.id });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Produto cadastrado");
    }
    reset(); setOpen(false); void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); void load();
  };

  const filtered = items.filter((p) =>
    [p.nome, p.codigo, p.categoria].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Catálogo de itens do estoque"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Novo produto</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Código</Label>
                    <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
                  <div className="col-span-2 space-y-2"><Label>Nome *</Label>
                    <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Unidade</Label>
                    <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Categoria</Label>
                    <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Estoque mín.</Label>
                    <Input type="number" step="0.01" value={form.estoque_minimo}
                      onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} /></div>
                </div>
                <div className="space-y-2"><Label>Descrição</Label>
                  <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum produto.</CardContent></Card>
        ) : filtered.map((p) => (
          <Card key={p.id}><CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{p.nome} <span className="text-xs text-muted-foreground">({p.unidade})</span></p>
                <p className="text-xs text-muted-foreground">
                  {[p.codigo, p.categoria].filter(Boolean).join(" · ") || "—"}
                  {" · "}custo médio: R$ {Number(p.custo_medio).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => edit(p)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Remover produto?</AlertDialogTitle>
                    <AlertDialogDescription>O produto será inativado.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(p.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
