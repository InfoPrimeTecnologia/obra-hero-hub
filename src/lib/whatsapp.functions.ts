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

function base64ToUint8(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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

    const hasFile = !!data.pdfBase64;
    const endpoint = hasFile
      ? `${url.replace(/\/$/, "")}/SendMessageAPIFile`
      : `${url.replace(/\/$/, "")}/SendMessageAPI`;

    const form = new FormData();
    form.append("number", number);
    form.append("body", data.message);
    form.append("externalKey", data.rdoId ?? crypto.randomUUID());
    if (hasFile && data.pdfBase64) {
      const bytes = base64ToUint8(data.pdfBase64);
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([ab], { type: "application/pdf" });
      form.append("media", blob, data.fileName ?? "rdo.pdf");
    }

    let status = "sent";
    let respJson: unknown = null;
    let errMsg: string | null = null;
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const txt = await resp.text();
      try {
        respJson = JSON.parse(txt);
      } catch {
        respJson = { raw: txt };
      }
      if (!resp.ok) {
        status = "failed";
        errMsg = `HTTP ${resp.status}: ${txt.slice(0, 500)}`;
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
