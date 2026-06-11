import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Receipt, CheckCircle2, XCircle, Undo2, Download } from "lucide-react";
import { downloadCsv, fmtNum, fmtDate } from "@/lib/csv-export";
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
import { useObraSelecionada } from "@/lib/obra-context";
import { ObraScopeBadge } from "@/components/app/ObraScopeBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/contas-pagar")({
  component: ContasPagarPage,
});

type CP = {
  id: string; descricao: string; valor: number; vencimento: string;
  status: string; pago_em: string | null; valor_pago: number | null;
  origem: string; conta_bancaria_id: string | null; categoria_id: string | null;
  fornecedor_id: string | null; obra_id: string | null;
  estornado?: boolean; estorno_token?: string | null; motivo_estorno?: string | null;
};

const statusColor = (s: string) =>
  s === "pago" ? "default" : s === "cancelado" ? "destructive" : s === "parcial" ? "secondary" : "outline";

function ContasPagarPage() {
  const { user } = useAuth();
  const { obra } = useObraSelecionada();
  const [items, setItems] = useState<CP[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; nome: string }[]>([]);
  const [fornec, setFornec] = useState<{ id: string; nome: string }[]>([]);
  const [obras, setObras] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<CP | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "pago" | "vencido">("pendente");
  const [form, setForm] = useState({
    descricao: "", valor: "", vencimento: new Date().toISOString().slice(0, 10),
    categoria_id: "", fornecedor_id: "", obra_id: "", observacoes: "",
  });
  const [pagto, setPagto] = useState({ data: new Date().toISOString().slice(0, 10), conta_bancaria_id: "", valor_pago: "" });

  const carregar = async () => {
    const [{ data: cp }, { data: cb }, { data: ct }, { data: fo }, { data: ob }] = await Promise.all([
      supabase.from("contas_pagar").select("*").order("vencimento"),
      supabase.from("contas_bancarias").select("id,nome").eq("ativo", true),
      supabase.from("categorias_financeiras").select("id,nome").eq("tipo", "despesa").eq("ativo", true),
      supabase.from("fornecedores").select("id,nome").eq("ativo", true),
      supabase.from("obras").select("id,name"),
    ]);
    setItems((cp ?? []) as CP[]);
    setContas((cb ?? []) as any);
    setCats((ct ?? []) as any);
    setFornec((fo ?? []) as any);
    setObras((ob ?? []) as any);
  };
  useEffect(() => { void carregar(); }, []);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    const { data: customer } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    if (!customer) return toast.error("Conta não identificada");
    const { error } = await supabase.from("contas_pagar").insert({
      customer_id: customer.id,
      descricao: form.descricao,
      valor: Number(form.valor || 0),
      vencimento: form.vencimento,
      categoria_id: form.categoria_id || null,
      fornecedor_id: form.fornecedor_id || null,
      obra_id: form.obra_id || null,
      observacoes: form.observacoes || null,
      origem: "manual",
      created_by: user!.id,
    });
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Conta a pagar criada");
    setForm({ descricao: "", valor: "", vencimento: new Date().toISOString().slice(0, 10), categoria_id: "", fornecedor_id: "", obra_id: "", observacoes: "" });
    setOpen(false); void carregar();
  };

  const baixar = async () => {
    if (!paying) return;
    if (!pagto.conta_bancaria_id) return toast.error("Selecione a conta de pagamento");
    const valor = Number(pagto.valor_pago || paying.valor);
    const { error } = await supabase.from("contas_pagar").update({
      status: "pago",
      pago_em: pagto.data,
      valor_pago: valor,
      conta_bancaria_id: pagto.conta_bancaria_id,
    }).eq("id", paying.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Pagamento registrado");
    setPaying(null);
    setPagto({ data: new Date().toISOString().slice(0, 10), conta_bancaria_id: "", valor_pago: "" });
    void carregar();
  };

  const cancelar = async (id: string) => {
    const { error } = await supabase.from("contas_pagar").update({ status: "cancelado" }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Cancelada"); void carregar();
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const escopo = obra ? items.filter((c) => c.obra_id === obra.id) : items;
  const filtrados = escopo.filter((c) => {
    if (filtro === "todos") return true;
    if (filtro === "pendente") return c.status === "pendente";
    if (filtro === "pago") return c.status === "pago";
    if (filtro === "vencido") return c.status === "pendente" && c.vencimento < hoje;
    return true;
  });

  const totalPendente = escopo.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor), 0);
  const totalVencido = escopo.filter(c => c.status === "pendente" && c.vencimento < hoje).reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div>
      <PageHeader
        title="Contas a Pagar"
        description="Inclui contas geradas automaticamente das compras e faturas"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
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
                  <div className="space-y-2"><Label>Fornecedor</Label>
                    <Select value={form.fornecedor_id || "none"} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {fornec.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
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
                <div className="space-y-2"><Label>Obra</Label>
                  <Select value={form.obra_id || "none"} onValueChange={(v) => setForm({ ...form, obra_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Observações</Label>
                  <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        <ObraScopeBadge />
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold">R$ {totalPendente.toFixed(2)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vencido</p>
            <p className="text-2xl font-bold text-destructive">R$ {totalVencido.toFixed(2)}</p>
          </CardContent></Card>
        </div>

        <div className="flex gap-2">
          {(["pendente", "vencido", "pago", "todos"] as const).map((f) => (
            <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
              {f}
            </Button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nada por aqui.
          </CardContent></Card>
        ) : filtrados.map((c) => {
          const venc = c.vencimento;
          const vencido = c.status === "pendente" && venc < hoje;
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Receipt className={`h-5 w-5 ${vencido ? "text-destructive" : "text-primary"}`} />
                  <div>
                    <p className="font-medium">{c.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      Venc: {new Date(venc).toLocaleDateString("pt-BR")}
                      {c.origem !== "manual" && ` · ${c.origem}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">R$ {Number(c.valor).toFixed(2)}</span>
                  <Badge variant={statusColor(c.status) as any}>{c.status}</Badge>
                  {c.status === "pendente" && (
                    <>
                      <Button size="sm" onClick={() => { setPaying(c); setPagto({ ...pagto, valor_pago: String(c.valor) }); }}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Pagar
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

        <Dialog open={!!paying} onOpenChange={(v) => !v && setPaying(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Conta bancária *</Label>
                <Select value={pagto.conta_bancaria_id} onValueChange={(v) => setPagto({ ...pagto, conta_bancaria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data</Label>
                  <Input type="date" value={pagto.data} onChange={(e) => setPagto({ ...pagto, data: e.target.value })} /></div>
                <div className="space-y-2"><Label>Valor pago</Label>
                  <Input type="number" step="0.01" value={pagto.valor_pago} onChange={(e) => setPagto({ ...pagto, valor_pago: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={baixar}>Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
