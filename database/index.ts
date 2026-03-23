import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('gym-tracker-v2.db');
  return db;
}

export async function initDatabase() {
  const database = await getDb();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workout_template_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      exercise_order INTEGER NOT NULL,
      target_sets INTEGER,
      target_reps_min INTEGER,
      target_reps_max INTEGER,
      rest_seconds INTEGER,
      notes TEXT,
      FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS template_exercise_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_exercise_id INTEGER NOT NULL,
      set_order INTEGER NOT NULL,
      set_type TEXT NOT NULL,
      weight_kg REAL,
      reps_min INTEGER,
      reps_max INTEGER,
      rest_seconds INTEGER,
      effort_type TEXT NOT NULL DEFAULT 'none',
      buffer_value INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_exercise_id) REFERENCES workout_template_exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      name TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS workout_session_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      template_exercise_id INTEGER,
      exercise_id INTEGER,
      exercise_name TEXT NOT NULL,
      category TEXT,
      exercise_order INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (template_exercise_id) REFERENCES workout_template_exercises(id) ON DELETE SET NULL,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      plan_type TEXT NOT NULL DEFAULT 'weekly',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meal_plan_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      day_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_day_id INTEGER NOT NULL,
      meal_type TEXT NOT NULL,
      food_item_id INTEGER,
      food_name TEXT NOT NULL,
      grams REAL NOT NULL,
      kcal REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_plan_day_id) REFERENCES meal_plan_days(id) ON DELETE CASCADE,
      FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kcal_per_100g REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      source TEXT NOT NULL DEFAULT 'manual',
      external_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      food_item_id INTEGER,
      food_name TEXT NOT NULL,
      grams REAL NOT NULL,
      kcal REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS water_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      ml INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS body_weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight_kg REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workout_session_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_exercise_id INTEGER NOT NULL,
      template_set_id INTEGER,
      set_order INTEGER NOT NULL,

      target_set_type TEXT NOT NULL,
      target_weight_kg REAL,
      target_reps_min INTEGER,
      target_reps_max INTEGER,
      target_rest_seconds INTEGER,
      target_effort_type TEXT NOT NULL DEFAULT 'none',
      target_buffer_value INTEGER,
      target_notes TEXT,

      actual_weight_kg REAL,
      actual_reps INTEGER,
      actual_effort_type TEXT,
      actual_buffer_value INTEGER,
      actual_rir INTEGER,
      actual_notes TEXT,

      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (session_exercise_id) REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
      FOREIGN KEY (template_set_id) REFERENCES template_exercise_sets(id) ON DELETE SET NULL
    );
  `);

  // ─── Nuove tabelle (aggiunta incrementale) ──────────────────────────────────
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        servings INTEGER NOT NULL DEFAULT 1,
        kcal REAL,
        protein REAL,
        carbs REAL,
        fat REAL,
        ingredients TEXT,
        instructions TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        food_name TEXT NOT NULL,
        grams REAL NOT NULL,
        kcal REAL,
        protein REAL,
        carbs REAL,
        fat REAL,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meal_plan_active_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_plan_id INTEGER NOT NULL,
        meal_plan_day_id INTEGER NOT NULL,
        weekday INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (meal_plan_day_id) REFERENCES meal_plan_days(id) ON DELETE CASCADE
      );
    `);
  } catch {
    // Tabelle già esistenti, ignorato
  }

    // ─── Migrazioni ────────────────────────────────────────────────────────────
  // v1.1: aggiunge colonna phase a body_weight_logs
  try {
    await database.execAsync(`ALTER TABLE body_weight_logs ADD COLUMN phase TEXT`);
  } catch {
    // colonna già esistente, ignorato
  }
}

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

export async function getExercises(): Promise<Exercise[]> {
  const database = await getDb();
  return database.getAllAsync<Exercise>(
    `SELECT id, name, category, created_at FROM exercises ORDER BY name ASC`
  );
}

export async function addExercise(name: string, category: string | null) {
  const database = await getDb();

  const normalizedName = name.trim();
  const normalizedCategory = category?.trim() || null;

  if (!normalizedName) {
    throw new Error('Inserisci il nome dell’esercizio.');
  }

  try {
    await database.runAsync(
      `INSERT INTO exercises (name, category) VALUES (?, ?)`,
      [normalizedName, normalizedCategory]
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Questo esercizio è già presente nel database.');
      }
    }

    throw new Error('Impossibile aggiungere l’esercizio.');
  }
}

export async function deleteExercise(id: number) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM exercises WHERE id = ?`, [id]);
}

export async function addWorkoutTemplate(name: string, notes: string | null): Promise<number> {
  const database = await getDb();

  const normalizedName = name.trim();
  const normalizedNotes = notes?.trim() || null;

  if (!normalizedName) {
    throw new Error('Inserisci il nome del template.');
  }

  try {
    const result = await database.runAsync(
      `INSERT INTO workout_templates (name, notes) VALUES (?, ?)`,
      [normalizedName, normalizedNotes]
    );
    return Number(result.lastInsertRowId);
  } catch {
    throw new Error('Impossibile creare il template.');
  }
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const database = await getDb();
  return database.getAllAsync<WorkoutTemplate>(
    `SELECT id, name, notes, created_at FROM workout_templates ORDER BY created_at DESC`
  );
}

export async function deleteWorkoutTemplate(id: number) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM workout_templates WHERE id = ?`, [id]);
}

export async function getWorkoutTemplateById(id: number): Promise<WorkoutTemplate | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<WorkoutTemplate>(
    `SELECT id, name, notes, created_at FROM workout_templates WHERE id = ?`, [id]
  );
  return row ?? null;
}

export async function getTemplateExercises(
  templateId: number
): Promise<TemplateExercise[]> {
  const database = await getDb();

  const rows = await database.getAllAsync<TemplateExercise>(
    `SELECT
      wte.id,
      wte.template_id,
      wte.exercise_id,
      wte.exercise_order,
      wte.target_sets,
      wte.target_reps_min,
      wte.target_reps_max,
      wte.rest_seconds,
      wte.notes,
      e.name AS exercise_name,
      e.category AS exercise_category
     FROM workout_template_exercises wte
     INNER JOIN exercises e ON e.id = wte.exercise_id
     WHERE wte.template_id = ?
     ORDER BY wte.exercise_order ASC`,
    [templateId]
  );

  return rows;
}

export async function addExerciseToTemplate(
  templateId: number,
  exerciseId: number
) {
  const database = await getDb();

  const existing = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM workout_template_exercises
     WHERE template_id = ? AND exercise_id = ?`,
    [templateId, exerciseId]
  );

  if (existing && existing.count > 0) {
    throw new Error('Questo esercizio è già presente nel template.');
  }

  const maxOrderRow = await database.getFirstAsync<{ maxOrder: number | null }>(
    `SELECT MAX(exercise_order) as maxOrder
     FROM workout_template_exercises
     WHERE template_id = ?`,
    [templateId]
  );

  const nextOrder = (maxOrderRow?.maxOrder ?? 0) + 1;

  await database.runAsync(
    `INSERT INTO workout_template_exercises (
      template_id,
      exercise_id,
      exercise_order
    ) VALUES (?, ?, ?)`,
    [templateId, exerciseId, nextOrder]
  );
}

export async function removeExerciseFromTemplate(templateExerciseId: number) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM workout_template_exercises WHERE id = ?`, [templateExerciseId]);
}

