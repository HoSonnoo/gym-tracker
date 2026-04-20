// Sul web tutti gli accessi ai dati passano attraverso il repository Supabase.
// Questo file viene risolto da Metro/webpack al posto di index.ts (expo-sqlite).

// ─── Tipi condivisi ───────────────────────────────────────────────────────────
export type {
  Exercise,
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
  FoodItem,
  NutritionLog,
  BodyWeightLog,
  MealPlan,
  MealPlanDay,
  MealPlanEntry,
  HistoricalSet,
  ResetOptions,
  ImportMode,
  Recipe,
} from './types';

// ─── Stub inizializzazione (no SQLite su web) ─────────────────────────────────
export async function initDatabase(): Promise<void> {}
export async function getDb(): Promise<never> {
  throw new Error('SQLite non disponibile su web');
}

// ─── Esercizi ─────────────────────────────────────────────────────────────────
export {
  getExercises,
  addExercise,
  updateExercise,
  deleteExercise,
  hasExercises,
} from '@/repository/exercises.web';

// ─── Workout Templates ────────────────────────────────────────────────────────
export {
  addWorkoutTemplate,
  getWorkoutTemplates,
  deleteWorkoutTemplate,
  getWorkoutTemplateById,
  updateWorkoutTemplate,
  getTemplateExercises,
  addExerciseToTemplate,
  removeExerciseFromTemplate,
  getTemplateExerciseById,
  reorderTemplateExercises,
  setTemplateSuperset,
  clearTemplateSuperset,
  getTemplateExerciseSets,
  addTemplateExerciseSet,
  updateTemplateExerciseSet,
  deleteTemplateExerciseSet,
  getTemplateExerciseSetById,
  startWorkoutSessionFromTemplate,
  getActiveWorkoutSession,
  getWorkoutSessionById,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  updateWorkoutSessionSet,
  completeWorkoutSession,
  cancelWorkoutSession,
  deleteWorkoutSession,
  getCompletedWorkoutSessions,
  getWorkoutSessionDetail,
  updateSessionRatingAndNotes,
  addExerciseToSession,
  addEmptySetToSessionExercise,
  removeSetFromSessionExercise,
  removeExerciseFromSession,
  reorderSessionExercises,
  setSessionSuperset,
  clearSessionSuperset,
  getGlobalStats,
  getLastSessionSetsForExercise,
  getTodayCompletedSessions,
  getPersonalRecords,
  getExerciseVolumeSummary,
  getWeeklyFrequency,
  getExerciseWeightHistory,
  saveHistoricalSession,
  hasTemplates,
  isDatabaseEmpty,
} from '@/repository/workouts.web';

// ─── Nutrizione ───────────────────────────────────────────────────────────────
export {
  getFoodItems,
  addFoodItem,
  deleteFoodItem,
  getNutritionLogsByDate,
  addNutritionLog,
  deleteNutritionLog,
  getWaterLogByDate,
  addWaterLog,
  resetWaterLog,
} from '@/repository/nutrition.web';

// ─── Salute ───────────────────────────────────────────────────────────────────
export {
  getBodyWeightLogs,
  upsertBodyWeightLog,
  deleteBodyWeightLog,
} from '@/repository/health.web';

// ─── Piani Alimentari ─────────────────────────────────────────────────────────
export {
  getMealPlans,
  addMealPlan,
  deleteMealPlan,
  getMealPlanDays,
  addMealPlanDay,
  deleteMealPlanDay,
  getMealPlanEntries,
  addMealPlanEntry,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  setMealPlanActiveDays,
  getActivePlanEntriesForToday,
} from '@/repository/mealplans.web';

// ─── Ricette ──────────────────────────────────────────────────────────────────
export {
  getRecipes,
  addRecipe,
  deleteRecipe,
} from '@/repository/recipes.web';

// ─── Reset (Supabase) ─────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase';
import type { ResetOptions } from './types';

export async function resetSelective(options: ResetOptions): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const uid = user.id;

  if (options.sessions) {
    await supabase.from('workout_session_sets').delete().eq('user_id', uid);
    await supabase.from('workout_session_exercises').delete().eq('user_id', uid);
    await supabase.from('workout_sessions').delete().eq('user_id', uid);
  }
  if (options.templates) {
    if (!options.sessions) {
      await supabase.from('workout_session_sets').delete().eq('user_id', uid);
      await supabase.from('workout_session_exercises').delete().eq('user_id', uid);
      await supabase.from('workout_sessions').delete().eq('user_id', uid);
    }
    await supabase.from('template_exercise_sets').delete().eq('user_id', uid);
    await supabase.from('workout_template_exercises').delete().eq('user_id', uid);
    await supabase.from('workout_templates').delete().eq('user_id', uid);
    await supabase.from('exercises').delete().eq('user_id', uid);
  }
  if (options.nutritionLogs) {
    await supabase.from('nutrition_logs').delete().eq('user_id', uid);
    await supabase.from('water_logs').delete().eq('user_id', uid);
  }
  if (options.mealPlans) {
    await supabase.from('meal_plan_entries').delete().eq('user_id', uid);
    await supabase.from('meal_plan_days').delete().eq('user_id', uid);
    await supabase.from('meal_plans').delete().eq('user_id', uid);
  }
  if (options.bodyWeight) {
    await supabase.from('body_weight_logs').delete().eq('user_id', uid);
  }
  if (options.foodCatalog) {
    await supabase.from('food_items').delete().eq('user_id', uid);
  }
}

export async function resetSessions(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const uid = user.id;
  await supabase.from('workout_session_sets').delete().eq('user_id', uid);
  await supabase.from('workout_session_exercises').delete().eq('user_id', uid);
  await supabase.from('workout_sessions').delete().eq('user_id', uid);
}

export async function resetAll(): Promise<void> {
  await resetSelective({
    sessions: true, templates: true, nutritionLogs: true,
    mealPlans: true, bodyWeight: true, foodCatalog: true,
  });
}

// ─── Export/Import (non supportato su web nella versione attuale) ─────────────
export async function exportAllData(): Promise<never> {
  throw new Error('Esporta dati non disponibile su web. Usa l\'app mobile.');
}

export async function importData(): Promise<never> {
  throw new Error('Importa dati non disponibile su web. Usa l\'app mobile.');
}
