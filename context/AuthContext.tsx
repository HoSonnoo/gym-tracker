import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type UserTier = 'guest' | 'registered' | 'premium';

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  tier: UserTier;
};

type AuthState = {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  isRegistered: boolean;
  isPremium: boolean;
  justLoggedIn: boolean;
};

type AuthActions = {
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  refreshProfile: () => Promise<void>;
  clearJustLoggedIn: () => void;
};

type AuthContextType = AuthState & AuthActions;

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const initialLoadDone = useRef(false);

  const fetchProfile = useCallback(async (supabaseUser: User): Promise<AuthUser> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, tier')
        .eq('id', supabaseUser.id)
        .single();

      if (error || !data) {
        return { id: supabaseUser.id, email: supabaseUser.email ?? null, displayName: null, tier: 'registered' };
      }

      return {
        id: supabaseUser.id,
        email: supabaseUser.email ?? null,
        displayName: data.display_name ?? null,
        tier: (data.tier as UserTier) ?? 'registered',
      };
    } catch {
      return { id: supabaseUser.id, email: supabaseUser.email ?? null, displayName: null, tier: 'registered' };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const profile = await fetchProfile(session.user);
    setUser(profile);
  }, [session, fetchProfile]);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);

    // Prima prova getSession, poi refreshSession per recuperare token salvati
    const initSession = async () => {
      try {
        let { data: { session: s } } = await supabase.auth.getSession();

        // Se non c'è sessione, prova a fare refresh (recupera token da storage)
        if (!s) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          s = refreshData.session;
        }

        clearTimeout(timeout);
        setSession(s);
        if (s?.user) {
          const profile = await fetchProfile(s.user);
          setUser(profile);
          setIsGuest(false);
        }
      } catch {
        clearTimeout(timeout);
      } finally {
        initialLoadDone.current = true;
        setLoading(false);
      }
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s?.user) {
        const profile = await fetchProfile(s.user);
        setUser(profile);
        setIsGuest(false);
        // Segnala nuovo login solo dopo il caricamento iniziale
        // (evita di triggerare il redirect all'avvio se c'è già una sessione)
        if (initialLoadDone.current && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          setJustLoggedIn(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsGuest(false);
        setJustLoggedIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsGuest(false);
    setJustLoggedIn(false);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setUser(null);
  };

  const clearJustLoggedIn = () => setJustLoggedIn(false);

  const tier = user?.tier ?? 'guest';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isGuest: isGuest && !user,
        isRegistered: tier === 'registered' || tier === 'premium',
        isPremium: tier === 'premium',
        justLoggedIn,
        signUpWithEmail,
        signInWithEmail,
        signOut,
        continueAsGuest,
        refreshProfile,
        clearJustLoggedIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}