export async function getTemplateExerciseById(
  id: number
): Promise<TemplateExercise | null> {
  const database = await getDb();

  const row = await database.getFirstAsync<TemplateExercise>(
    `SELECT
      wte.id,
      wte.template_id,
      wte.exercise_id,
      wte.exercise_order,
      wte.target_sets,
      wte.target_reps_min,
      wte.target_reps_max,
      wte.rest_seconds,
      wte.notes,
      e.name AS exercise_name,
      e.category AS exercise_category
     FROM workout_template_exercises wte
     INNER JOIN exercises e ON e.id = wte.exercise_id
     WHERE wte.id = ?`,
    [id]
  );

  return row ?? null;
}

export async function getTemplateExerciseSets(
  templateExerciseId: number
): Promise<TemplateExerciseSet[]> {
  const database = await getDb();

  const rows = await database.getAllAsync<TemplateExerciseSet>(
    `SELECT
      id,
      template_exercise_id,
      set_order,
      set_type,
      weight_kg,
      reps_min,
      reps_max,
      rest_seconds,
      effort_type,
      buffer_value,
      notes,
      created_at
     FROM template_exercise_sets
     WHERE template_exercise_id = ?
     ORDER BY set_order ASC`,
    [templateExerciseId]
  );

  return rows;
}

export async function addTemplateExerciseSet(
  templateExerciseId: number,
  setType: 'warmup' | 'target'
) {
  const database = await getDb();

  const maxOrderRow = await database.getFirstAsync<{ maxOrder: number | null }>(
    `SELECT MAX(set_order) as maxOrder
     FROM template_exercise_sets
     WHERE template_exercise_id = ?`,
    [templateExerciseId]
  );

  const nextOrder = (maxOrderRow?.maxOrder ?? 0) + 1;

  await database.runAsync(
    `INSERT INTO template_exercise_sets (
      template_exercise_id,
      set_order,
      set_type,
      effort_type
    ) VALUES (?, ?, ?, 'none')`,
    [templateExerciseId, nextOrder, setType]
  );
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
) {
  const database = await getDb();

  await database.runAsync(
    `UPDATE template_exercise_sets
     SET
      set_type = ?,
      weight_kg = ?,
      reps_min = ?,
      reps_max = ?,
      rest_seconds = ?,
      effort_type = ?,
      buffer_value = ?,
      notes = ?
     WHERE id = ?`,
    [
      data.set_type,
      data.weight_kg,
      data.reps_min,
      data.reps_max,
      data.rest_seconds,
      data.effort_type,
      data.buffer_value,
      data.notes,
      id,
    ]
  );
}

export async function deleteTemplateExerciseSet(id: number) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM template_exercise_sets WHERE id = ?`, [id]);
}

export async function getTemplateExerciseSetById(
  id: number
): Promise<TemplateExerciseSet | null> {
  const database = await getDb();

  const row = await database.getFirstAsync<TemplateExerciseSet>(
    `SELECT
      id,
      template_exercise_id,
      set_order,
      set_type,
      weight_kg,
      reps_min,
      reps_max,
      rest_seconds,
      effort_type,
      buffer_value,
      notes,
      created_at
     FROM template_exercise_sets
     WHERE id = ?`,
    [id]
  );

  return row ?? null;
}

export async function getActiveWorkoutSession(): Promise<WorkoutSession | null> {
  const database = await getDb();

  const row = await database.getFirstAsync<WorkoutSession>(
    `SELECT
      id,
      template_id,
      name,
      notes,
      status,
      started_at,
      completed_at,
      created_at
     FROM workout_sessions
     WHERE status = 'active'
     ORDER BY started_at DESC
     LIMIT 1`
  );

  return row ?? null;
}

export async function getWorkoutSessionById(
  id: number
): Promise<WorkoutSession | null> {
  const database = await getDb();

  const row = await database.getFirstAsync<WorkoutSession>(
    `SELECT
      id,
      template_id,
      name,
      notes,
      status,
      started_at,
      completed_at,
      created_at
     FROM workout_sessions
     WHERE id = ?`,
    [id]
  );

  return row ?? null;
}

export async function startWorkoutSessionFromTemplate(templateId: number) {
  const database = await getDb();

  const template = await database.getFirstAsync<{
    id: number;
    name: string;
    notes: string | null;
  }>(
    `SELECT id, name, notes
     FROM workout_templates
     WHERE id = ?`,
    [templateId]
  );

  if (!template) {
    throw new Error('Template non trovato.');
  }

  const existingActive = await database.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM workout_sessions
     WHERE status = 'active'
     LIMIT 1`
  );

  if (existingActive) {
    throw new Error('Esiste già una sessione attiva.');
  }

  const startedAt = new Date().toISOString();

  const sessionResult = await database.runAsync(
    `INSERT INTO workout_sessions (
      template_id,
      name,
      notes,
      status,
      started_at
    ) VALUES (?, ?, ?, 'active', ?)`,
    [template.id, template.name, template.notes, startedAt]
  );

  const sessionId = Number(sessionResult.lastInsertRowId);

  const templateExercises = await database.getAllAsync<{
    id: number;
    exercise_id: number;
    exercise_order: number;
    notes: string | null;
    exercise_name: string;
    category: string | null;
  }>(
    `SELECT
      te.id,
      te.exercise_id,
      te.exercise_order,
      te.notes,
      e.name as exercise_name,
      e.category as category
     FROM workout_template_exercises te
     INNER JOIN exercises e ON e.id = te.exercise_id
     WHERE te.template_id = ?
     ORDER BY te.exercise_order ASC`,
    [templateId]
  );

  for (const templateExercise of templateExercises) {
    const sessionExerciseResult = await database.runAsync(
      `INSERT INTO workout_session_exercises (
        session_id,
        template_exercise_id,
        exercise_id,
        exercise_name,
        category,
        exercise_order,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        templateExercise.id,
        templateExercise.exercise_id,
        templateExercise.exercise_name,
        templateExercise.category,
        templateExercise.exercise_order,
        templateExercise.notes,
      ]
    );

    const sessionExerciseId = Number(sessionExerciseResult.lastInsertRowId);

    const templateSets = await database.getAllAsync<{
      id: number;
      set_order: number;
      set_type: 'warmup' | 'target';
      weight_kg: number | null;
      reps_min: number | null;
      reps_max: number | null;
      rest_seconds: number | null;
      effort_type: 'none' | 'buffer' | 'failure' | 'drop_set';
      buffer_value: number | null;
      notes: string | null;
    }>(
      `SELECT
        id,
        set_order,
        set_type,
        weight_kg,
        reps_min,
        reps_max,
        rest_seconds,
        effort_type,
        buffer_value,
        notes
       FROM template_exercise_sets
       WHERE template_exercise_id = ?
       ORDER BY set_order ASC`,
      [templateExercise.id]
    );

    for (const templateSet of templateSets) {
      await database.runAsync(
        `INSERT INTO workout_session_sets (
          session_exercise_id,
          template_set_id,
          set_order,
          target_set_type,
          target_weight_kg,
          target_reps_min,
          target_reps_max,
          target_rest_seconds,
          target_effort_type,
          target_buffer_value,
          target_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionExerciseId,
          templateSet.id,
          templateSet.set_order,
          templateSet.set_type,
          templateSet.weight_kg,
          templateSet.reps_min,
          templateSet.reps_max,
          templateSet.rest_seconds,
          templateSet.effort_type,
          templateSet.buffer_value,
          templateSet.notes,
        ]
      );
    }
  }

  return sessionId;
}

