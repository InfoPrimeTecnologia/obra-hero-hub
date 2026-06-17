import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Resolve o customer_id da empresa do usuário logado (owner ou membro).
 * Usa a função pública current_user_customer_id() do Postgres.
 */
export function useCurrentCustomerId() {
  const { user } = useAuth();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCustomerId(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Tenta como owner
      const { data: owned } = await supabase
        .from("customers")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (owned?.id) {
        setCustomerId(owned.id);
        setLoading(false);
        return;
      }
      // Fallback: membro
      const { data: mem } = await (supabase as any)
        .from("customer_members")
        .select("customer_id")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .maybeSingle();
      if (cancelled) return;
      setCustomerId(mem?.customer_id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { customerId, loading };
}
