import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  HardHat,
  Building2,
  ClipboardList,
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  Plus,
  Activity,
  CalendarClock,
  Filter,
  Check,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useObraSelecionada, type Obra } from "@/lib/obra-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/app/")({
  component: ClienteDashboard,
});

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Kpis = {
  empresas: number;
  obras: number;
  obrasAtivas: number;
  rdosMes: number;
  colaboradores: number;
  produtosBaixo: number;
  aPagar30: number;
  aReceber30: number;
  vencidasPagar: number;
};

type FluxoPonto = { mes: string; pagar: number; receber: number };
type RdoRecente = { id: string; data: string; obra: string };
type AlertaConta = { id: string; descricao: string; vencimento: string; valor: number };

function ClienteDashboard() {
  const { user } = useAuth();
  const { obra, setObra } = useObraSelecionada();
  const [loading, setLoading] = useState(true);
  const [obrasDisponiveis, setObrasDisponiveis] = useState<Obra[]>([]);
  const [kpis, setKpis] = useState<Kpis>({
    empresas: 0,
    obras: 0,
    obrasAtivas: 0,
    rdosMes: 0,
    colaboradores: 0,
    produtosBaixo: 0,
    aPagar30: 0,
    aReceber30: 0,
    vencidasPagar: 0,
  });
  const [fluxo, setFluxo] = useState<FluxoPonto[]>([]);
  const [obrasStatus, setObrasStatus] = useState<{ name: string; value: number }[]>([]);
  const [rdosRecentes, setRdosRecentes] = useState<RdoRecente[]>([]);
  const [alertas, setAlertas] = useState<AlertaConta[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("obras")
        .select("id,name,customer_id,empresa_id,contact_name,contact_email,contact_whatsapp,address_city,address_state,status,foto_url")
        .eq("status", "active")
        .order("name");
      if (alive) setObrasDisponiveis((data ?? []) as Obra[]);
    })();
    return () => { alive = false; };
  }, []);


  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const hoje = new Date();
      const inicioMes = startOfMonth(hoje).toISOString().slice(0, 10);
      const em30 = new Date(hoje.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const hojeStr = hoje.toISOString().slice(0, 10);

      const [
        { count: empresas },
        { count: obrasTot },
        { count: obrasAtv },
        { count: rdosMes },
        { count: colabs },
        { data: saldosBaixo },
        { data: pagar30 },
        { data: receber30 },
        { data: vencidas },
        { data: obrasRows },
        { data: rdoRows },
        { data: alertasRows },
      ] = await Promise.all([
        supabase.from("empresas").select("*", { count: "exact", head: true }),
        supabase.from("obras").select("*", { count: "exact", head: true }),
        supabase.from("obras").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("rdos").select("*", { count: "exact", head: true }).gte("data", inicioMes),
        supabase
          .from("colaboradores")
          .select("*", { count: "exact", head: true })
          .eq("ativo", true),
        supabase.from("estoque_saldos").select("produto_id, quantidade").lte("quantidade", 5),
        supabase
          .from("contas_pagar")
          .select("valor")
          .gte("data_vencimento", hojeStr)
          .lte("data_vencimento", em30)
          .neq("status", "pago"),
        supabase
          .from("contas_receber")
          .select("valor")
          .gte("data_vencimento", hojeStr)
          .lte("data_vencimento", em30)
          .neq("status", "recebido"),
        supabase
          .from("contas_pagar")
          .select("valor")
          .lt("data_vencimento", hojeStr)
          .neq("status", "pago"),
        supabase.from("obras").select("status"),
        supabase
          .from("rdos")
          .select("id, data, obra:obras(nome)")
          .order("data", { ascending: false })
          .limit(5),
        supabase
          .from("contas_pagar")
          .select("id, descricao, data_vencimento, valor")
          .neq("status", "pago")
          .order("data_vencimento", { ascending: true })
          .limit(5),
      ]);

      // Fluxo últimos 6 meses
      const meses = Array.from({ length: 6 }).map((_, i) => {
        const d = subMonths(hoje, 5 - i);
        return { d, label: format(d, "MMM", { locale: ptBR }) };
      });
      const fluxoData: FluxoPonto[] = await Promise.all(
        meses.map(async ({ d, label }) => {
          const ini = startOfMonth(d).toISOString().slice(0, 10);
          const fim = endOfMonth(d).toISOString().slice(0, 10);
          const [{ data: p }, { data: r }] = await Promise.all([
            supabase.from("contas_pagar").select("valor").gte("data_vencimento", ini).lte("data_vencimento", fim),
            supabase.from("contas_receber").select("valor").gte("data_vencimento", ini).lte("data_vencimento", fim),
          ]);
          return {
            mes: label,
            pagar: (p ?? []).reduce((s, x) => s + Number(x.valor ?? 0), 0),
            receber: (r ?? []).reduce((s, x) => s + Number(x.valor ?? 0), 0),
          };
        })
      );

      const statusMap = (obrasRows ?? []).reduce<Record<string, number>>((acc, r: any) => {
        const k = r.status ?? "desconhecido";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});

      if (!alive) return;
      setKpis({
        empresas: empresas ?? 0,
        obras: obrasTot ?? 0,
        obrasAtivas: obrasAtv ?? 0,
        rdosMes: rdosMes ?? 0,
        colaboradores: colabs ?? 0,
        produtosBaixo: (saldosBaixo ?? []).length,
        aPagar30: (pagar30 ?? []).reduce((s, x) => s + Number(x.valor ?? 0), 0),
        aReceber30: (receber30 ?? []).reduce((s, x) => s + Number(x.valor ?? 0), 0),
        vencidasPagar: (vencidas ?? []).reduce((s, x) => s + Number(x.valor ?? 0), 0),
      });
      setFluxo(fluxoData);
      setObrasStatus(
        Object.entries(statusMap).map(([name, value]) => ({
          name: name === "active" ? "Ativas" : name === "paused" ? "Pausadas" : name === "done" ? "Concluídas" : name,
          value,
        }))
      );
      setRdosRecentes(
        (rdoRows ?? []).map((r: any) => ({
          id: r.id,
          data: r.data,
          obra: r.obra?.nome ?? "—",
        }))
      );
      setAlertas(
        (alertasRows ?? []).map((a: any) => ({
          id: a.id,
          descricao: a.descricao ?? "Conta a pagar",
          vencimento: a.data_vencimento,
          valor: Number(a.valor ?? 0),
        }))
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saldoMes = useMemo(() => {
    const last = fluxo[fluxo.length - 1];
    return last ? last.receber - last.pagar : 0;
  }, [fluxo]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const nome = user?.email?.split("@")[0] ?? "";

  const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)"];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão consolidada das suas obras e operações" />
      <div className="space-y-6 p-6 md:p-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl border bg-sidebar p-6 text-sidebar-foreground md:p-8">
          {obra?.foto_url ? (
            <>
              <img
                src={obra.foto_url}
                alt={obra.name}
                className="absolute inset-0 h-full w-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/80 to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
              <div className="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-sidebar-primary/30 blur-3xl" />
            </>
          )}
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-sidebar-foreground/70">{greeting},</p>
              <h2 className="text-2xl font-semibold capitalize md:text-3xl">{nome}</h2>
              <p className="mt-1 text-sm text-sidebar-foreground/70">
                {obra ? (
                  <>
                    Obra ativa: <span className="font-medium text-sidebar-foreground">{obra.name}</span>
                  </>
                ) : (
                  "Selecione uma obra para ações rápidas no menu lateral."
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="gap-2">
                <Link to="/app/obras">
                  <HardHat className="h-4 w-4" /> Obras
                </Link>
              </Button>
              {obra ? (
                <Button asChild className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link to="/app/obras/$obraId/rdo" params={{ obraId: obra.id }}>
                    <Plus className="h-4 w-4" /> Novo RDO
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Obras ativas"
            value={`${kpis.obrasAtivas}/${kpis.obras}`}
            icon={HardHat}
            tone="primary"
            footer={`${kpis.empresas} empresa(s)`}
            loading={loading}
          />
          <KpiCard
            label="RDOs no mês"
            value={kpis.rdosMes.toString()}
            icon={ClipboardList}
            tone="accent"
            footer="Apontamentos diários"
            loading={loading}
          />
          <KpiCard
            label="A receber (30d)"
            value={fmtBRL(kpis.aReceber30)}
            icon={TrendingUp}
            tone="success"
            footer="Próximos 30 dias"
            loading={loading}
          />
          <KpiCard
            label="A pagar (30d)"
            value={fmtBRL(kpis.aPagar30)}
            icon={TrendingDown}
            tone="danger"
            footer={kpis.vencidasPagar > 0 ? `${fmtBRL(kpis.vencidasPagar)} vencidas` : "Em dia"}
            loading={loading}
            alert={kpis.vencidasPagar > 0}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Fluxo financeiro</CardTitle>
                <CardDescription>Últimos 6 meses · Pagar vs Receber</CardDescription>
              </div>
              <Badge variant={saldoMes >= 0 ? "default" : "destructive"} className="gap-1">
                {saldoMes >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                Saldo do mês: {fmtBRL(saldoMes)}
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fluxo} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gReceber" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gPagar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => fmtBRL(v)}
                      />
                      <Area
                        type="monotone"
                        dataKey="receber"
                        name="A receber"
                        stroke="var(--chart-4)"
                        strokeWidth={2}
                        fill="url(#gReceber)"
                      />
                      <Area
                        type="monotone"
                        dataKey="pagar"
                        name="A pagar"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        fill="url(#gPagar)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Obras por status</CardTitle>
              <CardDescription>Distribuição do portfólio</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : obrasStatus.length === 0 ? (
                <EmptyState icon={Building2} text="Nenhuma obra cadastrada" />
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={obrasStatus}
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {obrasStatus.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Operacional row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Contas a pagar — próximas
                </CardTitle>
                <CardDescription>5 vencimentos mais próximos</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/app/contas-pagar">
                  Ver todas <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : alertas.length === 0 ? (
                <EmptyState icon={Wallet} text="Nenhuma conta em aberto" />
              ) : (
                <div className="divide-y">
                  {alertas.map((a) => {
                    const venc = new Date(a.vencimento + "T00:00:00");
                    const atrasada = venc < new Date();
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                              atrasada ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"
                            )}
                          >
                            <CalendarClock className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{a.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              Vence em {format(venc, "dd/MM/yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {atrasada ? (
                            <Badge variant="destructive">Vencida</Badge>
                          ) : null}
                          <span className="text-sm font-semibold tabular-nums">{fmtBRL(a.valor)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Operação
              </CardTitle>
              <CardDescription>Indicadores rápidos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <MiniStat
                icon={Users}
                label="Colaboradores ativos"
                value={kpis.colaboradores.toString()}
              />
              <MiniStat
                icon={Package}
                label="Produtos com estoque baixo"
                value={kpis.produtosBaixo.toString()}
                tone={kpis.produtosBaixo > 0 ? "danger" : "default"}
              />
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Saúde financeira (30d)</span>
                  <span className="font-medium tabular-nums">
                    {kpis.aReceber30 + kpis.aPagar30 === 0
                      ? "—"
                      : `${Math.round(
                          (kpis.aReceber30 / (kpis.aReceber30 + kpis.aPagar30)) * 100
                        )}%`}
                  </span>
                </div>
                <Progress
                  value={
                    kpis.aReceber30 + kpis.aPagar30 === 0
                      ? 0
                      : (kpis.aReceber30 / (kpis.aReceber30 + kpis.aPagar30)) * 100
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Proporção de receitas sobre o total previsto
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RDOs recentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>RDOs recentes</CardTitle>
              <CardDescription>Últimos apontamentos diários de obra</CardDescription>
            </div>
            {obra ? (
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/app/obras/$obraId/rdo" params={{ obraId: obra.id }}>
                  Ver RDOs <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : rdosRecentes.length === 0 ? (
              <EmptyState icon={ClipboardList} text="Nenhum RDO registrado ainda" />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                {rdosRecentes.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
                  >
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.data + "T00:00:00"), "dd 'de' MMM", { locale: ptBR })}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium">{r.obra}</p>
                    <Badge variant="secondary" className="mt-2 text-[10px]">
                      RDO
                    </Badge>
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

type Tone = "primary" | "accent" | "success" | "danger" | "default";

function KpiCard({
  label,
  value,
  icon: Icon,
  footer,
  tone = "default",
  loading,
  alert,
}: {
  label: string;
  value: string;
  icon: typeof HardHat;
  footer?: string;
  tone?: Tone;
  loading?: boolean;
  alert?: boolean;
}) {
  const toneClasses: Record<Tone, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    success: "bg-emerald-500/10 text-emerald-600",
    danger: "bg-destructive/10 text-destructive",
    default: "bg-muted text-foreground",
  };
  return (
    <Card className={cn("relative overflow-hidden", alert && "ring-1 ring-destructive/40")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            )}
            {footer ? (
              <p className={cn("text-xs", alert ? "text-destructive" : "text-muted-foreground")}>
                {footer}
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              toneClasses[tone]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Package; text: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
