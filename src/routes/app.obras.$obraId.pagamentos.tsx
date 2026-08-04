import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Wallet, CreditCard, Banknote, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/obras/$obraId/pagamentos")({
  component: PagamentosObraPage,
});

type Cartao = {
  id: string;
  nome: string;
  bandeira: string | null;
  ultimos_4: string | null;
  limite: number | null;
  dia_fechamento: number;
  dia_vencimento: number;
  obra_id: string | null;
};
type Conta = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string;
  saldo_atual: number | null;
  saldo_inicial: number | null;
  obra_id: string | null;
};

const cartaoInicial = {
  nome: "", bandeira: "", ultimos_4: "", limite: "0",
  dia_fechamento: "1", dia_vencimento: "10",
};
const contaInicial = {
  nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0",
};

function PagamentosObraPage() {
  const { obraId } = Route.useParams();
  const { user } = useAuth();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [usoCartoes, setUsoCartoes] = useState<Record<string, { qtd: number; total: number }>>({});
  const [usoContas, setUsoContas] = useState<Record<string, { qtd: number; total: number }>>({});

  const [openCartao, setOpenCartao] = useState(false);
  const [editCartao, setEditCartao] = useState<Cartao | null>(null);
  const [formCartao, setFormCartao] = useState(cartaoInicial);

  const [openConta, setOpenConta] = useState(false);
  const [editConta, setEditConta] = useState<Conta | null>(null);
  const [formConta, setFormConta] = useState(contaInicial);
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    const [{ data: c }, { data: cb }, { data: comp }, { data: lanc }] = await Promise.all([
      supabase.from("cartoes").select("*").eq("ativo", true)
        .or(`obra_id.is.null,obra_id.eq.${obraId}`).order("nome"),
      supabase.from("contas_bancarias").select("*").eq("ativo", true)
        .or(`obra_id.is.null,obra_id.eq.${obraId}`).order("nome"),
      supabase.from("compras").select("cartao_id,valor_total").eq("obra_id", obraId),
      supabase.from("lancamentos").select("conta_bancaria_id,valor,tipo").eq("obra_id", obraId),
    ]);
    setCartoes((c as Cartao[]) ?? []);
    setContas((cb as Conta[]) ?? []);

    const uc: Record<string, { qtd: number; total: number }> = {};
    (comp ?? []).forEach((r: any) => {
      if (!r.cartao_id) return;
      uc[r.cartao_id] = uc[r.cartao_id] ?? { qtd: 0, total: 0 };
      uc[r.cartao_id].qtd += 1;
      uc[r.cartao_id].total += Number(r.valor_total ?? 0);
    });
    setUsoCartoes(uc);

    const ub: Record<string, { qtd: number; total: number }> = {};
    (lanc ?? []).forEach((r: any) => {
      if (!r.conta_bancaria_id) return;
      ub[r.conta_bancaria_id] = ub[r.conta_bancaria_id] ?? { qtd: 0, total: 0 };
      ub[r.conta_bancaria_id].qtd += 1;
      ub[r.conta_bancaria_id].total += Number(r.valor ?? 0) * (r.tipo === "entrada" ? 1 : -1);
    });
    setUsoContas(ub);
  };

  useEffect(() => { void carregar(); }, [obraId]);

  const getCustomerId = async () => {
    const { data } = await supabase
      .from("customers").select("id").eq("owner_user_id", user!.id).maybeSingle();
    return data?.id ?? null;
  };

  const salvarCartao = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: formCartao.nome,
      bandeira: formCartao.bandeira || null,
      ultimos_4: formCartao.ultimos_4 || null,
      limite: Number(formCartao.limite || 0),
      dia_fechamento: Number(formCartao.dia_fechamento),
      dia_vencimento: Number(formCartao.dia_vencimento),
      obra_id: obraId,
    };
    if (editCartao) {
      const { error } = await supabase.from("cartoes").update(payload).eq("id", editCartao.id);
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Cartão atualizado");
    } else {
      const customerId = await getCustomerId();
      if (!customerId) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("cartoes")
        .insert({ ...payload, customer_id: customerId, created_by: user!.id });
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Cartão cadastrado nesta obra");
    }
    setOpenCartao(false); setEditCartao(null); setFormCartao(cartaoInicial); void carregar();
  };

  const salvarConta = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saldo = Number(formConta.saldo_inicial || 0);
    const payload = {
      nome: formConta.nome,
      banco: formConta.banco || null,
      agencia: formConta.agencia || null,
      conta: formConta.conta || null,
      tipo: formConta.tipo,
      saldo_inicial: saldo,
      obra_id: obraId,
    };
    if (editConta) {
      const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", editConta.id);
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Conta atualizada");
    } else {
      const customerId = await getCustomerId();
      if (!customerId) { setSaving(false); return toast.error("Conta não identificada"); }
      const { error } = await supabase.from("contas_bancarias")
        .insert({ ...payload, saldo_atual: saldo, customer_id: customerId, created_by: user!.id });
      setSaving(false);
      if (error) return toast.error("Erro", { description: error.message });
      toast.success("Conta cadastrada nesta obra");
    }
    setOpenConta(false); setEditConta(null); setFormConta(contaInicial); void carregar();
  };

  const removerCartao = async (id: string) => {
    const { error } = await supabase.from("cartoes").update({ ativo: false }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Cartão removido"); void carregar();
  };

  const removerConta = async (id: string) => {
    const { error } = await supabase.from("contas_bancarias").update({ ativo: false }).eq("id", id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Conta removida"); void carregar();
  };

  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title="Meio de pagamentos"
        info="Cadastre cartões e contas bancárias exclusivos desta obra. Os meios globais da empresa também aparecem aqui, mas só podem ser editados no financeiro da empresa."
        description="Cartões e contas bancárias desta obra"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditCartao(null); setFormCartao(cartaoInicial); setOpenCartao(true); }}
            >
              <Plus className="mr-2 h-4 w-4" /> Cartão da obra
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditConta(null); setFormConta(contaInicial); setOpenConta(true); }}
            >
              <Plus className="mr-2 h-4 w-4" /> Conta da obra
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-8">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="h-4 w-4" /> Cartões
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {cartoes.map((c) => {
              const u = usoCartoes[c.id] ?? { qtd: 0, total: 0 };
              const daObra = c.obra_id === obraId;
              return (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          {c.nome}
                          {daObra ? (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Desta obra
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              Global
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[c.bandeira, c.ultimos_4 ? `•••• ${c.ultimos_4}` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.qtd > 0 ? "default" : "outline"}>{u.qtd} compras</Badge>
                        {daObra ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditCartao(c);
                                setFormCartao({
                                  nome: c.nome,
                                  bandeira: c.bandeira ?? "",
                                  ultimos_4: c.ultimos_4 ?? "",
                                  limite: String(c.limite ?? 0),
                                  dia_fechamento: String(c.dia_fechamento ?? 1),
                                  dia_vencimento: String(c.dia_vencimento ?? 10),
                                });
                                setOpenCartao(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => void removerCartao(c.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-lg font-semibold tabular-nums">{brl(u.total)}</p>
                  </CardContent>
                </Card>
              );
            })}
            {cartoes.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum cartão disponível.
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Banknote className="h-4 w-4" /> Contas bancárias / caixa
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {contas.map((c) => {
              const u = usoContas[c.id] ?? { qtd: 0, total: 0 };
              const daObra = c.obra_id === obraId;
              return (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          {c.nome}
                          {daObra ? (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Desta obra
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              Global
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[c.banco, c.agencia, c.conta].filter(Boolean).join(" · ") || c.tipo}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.qtd > 0 ? "default" : "outline"}>{u.qtd} lançamentos</Badge>
                        {daObra ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditConta(c);
                                setFormConta({
                                  nome: c.nome,
                                  banco: c.banco ?? "",
                                  agencia: c.agencia ?? "",
                                  conta: c.conta ?? "",
                                  tipo: c.tipo ?? "corrente",
                                  saldo_inicial: String(c.saldo_inicial ?? 0),
                                });
                                setOpenConta(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => void removerConta(c.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <p
                      className={`mt-2 text-lg font-semibold tabular-nums ${
                        u.total >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {brl(u.total)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
            {contas.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conta disponível.
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            Os valores acima consideram apenas movimentações vinculadas a esta obra.
          </CardContent>
        </Card>
      </div>

      <Dialog open={openCartao} onOpenChange={(v) => { setOpenCartao(v); if (!v) { setEditCartao(null); setFormCartao(cartaoInicial); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCartao ? "Editar cartão da obra" : "Novo cartão desta obra"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarCartao} className="space-y-3">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input required value={formCartao.nome}
                onChange={(e) => setFormCartao({ ...formCartao, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bandeira</Label>
                <Input value={formCartao.bandeira}
                  onChange={(e) => setFormCartao({ ...formCartao, bandeira: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Últimos 4 dígitos</Label>
                <Input maxLength={4} value={formCartao.ultimos_4}
                  onChange={(e) => setFormCartao({ ...formCartao, ultimos_4: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Limite</Label>
                <Input type="number" step="0.01" value={formCartao.limite}
                  onChange={(e) => setFormCartao({ ...formCartao, limite: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fechamento</Label>
                <Input type="number" min={1} max={31} value={formCartao.dia_fechamento}
                  onChange={(e) => setFormCartao({ ...formCartao, dia_fechamento: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="number" min={1} max={31} value={formCartao.dia_vencimento}
                  onChange={(e) => setFormCartao({ ...formCartao, dia_vencimento: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openConta} onOpenChange={(v) => { setOpenConta(v); if (!v) { setEditConta(null); setFormConta(contaInicial); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editConta ? "Editar conta da obra" : "Nova conta desta obra"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarConta} className="space-y-3">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input required value={formConta.nome}
                onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input value={formConta.banco}
                  onChange={(e) => setFormConta({ ...formConta, banco: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formConta.tipo} onValueChange={(v) => setFormConta({ ...formConta, tipo: v })}>
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
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input value={formConta.agencia}
                  onChange={(e) => setFormConta({ ...formConta, agencia: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input value={formConta.conta}
                  onChange={(e) => setFormConta({ ...formConta, conta: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Saldo inicial</Label>
              <Input type="number" step="0.01" value={formConta.saldo_inicial}
                disabled={!!editConta}
                onChange={(e) => setFormConta({ ...formConta, saldo_inicial: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
