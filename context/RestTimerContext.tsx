import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

type RestTimerState = {
  isActive: boolean;
  durationSeconds: number;   // durata totale impostata
  remainingSeconds: number;  // secondi rimanenti
  exerciseName: string;      // nome esercizio per display
  setLabel: string;          // es. "Serie 2 · Target"
};

type RestTimerContextValue = {
  timer: RestTimerState;
  startTimer: (durationSeconds: number, exerciseName: string, setLabel: string) => void;
  stopTimer: () => void;
};

const DEFAULT_STATE: RestTimerState = {
  isActive: false,
  durationSeconds: 0,
  remainingSeconds: 0,
  exerciseName: '',
  setLabel: '',
};

const RestTimerContext = createContext<RestTimerContextValue>({
  timer: DEFAULT_STATE,
  startTimer: () => {},
  stopTimer: () => {},
});

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const [timer, setTimer] = useState<RestTimerState>(DEFAULT_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    clearTimer();
    setTimer(DEFAULT_STATE);
  }, [clearTimer]);

  const startTimer = useCallback(
    (durationSeconds: number, exerciseName: string, setLabel: string) => {
      // Ferma eventuale timer precedente
      clearTimer();

      if (durationSeconds <= 0) return;

      setTimer({
        isActive: true,
        durationSeconds,
        remainingSeconds: durationSeconds,
        exerciseName,
        setLabel,
      });

      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (!prev.isActive) return prev;
          if (prev.remainingSeconds <= 1) {
            // Timer scaduto: si ferma da solo
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            return { ...prev, remainingSeconds: 0, isActive: false };
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
    },
    [clearTimer]
  );

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <RestTimerContext.Provider value={{ timer, startTimer, stopTimer }}>
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer() {
  return useContext(RestTimerContext);
}