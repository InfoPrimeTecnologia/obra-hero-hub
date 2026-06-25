import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  HardHat,
  ListTree,
  CalendarRange,
  ClipboardList,
  Truck,
  ShoppingCart,
  Search,
  Wallet,
  Receipt,
  CreditCard,
  Banknote,
  FileBarChart2,
  ChevronDown,
  ImageIcon,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useObraSelecionada } from "@/lib/obra-context";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
type Group = { label: string; items: Item[] };

export function ObraSidebar({ obraId }: { obraId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { obra, setObra } = useObraSelecionada();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Garante que a obra ativa do contexto bate com a URL.
  useEffect(() => {
    if (obra?.id === obraId) return;
    void supabase
      .from("obras")
      .select(
        "id,name,customer_id,empresa_id,contact_name,contact_email,contact_whatsapp,address_city,address_state,status,foto_url",
      )
      .eq("id", obraId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setObra(data as any);
      });
  }, [obraId, obra?.id, setObra]);

  const base = `/app/obras/${obraId}`;

  const groups: Group[] = [
    {
      label: "Visão geral",
      items: [{ to: base, label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Administração",
      items: [{ to: `${base}/rh`, label: "RH", icon: Users }],
    },
    {
      label: "Engenharia",
      items: [
        { to: `${base}/orcamento`, label: "Orçamento", icon: ListTree },
        { to: `${base}/planejamento`, label: "Planejamento", icon: CalendarRange },
        { to: `${base}/medicoes`, label: "Medições", icon: FileBarChart2 },
        { to: `${base}/rdo`, label: "Diário de obra", icon: ClipboardList },
      ],
    },
    {
      label: "Suprimentos",
      items: [
        { to: `${base}/fornecedores`, label: "Fornecedores", icon: Truck },
        { to: `${base}/compras`, label: "Compras", icon: ShoppingCart },
        { to: `${base}/consulta`, label: "Consulta", icon: Search },
      ],
    },
    {
      label: "Financeiro",
      items: [
        { to: `${base}/pagamentos`, label: "Meio de pagamentos", icon: Wallet },
        { to: `${base}/contas-pagar`, label: "Contas a pagar", icon: Receipt },
        { to: `${base}/faturas`, label: "Faturas cartão", icon: CreditCard },
        { to: `${base}/caixa`, label: "Caixa e bancos", icon: Banknote },
      ],
    },
    {
      label: "Relatórios",
      items: [
        { to: `${base}/relatorios/compras`, label: "Relatório de compras", icon: FileBarChart2 },
        { to: `${base}/relatorios/pagamentos`, label: "Relatório de pagamentos", icon: FileBarChart2 },
        { to: `${base}/relatorios/orcado-realizado`, label: "Orçado x Realizado", icon: FileBarChart2 },
      ],
    },
  ];

  const isActive = (item: Item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const sair = () => void signOut().then(() => navigate({ to: "/login" }));

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="relative flex h-16 items-center justify-center bg-sidebar px-4 md:h-[68px] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[linear-gradient(to_right,transparent,color-mix(in_oklab,var(--sidebar-primary)_55%,transparent)_50%,transparent)]">
        <Logo variant="light" className="h-8" />
      </div>

      <div className="relative p-3 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[linear-gradient(to_right,transparent,color-mix(in_oklab,var(--sidebar-primary)_55%,transparent)_50%,transparent)]">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => navigate({ to: "/app/obras" })}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao sistema
        </Button>
        <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/40 p-2">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-sidebar-accent/60">
            {obra?.foto_url ? (
              <img src={obra.foto_url} alt={obra.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sidebar-foreground/60">
                <HardHat className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/60">Obra</p>
            <p className="truncate text-sm font-medium">{obra?.name ?? "Carregando..."}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto p-3">
        {groups.map((group) => {
          const open = openGroups[group.label] ?? true;
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [group.label]: !open }))
                }
                className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground"
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", open ? "rotate-180" : "")}
                />
              </button>
              {open ? (
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="relative p-3 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-[linear-gradient(to_right,transparent,color-mix(in_oklab,var(--sidebar-primary)_55%,transparent)_50%,transparent)]">
        <div className="mb-2 truncate px-3 text-xs text-sidebar-foreground/60">{user?.email}</div>
        <Button
          variant="ghost"
          onClick={sair}
          className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