export async function getWorkoutSessionExercises(
  sessionId: number
): Promise<WorkoutSessionExercise[]> {
  const database = await getDb();

  return database.getAllAsync<WorkoutSessionExercise>(
    `SELECT
      id,
      session_id,
      template_exercise_id,
      exercise_id,
      exercise_name,
      category,
      exercise_order,
      notes,
      created_at
     FROM workout_session_exercises
     WHERE session_id = ?
     ORDER BY exercise_order ASC`,
    [sessionId]
  );
}

export async function getWorkoutSessionSets(
  sessionExerciseId: number
): Promise<WorkoutSessionSet[]> {
  const database = await getDb();

  return database.getAllAsync<WorkoutSessionSet>(
    `SELECT
      id,
      session_exercise_id,
      template_set_id,
      set_order,
      target_set_type,
      target_weight_kg,
      target_reps_min,
      target_reps_max,
      target_rest_seconds,
      target_effort_type,
      target_buffer_value,
      target_notes,
      actual_weight_kg,
      actual_reps,
      actual_effort_type,
      actual_buffer_value,
      actual_rir,
      actual_notes,
      is_completed,
      completed_at,
      created_at
     FROM workout_session_sets
     WHERE session_exercise_id = ?
     ORDER BY set_order ASC`,
    [sessionExerciseId]
  );
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
) {
  const database = await getDb();

  await database.runAsync(
    `UPDATE workout_session_sets
     SET
      actual_weight_kg = ?,
      actual_reps = ?,
      actual_effort_type = ?,
      actual_buffer_value = ?,
      actual_rir = ?,
      actual_notes = ?,
      is_completed = ?,
      completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id = ?`,
    [
      data.actual_weight_kg,
      data.actual_reps,
      data.actual_effort_type,
      data.actual_buffer_value,
      data.actual_rir,
      data.actual_notes,
      data.is_completed,
      data.is_completed,
      id,
    ]
  );
}

export async function completeWorkoutSession(sessionId: number) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE workout_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [sessionId]
  );
}

export async function cancelWorkoutSession(sessionId: number) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE workout_sessions SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [sessionId]
  );
}

export async function getCompletedWorkoutSessions(): Promise<WorkoutSession[]> {
  const database = await getDb();

  return database.getAllAsync<WorkoutSession>(
    `SELECT
      id,
      template_id,
      name,
      notes,
      status,
      started_at,
      completed_at,
      created_at
     FROM workout_sessions
     WHERE status = 'completed'
     ORDER BY completed_at DESC, started_at DESC`
  );
}

export type WorkoutSessionDetail = {
  session: WorkoutSession;
  exercises: {
    exercise: WorkoutSessionExercise;
    sets: WorkoutSessionSet[];
  }[];
};

export async function getWorkoutSessionDetail(
  sessionId: number
): Promise<WorkoutSessionDetail | null> {
  const database = await getDb();

  const session = await getWorkoutSessionById(sessionId);
  if (!session) return null;

  const exercises = await getWorkoutSessionExercises(sessionId);

  const exercisesWithSets = await Promise.all(
    exercises.map(async (exercise) => ({
      exercise,
      sets: await getWorkoutSessionSets(exercise.id),
    }))
  );

  return { session, exercises: exercisesWithSets };
}

// ─── Progressi ────────────────────────────────────────────────────────────────

export type ExercisePR = {
  exercise_name: string;
  max_weight_kg: number;
  reps_at_max: number | null;
  achieved_at: string; // completed_at della sessione
};

export type ExerciseVolume = {
  exercise_name: string;
  total_sets: number;
  total_reps: number;
  total_volume_kg: number; // somma di (peso × reps) per ogni serie completata
};

export async function getPersonalRecords(): Promise<ExercisePR[]> {
  const database = await getDb();

  return database.getAllAsync<ExercisePR>(`
    SELECT
      wse.exercise_name,
      MAX(wss.actual_weight_kg) AS max_weight_kg,
      wss.actual_reps AS reps_at_max,
      ws.completed_at AS achieved_at
    FROM workout_session_sets wss
    INNER JOIN workout_session_exercises wse ON wse.id = wss.session_exercise_id
    INNER JOIN workout_sessions ws ON ws.id = wse.session_id
    WHERE
      wss.is_completed = 1
      AND wss.actual_weight_kg IS NOT NULL
      AND ws.status = 'completed'
    GROUP BY wse.exercise_name
    ORDER BY wse.exercise_name ASC
  `);
}

export async function getExerciseVolumeSummary(): Promise<ExerciseVolume[]> {
  const database = await getDb();

  return database.getAllAsync<ExerciseVolume>(`
    SELECT
      wse.exercise_name,
      COUNT(wss.id) AS total_sets,
      COALESCE(SUM(wss.actual_reps), 0) AS total_reps,
      COALESCE(SUM(
        CASE
          WHEN wss.actual_weight_kg IS NOT NULL AND wss.actual_reps IS NOT NULL
          THEN wss.actual_weight_kg * wss.actual_reps
          ELSE 0
        END
      ), 0) AS total_volume_kg
    FROM workout_session_sets wss
    INNER JOIN workout_session_exercises wse ON wse.id = wss.session_exercise_id
    INNER JOIN workout_sessions ws ON ws.id = wse.session_id
    WHERE
      wss.is_completed = 1
      AND ws.status = 'completed'
    GROUP BY wse.exercise_name
    ORDER BY total_volume_kg DESC
  `);
}

export async function getWeeklyFrequency(): Promise<{
  average_per_week: number;
  total_sessions: number;
  weeks_active: number;
  first_session_at: string | null;
}> {
  const database = await getDb();

  const row = await database.getFirstAsync<{
    total_sessions: number;
    first_session_at: string | null;
  }>(`
    SELECT
      COUNT(*) AS total_sessions,
      MIN(completed_at) AS first_session_at
    FROM workout_sessions
    WHERE status = 'completed'
  `);

  if (!row || !row.first_session_at || row.total_sessions === 0) {
    return { average_per_week: 0, total_sessions: 0, weeks_active: 0, first_session_at: null };
  }

  const firstDate = new Date(row.first_session_at);
  const now = new Date();
  const diffMs = now.getTime() - firstDate.getTime();
  const weeks = Math.max(diffMs / (1000 * 60 * 60 * 24 * 7), 1);
  const average = row.total_sessions / weeks;

  return {
    average_per_week: Math.round(average * 10) / 10,
    total_sessions: row.total_sessions,
    weeks_active: Math.ceil(weeks),
    first_session_at: row.first_session_at,
  };
}

