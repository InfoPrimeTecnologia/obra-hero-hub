import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALL_MODULES = [
  "obras",
  "financeiro",
  "compras",
  "estoque",
  "rh",
  "relatorios",
  "tarefas",
  "agenda",
] as const;

const PermissionsSchema = z.record(
  z.string(),
  z.object({
    view: z.boolean().optional(),
    create: z.boolean().optional(),
    edit: z.boolean().optional(),
    delete: z.boolean().optional(),
  }),
);

async function getOwnedCustomerId(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Você não é proprietário de uma empresa.");
  return data.id as string;
}

async function getPlanMaxUsers(supabaseAdmin: any, customerId: string): Promise<number | null> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("customer_id", customerId)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (!sub?.plan_id) return null;
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("limits, max_usuarios")
    .eq("id", sub.plan_id)
    .maybeSingle();
  const fromLimits = plan?.limits?.max_usuarios;
  if (typeof fromLimits === "number") return fromLimits;
  if (typeof plan?.max_usuarios === "number") return plan.max_usuarios;
  return null;
}

async function assertUserSlotAvailable(supabaseAdmin: any, customerId: string) {
  const max = await getPlanMaxUsers(supabaseAdmin, customerId);
  if (max == null) return;
  const { count: membersCount } = await supabaseAdmin
    .from("customer_members")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("status", "ativo");
  // owner conta como 1
  const used = (membersCount ?? 0) + 1;
  if (used >= max) {
    throw new Error(
      `Limite de usuários do plano atingido (${used}/${max}). Faça upgrade para adicionar mais usuários.`,
    );
  }
}

/* ---------------- LIST ---------------- */
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = await getOwnedCustomerId(supabaseAdmin, context.userId);
    const [members, invites] = await Promise.all([
      supabaseAdmin
        .from("customer_members")
        .select("*")
        .eq("customer_id", cid)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("customer_invites")
        .select("*")
        .eq("customer_id", cid)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    const max = await getPlanMaxUsers(supabaseAdmin, cid);
    return {
      customer_id: cid,
      members: members.data ?? [],
      invites: invites.data ?? [],
      max_usuarios: max,
    };
  });

/* ---------------- CREATE DIRECT ---------------- */
const CreateDirectSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(["admin", "member"]).default("member"),
  permissions: PermissionsSchema.default({}),
  can_access_all_obras: z.boolean().default(true),
  allowed_obras: z.array(z.string().uuid()).default([]),
});
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateDirectSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = await getOwnedCustomerId(supabaseAdmin, context.userId);
    await assertUserSlotAvailable(supabaseAdmin, cid);

    // tenta achar user existente pelo e-mail
    let userId: string | null = null;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing?.users?.find(
      (u: any) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (error) throw new Error(error.message);
      userId = created.user?.id ?? null;
    }
    if (!userId) throw new Error("Falha ao criar usuário");

    // upsert em customer_members
    const { error: insErr } = await supabaseAdmin.from("customer_members").upsert(
      {
        customer_id: cid,
        user_id: userId,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        status: "ativo",
        permissions: data.permissions as any,
        can_access_all_obras: data.can_access_all_obras,
        allowed_obras: data.allowed_obras,
        created_by: context.userId,
      },
      { onConflict: "customer_id,user_id" },
    );
    if (insErr) throw new Error(insErr.message);
    return { ok: true, user_id: userId };
  });

/* ---------------- INVITE ---------------- */
const CreateInviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional(),
  role: z.enum(["admin", "member"]).default("member"),
  permissions: PermissionsSchema.default({}),
  can_access_all_obras: z.boolean().default(true),
  allowed_obras: z.array(z.string().uuid()).default([]),
});
export const createTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateInviteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = await getOwnedCustomerId(supabaseAdmin, context.userId);
    await assertUserSlotAvailable(supabaseAdmin, cid);

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error } = await supabaseAdmin
      .from("customer_invites")
      .insert({
        customer_id: cid,
        email: data.email,
        full_name: data.full_name ?? null,
        token,
        role: data.role,
        permissions: data.permissions as any,
        can_access_all_obras: data.can_access_all_obras,
        allowed_obras: data.allowed_obras,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { invite: inv };
  });

/* ---------------- DELETE MEMBER / INVITE ---------------- */
export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { memberId: string }) => z.object({ memberId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = await getOwnedCustomerId(supabaseAdmin, context.userId);
    const { error } = await supabaseAdmin
      .from("customer_members")
      .delete()
      .eq("id", data.memberId)
      .eq("customer_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        memberId: z.string().uuid(),
        role: z.enum(["admin", "member"]).optional(),
        status: z.enum(["ativo", "suspenso"]).optional(),
        permissions: PermissionsSchema.optional(),
        can_access_all_obras: z.boolean().optional(),
        allowed_obras: z.array(z.string().uuid()).optional(),
        pode_aprovar_compras: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = await getOwnedCustomerId(supabaseAdmin, context.userId);
    const patch: any = {};
    if (data.role) patch.role = data.role;
    if (data.status) patch.status = data.status;
    if (data.permissions) patch.permissions = data.permissions;
    if (data.can_access_all_obras !== undefined) patch.can_access_all_obras = data.can_access_all_obras;
    if (data.allowed_obras) patch.allowed_obras = data.allowed_obras;
    if (data.pode_aprovar_compras !== undefined) patch.pode_aprovar_compras = data.pode_aprovar_compras;
    const { error } = await supabaseAdmin
      .from("customer_members")
      .update(patch)
      .eq("id", data.memberId)
      .eq("customer_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { inviteId: string }) => z.object({ inviteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = await getOwnedCustomerId(supabaseAdmin, context.userId);
    const { error } = await supabaseAdmin
      .from("customer_invites")
      .delete()
      .eq("id", data.inviteId)
      .eq("customer_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- ACCEPT INVITE ---------------- */
export const acceptTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { token: string }) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("customer_invites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Convite inválido");
    if (inv.accepted_at) throw new Error("Convite já utilizado");
    if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("Convite expirado");

    await supabaseAdmin.from("customer_members").upsert(
      {
        customer_id: inv.customer_id,
        user_id: context.userId,
        email: inv.email,
        full_name: inv.full_name,
        role: inv.role,
        status: "ativo",
        permissions: inv.permissions,
        can_access_all_obras: inv.can_access_all_obras,
        allowed_obras: inv.allowed_obras,
        created_by: inv.created_by,
      },
      { onConflict: "customer_id,user_id" },
    );

    await supabaseAdmin
      .from("customer_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_user_id: context.userId })
      .eq("id", inv.id);

    return { ok: true, customer_id: inv.customer_id };
  });

export const TEAM_MODULES = ALL_MODULES;
