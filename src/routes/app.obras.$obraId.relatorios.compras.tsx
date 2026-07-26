import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileBarChart2, FileDown, FileSpreadsheet, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv, fmtDate as fmtDateCsv, fmtNum } from "@/lib/csv-export";
import { useServerFn } from "@tanstack/react-start";
import { sendRdoWhatsApp } from "@/lib/whatsapp.functions";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/app/obras/$obraId/relatorios/compras")({
  component: RelCompras,
});

type Compra = {
  id: string;
  data_compra: string;
  descricao: string | null;
  valor_total: number;
  status: string;
  forma_pagamento: string;
  fornecedor_id: string | null;
  etapa_id: string | null;
  natureza: string | null;
  numero: string | null;
};

function RelCompras() {
  const { obraId } = Route.useParams();
  const hoje = new Date().toISOString().slice(0, 10);
  const ini = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().slice(0, 10);
  const [de, setDe] = useState(ini);
  const [ate, setAte] = useState(hoje);
  const [fFornecedor, setFFornecedor] = useState<string>("__all");
  const [fEtapa, setFEtapa] = useState<string>("__all");
  const [fNf, setFNf] = useState("");
  const [items, setItems] = useState<Compra[]>([]);
  const [fornec, setFornec] = useState<Record<string, string>>({});
  const [etapas, setEtapas] = useState<{ id: string; nome: string }[]>([]);
  const [nfByCompra, setNfByCompra] = useState<Record<string, string>>({});
  const [obraNome, setObraNome] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsNum, setWhatsNum] = useState("");
  const [sendingWhats, setSendingWhats] = useState(false);
  const sendWhats = useServerFn(sendRdoWhatsApp);

  useEffect(() => {
    void (async () => {
      const [{ data: obra }, { data: es }] = await Promise.all([
        supabase.from("obras").select("name,contact_whatsapp,customer_id").eq("id", obraId).maybeSingle(),
        supabase.from("orcamento_etapas").select("id,nome,ordem").eq("obra_id", obraId).order("ordem"),
      ]);
      if (obra) {
        setObraNome(obra.name);
        setCustomerId(obra.customer_id);
        if (obra.contact_whatsapp) setWhatsNum(obra.contact_whatsapp);
      }
      setEtapas((es ?? []) as { id: string; nome: string }[]);
      const { data: fs } = await supabase.from("fornecedores").select("id,nome").order("nome");
      const map: Record<string, string> = {};
      (fs ?? []).forEach((x: any) => (map[x.id] = x.nome));
      setFornec(map);
    })();
  }, [obraId]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("compras")
        .select("id,numero,data_compra,descricao,valor_total,status,forma_pagamento,fornecedor_id,etapa_id,natureza")
        .eq("obra_id", obraId)
        .gte("data_compra", de)
        .lte("data_compra", ate)
        .order("data_compra", { ascending: false });
      let list = (data ?? []) as Compra[];
      if (fFornecedor !== "__all") list = list.filter((c) => c.fornecedor_id === fFornecedor);
      if (fEtapa !== "__all") list = list.filter((c) => c.etapa_id === fEtapa);
      setItems(list);
      if (list.length) {
        const { data: nfs } = await supabase
          .from("compra_notas_fiscais")
          .select("compra_id,numero")
          .in("compra_id", list.map((c) => c.id));
        const nfMap: Record<string, string> = {};
        (nfs ?? []).forEach((n: any) => { if (n.numero) nfMap[n.compra_id] = String(n.numero); });
        setNfByCompra(nfMap);
      } else setNfByCompra({});
    })();
  }, [obraId, de, ate, fFornecedor, fEtapa]);

  const filtered = useMemo(() => {
    if (!fNf.trim()) return items;
    const q = fNf.trim().toLowerCase();
    return items.filter((c) => (nfByCompra[c.id] ?? "").toLowerCase().includes(q) || (c.numero ?? "").toLowerCase().includes(q));
  }, [items, fNf, nfByCompra]);

  const total = filtered.reduce((s, c) => s + Number(c.valor_total || 0), 0);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const buildRows = () =>
    filtered.map((c) => [
      fmtDateCsv(c.data_compra),
      c.fornecedor_id ? fornec[c.fornecedor_id] ?? "—" : "—",
      c.descricao ?? "",
      c.natureza ?? "",
      c.forma_pagamento,
      nfByCompra[c.id] ?? c.numero ?? "",
      c.status,
      fmtNum(Number(c.valor_total)),
    ]);
  const headers = ["Data", "Fornecedor", "Descrição", "Natureza", "Pagamento", "NF", "Status", "Valor"];

  const exportarExcel = () => {
    downloadCsv(`compras-${obraNome}-${de}-${ate}.csv`, buildRows(), headers);
  };

  const gerarPdfDoc = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Relatório de Compras — ${obraNome}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${fmtDateCsv(de)} a ${fmtDateCsv(ate)}`, 14, 22);
    doc.text(`Total: ${brl(total)}  ·  ${filtered.length} compras`, 14, 28);
    autoTable(doc, {
      startY: 34,
      head: [headers],
      body: buildRows(),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    return doc;
  };

  const exportarPdf = () => {
    gerarPdfDoc().save(`compras-${obraNome}-${de}-${ate}.pdf`);
  };

  const enviarWhatsApp = async () => {
    if (!whatsNum.trim() || !customerId) return toast.error("Informe o número");
    setSendingWhats(true);
    try {
      const doc = gerarPdfDoc();
      const base64 = doc.output("datauristring").split(",")[1];
      const msg = `Relatório de compras — ${obraNome}\nPeríodo: ${fmtDateCsv(de)} a ${fmtDateCsv(ate)}\nTotal: ${brl(total)} · ${filtered.length} compras`;
      await sendWhats({ data: {
        customerId,
        obraId,
        phoneNumber: whatsNum,
        message: msg,
        fileName: `compras-${obraNome}-${de}-${ate}.pdf`,
        pdfBase64: base64,
      } });
      toast.success("Enviado por WhatsApp");
      setWhatsappOpen(false);
    } catch (e: any) {
      toast.error("Falha ao enviar", { description: e?.message });
    } finally {
      setSendingWhats(false);
    }
  };

  return (
    <div>
      <PageHeader title="Relatório de compras" description="Compras desta obra no período" info="Filtre por fornecedor, etapa, NF e período. Exporte em PDF ou Excel, ou envie por WhatsApp direto ao contato da obra." />
      <div className="space-y-4 p-8">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-1"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
              <div className="space-y-1"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
              <div className="space-y-1"><Label>Fornecedor</Label>
                <Select value={fFornecedor} onValueChange={setFFornecedor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos</SelectItem>
                    {Object.entries(fornec).map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Etapa</Label>
                <Select value={fEtapa} onValueChange={setFEtapa}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas</SelectItem>
                    {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Nota fiscal</Label><Input placeholder="nº NF" value={fNf} onChange={(e) => setFNf(e.target.value)} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportarPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={exportarExcel}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
              <Button variant="outline" size="sm" onClick={() => setWhatsappOpen(true)}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><FileBarChart2 className="h-4 w-4" /><span className="text-xs">Total</span></div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{brl(total)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Qtd. compras</span><p className="mt-1 text-2xl font-bold">{filtered.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Ticket médio</span><p className="mt-1 text-2xl font-bold tabular-nums">{brl(filtered.length ? total / filtered.length : 0)}</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Detalhamento</h3>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma compra no período.</p>
            ) : (
              <div className="space-y-1">
                {filtered.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b py-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{new Date(c.data_compra).toLocaleDateString("pt-BR")}</span>
                      <span className="text-muted-foreground">
                        {c.descricao ?? "—"} • {c.fornecedor_id ? fornec[c.fornecedor_id] ?? "—" : "—"}
                        {nfByCompra[c.id] ? ` • NF ${nfByCompra[c.id]}` : ""}
                      </span>
                      <Badge variant="outline" className="capitalize">{c.forma_pagamento}</Badge>
                      {c.natureza && <Badge variant="secondary" className="capitalize">{c.natureza}</Badge>}
                    </div>
                    <span className="font-semibold tabular-nums">{brl(Number(c.valor_total))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar relatório por WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Número (com DDD)</Label>
            <Input placeholder="(11) 99999-9999" value={whatsNum} onChange={(e) => setWhatsNum(e.target.value)} />
            <p className="text-xs text-muted-foreground">O PDF do relatório será anexado à mensagem.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>Cancelar</Button>
            <Button onClick={enviarWhatsApp} disabled={sendingWhats}>{sendingWhats ? "Enviando..." : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
