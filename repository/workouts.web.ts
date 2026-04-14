import { getUserId } from '@/lib/webUserId';
import { supabase } from '@/lib/supabase';
import type {
  WorkoutTemplate,
  TemplateExercise,
  TemplateExerciseSet,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionSet,
  WorkoutSessionDetail,
  GlobalStats,
  LastSessionSet,
  ExercisePR,
  ExerciseVolume,
  ExerciseWeightHistory,
  HistoricalSet,
} from '@/database';


// ─── Templates ────────────────────────────────────────────────────────────────

export async function addWorkoutTemplate(name: string, notes: string | null): Promise<number> {
  const userId = await getUserId();
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Inserisci il nome del template.');
  const { data, error } = await supabase
    .from('workout_templates')
    .insert({ name: normalizedName, notes: notes?.trim() || null, user_id: userId })
    .select('id')
    .single();
  if (error) throw new Error('Impossibile creare il template.');
  return data.id;
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('id, name, notes, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkoutTemplate[];
}

export async function deleteWorkoutTemplate(id: number): Promise<void> {
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getWorkoutTemplateById(id: number): Promise<WorkoutTemplate | null> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('id, name, notes, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as WorkoutTemplate | null;
}

export async function updateWorkoutTemplate(id: number, name: string, notes: string | null): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Inserisci il nome del template.');
  const { error } = await supabase
    .from('workout_templates')
    .update({ name: normalizedName, notes: notes?.trim() || null })
    .eq('id', id);
  if (error) throw error;
}

// ─── Template Exercises ───────────────────────────────────────────────────────

export async function getTemplateExercises(templateId: number): Promise<TemplateExercise[]> {
  const { data: teData, error: teError } = await supabase
    .from('workout_template_exercises')
    .select('id, template_id, exercise_id, exercise_order, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, superset_group_id')
    .eq('template_id', templateId)
    .order('exercise_order');
  if (teError) throw teError;
  if (!teData || teData.length === 0) return [];

  const exerciseIds = [...new Set(teData.map(te => te.exercise_id))];
  const { data: exData, error: exError } = await supabase
    .from('exercises')
    .select('id, name, category')
    .in('id', exerciseIds);
  if (exError) throw exError;

  const exerciseMap = new Map((exData ?? []).map(e => [e.id, e]));
  return teData.map(te => ({
    ...te,
    exercise_name: exerciseMap.get(te.exercise_id)?.name ?? '',
    exercise_category: exerciseMap.get(te.exercise_id)?.category ?? null,
  })) as TemplateExercise[];
}

export async function addExerciseToTemplate(templateId: number, exerciseId: number): Promise<void> {
  const { count } = await supabase
    .from('workout_template_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)
    .eq('exercise_id', exerciseId);
  if ((count ?? 0) > 0) throw new Error('Questo esercizio è già presente nel template.');

  const { data: maxRow } = await supabase
    .from('workout_template_exercises')
    .select('exercise_order')
    .eq('template_id', templateId)
    .order('exercise_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow?.exercise_order as number) ?? 0) + 1;
  const userId = await getUserId();

  const { error } = await supabase
    .from('workout_template_exercises')
    .insert({ template_id: templateId, exercise_id: exerciseId, exercise_order: nextOrder, user_id: userId });
  if (error) throw error;
}

export async function removeExerciseFromTemplate(templateExerciseId: number): Promise<void> {
  const { error } = await supabase
    .from('workout_template_exercises')
    .delete()
    .eq('id', templateExerciseId);
  if (error) throw error;
}

export async function getTemplateExerciseById(id: number): Promise<TemplateExercise | null> {
  const { data, error } = await supabase
    .from('workout_template_exercises')
    .select('id, template_id, exercise_id, exercise_order, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, superset_group_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: ex } = await supabase
    .from('exercises')
    .select('name, category')
    .eq('id', data.exercise_id)
    .maybeSingle();

  return { ...data, exercise_name: ex?.name ?? '', exercise_category: ex?.category ?? null } as TemplateExercise;
}

export async function reorderTemplateExercises(exercises: { id: number; exercise_order: number }[]): Promise<void> {
  await Promise.all(
    exercises.map(ex =>
      supabase.from('workout_template_exercises').update({ exercise_order: ex.exercise_order }).eq('id', ex.id)
    )
  );
}

export async function setTemplateSuperset(id1: number, id2: number): Promise<void> {
  const groupId = Date.now();
  await Promise.all([
    supabase.from('workout_template_exercises').update({ superset_group_id: groupId }).eq('id', id1),
    supabase.from('workout_template_exercises').update({ superset_group_id: groupId }).eq('id', id2),
  ]);
}

export async function clearTemplateSuperset(id: number): Promise<void> {
  const { data } = await supabase
    .from('workout_template_exercises')
    .select('superset_group_id')
    .eq('id', id)
    .maybeSingle();
  if (!data?.superset_group_id) return;
  await supabase
    .from('workout_template_exercises')
    .update({ superset_group_id: null })
    .eq('superset_group_id', data.superset_group_id);
}

// ─── Template Sets ────────────────────────────────────────────────────────────

export async function getTemplateExerciseSets(templateExerciseId: number): Promise<TemplateExerciseSet[]> {
  const { data, error } = await supabase
    .from('template_exercise_sets')
    .select('id, template_exercise_id, set_order, set_type, weight_kg, reps_min, reps_max, rest_seconds, effort_type, buffer_value, notes, created_at')
    .eq('template_exercise_id', templateExerciseId)
    .order('set_order');
  if (error) throw error;
  return (data ?? []) as TemplateExerciseSet[];
}

export async function addTemplateExerciseSet(templateExerciseId: number, setType: 'warmup' | 'target'): Promise<void> {
  const { data: maxRow } = await supabase
    .from('template_exercise_sets')
    .select('set_order')
    .eq('template_exercise_id', templateExerciseId)
    .order('set_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow?.set_order as number) ?? 0) + 1;
  const userId = await getUserId();

  const { error } = await supabase
    .from('template_exercise_sets')
    .insert({ template_exercise_id: templateExerciseId, set_order: nextOrder, set_type: setType, effort_type: 'none', user_id: userId });
  if (error) throw error;
}

export async function updateTemplateExerciseSet(
  id: number,
  data: {
    set_type: 'warmup' | 'target';
    weight_kg: number | null;
    reps_min: number | null;
    reps_max: number | null;
    rest_seconds: number | null;
    effort_type: 'none' | 'buffer' | 'failure' | 'drop_set';
    buffer_value: number | null;
    notes: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('template_exercise_sets')
    .update(data)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTemplateExerciseSet(id: number): Promise<void> {
  const { data: row } = await supabase
    .from('template_exercise_sets')
    .select('template_exercise_id')
    .eq('id', id)
    .maybeSingle();

  await supabase.from('template_exercise_sets').delete().eq('id', id);

  if (row?.template_exercise_id) {
    const { data: remaining } = await supabase
      .from('template_exercise_sets')
      .select('id')
      .eq('template_exercise_id', row.template_exercise_id)
      .order('set_order');
    await Promise.all(
      (remaining ?? []).map((r, i) =>
        supabase.from('template_exercise_sets').update({ set_order: i + 1 }).eq('id', r.id)
      )
    );
  }
}

export async function getTemplateExerciseSetById(id: number): Promise<TemplateExerciseSet | null> {
  const { data, error } = await supabase
    .from('template_exercise_sets')
    .select('id, template_exercise_id, set_order, set_type, weight_kg, reps_min, reps_max, rest_seconds, effort_type, buffer_value, notes, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TemplateExerciseSet | null;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function startWorkoutSessionFromTemplate(templateId: number): Promise<number> {
  const userId = await getUserId();

  const { data: template, error: tmplError } = await supabase
    .from('workout_templates')
    .select('id, name, notes')
    .eq('id', templateId)
    .maybeSingle();
  if (tmplError || !template) throw new Error('Template non trovato.');

  const { data: activeSession } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (activeSession) throw new Error('Esiste già una sessione attiva.');

  const { data: session, error: sessError } = await supabase
    .from('workout_sessions')
    .insert({
      template_id: template.id,
      name: template.name,
      notes: template.notes,
      status: 'active',
      started_at: new Date().toISOString(),
      user_id: userId,
    })
    .select('id')
    .single();
  if (sessError || !session) throw new Error('Impossibile creare la sessione.');

  const templateExercises = await getTemplateExercises(templateId);

  for (const te of templateExercises) {
    const { data: sessionExercise, error: seError } = await supabase
      .from('workout_session_exercises')
      .insert({
        session_id: session.id,
        template_exercise_id: te.id,
        exercise_id: te.exercise_id,
        exercise_name: te.exercise_name,
        category: te.exercise_category,
        exercise_order: te.exercise_order,
        notes: te.notes,
        superset_group_id: te.superset_group_id,
        user_id: userId,
      })
      .select('id')
      .single();
    if (seError || !sessionExercise) throw seError ?? new Error('Errore creando esercizio sessione.');

    const { data: sets } = await supabase
      .from('template_exercise_sets')
      .select('*')
      .eq('template_exercise_id', te.id)
      .order('set_order');

    for (const s of (sets ?? [])) {
      const { error: setErr } = await supabase
        .from('workout_session_sets')
        .insert({
          session_exercise_id: sessionExercise.id,
          template_set_id: s.id,
          set_order: s.set_order,
          target_set_type: s.set_type,
          target_weight_kg: s.weight_kg,
          target_reps_min: s.reps_min,
          target_reps_max: s.reps_max,
          target_rest_seconds: s.rest_seconds,
          target_effort_type: s.effort_type,
          target_buffer_value: s.buffer_value,
          target_notes: s.notes,
          user_id: userId,
        });
      if (setErr) throw setErr;
    }
  }

  return session.id;
}

export async function getActiveWorkoutSession(): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, template_id, name, notes, rating, status, started_at, completed_at, created_at')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WorkoutSession | null;
}

export async function getWorkoutSessionById(id: number): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, template_id, name, notes, rating, status, started_at, completed_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as WorkoutSession | null;
}

export async function getWorkoutSessionExercises(sessionId: number): Promise<WorkoutSessionExercise[]> {
  const { data, error } = await supabase
    .from('workout_session_exercises')
    .select('id, session_id, template_exercise_id, exercise_id, exercise_name, category, exercise_order, notes, superset_group_id, created_at')
    .eq('session_id', sessionId)
    .order('exercise_order');
  if (error) throw error;
  return (data ?? []) as WorkoutSessionExercise[];
}

export async function getWorkoutSessionSets(sessionExerciseId: number): Promise<WorkoutSessionSet[]> {
  const { data, error } = await supabase
    .from('workout_session_sets')
    .select('id, session_exercise_id, template_set_id, set_order, target_set_type, target_weight_kg, target_reps_min, target_reps_max, target_rest_seconds, target_effort_type, target_buffer_value, target_notes, actual_weight_kg, actual_reps, actual_effort_type, actual_buffer_value, actual_rir, actual_notes, is_completed, completed_at, created_at')
    .eq('session_exercise_id', sessionExerciseId)
    .order('set_order');
  if (error) throw error;
  return (data ?? []).map(r => ({ ...r, is_completed: r.is_completed ? 1 : 0 })) as WorkoutSessionSet[];
}

export async function updateWorkoutSessionSet(
  id: number,
  data: {
    actual_weight_kg: number | null;
    actual_reps: number | null;
    actual_effort_type: 'none' | 'buffer' | 'failure' | 'drop_set' | null;
    actual_buffer_value: number | null;
    actual_rir: number | null;
    actual_notes: string | null;
    is_completed: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from('workout_session_sets')
    .update({
      ...data,
      completed_at: data.is_completed === 1 ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function completeWorkoutSession(sessionId: number): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function cancelWorkoutSession(sessionId: number): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function deleteWorkoutSession(sessionId: number): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

export async function getCompletedWorkoutSessions(): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, template_id, name, notes, rating, status, started_at, completed_at, created_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkoutSession[];
}

export async function getWorkoutSessionDetail(sessionId: number): Promise<WorkoutSessionDetail | null> {
  const session = await getWorkoutSessionById(sessionId);
  if (!session) return null;
  const exercises = await getWorkoutSessionExercises(sessionId);
  const exercisesWithSets = await Promise.all(
    exercises.map(async exercise => ({
      exercise,
      sets: await getWorkoutSessionSets(exercise.id),
    }))
  );
  return { session, exercises: exercisesWithSets };
}

export async function updateSessionRatingAndNotes(sessionId: number, rating: number | null, notes: string | null): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ rating, notes })
    .eq('id', sessionId);
  if (error) throw error;
}

// ─── Session Operations ───────────────────────────────────────────────────────

export async function addExerciseToSession(sessionId: number, exerciseId: number, exerciseName: string, category: string | null): Promise<number> {
  const userId = await getUserId();
  const { data: maxRow } = await supabase
    .from('workout_session_exercises')
    .select('exercise_order')
    .eq('session_id', sessionId)
    .order('exercise_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow?.exercise_order as number) ?? 0) + 1;

  const { data, error } = await supabase
    .from('workout_session_exercises')
    .insert({ session_id: sessionId, exercise_id: exerciseId, exercise_name: exerciseName, category, exercise_order: nextOrder, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function addEmptySetToSessionExercise(sessionExerciseId: number): Promise<void> {
  const userId = await getUserId();
  const { data: maxRow } = await supabase
    .from('workout_session_sets')
    .select('set_order')
    .eq('session_exercise_id', sessionExerciseId)
    .order('set_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow?.set_order as number) ?? 0) + 1;

  const { error } = await supabase
    .from('workout_session_sets')
    .insert({ session_exercise_id: sessionExerciseId, set_order: nextOrder, target_set_type: 'target', target_effort_type: 'none', is_completed: false, user_id: userId });
  if (error) throw error;
}

export async function removeSetFromSessionExercise(setId: number): Promise<void> {
  const { error } = await supabase.from('workout_session_sets').delete().eq('id', setId);
  if (error) throw error;
}

export async function removeExerciseFromSession(sessionExerciseId: number): Promise<void> {
  const { error } = await supabase.from('workout_session_exercises').delete().eq('id', sessionExerciseId);
  if (error) throw error;
}

export async function reorderSessionExercises(exercises: { id: number; exercise_order: number }[]): Promise<void> {
  await Promise.all(
    exercises.map(ex =>
      supabase.from('workout_session_exercises').update({ exercise_order: ex.exercise_order }).eq('id', ex.id)
    )
  );
}

export async function setSessionSuperset(id1: number, id2: number): Promise<void> {
  const groupId = Date.now();
  await Promise.all([
    supabase.from('workout_session_exercises').update({ superset_group_id: groupId }).eq('id', id1),
    supabase.from('workout_session_exercises').update({ superset_group_id: groupId }).eq('id', id2),
  ]);
}

export async function clearSessionSuperset(id: number): Promise<void> {
  const { data } = await supabase
    .from('workout_session_exercises')
    .select('superset_group_id')
    .eq('id', id)
    .maybeSingle();
  if (!data?.superset_group_id) return;
  await supabase
    .from('workout_session_exercises')
    .update({ superset_group_id: null })
    .eq('superset_group_id', data.superset_group_id);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getGlobalStats(): Promise<GlobalStats> {
  const { count: totalSessions } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed');

  const { data: sessionIds } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('status', 'completed');

  const ids = (sessionIds ?? []).map(s => s.id);
  let totalVolumeKg = 0;

  if (ids.length > 0) {
    const { data: seRows } = await supabase
      .from('workout_session_exercises')
      .select('id')
      .in('session_id', ids);
    const seIds = (seRows ?? []).map(se => se.id);

    if (seIds.length > 0) {
      const { data: sets } = await supabase
        .from('workout_session_sets')
        .select('actual_weight_kg, actual_reps')
        .in('session_exercise_id', seIds)
        .eq('is_completed', true)
        .not('actual_weight_kg', 'is', null)
        .not('actual_reps', 'is', null);
      totalVolumeKg = (sets ?? []).reduce((sum, s) =>
        sum + ((s.actual_weight_kg ?? 0) * (s.actual_reps ?? 0)), 0
      );
    }
  }

  const { data: completedSessions } = await supabase
    .from('workout_sessions')
    .select('completed_at')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  const uniqueDates = [...new Set(
    (completedSessions ?? []).map(s => s.completed_at!.slice(0, 10))
  )];
  const dateRows = uniqueDates.map(d => ({ d }));

  function getMondayStr(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  const weekSet = new Set(dateRows.map(r => getMondayStr(r.d)));
  const sortedWeeks = Array.from(weekSet).sort();

  let currentStreak = 0;
  const now = new Date();
  const thisMonday = getMondayStr(now.toISOString().slice(0, 10));
  const prevMonday = (() => {
    const d = new Date(thisMonday + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  let cursor: string | null = weekSet.has(thisMonday) ? thisMonday : (weekSet.has(prevMonday) ? prevMonday : null);
  while (cursor && weekSet.has(cursor)) {
    currentStreak++;
    const d = new Date(cursor + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }

  let bestStreak = 0;
  let run = 1;
  for (let i = 1; i < sortedWeeks.length; i++) {
    const prev = new Date(sortedWeeks[i - 1] + 'T00:00:00');
    const curr = new Date(sortedWeeks[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 7) run++;
    else { bestStreak = Math.max(bestStreak, run); run = 1; }
  }
  if (sortedWeeks.length > 0) bestStreak = Math.max(bestStreak, run);

  return {
    totalSessions: totalSessions ?? 0,
    totalVolumeKg: Math.round(totalVolumeKg),
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
  };
}

export async function getLastSessionSetsForExercise(exerciseName: string, currentSessionId: number): Promise<LastSessionSet[]> {
  const { data: seRows } = await supabase
    .from('workout_session_exercises')
    .select('id, session_id')
    .eq('exercise_name', exerciseName)
    .neq('session_id', currentSessionId);

  if (!seRows || seRows.length === 0) return [];

  const sessionIds = [...new Set(seRows.map(se => se.session_id))];
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .in('id', sessionIds)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (!sessions || sessions.length === 0) return [];

  const lastSessionId = sessions[0].id;
  const sessionExercise = seRows.find(se => se.session_id === lastSessionId);
  if (!sessionExercise) return [];

  const { data: sets } = await supabase
    .from('workout_session_sets')
    .select('actual_weight_kg, actual_reps, actual_effort_type, actual_buffer_value, set_order')
    .eq('session_exercise_id', sessionExercise.id)
    .eq('is_completed', true)
    .order('set_order');

  return (sets ?? []) as LastSessionSet[];
}

export async function getTodayCompletedSessions(): Promise<WorkoutSessionDetail[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, template_id, name, notes, rating, status, started_at, completed_at, created_at')
    .eq('status', 'completed')
    .gte('completed_at', today + 'T00:00:00.000Z')
    .lt('completed_at', today + 'T23:59:59.999Z')
    .order('completed_at', { ascending: false });

  return Promise.all(
    (sessions ?? []).map(async session => {
      const exercises = await getWorkoutSessionExercises(session.id);
      const exercisesWithSets = await Promise.all(
        exercises.map(async exercise => ({
          exercise,
          sets: await getWorkoutSessionSets(exercise.id),
        }))
      );
      return { session: session as WorkoutSession, exercises: exercisesWithSets };
    })
  );
}

export async function getPersonalRecords(): Promise<ExercisePR[]> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('status', 'completed');

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);
  const sessionMap = new Map(sessions.map(s => [s.id, s.completed_at]));

  const { data: seRows } = await supabase
    .from('workout_session_exercises')
    .select('id, session_id, exercise_name, category')
    .in('session_id', sessionIds);

  if (!seRows || seRows.length === 0) return [];

  const seIds = seRows.map(se => se.id);
  const seMap = new Map(seRows.map(se => [se.id, se]));

  const { data: sets } = await supabase
    .from('workout_session_sets')
    .select('session_exercise_id, actual_weight_kg, actual_reps')
    .in('session_exercise_id', seIds)
    .eq('is_completed', true)
    .not('actual_weight_kg', 'is', null);

  const prMap = new Map<string, ExercisePR>();
  for (const set of (sets ?? [])) {
    const se = seMap.get(set.session_exercise_id);
    if (!se) continue;
    const existing = prMap.get(se.exercise_name);
    if (!existing || (set.actual_weight_kg ?? 0) > existing.max_weight_kg) {
      prMap.set(se.exercise_name, {
        exercise_name: se.exercise_name,
        category: se.category,
        max_weight_kg: set.actual_weight_kg,
        reps_at_max: set.actual_reps,
        achieved_at: sessionMap.get(se.session_id) ?? '',
      });
    }
  }

  return Array.from(prMap.values()).sort((a, b) => {
    const catCmp = (a.category ?? '').localeCompare(b.category ?? '');
    return catCmp !== 0 ? catCmp : a.exercise_name.localeCompare(b.exercise_name);
  });
}

export async function getExerciseVolumeSummary(): Promise<ExerciseVolume[]> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('status', 'completed');

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);
  const { data: seRows } = await supabase
    .from('workout_session_exercises')
    .select('id, exercise_name, category')
    .in('session_id', sessionIds);

  if (!seRows || seRows.length === 0) return [];

  const seIds = seRows.map(se => se.id);
  const seMap = new Map(seRows.map(se => [se.id, se]));

  const { data: sets } = await supabase
    .from('workout_session_sets')
    .select('session_exercise_id, actual_weight_kg, actual_reps')
    .in('session_exercise_id', seIds)
    .eq('is_completed', true);

  const volumeMap = new Map<string, ExerciseVolume>();
  for (const set of (sets ?? [])) {
    const se = seMap.get(set.session_exercise_id);
    if (!se) continue;
    const existing = volumeMap.get(se.exercise_name) ?? {
      exercise_name: se.exercise_name, category: se.category,
      total_sets: 0, total_reps: 0, total_volume_kg: 0,
    };
    existing.total_sets++;
    existing.total_reps += set.actual_reps ?? 0;
    existing.total_volume_kg += (set.actual_weight_kg ?? 0) * (set.actual_reps ?? 0);
    volumeMap.set(se.exercise_name, existing);
  }

  return Array.from(volumeMap.values()).sort((a, b) => {
    const catCmp = (a.category ?? '').localeCompare(b.category ?? '');
    return catCmp !== 0 ? catCmp : b.total_volume_kg - a.total_volume_kg;
  });
}

export async function getWeeklyFrequency(): Promise<{
  average_per_week: number;
  total_sessions: number;
  weeks_active: number;
  first_session_at: string | null;
}> {
  const { data } = await supabase
    .from('workout_sessions')
    .select('completed_at')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at');

  const rows = data ?? [];
  if (rows.length === 0) return { average_per_week: 0, total_sessions: 0, weeks_active: 0, first_session_at: null };

  const firstSessionAt = rows[0].completed_at!;
  const firstDate = new Date(firstSessionAt);
  const now = new Date();
  const diffMs = now.getTime() - firstDate.getTime();
  const weeks = Math.max(diffMs / (1000 * 60 * 60 * 24 * 7), 1);
  const average = rows.length / weeks;

  return {
    average_per_week: Math.round(average * 10) / 10,
    total_sessions: rows.length,
    weeks_active: Math.ceil(weeks),
    first_session_at: firstSessionAt,
  };
}

export async function getExerciseWeightHistory(exerciseName: string): Promise<ExerciseWeightHistory[]> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, name, completed_at')
    .eq('status', 'completed')
    .not('completed_at', 'is', null);

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  const { data: seRows } = await supabase
    .from('workout_session_exercises')
    .select('id, session_id')
    .in('session_id', sessionIds)
    .eq('exercise_name', exerciseName);

  if (!seRows || seRows.length === 0) return [];

  const seIds = seRows.map(se => se.id);
  const seToSession = new Map(seRows.map(se => [se.id, se.session_id]));

  const { data: sets } = await supabase
    .from('workout_session_sets')
    .select('session_exercise_id, set_order, actual_weight_kg, actual_reps, target_set_type')
    .in('session_exercise_id', seIds)
    .eq('is_completed', true)
    .not('actual_weight_kg', 'is', null);

  return (sets ?? [])
    .map(s => {
      const sessionId = seToSession.get(s.session_exercise_id);
      const session = sessionMap.get(sessionId!);
      return {
        session_name: session?.name ?? '',
        completed_at: session?.completed_at ?? '',
        set_order: s.set_order,
        actual_weight_kg: s.actual_weight_kg,
        actual_reps: s.actual_reps,
        target_set_type: s.target_set_type,
      };
    })
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at) || a.set_order - b.set_order) as ExerciseWeightHistory[];
}

// ─── Historical Session ───────────────────────────────────────────────────────

export async function saveHistoricalSession(params: {
  date: string;
  name: string;
  notes: string | null;
  templateId: number | null;
  exercises: HistoricalSet[];
}): Promise<number> {
  const userId = await getUserId();
  const startedAt = params.date + 'T09:00:00.000Z';
  const completedAt = params.date + 'T10:00:00.000Z';

  const { data: session, error: sessError } = await supabase
    .from('workout_sessions')
    .insert({ template_id: params.templateId, name: params.name, notes: params.notes, status: 'completed', started_at: startedAt, completed_at: completedAt, user_id: userId })
    .select('id')
    .single();
  if (sessError || !session) throw sessError ?? new Error('Errore creando sessione storica.');

  for (let ei = 0; ei < params.exercises.length; ei++) {
    const ex = params.exercises[ei];
    const { data: exRow } = await supabase
      .from('exercises')
      .select('id')
      .eq('name', ex.exercise_name)
      .maybeSingle();

    const { data: se, error: seError } = await supabase
      .from('workout_session_exercises')
      .insert({ session_id: session.id, exercise_id: exRow?.id ?? null, exercise_name: ex.exercise_name, category: ex.category, exercise_order: ei + 1, user_id: userId })
      .select('id')
      .single();
    if (seError || !se) throw seError ?? new Error('Errore creando esercizio storico.');

    for (let si = 0; si < ex.sets.length; si++) {
      const s = ex.sets[si];
      const { error: setErr } = await supabase
        .from('workout_session_sets')
        .insert({
          session_exercise_id: se.id,
          set_order: si + 1,
          target_set_type: s.set_type,
          target_weight_kg: s.weight_kg,
          target_reps_min: s.reps,
          target_reps_max: s.reps,
          target_effort_type: 'none',
          actual_weight_kg: s.weight_kg,
          actual_reps: s.reps,
          actual_effort_type: 'none',
          is_completed: true,
          completed_at: completedAt,
          user_id: userId,
        });
      if (setErr) throw setErr;
    }
  }

  return session.id;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export async function hasTemplates(): Promise<boolean> {
  const { count } = await supabase
    .from('workout_templates')
    .select('id', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const [exercises, sessions] = await Promise.all([
    supabase.from('exercises').select('id', { count: 'exact', head: true }),
    supabase.from('workout_sessions').select('id', { count: 'exact', head: true }),
  ]);
  return (exercises.count ?? 0) === 0 && (sessions.count ?? 0) === 0;
}
