import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import {
  consumeToken,
  createToken,
  findUserByEmail,
  isOnCooldown,
  sendEmail,
  tplConfirmEmail,
  tplMagicLink,
  tplResetPassword,
} from './auth-email.server';

const emailSchema = z.string().email().max(255).transform((s) => s.toLowerCase().trim());

function resolveBaseUrl(clientOrigin: string) {
  const override = process.env.APP_URL?.trim();
  const base = override && override.length > 0 ? override : clientOrigin;
  return base.replace(/\/$/, '');
}

function hasConfirmedMestreEmail(user: { email_confirmed_at?: string | null; app_metadata?: Record<string, unknown> }) {
  const customStatus = user.app_metadata?.mestre_email_confirmed;
  if (customStatus === false) return false;
  if (customStatus === true) return true;
  return !!user.email_confirmed_at;
}

async function userOwnsCustomer(userId: string) {
  const { count, error } = await supabaseAdmin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function hasCompanyOwnerRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'company_owner')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

async function cleanupOrphanCompanyOwnerUser(userId: string, email: string) {
  await supabaseAdmin.from('auth_email_tokens').delete().eq('email', email.toLowerCase());
  await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
  await supabaseAdmin.from('profiles').delete().eq('user_id', userId);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

// ---- Signup (creates user via admin API and sends confirmation email) ----
export const signupWithEmail = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: emailSchema,
        password: z.string().min(8).max(72),
        fullName: z.string().min(1).max(255),
        companyName: z.string().max(255).optional().nullable(),
        cpfCnpj: z.string().max(32).optional().nullable(),
        origin: z.string().url().max(255),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    let existing = await findUserByEmail(data.email);
    if (existing) {
      const [ownsCustomer, companyOwner] = await Promise.all([
        userOwnsCustomer(existing.id),
        hasCompanyOwnerRole(existing.id),
      ]);

      if (!ownsCustomer && companyOwner) {
        await cleanupOrphanCompanyOwnerUser(existing.id, data.email);
        existing = null;
      }
    }

    if (existing) {
      if (!hasConfirmedMestreEmail(existing)) {
        const { error: updateExistingError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: data.password,
          email_confirm: true,
          app_metadata: {
            ...(existing.app_metadata ?? {}),
            mestre_email_confirmed: false,
          },
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            full_name: data.fullName,
            company_name: data.companyName ?? null,
            cpf_cnpj: data.cpfCnpj ?? null,
          },
        });
        if (updateExistingError) {
          return { ok: false as const, error: updateExistingError.message };
        }

        const token = await createToken({
          email: data.email,
          type: 'signup',
          userId: existing.id,
          ttlMinutes: 60,
        });
        const link = `${resolveBaseUrl(data.origin)}/auth/confirm?token=${token}`;
        await sendEmail({
          to: data.email,
          subject: 'Confirme seu e-mail - Mestre 360',
          html: tplConfirmEmail(link),
        });
        return { ok: true as const };
      }

      return { ok: false as const, error: 'Já existe uma conta com este e-mail.' };
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      app_metadata: {
        mestre_email_confirmed: false,
      },
      user_metadata: {
        full_name: data.fullName,
        company_name: data.companyName ?? null,
        cpf_cnpj: data.cpfCnpj ?? null,
      },
    });
    if (createErr || !created?.user) {
      return { ok: false as const, error: createErr?.message ?? 'Falha ao criar usuário' };
    }

    const token = await createToken({
      email: data.email,
      type: 'signup',
      userId: created.user.id,
      ttlMinutes: 60,
    });

    const link = `${resolveBaseUrl(data.origin)}/auth/confirm?token=${token}`;
    try {
      await sendEmail({
        to: data.email,
        subject: 'Confirme seu e-mail - Mestre 360',
        html: tplConfirmEmail(link),
      });
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw error;
    }

    return { ok: true as const };
  });

