import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/obras/$obraId/faturas")({
  component: FaturasObraPage,
});

type Fatura = {
  id: string;
  cartao_id: string;
  status: string;
  valor_total: number;
  dt_vencimento: string | null;
  competencia: string | null;
};
type Cartao = { id: string; nome: string };

function FaturasObraPage() {
  const { obraId } = Route.useParams();
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: comp } = await supabase
        .from("compras")
        .select("cartao_id")
        .eq("obra_id", obraId)
        .not("cartao_id", "is", null);
      const cartaoIds = Array.from(new Set((comp ?? []).map((c: any) => c.cartao_id))).filter(Boolean);
      if (cartaoIds.length === 0) {
        setFaturas([]);
        setCartoes([]);
        return;
      }
      const [{ data: f }, { data: c }] = await Promise.all([
        supabase
          .from("faturas_cartao")
          .select("id,cartao_id,status,valor_total,dt_vencimento,competencia")
          .in("cartao_id", cartaoIds)
          .order("dt_vencimento", { ascending: false }),
        supabase.from("cartoes").select("id,nome").in("id", cartaoIds),
      ]);
      setFaturas((f as Fatura[]) ?? []);
      setCartoes((c as Cartao[]) ?? []);
    })();
  }, [obraId]);

  const cartaoNome = (id: string) => cartoes.find((c) => c.id === id)?.nome ?? "—";
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title="Faturas de cartão"
        info="Faturas dos cartões usados nesta obra, com detalhamento das compras que compõem cada fatura."
        description="Faturas dos cartões usados em compras desta obra"
        actions={
          <Button asChild variant="outline">
            <Link to="/app/faturas-cartao">
              <ExternalLink className="mr-2 h-4 w-4" /> Ver todas
            </Link>
          </Button>
        }
      />
      <div className="space-y-3 p-8">
        {faturas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Esta obra ainda não tem compras feitas em cartão.
            </CardContent>
          </Card>
        ) : (
          faturas.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{cartaoNome(f.cartao_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.competencia ?? "—"}
                    {f.dt_vencimento
                      ? ` • venc. ${new Date(f.dt_vencimento).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={f.status === "paga" ? "default" : "outline"}>{f.status}</Badge>
                  <span className="font-semibold tabular-nums">{brl(Number(f.valor_total))}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
