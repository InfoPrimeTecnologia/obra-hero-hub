import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useObraSelecionada } from "@/lib/obra-context";

const SECTION_LABELS: Record<string, string> = {
  rh: "RH",
  orcamento: "Orçamento",
  planejamento: "Planejamento",
  rdo: "Diário de obra",
  fornecedores: "Fornecedores",
  compras: "Compras",
  consulta: "Consulta de preços",
  pagamentos: "Meio de pagamentos",
  "contas-pagar": "Contas a pagar",
  faturas: "Faturas cartão",
  caixa: "Caixa e bancos",
  relatorios: "Relatórios",
  "orcado-realizado": "Orçado x Realizado",
  medicoes: "Medições",
  gantt: "Gantt",
};

export function ObraBreadcrumb({ obraId }: { obraId: string }) {
  const location = useLocation();
  const { obra } = useObraSelecionada();
  const [empresaNome, setEmpresaNome] = useState<string>("");

  useEffect(() => {
    if (!obra?.empresa_id) {
      setEmpresaNome("");
      return;
    }
    void supabase
      .from("empresas")
      .select("nome")
      .eq("id", obra.empresa_id)
      .maybeSingle()
      .then(({ data }) => setEmpresaNome(data?.nome ?? ""));
  }, [obra?.empresa_id]);

  // Deriva trecho da seção do pathname
  const base = `/app/obras/${obraId}`;
  const rest = location.pathname.startsWith(base)
    ? location.pathname.slice(base.length).replace(/^\//, "")
    : "";
  const parts = rest.split("/").filter(Boolean);
  const sectionLabels = parts
    .filter((p) => !/^[0-9a-f-]{36}$/i.test(p))
    .map((p) => SECTION_LABELS[p] ?? p);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 border-b border-border/40 bg-background/60 px-6 py-2 text-xs text-muted-foreground"
    >
      <Link to="/app" className="flex items-center gap-1 hover:text-foreground">
        <Home className="h-3 w-3" />
        {empresaNome || "Empresa"}
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link
        to="/app/obras/$obraId"
        params={{ obraId }}
        className="hover:text-foreground"
      >
        {obra?.name ?? "Obra"}
      </Link>
      {sectionLabels.map((label, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          <span className={i === sectionLabels.length - 1 ? "text-foreground font-medium" : ""}>
            {label}
          </span>
        </span>
      ))}
    </nav>
  );
}
