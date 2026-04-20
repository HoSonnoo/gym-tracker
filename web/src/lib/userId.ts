import { supabase } from '@/lib/supabase';

export async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (!error && data.user) return data.user.id;

  const msg = error?.message?.includes('disabled')
    ? 'Login anonimo non abilitato su Supabase. Registrati o accedi per continuare.'
    : 'Registrati o accedi per salvare i dati.';

  window.alert(msg);
  throw new Error(msg);
}
