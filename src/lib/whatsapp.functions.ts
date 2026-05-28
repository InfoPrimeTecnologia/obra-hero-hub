import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  rdoId: z.string().uuid().optional(),
  obraId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  phoneNumber: z.string().min(8).max(20),
  message: z.string().min(1).max(4000),
  fileName: z.string().min(1).max(200).optional(),
  pdfBase64: z.string().optional(),
});

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

type ProviderAttempt = {
  kind: "file" | "text";
  httpStatus: number;
  ok: boolean;
  response: unknown;
};

async function postProvider(endpoint: string, token: string, payload: Record<string, unknown>) {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const txt = await resp.text();
  let body: unknown;
  try {
    body = JSON.parse(txt);
  } catch {
    body = { raw: txt };
  }
  return { ok: resp.ok, status: resp.status, body, raw: txt };
}

export const sendRdoWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const url = process.env.PRIMESYNC_URL;
    const token = process.env.PRIMESYNC_TOKEN;
    if (!url) throw new Error("PRIMESYNC_URL não configurada");
    if (!token) throw new Error("PRIMESYNC_TOKEN não configurada");

    const number = onlyDigits(data.phoneNumber);
    if (number.length < 10) throw new Error("Número de WhatsApp inválido");

    const endpoint = url.replace(/\/$/, "");
    const externalKey = data.rdoId ?? crypto.randomUUID();
    const textPayload = {
      number,
      body: data.message,
      externalKey,
      isClosed: false,
    };

    let status = "sent";
    let respJson: unknown = null;
    let errMsg: string | null = null;
    try {
      const attempts: ProviderAttempt[] = [];
      if (data.pdfBase64) {
        const cleanBase64 = data.pdfBase64.includes(",")
          ? data.pdfBase64.split(",")[1]
          : data.pdfBase64;
        const fileResult = await postProvider(`${endpoint}/base64`, token, {
          ...textPayload,
          base64Data: cleanBase64,
          mimeType: "application/pdf",
          fileName: data.fileName ?? "rdo.pdf",
        });
        attempts.push({
          kind: "file",
          httpStatus: fileResult.status,
          ok: fileResult.ok,
          response: fileResult.body,
        });
        if (fileResult.ok) {
          respJson = { attempts };
        }
      }

      if (!respJson) {
        const textResult = await postProvider(endpoint, token, textPayload);
        attempts.push({
          kind: "text",
          httpStatus: textResult.status,
          ok: textResult.ok,
          response: textResult.body,
        });
        respJson = { attempts };
        if (!textResult.ok) {
          status = "failed";
          errMsg = `HTTP ${textResult.status}: ${textResult.raw.slice(0, 500)}`;
        }
      }

      if (attempts.length === 0) {
        status = "failed";
        errMsg = "Nenhuma tentativa de envio foi executada";
      }
    } catch (e) {
      status = "failed";
      errMsg = e instanceof Error ? e.message : String(e);
    }

    await supabase.from("whatsapp_send_log").insert({
      customer_id: data.customerId,
      rdo_id: data.rdoId ?? null,
      obra_id: data.obraId ?? null,
      phone_number: number,
      message: data.message,
      file_name: data.fileName ?? null,
      provider: "primesync",
      status,
      response: respJson as never,
      error: errMsg,
      sent_by: userId,
    });

    if (status === "failed") throw new Error(errMsg ?? "Falha no envio");
    return { ok: true };
  });
