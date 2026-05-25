import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { findUserByEmail } from './auth-email.server';

/**
 * Exclui uma empresa (customer) + o usuário dono em auth.users.
 * Cascata: profiles, user_roles, auth_email_tokens (via FK ou limpeza explícita).
 */
export const deleteCustomerAndUser = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ customerId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data }) => {
    // 1) Carrega o customer pra pegar owner_user_id e email
    const { data: cust, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id, email, owner_user_id')
      .eq('id', data.customerId)
      .maybeSingle();
    if (custErr) return { ok: false as const, error: custErr.message };
    if (!cust) return { ok: false as const, error: 'Empresa não encontrada' };

    // 2) Deleta o customer
    const { error: delErr } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', data.customerId);
    if (delErr) {
      return {
        ok: false as const,
        error: delErr.message.includes('violates foreign key')
          ? 'Esta empresa possui dados vinculados (obras, lançamentos, etc). Remova-os antes.'
          : delErr.message,
      };
    }

    // 3) Resolve o user_id (preferir owner_user_id; fallback por email)
    let userId = cust.owner_user_id as string | null;
    if (!userId && cust.email) {
      const u = await findUserByEmail(cust.email);
      userId = u?.id ?? null;
    }

    // 4) Limpa tokens de email e profile/roles, depois deleta o auth user
    if (cust.email) {
      await supabaseAdmin.from('auth_email_tokens').delete().eq('email', cust.email.toLowerCase());
    }
    if (userId) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
      const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authDelErr) {
        return {
          ok: true as const,
          warning: `Empresa excluída, mas falha ao remover usuário de auth: ${authDelErr.message}`,
        };
      }
    }

    return { ok: true as const };
  });

/** Deleta apenas o usuário de auth por email (para limpar órfãos). */
export const deleteAuthUserByEmail = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().email() }).parse(data)
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const u = await findUserByEmail(email);
    if (!u) return { ok: false as const, error: 'Usuário não encontrado em auth' };
    await supabaseAdmin.from('auth_email_tokens').delete().eq('email', email);
    await supabaseAdmin.from('user_roles').delete().eq('user_id', u.id);
    await supabaseAdmin.from('profiles').delete().eq('user_id', u.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
