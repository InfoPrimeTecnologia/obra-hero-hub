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
  kind: "file" | "attachment" | "text";
  fileName?: string;
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

async function postProviderMedia(
  endpoint: string,
  token: string,
  fields: Record<string, string>,
  file: { blob: Blob; fileName: string },
) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  form.append("media", file.blob, file.fileName);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
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

function blobFromBase64(base64: string, mimeType: string) {
  const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  return new Blob([Buffer.from(cleanBase64, "base64") as unknown as BlobPart], { type: mimeType });
}

function guessMimeType(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}

function fileNameFromPath(path: string) {
  return path.split("/").pop() || "anexo.jpg";
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
        const fileName = data.fileName ?? "rdo.pdf";
        const fileResult = await postProviderMedia(endpoint, token, {
          number,
          body: data.message,
          externalKey,
          isClosed: "false",
        }, {
          blob: blobFromBase64(data.pdfBase64, "application/pdf"),
          fileName,
        });
        attempts.push({
          kind: "file",
          fileName,
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

      if (respJson && data.rdoId) {
        const { data: attachments, error: attachmentsError } = await supabase
          .from("rdo_anexos")
          .select("id,storage_path,legenda,tipo")
          .eq("rdo_id", data.rdoId)
          .eq("customer_id", data.customerId);

        if (attachmentsError) {
          errMsg = attachmentsError.message;
        } else {
          for (const attachment of attachments ?? []) {
            if (attachment.tipo !== "foto") continue;
            const fileName = fileNameFromPath(attachment.storage_path);
            const { data: blob, error: downloadError } = await supabase.storage
              .from("obra-fotos")
              .download(attachment.storage_path);

            if (downloadError || !blob) {
              attempts.push({
                kind: "attachment",
                fileName,
                httpStatus: 0,
                ok: false,
                response: { error: downloadError?.message ?? "Anexo não encontrado" },
              });
              continue;
            }

            const attachmentResult = await postProviderMedia(endpoint, token, {
              number,
              body: attachment.legenda || `Anexo do RDO: ${fileName}`,
              externalKey: `${externalKey}-${attachment.id}`,
              isClosed: "false",
            }, {
              blob: new Blob([await blob.arrayBuffer()], { type: blob.type || guessMimeType(fileName) }),
              fileName,
            });

            attempts.push({
              kind: "attachment",
              fileName,
              httpStatus: attachmentResult.status,
              ok: attachmentResult.ok,
              response: attachmentResult.body,
            });
          }
        }

        const attachmentFailures = attempts.filter((attempt) => attempt.kind === "attachment" && !attempt.ok);
        if (attachmentFailures.length) {
          status = "partial";
          errMsg = `${attachmentFailures.length} anexo(s) não foram enviados`;
        }
        respJson = { attempts };
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
    const attempts =
      respJson && typeof respJson === "object" && "attempts" in respJson
        ? (respJson.attempts as ProviderAttempt[])
        : [];
    const attachmentsSent = attempts.filter((attempt) => attempt.kind === "attachment" && attempt.ok).length;
    const attachmentsFailed = attempts.filter((attempt) => attempt.kind === "attachment" && !attempt.ok).length;
    return { ok: true, attachmentsSent, attachmentsFailed };
  });
