import { useAuth } from '@/context/AuthContext';
import { Alert } from 'react-native';

export const GUEST_LIMITS = {
  MAX_TEMPLATES: 2,
  MAX_EXERCISES: 15,
  HISTORY_DAYS: 14,
} as const;

export function useGuestLimits() {
  const { isGuest } = useAuth();

  const checkTemplateLimit = (currentCount: number): boolean => {
    if (!isGuest) return true;
    if (currentCount >= GUEST_LIMITS.MAX_TEMPLATES) {
      Alert.alert(
        '🔒 Limite ospite',
        `Come ospite puoi creare fino a ${GUEST_LIMITS.MAX_TEMPLATES} template. Registrati gratuitamente per averne illimitati.`,
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const checkExerciseLimit = (currentCount: number): boolean => {
    if (!isGuest) return true;
    if (currentCount >= GUEST_LIMITS.MAX_EXERCISES) {
      Alert.alert(
        '🔒 Limite ospite',
        `Come ospite puoi salvare fino a ${GUEST_LIMITS.MAX_EXERCISES} esercizi. Registrati gratuitamente per averne illimitati.`,
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const checkExportAllowed = (): boolean => {
    if (!isGuest) return true;
    Alert.alert(
      '🔒 Funzione non disponibile',
      `L'export dei dati è disponibile solo per gli utenti registrati. Crea un account gratuito per abilitarlo.`,
      [{ text: 'OK' }]
    );
    return false;
  };

  // Filtra una lista di sessioni/log per mostrare solo gli ultimi N giorni
  const filterByHistoryLimit = <T extends { completed_at?: string; started_at?: string; date?: string }>(
    items: T[]
  ): T[] => {
    if (!isGuest) return items;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - GUEST_LIMITS.HISTORY_DAYS);
    return items.filter((item) => {
      const dateStr = item.completed_at ?? item.started_at ?? item.date ?? '';
      if (!dateStr) return true;
      return new Date(dateStr) >= cutoff;
    });
  };

  return {
    isGuest,
    checkTemplateLimit,
    checkExerciseLimit,
    checkExportAllowed,
    filterByHistoryLimit,
    GUEST_LIMITS,
  };
}