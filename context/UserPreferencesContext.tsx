import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

const STORAGE_KEY_UNIT = '@gymtracker:unit';
const STORAGE_KEY_GOAL = '@gymtracker:weekly_goal';

export type WeightUnit = 'kg' | 'lbs';

type UserPreferences = {
  unit: WeightUnit;
  weeklyGoal: number; // 1-7
};

type UserPreferencesContextValue = {
  preferences: UserPreferences;
  setUnit: (unit: WeightUnit) => Promise<void>;
  setWeeklyGoal: (goal: number) => Promise<void>;
  isLoaded: boolean;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  unit: 'kg',
  weeklyGoal: 3,
};

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  setUnit: async () => {},
  setWeeklyGoal: async () => {},
  isLoaded: false,
});

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Carica preferenze salvate all'avvio
  useEffect(() => {
    async function load() {
      try {
        const [unitRaw, goalRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_UNIT),
          AsyncStorage.getItem(STORAGE_KEY_GOAL),
        ]);
        setPreferences({
          unit: (unitRaw as WeightUnit) ?? DEFAULT_PREFERENCES.unit,
          weeklyGoal: goalRaw ? parseInt(goalRaw, 10) : DEFAULT_PREFERENCES.weeklyGoal,
        });
      } catch {
        // Fallback ai default se AsyncStorage fallisce
      } finally {
        setIsLoaded(true);
      }
    }
    load();
  }, []);

  const setUnit = useCallback(async (unit: WeightUnit) => {
    setPreferences((prev) => ({ ...prev, unit }));
    await AsyncStorage.setItem(STORAGE_KEY_UNIT, unit);
  }, []);

  const setWeeklyGoal = useCallback(async (goal: number) => {
    const clamped = Math.min(7, Math.max(1, goal));
    setPreferences((prev) => ({ ...prev, weeklyGoal: clamped }));
    await AsyncStorage.setItem(STORAGE_KEY_GOAL, String(clamped));
  }, []);

  return (
    <UserPreferencesContext.Provider value={{ preferences, setUnit, setWeeklyGoal, isLoaded }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  return useContext(UserPreferencesContext);
}

// Helper per convertire e formattare un peso rispettando l'unità scelta
export function formatWeight(kg: number | null, unit: WeightUnit): string {
  if (kg === null) return '—';
  if (unit === 'lbs') {
    return `${Math.round(kg * 2.20462 * 10) / 10} lbs`;
  }
  return `${kg} kg`;
}