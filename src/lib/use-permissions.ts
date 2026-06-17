import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type PermAction = "view" | "create" | "edit" | "delete";
export type PermissionsMap = Record<string, Partial<Record<PermAction, boolean>>>;

type State = {
  loading: boolean;
  isOwner: boolean;
  role: "admin" | "member" | null;
  permissions: PermissionsMap;
  canAccessAllObras: boolean;
  allowedObras: string[];
};

const initial: State = {
  loading: true,
  isOwner: false,
  role: null,
  permissions: {},
  canAccessAllObras: true,
  allowedObras: [],
};

/**
 * Returns the current user's effective permissions.
 * Owners and admins get full access. Members are gated by their permissions JSON.
 */
export function usePermissions() {
  const { user } = useAuth();
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    if (!user) {
      setState({ ...initial, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      // owner?
      const { data: owned } = await supabase
        .from("customers")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (owned?.id) {
        setState({
          loading: false,
          isOwner: true,
          role: "admin",
          permissions: {},
          canAccessAllObras: true,
          allowedObras: [],
        });
        return;
      }
      const { data: mem } = await (supabase as any)
        .from("customer_members")
        .select("role, permissions, can_access_all_obras, allowed_obras, status")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .maybeSingle();
      if (cancelled) return;
      setState({
        loading: false,
        isOwner: false,
        role: (mem?.role as any) ?? null,
        permissions: (mem?.permissions as PermissionsMap) ?? {},
        canAccessAllObras: mem?.can_access_all_obras ?? true,
        allowedObras: (mem?.allowed_obras as string[]) ?? [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const can = (module: string, action: PermAction = "view") => {
    if (state.loading) return true; // optimistic while loading to avoid flash
    if (state.isOwner || state.role === "admin") return true;
    return !!state.permissions[module]?.[action];
  };

  const canSeeObra = (obraId: string | null | undefined) => {
    if (state.loading) return true;
    if (state.isOwner || state.role === "admin") return true;
    if (state.canAccessAllObras) return true;
    if (!obraId) return false;
    return state.allowedObras.includes(obraId);
  };

  return { ...state, can, canSeeObra };
}
