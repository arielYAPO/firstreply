"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { User } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  credits: number;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshCredits: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  credits: 0,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshCredits: async () => {},
});

export function useAuthContext() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadCredits = useCallback(async (userId: string) => {
    const supabase = createSupabaseBrowser();
    const { data } = await supabase
      .from("credit_balances")
      .select("credits")
      .eq("user_id", userId)
      .single();
    setCredits(data?.credits ?? 0);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let initialLoadDone = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        await loadCredits(newUser.id);
      } else {
        setCredits(0);
      }

      // Only set loading to false after we've processed the initial session
      if (!initialLoadDone) {
        initialLoadDone = true;
        setLoading(false);
      }
    });

    // Fallback: if onAuthStateChange never fires (shouldn't happen but safety net)
    const timeout = setTimeout(() => {
      if (!initialLoadDone) {
        initialLoadDone = true;
        setLoading(false);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [loadCredits]);

  async function signInWithGoogle() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    setUser(null);
    setCredits(0);
    try {
      const supabase = createSupabaseBrowser();
      // scope: global kills the session server-side too
      await Promise.race([
        supabase.auth.signOut({ scope: "global" }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch {
      // Ignore errors
    }
  }

  async function refreshCredits() {
    if (user) {
      await loadCredits(user.id);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, credits, loading, signInWithGoogle, signOut, refreshCredits }}
    >
      {children}
    </AuthContext.Provider>
  );
}
