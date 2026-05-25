import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (input: SignUpInput) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

export type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
  cpfCnpj?: string;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const adminCheckId = useRef(0);

  const checkAdmin = async (userId: string) => {
    const timeout = new Promise<false>((resolve) => {
      window.setTimeout(() => resolve(false), 2200);
    });

    const lookup = (async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      if (!error) return !!data;

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    return false;
    })();

    return Promise.race([lookup, timeout]);
  };

  const applySession = async (s: Session | null) => {
    const checkId = adminCheckId.current + 1;
    adminCheckId.current = checkId;

    setLoading(true);
    setSession(s);
    setUser(s?.user ?? null);

    if (!s?.user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const admin = await checkAdmin(s.user.id);
      if (adminCheckId.current === checkId) {
        setIsAdmin(admin);
      }
    } finally {
      if (adminCheckId.current === checkId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const authTimeout = window.setTimeout(() => {
      if (!mounted) return;
      setSession(null);
      setUser(null);
      setIsAdmin(false);
      setLoading(false);
    }, 2500);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      window.clearTimeout(authTimeout);
      setTimeout(() => void applySession(s), 0);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return;
        window.clearTimeout(authTimeout);
        void applySession(s);
      })
      .catch(() => {
        if (!mounted) return;
        window.clearTimeout(authTimeout);
        void applySession(null);
      });

    return () => {
      mounted = false;
      window.clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (input: SignUpInput) => {
    void input;
    return { error: new Error("Use o cadastro personalizado do Mestre 360.") };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
