import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Truck, Pencil, Trash2, Eye, EyeOff, Copy } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { maskPix, PIX_LABELS, type PixTipo } from "@/lib/pix-mask";

export const Route = createFileRoute("/app/fornecedores")({
  component: FornecedoresPage,
});

type Fornecedor = {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  contato: string | null;
  endereco: string | null;
  observacoes: string | null;
  pix_tipo: PixTipo | null;
  pix_chave: string | null;
};

const initial = {
  nome: "", cpf_cnpj: "", email: "", telefone: "", contato: "", endereco: "", observacoes: "",
  pix_tipo: "" as "" | PixTipo, pix_chave: "",
};

function FornecedoresPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState(initial);

  const carregar = async () => {
    const { data, error } = await supabase
      .from("fornecedores").select("*").eq("ativo", true).order("nome");
    if (error) return toast.error("Erro", { description: error.message });
    setItems((data ?? []) as Fornecedor[]);
  };

  useEffect(() => { void carregar(); }, []);

  const reset = () => { setForm(initial); setEditing(null); };

  const abrirEdicao = (f: Fornecedor) => {
    setEditing(f);
    setForm({
      nome: f.nome, cpf_cnpj: f.cpf_cnpj ?? "", email: f.email ?? "",
      telefone: f.telefone ?? "", contato: f.contato ?? "",
      endereco: f.endereco ?? "", observacoes: f.observacoes ?? "",
      pix_tipo: (f.pix_tipo ?? "") as "" | PixTipo, pix_chave: f.pix_chave ?? "",
    });
    setOpen(true);
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      contato: form.contato || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      pix_tipo: form.pix_tipo || null,
      pix_chave: form.pix_chave || null,
    };
    if (editing) {
      const { error } = await supabase.from("fornecedores").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Fornecedor atualizado");
    } else {
      const { data: customer } = await supabase
        .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
      if (!customer) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("fornecedores").insert({
        ...payload, customer_id: customer.id, created_by: user!.id,
      });
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Fornecedor cadastrado");
    }
    reset(); setOpen(false); void carregar();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("fornecedores").update({ ativo: false }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Fornecedor removido"); void carregar();
  };

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores para uso em compras"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button onClick={reset}>
                <Plus className="mr-2 h-4 w-4" /> Novo fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar fornecedor" : "Cadastrar fornecedor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={salvar} className="space-y-3">
                <div className="space-y-2"><Label>Nome *</Label>
                  <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>CPF/CNPJ</Label>
                    <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Telefone</Label>
                    <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Contato</Label>
                    <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
                <div className="space-y-2"><Label>Observações</Label>
                  <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>

                <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                  <p className="text-sm font-medium">Chave Pix (opcional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Tipo</Label>
                      <Select value={form.pix_tipo || "none"} onValueChange={(v) => setForm({ ...form, pix_tipo: v === "none" ? "" : (v as PixTipo) })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {(Object.keys(PIX_LABELS) as PixTipo[]).map((k) => (
                            <SelectItem key={k} value={k}>{PIX_LABELS[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Chave</Label>
                      <Input value={form.pix_chave} onChange={(e) => setForm({ ...form, pix_chave: e.target.value })} placeholder="Será exibida mascarada" /></div>
                  </div>
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
            Nenhum fornecedor cadastrado.
          </CardContent></Card>
        ) : items.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{f.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[f.cpf_cnpj, f.telefone, f.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {f.pix_tipo && f.pix_chave && <PixDisplay tipo={f.pix_tipo} chave={f.pix_chave} />}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => abrirEdicao(f)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover fornecedor?</AlertDialogTitle>
                      <AlertDialogDescription>O cadastro será inativado.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluir(f.id)}>Remover</AlertDialogAction>
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
