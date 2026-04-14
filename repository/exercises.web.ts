import { getUserId } from '@/lib/webUserId';
import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/database';

export async function getExercises(): Promise<Exercise[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, category, created_at')
    .eq('user_id', user.id)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Exercise[];
}

export async function addExercise(name: string, category: string | null): Promise<void> {
  const userId = await getUserId();
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Inserisci il nome dell'esercizio.");
  const { error } = await supabase
    .from('exercises')
    .insert({ name: normalizedName, category: category?.trim() || null, user_id: userId });
  if (error) {
    if (error.code === '23505') throw new Error('Questo esercizio è già presente nel database.');
    throw new Error("Impossibile aggiungere l'esercizio.");
  }
}

export async function updateExercise(id: number, name: string): Promise<void> {
  const { error } = await supabase
    .from('exercises')
    .update({ name: name.trim() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteExercise(id: number): Promise<void> {
  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function hasExercises(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { count, error } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (error) throw error;
  return (count ?? 0) > 0;
}
