import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { ObraProvider } from "@/lib/obra-context";

export const Route = createFileRoute("/app")({
  component: AppGate,
});

function AppGate() {
  const { loading, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (isAdmin) navigate({ to: "/admin" });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Logo className="h-16 animate-pulse" />
      </div>
    );
  }

  return (
    <ObraProvider>
      <AppLayout />
    </ObraProvider>
  );
}
