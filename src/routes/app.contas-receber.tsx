import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, ArrowDownToLine, CheckCircle2, XCircle } from "lucide-react";
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
import { useObraSelecionada } from "@/lib/obra-context";
import { ObraScopeBadge } from "@/components/app/ObraScopeBadge";
import { toast } from "sonner";
import { fmtDataBR, hojeISO } from "@/lib/date-br";

export const Route = createFileRoute("/app/contas-receber")({
  component: ContasReceberPage,
});

type CR = {
  id: string; descricao: string; valor: number; vencimento: string;
  status: string; recebido_em: string | null; valor_recebido: number | null;
  origem: string; obra_id: string | null; categoria_id: string | null;
};

const statusColor = (s: string) =>
  s === "recebido" ? "default" : s === "cancelado" ? "destructive" : "outline";

function ContasReceberPage() {
  const { user } = useAuth();
  const { obra } = useObraSelecionada();
  const [items, setItems] = useState<CR[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; nome: string }[]>([]);
  const [obras, setObras] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [recv, setRecv] = useState<CR | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "recebido" | "vencido">("pendente");
  const [form, setForm] = useState({
    descricao: "", valor: "", vencimento: hojeISO(),
    categoria_id: "", obra_id: "",
  });
  const [pagto, setPagto] = useState({ data: hojeISO(), conta_bancaria_id: "", valor_recebido: "" });

  const carregar = async () => {
    const [{ data: cr }, { data: cb }, { data: ct }, { data: ob }] = await Promise.all([
      supabase.from("contas_receber").select("*").order("vencimento"),
      supabase.from("contas_bancarias").select("id,nome").eq("ativo", true),
      supabase.from("categorias_financeiras").select("id,nome").eq("tipo", "receita").eq("ativo", true),
      supabase.from("obras").select("id,name"),
    ]);
    setItems((cr ?? []) as CR[]);
    setContas((cb ?? []) as any);
    setCats((ct ?? []) as any);
    setObras((ob ?? []) as any);
  };
  useEffect(() => { void carregar(); }, []);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    const { data: customer } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    if (!customer) return toast.error("Conta não identificada");
    const { error } = await supabase.from("contas_receber").insert({
      customer_id: customer.id,
      descricao: form.descricao,
      valor: Number(form.valor || 0),
      vencimento: form.vencimento,
      categoria_id: form.categoria_id || null,
      obra_id: form.obra_id || null,
      origem: "manual",
      created_by: user!.id,
    });
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Conta a receber criada");
    setForm({ descricao: "", valor: "", vencimento: hojeISO(), categoria_id: "", obra_id: "" });
    setOpen(false); void carregar();
  };

  const baixar = async () => {
    if (!recv) return;
    if (!pagto.conta_bancaria_id) return toast.error("Selecione a conta de recebimento");
    const valor = Number(pagto.valor_recebido || recv.valor);
    const { error } = await supabase.from("contas_receber").update({
      status: "recebido",
      recebido_em: pagto.data,
      valor_recebido: valor,
      conta_bancaria_id: pagto.conta_bancaria_id,
    }).eq("id", recv.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Recebimento registrado");
    setRecv(null);
    setPagto({ data: hojeISO(), conta_bancaria_id: "", valor_recebido: "" });
    void carregar();
  };

  const cancelar = async (id: string) => {
    const { error } = await supabase.from("contas_receber").update({ status: "cancelado" }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Cancelada"); void carregar();
  };

  const hoje = hojeISO();
  const escopo = obra ? items.filter((c) => c.obra_id === obra.id) : items;
  const filtrados = escopo.filter((c) => {
    if (filtro === "todos") return true;
    if (filtro === "pendente") return c.status === "pendente";
    if (filtro === "recebido") return c.status === "recebido";
    if (filtro === "vencido") return c.status === "pendente" && c.vencimento < hoje;
    return true;
  });
  const totalPend = escopo.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div>
      <PageHeader
        title="Contas a Receber"
        info="Recebimentos previstos (medições, aditivos, mensalidades). Registre baixas ao receber."
        description="Receitas previstas e baixas no caixa"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova receita</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova conta a receber</DialogTitle></DialogHeader>
              <form onSubmit={criar} className="space-y-3">
                <div className="space-y-2"><Label>Descrição *</Label>
                  <Input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Valor *</Label>
                    <Input required type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Vencimento *</Label>
                    <Input required type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Obra</Label>
                    <Select value={form.obra_id || "none"} onValueChange={(v) => setForm({ ...form, obra_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Categoria</Label>
                    <Select value={form.categoria_id || "none"} onValueChange={(v) => setForm({ ...form, categoria_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        <ObraScopeBadge />
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">A receber (pendente)</p>
          <p className="text-2xl font-bold">R$ {totalPend.toFixed(2)}</p>
        </CardContent></Card>

        <div className="flex gap-2">
          {(["pendente", "vencido", "recebido", "todos"] as const).map((f) => (
            <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>{f}</Button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nada por aqui.</CardContent></Card>
        ) : filtrados.map((c) => {
          const vencido = c.status === "pendente" && c.vencimento < hoje;
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <ArrowDownToLine className={`h-5 w-5 ${vencido ? "text-destructive" : "text-primary"}`} />
                  <div>
                    <p className="font-medium">{c.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      Venc: {fmtDataBR(c.vencimento)}
                      {c.origem !== "manual" && ` · ${c.origem}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">R$ {Number(c.valor).toFixed(2)}</span>
                  <Badge variant={statusColor(c.status) as any}>{c.status}</Badge>
                  {c.status === "pendente" && (
                    <>
                      <Button size="sm" onClick={() => { setRecv(c); setPagto({ ...pagto, valor_recebido: String(c.valor) }); }}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Receber
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelar(c.id)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Dialog open={!!recv} onOpenChange={(v) => !v && setRecv(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Conta bancária *</Label>
                <Select value={pagto.conta_bancaria_id} onValueChange={(v) => setPagto({ ...pagto, conta_bancaria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data</Label>
                  <Input type="date" value={pagto.data} onChange={(e) => setPagto({ ...pagto, data: e.target.value })} /></div>
                <div className="space-y-2"><Label>Valor recebido</Label>
                  <Input type="number" step="0.01" value={pagto.valor_recebido} onChange={(e) => setPagto({ ...pagto, valor_recebido: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={baixar}>Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
