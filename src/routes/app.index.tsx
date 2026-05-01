import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat, ClipboardList, Camera } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useObraSelecionada } from "@/lib/obra-context";

export const Route = createFileRoute("/app/")({
  component: ClienteDashboard,
});

type Metrics = {
  totalObras: number;
  obrasAtivas: number;
  diariosMes: number;
};

function ClienteDashboard() {
  const { obra } = useObraSelecionada();
  const [m, setM] = useState<Metrics>({ totalObras: 0, obrasAtivas: 0, diariosMes: 0 });

  useEffect(() => {
    (async () => {
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const [{ count: total }, { count: ativas }, { count: diarios }] = await Promise.all([
        supabase.from("obras").select("*", { count: "exact", head: true }),
        supabase.from("obras").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("obra_diarios")
          .select("*", { count: "exact", head: true })
          .gte("diary_date", inicioMes),
      ]);
      setM({
        totalObras: total ?? 0,
        obrasAtivas: ativas ?? 0,
        diariosMes: diarios ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Obras ativas", value: `${m.obrasAtivas} / ${m.totalObras}`, icon: HardHat },
    { label: "Diários no mês", value: m.diariosMes.toString(), icon: ClipboardList },
    { label: "Obra selecionada", value: obra?.name ?? "Nenhuma", icon: Camera },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral das suas obras" />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
            <p>Cadastre suas obras e abra a obra ativa para registrar o diário com fotos.</p>
            <Button asChild>
              <Link to="/app/obras">Ir para Obras</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
