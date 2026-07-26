import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Wallet, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/app/contas-bancarias")({
  component: ContasBancariasPage,
});

type Conta = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string;
  saldo_atual: number;
  saldo_inicial: number;
  obra_id: string | null;
};

type Obra = { id: string; name: string };

const GLOBAL = "__global__";
const initial = {
  nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0",
  obra_id: GLOBAL,
};

function ContasBancariasPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Conta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Conta | null>(null);
  const [form, setForm] = useState(initial);

  const carregar = async () => {
    const [{ data, error }, { data: os }] = await Promise.all([
      supabase.from("contas_bancarias").select("*").eq("ativo", true).order("nome"),
      supabase.from("obras").select("id,name").order("name"),
    ]);
    if (error) return toast.error("Erro", { description: error.message });
    setItems((data ?? []) as Conta[]);
    setObras((os ?? []) as Obra[]);
  };
  useEffect(() => { void carregar(); }, []);
  const reset = () => { setForm(initial); setEditing(null); };

  const abrirEdicao = (c: Conta) => {
    setEditing(c);
    setForm({
      nome: c.nome, banco: c.banco ?? "", agencia: c.agencia ?? "",
      conta: c.conta ?? "", tipo: c.tipo, saldo_inicial: String(c.saldo_inicial ?? 0),
      obra_id: c.obra_id ?? GLOBAL,
    });
    setOpen(true);
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saldo = Number(form.saldo_inicial || 0);
    const payload = {
      nome: form.nome, banco: form.banco || null, agencia: form.agencia || null,
      conta: form.conta || null, tipo: form.tipo, saldo_inicial: saldo,
      obra_id: form.obra_id === GLOBAL ? null : form.obra_id,
    };
    if (editing) {
      const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Conta atualizada");
    } else {
      const { data: customer } = await supabase
        .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
      if (!customer) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("contas_bancarias").insert({
        ...payload, saldo_atual: saldo, customer_id: customer.id, created_by: user!.id,
      });
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Conta cadastrada");
    }
    reset(); setOpen(false); void carregar();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("contas_bancarias").update({ ativo: false }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Conta removida"); void carregar();
  };

  const total = items.reduce((s, c) => s + Number(c.saldo_atual || 0), 0);

  return (
    <div>
      <PageHeader
        title="Contas bancárias"
        info="Contas bancárias e caixas físicos. Pode ser global ou vinculada a uma obra específica."
        description="Gerencie contas, saldos iniciais e tipos"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button onClick={reset}><Plus className="mr-2 h-4 w-4" /> Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar conta" : "Nova conta bancária"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={salvar} className="space-y-3">
                <div className="space-y-2"><Label>Nome *</Label>
                  <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Banco</Label>
                    <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Conta Corrente</SelectItem>
                        <SelectItem value="poupanca">Poupança</SelectItem>
                        <SelectItem value="caixa">Caixa</SelectItem>
                        <SelectItem value="investimento">Investimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Agência</Label>
                    <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Conta</Label>
                    <Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Saldo inicial</Label>
                  <Input type="number" step="0.01" value={form.saldo_inicial}
                    onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} /></div>
                <div className="space-y-2"><Label>Vínculo</Label>
                  <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GLOBAL}>Global (todas as obras)</SelectItem>
                      {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
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
        <Card><CardContent className="flex items-center justify-between p-4">
          <span className="text-sm text-muted-foreground">Saldo total</span>
          <span className="text-2xl font-bold">R$ {total.toFixed(2)}</span>
        </CardContent></Card>
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada.
          </CardContent></Card>
        ) : items.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium flex items-center gap-2">{c.nome}
                    {c.obra_id
                      ? <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{obras.find(o => o.id === c.obra_id)?.name ?? "Obra"}</span>
                      : <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Global</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[c.banco, c.agencia, c.conta].filter(Boolean).join(" · ") || c.tipo}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">R$ {Number(c.saldo_atual).toFixed(2)}</span>
                <Button variant="outline" size="sm" onClick={() => abrirEdicao(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover conta?</AlertDialogTitle>
                      <AlertDialogDescription>A conta será inativada.</AlertDialogDescription>
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
