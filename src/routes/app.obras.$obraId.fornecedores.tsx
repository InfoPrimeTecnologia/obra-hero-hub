import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Truck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/obras/$obraId/fornecedores")({
  component: FornObraPage,
});

type Row = {
  fornecedor_id: string;
  nome: string;
  total_compras: number;
  qtd_compras: number;
  telefone: string | null;
  email: string | null;
};

function FornObraPage() {
  const { obraId } = Route.useParams();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("compras")
        .select("fornecedor_id,valor_total,fornecedores(nome,telefone,email)")
        .eq("obra_id", obraId);
      const map = new Map<string, Row>();
      (data ?? []).forEach((c: any) => {
        if (!c.fornecedor_id) return;
        const k = c.fornecedor_id;
        const cur = map.get(k) ?? {
          fornecedor_id: k,
          nome: c.fornecedores?.nome ?? "—",
          telefone: c.fornecedores?.telefone ?? null,
          email: c.fornecedores?.email ?? null,
          total_compras: 0,
          qtd_compras: 0,
        };
        cur.total_compras += Number(c.valor_total ?? 0);
        cur.qtd_compras += 1;
        map.set(k, cur);
      });
      setRows(Array.from(map.values()).sort((a, b) => b.total_compras - a.total_compras));
    })();
  }, [obraId]);

  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title="Fornecedores da obra"
        info="Fornecedores vinculados especificamente a esta obra. Você pode cadastrar um novo fornecedor aqui ou vincular um já existente do cadastro global."
        description="Fornecedores com compras vinculadas a esta obra"
        actions={
          <Button asChild variant="outline">
            <Link to="/app/fornecedores">
              <ExternalLink className="mr-2 h-4 w-4" /> Cadastro global
            </Link>
          </Button>
        }
      />
      <div className="space-y-3 p-8">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Nenhum fornecedor com compras nesta obra ainda.
            </CardContent>
          </Card>
        ) : (
          rows.map((r) => (
            <Card key={r.fornecedor_id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.telefone, r.email].filter(Boolean).join(" • ") || "Sem contato cadastrado"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{r.qtd_compras} compras</Badge>
                  <span className="font-semibold tabular-nums">{brl(r.total_compras)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
