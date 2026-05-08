import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Warehouse, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCurrentCustomerId } from "@/lib/customer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/estoque/almoxarifados")({ component: Page });

type Almox = { id: string; nome: string; descricao: string | null; obra_id: string | null; principal: boolean; ativo: boolean };
type Obra = { id: string; name: string };

const initial = { nome: "", descricao: "", obra_id: "", principal: false };

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<Almox[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Almox | null>(null);
  const [form, setForm] = useState(initial);

  const obraName = (id: string | null) => obras.find((o) => o.id === id)?.name ?? "Geral";

  const load = async () => {
    const { data } = await supabase.from("almoxarifados").select("*").eq("ativo", true).order("nome");
    setItems((data ?? []) as Almox[]);
    const { data: o } = await supabase.from("obras").select("id,name").order("name");
    setObras((o ?? []) as Obra[]);
  };
  useEffect(() => { void load(); }, []);

  const reset = () => { setForm(initial); setEditing(null); };
  const edit = (a: Almox) => {
    setEditing(a);
    setForm({ nome: a.nome, descricao: a.descricao ?? "", obra_id: a.obra_id ?? "", principal: a.principal });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: form.nome, descricao: form.descricao || null,
      obra_id: form.obra_id || null, principal: form.principal,
    };
    if (editing) {
      const { error } = await supabase.from("almoxarifados").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Atualizado");
    } else {
      const customer_id = await getCurrentCustomerId();
      if (!customer_id) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("almoxarifados").insert({ ...payload, customer_id, created_by: user!.id });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Almoxarifado criado");
    }
    reset(); setOpen(false); void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("almoxarifados").update({ ativo: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); void load();
  };

  return (
    <div>
      <PageHeader title="Almoxarifados" description="Locais de armazenamento (geral ou por obra)"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} almoxarifado</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="space-y-2"><Label>Nome *</Label>
                  <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-2"><Label>Obra</Label>
                  <Select value={form.obra_id || "none"} onValueChange={(v) => setForm({ ...form, obra_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Geral / sem obra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geral / sem obra</SelectItem>
                      {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label>Descrição</Label>
                  <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                <div className="flex items-center justify-between rounded border p-3">
                  <div><Label>Principal</Label>
                    <p className="text-xs text-muted-foreground">Recebe entradas automáticas de recebimentos</p></div>
                  <Switch checked={form.principal} onCheckedChange={(v) => setForm({ ...form, principal: v })} />
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="space-y-3 p-8">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum almoxarifado.</CardContent></Card>
        ) : items.map((a) => (
          <Card key={a.id}><CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <Warehouse className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{a.nome} {a.principal && <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">principal</span>}</p>
                <p className="text-xs text-muted-foreground">{a.obras?.name ?? "Geral"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => edit(a)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover?</AlertDialogTitle>
                  <AlertDialogDescription>Será inativado.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(a.id)}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
