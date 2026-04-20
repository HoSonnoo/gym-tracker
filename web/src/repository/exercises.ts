import { getUserId } from '@/lib/userId';
import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/types';

export async function getExercises(): Promise<Exercise[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, category, created_at')
    .eq('user_id', userId)
    .order('name');
  if (error) return [];
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
  const { count, error } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}
