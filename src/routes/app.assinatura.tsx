import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  past_due: { label: "Em atraso", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "outline" },
  trialing: { label: "Período de teste", variant: "secondary" },
};

const invoiceStatusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  overdue: { label: "Vencido", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
  refunded: { label: "Reembolsado", variant: "outline" },
};

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
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
          .select("id,plan_id,status,price,cycle,next_due_date,asaas_subscription_id,plan:plans(name)")
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
          .limit(12);
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

  const handleActivate = async (planId: string) => {
    if (!customerId) {
      toast.error("Empresa não encontrada", {
        description: "Cadastre os dados da empresa antes de assinar.",
      });
      return;
    }
    setActivating(planId);
    try {
      await subscribe({
        data: { customerId, planId, billingType },
      });
      toast.success("Assinatura ativada!", {
        description: "Sua cobrança foi gerada no Asaas.",
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
        description="Gerencie o plano da sua empresa e veja suas faturas."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {!customerId && (
            <Card className="border-destructive/40">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">Cadastre os dados da empresa</p>
                  <p className="text-sm text-muted-foreground">
                    Para assinar um plano, precisamos do CNPJ e dados da empresa. Acesse o seu perfil.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSub && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Plano atual</span>
                  <Badge variant={statusBadge[activeSub.status]?.variant ?? "secondary"}>
                    {statusBadge[activeSub.status]?.label ?? activeSub.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano</p>
                  <p className="text-lg font-semibold">{activeSub.plan?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(Number(activeSub.price))}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {cycleLabel[activeSub.cycle] ?? activeSub.cycle}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Próximo vencimento</p>
                  <p className="text-lg font-semibold">{formatDate(activeSub.next_due_date)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!activeSub && customerId && (
            <Card>
              <CardHeader>
                <CardTitle>Forma de pagamento preferida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
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
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="mb-4 text-lg font-semibold">
              {activeSub ? "Mudar de plano" : "Escolha um plano"}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = activeSub?.plan_id === plan.id;
                return (
                  <Card
                    key={plan.id}
                    className={plan.is_featured ? "border-primary shadow-md" : ""}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{plan.name}</span>
                        {plan.is_featured && <Badge>Recomendado</Badge>}
                      </CardTitle>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <span className="text-3xl font-bold">{formatCurrency(Number(plan.price))}</span>
                        <span className="text-sm text-muted-foreground">
                          {" "}/ {cycleLabel[plan.cycle] ?? plan.cycle}
                        </span>
                      </div>
                      {plan.features.length > 0 && (
                        <ul className="space-y-2 text-sm">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
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
                    </CardContent>
                  </Card>
                );
              })}
              {plans.length === 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Nenhum plano disponível no momento.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {invoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Suas faturas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-4">Descrição</th>
                        <th className="pb-2 pr-4">Vencimento</th>
                        <th className="pb-2 pr-4">Valor</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">{inv.description ?? "—"}</td>
                          <td className="py-3 pr-4">{formatDate(inv.due_date)}</td>
                          <td className="py-3 pr-4 font-medium">
                            {formatCurrency(Number(inv.amount))}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant={invoiceStatusBadge[inv.status]?.variant ?? "secondary"}>
                              {invoiceStatusBadge[inv.status]?.label ?? inv.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            {inv.invoice_url && (
                              <Button asChild size="sm" variant="ghost">
                                <a href={inv.invoice_url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                  Abrir
                                </a>
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
