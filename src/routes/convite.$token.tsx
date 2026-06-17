import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { acceptTeamInvite } from "@/lib/team.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/convite/$token")({ component: ConvitePage });

function ConvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const accept = useServerFn(acceptTeamInvite);
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (loading || !user || status !== "idle") return;
    setStatus("running");
    accept({ data: { token } })
      .then(() => {
        setStatus("done");
        toast.success("Convite aceito! Bem-vindo(a) à equipe.");
        setTimeout(() => navigate({ to: "/app" }), 1200);
      })
      .catch((e: any) => {
        setStatus("error");
        setMsg(e.message ?? "Erro ao aceitar convite");
      });
  }, [user, loading, token, accept, navigate, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">Convite para equipe</h1>
          {loading ? (
            <p className="text-sm text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Verificando…</p>
          ) : !user ? (
            <>
              <p className="text-sm text-muted-foreground">Faça login ou crie uma conta com o mesmo e-mail do convite para aceitar.</p>
              <Button asChild className="w-full">
                <Link to="/login" search={{ redirect: `/convite/${token}` } as any}>Entrar</Link>
              </Button>
            </>
          ) : status === "running" ? (
            <p className="text-sm"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Aceitando convite…</p>
          ) : status === "done" ? (
            <p className="text-sm text-green-600">Tudo certo! Redirecionando…</p>
          ) : status === "error" ? (
            <>
              <p className="text-sm text-destructive">{msg}</p>
              <Button asChild className="w-full"><Link to="/app">Ir para o app</Link></Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
