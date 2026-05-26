import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  User as UserIcon,
  Settings,
  LogOut,
  KeyRound,
  Bell,
  HelpCircle,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string };

const SEARCH_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard" },
  { to: "/app/empresas", label: "Empresas" },
  { to: "/app/obras", label: "Obras" },
  { to: "/app/estoque/produtos", label: "Produtos" },
  { to: "/app/estoque/almoxarifados", label: "Almoxarifados" },
  { to: "/app/estoque/saldos", label: "Saldos de estoque" },
  { to: "/app/estoque/movimentacoes", label: "Movimentações de estoque" },
  { to: "/app/estoque/requisicoes", label: "Requisições" },
  { to: "/app/fornecedores", label: "Fornecedores" },
  { to: "/app/rh/colaboradores", label: "Colaboradores" },
  { to: "/app/cartoes", label: "Cartões" },
  { to: "/app/contas-bancarias", label: "Contas bancárias" },
  { to: "/app/categorias", label: "Categorias" },
  { to: "/app/contas-pagar", label: "Contas a pagar" },
  { to: "/app/contas-receber", label: "Contas a receber" },
  { to: "/app/transferencias", label: "Transferências" },
  { to: "/app/fluxo-caixa", label: "Fluxo de caixa" },
  { to: "/app/conciliacao", label: "Conciliação" },
  { to: "/app/perfil", label: "Meu perfil" },
  { to: "/app/configuracoes", label: "Configurações" },
  { to: "/app/relatorios", label: "Relatórios" },
  { to: "/app/assinatura", label: "Assinatura" },
];

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [user]);

  // ⌘K / Ctrl+K focuses the search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("topbar-search") as HTMLInputElement | null;
        el?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_ITEMS.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const weekday = format(now, "EEE, dd", { locale: ptBR });
  const time = format(now, "HH:mm");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur md:h-[68px] md:px-6">
      {/* Date / time chip */}
      <div className="hidden items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2 shadow-[var(--shadow-card)] md:flex">
        <div className="text-right">
          <p className="text-[10px] uppercase leading-none tracking-wider text-muted-foreground">
            {weekday}
          </p>
          <p className="text-sm font-semibold leading-tight tabular-nums text-foreground">
            {time}
          </p>
        </div>
      </div>

      {/* Search pill */}
      <div className="relative mx-auto w-full max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="topbar-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar..."
          className="h-11 rounded-full border-border/60 bg-card pl-11 pr-20 shadow-[var(--shadow-card)] focus-visible:ring-1"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border/60 bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
          ⌘ K
        </kbd>
        {open && results.length > 0 ? (
          <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-[var(--shadow-elevated)]">
            {results.map((r) => (
              <button
                key={r.to}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  navigate({ to: r.to });
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent/10"
              >
                <Search className="h-3 w-3 text-muted-foreground" />
                {r.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <IconBtn title="Configurações" to="/app/configuracoes">
          <Settings className="h-[18px] w-[18px]" />
        </IconBtn>
        <IconBtn title="Ajuda" to="/app/configuracoes">
          <HelpCircle className="h-[18px] w-[18px]" />
        </IconBtn>
        <IconBtn title="Notificações" badge>
          <Bell className="h-[18px] w-[18px]" />
        </IconBtn>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full border border-border/60 bg-card p-1 pr-3 shadow-[var(--shadow-card)] transition-colors hover:bg-muted">
              <Avatar className="h-8 w-8">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="Avatar" /> : null}
                <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-sm font-medium md:inline">
                {profile?.full_name || user?.email}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{profile?.full_name || "Minha conta"}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/app/perfil">
                <UserIcon className="mr-2 h-4 w-4" /> Meu perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/app/perfil" hash="senha">
                <KeyRound className="mr-2 h-4 w-4" /> Alterar senha
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/app/configuracoes">
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function IconBtn({
  children,
  title,
  to,
  badge,
}: {
  children: React.ReactNode;
  title: string;
  to?: string;
  badge?: boolean;
}) {
  const cls =
    "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted hover:text-foreground";
  if (to) {
    return (
      <Button asChild variant="ghost" size="icon" title={title} className={cls}>
        <Link to={to}>{children}</Link>
      </Button>
    );
  }
  return (
    <button type="button" title={title} className={cls}>
      {children}
      {badge ? (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
      ) : null}
    </button>
  );
}
