import { supabase } from '@/lib/supabase';

/**
 * Returns the current Supabase user ID.
 * On web, guests (no session) are automatically signed in anonymously so
 * writes work without requiring a full registration.
 */
export async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;

  // No session — try anonymous sign-in (guest on web)
  const { data, error } = await supabase.auth.signInAnonymously();
  if (!error && data.user) return data.user.id;

  throw new Error('Accedi per salvare i dati.');
}
