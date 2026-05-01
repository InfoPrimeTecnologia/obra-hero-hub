import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Obra = {
  id: string;
  name: string;
  customer_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  address_city: string | null;
  address_state: string | null;
  status: string;
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
      if (raw) setObraState(JSON.parse(raw));
    } catch {
      // ignore
    }
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
