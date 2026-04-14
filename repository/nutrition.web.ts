import { getUserId } from '@/lib/webUserId';
import { supabase } from '@/lib/supabase';
import type { FoodItem, NutritionLog } from '@/database';

export async function getFoodItems(): Promise<FoodItem[]> {
  const { data, error } = await supabase
    .from('food_items')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as FoodItem[];
}

export async function addFoodItem(item: {
  name: string;
  kcal_per_100g: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: 'manual' | 'openfoodfacts';
  external_id?: string | null;
}): Promise<number> {
  const userId = await getUserId();
  const name = item.name.trim();
  if (!name) throw new Error("Inserisci il nome dell'alimento.");
  const { data, error } = await supabase
    .from('food_items')
    .insert({
      name,
      kcal_per_100g: item.kcal_per_100g,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      source: item.source,
      external_id: item.external_id ?? null,
      user_id: userId,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Questo alimento è già presente nel catalogo.');
    throw new Error("Impossibile salvare l'alimento.");
  }
  return data.id;
}

export async function deleteFoodItem(id: number): Promise<void> {
  const { error } = await supabase
    .from('food_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getNutritionLogsByDate(date: string): Promise<NutritionLog[]> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('date', date)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as NutritionLog[];
}

export async function addNutritionLog(log: {
  date: string;
  meal_type: string;
  food_item_id: number | null;
  food_name: string;
  grams: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('nutrition_logs')
    .insert({ ...log, user_id: userId });
  if (error) throw error;
}

export async function deleteNutritionLog(id: number): Promise<void> {
  const { error } = await supabase
    .from('nutrition_logs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getWaterLogByDate(date: string): Promise<number> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('ml')
    .eq('date', date);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.ml ?? 0), 0);
}

export async function addWaterLog(date: string, ml: number): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('water_logs')
    .insert({ date, ml, user_id: userId });
  if (error) throw error;
}

export async function resetWaterLog(date: string): Promise<void> {
  const { error } = await supabase
    .from('water_logs')
    .delete()
    .eq('date', date);
  if (error) throw error;
}
