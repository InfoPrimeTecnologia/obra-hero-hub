// Auth Email Hook - Recebe webhooks do Supabase Auth e envia via Resend (gateway Lovable)
// Endpoint público; segurança via assinatura standard-webhooks (SEND_EMAIL_HOOK_SECRET)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "Mestre360 <noreply@mestre360.com.br>";

interface AuthEmailPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function renderEmail(payload: AuthEmailPayload): { subject: string; html: string } {
  const { email_data } = payload;
  const actionLink = `${email_data.site_url}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

  const titles: Record<string, string> = {
    signup: "Confirme seu cadastro no Mestre360",
    recovery: "Redefinição de senha - Mestre360",
    magiclink: "Seu link de acesso ao Mestre360",
    invite: "Você foi convidado para o Mestre360",
    email_change: "Confirme seu novo email - Mestre360",
    reauthentication: "Código de reautenticação - Mestre360",
  };

  const ctas: Record<string, string> = {
    signup: "Confirmar email",
    recovery: "Redefinir senha",
    magiclink: "Entrar agora",
    invite: "Aceitar convite",
    email_change: "Confirmar novo email",
    reauthentication: "Confirmar",
  };

  const intros: Record<string, string> = {
    signup: "Bem-vindo ao Mestre360! Confirme seu email clicando no botão abaixo:",
    recovery: "Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:",
    magiclink: "Use o link abaixo para acessar sua conta:",
    invite: "Você foi convidado a fazer parte do Mestre360. Clique para aceitar:",
    email_change: "Confirme a alteração do seu email clicando abaixo:",
    reauthentication: `Seu código de verificação é: <strong style="font-size:24px;letter-spacing:4px;">${email_data.token}</strong>`,
  };

  const subject = titles[email_data.email_action_type] ?? "Notificação Mestre360";
  const cta = ctas[email_data.email_action_type] ?? "Acessar";
  const intro = intros[email_data.email_action_type] ?? "Você recebeu um email do Mestre360.";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr><td style="padding:40px 40px 24px;">
          <h1 style="margin:0 0 8px;font-size:24px;color:#0f172a;">Mestre360</h1>
          <h2 style="margin:24px 0 16px;font-size:20px;color:#0f172a;font-weight:600;">${subject}</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">${intro}</p>
          ${email_data.email_action_type !== "reauthentication" ? `
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:8px;background:#0f172a;">
              <a href="${actionLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">${cta}</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">Se o botão não funcionar, copie e cole este link no navegador:<br><span style="color:#475569;word-break:break-all;">${actionLink}</span></p>
          ` : ""}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 24px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Se você não solicitou este email, pode ignorá-lo com segurança.</p>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f8fafc;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">© Mestre360 - Gestão para Construção Civil</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!hookSecret || !lovableApiKey || !resendApiKey) {
      console.error("Missing required secrets");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    // Verifica assinatura standard-webhooks (formato: v1,whsec_xxx)
    const wh = new Webhook(hookSecret.replace("v1,whsec_", "").replace("whsec_", ""));
    const data = wh.verify(payload, headers) as AuthEmailPayload;

    const { subject, html } = renderEmail(data);

    const resendRes = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": resendApiKey,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [data.user.email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("Resend error:", resendRes.status, err);
      return new Response(JSON.stringify({ error: "Email send failed", details: err }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Auth email sent: ${data.email_data.email_action_type} → ${data.user.email}`);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Hook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
