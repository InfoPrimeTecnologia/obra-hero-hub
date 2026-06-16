import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { ObraProvider } from "@/lib/obra-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppGate,
});

const ALLOWED_WITHOUT_SUB = [
  "/app/assinatura",
  "/app/perfil",
  "/app/empresas",
  "/app/configuracoes",
];

function AppGate() {
  const { loading, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // null = checando | true = liberado | false = bloqueado (sem assinatura ativa/paga)
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (isAdmin) {
      navigate({ to: "/admin" });
      return;
    }

    let cancelled = false;
    (async () => {
      // Busca empresa do usuário
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!cust) {
        if (!cancelled) setAccessGranted(false);
        return;
      }

      // Libera se houver assinatura ativa OU pelo menos uma fatura paga
      const [{ data: activeSub }, { data: paidInv }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id")
          .eq("customer_id", cust.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("invoices")
          .select("id")
          .eq("customer_id", cust.id)
          .eq("status", "paid")
          .limit(1)
          .maybeSingle(),
      ]);

      if (!cancelled) setAccessGranted(Boolean(activeSub) || Boolean(paidInv));
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || isAdmin || accessGranted === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Logo className="h-16 animate-pulse" />
      </div>
    );
  }

  const onAllowedRoute = ALLOWED_WITHOUT_SUB.some((p) =>
    location.pathname.startsWith(p),
  );

  if (!accessGranted && !onAllowedRoute) {
    return <SubscriptionRequired />;
  }

  return (
    <ObraProvider>
      <AppLayout />
    </ObraProvider>
  );
}

function SubscriptionRequired() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Sparkles className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao Mestre 360</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Para acessar o sistema você precisa ativar um plano. Escolha a opção
            que melhor se encaixa na sua operação — após a confirmação do
            pagamento, todos os recursos do plano são liberados automaticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Acesso completo</p>
                <p className="text-xs text-muted-foreground">
                  Obras, financeiro, estoque, RH e relatórios conforme seu plano.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <Clock className="mt-0.5 h-5 w-5 text-accent" />
              <div>
                <p className="text-sm font-medium">Liberação automática</p>
                <p className="text-xs text-muted-foreground">
                  Assim que o pagamento for confirmado, seu acesso é liberado.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => signOut().then(() => navigate({ to: "/login" }))}>
              Sair
            </Button>
            <Button onClick={() => navigate({ to: "/app/assinatura" })}>
              Escolher meu plano
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
