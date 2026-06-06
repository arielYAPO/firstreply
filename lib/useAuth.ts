"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "./supabaseBrowser";
import type { User } from "@supabase/supabase-js";

export type AuthState = {
  user: User | null;
  credits: number;
  loading: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    credits: 0,
    loading: true,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({ user: null, credits: 0, loading: false });
        return;
      }

      const { data: balance } = await supabase
        .from("credit_balances")
        .select("credits")
        .eq("user_id", user.id)
        .single();

      setState({
        user,
        credits: balance?.credits ?? 0,
        loading: false,
      });
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        load();
      } else {
        setState({ user: null, credits: 0, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    setState({ user: null, credits: 0, loading: false });
  }

  async function refreshCredits() {
    if (!state.user) return;
    const supabase = createSupabaseBrowser();
    const { data } = await supabase
      .from("credit_balances")
      .select("credits")
      .eq("user_id", state.user.id)
      .single();
    setState((prev) => ({ ...prev, credits: data?.credits ?? 0 }));
  }

  return { ...state, signInWithGoogle, signOut, refreshCredits };
}
