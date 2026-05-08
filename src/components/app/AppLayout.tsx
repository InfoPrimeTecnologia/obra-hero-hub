import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, HardHat, LogOut, Building2, ListTree, ClipboardList, Truck, CreditCard, ShoppingCart, Wallet, Tags, Receipt, ArrowDownToLine, ArrowLeftRight, BarChart3, FileSpreadsheet, DollarSign, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useObraSelecionada } from "@/lib/obra-context";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  children: NavItem[];
};

const nav: Array<NavItem | NavGroup> = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/empresas", label: "Empresas", icon: Building2 },
  { to: "/app/obras", label: "Obras", icon: HardHat },
  { to: "/app/fornecedores", label: "Fornecedores", icon: Truck },
  {
    label: "Financeiro",
    icon: DollarSign,
    children: [
      { to: "/app/cartoes", label: "Cartões", icon: CreditCard },
      { to: "/app/contas-bancarias", label: "Contas bancárias", icon: Wallet },
      { to: "/app/categorias", label: "Categorias", icon: Tags },
      { to: "/app/contas-pagar", label: "Contas a pagar", icon: Receipt },
      { to: "/app/contas-receber", label: "Contas a receber", icon: ArrowDownToLine },
      { to: "/app/transferencias", label: "Transferências", icon: ArrowLeftRight },
      { to: "/app/fluxo-caixa", label: "Fluxo de caixa", icon: BarChart3 },
      { to: "/app/conciliacao", label: "Conciliação", icon: FileSpreadsheet },
    ],
  },
];

function isGroup(item: NavItem | NavGroup): item is NavGroup {
  return (item as NavGroup).children !== undefined;
}

export function AppLayout() {
  const { signOut, user } = useAuth();
  const { obra } = useObraSelecionada();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-20 items-center justify-center border-b border-sidebar-border bg-white px-4">
          <Logo className="h-12" />
        </div>
        {obra ? (
          <div className="border-b border-sidebar-border px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-sidebar-foreground/60">
              Obra ativa
            </p>
            <p className="truncate text-sm font-medium">{obra.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to="/app/obras/$obraId/orcamento"
                params={{ obraId: obra.id }}
                className="inline-flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <ListTree className="h-3 w-3" /> Orçamento
              </Link>
              <Link
                to="/app/obras/$obraId/rdo"
                params={{ obraId: obra.id }}
                className="inline-flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <ClipboardList className="h-3 w-3" /> RDO
              </Link>
              <Link
                to="/app/obras/$obraId/compras"
                params={{ obraId: obra.id }}
                className="inline-flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <ShoppingCart className="h-3 w-3" /> Compras
              </Link>
            </div>
          </div>
        ) : null}
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-3 text-xs text-sidebar-foreground/60">
            {user?.email}
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
