import { getUserId } from '@/lib/userId';
import { supabase } from '@/lib/supabase';
import type { MealPlan, MealPlanDay, MealPlanEntry } from '@/types';

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
  const { error } = await supabase.from('meal_plans').delete().eq('id', id);
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
  const { error } = await supabase.from('meal_plan_days').delete().eq('id', id);
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
  const { error } = await supabase.from('meal_plan_entries').insert({ ...entry, user_id: userId });
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
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function setMealPlanActiveDays(
  mealPlanId: number,
  assignments: { dayId: number; weekdays: number[] }[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('meal_plan_active_days')
    .delete()
    .eq('meal_plan_id', mealPlanId);
  if (delError) throw delError;

  const rows: { meal_plan_id: number; meal_plan_day_id: number; weekday: number }[] = [];
  for (const a of assignments) {
    for (const weekday of a.weekdays) {
      rows.push({ meal_plan_id: mealPlanId, meal_plan_day_id: a.dayId, weekday });
    }
  }
  if (rows.length === 0) return;
  const { error } = await supabase.from('meal_plan_active_days').insert(rows);
  if (error) throw error;
}

export async function getActivePlanEntriesForToday(completedIds?: number[]): Promise<{
  entries: MealPlanEntry[];
  consumedTotals: { kcal: number; protein: number; carbs: number; fat: number };
  remainingTotals: { kcal: number; protein: number; carbs: number; fat: number };
}> {
  const weekday = new Date().getDay();
  const empty = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  const { data: activeDays, error: adError } = await supabase
    .from('meal_plan_active_days')
    .select('meal_plan_day_id')
    .eq('weekday', weekday);
  if (adError || !activeDays || activeDays.length === 0) {
    return { entries: [], consumedTotals: empty, remainingTotals: empty };
  }

  const dayIds = activeDays.map((r: { meal_plan_day_id: number }) => r.meal_plan_day_id);
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('*')
    .in('meal_plan_day_id', dayIds)
    .order('meal_type')
    .order('created_at');
  if (error) throw error;

  const rows = (data ?? []) as MealPlanEntry[];
  const completed = new Set(completedIds ?? []);

  const sum = (items: MealPlanEntry[]) =>
    items.reduce(
      (acc, e) => ({
        kcal: acc.kcal + (e.kcal ?? 0),
        protein: acc.protein + (e.protein ?? 0),
        carbs: acc.carbs + (e.carbs ?? 0),
        fat: acc.fat + (e.fat ?? 0),
      }),
      { ...empty }
    );

  return {
    entries: rows,
    consumedTotals: sum(rows.filter((e) => completed.has(e.id))),
    remainingTotals: sum(rows.filter((e) => !completed.has(e.id))),
  };
}
