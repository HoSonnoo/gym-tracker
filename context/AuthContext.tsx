import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UserTier = 'guest' | 'registered' | 'premium';

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  tier: UserTier;
};

type AuthState = {
  // null = ospite non loggato, AuthUser = utente autenticato
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  isRegistered: boolean;
  isPremium: boolean;
};

type AuthActions = {
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  refreshProfile: () => Promise<void>;
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

  const fetchProfile = useCallback(async (supabaseUser: User): Promise<AuthUser> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, tier')
        .eq('id', supabaseUser.id)
        .single();

      if (error || !data) {
        return {
          id: supabaseUser.id,
          email: supabaseUser.email ?? null,
          displayName: null,
          tier: 'registered',
        };
      }

      return {
        id: supabaseUser.id,
        email: supabaseUser.email ?? null,
        displayName: data.display_name ?? null,
        tier: (data.tier as UserTier) ?? 'registered',
      };
    } catch {
      return {
        id: supabaseUser.id,
        email: supabaseUser.email ?? null,
        displayName: null,
        tier: 'registered',
      };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const profile = await fetchProfile(session.user);
    setUser(profile);
  }, [session, fetchProfile]);

  useEffect(() => {
    // Carica sessione esistente
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        const profile = await fetchProfile(s.user);
        setUser(profile);
        setIsGuest(false);
      }
      setLoading(false);
    });

    // Ascolta cambiamenti di sessione
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s?.user) {
        const profile = await fetchProfile(s.user);
        setUser(profile);
        setIsGuest(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsGuest(false);
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
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setUser(null);
  };

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
        signUpWithEmail,
        signInWithEmail,
        signOut,
        continueAsGuest,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}