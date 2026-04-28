import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
});

function AdminGate() {
  const { loading, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Logo className="h-16 animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <Logo className="h-16" />
        <h1 className="text-2xl font-semibold">Acesso restrito</h1>
        <p className="max-w-md text-muted-foreground">
          Sua conta não possui permissão de administrador. Entre em contato com o responsável
          pelo sistema para liberar o acesso.
        </p>
      </div>
    );
  }

  return <AdminLayout />;
}
