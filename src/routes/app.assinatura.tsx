import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  CreditCard,
  Loader2,
  ExternalLink,
  AlertCircle,
  Receipt,
  Crown,
  CalendarDays,
  XCircle,
  Sparkles,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCurrentCustomerId } from "@/lib/customer";
import { createAsaasSubscription } from "@/lib/asaas.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/assinatura")({
  component: AssinaturaPage,
});

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cycle: "monthly" | "quarterly" | "semiannual" | "annual";
  features: string[];
  is_featured: boolean;
  display_order: number;
};

type Subscription = {
  id: string;
  plan_id: string;
  status: string;
  price: number;
  cycle: string;
  started_at?: string | null;
  next_due_date: string | null;
  asaas_subscription_id: string | null;
  plan: { name: string } | null;
};

type Invoice = {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
};

type BillingType = "UNDEFINED" | "BOLETO" | "PIX" | "CREDIT_CARD";

const cycleLabel: Record<string, string> = {
  monthly: "mês",
  quarterly: "trimestre",
  semiannual: "semestre",
  annual: "ano",
};

const cycleBadge: Record<string, string> = {
  monthly: "MENSAL",
  quarterly: "TRIMESTRAL",
  semiannual: "SEMESTRAL",
  annual: "ANUAL",
};

const invoiceStatusStyles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  canceled: "bg-muted text-muted-foreground",
  refunded: "bg-muted text-muted-foreground",
};

