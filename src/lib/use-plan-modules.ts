import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const ALL_MODULES = ["obras", "financeiro", "compras", "estoque", "rh", "relatorios"];

export function usePlanModules() {
  const { user } = useAuth();
  const [modules, setModules] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        if (!cancelled) {
          setModules(ALL_MODULES);
          setLoading(false);
        }
        return;
      }
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!cust) {
        // Admin or no company → all modules
        if (!cancelled) {
          setModules(ALL_MODULES);
          setLoading(false);
        }
        return;
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status, plans(modules)")
        .eq("customer_id", cust.id)
        .in("status", ["active", "trialing"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const planMods = (sub as any)?.plans?.modules;
      if (!cancelled) {
        setModules(Array.isArray(planMods) ? planMods : ALL_MODULES);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const has = (mod: string) => modules?.includes(mod) ?? true;
  return { modules: modules ?? ALL_MODULES, has, loading };
}
