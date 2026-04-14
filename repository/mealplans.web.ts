import { getUserId } from '@/lib/webUserId';
import { supabase } from '@/lib/supabase';
import type { MealPlan, MealPlanDay, MealPlanEntry } from '@/database';

export async function getMealPlans(): Promise<MealPlan[]> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MealPlan[];
}

export async function addMealPlan(name: string, plan_type: 'weekly' | 'cycle'): Promise<number> {
  const userId = await getUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Inserisci il nome del piano.');
  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ name: trimmed, plan_type, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteMealPlan(id: number): Promise<void> {
  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getMealPlanDays(mealPlanId: number): Promise<MealPlanDay[]> {
  const { data, error } = await supabase
    .from('meal_plan_days')
    .select('*')
    .eq('meal_plan_id', mealPlanId)
    .order('day_order');
  if (error) throw error;
  return (data ?? []) as MealPlanDay[];
}

export async function addMealPlanDay(mealPlanId: number, dayOrder: number, label: string): Promise<number> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('meal_plan_days')
    .insert({ meal_plan_id: mealPlanId, day_order: dayOrder, label, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteMealPlanDay(id: number): Promise<void> {
  const { error } = await supabase
    .from('meal_plan_days')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getMealPlanEntries(mealPlanDayId: number): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('*')
    .eq('meal_plan_day_id', mealPlanDayId)
    .order('meal_type')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as MealPlanEntry[];
}

export async function addMealPlanEntry(entry: {
  meal_plan_day_id: number;
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
    .from('meal_plan_entries')
    .insert({ ...entry, user_id: userId });
  if (error) throw error;
}

export async function updateMealPlanEntry(
  id: number,
  food_name: string,
  grams: number,
  kcal: number | null,
  protein: number | null,
  carbs: number | null,
  fat: number | null
): Promise<void> {
  const { error } = await supabase
    .from('meal_plan_entries')
    .update({ food_name, grams, kcal, protein, carbs, fat })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMealPlanEntry(id: number): Promise<void> {
  const { error } = await supabase
    .from('meal_plan_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
