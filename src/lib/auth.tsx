import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export type AuthProviderId = "lovable" | "google";

type Auth = {
  /** null = not signed in; the app still works, data stays on this device. */
  user: User | null;
  /** false until the stored session has been read (never during SSR). */
  ready: boolean;
  /** Returns an error message, or null when the browser is on its way to the provider. */
  signIn: (provider: AuthProviderId) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED and INITIAL_SESSION fire constantly; only identity changes matter here.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<Auth>(
    () => ({
      user,
      ready,
      signIn: async (provider) => {
        try {
          const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
          if (res.error) return res.error.message;
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthSessionProvider");
  return ctx;
}
