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
      session_date TEXT NOT NULL,
      template_id INTEGER,
      name TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS workout_session_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      exercise_order INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS set_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      weight REAL,
      reps INTEGER,
      rir INTEGER,
      is_completed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_exercise_id) REFERENCES workout_session_exercises(id) ON DELETE CASCADE
    );
  `);
}

export type Exercise = {
  id: number;
  name: string;
  category: string | null;
  created_at: string;
};

export async function seedExercises() {
  const database = await getDb();

  const defaultExercises = [
    { name: 'Panca Piana', category: 'Petto' },
    { name: 'Squat', category: 'Gambe' },
    { name: 'Lat Machine', category: 'Schiena' },
    { name: 'Shoulder Press', category: 'Spalle' },
    { name: 'Curl Manubri', category: 'Bicipiti' },
    { name: 'Pushdown Cavo', category: 'Tricipiti' },
  ];

  for (const exercise of defaultExercises) {
    await database.runAsync(
      `INSERT OR IGNORE INTO exercises (name, category) VALUES (?, ?)`,
      [exercise.name, exercise.category]
    );
  }
}

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

export type WorkoutTemplate = {
  id: number;
  name: string;
  notes: string | null;
  created_at: string;
};

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
  } catch (error) {
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