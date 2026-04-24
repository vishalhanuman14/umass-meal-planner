import type { Session } from "@supabase/supabase-js";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import { isUmassEmail } from "../lib/auth";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const currentSession = data.session;
      if (currentSession && !isUmassEmail(currentSession.user.email)) {
        setAuthError("Use your @umass.edu Google account.");
        void supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(currentSession);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession && !isUmassEmail(nextSession.user.email)) {
        setAuthError("Use your @umass.edu Google account.");
        void supabase.auth.signOut();
        setSession(null);
        return;
      }
      setAuthError(null);
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      authError,
      signOut: () => supabase.auth.signOut().then(() => undefined)
    }),
    [authError, loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
