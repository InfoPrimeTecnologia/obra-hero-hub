import { supabase } from "@/integrations/supabase/client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Obra = {
  id: string;
  name: string;
  customer_id: string;
  empresa_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  address_city: string | null;
  address_state: string | null;
  status: string;
  foto_url?: string | null;
};

type Ctx = {
  obra: Obra | null;
  setObra: (o: Obra | null) => void;
};

const ObraContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "mestre360.obra_ativa";

export function ObraProvider({ children }: { children: ReactNode }) {
  const [obra, setObraState] = useState<Obra | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Obra;
        // Só restaura se a obra pertence à conta atual (RLS esconde as de outras contas)
        supabase.from("obras").select("id").eq("id", saved.id).maybeSingle().then(({ data }) => {
          if (data) setObraState(saved);
          else localStorage.removeItem(STORAGE_KEY);
        });
      }
    } catch {
      // ignore
    }
    let lastUser: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      const uid = session?.user?.id ?? null;
      const changed = lastUser !== undefined && uid !== lastUser;
      lastUser = uid;
      const event = uid ? "SIGNED_IN" : "SIGNED_OUT";
      if (changed) {
        let keep = false;
        if (event === "SIGNED_IN") {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const saved = JSON.parse(raw) as Obra;
              keep = true;
              supabase.from("obras").select("id").eq("id", saved.id).maybeSingle().then(({ data }) => {
                if (!data) { localStorage.removeItem(STORAGE_KEY); setObraState(null); }
              });
            }
          } catch { /* ignore */ }
        }
        if (!keep) { localStorage.removeItem(STORAGE_KEY); setObraState(null); }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const setObra = (o: Obra | null) => {
    setObraState(o);
    try {
      if (o) localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return <ObraContext.Provider value={{ obra, setObra }}>{children}</ObraContext.Provider>;
}

export function useObraSelecionada() {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error("useObraSelecionada must be used within ObraProvider");
  return ctx;
}
