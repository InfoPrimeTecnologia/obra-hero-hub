import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat, Building2, ListTree, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useObraSelecionada } from "@/lib/obra-context";

export const Route = createFileRoute("/app/")({
  component: ClienteDashboard,
});

type Metrics = {
  totalEmpresas: number;
  totalObras: number;
  obrasAtivas: number;
  rdosMes: number;
};

function ClienteDashboard() {
  const { obra } = useObraSelecionada();
  const [m, setM] = useState<Metrics>({
    totalEmpresas: 0,
    totalObras: 0,
    obrasAtivas: 0,
    rdosMes: 0,
  });

  useEffect(() => {
    (async () => {
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const [
        { count: empresas },
        { count: total },
        { count: ativas },
        { count: rdos },
      ] = await Promise.all([
        supabase.from("empresas").select("*", { count: "exact", head: true }),
        supabase.from("obras").select("*", { count: "exact", head: true }),
        supabase.from("obras").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("rdos")
          .select("*", { count: "exact", head: true })
          .gte("data", inicioMes),
      ]);
      setM({
        totalEmpresas: empresas ?? 0,
        totalObras: total ?? 0,
        obrasAtivas: ativas ?? 0,
        rdosMes: rdos ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Empresas", value: m.totalEmpresas.toString(), icon: Building2 },
    { label: "Obras ativas", value: `${m.obrasAtivas} / ${m.totalObras}`, icon: HardHat },
    { label: "Diários no mês", value: m.diariosMes.toString(), icon: ClipboardList },
    { label: "Obra selecionada", value: obra?.name ?? "Nenhuma", icon: ListTree },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral das suas obras" />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {c.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold truncate">{c.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Próximos passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              1. Cadastre suas <strong>empresas</strong>. 2. Crie as <strong>obras</strong>{" "}
              vinculadas. 3. Estruture o <strong>orçamento</strong> por etapas e subetapas.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/app/empresas">Empresas</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/obras">Obras</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
