import { Colors } from '@/constants/Colors';
import { useRestTimer } from '@/context/RestTimerContext';
import { formatWeight, useUserPreferences } from '@/context/UserPreferencesContext';
import {
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

// ─── Rest Timer Banner ────────────────────────────────────────────────────────

function RestTimerBanner() {
  const { timer, stopTimer } = useRestTimer();
  if (!timer.isActive && timer.remainingSeconds === 0) return null;

  const progress = timer.durationSeconds > 0 ? timer.remainingSeconds / timer.durationSeconds : 0;
  const isExpired = !timer.isActive && timer.remainingSeconds === 0 && timer.durationSeconds > 0;
  const accentColor = isExpired ? Colors.dark.success : PRIMARY;

  return (
    <View style={[bannerStyles.container, { borderColor: accentColor + '55' }]}>
      <View style={bannerStyles.top}>
        <View>
          <Text style={[bannerStyles.label, { color: accentColor }]}>
            {isExpired ? 'RECUPERO COMPLETATO' : 'RECUPERO IN CORSO'}
          </Text>
          <Text style={bannerStyles.context}>
            {timer.exerciseName} · {timer.setLabel}
          </Text>
        </View>
        <View style={bannerStyles.right}>
          <Text style={[bannerStyles.countdown, { color: accentColor }]}>
            {isExpired ? '✓' : `${timer.remainingSeconds}s`}
          </Text>
          <TouchableOpacity onPress={stopTimer} activeOpacity={0.8} style={bannerStyles.skipButton}>
            <Text style={bannerStyles.skipText}>Salta</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={bannerStyles.trackOuter}>
        <View style={[bannerStyles.trackFill, { width: `${progress * 100}%` as any, backgroundColor: accentColor }]} />
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 14, borderWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 },
  context: { fontSize: 13, color: Colors.dark.text, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 4 },
  countdown: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  skipButton: { backgroundColor: Colors.dark.surfaceSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  skipText: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '700' },
  trackOuter: { height: 4, backgroundColor: '#2a2a35', borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4 },
});

// ─── Exercise Breakdown Card ──────────────────────────────────────────────────

type ExerciseBreakdownCardProps = {
  sessionData: SessionExerciseWithSets[];
  unit: 'kg' | 'lbs';
  onPress: () => void;
};