export type ExerciseWeightHistory = {
  session_name: string;
  completed_at: string;
  set_order: number;
  actual_weight_kg: number;
  actual_reps: number | null;
  target_set_type: string;
};

export async function getExerciseWeightHistory(
  exerciseName: string
): Promise<ExerciseWeightHistory[]> {
  const database = await getDb();

  return database.getAllAsync<ExerciseWeightHistory>(`
    SELECT
      ws.name AS session_name,
      ws.completed_at,
      wss.set_order,
      wss.actual_weight_kg,
      wss.actual_reps,
      wss.target_set_type
    FROM workout_session_sets wss
    INNER JOIN workout_session_exercises wse ON wse.id = wss.session_exercise_id
    INNER JOIN workout_sessions ws ON ws.id = wse.session_id
    WHERE
      wss.is_completed = 1
      AND wss.actual_weight_kg IS NOT NULL
      AND wse.exercise_name = ?
      AND ws.status = 'completed'
    ORDER BY ws.completed_at ASC, wss.set_order ASC
  `, [exerciseName]);
}

export type ResetOptions = {
  sessions: boolean;        // sessioni allenamento (sets + exercises + sessions)
  templates: boolean;       // template + esercizi del catalogo
  nutritionLogs: boolean;   // log nutrizione giornalieri
  mealPlans: boolean;       // piani alimentari
  bodyWeight: boolean;      // pesate corporee
  foodCatalog: boolean;     // catalogo alimenti
};

export async function resetSelective(options: ResetOptions): Promise<void> {
  const database = await getDb();

  await database.withTransactionAsync(async () => {
    if (options.sessions) {
      await database.execAsync(`
        DELETE FROM workout_session_sets;
        DELETE FROM workout_session_exercises;
        DELETE FROM workout_sessions;
      `);
    }
    if (options.templates) {
      // Prima rimuovi sessioni che dipendono dai template, se non già resettate
      if (!options.sessions) {
        await database.execAsync(`
          DELETE FROM workout_session_sets;
          DELETE FROM workout_session_exercises;
          DELETE FROM workout_sessions;
        `);
      }
      await database.execAsync(`
        DELETE FROM template_exercise_sets;
        DELETE FROM workout_template_exercises;
        DELETE FROM workout_templates;
        DELETE FROM exercises;
      `);
    }
    if (options.nutritionLogs) {
      await database.execAsync(`
        DELETE FROM nutrition_logs;
        DELETE FROM water_logs;
      `);
    }
    if (options.mealPlans) {
      await database.execAsync(`
        DELETE FROM meal_plan_entries;
        DELETE FROM meal_plan_days;
        DELETE FROM meal_plans;
      `);
    }
    if (options.bodyWeight) {
      await database.execAsync(`DELETE FROM body_weight_logs;`);
    }
    if (options.foodCatalog) {
      // Azzera i riferimenti nei log prima di cancellare il catalogo
      await database.execAsync(`
        UPDATE nutrition_logs SET food_item_id = NULL;
        UPDATE meal_plan_entries SET food_item_id = NULL;
        DELETE FROM food_items;
      `);
    }
  });
}

// Mantenute per retrocompatibilità interna
export async function resetSessions() {
  return resetSelective({ sessions: true, templates: false, nutritionLogs: false, mealPlans: false, bodyWeight: false, foodCatalog: false });
}

export async function resetAll() {
  return resetSelective({ sessions: true, templates: true, nutritionLogs: true, mealPlans: true, bodyWeight: true, foodCatalog: true });
}

export async function hasExercises(): Promise<boolean> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercises`
  );
  return (row?.count ?? 0) > 0;
}

export async function hasTemplates(): Promise<boolean> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM workout_templates`
  );
  return (row?.count ?? 0) > 0;
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ ex: number; tmpl: number }>(
    `SELECT
      (SELECT COUNT(*) FROM exercises) as ex,
      (SELECT COUNT(*) FROM workout_templates) as tmpl`
  );
  return (row?.ex ?? 0) === 0 && (row?.tmpl ?? 0) === 0;
}

export async function updateWorkoutTemplate(
  id: number,
  name: string,
  notes: string | null
): Promise<void> {
  const database = await getDb();

  const normalizedName = name.trim();
  const normalizedNotes = notes?.trim() || null;

  if (!normalizedName) {
    throw new Error('Inserisci il nome del template.');
  }

  await database.runAsync(
    `UPDATE workout_templates SET name = ?, notes = ? WHERE id = ?`,
    [normalizedName, normalizedNotes, id]
  );
}

export async function reorderTemplateExercises(
  exercises: { id: number; exercise_order: number }[]
): Promise<void> {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    for (const ex of exercises) {
      await database.runAsync(
        `UPDATE workout_template_exercises SET exercise_order = ? WHERE id = ?`,
        [ex.exercise_order, ex.id]
      );
    }
  });
}

export async function addExerciseToSession(
  sessionId: number,
  exerciseId: number,
  exerciseName: string,
  category: string | null
): Promise<number> {
  const database = await getDb();

  const maxOrderRow = await database.getFirstAsync<{ maxOrder: number | null }>(
    `SELECT MAX(exercise_order) as maxOrder
     FROM workout_session_exercises
     WHERE session_id = ?`,
    [sessionId]
  );

  const nextOrder = (maxOrderRow?.maxOrder ?? 0) + 1;

  const result = await database.runAsync(
    `INSERT INTO workout_session_exercises (
      session_id,
      template_exercise_id,
      exercise_id,
      exercise_name,
      category,
      exercise_order,
      notes
    ) VALUES (?, NULL, ?, ?, ?, ?, NULL)`,
    [sessionId, exerciseId, exerciseName, category, nextOrder]
  );

  return Number(result.lastInsertRowId);
}

export async function addEmptySetToSessionExercise(
  sessionExerciseId: number
): Promise<void> {
  const database = await getDb();

  const maxOrderRow = await database.getFirstAsync<{ maxOrder: number | null }>(
    `SELECT MAX(set_order) as maxOrder
     FROM workout_session_sets
     WHERE session_exercise_id = ?`,
    [sessionExerciseId]
  );

  const nextOrder = (maxOrderRow?.maxOrder ?? 0) + 1;

  await database.runAsync(
    `INSERT INTO workout_session_sets (
      session_exercise_id,
      template_set_id,
      set_order,
      target_set_type,
      target_effort_type,
      is_completed
    ) VALUES (?, NULL, ?, 'target', 'none', 0)`,
    [sessionExerciseId, nextOrder]
  );
}

