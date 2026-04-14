// Tipi condivisi tra native (SQLite) e web (Supabase).
// Questo file NON importa expo-sqlite — è sicuro su tutte le piattaforme.

export type Exercise = {
  id: number;
  name: string;
  category: string | null;
  created_at: string;
};

export type WorkoutTemplate = {
  id: number;
  name: string;
  notes: string | null;
  created_at: string;
};

export type TemplateExercise = {
  id: number;
  template_id: number;
  exercise_id: number;
  exercise_order: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercise_name: string;
  exercise_category: string | null;
  superset_group_id: number | null;
};

export type TemplateExerciseSet = {
  id: number;
  template_exercise_id: number;
  set_order: number;
  set_type: 'warmup' | 'target';
  weight_kg: number | null;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  effort_type: 'none' | 'buffer' | 'failure' | 'drop_set';
  buffer_value: number | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutSession = {
  id: number;
  template_id: number | null;
  name: string;
  notes: string | null;
  rating: number | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type WorkoutSessionExercise = {
  id: number;
  session_id: number;
  template_exercise_id: number | null;
  exercise_id: number | null;
  exercise_name: string;
  category: string | null;
  exercise_order: number;
  notes: string | null;
  superset_group_id: number | null;
  created_at: string;
};

export type WorkoutSessionSet = {
  id: number;
  session_exercise_id: number;
  template_set_id: number | null;
  set_order: number;
  target_set_type: 'warmup' | 'target';
  target_weight_kg: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_rest_seconds: number | null;
  target_effort_type: 'none' | 'buffer' | 'failure' | 'drop_set';
  target_buffer_value: number | null;
  target_notes: string | null;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_effort_type: 'none' | 'buffer' | 'failure' | 'drop_set' | null;
  actual_buffer_value: number | null;
  actual_rir: number | null;
  actual_notes: string | null;
  is_completed: number;
  completed_at: string | null;
  created_at: string;
};

export type WorkoutSessionDetail = {
  session: WorkoutSession;
  exercises: {
    exercise: WorkoutSessionExercise;
    sets: WorkoutSessionSet[];
  }[];
};

export type GlobalStats = {
  totalSessions: number;
  totalVolumeKg: number;
  currentStreak: number;
  bestStreak: number;
};

export type LastSessionSet = {
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_effort_type: string | null;
  actual_buffer_value: number | null;
  set_order: number;
};

export type ExercisePR = {
  exercise_name: string;
  category: string | null;
  max_weight_kg: number;
  reps_at_max: number | null;
  achieved_at: string;
};

export type ExerciseVolume = {
  exercise_name: string;
  category: string | null;
  total_sets: number;
  total_reps: number;
  total_volume_kg: number;
};

export type ExerciseWeightHistory = {
  session_name: string;
  completed_at: string;
  set_order: number;
  actual_weight_kg: number;
  actual_reps: number | null;
  target_set_type: string;
};

export type FoodItem = {
  id: number;
  name: string;
  kcal_per_100g: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: 'manual' | 'openfoodfacts';
  external_id: string | null;
  created_at: string;
};

export type NutritionLog = {
  id: number;
  date: string;
  meal_type: string;
  food_item_id: number | null;
  food_name: string;
  grams: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  created_at: string;
};

export type BodyWeightLog = {
  id: number;
  date: string;
  weight_kg: number;
  notes: string | null;
  phase: 'bulk' | 'cut' | null;
  created_at: string;
};

export type MealPlan = {
  id: number;
  name: string;
  plan_type: 'weekly' | 'cycle';
  created_at: string;
};

export type MealPlanDay = {
  id: number;
  meal_plan_id: number;
  day_order: number;
  label: string;
  created_at: string;
};

export type MealPlanEntry = {
  id: number;
  meal_plan_day_id: number;
  meal_type: string;
  food_item_id: number | null;
  food_name: string;
  grams: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  created_at: string;
};

export type HistoricalSet = {
  exercise_name: string;
  category: string | null;
  sets: {
    weight_kg: number | null;
    reps: number | null;
    set_type: 'warmup' | 'target';
  }[];
};

export type ResetOptions = {
  sessions: boolean;
  templates: boolean;
  nutritionLogs: boolean;
  mealPlans: boolean;
  bodyWeight: boolean;
  foodCatalog: boolean;
};

export type ImportMode = 'replace_all' | 'overwrite_existing' | 'add_only';

export type Recipe = {
  id: number;
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
  created_at: string;
};
