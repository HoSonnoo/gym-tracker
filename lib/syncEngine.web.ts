// Sul web i dati vengono scritti direttamente su Supabase.
// Nessuna sincronizzazione locale necessaria.

export type SyncResult = {
  synced: number;
  errors: number;
  tables: string[];
};

export async function getPendingSyncCount(): Promise<number> {
  return 0;
}

export async function syncToSupabase(): Promise<SyncResult> {
  return { synced: 0, errors: 0, tables: [] };
}

export async function pullFromSupabase(): Promise<SyncResult> {
  return { synced: 0, errors: 0, tables: [] };
}