function ExerciseBreakdownCard({ sessionData, unit, onPress }: ExerciseBreakdownCardProps) {
  const nextSetInfo = useMemo(() => {
    for (const item of sessionData) {
      for (const set of item.sets) {
        if (set.is_completed !== 1) {
          return {
            exerciseId: item.exercise.id,
            exerciseName: item.exercise.exercise_name,
            set,
            setIndex: item.sets.indexOf(set),
          };
        }
      }
    }
    return null;
  }, [sessionData]);

  const allCompleted = nextSetInfo === null;

  return (
    <TouchableOpacity
      style={[exerciseCardStyles.card, allCompleted && exerciseCardStyles.cardDone]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={exerciseCardStyles.header}>
        <Text style={exerciseCardStyles.title}>
          {allCompleted ? 'Allenamento completato 💪' : 'Esercizi'}
        </Text>
      </View>

      <View style={exerciseCardStyles.list}>
        {sessionData.map((item) => {
          const done = item.sets.filter((s) => s.is_completed === 1).length;
          const total = item.sets.length;
          const pct = total > 0 ? done / total : 0;
          const allDone = done === total && total > 0;
          const isCurrentExercise = nextSetInfo?.exerciseId === item.exercise.id;

          return (
            <View key={item.exercise.id} style={exerciseCardStyles.row}>
              <View style={exerciseCardStyles.rowTop}>
                <View style={exerciseCardStyles.rowLeft}>
                  {isCurrentExercise && <View style={exerciseCardStyles.currentDot} />}
                  <Text style={[
                    exerciseCardStyles.exerciseName,
                    allDone && exerciseCardStyles.exerciseNameDone,
                    isCurrentExercise && exerciseCardStyles.exerciseNameCurrent,
                  ]}>
                    {item.exercise.exercise_name}
                  </Text>
                </View>
                <Text style={[exerciseCardStyles.setCount, allDone && exerciseCardStyles.setCountDone]}>
                  {done}/{total} serie
                </Text>
              </View>

              <View style={exerciseCardStyles.progressTrack}>
                <View style={[
                  exerciseCardStyles.progressFill,
                  { width: `${pct * 100}%` as any },
                  allDone && exerciseCardStyles.progressFillDone,
                ]} />
              </View>

              {isCurrentExercise && nextSetInfo && (
                <View style={exerciseCardStyles.nextSetRow}>
                  <Text style={exerciseCardStyles.nextSetLabel}>
                    Serie {nextSetInfo.setIndex + 1}
                    {nextSetInfo.set.target_set_type === 'warmup' ? ' · Warmup' : ' · Target'}
                  </Text>
                  {nextSetInfo.set.target_weight_kg != null && (
                    <View style={exerciseCardStyles.badge}>
                      <Text style={exerciseCardStyles.badgeText}>
                        {formatWeight(nextSetInfo.set.target_weight_kg, unit)}
                      </Text>
                    </View>
                  )}
                  {(nextSetInfo.set.target_reps_min != null || nextSetInfo.set.target_reps_max != null) && (
                    <View style={exerciseCardStyles.badge}>
                      <Text style={exerciseCardStyles.badgeText}>
                        {nextSetInfo.set.target_reps_min === nextSetInfo.set.target_reps_max
                          ? `${nextSetInfo.set.target_reps_min} rep`
                          : `${nextSetInfo.set.target_reps_min ?? '?'}–${nextSetInfo.set.target_reps_max ?? '?'} rep`}
                      </Text>
                    </View>
                  )}
                  {nextSetInfo.set.target_rest_seconds != null && (
                    <View style={exerciseCardStyles.badge}>
                      <Text style={exerciseCardStyles.badgeText}>
                        {nextSetInfo.set.target_rest_seconds}s pausa
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={[exerciseCardStyles.openButton, allCompleted && exerciseCardStyles.openButtonDone]}>
        <Text style={exerciseCardStyles.openButtonText}>
          {allCompleted ? 'Vai al riepilogo →' : 'Apri allenamento →'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const exerciseCardStyles = StyleSheet.create({
  card: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(126,71,255,0.25)' },
  cardDone: { borderColor: Colors.dark.success + '55' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.dark.text },
  list: { gap: 16, marginBottom: 16 },
  row: { gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: PRIMARY },
  exerciseName: { fontSize: 15, fontWeight: '600', color: Colors.dark.text, flex: 1 },
  exerciseNameCurrent: { fontWeight: '700' },
  exerciseNameDone: { color: Colors.dark.success },
  setCount: { fontSize: 13, color: Colors.dark.textMuted },
  setCountDone: { color: Colors.dark.success },
  progressTrack: { height: 4, backgroundColor: '#2a2a35', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 4 },
  progressFillDone: { backgroundColor: Colors.dark.success },
  nextSetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' },
  nextSetLabel: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: '600', marginRight: 2 },
  badge: { backgroundColor: '#2a2a35', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: Colors.dark.text, fontSize: 12, fontWeight: '600' },
  openButton: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  openButtonDone: { backgroundColor: Colors.dark.success },
  openButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const router = useRouter();
  const { preferences } = useUserPreferences();

  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [elapsed, setElapsed] = useState('');

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [sessionData, setSessionData] = useState<SessionExerciseWithSets[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeSession) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => setElapsed(formatElapsed(activeSession.started_at));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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
        exercises.map(async (exercise) => ({
          exercise,
          sets: await getWorkoutSessionSets(exercise.id),
        }))
      );
      setSessionData(exercisesWithSets);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la schermata di oggi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadScreenData(); }, [loadScreenData])
  );

  const allSets = useMemo(() => sessionData.flatMap((i) => i.sets), [sessionData]);
  const completedSetsCount = useMemo(() => allSets.filter((s) => s.is_completed === 1).length, [allSets]);
  const totalSetsCount = allSets.length;
  const progressPercent = totalSetsCount > 0 ? completedSetsCount / totalSetsCount : 0;

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Oggi</Text>

      {!activeSession ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allenamento del giorno</Text>
            <Text style={styles.cardText}>Seleziona un template per avviare la sessione di oggi.</Text>
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
                      {template.notes
                        ? <Text style={styles.templateButtonText}>{template.notes}</Text>
                        : <Text style={styles.templateButtonTextMuted}>Nessuna nota</Text>}
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
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent * 100}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>{completedSetsCount} / {totalSetsCount} serie completate</Text>
          </View>

          <RestTimerBanner />

          <ExerciseBreakdownCard
            sessionData={sessionData}
            unit={preferences.unit}
            onPress={handleOpenActiveSession}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  loadingContainer: { flex: 1, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginTop: 8, marginBottom: 8 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, marginBottom: 12 },
  cardText: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  templateList: { gap: 12, marginTop: 4 },
  templateButton: { backgroundColor: '#17171c', borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.border, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  templateButtonContent: { flex: 1 },
  templateButtonTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  templateButtonText: { color: Colors.dark.textMuted, fontSize: 14, lineHeight: 20 },
  templateButtonTextMuted: { color: Colors.dark.textMuted, fontSize: 14, fontStyle: 'italic' },
  templateButtonAction: { color: PRIMARY, fontWeight: '700', fontSize: 14 },
  sessionHeaderCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(126,71,255,0.4)' },
  sessionHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sessionHeaderLabel: { fontSize: 11, fontWeight: '700', color: PRIMARY, letterSpacing: 1.2, marginBottom: 4 },
  sessionHeaderName: { fontSize: 22, fontWeight: '800', color: Colors.dark.text },
  timerBadge: { backgroundColor: 'rgba(126,71,255,0.15)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(126,71,255,0.3)' },
  timerText: { color: PRIMARY, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressBarTrack: { height: 6, backgroundColor: '#2a2a35', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 6 },
  progressLabel: { marginTop: 8, fontSize: 13, color: Colors.dark.textMuted },
});