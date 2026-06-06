// Server-only helpers for custom auth email flows via Resend
import crypto from 'crypto';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const FROM = 'Mestre 360 <noreply@mestre360.com.br>';
const RESEND_GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

export type TokenType = 'signup' | 'recovery' | 'magic_link';

export function generateToken() {
  const raw = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function createToken(args: {
  email: string;
  type: TokenType;
  userId?: string | null;
  ttlMinutes: number;
}) {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + args.ttlMinutes * 60_000).toISOString();
  const { error } = await supabaseAdmin.from('auth_email_tokens').insert({
    email: args.email.toLowerCase(),
    type: args.type,
    user_id: args.userId ?? null,
    token_hash: hash,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Failed to create token: ${error.message}`);
  return raw;
}

export async function consumeToken(args: { token: string; type: TokenType }) {
  const hash = hashToken(args.token);
  const { data, error } = await supabaseAdmin
    .from('auth_email_tokens')
    .select('*')
    .eq('token_hash', hash)
    .eq('type', args.type)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Token lookup failed: ${error.message}`);
  if (!data) return null;

  const { error: updateError } = await supabaseAdmin
    .from('auth_email_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', data.id)
    .is('used_at', null);
  if (updateError) throw new Error(`Token consume failed: ${updateError.message}`);
  return data;
}

/** Returns true if a recent token of the same type was issued (<60s ago). */
export async function isOnCooldown(email: string, type: TokenType) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from('auth_email_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.toLowerCase())
    .eq('type', type)
    .gte('created_at', since);
  return (count ?? 0) > 0;
}

export async function sendEmail(args: { to: string; subject: string; html: string }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const res = await fetch(`${RESEND_GATEWAY_URL}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[sendEmail] Resend failed', { status: res.status, body, to: args.to, from: FROM });
    throw new Error(`Resend send failed [${res.status}]: ${body}`);
  }
  const json = await res.json();
  console.log('[sendEmail] sent', { to: args.to, id: json?.id });
  return json;
}

// ----- Templates -----
function wrap(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h1 style="margin:0 0 16px;font-size:22px;color:#111">Mestre 360</h1>
    ${inner}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px"/>
    <p style="font-size:12px;color:#888;margin:0">Você está recebendo este e-mail porque solicitou uma ação na sua conta Mestre 360. Se não foi você, ignore esta mensagem.</p>
  </div></body></html>`;
}

export function tplConfirmEmail(link: string) {
  return wrap(`
    <h2 style="font-size:18px;margin:0 0 12px">Confirme seu e-mail</h2>
    <p style="line-height:1.5;margin:0 0 24px">Bem-vindo ao Mestre 360! Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Confirmar e-mail</a></p>
    <p style="font-size:12px;color:#666;margin:0">Ou copie e cole este link no navegador:<br/><a href="${link}" style="color:#666">${link}</a></p>
    <p style="font-size:12px;color:#888;margin:16px 0 0">Este link expira em 1 hora.</p>
  `);
}

export function tplResetPassword(link: string) {
  return wrap(`
    <h2 style="font-size:18px;margin:0 0 12px">Redefinir sua senha</h2>
    <p style="line-height:1.5;margin:0 0 24px">Recebemos uma solicitação para redefinir a senha da sua conta Mestre 360. Clique no botão abaixo para criar uma nova senha.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Redefinir senha</a></p>
    <p style="font-size:12px;color:#666;margin:0">Ou copie e cole este link no navegador:<br/><a href="${link}" style="color:#666">${link}</a></p>
    <p style="font-size:12px;color:#888;margin:16px 0 0">Este link expira em 1 hora. Se você não solicitou, ignore este e-mail.</p>
  `);
}

export function tplMagicLink(link: string) {
  return wrap(`
    <h2 style="font-size:18px;margin:0 0 12px">Entrar no Mestre 360</h2>
    <p style="line-height:1.5;margin:0 0 24px">Clique no botão abaixo para entrar na sua conta. Nenhuma senha necessária.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Entrar agora</a></p>
    <p style="font-size:12px;color:#666;margin:0">Ou copie e cole este link no navegador:<br/><a href="${link}" style="color:#666">${link}</a></p>
    <p style="font-size:12px;color:#888;margin:16px 0 0">Este link expira em 15 minutos e só pode ser usado uma vez.</p>
  `);
}

export async function findUserByEmail(email: string) {
  // Paginate through admin.listUsers to find by email
  const lower = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === lower);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}
