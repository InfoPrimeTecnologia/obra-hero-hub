import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const ALL_MODULES = [
  "obras",
  "financeiro",
  "compras",
  "estoque",
  "rh",
  "relatorios",
  "tarefas",
  "agenda",
];
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
        .select("plan_id, status, access_until, next_due_date, plans(modules, features, limits)")
        .eq("customer_id", cust.id)
        .in("status", ["active", "canceled"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const periodEnd = sub?.access_until ?? sub?.next_due_date;
      const canUsePlan =
        sub?.status === "active" ||
        (sub?.status === "canceled" &&
          Boolean(periodEnd && periodEnd >= new Date().toISOString().slice(0, 10)));
      const plan = canUsePlan ? (sub as any)?.plans : null;
      const planMods = plan?.modules;
      // `features` passou a guardar textos de vitrine; os recursos técnicos são derivados dos limites.
      let planFeats: string[] | null = null;
      if (plan) {
        const rawFeats: string[] = Array.isArray(plan.features) ? plan.features : [];
        const set = new Set(rawFeats.filter((f) => ALL_FEATURES.includes(f)));
        set.add("rdo_whatsapp");
        set.add("nf_xml");
        const aiCredits = Number(plan.limits?.ai_credits ?? 0);
        if (aiCredits > 0) set.add("ai_assistant");
        planFeats = Array.from(set);
      }
      if (!cancelled) {
        setModules(Array.isArray(planMods) ? planMods : ALL_MODULES);
        setFeatures(planFeats ?? ALL_FEATURES);
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
