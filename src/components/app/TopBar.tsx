import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, User as UserIcon, Settings, LogOut, KeyRound } from "lucide-react";
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
];

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [user]);

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

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar em todo o sistema..."
          className="h-10 rounded-full bg-muted/50 pl-9"
        />
        {open && results.length > 0 ? (
          <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
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
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent"
              >
                <Search className="h-3 w-3 text-muted-foreground" />
                {r.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" title="Configurações">
          <Link to="/app/configuracoes">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-accent">
              <Avatar className="h-8 w-8">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="Avatar" /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">
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
