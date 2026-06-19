import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/obras/$obraId/relatorios/pagamentos")({
  component: RelPagamentos,
});

type CP = {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number | null;
  vencimento: string;
  pago_em: string | null;
  status: string;
  fornecedor_id: string | null;
};

function RelPagamentos() {
  const { obraId } = Route.useParams();
  const hoje = new Date().toISOString().slice(0, 10);
  const ini = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)
    .toISOString()
    .slice(0, 10);
  const [de, setDe] = useState(ini);
  const [ate, setAte] = useState(hoje);
  const [items, setItems] = useState<CP[]>([]);
  const [fornec, setFornec] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("contas_pagar")
        .select("id,descricao,valor,valor_pago,vencimento,pago_em,status,fornecedor_id")
        .eq("obra_id", obraId)
        .gte("vencimento", de)
        .lte("vencimento", ate)
        .order("vencimento", { ascending: false });
      setItems((data as CP[]) ?? []);
      const ids = Array.from(new Set((data ?? []).map((c: any) => c.fornecedor_id).filter(Boolean)));
      if (ids.length) {
        const { data: f } = await supabase.from("fornecedores").select("id,nome").in("id", ids);
        const map: Record<string, string> = {};
        (f ?? []).forEach((x: any) => (map[x.id] = x.nome));
        setFornec(map);
      }
    })();
  }, [obraId, de, ate]);

  const pago = items
    .filter((i) => i.status === "pago")
    .reduce((s, i) => s + Number(i.valor_pago ?? i.valor), 0);
  const pendente = items
    .filter((i) => i.status === "pendente")
    .reduce((s, i) => s + Number(i.valor), 0);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <PageHeader
        title="Relatório de pagamentos"
        description="Contas a pagar e pagamentos da obra"
      />
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
              <div className="flex items-center gap-2 text-emerald-600">
                <FileBarChart2 className="h-4 w-4" /> <span className="text-xs">Pago</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(pago)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <FileBarChart2 className="h-4 w-4" /> <span className="text-xs">Pendente</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(pendente)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground">Total</span>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(pago + pendente)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Lançamentos</h3>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta no período.</p>
            ) : (
              <div className="space-y-1">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b py-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          c.status === "pago"
                            ? "default"
                            : c.status === "cancelado"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {c.status}
                      </Badge>
                      <span>{new Date(c.vencimento).toLocaleDateString("pt-BR")}</span>
                      <span className="text-muted-foreground">
                        {c.descricao} •{" "}
                        {c.fornecedor_id ? fornec[c.fornecedor_id] ?? "—" : "—"}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {brl(Number(c.valor_pago ?? c.valor))}
                    </span>
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
