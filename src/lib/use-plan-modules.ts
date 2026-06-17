import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const ALL_MODULES = ["obras", "financeiro", "compras", "estoque", "rh", "relatorios", "tarefas", "agenda"];
const ALL_FEATURES = ["rdo_whatsapp", "nf_xml", "ai_assistant"];

export function usePlanModules() {
  const { user } = useAuth();
  const [modules, setModules] = useState<string[] | null>(null);
  const [features, setFeatures] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        if (!cancelled) {
          setModules(ALL_MODULES);
          setFeatures(ALL_FEATURES);
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
        if (!cancelled) {
          setModules(ALL_MODULES);
          setFeatures(ALL_FEATURES);
          setLoading(false);
        }
        return;
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status, plans(modules, features)")
        .eq("customer_id", cust.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const planMods = (sub as any)?.plans?.modules;
      const planFeats = (sub as any)?.plans?.features;
      if (!cancelled) {
        setModules(Array.isArray(planMods) ? planMods : ALL_MODULES);
        setFeatures(Array.isArray(planFeats) ? planFeats : ALL_FEATURES);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const has = (mod: string) => modules?.includes(mod) ?? true;
  const hasFeature = (feat: string) => features?.includes(feat) ?? true;
  return {
    modules: modules ?? ALL_MODULES,
    features: features ?? ALL_FEATURES,
    has,
    hasFeature,
    loading,
  };
}
