import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/categorias")({
  component: CategoriasPage,
});

type Cat = { id: string; nome: string; tipo: string; parent_id: string | null; cor: string | null };

function CategoriasPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Cat[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "despesa", parent_id: "", cor: "#3b82f6" });
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "receita" | "despesa">("todos");

  const carregar = async () => {
    const { data, error } = await supabase
      .from("categorias_financeiras").select("*").eq("ativo", true).order("tipo").order("nome");
    if (error) return toast.error("Erro", { description: error.message });
    setItems((data ?? []) as Cat[]);
  };
  useEffect(() => { void carregar(); }, []);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: customer } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    if (!customer) { setSaving(false); return toast.error("Conta não identificada"); }
    const { error } = await supabase.from("categorias_financeiras").insert({
      customer_id: customer.id, nome: form.nome, tipo: form.tipo, cor: form.cor,
      parent_id: form.parent_id || null,
    });
    setSaving(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Categoria criada");
    setForm({ nome: "", tipo: "despesa", parent_id: "", cor: "#3b82f6" });
    setOpen(false); void carregar();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("categorias_financeiras").update({ ativo: false }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Removida"); void carregar();
  };

  const filtrados = items.filter((c) => filtroTipo === "todos" || c.tipo === filtroTipo);

  return (
    <div>
      <PageHeader
        title="Categorias financeiras"
        info="Categorias usadas para classificar lançamentos e compras (receitas e despesas). Base para relatórios por natureza."
        description="Organize receitas e despesas em árvore (pai/filho)"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova categoria</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
              <form onSubmit={salvar} className="space-y-3">
                <div className="space-y-2"><Label>Nome *</Label>
                  <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v, parent_id: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Cor</Label>
                    <Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Categoria pai (opcional)</Label>
                  <Select value={form.parent_id || "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {items.filter((c) => c.tipo === form.tipo && !c.parent_id).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        <div className="flex gap-2">
          {(["todos", "receita", "despesa"] as const).map((t) => (
            <Button key={t} size="sm" variant={filtroTipo === t ? "default" : "outline"} onClick={() => setFiltroTipo(t)}>
              {t === "todos" ? "Todas" : t === "receita" ? "Receitas" : "Despesas"}
            </Button>
          ))}
        </div>
        {filtrados.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma categoria.
          </CardContent></Card>
        ) : filtrados.map((c) => {
          const parent = items.find((p) => p.id === c.parent_id);
          return (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4" style={{ color: c.cor ?? undefined }} />
                  <div>
                    <p className="text-sm font-medium">
                      {parent ? `${parent.nome} › ` : ""}{c.nome}
                    </p>
                    <Badge variant={c.tipo === "receita" ? "default" : "secondary"} className="mt-1">
                      {c.tipo}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => excluir(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
