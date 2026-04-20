import { getUserId } from '@/lib/userId';
import { supabase } from '@/lib/supabase';
import type { BodyWeightLog } from '@/types';

export async function getBodyWeightLogs(phase?: 'bulk' | 'cut' | null): Promise<BodyWeightLog[]> {
  let query = supabase
    .from('body_weight_logs')
    .select('*')
    .order('date', { ascending: false });

  if (phase !== undefined && phase !== null) {
    query = query.eq('phase', phase);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BodyWeightLog[];
}

export async function upsertBodyWeightLog(
  date: string,
  weight_kg: number,
  notes: string | null,
  phase: 'bulk' | 'cut' | null = null
): Promise<void> {
  const userId = await getUserId();

  let query = supabase
    .from('body_weight_logs')
    .select('id')
    .eq('date', date);

  if (phase !== null) {
    query = query.eq('phase', phase);
  } else {
    query = query.is('phase', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('body_weight_logs')
      .update({ weight_kg, notes })
      .eq('id', (existing as { id: number }).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('body_weight_logs')
      .insert({ date, weight_kg, notes, phase, user_id: userId });
    if (error) throw error;
  }
}

export async function deleteBodyWeightLog(id: number): Promise<void> {
  const { error } = await supabase
    .from('body_weight_logs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
