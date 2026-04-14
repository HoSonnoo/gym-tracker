import { getUserId } from '@/lib/webUserId';
import { supabase } from '@/lib/supabase';
import type { Recipe } from '@/database';

export async function getRecipes(): Promise<Recipe[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function addRecipe(recipe: {
  title: string;
  description: string | null;
  servings: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  ingredients: string | null;
  instructions: string | null;
  source: 'manual' | 'pdf';
}): Promise<number> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...recipe, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteRecipe(id: number): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
