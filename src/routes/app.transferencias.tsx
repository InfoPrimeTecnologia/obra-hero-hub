import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, ArrowLeftRight, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/transferencias")({
  component: TransferenciasPage,
});

type Tr = {
  id: string; valor: number; data: string; descricao: string | null;
  conta_origem_id: string; conta_destino_id: string; estornada: boolean;
  motivo_estorno: string | null;
};

function TransferenciasPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Tr[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [estorno, setEstorno] = useState<Tr | null>(null);
  const [motivo, setMotivo] = useState("");
  const [form, setForm] = useState({
    conta_origem_id: "", conta_destino_id: "", valor: "",
    data: new Date().toISOString().slice(0, 10), descricao: "",
  });

  const carregar = async () => {
    const [{ data: tr }, { data: cb }] = await Promise.all([
      supabase.from("transferencias").select("*").order("data", { ascending: false }),
      supabase.from("contas_bancarias").select("id,nome").eq("ativo", true),
    ]);
    setItems((tr ?? []) as Tr[]);
    setContas((cb ?? []) as any);
  };
  useEffect(() => { void carregar(); }, []);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (form.conta_origem_id === form.conta_destino_id) return toast.error("Origem e destino devem ser diferentes");
    const { data: customer } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    if (!customer) return toast.error("Conta não identificada");
    const { error } = await supabase.from("transferencias").insert({
      customer_id: customer.id,
      conta_origem_id: form.conta_origem_id,
      conta_destino_id: form.conta_destino_id,
      valor: Number(form.valor),
      data: form.data,
      descricao: form.descricao || null,
      created_by: user!.id,
    });
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Transferência registrada");
    setForm({ conta_origem_id: "", conta_destino_id: "", valor: "", data: new Date().toISOString().slice(0, 10), descricao: "" });
    setOpen(false); void carregar();
  };

  const fazerEstorno = async () => {
    if (!estorno) return;
    if (!motivo.trim()) return toast.error("Informe o motivo");
    // Marca a transferência e cria lançamentos de estorno (inverso)
    const { error: e1 } = await supabase.from("transferencias").update({
      estornada: true, estornada_em: new Date().toISOString(),
      estornada_por: user!.id, motivo_estorno: motivo,
    }).eq("id", estorno.id);
    if (e1) return toast.error("Erro", { description: e1.message });

    // Marca lançamentos originais como estornados e cria reversões
    const { data: lancs } = await supabase.from("lancamentos").select("*")
      .eq("transferencia_id", estorno.id).eq("estornado", false);
    if (lancs) {
      for (const l of lancs) {
        await supabase.from("lancamentos").update({ estornado: true }).eq("id", l.id);
        // reversão
        await supabase.from("lancamentos").insert({
          customer_id: l.customer_id,
          conta_bancaria_id: l.conta_bancaria_id,
          tipo: l.tipo === "entrada" ? "saida" : "entrada",
          valor: l.valor,
          data: new Date().toISOString().slice(0, 10),
          descricao: `ESTORNO: ${l.descricao} - ${motivo}`,
          estorno_token: l.estorno_token,
          created_by: user!.id,
        });
        const delta = l.tipo === "entrada" ? -Number(l.valor) : Number(l.valor);
        const { data: c } = await supabase.from("contas_bancarias").select("saldo_atual").eq("id", l.conta_bancaria_id).maybeSingle();
        if (c) {
          await supabase.from("contas_bancarias").update({ saldo_atual: Number(c.saldo_atual) + delta }).eq("id", l.conta_bancaria_id);
        }
      }
    }
    toast.success("Transferência estornada");
    setEstorno(null); setMotivo(""); void carregar();
  };

  const nomeConta = (id: string) => contas.find(c => c.id === id)?.nome ?? "—";

  return (
    <div>
      <PageHeader
        title="Transferências entre contas"
        description="Movimentações com token de estorno"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova transferência</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova transferência</DialogTitle></DialogHeader>
              <form onSubmit={criar} className="space-y-3">
                <div className="space-y-2"><Label>Conta origem *</Label>
                  <Select value={form.conta_origem_id} onValueChange={(v) => setForm({ ...form, conta_origem_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Conta destino *</Label>
                  <Select value={form.conta_destino_id} onValueChange={(v) => setForm({ ...form, conta_destino_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Valor *</Label>
                    <Input required type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Data *</Label>
                    <Input required type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Descrição</Label>
                  <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                <DialogFooter><Button type="submit">Transferir</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma transferência.
          </CardContent></Card>
        ) : items.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{nomeConta(t.conta_origem_id)} → {nomeConta(t.conta_destino_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.data).toLocaleDateString("pt-BR")}
                    {t.descricao && ` · ${t.descricao}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">R$ {Number(t.valor).toFixed(2)}</span>
                {t.estornada ? (
                  <Badge variant="destructive">Estornada</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEstorno(t)}>
                    <Undo2 className="mr-1 h-4 w-4" /> Estornar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        <Dialog open={!!estorno} onOpenChange={(v) => !v && setEstorno(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Estornar transferência</DialogTitle></DialogHeader>
            <div className="space-y-2"><Label>Motivo *</Label>
              <Textarea required value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
            <DialogFooter><Button variant="destructive" onClick={fazerEstorno}>Confirmar estorno</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