const invoiceStatusLabel: Record<string, string> = {
  paid: "PAGA",
  pending: "PENDENTE",
  overdue: "VENCIDA",
  canceled: "CANCELADA",
  refunded: "REEMBOLSADA",
};

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function AssinaturaPage() {
  const { user } = useAuth();
  const subscribe = useServerFn(createAsaasSubscription);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingType, setBillingType] = useState<BillingType>("UNDEFINED");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "semiannual" | "annual">("monthly");

  const load = async () => {
    setLoading(true);
    try {
      const custId = await getCurrentCustomerId();
      setCustomerId(custId);

      const { data: plansData } = await supabase
        .from("plans")
        .select("id,name,description,price,cycle,features,is_featured,display_order")
        .eq("is_active", true)
        .order("display_order");
      setPlans((plansData as Plan[]) ?? []);

      if (custId) {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select(
            "id,plan_id,status,price,cycle,started_at,next_due_date,asaas_subscription_id,plan:plans(name)",
          )
          .eq("customer_id", custId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setSubscription(subData as Subscription | null);

        const { data: invData } = await supabase
          .from("invoices")
          .select("id,description,amount,status,due_date,paid_at,invoice_url,bank_slip_url")
          .eq("customer_id", custId)
          .order("due_date", { ascending: false })
          .limit(20);
        setInvoices((invData as Invoice[]) ?? []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao carregar dados", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const activeSub = useMemo(
    () => (subscription && subscription.status !== "canceled" ? subscription : null),
    [subscription],
  );

  const periodInfo = useMemo(() => {
    if (!activeSub) return null;
    const start = activeSub.started_at ? new Date(activeSub.started_at) : null;
    const next = activeSub.next_due_date
      ? new Date(activeSub.next_due_date + "T00:00:00")
      : null;
    const today = new Date();
    if (!start || !next) return null;
    const total = Math.max(1, daysBetween(start, next));
    const elapsed = Math.min(total, daysBetween(start, today));
    const remaining = daysBetween(today, next);
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    return { start, next, remaining, pct };
  }, [activeSub]);

  const handleActivate = async (planId: string) => {
    if (!customerId) {
      toast.error("Empresa não encontrada", {
        description: "Cadastre os dados da empresa antes de assinar.",
      });
      return;
    }
    setActivating(planId);
    try {
      await subscribe({ data: { customerId, planId, billingType } });
      toast.success("Assinatura ativada!", {
        description: "Sua cobrança já está disponível em 'Faturas'.",
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao ativar assinatura", { description: msg });
    } finally {
      setActivating(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assinatura"
        description="Gerencie o plano da sua empresa e acompanhe suas faturas."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {!customerId && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold">Cadastre os dados da empresa</p>
                  <p className="text-sm text-muted-foreground">
                    Para assinar um plano, precisamos do CNPJ e dados da empresa. Acesse o seu perfil.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSub && (
            <Card className="overflow-hidden border-border/60 shadow-sm">
              {/* Header */}
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-5">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30">
                    <Crown className="h-8 w-8 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight">
                        {activeSub.plan?.name ?? "Plano"}
                      </h2>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        Ativo
                      </span>
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {cycleBadge[activeSub.cycle] ?? activeSub.cycle}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="text-base font-semibold text-foreground">
                        {formatCurrency(Number(activeSub.price))}
                      </span>
                      /{cycleLabel[activeSub.cycle] ?? activeSub.cycle}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/30"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar assinatura
                </Button>
              </div>

              {/* Período */}
              {periodInfo && (
                <div className="border-t border-border/60 p-6">
                  <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    Período da assinatura
                  </div>
                  <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Início</span>
                        <span>Vencimento</span>
                      </div>
                      <div className="mb-2 flex items-center justify-between text-base font-semibold">
                        <span>{formatDate(activeSub.started_at ?? null)}</span>
                        <span>{formatDate(activeSub.next_due_date)}</span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                          style={{ width: `${periodInfo.pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-8 py-5 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
                      <p className="text-4xl font-bold leading-none text-emerald-700 dark:text-emerald-400">
                        {periodInfo.remaining}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/80">
                        dias restantes
                      </p>
                      <p className="mt-1 text-[11px] text-emerald-700/60 dark:text-emerald-400/60">
                        até o próximo pagamento
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {!activeSub && customerId && (
            <Card className="border-muted">
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">Forma de pagamento preferida</span>
                <Select value={billingType} onValueChange={(v) => setBillingType(v as BillingType)}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNDEFINED">Deixar o cliente escolher</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Tabs section */}
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <Tabs defaultValue="invoices">
              <div className="border-b border-border/60 px-6 pt-4">
                <TabsList className="h-auto gap-1 bg-transparent p-0">
                  <TabsTrigger
                    value="invoices"
                    className="group relative gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Receipt className="h-4 w-4" />
                    Faturas
                    {invoices.length > 0 && (
                      <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary group-data-[state=active]:bg-primary/15">
                        {invoices.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="plans"
                    className="group relative gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Package className="h-4 w-4" />
                    {activeSub ? "Mudar de plano" : "Planos"}
                    {plans.length > 0 && (
                      <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary group-data-[state=active]:bg-primary/15">
                        {plans.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="invoices" className="m-0">
                {invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <Receipt className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhuma fatura por aqui ainda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Descrição</th>
                          <th className="px-6 py-4">Vencimento</th>
                          <th className="px-6 py-4">Valor</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            className="border-t border-border/40 transition-colors hover:bg-muted/30"
                          >
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
                                Fatura
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold">{inv.description ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">Mensal · Automática</p>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                              {formatDate(inv.due_date)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 font-bold">
                              {formatCurrency(Number(inv.amount))}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                  invoiceStatusStyles[inv.status] ?? "bg-muted text-muted-foreground"
                                }`}
                              >
                                {invoiceStatusLabel[inv.status] ?? inv.status.toUpperCase()}
                              </span>
                              {inv.paid_at && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Paga em {formatDate(inv.paid_at)}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {inv.invoice_url ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1.5 text-primary hover:text-primary"
                                >
                                  <a href={inv.invoice_url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Pagar
                                  </a>
                                </Button>
                              ) : inv.status === "paid" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  <Check className="h-3.5 w-3.5" />
                                  Paga
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="plans" className="m-0 p-6">
                {plans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhum plano disponível.</p>
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {plans.map((plan) => {
                      const isCurrent = activeSub?.plan_id === plan.id;
                      return (
                        <div
                          key={plan.id}
                          className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                            plan.is_featured
                              ? "border-primary/40 bg-gradient-to-br from-primary/[0.04] to-transparent shadow-md ring-1 ring-primary/10"
                              : "border-border/60 bg-card"
                          } ${isCurrent ? "ring-2 ring-primary/40" : ""}`}
                        >
                          {plan.is_featured && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-pink-500/30">
                                <Sparkles className="h-3 w-3" />
                                Recomendado
                              </span>
                            </div>
                          )}
                          <div className="mb-4">
                            <h3 className="text-lg font-bold tracking-tight">{plan.name}</h3>
                            {plan.description && (
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                {plan.description}
                              </p>
                            )}
                          </div>
                          <div className="mb-5">
                            <span className="text-3xl font-bold tracking-tight">
                              {formatCurrency(Number(plan.price))}
                            </span>
                            <span className="ml-1 text-sm text-muted-foreground">
                              /{cycleLabel[plan.cycle] ?? plan.cycle}
                            </span>
                          </div>
                          {plan.features.length > 0 && (
                            <ul className="mb-6 space-y-2.5 text-sm">
                              {plan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  </div>
                                  <span className="leading-relaxed">{f}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-auto pt-2">
                            <Button
                              className="w-full rounded-full"
                              variant={isCurrent ? "outline" : plan.is_featured ? "default" : "secondary"}
                              disabled={isCurrent || activating !== null || !customerId}
                              onClick={() => handleActivate(plan.id)}
                            >
                              {activating === plan.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Ativando...
                                </>
                              ) : isCurrent ? (
                                "Plano atual"
                              ) : activeSub ? (
                                "Mudar para este plano"
                              ) : (
                                "Assinar este plano"
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}
    </div>
  );
}