// ---- Confirm email (consume token) ----
export const confirmEmail = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(16).max(128) }).parse(data)
  )
  .handler(async ({ data }) => {
    const row = await consumeToken({ token: data.token, type: 'signup' });
    if (!row) return { ok: false as const, error: 'Link inválido ou expirado.' };
    if (!row.user_id) return { ok: false as const, error: 'Usuário não encontrado.' };
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      email_confirm: true,
      app_metadata: {
        ...(userData.user?.app_metadata ?? {}),
        mestre_email_confirmed: true,
      },
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---- Resend confirmation ----
export const resendConfirmation = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ email: emailSchema, origin: z.string().url().max(255) }).parse(data)
  )
  .handler(async ({ data }) => {
    if (await isOnCooldown(data.email, 'signup')) {
      return { ok: false as const, error: 'Aguarde 1 minuto antes de pedir um novo e-mail.' };
    }
    const user = await findUserByEmail(data.email);
    // Sempre retorne ok para evitar enumeração
    if (!user) return { ok: true as const };
    if (hasConfirmedMestreEmail(user)) {
      return { ok: false as const, error: 'Este e-mail já está confirmado.' };
    }
    const token = await createToken({
      email: data.email,
      type: 'signup',
      userId: user.id,
      ttlMinutes: 60,
    });
    const link = `${resolveBaseUrl(data.origin)}/auth/confirm?token=${token}`;
    await sendEmail({
      to: data.email,
      subject: 'Confirme seu e-mail - Mestre 360',
      html: tplConfirmEmail(link),
    });
    return { ok: true as const };
  });

// ---- Request password reset ----
export const requestPasswordReset = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ email: emailSchema, origin: z.string().url().max(255) }).parse(data)
  )
  .handler(async ({ data }) => {
    if (await isOnCooldown(data.email, 'recovery')) {
      return { ok: true as const };
    }
    const user = await findUserByEmail(data.email);
    if (!user) return { ok: true as const }; // não revela existência
    const token = await createToken({
      email: data.email,
      type: 'recovery',
      userId: user.id,
      ttlMinutes: 60,
    });
    const link = `${resolveBaseUrl(data.origin)}/auth/reset-password?token=${token}`;
    await sendEmail({
      to: data.email,
      subject: 'Redefinir senha - Mestre 360',
      html: tplResetPassword(link),
    });
    return { ok: true as const };
  });

// ---- Reset password (consume token + update password) ----
export const resetPassword = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(16).max(128),
        newPassword: z.string().min(8).max(72),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const row = await consumeToken({ token: data.token, type: 'recovery' });
    if (!row) return { ok: false as const, error: 'Link inválido ou expirado.' };
    if (!row.user_id) return { ok: false as const, error: 'Usuário não encontrado.' };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.newPassword,
      email_confirm: true,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---- Request magic link ----
export const requestMagicLink = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ email: emailSchema, origin: z.string().url().max(255) }).parse(data)
  )
  .handler(async ({ data }) => {
    if (await isOnCooldown(data.email, 'magic_link')) {
      return { ok: true as const };
    }
    const user = await findUserByEmail(data.email);
    if (!user) return { ok: true as const };
    const token = await createToken({
      email: data.email,
      type: 'magic_link',
      userId: user.id,
      ttlMinutes: 15,
    });
    const link = `${resolveBaseUrl(data.origin)}/auth/magic-link?token=${token}`;
    await sendEmail({
      to: data.email,
      subject: 'Seu link de acesso - Mestre 360',
      html: tplMagicLink(link),
    });
    return { ok: true as const };
  });

// ---- Consume magic link: returns token_hash so the client can verifyOtp and create a session in-place ----
export const consumeMagicLink = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      token: z.string().min(16).max(128),
      origin: z.string().url().max(255).optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const row = await consumeToken({ token: data.token, type: 'magic_link' });
    if (!row) return { ok: false as const, error: 'Link inválido ou expirado.' };
    if (!row.user_id) return { ok: false as const, error: 'Usuário não encontrado.' };

    // Garante email confirmado (login por magic link conta como confirmação)
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, { email_confirm: true });

    // Gera um magic link no Supabase só para obter o token_hash; o cliente faz verifyOtp
    // localmente, evitando depender da Site URL / Redirect URLs configuradas no Supabase.
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: row.email,
    });
    if (error || !linkData?.properties?.hashed_token) {
      return { ok: false as const, error: error?.message ?? 'Falha ao gerar sessão.' };
    }
    return {
      ok: true as const,
      tokenHash: linkData.properties.hashed_token,
      email: row.email,
    };
  });
