import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Receipt } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/faturas-cartao")({
  component: FaturasCartaoPage,
});

type Fatura = {
  id: string;
  cartao_id: string;
  competencia: string;
  dt_fechamento: string;
  dt_vencimento: string;
  valor_total: number;
  valor_pago: number | null;
  status: string;
};

type Cartao = { id: string; nome: string; ultimos_4: string | null };

const statusVariant = (s: string) =>
  s === "paga" ? "default" : s === "fechada" ? "secondary" : "outline";

const statusLabel = (s: string) =>
  s === "paga" ? "Paga" : s === "fechada" ? "Fechada" : "Aberta";

function FaturasCartaoPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cpByFatura, setCpByFatura] = useState<Record<string, string>>({});
  const [filtroCartao, setFiltroCartao] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const carregar = async () => {
    const [{ data: fs }, { data: cs }] = await Promise.all([
      supabase.from("faturas_cartao").select("*").order("dt_vencimento", { ascending: false }),
      supabase.from("cartoes").select("id,nome,ultimos_4").eq("ativo", true).order("nome"),
    ]);
    setFaturas((fs ?? []) as Fatura[]);
    setCartoes((cs ?? []) as Cartao[]);
    const ids = (fs ?? []).map((f: any) => f.id);
    if (ids.length) {
      const { data: cps } = await supabase
        .from("contas_pagar")
        .select("id,fatura_cartao_id")
        .in("fatura_cartao_id", ids);
      const map: Record<string, string> = {};
      (cps ?? []).forEach((c: any) => { if (c.fatura_cartao_id) map[c.fatura_cartao_id] = c.id; });
      setCpByFatura(map);
    }
  };
  useEffect(() => { void carregar(); }, []);

  const fechar = async (f: Fatura) => {
    const { error } = await supabase
      .from("faturas_cartao")
      .update({ status: "fechada" })
      .eq("id", f.id);
    if (error) return toast.error("Erro", { description: error.message });
    toast.success("Fatura fechada — conta a pagar gerada");
    void carregar();
  };

  const nomeCartao = (id: string) => {
    const c = cartoes.find((x) => x.id === id);
    if (!c) return "Cartão";
    return c.ultimos_4 ? `${c.nome} •••• ${c.ultimos_4}` : c.nome;
  };

  const filtradas = faturas.filter((f) =>
    (filtroCartao === "todos" || f.cartao_id === filtroCartao) &&
    (filtroStatus === "todos" || f.status === filtroStatus)
  );

  return (
    <div>
      <PageHeader
        title="Faturas de cartão"
        info="Faturas fechadas de cada cartão, com detalhamento das compras. Registre o pagamento da fatura para dar baixa em todas as parcelas."
        description="Faturas geradas automaticamente a partir das compras no cartão"
      />
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap gap-3">
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cartões</SelectItem>
              {cartoes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{nomeCartao(c.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="fechada">Fechada</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtradas.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma fatura encontrada. Lance uma compra no cartão para gerar automaticamente.
          </CardContent></Card>
        ) : filtradas.map((f) => {
          const cpId = cpByFatura[f.id];
          return (
            <Card key={f.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {nomeCartao(f.cartao_id)} · {f.competencia}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fechamento {new Date(f.dt_fechamento).toLocaleDateString("pt-BR")} ·
                      Vence {new Date(f.dt_vencimento).toLocaleDateString("pt-BR")} ·
                      Total R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(f.status) as any}>{statusLabel(f.status)}</Badge>
                  {cpId && (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/app/contas-pagar"><Receipt className="mr-2 h-4 w-4" /> Ver conta</Link>
                    </Button>
                  )}
                  {f.status === "aberta" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm"><CheckCircle2 className="mr-2 h-4 w-4" /> Fechar fatura</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Fechar fatura?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ao fechar, será criada uma conta a pagar com vencimento em{" "}
                            {new Date(f.dt_vencimento).toLocaleDateString("pt-BR")}.
                            Pague essa conta normalmente em Contas a pagar para debitar do banco.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => fechar(f)}>Fechar fatura</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
