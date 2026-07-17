import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileBarChart2, FileDown, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv, fmtDate as fmtDateCsv, fmtNum } from "@/lib/csv-export";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/app/obras/$obraId/relatorios/pagamentos")({
  component: RelPagamentos,
});

type CP = {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number | null;
  vencimento: string;
  pago_em: string | null;
  status: string;
  fornecedor_id: string | null;
  compra_id: string | null;
  categoria_id: string | null;
};
type CompraMeta = { forma_pagamento: string | null; natureza: string | null; nf: string | null };

function RelPagamentos() {
  const { obraId } = Route.useParams();
  const hoje = new Date().toISOString().slice(0, 10);
  const ini = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().slice(0, 10);
  const [de, setDe] = useState(ini);
  const [ate, setAte] = useState(hoje);
  const [tipoData, setTipoData] = useState<"vencimento" | "pago_em">("vencimento");
  const [fFornecedor, setFFornecedor] = useState("__all");
  const [fForma, setFForma] = useState("__all");
  const [fStatus, setFStatus] = useState("__all");
  const [fNatureza, setFNatureza] = useState("__all");
  const [fNf, setFNf] = useState("");
  const [items, setItems] = useState<CP[]>([]);
  const [fornec, setFornec] = useState<Record<string, string>>({});
  const [compraMeta, setCompraMeta] = useState<Record<string, CompraMeta>>({});
  const [obraNome, setObraNome] = useState("");

  useEffect(() => {
    void (async () => {
      const [{ data: obra }, { data: fs }] = await Promise.all([
        supabase.from("obras").select("name").eq("id", obraId).maybeSingle(),
        supabase.from("fornecedores").select("id,nome").order("nome"),
      ]);
      if (obra) setObraNome(obra.name);
      const map: Record<string, string> = {};
      (fs ?? []).forEach((x: any) => (map[x.id] = x.nome));
      setFornec(map);
    })();
  }, [obraId]);

  useEffect(() => {
    void (async () => {
      const col = tipoData === "vencimento" ? "vencimento" : "pago_em";
      const { data } = await supabase
        .from("contas_pagar")
        .select("id,descricao,valor,valor_pago,vencimento,pago_em,status,fornecedor_id,compra_id,categoria_id")
        .eq("obra_id", obraId)
        .gte(col, de)
        .lte(col, ate)
        .order(col, { ascending: false });
      let list = (data ?? []) as CP[];
      if (fFornecedor !== "__all") list = list.filter((c) => c.fornecedor_id === fFornecedor);
      if (fStatus !== "__all") list = list.filter((c) => c.status === fStatus);
      setItems(list);

      const compraIds = Array.from(new Set(list.map((c) => c.compra_id).filter(Boolean))) as string[];
      if (compraIds.length) {
        const [{ data: cs }, { data: nfs }] = await Promise.all([
          supabase.from("compras").select("id,natureza,forma_pagamento").in("id", compraIds),
          supabase.from("compra_notas_fiscais").select("compra_id,numero").in("compra_id", compraIds),
        ]);
        const nfMap: Record<string, string> = {};
        (nfs ?? []).forEach((n: any) => { if (n.numero) nfMap[n.compra_id] = String(n.numero); });
        const meta: Record<string, CompraMeta> = {};
        (cs ?? []).forEach((c: any) => {
          meta[c.id] = { natureza: c.natureza ?? null, forma_pagamento: c.forma_pagamento ?? null, nf: nfMap[c.id] ?? null };
        });
        setCompraMeta(meta);
      } else setCompraMeta({});
    })();
  }, [obraId, de, ate, tipoData, fFornecedor, fStatus]);

  const metaOf = (c: CP): CompraMeta => (c.compra_id ? compraMeta[c.compra_id] : undefined) ?? { forma_pagamento: null, natureza: null, nf: null };

  const filtered = useMemo(() => {
    let list = items;
    if (fForma !== "__all") list = list.filter((c) => (metaOf(c).forma_pagamento ?? "") === fForma);
    if (fNatureza !== "__all") list = list.filter((c) => (metaOf(c).natureza ?? "") === fNatureza);
    if (fNf.trim()) {
      const q = fNf.trim().toLowerCase();
      list = list.filter((c) => (metaOf(c).nf ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [items, fForma, fNatureza, fNf, compraMeta]);

  const pago = filtered.filter((i) => i.status === "pago").reduce((s, i) => s + Number(i.valor_pago ?? i.valor), 0);
  const pendente = filtered.filter((i) => i.status === "pendente").reduce((s, i) => s + Number(i.valor), 0);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const buildRows = () =>
    filtered.map((c) => [
      fmtDateCsv(c.vencimento),
      c.pago_em ? fmtDateCsv(c.pago_em) : "",
      c.fornecedor_id ? fornec[c.fornecedor_id] ?? "—" : "—",
      c.descricao,
      c.numero_documento ?? "",
      c.forma_pagamento ?? "",
      c.compra_id ? naturezasByCompra[c.compra_id] ?? "" : "",
      c.status,
      fmtNum(Number(c.valor_pago ?? c.valor)),
    ]);
  const headers = ["Vencimento", "Pago em", "Fornecedor", "Descrição", "NF", "Forma", "Natureza", "Status", "Valor"];

  const exportarExcel = () => downloadCsv(`pagamentos-${obraNome}-${de}-${ate}.csv`, buildRows(), headers);

  const exportarPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Relatório de Pagamentos — ${obraNome}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Período (${tipoData}): ${fmtDateCsv(de)} a ${fmtDateCsv(ate)}`, 14, 22);
    doc.text(`Pago: ${brl(pago)}  ·  Pendente: ${brl(pendente)}`, 14, 28);
    autoTable(doc, {
      startY: 34,
      head: [headers],
      body: buildRows(),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    doc.save(`pagamentos-${obraNome}-${de}-${ate}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Relatório de pagamentos" description="Contas a pagar e pagamentos da obra" />
      <div className="space-y-4 p-8">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
              <div className="space-y-1"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
              <div className="space-y-1"><Label>Tipo de data</Label>
                <Select value={tipoData} onValueChange={(v) => setTipoData(v as "vencimento" | "pago_em")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vencimento">Por vencimento</SelectItem>
                    <SelectItem value="pago_em">Por pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Nota fiscal</Label><Input placeholder="nº doc" value={fNf} onChange={(e) => setFNf(e.target.value)} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1"><Label>Fornecedor</Label>
                <Select value={fFornecedor} onValueChange={setFFornecedor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos</SelectItem>
                    {Object.entries(fornec).map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Forma de pagamento</Label>
                <Select value={fForma} onValueChange={setFForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Natureza</Label>
                <Select value={fNatureza} onValueChange={setFNatureza}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="equipamento">Equipamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportarPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={exportarExcel}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600"><FileBarChart2 className="h-4 w-4" /><span className="text-xs">Pago</span></div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{brl(pago)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive"><FileBarChart2 className="h-4 w-4" /><span className="text-xs">Pendente</span></div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{brl(pendente)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Total</span><p className="mt-1 text-2xl font-bold tabular-nums">{brl(pago + pendente)}</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Lançamentos</h3>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta no período.</p>
            ) : (
              <div className="space-y-1">
                {filtered.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b py-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === "pago" ? "default" : c.status === "cancelado" ? "destructive" : "outline"}>{c.status}</Badge>
                      <span>{new Date(c.vencimento).toLocaleDateString("pt-BR")}</span>
                      <span className="text-muted-foreground">
                        {c.descricao} • {c.fornecedor_id ? fornec[c.fornecedor_id] ?? "—" : "—"}
                        {c.numero_documento ? ` • NF ${c.numero_documento}` : ""}
                      </span>
                      {c.forma_pagamento && <Badge variant="outline" className="capitalize">{c.forma_pagamento}</Badge>}
                    </div>
                    <span className="font-semibold tabular-nums">{brl(Number(c.valor_pago ?? c.valor))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
