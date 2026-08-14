import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileBarChart2,
  Download,
  FileSpreadsheet,
  FileText,
  HardHat,
  Package,
  Users,
  DollarSign,
  Receipt,
  ArrowDownToLine,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlanModules } from "@/lib/use-plan-modules";
import { downloadCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/app/relatorios")({
  component: RelatoriosPage,
});

type ColDef<T> = {
  key: keyof T | string;
  label: string;
  format?: (row: T) => string | number;
};

type ReportConfig<T = any> = {
  id: string;
  module: string;
  title: string;
  description: string;
  icon: typeof FileText;
  columns: ColDef<T>[];
  load: (params: { customerId: string; from: string; to: string; obraId?: string }) => Promise<T[]>;
  hasObraFilter?: boolean;
  summary?: (rows: T[]) => Array<{ label: string; value: string }>;
};

const fmtBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const fmtDate = (d?: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }) : "—");
const fmtNum = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n ?? 0);

const REPORTS: ReportConfig[] = [
  // ---------- OBRAS ----------
  {
    id: "obras-portfolio",
    module: "obras",
    title: "Portfólio de Obras",
    description: "Visão completa das obras: status, datas previstas, endereço e contato.",
    icon: HardHat,
    columns: [
      { key: "name", label: "Obra" },
      { key: "status", label: "Status" },
      { key: "start_date", label: "Início", format: (r: any) => fmtDate(r.start_date) },
      { key: "expected_end_date", label: "Previsão fim", format: (r: any) => fmtDate(r.expected_end_date) },
      { key: "address_city", label: "Cidade" },
      { key: "address_state", label: "UF" },
      { key: "contact_name", label: "Contato" },
      { key: "contact_whatsapp", label: "WhatsApp" },
    ],
    async load({ customerId }) {
      const { data } = await supabase
        .from("obras")
        .select("name,status,start_date,expected_end_date,address_city,address_state,contact_name,contact_whatsapp")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    summary: (rows) => [
      { label: "Total de obras", value: String(rows.length) },
      { label: "Ativas", value: String(rows.filter((r: any) => r.status === "active").length) },
    ],
  },
  // ---------- ESTOQUE ----------
  {
    id: "estoque-posicao",
    module: "estoque",
    title: "Posição de Estoque",
    description: "Saldo atual por produto/almoxarifado com custo médio e valor total.",
    icon: Package,
    columns: [
      { key: "produto", label: "Produto" },
      { key: "codigo", label: "Código" },
      { key: "almoxarifado", label: "Almoxarifado" },
      { key: "unidade", label: "Un" },
      { key: "quantidade", label: "Quantidade", format: (r: any) => fmtNum(r.quantidade) },
      { key: "custo_medio", label: "Custo médio", format: (r: any) => fmtBRL(r.custo_medio) },
      { key: "valor_total", label: "Valor total", format: (r: any) => fmtBRL(r.valor_total) },
    ],
    async load({ customerId }) {
      const { data } = await supabase
        .from("estoque_saldos")
        .select("quantidade,custo_medio,produtos(nome,codigo,unidade),almoxarifados(nome)")
        .eq("customer_id", customerId);
      return (data ?? []).map((r: any) => ({
        produto: r.produtos?.nome ?? "—",
        codigo: r.produtos?.codigo ?? "—",
        almoxarifado: r.almoxarifados?.nome ?? "—",
        unidade: r.produtos?.unidade ?? "un",
        quantidade: Number(r.quantidade ?? 0),
        custo_medio: Number(r.custo_medio ?? 0),
        valor_total: Number(r.quantidade ?? 0) * Number(r.custo_medio ?? 0),
      }));
    },
    summary: (rows) => [
      { label: "Itens em estoque", value: String(rows.length) },
      {
        label: "Valor total",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + r.valor_total, 0)),
      },
    ],
  },
  {
    id: "estoque-baixo",
    module: "estoque",
    title: "Estoque Mínimo / Ruptura",
    description: "Produtos com saldo abaixo do mínimo configurado.",
    icon: AlertTriangle,
    columns: [
      { key: "produto", label: "Produto" },
      { key: "codigo", label: "Código" },
      { key: "estoque_minimo", label: "Mínimo", format: (r: any) => fmtNum(r.estoque_minimo) },
      { key: "saldo_total", label: "Saldo atual", format: (r: any) => fmtNum(r.saldo_total) },
      { key: "deficit", label: "Déficit", format: (r: any) => fmtNum(r.deficit) },
    ],
    async load({ customerId }) {
      const { data: prods } = await supabase
        .from("produtos")
        .select("id,nome,codigo,estoque_minimo")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .gt("estoque_minimo", 0);
      const { data: saldos } = await supabase
        .from("estoque_saldos")
        .select("produto_id,quantidade")
        .eq("customer_id", customerId);
      const totals = new Map<string, number>();
      (saldos ?? []).forEach((s: any) => {
        totals.set(s.produto_id, (totals.get(s.produto_id) ?? 0) + Number(s.quantidade ?? 0));
      });
      return (prods ?? [])
        .map((p: any) => {
          const saldo = totals.get(p.id) ?? 0;
          return {
            produto: p.nome,
            codigo: p.codigo ?? "—",
            estoque_minimo: Number(p.estoque_minimo ?? 0),
            saldo_total: saldo,
            deficit: Math.max(0, Number(p.estoque_minimo ?? 0) - saldo),
          };
        })
        .filter((r) => r.saldo_total < r.estoque_minimo);
    },
    summary: (rows) => [{ label: "Itens em alerta", value: String(rows.length) }],
  },
  {
    id: "estoque-movimentacoes",
    module: "estoque",
    title: "Movimentações de Estoque",
    description: "Entradas, saídas, transferências e ajustes no período.",
    icon: BarChart3,
    columns: [
      { key: "data", label: "Data", format: (r: any) => fmtDate(r.data) },
      { key: "tipo", label: "Tipo" },
      { key: "produto", label: "Produto" },
      { key: "almoxarifado", label: "Almoxarifado" },
      { key: "quantidade", label: "Qtd", format: (r: any) => fmtNum(r.quantidade) },
      { key: "custo_unitario", label: "Custo un.", format: (r: any) => fmtBRL(r.custo_unitario) },
      { key: "total", label: "Total", format: (r: any) => fmtBRL(r.total) },
      { key: "origem", label: "Origem" },
    ],
    async load({ customerId, from, to }) {
      const { data } = await supabase
        .from("estoque_movimentacoes")
        .select("data,tipo,quantidade,custo_unitario,origem,produtos(nome),almoxarifados(nome)")
        .eq("customer_id", customerId)
        .gte("data", from)
        .lte("data", to)
        .order("data", { ascending: false });
      return (data ?? []).map((r: any) => ({
        data: r.data,
        tipo: r.tipo,
        produto: r.produtos?.nome ?? "—",
        almoxarifado: r.almoxarifados?.nome ?? "—",
        quantidade: Number(r.quantidade ?? 0),
        custo_unitario: Number(r.custo_unitario ?? 0),
        total: Number(r.quantidade ?? 0) * Number(r.custo_unitario ?? 0),
        origem: r.origem,
      }));
    },
    summary: (rows) => [
      { label: "Movimentos", value: String(rows.length) },
      {
        label: "Total movimentado",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + r.total, 0)),
      },
    ],
  },
  // ---------- RH ----------
  {
    id: "rh-colaboradores",
    module: "rh",
    title: "Colaboradores Ativos",
    description: "Quadro de colaboradores com cargo, vínculo e remuneração.",
    icon: Users,
    columns: [
      { key: "nome", label: "Nome" },
      { key: "cargo", label: "Cargo" },
      { key: "vinculo", label: "Vínculo" },
      { key: "cpf", label: "CPF" },
      { key: "telefone", label: "Telefone" },
      { key: "data_entrada", label: "Admissão", format: (r: any) => fmtDate(r.data_entrada) },
      { key: "remuneracao", label: "Remuneração", format: (r: any) => fmtBRL(r.remuneracao) },
    ],
    async load({ customerId }) {
      const { data } = await supabase
        .from("colaboradores")
        .select("nome,cargo,vinculo,cpf,telefone,data_entrada,remuneracao,ativo")
        .eq("customer_id", customerId)
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
    summary: (rows) => [
      { label: "Colaboradores", value: String(rows.length) },
      {
        label: "Folha estimada",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + Number(r.remuneracao ?? 0), 0)),
      },
    ],
  },
  // ---------- FINANCEIRO ----------
  {
    id: "fin-contas-pagar",
    module: "financeiro",
    title: "Contas a Pagar",
    description: "Títulos com vencimento no período, com status e valores.",
    icon: Receipt,
    columns: [
      { key: "descricao", label: "Descrição" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "vencimento", label: "Vencimento", format: (r: any) => fmtDate(r.vencimento) },
      { key: "valor", label: "Valor", format: (r: any) => fmtBRL(r.valor) },
      { key: "valor_pago", label: "Pago", format: (r: any) => fmtBRL(r.valor_pago) },
      { key: "status", label: "Status" },
      { key: "origem", label: "Origem" },
    ],
    async load({ customerId, from, to }) {
      const { data } = await supabase
        .from("contas_pagar")
        .select("descricao,vencimento,valor,valor_pago,status,origem,fornecedores(nome)")
        .eq("customer_id", customerId)
        .gte("vencimento", from)
        .lte("vencimento", to)
        .order("vencimento");
      return (data ?? []).map((r: any) => ({
        ...r,
        fornecedor: r.fornecedores?.nome ?? "—",
      }));
    },
    summary: (rows) => [
      { label: "Títulos", value: String(rows.length) },
      {
        label: "Total a pagar",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0)),
      },
      {
        label: "Pago",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + Number(r.valor_pago ?? 0), 0)),
      },
    ],
  },
  {
    id: "fin-contas-receber",
    module: "financeiro",
    title: "Contas a Receber",
    description: "Recebíveis com vencimento no período.",
    icon: ArrowDownToLine,
    columns: [
      { key: "descricao", label: "Descrição" },
      { key: "vencimento", label: "Vencimento", format: (r: any) => fmtDate(r.vencimento) },
      { key: "valor", label: "Valor", format: (r: any) => fmtBRL(r.valor) },
      { key: "valor_recebido", label: "Recebido", format: (r: any) => fmtBRL(r.valor_recebido) },
      { key: "status", label: "Status" },
      { key: "origem", label: "Origem" },
    ],
    async load({ customerId, from, to }) {
      const { data } = await supabase
        .from("contas_receber")
        .select("descricao,vencimento,valor,valor_recebido,status,origem")
        .eq("customer_id", customerId)
        .gte("vencimento", from)
        .lte("vencimento", to)
        .order("vencimento");
      return data ?? [];
    },
    summary: (rows) => [
      { label: "Títulos", value: String(rows.length) },
      {
        label: "Total a receber",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0)),
      },
      {
        label: "Recebido",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + Number(r.valor_recebido ?? 0), 0)),
      },
    ],
  },
  {
    id: "fin-fluxo-caixa",
    module: "financeiro",
    title: "Fluxo de Caixa",
    description: "Lançamentos efetivados no período com saldo acumulado.",
    icon: BarChart3,
    columns: [
      { key: "data", label: "Data", format: (r: any) => fmtDate(r.data) },
      { key: "descricao", label: "Descrição" },
      { key: "conta", label: "Conta" },
      { key: "tipo", label: "Tipo" },
      { key: "valor", label: "Valor", format: (r: any) => fmtBRL(r.valor) },
      { key: "saldo", label: "Saldo acumulado", format: (r: any) => fmtBRL(r.saldo) },
    ],
    async load({ customerId, from, to }) {
      const { data } = await supabase
        .from("lancamentos")
        .select("data,descricao,tipo,valor,contas_bancarias(nome)")
        .eq("customer_id", customerId)
        .eq("estornado", false)
        .gte("data", from)
        .lte("data", to)
        .order("data");
      let acc = 0;
      return (data ?? []).map((r: any) => {
        const v = Number(r.valor ?? 0) * (r.tipo === "entrada" ? 1 : -1);
        acc += v;
        return {
          data: r.data,
          descricao: r.descricao,
          conta: r.contas_bancarias?.nome ?? "—",
          tipo: r.tipo,
          valor: v,
          saldo: acc,
        };
      });
    },
    summary: (rows) => {
      const entradas = rows
        .filter((r: any) => r.valor > 0)
        .reduce((s: number, r: any) => s + r.valor, 0);
      const saidas = rows
        .filter((r: any) => r.valor < 0)
        .reduce((s: number, r: any) => s + r.valor, 0);
      return [
        { label: "Entradas", value: fmtBRL(entradas) },
        { label: "Saídas", value: fmtBRL(Math.abs(saidas)) },
        { label: "Resultado", value: fmtBRL(entradas + saidas) },
      ];
    },
  },
  {
    id: "fin-compras",
    module: "financeiro",
    title: "Compras por Obra/Fornecedor",
    description: "Compras realizadas no período, agrupadas por status.",
    icon: DollarSign,
    columns: [
      { key: "data_compra", label: "Data", format: (r: any) => fmtDate(r.data_compra) },
      { key: "numero", label: "Nº" },
      { key: "descricao", label: "Descrição" },
      { key: "obra", label: "Obra" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "forma_pagamento", label: "Pagamento" },
      { key: "qtd_parcelas", label: "Parcelas" },
      { key: "valor_total", label: "Total", format: (r: any) => fmtBRL(r.valor_total) },
      { key: "status", label: "Status" },
    ],
    async load({ customerId, from, to }) {
      const { data } = await supabase
        .from("compras")
        .select("data_compra,numero,descricao,forma_pagamento,qtd_parcelas,valor_total,status,obras(name),fornecedores(nome)")
        .eq("customer_id", customerId)
        .gte("data_compra", from)
        .lte("data_compra", to)
        .order("data_compra", { ascending: false });
      return (data ?? []).map((r: any) => ({
        ...r,
        obra: r.obras?.name ?? "—",
        fornecedor: r.fornecedores?.nome ?? "—",
      }));
    },
    summary: (rows) => [
      { label: "Compras", value: String(rows.length) },
      {
        label: "Total comprado",
        value: fmtBRL(rows.reduce((s: number, r: any) => s + Number(r.valor_total ?? 0), 0)),
      },
    ],
  },
  // ---------- ORÇADO VS REALIZADO ----------
  {
    id: "orcado-vs-realizado",
    module: "obras",
    title: "Orçado vs Realizado (etapas e subetapas)",
    description: "Compara o valor orçado com o gasto efetivo (compras) por etapa e por subetapa. Use o filtro de obra para analisar uma obra específica.",
    icon: BarChart3,
    hasObraFilter: true,
    columns: [
      { key: "obra", label: "Obra" },
      { key: "nivel", label: "Nível" },
      { key: "etapa", label: "Etapa" },
      { key: "subetapa", label: "Subetapa" },
      { key: "orcado", label: "Orçado", format: (r: any) => fmtBRL(r.orcado) },
      { key: "realizado", label: "Realizado", format: (r: any) => fmtBRL(r.realizado) },
      { key: "saldo", label: "Saldo", format: (r: any) => fmtBRL(r.saldo) },
      { key: "avanco", label: "% Realizado", format: (r: any) => `${(r.avanco ?? 0).toFixed(1)}%` },
      {
        key: "alerta", label: "Status",
        format: (r: any) => r.orcado === 0 ? "Sem orçamento" : r.avanco >= 100 ? "Estourado" : r.avanco >= 80 ? "Alerta" : "OK",
      },
    ],
    async load({ customerId, obraId }) {
      let q = supabase
        .from("orcamento_etapas")
        .select("id,nome,obra_id,obras(name),orcamento_subetapas(id,nome,valor_orcado)")
        .eq("customer_id", customerId)
        .order("ordem");
      if (obraId) q = q.eq("obra_id", obraId);
      const { data: etapas } = await q;

      let qi = supabase
        .from("compra_itens")
        .select("etapa_id,subetapa_id,valor_total")
        .eq("customer_id", customerId);
      const { data: itens } = await qi;

      const etapaIds = new Set((etapas ?? []).map((e: any) => e.id));
      const realizadoPorEtapa = new Map<string, number>();
      const realizadoPorSub = new Map<string, number>();
      for (const it of itens ?? []) {
        const v = Number(it.valor_total ?? 0);
        if (it.etapa_id && etapaIds.has(it.etapa_id)) {
          realizadoPorEtapa.set(it.etapa_id, (realizadoPorEtapa.get(it.etapa_id) ?? 0) + v);
        }
        if (it.subetapa_id) {
          realizadoPorSub.set(it.subetapa_id, (realizadoPorSub.get(it.subetapa_id) ?? 0) + v);
        }
      }

      const rows: any[] = [];
      for (const e of (etapas ?? []) as any[]) {
        const subs = e.orcamento_subetapas ?? [];
        const orcado = subs.reduce((s: number, sub: any) => s + Number(sub.valor_orcado ?? 0), 0);
        const realizado = realizadoPorEtapa.get(e.id) ?? 0;
        rows.push({
          obra: e.obras?.name ?? "—",
          nivel: "Etapa",
          etapa: e.nome,
          subetapa: "—",
          orcado,
          realizado,
          saldo: orcado - realizado,
          avanco: orcado > 0 ? (realizado / orcado) * 100 : 0,
        });
        for (const sub of subs) {
          const so = Number(sub.valor_orcado ?? 0);
          const sr = realizadoPorSub.get(sub.id) ?? 0;
          rows.push({
            obra: e.obras?.name ?? "—",
            nivel: "Subetapa",
            etapa: e.nome,
            subetapa: sub.nome,
            orcado: so,
            realizado: sr,
            saldo: so - sr,
            avanco: so > 0 ? (sr / so) * 100 : 0,
          });
        }
      }
      return rows;
    },
    summary: (rows) => {
      const etapasRows = rows.filter((r: any) => r.nivel === "Etapa");
      const orc = etapasRows.reduce((s: number, r: any) => s + Number(r.orcado ?? 0), 0);
      const real = etapasRows.reduce((s: number, r: any) => s + Number(r.realizado ?? 0), 0);
      return [
        { label: "Etapas", value: String(etapasRows.length) },
        { label: "Subetapas", value: String(rows.length - etapasRows.length) },
        { label: "Total orçado", value: fmtBRL(orc) },
        { label: "Total realizado", value: fmtBRL(real) },
        { label: "Saldo geral", value: fmtBRL(orc - real) },
        { label: "% Avanço", value: `${orc > 0 ? ((real / orc) * 100).toFixed(1) : "0"}%` },
      ];
    },
  },
];

