import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Receipt, CheckCircle2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/contas-pagar")({
  component: ContasPagarObra,
});

type CP = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  fornecedor_id: string | null;
  estornado?: boolean | null;
};

function ContasPagarObra() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const [items, setItems] = useState<CP[]>([]);
  const [fornec, setFornec] = useState<{ id: string; nome: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; nome: string }[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string; obra_id: string | null }[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "pago">("pendente");
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<CP | null>(null);
  const [estornando, setEstornando] = useState<CP | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    vencimento: new Date().toISOString().slice(0, 10),
    categoria_id: "",
    fornecedor_id: "",
    observacoes: "",
  });
  const [pagto, setPagto] = useState({
    data: new Date().toISOString().slice(0, 10),
    conta_bancaria_id: "",
  });

  const carregar = async () => {
    const [{ data }, { data: f }, { data: c }, { data: cb }] = await Promise.all([
      supabase
        .from("contas_pagar")
        .select("id,descricao,valor,vencimento,status,fornecedor_id,estornado")
        .eq("obra_id", obraId)
        .order("vencimento"),
      supabase.from("fornecedores").select("id,nome").eq("ativo", true).order("nome"),
      supabase
        .from("categorias_financeiras")
        .select("id,nome")
        .eq("tipo", "despesa")
        .eq("ativo", true),
      supabase
        .from("contas_bancarias")
        .select("id,nome,obra_id")
        .eq("ativo", true)
        .or(`obra_id.eq.${obraId},obra_id.is.null`)
        .order("nome"),
    ]);
    setItems((data as CP[]) ?? []);
    setFornec((f as any) ?? []);
    setCats((c as any) ?? []);
    setContas((cb as any) ?? []);
  };

  useEffect(() => {
    void carregar();
  }, [obraId]);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_user_id", user!.id)
      .maybeSingle();
    if (!customer) return toast.error("Conta não identificada");
    const { error } = await supabase.from("contas_pagar").insert({
      customer_id: customer.id,
      descricao: form.descricao,
      valor: Number(form.valor || 0),
      vencimento: form.vencimento,
      categoria_id: form.categoria_id || null,
      fornecedor_id: form.fornecedor_id || null,
      obra_id: obraId,
      observacoes: form.observacoes || null,
      status: "pendente",
      origem: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Conta criada");
    setOpen(false);
    setForm({
      descricao: "",
      valor: "",
      vencimento: new Date().toISOString().slice(0, 10),
      categoria_id: "",
      fornecedor_id: "",
      observacoes: "",
    });
    void carregar();
  };

  const pagar = async () => {
    if (!paying) return;
    if (!pagto.conta_bancaria_id) return toast.error("Selecione a conta bancária");
    const { error } = await supabase
      .from("contas_pagar")
      .update({
        status: "pago",
        pago_em: pagto.data,
        valor_pago: paying.valor,
        conta_bancaria_id: pagto.conta_bancaria_id,
      })
      .eq("id", paying.id);
    if (error) return toast.error(error.message);
    toast.success("Conta paga");
    setPaying(null);
    void carregar();
  };

  const estornarBaixa = async () => {
    if (!estornando) return;
    if (!motivoEstorno.trim()) return toast.error("Informe o motivo");
    const token = crypto.randomUUID();
    const { data: lancs } = await supabase
      .from("lancamentos").select("*")
      .eq("conta_pagar_id", estornando.id).eq("estornado", false);
    for (const l of lancs ?? []) {
      await supabase.from("lancamentos").update({ estornado: true, estorno_token: token }).eq("id", l.id);
      await supabase.from("lancamentos").insert({
        customer_id: l.customer_id,
        conta_bancaria_id: l.conta_bancaria_id,
        obra_id: l.obra_id ?? obraId,
        tipo: "entrada",
        valor: l.valor,
        data: new Date().toISOString().slice(0, 10),
        descricao: `ESTORNO: ${l.descricao} - ${motivoEstorno}`,
        estorno_token: token,
        created_by: user!.id,
      });
      const { data: c } = await supabase.from("contas_bancarias")
        .select("saldo_atual").eq("id", l.conta_bancaria_id).maybeSingle();
      if (c) {
        await supabase.from("contas_bancarias")
          .update({ saldo_atual: Number(c.saldo_atual) + Number(l.valor) })
          .eq("id", l.conta_bancaria_id);
      }
    }
    const { error } = await supabase.from("contas_pagar").update({
      status: "pendente",
      pago_em: null,
      valor_pago: 0,
      conta_bancaria_id: null,
      estornado: true,
      estorno_token: token,
      estornado_em: new Date().toISOString(),
      estornado_por: user!.id,
      motivo_estorno: motivoEstorno,
    } as any).eq("id", estornando.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Pagamento estornado — conta voltou a pendente");
    setEstornando(null); setMotivoEstorno(""); void carregar();
  };

  const excluir = async (cp: CP) => {
    if (cp.status !== "pendente") return toast.error("Só é possível excluir contas pendentes");
    if (!confirm(`Excluir a conta "${cp.descricao}"?`)) return;
    const { error } = await supabase.from("contas_pagar").delete().eq("id", cp.id);
    if (error) return toast.error(error.message);
    toast.success("Conta excluída"); void carregar();
  };

  const fmtBR = (ymd: string) => { const [y,m,d]=ymd.slice(0,10).split("-"); return `${d}/${m}/${y}`; };


  const filtrados = items.filter((i) => filtro === "todos" || i.status === filtro);
  const total = filtrados.reduce((s, i) => s + Number(i.valor || 0), 0);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fornName = (id: string | null) =>
    id ? fornec.find((f) => f.id === id)?.nome ?? "—" : "—";

  return (
    <div>
      <PageHeader
        title="Contas a pagar"
        info="Lista todas as parcelas geradas pelas compras da obra, além de contas cadastradas manualmente. Você pode marcar como paga, editar valores e vincular meio de pagamento (conta bancária ou cartão)."
        description="Contas a pagar vinculadas a esta obra"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova conta a pagar</DialogTitle>
              </DialogHeader>
              <form onSubmit={criar} className="space-y-3">
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input
                    required
                    value={form.descricao}
                    onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input
                      required
                      type="number"
                      step="0.01"
                      value={form.valor}
                      onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento *</Label>
                    <Input
                      required
                      type="date"
                      value={form.vencimento}
                      onChange={(e) => setForm((p) => ({ ...p, vencimento: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Select
                    value={form.fornecedor_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, fornecedor_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornec.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={form.categoria_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, categoria_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    rows={2}
                    value={form.observacoes}
                    onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-3 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(["pendente", "pago", "todos"] as const).map((f) => (
              <Button
                key={f}
                variant={filtro === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltro(f)}
              >
                {f === "todos" ? "Todos" : f === "pago" ? "Pagos" : "Pendentes"}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-semibold">{brl(total)}</span>
          </p>
        </div>

        {filtrados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-8 w-8 opacity-50" /> Nenhuma conta nesse filtro.
            </CardContent>
          </Card>
        ) : (
          filtrados.map((cp) => (
            <Card key={cp.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{cp.descricao}</p>
                    <Badge
                      variant={
                        cp.status === "pago"
                          ? "default"
                          : cp.status === "cancelado"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {cp.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fornName(cp.fornecedor_id)} • venc. {fmtBR(cp.vencimento)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{brl(Number(cp.valor))}</span>
                  {cp.status === "pendente" && (
                    <>
                      <Button size="sm" onClick={() => setPaying(cp)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Pagar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(cp)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>

              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar baixa em {paying?.descricao}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Conta bancária *</Label>
              <Select
                value={pagto.conta_bancaria_id}
                onValueChange={(v) => setPagto((p) => ({ ...p, conta_bancaria_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={pagto.data}
                onChange={(e) => setPagto((p) => ({ ...p, data: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={pagar}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
