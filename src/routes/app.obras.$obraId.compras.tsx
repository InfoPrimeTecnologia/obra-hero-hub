import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, ArrowLeft, ShoppingCart, Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/compras")({
  component: ComprasPage,
});

type Compra = {
  id: string;
  numero: string | null;
  descricao: string | null;
  forma_pagamento: string;
  valor_total: number;
  data_compra: string;
  status: string;
  qtd_parcelas: number;
  fornecedor_id: string | null;
  cartao_id: string | null;
};
type Fornecedor = { id: string; nome: string };
type Cartao = { id: string; nome: string };

const formaLabels: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", boleto: "Boleto",
  cartao: "Cartão", transferencia: "Transferência",
};

function ComprasPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Compra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fornecedor_id: "",
    descricao: "",
    forma_pagamento: "dinheiro",
    cartao_id: "",
    qtd_parcelas: "1",
    data_compra: new Date().toISOString().slice(0, 10),
    data_primeira_parcela: new Date().toISOString().slice(0, 10),
  });

  const carregar = async () => {
    const [{ data: cs }, { data: fs }, { data: ks }] = await Promise.all([
      supabase.from("compras").select("*").eq("obra_id", obraId).order("data_compra", { ascending: false }),
      supabase.from("fornecedores").select("id,nome").eq("ativo", true).order("nome"),
      supabase.from("cartoes").select("id,nome").eq("ativo", true).order("nome"),
    ]);
    setItems((cs ?? []) as Compra[]);
    setFornecedores((fs ?? []) as Fornecedor[]);
    setCartoes((ks ?? []) as Cartao[]);
  };

  useEffect(() => { void carregar(); }, [obraId]);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: customer } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    if (!customer) { setSaving(false); return toast.error("Conta não identificada"); }
    const { data, error } = await supabase.from("compras").insert({
      customer_id: customer.id,
      obra_id: obraId,
      fornecedor_id: form.fornecedor_id || null,
      descricao: form.descricao || null,
      forma_pagamento: form.forma_pagamento,
      cartao_id: form.forma_pagamento === "cartao" ? (form.cartao_id || null) : null,
      qtd_parcelas: Number(form.qtd_parcelas) || 1,
      data_compra: form.data_compra,
      data_primeira_parcela: form.data_primeira_parcela,
      created_by: user!.id,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Compra criada. Adicione itens.");
    setOpen(false);
    navigate({ to: "/app/obras/$obraId/compras/$compraId", params: { obraId, compraId: data!.id } });
  };

  return (
    <div>
      <PageHeader
        title="Compras"
        description="Pedidos de compra desta obra"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/obras"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Nova compra</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova compra</DialogTitle></DialogHeader>
                <form onSubmit={criar} className="space-y-3">
                  <div className="space-y-2"><Label>Fornecedor</Label>
                    <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                      <SelectContent>{fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Descrição</Label>
                    <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Forma de pagamento *</Label>
                      <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(formaLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Parcelas *</Label>
                      <Input type="number" min={1} required value={form.qtd_parcelas}
                        onChange={(e) => setForm({ ...form, qtd_parcelas: e.target.value })} />
                    </div>
                  </div>
                  {form.forma_pagamento === "cartao" && (
                    <div className="space-y-2"><Label>Cartão *</Label>
                      <Select value={form.cartao_id} onValueChange={(v) => setForm({ ...form, cartao_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Data da compra *</Label>
                      <Input type="date" required value={form.data_compra}
                        onChange={(e) => setForm({ ...form, data_compra: e.target.value })} /></div>
                    <div className="space-y-2"><Label>1ª parcela *</Label>
                      <Input type="date" required value={form.data_primeira_parcela}
                        onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="space-y-3 p-8">
        {items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma compra registrada.
          </CardContent></Card>
        ) : items.map((c) => {
          const f = fornecedores.find((x) => x.id === c.fornecedor_id);
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {c.descricao || "Compra"} {c.numero && <span className="text-muted-foreground">#{c.numero}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.data_compra).toLocaleDateString("pt-BR")} ·
                      {f ? ` ${f.nome} · ` : " "}{formaLabels[c.forma_pagamento]} · {c.qtd_parcelas}x ·
                      {" "}R$ {Number(c.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "recebida" ? "default" : "secondary"}>{c.status}</Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/obras/$obraId/compras/$compraId" params={{ obraId, compraId: c.id }}>
                      <Eye className="mr-2 h-4 w-4" /> Abrir
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
