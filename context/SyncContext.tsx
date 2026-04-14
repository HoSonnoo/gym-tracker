import { getPendingSyncCount, syncToSupabase } from '@/lib/syncEngine';
import { useAuth } from '@/context/AuthContext';
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus, Platform } from 'react-native';

type SyncContextValue = {
  triggerSync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue>({ triggerSync: async () => {} });

export function useSyncContext() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const isSyncing = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const triggerSync = useCallback(async () => {
    // Sul web il syncEngine è un no-op, nessuna logica necessaria
    if (Platform.OS === 'web') return;
    if (isSyncing.current) return;
    if (!user || isGuest) return;

    const pending = await getPendingSyncCount();
    if (pending === 0) return;

    isSyncing.current = true;

    Alert.alert(
      'Dati offline in attesa',
      `Hai ${pending} elemento${pending !== 1 ? 'i' : ''} modificat${pending !== 1 ? 'i' : 'o'} offline. Sincronizzarli ora?`,
      [
        {
          text: 'Dopo',
          style: 'cancel',
          onPress: () => { isSyncing.current = false; },
        },
        {
          text: 'Sincronizza',
          onPress: async () => {
            try {
              const result = await syncToSupabase();
              if (result.errors > 0) {
                Alert.alert(
                  'Sincronizzazione parziale',
                  `Sincronizzati ${result.synced} elementi. ${result.errors} tabelle con errori: ${result.tables.join(', ')}.`
                );
              }
            } catch {
              Alert.alert('Errore', 'Impossibile sincronizzare. Riprova più tardi.');
            } finally {
              isSyncing.current = false;
            }
          },
        },
      ]
    );
  }, [user, isGuest]);

  // Trigger sync quando l'app torna in primo piano
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current !== 'active' && nextState === 'active') {
        // App tornata in foreground — controlla se ci sono dati da sincronizzare
        setTimeout(() => triggerSync(), 1500); // Piccolo delay per evitare conflitti con l'inizializzazione
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [triggerSync]);

  // Trigger sync al primo login
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user || isGuest) return;
    setTimeout(() => triggerSync(), 2000);
  }, [user?.id]);

  return (
    <SyncContext.Provider value={{ triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}
