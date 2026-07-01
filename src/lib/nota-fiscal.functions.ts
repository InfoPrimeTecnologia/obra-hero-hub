import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { XMLParser } from "fast-xml-parser";

export type NfItem = {
  descricao: string;
  unidade?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};
export type NfParsed = {
  fonte: "xml" | "ai";
  chave?: string | null;
  numero?: string | null;
  serie?: string | null;
  emissao?: string | null; // YYYY-MM-DD
  fornecedor: { nome: string; cnpj?: string | null };
  valor_total: number;
  itens: NfItem[];
};

function digits(s?: string | null) {
  return (s ?? "").replace(/\D/g, "");
}
function num(v: any): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isFinite(n) ? n : 0;
}

function parseNfeXml(xml: string): NfParsed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
    trimValues: true,
  });
  const doc = parser.parse(xml);
  // NFe root can be <nfeProc><NFe><infNFe> or <NFe><infNFe>
  const inf =
    doc?.nfeProc?.NFe?.infNFe ??
    doc?.NFe?.infNFe ??
    doc?.infNFe ??
    null;
  if (!inf) throw new Error("XML não é uma NFe válida (infNFe não encontrado).");

  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};
  const total = inf.total?.ICMSTot ?? {};
  const detRaw = inf.det ?? [];
  const dets = Array.isArray(detRaw) ? detRaw : [detRaw];

  const chave = (inf["Id"] ?? "").toString().replace(/^NFe/, "") || null;

  const itens: NfItem[] = dets
    .filter((d: any) => d?.prod)
    .map((d: any) => {
      const p = d.prod;
      return {
        descricao: String(p.xProd ?? "Item"),
        unidade: p.uCom ?? p.uTrib ?? null,
        quantidade: num(p.qCom ?? p.qTrib),
        valor_unitario: num(p.vUnCom ?? p.vUnTrib),
        valor_total: num(p.vProd),
      };
    });

  const emissaoRaw = String(ide.dhEmi ?? ide.dEmi ?? "");
  const emissao = emissaoRaw ? emissaoRaw.slice(0, 10) : null;

  return {
    fonte: "xml",
    chave,
    numero: ide.nNF ? String(ide.nNF) : null,
    serie: ide.serie ? String(ide.serie) : null,
    emissao,
    fornecedor: {
      nome: String(emit.xNome ?? emit.xFant ?? "Fornecedor"),
      cnpj: emit.CNPJ ? digits(emit.CNPJ) : emit.CPF ? digits(emit.CPF) : null,
    },
    valor_total: num(total.vNF),
    itens,
  };
}

async function parseWithOpenAi(fileBase64: string, mimeType: string): Promise<NfParsed> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const schemaInstruction = `Você recebe uma nota fiscal (DANFE em PDF ou foto). Extraia SOMENTE JSON válido no formato:
{
  "chave": string|null,
  "numero": string|null,
  "serie": string|null,
  "emissao": "YYYY-MM-DD"|null,
  "fornecedor": { "nome": string, "cnpj": string|null },
  "valor_total": number,
  "itens": [ { "descricao": string, "unidade": string|null, "quantidade": number, "valor_unitario": number, "valor_total": number } ]
}
Use ponto como separador decimal. CNPJ apenas com dígitos. Não invente dados: se não encontrar, use null. Não inclua texto fora do JSON.`;

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf" || mimeType.endsWith("/pdf");

  const userContent: any[] = [{ type: "text", text: schemaInstruction }];
  if (isImage) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${fileBase64}` },
    });
  } else if (isPdf) {
    userContent.push({
      type: "file",
      file: { filename: "nota.pdf", file_data: `data:application/pdf;base64,${fileBase64}` },
    });
  } else {
    throw new Error(`Tipo de arquivo não suportado para OCR: ${mimeType}`);
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um extrator de dados de notas fiscais brasileiras. Responda somente com JSON." },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao ler nota (${res.status}): ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("IA não retornou dados");
  let obj: any;
  try {
    obj = JSON.parse(content);
  } catch {
    throw new Error("Retorno da IA não é JSON válido");
  }
  return {
    fonte: "ai",
    chave: obj.chave ?? null,
    numero: obj.numero ?? null,
    serie: obj.serie ?? null,
    emissao: obj.emissao ?? null,
    fornecedor: {
      nome: String(obj.fornecedor?.nome ?? "Fornecedor"),
      cnpj: obj.fornecedor?.cnpj ? digits(obj.fornecedor.cnpj) : null,
    },
    valor_total: num(obj.valor_total),
    itens: Array.isArray(obj.itens)
      ? obj.itens.map((i: any) => ({
          descricao: String(i.descricao ?? "Item"),
          unidade: i.unidade ?? null,
          quantidade: num(i.quantidade),
          valor_unitario: num(i.valor_unitario),
          valor_total: num(i.valor_total),
        }))
      : [],
  };
}

export const parseNotaFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileBase64: string; mimeType: string; filename: string }) => {
    if (!data?.fileBase64) throw new Error("Arquivo obrigatório");
    if (!data?.mimeType) throw new Error("Tipo do arquivo obrigatório");
    return data;
  })
  .handler(async ({ data }): Promise<NfParsed> => {
    const isXml =
      data.mimeType.includes("xml") ||
      data.filename.toLowerCase().endsWith(".xml");
    if (isXml) {
      const xml = Buffer.from(data.fileBase64, "base64").toString("utf-8");
      return parseNfeXml(xml);
    }
    return parseWithOpenAi(data.fileBase64, data.mimeType);
  });
