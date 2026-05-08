import { supabase } from "@/integrations/supabase/client";

export async function getCurrentCustomerId(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("owner_user_id", u.user.id)
    .maybeSingle();
  return data?.id ?? null;
}
