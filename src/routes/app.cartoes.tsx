import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, CreditCard, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/cartoes")({
  component: CartoesPage,
});

type Cartao = {
  id: string;
  nome: string;
  bandeira: string | null;
  ultimos_4: string | null;
  limite: number;
  dia_fechamento: number;
  dia_vencimento: number;
  empresa_id: string | null;
  obra_id: string | null;
};

type Empresa = { id: string; nome: string };
type Obra = { id: string; name: string };

const GLOBAL = "__global__";
const initial = {
  nome: "", bandeira: "", ultimos_4: "", limite: "0",
  dia_fechamento: "1", dia_vencimento: "10", empresa_id: "", obra_id: GLOBAL,
};

function CartoesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Cartao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Cartao | null>(null);
  const [form, setForm] = useState(initial);

  const carregar = async () => {
    const [{ data: cs }, { data: es }, { data: os }] = await Promise.all([
      supabase.from("cartoes").select("*").eq("ativo", true).order("nome"),
      supabase.from("empresas").select("id,nome").order("nome"),
      supabase.from("obras").select("id,name").order("name"),
    ]);
    setItems((cs ?? []) as Cartao[]);
    setEmpresas((es ?? []) as Empresa[]);
    setObras((os ?? []) as Obra[]);
  };

  useEffect(() => { void carregar(); }, []);

  const reset = () => { setForm(initial); setEditing(null); };

  const abrirEdicao = (c: Cartao) => {
    setEditing(c);
    setForm({
      nome: c.nome, bandeira: c.bandeira ?? "", ultimos_4: c.ultimos_4 ?? "",
      limite: String(c.limite), dia_fechamento: String(c.dia_fechamento),
      dia_vencimento: String(c.dia_vencimento), empresa_id: c.empresa_id ?? "",
      obra_id: c.obra_id ?? GLOBAL,
    });
    setOpen(true);
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: form.nome, bandeira: form.bandeira || null,
      ultimos_4: form.ultimos_4 || null,
      limite: Number(form.limite || 0),
      dia_fechamento: Number(form.dia_fechamento),
      dia_vencimento: Number(form.dia_vencimento),
      empresa_id: form.empresa_id || null,
      obra_id: form.obra_id === GLOBAL ? null : form.obra_id,
    };
    if (editing) {
      const { error } = await supabase.from("cartoes").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Cartão atualizado");
    } else {
      const { data: customer } = await supabase
        .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
      if (!customer) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("cartoes").insert({
        ...payload, customer_id: customer.id, created_by: user!.id,
      });
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Cartão cadastrado");
    }
    reset(); setOpen(false); void carregar();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("cartoes").update({ ativo: false }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Cartão removido"); void carregar();
  };

  return (
    <div>
      <PageHeader
        title="Cartões"
        description="Cartões de crédito usados em compras"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Novo cartão</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar cartão" : "Cadastrar cartão"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={salvar} className="space-y-3">
                <div className="space-y-2"><Label>Nome *</Label>
                  <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Bandeira</Label>
                    <Input value={form.bandeira} onChange={(e) => setForm({ ...form, bandeira: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Últimos 4 dígitos</Label>
                    <Input maxLength={4} value={form.ultimos_4} onChange={(e) => setForm({ ...form, ultimos_4: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Empresa</Label>
                  <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                    <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Limite</Label>
                    <Input type="number" step="0.01" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Dia fechamento *</Label>
                    <Input required type="number" min={1} max={31} value={form.dia_fechamento} onChange={(e) => setForm({ ...form, dia_fechamento: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Dia vencimento *</Label>
                    <Input required type="number" min={1} max={31} value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum cartão cadastrado.
          </CardContent></Card>
        ) : items.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {c.nome} {c.ultimos_4 && <span className="text-muted-foreground">•••• {c.ultimos_4}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.bandeira ? `${c.bandeira} · ` : ""}
                    Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento} · Limite R$ {c.limite.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => abrirEdicao(c)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
                      <AlertDialogDescription>O cartão será inativado.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluir(c.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
