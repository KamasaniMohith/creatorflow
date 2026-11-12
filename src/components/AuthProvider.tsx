"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    void Promise.resolve()
      .then(() => createClient())
      .then((supabase) => {
        if (!active) return;

        let receivedAuthEvent = false;
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          receivedAuthEvent = true;
          setUser(session?.user ?? null);
          setLoading(false);
        });
        unsubscribe = () => data.subscription.unsubscribe();

        void supabase.auth
          .getSession()
          .then(({ data: sessionData, error: sessionError }) => {
            if (!active) return;
            if (sessionError) {
              setError(
                "Unable to load your sign-in session. Please refresh and try again.",
              );
              console.error("Unable to load the Supabase session.", sessionError);
            } else if (!receivedAuthEvent) {
              setUser(sessionData.session?.user ?? null);
            }
            setLoading(false);
          })
          .catch((sessionError: unknown) => {
            if (!active) return;
            setError(
              "Unable to load your sign-in session. Please refresh and try again.",
            );
            console.error("Unable to load the Supabase session.", sessionError);
            setLoading(false);
          });
      })
      .catch((clientError: unknown) => {
        if (!active) return;
        setError(
          clientError instanceof Error
            ? clientError.message
            : "Supabase authentication is not configured.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
