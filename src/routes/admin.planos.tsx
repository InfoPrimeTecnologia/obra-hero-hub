import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/planos")({ component: Page });

const MODULES = [
  { id: "obras", label: "Obras" },
  { id: "financeiro", label: "Financeiro" },
  { id: "compras", label: "Compras" },
  { id: "estoque", label: "Estoque" },
  { id: "rh", label: "RH" },
  { id: "relatorios", label: "Relatórios" },
];

type Cycle = "monthly" | "quarterly" | "semiannual" | "annual";
type Plan = {
  id: string; name: string; description: string | null; price: number; cycle: Cycle;
  features: string[]; modules: string[]; limits: { max_obras: number | null; max_colaboradores: number | null; max_usuarios: number | null };
  is_featured: boolean; is_active: boolean; display_order: number;
};

const initial = {
  name: "", description: "", price: 0, cycle: "monthly" as Cycle,
  features: "", modules: ["obras", "financeiro", "compras"] as string[],
  max_obras: "" as string, max_colaboradores: "" as string, max_usuarios: "" as string,
  is_featured: false, is_active: true, display_order: 0,
};

function Page() {
  const [items, setItems] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(initial);

  const load = async () => {
    const { data, error } = await supabase.from("plans").select("*").order("display_order");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as unknown as Plan[]);
  };
  useEffect(() => { void load(); }, []);

  const reset = () => { setForm(initial); setEditing(null); };

  const edit = (p: Plan) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "", price: Number(p.price), cycle: p.cycle,
      features: (p.features ?? []).join("\n"),
      modules: p.modules ?? [],
      max_obras: p.limits?.max_obras?.toString() ?? "",
      max_colaboradores: p.limits?.max_colaboradores?.toString() ?? "",
      max_usuarios: p.limits?.max_usuarios?.toString() ?? "",
      is_featured: p.is_featured, is_active: p.is_active, display_order: p.display_order,
    });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const limits = {
      max_obras: form.max_obras ? Number(form.max_obras) : null,
      max_colaboradores: form.max_colaboradores ? Number(form.max_colaboradores) : null,
      max_usuarios: form.max_usuarios ? Number(form.max_usuarios) : null,
    };
    const payload = {
      name: form.name, description: form.description || null, price: Number(form.price), cycle: form.cycle,
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      modules: form.modules, limits,
      is_featured: form.is_featured, is_active: form.is_active, display_order: Number(form.display_order),
    };
    if (editing) {
      const { error } = await supabase.from("plans").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Plano atualizado");
    } else {
      const { error } = await supabase.from("plans").insert(payload);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Plano criado");
    }
    reset(); setOpen(false); void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); void load();
  };

  const toggleModule = (id: string) => {
    setForm((f) => ({ ...f, modules: f.modules.includes(id) ? f.modules.filter((m) => m !== id) : [...f.modules, id] }));
  };

  return (
    <div>
      <PageHeader title="Planos" description="Gerencie planos comerciais com módulos e limites"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Novo plano</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} plano</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Nome *</Label>
                    <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Ordem</Label>
                    <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
                </div>
                <div className="space-y-2"><Label>Descrição</Label>
                  <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Preço *</Label>
                    <Input type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Ciclo *</Label>
                    <Select value={form.cycle} onValueChange={(v) => setForm({ ...form, cycle: v as Cycle })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select></div>
                </div>

                <div className="space-y-2">
                  <Label>Módulos habilitados</Label>
                  <div className="grid grid-cols-3 gap-2 rounded border p-3">
                    {MODULES.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={form.modules.includes(m.id)} onCheckedChange={() => toggleModule(m.id)} />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Limites quantitativos (vazio = ilimitado)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Obras</Label>
                      <Input type="number" placeholder="∞" value={form.max_obras} onChange={(e) => setForm({ ...form, max_obras: e.target.value })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Colaboradores</Label>
                      <Input type="number" placeholder="∞" value={form.max_colaboradores} onChange={(e) => setForm({ ...form, max_colaboradores: e.target.value })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Usuários</Label>
                      <Input type="number" placeholder="∞" value={form.max_usuarios} onChange={(e) => setForm({ ...form, max_usuarios: e.target.value })} /></div>
                  </div>
                </div>

                <div className="space-y-2"><Label>Recursos (um por linha)</Label>
                  <Textarea rows={3} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label>Destaque</Label>
                    <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded border p-3">
                    <Label>Ativo</Label>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="space-y-3 p-8">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum plano cadastrado.</CardContent></Card>
        ) : items.map((p) => (
          <Card key={p.id}><CardContent className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="font-medium flex items-center gap-2">
                {p.name}
                {p.is_featured && <Star className="h-4 w-4 text-yellow-500" />}
                {!p.is_active && <span className="rounded bg-muted px-2 py-0.5 text-xs">inativo</span>}
              </p>
              <p className="text-sm text-muted-foreground">R$ {Number(p.price).toFixed(2)} · {p.cycle}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Módulos: {(p.modules ?? []).join(", ") || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Limites: obras {p.limits?.max_obras ?? "∞"} · colab {p.limits?.max_colaboradores ?? "∞"} · usuários {p.limits?.max_usuarios ?? "∞"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => edit(p)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover plano?</AlertDialogTitle>
                  <AlertDialogDescription>Não será possível se houver assinaturas vinculadas.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(p.id)}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
