import { getDb } from '@/database';
import { supabase } from '@/lib/supabase';

// Tabelle da sincronizzare, in ordine (le parent prima delle child)
const SYNC_TABLES: { name: string; columns: string[] }[] = [
  {
    name: 'exercises',
    columns: ['id', 'name', 'category', 'created_at'],
  },
  {
    name: 'food_items',
    columns: ['id', 'name', 'kcal_per_100g', 'protein_g', 'carbs_g', 'fat_g', 'source', 'external_id', 'created_at'],
  },
  {
    name: 'workout_templates',
    columns: ['id', 'name', 'notes', 'created_at'],
  },
  {
    name: 'workout_template_exercises',
    columns: ['id', 'template_id', 'exercise_id', 'exercise_order', 'target_sets', 'target_reps_min', 'target_reps_max', 'rest_seconds', 'notes', 'superset_group_id'],
  },
  {
    name: 'template_exercise_sets',
    columns: ['id', 'template_exercise_id', 'set_order', 'set_type', 'weight_kg', 'reps_min', 'reps_max', 'rest_seconds', 'effort_type', 'buffer_value', 'notes', 'created_at'],
  },
  {
    name: 'workout_sessions',
    columns: ['id', 'template_id', 'name', 'notes', 'rating', 'status', 'started_at', 'completed_at', 'created_at'],
  },
  {
    name: 'workout_session_exercises',
    columns: ['id', 'session_id', 'template_exercise_id', 'exercise_id', 'exercise_name', 'category', 'exercise_order', 'notes', 'superset_group_id', 'created_at'],
  },
  {
    name: 'workout_session_sets',
    columns: ['id', 'session_exercise_id', 'template_set_id', 'set_order', 'target_set_type', 'target_weight_kg', 'target_reps_min', 'target_reps_max', 'target_rest_seconds', 'target_effort_type', 'target_buffer_value', 'target_notes', 'actual_weight_kg', 'actual_reps', 'actual_effort_type', 'actual_buffer_value', 'actual_rir', 'actual_notes', 'is_completed', 'completed_at', 'created_at'],
  },
  {
    name: 'nutrition_logs',
    columns: ['id', 'date', 'meal_type', 'food_item_id', 'food_name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'created_at'],
  },
  {
    name: 'water_logs',
    columns: ['id', 'date', 'ml', 'created_at'],
  },
  {
    name: 'body_weight_logs',
    columns: ['id', 'date', 'weight_kg', 'notes', 'phase', 'created_at'],
  },
  {
    name: 'meal_plans',
    columns: ['id', 'name', 'plan_type', 'created_at'],
  },
  {
    name: 'meal_plan_days',
    columns: ['id', 'meal_plan_id', 'day_order', 'label', 'created_at'],
  },
  {
    name: 'meal_plan_entries',
    columns: ['id', 'meal_plan_day_id', 'meal_type', 'food_item_id', 'food_name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'created_at'],
  },
];

export type SyncResult = {
  synced: number;
  errors: number;
  tables: string[];
};

/**
 * Scarica da Supabase tutti i dati dell'utente e li inserisce in SQLite.
 * - Righe con synced=0 (modifiche locali pendenti) non vengono sovrascritte.
 * - Righe locali synced=1 non presenti su Supabase (cancellate da web) vengono eliminate.
 */
export async function pullFromSupabase(): Promise<SyncResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { synced: 0, errors: 0, tables: [] };

  const db = await getDb();
  let synced = 0;
  let errors = 0;
  const tablesWithErrors: string[] = [];

  for (const table of SYNC_TABLES) {
    try {
      const { data, error } = await supabase
        .from(table.name)
        .select(table.columns.join(', '))
        .eq('user_id', user.id);

      if (error) {
        errors++;
        tablesWithErrors.push(table.name);
        continue;
      }

      const remoteRows = data ?? [];
      const remoteIds = new Set(remoteRows.map((r: Record<string, unknown>) => r.id));

      // Elimina righe locali (già sincronizzate) che non esistono più su Supabase
      const localSynced = await db.getAllAsync<{ id: number }>(
        `SELECT id FROM ${table.name} WHERE synced = 1 AND deleted_at IS NULL`
      ).catch(() => [] as { id: number }[]);

      for (const local of localSynced) {
        if (!remoteIds.has(local.id)) {
          await db.runAsync(`DELETE FROM ${table.name} WHERE id = ?`, [local.id]).catch(() => {});
          synced++;
        }
      }

      // Upsert righe remote in locale
      for (const row of remoteRows as Record<string, unknown>[]) {
        const localRow = await db.getFirstAsync<{ synced: number }>(
          `SELECT synced FROM ${table.name} WHERE id = ?`,
          [row.id as number]
        ).catch(() => null);

        // Non sovrascrivere modifiche locali non ancora inviate
        if (localRow?.synced === 0) continue;

        const cols = table.columns;
        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map(c => row[c] ?? null);

        await db.runAsync(
          `INSERT OR REPLACE INTO ${table.name} (${cols.join(', ')}, synced) VALUES (${placeholders}, 1)`,
          values
        ).catch(() => {});

        synced++;
      }
    } catch (err) {
      console.warn(`[Pull] Eccezione su ${table.name}:`, err);
      errors++;
      tablesWithErrors.push(table.name);
    }
  }

  return { synced, errors, tables: tablesWithErrors };
}

/**
 * Controlla quante righe sono in attesa di sincronizzazione.
 * Utile per mostrare un badge o un prompt all'utente.
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDb();
  let total = 0;
  for (const table of SYNC_TABLES) {
    try {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${table.name} WHERE synced = 0`
      );
      total += row?.count ?? 0;
    } catch {
      // Tabella non ancora migrata — ignora
    }
  }
  return total;
}

/**
 * Sincronizza tutti i dati locali (synced = 0) verso Supabase.
 * Gestisce anche le righe marcate come eliminate (deleted_at IS NOT NULL).
 */
export async function syncToSupabase(): Promise<SyncResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { synced: 0, errors: 0, tables: [] };

  const db = await getDb();
  let synced = 0;
  let errors = 0;
  const tablesWithErrors: string[] = [];

  for (const table of SYNC_TABLES) {
    try {
      // 1. Soft deletes: elimina da Supabase e poi da SQLite
      const deleted = await db.getAllAsync<{ id: number }>(
        `SELECT id FROM ${table.name} WHERE deleted_at IS NOT NULL`
      ).catch(() => [] as { id: number }[]);

      for (const row of deleted) {
        const { error } = await supabase
          .from(table.name)
          .delete()
          .eq('id', row.id)
          .eq('user_id', user.id);
        if (!error) {
          await db.runAsync(`DELETE FROM ${table.name} WHERE id = ?`, [row.id]);
          synced++;
        }
      }

      // 2. Upsert righe non sincronizzate
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT ${table.columns.join(', ')} FROM ${table.name} WHERE synced = 0 AND deleted_at IS NULL`
      ).catch(() => [] as Record<string, unknown>[]);

      if (rows.length === 0) continue;

      const payload = rows.map(row => ({ ...row, user_id: user.id }));

      const { error } = await supabase
        .from(table.name)
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn(`[Sync] Errore su ${table.name}:`, error.message);
        errors++;
        tablesWithErrors.push(table.name);
        continue;
      }

      // 3. Marca come sincronizzate in SQLite
      const ids = rows.map(r => r.id as number);
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE ${table.name} SET synced = 1 WHERE id IN (${placeholders})`,
        ids
      );

      synced += rows.length;
    } catch (err) {
      console.warn(`[Sync] Eccezione su ${table.name}:`, err);
      errors++;
      tablesWithErrors.push(table.name);
    }
  }

  return { synced, errors, tables: tablesWithErrors };
}
