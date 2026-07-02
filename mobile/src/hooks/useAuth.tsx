import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { supabase } from "@/lib/supabase";
import type { AccountSummary, Profile } from "@/types/domain";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  account: AccountSummary | null;
  loading: boolean;
  signingIn: boolean;
  defaultCurrency: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, user_id, full_name, email, avatar_url, account_id, account_role, account:accounts!inner(id, name, default_currency)"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    const accountRow = Array.isArray(data?.account)
      ? data?.account[0] ?? null
      : data?.account ?? null;

    setProfile((data as Profile | null) ?? null);
    setAccount((accountRow as AccountSummary | null) ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    await loadProfile(session.user.id);
  }, [loadProfile, session?.user?.id]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id).catch((error) =>
          console.warn("[AuthProvider] profile load failed", error)
        );
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setAccount(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      account,
      loading,
      signingIn,
      defaultCurrency: account?.default_currency || "BRL",
      signIn,
      signOut,
      refreshProfile
    }),
    [account, loading, profile, refreshProfile, session, signIn, signOut, signingIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