export async function removeSetFromSessionExercise(setId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `DELETE FROM workout_session_sets WHERE id = ?`,
    [setId]
  );
}

export async function removeExerciseFromSession(sessionExerciseId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM workout_session_exercises WHERE id = ?`, [sessionExerciseId]);
}

// ─── Alimentazione — Tipi ─────────────────────────────────────────────────────

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

// ─── Alimentazione — Food Items ───────────────────────────────────────────────

export async function getFoodItems(): Promise<FoodItem[]> {
  const database = await getDb();
  return database.getAllAsync<FoodItem>(
    `SELECT * FROM food_items ORDER BY name ASC`
  );
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
  const database = await getDb();
  const name = item.name.trim();
  if (!name) throw new Error('Inserisci il nome dell\'alimento.');
  try {
    const result = await database.runAsync(
      `INSERT INTO food_items (name, kcal_per_100g, protein_g, carbs_g, fat_g, source, external_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, item.kcal_per_100g, item.protein_g, item.carbs_g, item.fat_g, item.source, item.external_id ?? null]
    );
    return Number(result.lastInsertRowId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error('Questo alimento è già presente nel catalogo.');
    }
    throw new Error('Impossibile salvare l\'alimento.');
  }
}

export async function deleteFoodItem(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM food_items WHERE id = ?`, [id]);
}

// ─── Alimentazione — Nutrition Logs ──────────────────────────────────────────

export async function getNutritionLogsByDate(date: string): Promise<NutritionLog[]> {
  const database = await getDb();
  return database.getAllAsync<NutritionLog>(
    `SELECT * FROM nutrition_logs WHERE date = ? ORDER BY created_at ASC`,
    [date]
  );
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
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO nutrition_logs (date, meal_type, food_item_id, food_name, grams, kcal, protein, carbs, fat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [log.date, log.meal_type, log.food_item_id, log.food_name, log.grams, log.kcal, log.protein, log.carbs, log.fat]
  );
}

export async function deleteNutritionLog(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM nutrition_logs WHERE id = ?`, [id]);
}

// ─── Alimentazione — Water Logs ───────────────────────────────────────────────

export async function getWaterLogByDate(date: string): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(ml), 0) as total FROM water_logs WHERE date = ?`,
    [date]
  );
  return row?.total ?? 0;
}

export async function addWaterLog(date: string, ml: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO water_logs (date, ml) VALUES (?, ?)`,
    [date, ml]
  );
}

export async function resetWaterLog(date: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `DELETE FROM water_logs WHERE date = ?`,
    [date]
  );
}

// ─── Alimentazione — Body Weight ──────────────────────────────────────────────

export async function getBodyWeightLogs(phase?: 'bulk' | 'cut' | null): Promise<BodyWeightLog[]> {
  const database = await getDb();
  if (phase !== undefined && phase !== null) {
    return database.getAllAsync<BodyWeightLog>(
      `SELECT * FROM body_weight_logs WHERE phase = ? ORDER BY date DESC`,
      [phase]
    );
  }
  return database.getAllAsync<BodyWeightLog>(
    `SELECT * FROM body_weight_logs ORDER BY date DESC`
  );
}

export async function upsertBodyWeightLog(date: string, weight_kg: number, notes: string | null, phase: 'bulk' | 'cut' | null = null): Promise<void> {
  const database = await getDb();
  // Controlla se esiste già una riga con stessa data e stessa fase
  const existing = await database.getFirstAsync<{ id: number }>(
    `SELECT id FROM body_weight_logs WHERE date = ? AND (phase = ? OR (phase IS NULL AND ? IS NULL))`,
    [date, phase, phase]
  );
  if (existing) {
    await database.runAsync(
      `UPDATE body_weight_logs SET weight_kg = ?, notes = ? WHERE id = ?`,
      [weight_kg, notes, existing.id]
    );
  } else {
    await database.runAsync(
      `INSERT INTO body_weight_logs (date, weight_kg, notes, phase) VALUES (?, ?, ?, ?)`,
      [date, weight_kg, notes, phase]
    );
  }
}

export async function deleteBodyWeightLog(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM body_weight_logs WHERE id = ?`, [id]);
}

// ─── Piano Alimentare — Tipi ──────────────────────────────────────────────────

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

// ─── Piano Alimentare — CRUD ──────────────────────────────────────────────────

export async function getMealPlans(): Promise<MealPlan[]> {
  const database = await getDb();
  return database.getAllAsync<MealPlan>(`SELECT * FROM meal_plans ORDER BY created_at DESC`);
}

export async function addMealPlan(name: string, plan_type: 'weekly' | 'cycle'): Promise<number> {
  const database = await getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Inserisci il nome del piano.');
  const result = await database.runAsync(
    `INSERT INTO meal_plans (name, plan_type) VALUES (?, ?)`,
    [trimmed, plan_type]
  );
  return Number(result.lastInsertRowId);
}

export async function deleteMealPlan(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM meal_plans WHERE id = ?`, [id]);
}

export async function getMealPlanDays(mealPlanId: number): Promise<MealPlanDay[]> {
  const database = await getDb();
  return database.getAllAsync<MealPlanDay>(
    `SELECT * FROM meal_plan_days WHERE meal_plan_id = ? ORDER BY day_order ASC`,
    [mealPlanId]
  );
}

export async function addMealPlanDay(mealPlanId: number, dayOrder: number, label: string): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO meal_plan_days (meal_plan_id, day_order, label) VALUES (?, ?, ?)`,
    [mealPlanId, dayOrder, label]
  );
  return Number(result.lastInsertRowId);
}

export async function deleteMealPlanDay(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM meal_plan_days WHERE id = ?`, [id]);
}

export async function getMealPlanEntries(mealPlanDayId: number): Promise<MealPlanEntry[]> {
  const database = await getDb();
  return database.getAllAsync<MealPlanEntry>(
    `SELECT * FROM meal_plan_entries WHERE meal_plan_day_id = ? ORDER BY meal_type ASC, created_at ASC`,
    [mealPlanDayId]
  );
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
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO meal_plan_entries (meal_plan_day_id, meal_type, food_item_id, food_name, grams, kcal, protein, carbs, fat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.meal_plan_day_id, entry.meal_type, entry.food_item_id, entry.food_name, entry.grams, entry.kcal, entry.protein, entry.carbs, entry.fat]
  );
}

export async function updateMealPlanEntry(id: number, food_name: string, grams: number, kcal: number | null, protein: number | null, carbs: number | null, fat: number | null): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `UPDATE meal_plan_entries SET food_name = ?, grams = ?, kcal = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?`,
    [food_name, grams, kcal, protein, carbs, fat, id]
  );
}

