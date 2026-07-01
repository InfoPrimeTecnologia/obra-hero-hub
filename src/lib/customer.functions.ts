import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CustomerSettingsSchema = z.object({
  id: z.string().uuid().optional(),
  company_name: z.string().nullable().optional(),
  cpf_cnpj: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address_street: z.string().nullable().optional(),
  address_number: z.string().nullable().optional(),
  address_complement: z.string().nullable().optional(),
  address_neighborhood: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  address_state: z.string().nullable().optional(),
  address_zip: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  limite_aprovacao_compra: z.number().nonnegative().nullable().optional(),
  alerta_subetapa_pct: z.number().int().min(1).max(200).nullable().optional(),
});

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const getMyCustomerSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("owner_user_id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const saveMyCustomerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CustomerSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = String((context.claims as { email?: unknown }).email ?? "");
    if (!email) throw new Error("Sessão sem e-mail identificado");

    const payload = {
      company_name: normalizeText(data.company_name),
      cpf_cnpj: normalizeText(data.cpf_cnpj),
      phone: normalizeText(data.phone),
      whatsapp: normalizeText(data.whatsapp),
      address_street: normalizeText(data.address_street),
      address_number: normalizeText(data.address_number),
      address_complement: normalizeText(data.address_complement),
      address_neighborhood: normalizeText(data.address_neighborhood),
      address_city: normalizeText(data.address_city),
      address_state: normalizeText(data.address_state)?.toUpperCase() ?? null,
      address_zip: normalizeText(data.address_zip),
      notes: normalizeText(data.notes),
      limite_aprovacao_compra: data.limite_aprovacao_compra ?? 0,
      alerta_subetapa_pct: data.alerta_subetapa_pct ?? 90,
    };

    // Try to find by owner first
    let { data: existing, error: findError } = await supabaseAdmin
      .from("customers")
      .select("id, owner_user_id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    // Fallback: find by email (case-insensitive) and adopt if unowned or owned by this user
    if (!existing) {
      const { data: byEmail, error: emailErr } = await supabaseAdmin
        .from("customers")
        .select("id, owner_user_id")
        .ilike("email", email)
        .maybeSingle();
      if (emailErr) throw new Error(emailErr.message);
      if (byEmail) {
        if (byEmail.owner_user_id && byEmail.owner_user_id !== context.userId) {
          throw new Error("Já existe uma empresa cadastrada com este e-mail por outro usuário.");
        }
        existing = byEmail;
      }
    }

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("customers")
        .update({ ...payload, owner_user_id: context.userId, created_by: context.userId })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return { customer: updated, created: false };
    }

    const displayName = normalizeText(data.company_name) ?? email;
    const { data: created, error } = await supabaseAdmin
      .from("customers")
      .insert({
        ...payload,
        name: displayName,
        email,
        owner_user_id: context.userId,
        created_by: context.userId,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { customer: created, created: true };
  });
