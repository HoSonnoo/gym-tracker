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

  const rows = await database.getAllAsync<Exercise>(
    `SELECT id, name, category, created_at
     FROM exercises
     ORDER BY name ASC`
  );

  return rows;
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

export async function addWorkoutTemplate(name: string, notes: string | null) {
  const database = await getDb();

  const normalizedName = name.trim();
  const normalizedNotes = notes?.trim() || null;

  if (!normalizedName) {
    throw new Error('Inserisci il nome del template.');
  }

  try {
    await database.runAsync(
      `INSERT INTO workout_templates (name, notes) VALUES (?, ?)`,
      [normalizedName, normalizedNotes]
    );
  } catch {
    throw new Error('Impossibile creare il template.');
  }
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const database = await getDb();

  const rows = await database.getAllAsync<WorkoutTemplate>(
    `SELECT id, name, notes, created_at
     FROM workout_templates
     ORDER BY created_at DESC`
  );

  return rows;
}

export async function deleteWorkoutTemplate(id: number) {
  const database = await getDb();

  await database.runAsync(`DELETE FROM workout_templates WHERE id = ?`, [id]);
}

export async function getWorkoutTemplateById(
  id: number
): Promise<WorkoutTemplate | null> {
  const database = await getDb();

  const row = await database.getFirstAsync<WorkoutTemplate>(
    `SELECT id, name, notes, created_at
     FROM workout_templates
     WHERE id = ?`,
    [id]
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

  await database.runAsync(
    `DELETE FROM workout_template_exercises
     WHERE id = ?`,
    [templateExerciseId]
  );
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

  await database.runAsync(
    `DELETE FROM template_exercise_sets WHERE id = ?`,
    [id]
  );
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
    `UPDATE workout_sessions
     SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [sessionId]
  );
}

export async function cancelWorkoutSession(sessionId: number) {
  const database = await getDb();

  await database.runAsync(
    `UPDATE workout_sessions
     SET
      status = 'cancelled',
      completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
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