export async function deleteMealPlanEntry(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM meal_plan_entries WHERE id = ?`, [id]);
}
// ─── Export dati ──────────────────────────────────────────────────────────────

export type ExportData = {
  exported_at: string;
  app_version: string;
  exercises: Exercise[];
  workout_templates: (WorkoutTemplate & {
    exercises: (TemplateExercise & { sets: TemplateExerciseSet[] })[];
  })[];
  workout_sessions: (WorkoutSession & {
    exercises: (WorkoutSessionExercise & { sets: WorkoutSessionSet[] })[];
  })[];
  food_items: FoodItem[];
  nutrition_logs: NutritionLog[];
  body_weight_logs: BodyWeightLog[];
  meal_plans: (MealPlan & {
    days: (MealPlanDay & { entries: MealPlanEntry[] })[];
  })[];
};

export async function exportAllData(): Promise<ExportData> {
  const database = await getDb();

  // Esercizi
  const exercises = await getExercises();

  // Template con esercizi e serie
  const rawTemplates = await getWorkoutTemplates();
  const workout_templates = await Promise.all(
    rawTemplates.map(async (template) => {
      const templateExercises = await getTemplateExercises(template.id);
      const exercisesWithSets = await Promise.all(
        templateExercises.map(async (ex) => ({
          ...ex,
          sets: await getTemplateExerciseSets(ex.id),
        }))
      );
      return { ...template, exercises: exercisesWithSets };
    })
  );

  // Sessioni completate + attive con esercizi e serie
  const rawSessions = await database.getAllAsync<WorkoutSession>(`
    SELECT id, template_id, name, notes, status, started_at, completed_at, created_at
    FROM workout_sessions
    ORDER BY started_at DESC
  `);
  const workout_sessions = await Promise.all(
    rawSessions.map(async (session) => {
      const sessionExercises = await getWorkoutSessionExercises(session.id);
      const exercisesWithSets = await Promise.all(
        sessionExercises.map(async (ex) => ({
          ...ex,
          sets: await getWorkoutSessionSets(ex.id),
        }))
      );
      return { ...session, exercises: exercisesWithSets };
    })
  );

  // Alimentazione
  const food_items = await getFoodItems();
  const nutrition_logs = await database.getAllAsync<NutritionLog>(
    `SELECT * FROM nutrition_logs ORDER BY date DESC, created_at DESC`
  );
  const body_weight_logs = await getBodyWeightLogs();

  // Piani alimentari
  const rawMealPlans = await getMealPlans();
  const meal_plans = await Promise.all(
    rawMealPlans.map(async (plan) => {
      const days = await getMealPlanDays(plan.id);
      const daysWithEntries = await Promise.all(
        days.map(async (day) => ({
          ...day,
          entries: await getMealPlanEntries(day.id),
        }))
      );
      return { ...plan, days: daysWithEntries };
    })
  );

  return {
    exported_at: new Date().toISOString(),
    app_version: '1.0.0',
    exercises,
    workout_templates,
    workout_sessions,
    food_items,
    nutrition_logs,
    body_weight_logs,
    meal_plans,
  };
}

// ─── Import dati ──────────────────────────────────────────────────────────────

export type ImportMode = 'replace_all' | 'overwrite_existing' | 'add_only';

export async function importData(payload: ExportData, mode: ImportMode): Promise<void> {
  const database = await getDb();

  await database.withTransactionAsync(async () => {

    // ── REPLACE ALL: cancella tutto e reinserisce ──────────────────────────
    if (mode === 'replace_all') {
      await database.execAsync(`
        DELETE FROM workout_session_sets;
        DELETE FROM workout_session_exercises;
        DELETE FROM workout_sessions;
        DELETE FROM template_exercise_sets;
        DELETE FROM workout_template_exercises;
        DELETE FROM workout_templates;
        DELETE FROM exercises;
        DELETE FROM meal_plan_entries;
        DELETE FROM meal_plan_days;
        DELETE FROM meal_plans;
        DELETE FROM nutrition_logs;
        DELETE FROM water_logs;
        DELETE FROM body_weight_logs;
        DELETE FROM food_items;
      `);
    }

    // ── ESERCIZI ──────────────────────────────────────────────────────────
    const exerciseIdMap = new Map<number, number>(); // old_id → new_id

    for (const ex of payload.exercises ?? []) {
      if (mode === 'add_only') {
        const existing = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM exercises WHERE name = ?`, [ex.name]
        );
        if (existing) { exerciseIdMap.set(ex.id, existing.id); continue; }
      }
      if (mode === 'overwrite_existing') {
        await database.runAsync(
          `INSERT INTO exercises (name, category, created_at) VALUES (?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET category = excluded.category`,
          [ex.name, ex.category, ex.created_at]
        );
        const row = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM exercises WHERE name = ?`, [ex.name]
        );
        if (row) exerciseIdMap.set(ex.id, row.id);
      } else {
        const result = await database.runAsync(
          `INSERT OR IGNORE INTO exercises (name, category, created_at) VALUES (?, ?, ?)`,
          [ex.name, ex.category, ex.created_at]
        );
        const newId = result.lastInsertRowId
          ? Number(result.lastInsertRowId)
          : (await database.getFirstAsync<{ id: number }>(
              `SELECT id FROM exercises WHERE name = ?`, [ex.name]
            ))?.id ?? ex.id;
        exerciseIdMap.set(ex.id, newId);
      }
    }

    // ── TEMPLATE ──────────────────────────────────────────────────────────
    for (const tmpl of payload.workout_templates ?? []) {
      let templateDbId: number;

      if (mode === 'add_only') {
        const existing = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM workout_templates WHERE name = ? AND created_at = ?`,
          [tmpl.name, tmpl.created_at]
        );
        if (existing) continue;
      }

      const tmplResult = await database.runAsync(
        `INSERT INTO workout_templates (name, notes, created_at) VALUES (?, ?, ?)`,
        [tmpl.name, tmpl.notes, tmpl.created_at]
      );
      templateDbId = Number(tmplResult.lastInsertRowId);

      for (const ex of tmpl.exercises ?? []) {
        const mappedExId = exerciseIdMap.get(ex.exercise_id) ?? ex.exercise_id;
        const exResult = await database.runAsync(
          `INSERT INTO workout_template_exercises
            (template_id, exercise_id, exercise_order, target_sets, target_reps_min, target_reps_max, rest_seconds, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [templateDbId, mappedExId, ex.exercise_order, ex.target_sets, ex.target_reps_min, ex.target_reps_max, ex.rest_seconds, ex.notes]
        );
        const templateExerciseDbId = Number(exResult.lastInsertRowId);

        for (const set of ex.sets ?? []) {
          await database.runAsync(
            `INSERT INTO template_exercise_sets
              (template_exercise_id, set_order, set_type, weight_kg, reps_min, reps_max, rest_seconds, effort_type, buffer_value, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [templateExerciseDbId, set.set_order, set.set_type, set.weight_kg, set.reps_min, set.reps_max, set.rest_seconds, set.effort_type, set.buffer_value, set.notes, set.created_at]
          );
        }
      }
    }

    // ── SESSIONI ──────────────────────────────────────────────────────────
    for (const session of payload.workout_sessions ?? []) {
      if (mode === 'add_only') {
        const existing = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM workout_sessions WHERE started_at = ? AND name = ?`,
          [session.started_at, session.name]
        );
        if (existing) continue;
      }

      const sessResult = await database.runAsync(
        `INSERT INTO workout_sessions (name, notes, status, started_at, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [session.name, session.notes, session.status, session.started_at, session.completed_at, session.created_at]
      );
      const sessionDbId = Number(sessResult.lastInsertRowId);

      for (const ex of session.exercises ?? []) {
        const mappedExId = ex.exercise_id ? (exerciseIdMap.get(ex.exercise_id) ?? ex.exercise_id) : null;
        const exResult = await database.runAsync(
          `INSERT INTO workout_session_exercises
            (session_id, exercise_id, exercise_name, category, exercise_order, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [sessionDbId, mappedExId, ex.exercise_name, ex.category, ex.exercise_order, ex.notes, ex.created_at]
        );
        const sessionExDbId = Number(exResult.lastInsertRowId);

        for (const set of ex.sets ?? []) {
          await database.runAsync(
            `INSERT INTO workout_session_sets
              (session_exercise_id, set_order, target_set_type, target_weight_kg, target_reps_min, target_reps_max,
               target_rest_seconds, target_effort_type, target_buffer_value, target_notes,
               actual_weight_kg, actual_reps, actual_effort_type, actual_buffer_value, actual_rir, actual_notes,
               is_completed, completed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sessionExDbId, set.set_order, set.target_set_type, set.target_weight_kg,
              set.target_reps_min, set.target_reps_max, set.target_rest_seconds,
              set.target_effort_type, set.target_buffer_value, set.target_notes,
              set.actual_weight_kg, set.actual_reps, set.actual_effort_type,
              set.actual_buffer_value, set.actual_rir, set.actual_notes,
              set.is_completed, set.completed_at, set.created_at,
            ]
          );
        }
      }
    }

    // ── FOOD ITEMS ────────────────────────────────────────────────────────
    const foodIdMap = new Map<number, number>();

    for (const food of payload.food_items ?? []) {
      if (mode === 'add_only') {
        const existing = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM food_items WHERE name = ?`, [food.name]
        );
        if (existing) { foodIdMap.set(food.id, existing.id); continue; }
      }
      if (mode === 'overwrite_existing') {
        await database.runAsync(
          `INSERT INTO food_items (name, kcal_per_100g, protein_g, carbs_g, fat_g, source, external_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET kcal_per_100g=excluded.kcal_per_100g, protein_g=excluded.protein_g,
             carbs_g=excluded.carbs_g, fat_g=excluded.fat_g`,
          [food.name, food.kcal_per_100g, food.protein_g, food.carbs_g, food.fat_g, food.source, food.external_id, food.created_at]
        );
      } else {
        await database.runAsync(
          `INSERT OR IGNORE INTO food_items (name, kcal_per_100g, protein_g, carbs_g, fat_g, source, external_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [food.name, food.kcal_per_100g, food.protein_g, food.carbs_g, food.fat_g, food.source, food.external_id, food.created_at]
        );
      }
      const row = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM food_items WHERE name = ?`, [food.name]
      );
      if (row) foodIdMap.set(food.id, row.id);
    }

    // ── NUTRITION LOGS ────────────────────────────────────────────────────
    for (const log of payload.nutrition_logs ?? []) {
      if (mode === 'add_only') {
        const existing = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM nutrition_logs WHERE date = ? AND food_name = ? AND created_at = ?`,
          [log.date, log.food_name, log.created_at]
        );
        if (existing) continue;
      }
      const mappedFoodId = log.food_item_id ? (foodIdMap.get(log.food_item_id) ?? log.food_item_id) : null;
      await database.runAsync(
        `INSERT INTO nutrition_logs (date, meal_type, food_item_id, food_name, grams, kcal, protein, carbs, fat, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [log.date, log.meal_type, mappedFoodId, log.food_name, log.grams, log.kcal, log.protein, log.carbs, log.fat, log.created_at]
      );
    }

    // ── BODY WEIGHT LOGS ──────────────────────────────────────────────────
    for (const bw of payload.body_weight_logs ?? []) {
      if (mode === 'overwrite_existing' || mode === 'replace_all') {
        await database.runAsync(
          `INSERT INTO body_weight_logs (date, weight_kg, notes, phase, created_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET weight_kg=excluded.weight_kg, notes=excluded.notes, phase=excluded.phase`,
          [bw.date, bw.weight_kg, bw.notes, bw.phase ?? null, bw.created_at]
        );
      } else {
        await database.runAsync(
          `INSERT OR IGNORE INTO body_weight_logs (date, weight_kg, notes, phase, created_at) VALUES (?, ?, ?, ?, ?)`,
          [bw.date, bw.weight_kg, bw.notes, bw.phase ?? null, bw.created_at]
        );
      }
    }

    // ── MEAL PLANS ────────────────────────────────────────────────────────
    for (const plan of payload.meal_plans ?? []) {
      if (mode === 'add_only') {
        const existing = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM meal_plans WHERE name = ? AND created_at = ?`,
          [plan.name, plan.created_at]
        );
        if (existing) continue;
      }
      const planResult = await database.runAsync(
        `INSERT INTO meal_plans (name, plan_type, created_at) VALUES (?, ?, ?)`,
        [plan.name, plan.plan_type, plan.created_at]
      );
      const planDbId = Number(planResult.lastInsertRowId);

      for (const day of plan.days ?? []) {
        const dayResult = await database.runAsync(
          `INSERT INTO meal_plan_days (meal_plan_id, day_order, label, created_at) VALUES (?, ?, ?, ?)`,
          [planDbId, day.day_order, day.label, day.created_at]
        );
        const dayDbId = Number(dayResult.lastInsertRowId);

        for (const entry of day.entries ?? []) {
          const mappedFoodId = entry.food_item_id ? (foodIdMap.get(entry.food_item_id) ?? entry.food_item_id) : null;
          await database.runAsync(
            `INSERT INTO meal_plan_entries (meal_plan_day_id, meal_type, food_item_id, food_name, grams, kcal, protein, carbs, fat, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dayDbId, entry.meal_type, mappedFoodId, entry.food_name, entry.grams, entry.kcal, entry.protein, entry.carbs, entry.fat, entry.created_at]
          );
        }
      }
    }
  });
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields
    .map((f) => {
      if (f === null || f === undefined) return '';
      const str = String(f);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(',');
}

export async function exportAllDataCSV(): Promise<string> {
  const data = await exportAllData();
  const sections: string[] = [];

  // ── Esercizi ──────────────────────────────────────────────────────────
  sections.push('### ESERCIZI ###');
  sections.push(csvRow(['ID', 'Nome', 'Categoria', 'Creato il']));
  for (const ex of data.exercises) {
    sections.push(csvRow([ex.id, ex.name, ex.category, ex.created_at]));
  }

  // ── Template ──────────────────────────────────────────────────────────
  sections.push('');
  sections.push('### TEMPLATE ALLENAMENTO ###');
  sections.push(csvRow(['Template', 'Esercizio', 'Ordine', 'Set', 'Tipo set', 'Peso (kg)', 'Reps min', 'Reps max', 'Recupero (s)', 'Tipo sforzo', 'Note']));
  for (const tmpl of data.workout_templates) {
    for (const ex of tmpl.exercises) {
      if (ex.sets.length === 0) {
        sections.push(csvRow([tmpl.name, ex.exercise_name, ex.exercise_order, '', '', '', '', '', '', '', ex.notes]));
      } else {
        for (const set of ex.sets) {
          sections.push(csvRow([tmpl.name, ex.exercise_name, ex.exercise_order, set.set_order, set.set_type, set.weight_kg, set.reps_min, set.reps_max, set.rest_seconds, set.effort_type, set.notes]));
        }
      }
    }
  }

  // ── Sessioni ──────────────────────────────────────────────────────────
  sections.push('');
  sections.push('### SESSIONI ALLENAMENTO ###');
  sections.push(csvRow(['Sessione', 'Data inizio', 'Data fine', 'Stato', 'Esercizio', 'Set', 'Tipo set', 'Peso target (kg)', 'Reps target', 'Peso eseguito (kg)', 'Reps eseguite', 'Completata']));
  for (const session of data.workout_sessions) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        sections.push(csvRow([
          session.name,
          session.started_at,
          session.completed_at,
          session.status,
          ex.exercise_name,
          set.set_order,
          set.target_set_type,
          set.target_weight_kg,
          set.target_reps_min != null && set.target_reps_max != null
            ? `${set.target_reps_min}-${set.target_reps_max}`
            : set.target_reps_min ?? set.target_reps_max,
          set.actual_weight_kg,
          set.actual_reps,
          set.is_completed ? 'Sì' : 'No',
        ]));
      }
    }
  }

  // ── Peso corporeo ─────────────────────────────────────────────────────
  sections.push('');
  sections.push('### PESO CORPOREO ###');
  sections.push(csvRow(['Data', 'Peso (kg)', 'Fase', 'Note']));
  for (const bw of data.body_weight_logs) {
    sections.push(csvRow([bw.date, bw.weight_kg, bw.phase ?? '', bw.notes]));
  }

  // ── Catalogo alimenti ─────────────────────────────────────────────────
  sections.push('');
  sections.push('### CATALOGO ALIMENTI ###');
  sections.push(csvRow(['Nome', 'Kcal/100g', 'Proteine (g)', 'Carboidrati (g)', 'Grassi (g)', 'Fonte']));
  for (const food of data.food_items) {
    sections.push(csvRow([food.name, food.kcal_per_100g, food.protein_g, food.carbs_g, food.fat_g, food.source]));
  }

  // ── Log nutrizione ────────────────────────────────────────────────────
  sections.push('');
  sections.push('### LOG NUTRIZIONE ###');
  sections.push(csvRow(['Data', 'Pasto', 'Alimento', 'Grammi', 'Kcal', 'Proteine (g)', 'Carboidrati (g)', 'Grassi (g)']));
  for (const log of data.nutrition_logs) {
    sections.push(csvRow([log.date, log.meal_type, log.food_name, log.grams, log.kcal, log.protein, log.carbs, log.fat]));
  }

  // ── Piani alimentari ──────────────────────────────────────────────────
  sections.push('');
  sections.push('### PIANI ALIMENTARI ###');
  sections.push(csvRow(['Piano', 'Giorno', 'Pasto', 'Alimento', 'Grammi', 'Kcal', 'Proteine (g)', 'Carboidrati (g)', 'Grassi (g)']));
  for (const plan of data.meal_plans) {
    for (const day of plan.days) {
      for (const entry of day.entries) {
        sections.push(csvRow([plan.name, day.label, entry.meal_type, entry.food_name, entry.grams, entry.kcal, entry.protein, entry.carbs, entry.fat]));
      }
    }
  }

  return sections.join('\n');
}

// ─── Ricette ──────────────────────────────────────────────────────────────────

export type Recipe = {
  id: number;
  title: string;
  description: string | null;
  servings: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  ingredients: string | null; // JSON serializzato
  instructions: string | null;
  source: 'manual' | 'pdf';
  created_at: string;
};

export type RecipeIngredient = {
  id: number;
  recipe_id: number;
  food_name: string;
  grams: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export async function getRecipes(): Promise<Recipe[]> {
  const database = await getDb();
  return database.getAllAsync<Recipe>(`SELECT * FROM recipes ORDER BY created_at DESC`);
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
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO recipes (title, description, servings, kcal, protein, carbs, fat, ingredients, instructions, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [recipe.title, recipe.description, recipe.servings, recipe.kcal, recipe.protein,
     recipe.carbs, recipe.fat, recipe.ingredients, recipe.instructions, recipe.source]
  );
  return Number(result.lastInsertRowId);
}

export async function deleteRecipe(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM recipes WHERE id = ?`, [id]);
}

// ─── Piano giornaliero attivo ─────────────────────────────────────────────────

export type MealPlanActiveDay = {
  id: number;
  meal_plan_id: number;
  meal_plan_day_id: number;
  weekday: number; // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
  created_at: string;
};

export async function setMealPlanActiveDays(
  mealPlanId: number,
  assignments: { dayId: number; weekdays: number[] }[]
): Promise<void> {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `DELETE FROM meal_plan_active_days WHERE meal_plan_id = ?`,
      [mealPlanId]
    );
    for (const a of assignments) {
      for (const weekday of a.weekdays) {
        await database.runAsync(
          `INSERT INTO meal_plan_active_days (meal_plan_id, meal_plan_day_id, weekday) VALUES (?, ?, ?)`,
          [mealPlanId, a.dayId, weekday]
        );
      }
    }
  });
}

