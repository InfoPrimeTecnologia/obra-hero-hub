import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

// ---------------- helpers ----------------

function fmtBRL(v: number) {
  return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number) {
  return `${Number(v ?? 0).toFixed(1)}%`;
}
function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

type HeaderInfo = {
  companyName: string;
  obraName: string;
  obraAddress?: string;
  reportTitle: string;
  reportSubtitle?: string;
};

function drawHeader(doc: jsPDF, info: HeaderInfo) {
  const pageW = doc.internal.pageSize.getWidth();
  // Faixa superior
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(info.companyName || "Mestre 360", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Mestre 360 · Gestão de Obras", pageW - 14, 14, { align: "right" });

  // Título
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(info.reportTitle, 14, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(info.obraName, 14, 40);
  if (info.obraAddress) doc.text(info.obraAddress, 14, 45);
  if (info.reportSubtitle) {
    doc.text(info.reportSubtitle, pageW - 14, 40, { align: "right" });
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 50, pageW - 14, 50);
  doc.setTextColor(15, 23, 42);
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} · Mestre 360`,
      14,
      pageH - 8,
    );
    doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 8, { align: "right" });
  }
}

async function fetchContext(obraId: string) {
  const { data: obra } = await supabase
    .from("obras")
    .select("id,name,customer_id,address_street,address_number,address_city,address_state")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra) throw new Error("Obra não encontrada");
  const { data: cust } = await supabase
    .from("customers")
    .select("company_name,name")
    .eq("id", obra.customer_id)
    .maybeSingle();
  const parts = [
    obra.address_street,
    obra.address_number,
    obra.address_city,
    obra.address_state,
  ].filter(Boolean);
  return {
    companyName: cust?.company_name || cust?.name || "Empresa",
    obraName: obra.name,
    obraAddress: parts.length > 0 ? parts.join(", ") : undefined,
  };
}

// ---------------- RDO ----------------

export async function exportRdoPdf(rdoId: string) {
  const { data: rdo } = await supabase
    .from("rdos")
    .select("id,obra_id,data,clima_manha,clima_tarde,clima_noite,condicao,responsavel,observacoes")
    .eq("id", rdoId)
    .maybeSingle();
  if (!rdo) throw new Error("RDO não encontrado");
  const ctx = await fetchContext(rdo.obra_id);

  const [{ data: atividades }, { data: equipes }, { data: ocorrencias }, { data: anexos }] = await Promise.all([
    supabase.from("rdo_atividades").select("descricao,percentual,orcamento_etapas(nome),orcamento_subetapas(nome)").eq("rdo_id", rdoId),
    supabase.from("rdo_equipes").select("empreiteiro,funcao,quantidade,horas").eq("rdo_id", rdoId),
    supabase.from("rdo_ocorrencias").select("tipo,descricao").eq("rdo_id", rdoId),
    supabase.from("rdo_anexos").select("storage_path,legenda,tipo").eq("rdo_id", rdoId).limit(12),
  ]);

  const doc = new jsPDF();
  drawHeader(doc, {
    companyName: ctx.companyName,
    obraName: ctx.obraName,
    obraAddress: ctx.obraAddress,
    reportTitle: "Relatório Diário de Obra (RDO)",
    reportSubtitle: `Data: ${fmtDate(rdo.data)}`,
  });

  let y = 56;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Condições e responsáveis", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
    head: [["Manhã", "Tarde", "Noite", "Condição", "Responsável"]],
    body: [[
      rdo.clima_manha ?? "-", rdo.clima_tarde ?? "-", rdo.clima_noite ?? "-",
      rdo.condicao ?? "-", rdo.responsavel ?? "-",
    ]],
  });

  const atRows = (atividades ?? []).map((a: any) => [
    a.orcamento_etapas?.nome ?? "-",
    a.orcamento_subetapas?.nome ?? "-",
    a.descricao ?? "-",
    fmtPct(a.percentual ?? 0),
  ]);
  if (atRows.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [["Etapa", "Subetapa", "Atividade", "% Executado"]],
      body: atRows,
    });
  }

  const eqRows = (equipes ?? []).map((e: any) => [
    e.empreiteiro ?? "-", e.funcao ?? "-", String(e.quantidade ?? 0), String(e.horas ?? 0),
  ]);
  if (eqRows.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [["Empreiteiro", "Função", "Qtd", "Horas"]],
      body: eqRows,
    });
  }

  const ocRows = (ocorrencias ?? []).map((o: any) => [o.tipo ?? "-", o.descricao ?? "-"]);
  if (ocRows.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [["Tipo", "Ocorrência"]],
      body: ocRows,
    });
  }

  if (rdo.observacoes) {
    const yAfter = (doc as any).lastAutoTable?.finalY ?? y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observações", 14, yAfter + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(rdo.observacoes, 180);
    doc.text(lines, 14, yAfter + 14);
  }

  // Fotos (referência)
  if ((anexos ?? []).length > 0) {
    doc.addPage();
    drawHeader(doc, {
      companyName: ctx.companyName,
      obraName: ctx.obraName,
      obraAddress: ctx.obraAddress,
      reportTitle: "RDO — Anexos",
      reportSubtitle: fmtDate(rdo.data),
    });
    autoTable(doc, {
      startY: 56,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [["Tipo", "Legenda", "Arquivo"]],
      body: (anexos ?? []).map((a: any) => [a.tipo ?? "foto", a.legenda ?? "-", a.storage_path]),
    });
  }

  drawFooter(doc);
  doc.save(`RDO_${fmtDate(rdo.data).replace(/\//g, "-")}_${ctx.obraName.replace(/\s+/g, "_")}.pdf`);
}

// ---------------- Orçado × Realizado ----------------

export async function exportOrcadoRealizadoPdf(obraId: string) {
  const ctx = await fetchContext(obraId);
  const [{ data: etapas }, { data: subs }, { data: compras }] = await Promise.all([
    supabase.from("orcamento_etapas").select("id,nome,ordem").eq("obra_id", obraId).order("ordem"),
    supabase.from("orcamento_subetapas").select("id,nome,valor_orcado,etapa_id,orcamento_etapas!inner(obra_id)").eq("orcamento_etapas.obra_id", obraId),
    supabase.from("compras").select("subetapa_id,etapa_id,valor_total").eq("obra_id", obraId),
  ]);

  const gastoBySub = new Map<string, number>();
  const gastoByEtapa = new Map<string, number>();
  (compras ?? []).forEach((c: any) => {
    if (c.subetapa_id) gastoBySub.set(c.subetapa_id, (gastoBySub.get(c.subetapa_id) ?? 0) + Number(c.valor_total ?? 0));
    if (c.etapa_id) gastoByEtapa.set(c.etapa_id, (gastoByEtapa.get(c.etapa_id) ?? 0) + Number(c.valor_total ?? 0));
  });

  const doc = new jsPDF();
  drawHeader(doc, {
    companyName: ctx.companyName,
    obraName: ctx.obraName,
    obraAddress: ctx.obraAddress,
    reportTitle: "Orçado × Realizado",
    reportSubtitle: new Date().toLocaleDateString("pt-BR"),
  });

  const rows: any[] = [];
  let totalOrc = 0, totalReal = 0;
  (etapas ?? []).forEach((e: any) => {
    const etapaSubs = (subs ?? []).filter((s: any) => s.etapa_id === e.id);
    const etapaOrc = etapaSubs.reduce((a: number, s: any) => a + Number(s.valor_orcado ?? 0), 0);
    const etapaReal = etapaSubs.reduce((a: number, s: any) => a + (gastoBySub.get(s.id) ?? 0), 0)
      + (gastoByEtapa.get(e.id) ?? 0);
    totalOrc += etapaOrc; totalReal += etapaReal;
    rows.push([
      { content: e.nome, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
      { content: fmtBRL(etapaOrc), styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
      { content: fmtBRL(etapaReal), styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
      { content: etapaOrc > 0 ? fmtPct((etapaReal / etapaOrc) * 100) : "-", styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
    ]);
    etapaSubs.forEach((s: any) => {
      const orc = Number(s.valor_orcado ?? 0);
      const real = gastoBySub.get(s.id) ?? 0;
      const pct = orc > 0 ? (real / orc) * 100 : 0;
      rows.push([
        `   ${s.nome}`,
        { content: fmtBRL(orc), styles: { halign: "right" } },
        { content: fmtBRL(real), styles: { halign: "right" } },
        { content: orc > 0 ? fmtPct(pct) : "-", styles: { halign: "right", textColor: pct >= 100 ? [220, 38, 38] : pct >= 90 ? [217, 119, 6] : [15, 23, 42] } },
      ]);
    });
  });

  autoTable(doc, {
    startY: 56,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
    head: [["Etapa / Subetapa", "Orçado", "Realizado", "% Consumo"]],
    body: rows,
    foot: [[
      { content: "TOTAL", styles: { fontStyle: "bold" } },
      { content: fmtBRL(totalOrc), styles: { fontStyle: "bold", halign: "right" } },
      { content: fmtBRL(totalReal), styles: { fontStyle: "bold", halign: "right" } },
      { content: totalOrc > 0 ? fmtPct((totalReal / totalOrc) * 100) : "-", styles: { fontStyle: "bold", halign: "right" } },
    ]],
    footStyles: { fillColor: [30, 41, 59], textColor: 255 },
  });

  drawFooter(doc);
  doc.save(`Orcado_x_Realizado_${ctx.obraName.replace(/\s+/g, "_")}.pdf`);
}

// ---------------- Medições ----------------

export async function exportMedicaoPdf(medicaoObraId: string) {
  const { data: med } = await supabase
    .from("medicoes_obra")
    .select("id,obra_id,numero,data,valor_total,status,observacoes")
    .eq("id", medicaoObraId)
    .maybeSingle();
  if (!med) throw new Error("Medição não encontrada");
  const ctx = await fetchContext(med.obra_id);

  const { data: itens } = await supabase
    .from("medicao_obra_itens")
    .select("descricao,percentual,valor,orcamento_etapas(nome),orcamento_subetapas(nome)")
    .eq("medicao_obra_id", medicaoObraId);

  const doc = new jsPDF();
  drawHeader(doc, {
    companyName: ctx.companyName,
    obraName: ctx.obraName,
    obraAddress: ctx.obraAddress,
    reportTitle: `Medição Nº ${med.numero ?? "-"}`,
    reportSubtitle: `Data: ${fmtDate(med.data)}`,
  });

  autoTable(doc, {
    startY: 56,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
    head: [["Etapa", "Subetapa", "Descrição", "% Avanço", "Valor"]],
    body: (itens ?? []).map((i: any) => [
      i.orcamento_etapas?.nome ?? "-",
      i.orcamento_subetapas?.nome ?? "-",
      i.descricao ?? "-",
      fmtPct(i.percentual ?? 0),
      { content: fmtBRL(i.valor ?? 0), styles: { halign: "right" } },
    ]),
    foot: [[
      { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold" } },
      { content: fmtBRL(med.valor_total ?? 0), styles: { fontStyle: "bold", halign: "right" } },
    ]],
    footStyles: { fillColor: [30, 41, 59], textColor: 255 },
  });

  if (med.observacoes) {
    const yAfter = (doc as any).lastAutoTable.finalY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observações", 14, yAfter + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(med.observacoes, 180);
    doc.text(lines, 14, yAfter + 14);
  }

  drawFooter(doc);
  doc.save(`Medicao_${med.numero ?? "s-n"}_${ctx.obraName.replace(/\s+/g, "_")}.pdf`);
}