function RelatoriosPage() {
  const { user } = useAuth();
  const { has } = usePlanModules();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [active, setActive] = useState<string>(REPORTS[0].id);
  const [obraFiltro, setObraFiltro] = useState<string>("todas");
  const [obrasLista, setObrasLista] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const visibleReports = useMemo(() => REPORTS.filter((r) => has(r.module)), [has]);
  const current = visibleReports.find((r) => r.id === active) ?? visibleReports[0];

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("customers")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setCustomerId(data?.id ?? null));
  }, [user]);

  useEffect(() => {
    if (!customerId) return;
    void supabase
      .from("obras")
      .select("id,name")
      .eq("customer_id", customerId)
      .order("name")
      .then(({ data }) => setObrasLista((data ?? []) as any));
  }, [customerId]);

  useEffect(() => {
    if (visibleReports.length && !visibleReports.some((r) => r.id === active)) {
      setActive(visibleReports[0].id);
    }
  }, [visibleReports, active]);

  useEffect(() => {
    if (!customerId || !current) return;
    setLoading(true);
    current
      .load({ customerId, from, to, obraId: obraFiltro === "todas" ? undefined : obraFiltro })
      .then((r) => setRows(r))
      .finally(() => setLoading(false));
  }, [customerId, current, from, to, obraFiltro]);

  const exportXLSX = () => {
    if (!current) return;
    const data = rows.map((r) => {
      const o: Record<string, any> = {};
      current.columns.forEach((c) => {
        o[c.label] = c.format ? c.format(r) : (r as any)[c.key as string];
      });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, current.title.slice(0, 28));
    XLSX.writeFile(wb, `${current.id}_${from}_${to}.xlsx`);
  };

  const exportCSV = () => {
    if (!current) return;
    const headers = current.columns.map((c) => c.label);
    const data = rows.map((r) =>
      current.columns.map((c) => (c.format ? c.format(r) : ((r as any)[c.key as string] ?? ""))),
    );
    downloadCsv(`${current.id}_${from}_${to}`, data, headers);
  };

  const exportPDF = () => {
    if (!current) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(current.title, 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      `${current.description}  ·  Período: ${fmtDate(from)} a ${fmtDate(to)}  ·  Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      40,
      58,
    );
    const summary = current.summary?.(rows) ?? [];
    if (summary.length) {
      doc.setTextColor(0);
      doc.setFontSize(10);
      let y = 80;
      summary.forEach((s) => {
        doc.text(`${s.label}: ${s.value}`, 40, y);
        y += 14;
      });
    }
    autoTable(doc, {
      startY: 80 + summary.length * 14 + 10,
      head: [current.columns.map((c) => c.label)],
      body: rows.map((r) =>
        current.columns.map((c) =>
          String(c.format ? c.format(r) : ((r as any)[c.key as string] ?? "")),
        ),
      ),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [27, 44, 92] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save(`${current.id}_${from}_${to}.pdf`);
  };

  const summary = current?.summary?.(rows) ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <FileBarChart2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Visões consolidadas dos seus dados — exporte em Excel ou PDF.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="grid gap-1">
            <Label htmlFor="from">De</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to">Até</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {current?.hasObraFilter && (
            <div className="grid gap-1">
              <Label>Obra</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={obraFiltro}
                onChange={(e) => setObraFiltro(e.target.value)}
              >
                <option value="todas">Todas as obras</option>
                {obrasLista.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportCSV} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={exportXLSX} disabled={!rows.length}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button onClick={exportPDF} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {visibleReports.map((r) => {
            const Icon = r.icon;
            return (
              <TabsTrigger key={r.id} value={r.id} className="gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{r.title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {visibleReports.map((r) => (
          <TabsContent key={r.id} value={r.id} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <r.icon className="h-5 w-5 text-primary" />
                  {r.title}
                </CardTitle>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              {summary.length && r.id === current?.id ? (
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {summary.map((s) => (
                    <div key={s.label} className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-semibold">{s.value}</p>
                    </div>
                  ))}
                </CardContent>
              ) : null}
            </Card>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    Nenhum dado encontrado para o período selecionado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {r.columns.map((c) => (
                          <TableHead key={String(c.key)}>{c.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 200).map((row, i) => (
                        <TableRow
                          key={i}
                          className={
                            (row as any).nivel === "Etapa"
                              ? "bg-primary/10 font-semibold hover:bg-primary/15"
                              : (row as any).nivel === "Subetapa"
                                ? "bg-muted/30"
                                : undefined
                          }
                        >
                          {r.columns.map((c) => {
                            const val = c.format ? c.format(row) : (row as any)[c.key as string];
                            const isStatus = c.key === "status";
                            return (
                              <TableCell key={String(c.key)}>
                                {isStatus ? (
                                  <Badge variant="outline">{String(val ?? "—")}</Badge>
                                ) : (
                                  String(val ?? "—")
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {rows.length > 200 ? (
                  <div className="border-t p-3 text-center text-xs text-muted-foreground">
                    Exibindo 200 de {rows.length} registros — exporte para ver todos.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
