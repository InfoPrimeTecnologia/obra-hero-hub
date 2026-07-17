import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startOnboardingTour } from "@/lib/onboarding-tour";
import {
  LayoutDashboard,
  HardHat,
  LogOut,
  Building2,
  ListTree,
  ClipboardList,
  Truck,
  CreditCard,
  ShoppingCart,
  Wallet,
  Tags,
  Receipt,
  ArrowDownToLine,
  ArrowLeftRight,
  BarChart3,
  FileSpreadsheet,
  DollarSign,
  ChevronDown,
  Package,
  Warehouse,
  ArrowUpDown,
  ClipboardCheck,
  Users,
  UserPlus,
  FileBarChart2,
  Sparkles,
  BookOpen,
  Coins,
  KanbanSquare,
  CalendarDays,
} from "lucide-react";
import { AIAssistant } from "@/components/app/AIAssistant";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/app/TopBar";
import { cn } from "@/lib/utils";
import { useObraSelecionada } from "@/lib/obra-context";
import { usePlanModules } from "@/lib/use-plan-modules";
import { usePermissions } from "@/lib/use-permissions";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  module?: string;
};

type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  module?: string;
  children: NavItem[];
};

const primaryNav: Array<NavItem | NavGroup> = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/obras", label: "Obras", icon: HardHat, module: "obras" },
  { to: "/app/tarefas", label: "Tarefas", icon: KanbanSquare, module: "tarefas" },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays, module: "agenda" },
  { to: "/app/empresas", label: "Empresas", icon: Building2 },
  {
    label: "Estoque",
    icon: Package,
    module: "estoque",
    children: [
      { to: "/app/estoque/produtos", label: "Produtos", icon: Package },
      { to: "/app/estoque/almoxarifados", label: "Almoxarifados", icon: Warehouse },
      { to: "/app/estoque/saldos", label: "Saldos", icon: ListTree },
      { to: "/app/estoque/movimentacoes", label: "Movimentações", icon: ArrowUpDown },
      { to: "/app/estoque/requisicoes", label: "Requisições", icon: ClipboardCheck },
      { to: "/app/fornecedores", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    label: "RH",
    icon: Users,
    module: "rh",
    children: [{ to: "/app/rh/colaboradores", label: "Colaboradores", icon: UserPlus }],
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    module: "financeiro",
    children: [
      { to: "/app/cartoes", label: "Cartões", icon: CreditCard },
      { to: "/app/faturas-cartao", label: "Faturas de cartão", icon: Receipt },
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { has: hasModule, hasFeature } = usePlanModules();
  const { can, loading: permsLoading } = usePermissions();

  const systemNav: Array<NavItem | NavGroup> = [
    { to: "/app/relatorios", label: "Relatórios", icon: FileBarChart2, module: "relatorios" },
    { to: "/app/manual", label: "Manual", icon: BookOpen },
    {
      label: "Assinatura",
      icon: Sparkles,
      children: [
        { to: "/app/assinatura", label: "Planos", icon: Sparkles },
        ...(hasFeature("ai_assistant") ? [{ to: "/app/creditos", label: "Créditos IA", icon: Coins }] : []),
      ],
    },
  ];

  const allowedByPerm = (mod?: string) => !mod || permsLoading || can(mod, "view");
  const visiblePrimaryNav = primaryNav.filter(
    (item) => (!item.module || hasModule(item.module)) && allowedByPerm(item.module),
  );
  const visibleSystemNav = systemNav.filter(
    (item) => (!item.module || hasModule(item.module)) && allowedByPerm(item.module),
  );

  const renderNavItem = (item: NavItem | NavGroup) => {
    if (isGroup(item)) {
      const groupActive = item.children.some((c) => location.pathname.startsWith(c.to));
      const open = openGroups[item.label] ?? groupActive;
      const Icon = item.icon;
      return (
        <div key={item.label}>
          <button
            type="button"
            onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !open }))}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              groupActive
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")}
            />
          </button>
          {open ? (
            <div className="mt-1 ml-3 space-y-1 border-l border-sidebar-border pl-3">
              {item.children.map((child) => {
                const childActive = location.pathname.startsWith(child.to);
                const ChildIcon = child.icon;
                return (
                  <Link
                    key={child.to}
                    to={child.to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      childActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <ChildIcon className="h-4 w-4" />
                    {child.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

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
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  useEffect(() => {
    if (!user?.id) return;
    const t = window.setTimeout(() => startOnboardingTour(user.id), 600);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  // Quando estamos em uma obra (`/app/obras/:id/...`), o layout próprio da obra
  // (src/routes/app.obras.$obraId.tsx) cuida da sidebar/topbar — aqui só renderizamos o Outlet.
  const isObraScoped = /^\/app\/obras\/[^/]+(\/.*)?$/.test(location.pathname);

  if (isObraScoped) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">

        <div className="relative flex h-16 items-center justify-center bg-sidebar px-4 md:h-[68px] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[linear-gradient(to_right,transparent,color-mix(in_oklab,var(--sidebar-primary)_55%,transparent)_50%,transparent)]">
          <Logo variant="light" className="h-8" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visiblePrimaryNav.map(renderNavItem)}
          {visibleSystemNav.length > 0 && (
            <>
              <div
                className="my-3 h-px w-full"
                style={{
                  background:
                    "linear-gradient(to right, transparent, color-mix(in oklab, var(--sidebar-primary) 55%, transparent) 50%, transparent)",
                  boxShadow:
                    "0 1px 0 color-mix(in oklab, var(--sidebar-primary) 18%, transparent)",
                }}
              />
              {visibleSystemNav.map(renderNavItem)}
            </>
          )}
        </nav>
        <div className="relative p-3 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-[linear-gradient(to_right,transparent,color-mix(in_oklab,var(--sidebar-primary)_55%,transparent)_50%,transparent)]">
          <div className="mb-2 truncate px-3 text-xs text-sidebar-foreground/60">{user?.email}</div>
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
        <TopBar />
        <Outlet />
      </main>
      {hasFeature("ai_assistant") ? <AIAssistant /> : null}
    </div>
  );
}
