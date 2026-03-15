// app/(tabs)/index.tsx
import { Colors } from '@/constants/Colors';
import {
  completeWorkoutSession,
  getActiveWorkoutSession,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  getWorkoutTemplates,
  startWorkoutSessionFromTemplate,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
  type WorkoutTemplate,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';

type SessionExerciseWithSets = {
  exercise: WorkoutSessionExercise;
  sets: WorkoutSessionSet[];
};

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const totalSeconds = Math.floor((now - start) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TodayScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [elapsed, setElapsed] = useState('');

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [sessionData, setSessionData] = useState<SessionExerciseWithSets[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer live
  useEffect(() => {
    if (!activeSession) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => setElapsed(formatElapsed(activeSession.started_at));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  const loadScreenData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesData, activeSessionData] = await Promise.all([
        getWorkoutTemplates(),
        getActiveWorkoutSession(),
      ]);
      setTemplates(templatesData);
      setActiveSession(activeSessionData);

      if (!activeSessionData) {
        setSessionData([]);
        return;
      }

      const exercises = await getWorkoutSessionExercises(activeSessionData.id);
      const exercisesWithSets = await Promise.all(
        exercises.map(async (exercise) => {
          const sets = await getWorkoutSessionSets(exercise.id);
          return { exercise, sets };
        })
      );
      setSessionData(exercisesWithSets);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la schermata di oggi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadScreenData();
    }, [loadScreenData])
  );

  const allSets = useMemo(() => sessionData.flatMap((i) => i.sets), [sessionData]);
  const completedSetsCount = useMemo(() => allSets.filter((s) => s.is_completed === 1).length, [allSets]);
  const totalSetsCount = allSets.length;
  const progressPercent = totalSetsCount > 0 ? completedSetsCount / totalSetsCount : 0;

  // Prossima serie non completata
  const nextSet = useMemo(() => {
    for (const item of sessionData) {
      for (const set of item.sets) {
        if (set.is_completed !== 1) {
          return { exerciseName: item.exercise.exercise_name, set };
        }
      }
    }
    return null;
  }, [sessionData]);

  const handleStartSession = async (templateId: number) => {
    try {
      setStartingSession(true);
      const sessionId = await startWorkoutSessionFromTemplate(templateId);
      await loadScreenData();
      router.push(`/workout-session/${sessionId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossibile avviare la sessione.';
      Alert.alert('Errore', message);
    } finally {
      setStartingSession(false);
    }
  };

  const handleOpenActiveSession = () => {
    if (!activeSession) return;
    router.push(`/workout-session/${activeSession.id}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Oggi</Text>

      {!activeSession ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allenamento del giorno</Text>
            <Text style={styles.cardText}>
              Seleziona un template per avviare la sessione di oggi.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scegli un template</Text>
            {templates.length === 0 ? (
              <Text style={styles.cardText}>Non hai ancora creato template di allenamento.</Text>
            ) : (
              <View style={styles.templateList}>
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateButton}
                    onPress={() => handleStartSession(template.id)}
                    activeOpacity={0.85}
                    disabled={startingSession}
                  >
                    <View style={styles.templateButtonContent}>
                      <Text style={styles.templateButtonTitle}>{template.name}</Text>
                      {template.notes ? (
                        <Text style={styles.templateButtonText}>{template.notes}</Text>
                      ) : (
                        <Text style={styles.templateButtonTextMuted}>Nessuna nota</Text>
                      )}
                    </View>
                    <Text style={styles.templateButtonAction}>
                      {startingSession ? 'Avvio...' : 'Inizia →'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          {/* Header sessione attiva */}
          <View style={styles.sessionHeaderCard}>
            <View style={styles.sessionHeaderTop}>
              <View>
                <Text style={styles.sessionHeaderLabel}>SESSIONE ATTIVA</Text>
                <Text style={styles.sessionHeaderName}>{activeSession.name}</Text>
              </View>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>{elapsed}</Text>
              </View>
            </View>

            {/* Barra progresso globale */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent * 100}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>
              {completedSetsCount} / {totalSetsCount} serie completate
            </Text>
          </View>

          {/* Prossima serie */}
          {nextSet ? (
            <TouchableOpacity
              style={styles.nextSetCard}
              onPress={handleOpenActiveSession}
              activeOpacity={0.88}
            >
              <Text style={styles.nextSetLabel}>PROSSIMA SERIE</Text>
              <Text style={styles.nextSetExercise}>{nextSet.exerciseName}</Text>
              <View style={styles.nextSetDetails}>
                {nextSet.set.target_weight_kg != null && (
                  <View style={styles.nextSetBadge}>
                    <Text style={styles.nextSetBadgeText}>{nextSet.set.target_weight_kg} kg</Text>
                  </View>
                )}
                {(nextSet.set.target_reps_min != null || nextSet.set.target_reps_max != null) && (
                  <View style={styles.nextSetBadge}>
                    <Text style={styles.nextSetBadgeText}>
                      {nextSet.set.target_reps_min === nextSet.set.target_reps_max
                        ? `${nextSet.set.target_reps_min} rep`
                        : `${nextSet.set.target_reps_min ?? '?'}-${nextSet.set.target_reps_max ?? '?'} rep`}
                    </Text>
                  </View>
                )}
                <View style={[styles.nextSetBadge, { backgroundColor: 'rgba(126,71,255,0.18)' }]}>
                  <Text style={[styles.nextSetBadgeText, { color: PRIMARY }]}>
                    {nextSet.set.target_set_type === 'warmup' ? 'Riscaldamento' : 'Serie target'}
                  </Text>
                </View>
              </View>
              <View style={styles.goButton}>
                <Text style={styles.goButtonText}>Apri allenamento →</Text>
              </View>
            </TouchableOpacity>
          ) : (
            // Tutte le serie completate
            <View style={[styles.nextSetCard, { borderColor: '#2ecc71' }]}>
              <Text style={[styles.nextSetLabel, { color: '#2ecc71' }]}>TUTTE LE SERIE COMPLETATE</Text>
              <Text style={styles.nextSetExercise}>Ottimo lavoro! 💪</Text>
              <TouchableOpacity
                style={[styles.goButton, { backgroundColor: '#2ecc71' }]}
                onPress={handleOpenActiveSession}
                activeOpacity={0.88}
              >
                <Text style={styles.goButtonText}>Vai al riepilogo →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Breakdown esercizi */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Esercizi</Text>
            <View style={styles.exerciseBreakdownList}>
              {sessionData.map((item) => {
                const done = item.sets.filter((s) => s.is_completed === 1).length;
                const total = item.sets.length;
                const pct = total > 0 ? done / total : 0;
                const allDone = done === total && total > 0;
                return (
                  <View key={item.exercise.id} style={styles.exerciseBreakdownRow}>
                    <View style={styles.exerciseBreakdownInfo}>
                      <Text style={[styles.exerciseBreakdownName, allDone && styles.textDone]}>
                        {item.exercise.exercise_name}
                      </Text>
                      <Text style={styles.exerciseBreakdownSets}>
                        {done}/{total} serie
                      </Text>
                    </View>
                    <View style={styles.miniProgressTrack}>
                      <View style={[
                        styles.miniProgressFill,
                        { width: `${pct * 100}%` as any },
                        allDone && styles.miniProgressDone,
                      ]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.textMuted,
  },

  // Template list
  templateList: { gap: 12, marginTop: 4 },
  templateButton: {
    backgroundColor: '#17171c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  templateButtonContent: { flex: 1 },
  templateButtonTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  templateButtonText: { color: Colors.dark.textMuted, fontSize: 14, lineHeight: 20 },
  templateButtonTextMuted: { color: Colors.dark.textMuted, fontSize: 14, fontStyle: 'italic' },
  templateButtonAction: { color: PRIMARY, fontWeight: '700', fontSize: 14 },

  // Session header card
  sessionHeaderCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(126, 71, 255, 0.4)',
  },
  sessionHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sessionHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sessionHeaderName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  timerBadge: {
    backgroundColor: 'rgba(126,71,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.3)',
  },
  timerText: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#2a2a35',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 6,
  },
  progressLabel: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.dark.textMuted,
  },

  // Next set card
  nextSetCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.25)',
  },
  nextSetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  nextSetExercise: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  nextSetDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  nextSetBadge: {
    backgroundColor: '#2a2a35',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nextSetBadgeText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  goButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  goButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  // Exercise breakdown
  exerciseBreakdownList: { gap: 14 },
  exerciseBreakdownRow: { gap: 6 },
  exerciseBreakdownInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseBreakdownName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  textDone: {
    color: '#2ecc71',
  },
  exerciseBreakdownSets: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  miniProgressTrack: {
    height: 4,
    backgroundColor: '#2a2a35',
    borderRadius: 4,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  miniProgressDone: {
    backgroundColor: '#2ecc71',
  },
});
