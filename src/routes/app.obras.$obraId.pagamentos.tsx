import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, CreditCard, Banknote, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/obras/$obraId/pagamentos")({
  component: PagamentosObraPage,
});

type Cartao = { id: string; nome: string; bandeira: string | null; limite: number | null };
type Conta = { id: string; nome: string; tipo: string | null; saldo_atual: number | null };

function PagamentosObraPage() {
  const { obraId } = Route.useParams();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [usoCartoes, setUsoCartoes] = useState<Record<string, { qtd: number; total: number }>>({});
  const [usoContas, setUsoContas] = useState<Record<string, { qtd: number; total: number }>>({});

  useEffect(() => {
    void (async () => {
      const [{ data: c }, { data: cb }, { data: comp }, { data: lanc }] = await Promise.all([
        supabase.from("cartoes").select("id,nome,bandeira,limite").eq("ativo", true),
        supabase.from("contas_bancarias").select("id,nome,tipo,saldo_atual").eq("ativo", true),
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
    })();
  }, [obraId]);

  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title="Meio de pagamentos"
        info="Cartões e contas bancárias movimentados por esta obra, com totais gastos/recebidos em cada meio."
        description="Cartões e contas bancárias movimentados por esta obra"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/cartoes">
                <ExternalLink className="mr-2 h-4 w-4" /> Cartões
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/contas-bancarias">
                <ExternalLink className="mr-2 h-4 w-4" /> Contas
              </Link>
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
              return (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.bandeira ?? "—"}</p>
                      </div>
                      <Badge variant={u.qtd > 0 ? "default" : "outline"}>
                        {u.qtd} compras
                      </Badge>
                    </div>
                    <p className="mt-2 text-lg font-semibold tabular-nums">{brl(u.total)}</p>
                  </CardContent>
                </Card>
              );
            })}
            {cartoes.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum cartão cadastrado.
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
              return (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.tipo ?? "—"}</p>
                      </div>
                      <Badge variant={u.qtd > 0 ? "default" : "outline"}>
                        {u.qtd} lançamentos
                      </Badge>
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
                  Nenhuma conta cadastrada.
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
    </div>
  );
}
