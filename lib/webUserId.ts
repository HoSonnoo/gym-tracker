import { supabase } from '@/lib/supabase';

/**
 * Returns the current Supabase user ID.
 * On web, guests (no session) are automatically signed in anonymously so
 * writes work without requiring a full registration.
 */
export async function getUserId(): Promise<string> {
  // getSession legge da localStorage senza chiamate di rete, più stabile di getUser()
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  // No session — try anonymous sign-in (guest on web)
  const { data, error } = await supabase.auth.signInAnonymously();
  if (!error && data.user) return data.user.id;

  // anonymous sign-in not enabled or failed — show a visible error on web
  const msg = error?.message?.includes('disabled')
    ? 'Login anonimo non abilitato su Supabase.\nAbilita "Anonymous sign-ins" in Authentication → Settings, oppure registrati.'
    : 'Registrati o accedi per salvare i dati sul web.';

  if (typeof window !== 'undefined') {
    window.alert(msg);
  }
  throw new Error(msg);
}
