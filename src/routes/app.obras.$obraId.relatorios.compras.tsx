import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/obras/$obraId/relatorios/compras")({
  component: RelCompras,
});

type Compra = {
  id: string;
  data_compra: string;
  descricao: string | null;
  valor_total: number;
  status: string;
  forma_pagamento: string;
  fornecedor_id: string | null;
};

function RelCompras() {
  const { obraId } = Route.useParams();
  const hoje = new Date().toISOString().slice(0, 10);
  const ini = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)
    .toISOString()
    .slice(0, 10);
  const [de, setDe] = useState(ini);
  const [ate, setAte] = useState(hoje);
  const [items, setItems] = useState<Compra[]>([]);
  const [fornec, setFornec] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("compras")
        .select("id,data_compra,descricao,valor_total,status,forma_pagamento,fornecedor_id")
        .eq("obra_id", obraId)
        .gte("data_compra", de)
        .lte("data_compra", ate)
        .order("data_compra", { ascending: false });
      setItems((data as Compra[]) ?? []);
      const ids = Array.from(new Set((data ?? []).map((c: any) => c.fornecedor_id).filter(Boolean)));
      if (ids.length > 0) {
        const { data: f } = await supabase.from("fornecedores").select("id,nome").in("id", ids);
        const map: Record<string, string> = {};
        (f ?? []).forEach((x: any) => (map[x.id] = x.nome));
        setFornec(map);
      }
    })();
  }, [obraId, de, ate]);

  const total = items.reduce((s, c) => s + Number(c.valor_total || 0), 0);
  const porForma = items.reduce<Record<string, number>>((acc, c) => {
    acc[c.forma_pagamento] = (acc[c.forma_pagamento] ?? 0) + Number(c.valor_total || 0);
    return acc;
  }, {});
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader title="Relatório de compras" description="Compras desta obra no período" />
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileBarChart2 className="h-4 w-4" /> <span className="text-xs">Total</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground">Qtd. compras</span>
              <p className="mt-1 text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground">Ticket médio</span>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {brl(items.length ? total / items.length : 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Por forma de pagamento</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.entries(porForma).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1 text-sm">
                  <span className="capitalize">{k}</span>
                  <span className="font-semibold tabular-nums">{brl(v)}</span>
                </div>
              ))}
              {Object.keys(porForma).length === 0 && (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Detalhamento</h3>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma compra no período.</p>
            ) : (
              <div className="space-y-1">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b py-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{new Date(c.data_compra).toLocaleDateString("pt-BR")}</span>
                      <span className="text-muted-foreground">
                        {c.descricao ?? "—"} • {c.fornecedor_id ? fornec[c.fornecedor_id] ?? "—" : "—"}
                      </span>
                      <Badge variant="outline" className="capitalize">
                        {c.forma_pagamento}
                      </Badge>
                    </div>
                    <span className="font-semibold tabular-nums">{brl(Number(c.valor_total))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