export async function getActivePlanEntriesForToday(completedIds?: number[]): Promise<{
  entries: MealPlanEntry[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  remainingTotals: { kcal: number; protein: number; carbs: number; fat: number };
}> {
  const database = await getDb();
  const today = new Date();
  const weekday = today.getDay(); // 0=Dom..6=Sab

  const rows = await database.getAllAsync<MealPlanEntry>(`
    SELECT mpe.*
    FROM meal_plan_entries mpe
    INNER JOIN meal_plan_active_days mpad ON mpad.meal_plan_day_id = mpe.meal_plan_day_id
    WHERE mpad.weekday = ?
    ORDER BY mpe.meal_type ASC, mpe.created_at ASC
  `, [weekday]);

  const completed = new Set(completedIds ?? []);

  const totals = rows.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal ?? 0),
      protein: acc.protein + (e.protein ?? 0),
      carbs: acc.carbs + (e.carbs ?? 0),
      fat: acc.fat + (e.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Macro solo degli alimenti NON ancora consumati
  const remainingTotals = rows
    .filter((e) => !completed.has(e.id))
    .reduce(
      (acc, e) => ({
        kcal: acc.kcal + (e.kcal ?? 0),
        protein: acc.protein + (e.protein ?? 0),
        carbs: acc.carbs + (e.carbs ?? 0),
        fat: acc.fat + (e.fat ?? 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );

  return { entries: rows, totals, remainingTotals };
}