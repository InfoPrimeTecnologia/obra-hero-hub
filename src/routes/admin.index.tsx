import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Receipt, AlertCircle, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

type Metrics = {
  totalCustomers: number;
  activeCustomers: number;
  overdueInvoices: number;
  monthRevenue: number;
};

function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalCustomers: 0,
    activeCustomers: 0,
    overdueInvoices: 0,
    monthRevenue: 0,
  });

  useEffect(() => {
    (async () => {
      const [{ count: total }, { count: active }, { count: overdue }, { data: paid }] =
        await Promise.all([
          supabase.from("customers").select("*", { count: "exact", head: true }),
          supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("invoices")
            .select("*", { count: "exact", head: true })
            .eq("status", "overdue"),
          supabase
            .from("invoices")
            .select("amount")
            .eq("status", "paid")
            .gte("paid_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        ]);

      setMetrics({
        totalCustomers: total ?? 0,
        activeCustomers: active ?? 0,
        overdueInvoices: overdue ?? 0,
        monthRevenue: (paid ?? []).reduce((s, i) => s + Number(i.amount), 0),
      });
    })();
  }, []);

  const cards = [
    {
      label: "Receita do mês",
      value: metrics.monthRevenue.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      icon: TrendingUp,
      tone: "text-accent",
    },
    {
      label: "Clientes ativos",
      value: `${metrics.activeCustomers} / ${metrics.totalCustomers}`,
      icon: Users,
      tone: "text-primary",
    },
    {
      label: "Faturas vencidas",
      value: metrics.overdueInvoices.toString(),
      icon: AlertCircle,
      tone: "text-destructive",
    },
    {
      label: "Total de clientes",
      value: metrics.totalCustomers.toString(),
      icon: Receipt,
      tone: "text-primary",
    },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do sistema Mestre 360" />
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
                  <Icon className={`h-4 w-4 ${c.tone}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{c.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo ao Mestre 360</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Os módulos de Clientes, Planos, Faturas, Tickets e Configurações já estão acessíveis
            pelo menu lateral. As métricas serão preenchidas conforme você cadastrar clientes e
            ativar a integração com o ASAAS.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
