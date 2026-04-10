import { Colors } from '@/constants/Colors';
import { useRestTimer } from '@/context/RestTimerContext';
import { formatWeight, useUserPreferences } from '@/context/UserPreferencesContext';
import {
  cancelWorkoutSession,
  getActiveWorkoutSession,
  getTodayCompletedSessions,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  getWorkoutTemplates,
  isDatabaseEmpty,
  startWorkoutSessionFromTemplate,
  type WorkoutSession,
  type WorkoutSessionDetail,
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
  Modal,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatElapsedStatic(startedAt: string): string {
  const totalMinutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / (1000 * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)}g fa`;
  if (h > 0) return `${h}h ${m}m fa`;
  return `${m}m fa`;
}

type SessionStatus = 'recent' | 'stale' | 'orphan';

function classifySession(session: WorkoutSession): SessionStatus {
  const hoursElapsed = (Date.now() - new Date(session.started_at).getTime()) / (1000 * 60 * 60);
  if (hoursElapsed > 12) return 'orphan';
  if (hoursElapsed > 3) return 'stale';
  return 'recent';
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

// ─── Session Recovery Card ────────────────────────────────────────────────────

type SessionRecoveryCardProps = {
  session: WorkoutSession;
  status: 'stale' | 'orphan';
  cancelling: boolean;
  onResume: () => void;
  onCancel: () => void;
};

function SessionRecoveryCard({ session, status, cancelling, onResume, onCancel }: SessionRecoveryCardProps) {
  const isOrphan = status === 'orphan';
  return (
    <View style={recoveryStyles.card}>
      <View style={recoveryStyles.iconRow}>
        <View style={recoveryStyles.iconBadge}>
          <Text style={recoveryStyles.iconText}>{isOrphan ? '⚠️' : '⏸️'}</Text>
        </View>
        <View style={recoveryStyles.titleBlock}>
          <Text style={recoveryStyles.label}>
            {isOrphan ? 'SESSIONE INTERROTTA' : 'SESSIONE IN PAUSA'}
          </Text>
          <Text style={recoveryStyles.sessionName}>{session.name}</Text>
        </View>
      </View>
      <Text style={recoveryStyles.description}>
        {isOrphan
          ? `Questa sessione è stata avviata ${formatElapsedStatic(session.started_at)} e non è mai stata completata. Probabilmente l'app si è chiusa durante l'allenamento.`
          : `Hai una sessione avviata ${formatElapsedStatic(session.started_at)}. Vuoi riprenderla o annullarla?`}
      </Text>
      <View style={recoveryStyles.actions}>
        <TouchableOpacity style={recoveryStyles.resumeButton} onPress={onResume} activeOpacity={0.85}>
          <Text style={recoveryStyles.resumeButtonText}>
            {isOrphan ? 'Riprendi comunque' : 'Riprendi →'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[recoveryStyles.cancelButton, cancelling && recoveryStyles.buttonDisabled]}
          onPress={onCancel}
          disabled={cancelling}
          activeOpacity={0.85}
        >
          <Text style={recoveryStyles.cancelButtonText}>
            {cancelling ? 'Annullamento...' : 'Annulla sessione'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const recoveryStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: `${Colors.dark.warning}55`,
    gap: 14,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 22 },
  titleBlock: { flex: 1, gap: 3 },
  label: { fontSize: 10, fontWeight: '800', color: Colors.dark.warning, letterSpacing: 1.2 },
  sessionName: { fontSize: 18, fontWeight: '800', color: Colors.dark.text },
  description: { fontSize: 14, lineHeight: 20, color: Colors.dark.textMuted },
  actions: { gap: 10 },
  resumeButton: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  resumeButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelButton: { backgroundColor: 'transparent', borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.danger, paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { color: Colors.dark.danger, fontSize: 14, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
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

// ─── Completed Session Components ────────────────────────────────────────────

function formatDuration(startedAt: string, completedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const totalSeconds = Math.floor((end - start) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
}

function formatEffortShort(type: string | null, buffer: number | null): string {
  if (!type || type === 'none') return '';
  if (type === 'buffer') return buffer != null ? ` · Buffer: ${buffer}` : ' · Buffer';
  if (type === 'failure') return ' · Cedimento';
  if (type === 'drop_set') return ' · Drop set';
  return '';
}

function CompletedSessionDetailModal({
  data,
  unit,
  onClose,
}: {
  data: WorkoutSessionDetail;
  unit: 'kg' | 'lbs';
  onClose: () => void;
}) {
  const { session, exercises } = data;
  const allCompleted = exercises.flatMap((e) => e.sets.filter((s) => s.is_completed === 1));
  const totalVolume = allCompleted.reduce((sum, s) =>
    s.actual_weight_kg != null && s.actual_reps != null
      ? sum + s.actual_weight_kg * s.actual_reps
      : sum, 0);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={completedStyles.container}>
        <View style={completedStyles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={completedStyles.content}>
          <Text style={completedStyles.title}>{session.name}</Text>
          <Text style={completedStyles.subtitle}>
            {new Date(session.completed_at ?? session.started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{formatDuration(session.started_at, session.completed_at)}
          </Text>

          <View style={completedStyles.statsRow}>
            <View style={completedStyles.statBox}>
              <Text style={completedStyles.statValue}>{allCompleted.length}</Text>
              <Text style={completedStyles.statLabel}>Serie</Text>
            </View>
            <View style={completedStyles.statBox}>
              <Text style={completedStyles.statValue}>{exercises.filter((e) => e.sets.some((s) => s.is_completed === 1)).length}</Text>
              <Text style={completedStyles.statLabel}>Esercizi</Text>
            </View>
            <View style={completedStyles.statBox}>
              <Text style={completedStyles.statValue}>
                {totalVolume > 0 ? `${Math.round(totalVolume).toLocaleString()} ${unit}` : '—'}
              </Text>
              <Text style={completedStyles.statLabel}>Volume</Text>
            </View>
          </View>

          {exercises.map(({ exercise, sets }) => {
            const done = sets.filter((s) => s.is_completed === 1);
            if (done.length === 0) return null;
            return (
              <View key={exercise.id} style={completedStyles.exBlock}>
                <Text style={completedStyles.exName}>{exercise.exercise_name}</Text>
                <Text style={completedStyles.exCategory}>{exercise.category ?? 'Nessuna categoria'}</Text>
                {done.map((s, i) => (
                  <View key={s.id} style={completedStyles.setRow}>
                    <Text style={completedStyles.setIdx}>S{i + 1}</Text>
                    <Text style={completedStyles.setDetail}>
                      {s.actual_weight_kg != null ? `${s.actual_weight_kg} ${unit}` : '—'}
                      {' × '}
                      {s.actual_reps != null ? `${s.actual_reps} rep` : '—'}
                      {formatEffortShort(s.actual_effort_type, s.actual_buffer_value)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={completedStyles.closeBtn} onPress={onClose} activeOpacity={0.9}>
          <Text style={completedStyles.closeBtnText}>Chiudi</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function CompletedSessionCard({
  data,
  unit,
  onPress,
}: {
  data: WorkoutSessionDetail;
  unit: 'kg' | 'lbs';
  onPress: () => void;
}) {
  const { session, exercises } = data;
  const completedSets = exercises.flatMap((e) => e.sets.filter((s) => s.is_completed === 1)).length;
  const totalSets = exercises.flatMap((e) => e.sets).length;

  return (
    <TouchableOpacity style={completedStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={completedStyles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={completedStyles.cardBadge}>COMPLETATO</Text>
          <Text style={completedStyles.cardName}>{session.name}</Text>
        </View>
        <Text style={completedStyles.cardArrow}>→</Text>
      </View>
      <View style={completedStyles.cardMeta}>
        <Text style={completedStyles.cardMetaText}>{formatDuration(session.started_at, session.completed_at)}</Text>
        <Text style={completedStyles.cardMetaDot}>·</Text>
        <Text style={completedStyles.cardMetaText}>{completedSets}/{totalSets} serie</Text>
        <Text style={completedStyles.cardMetaDot}>·</Text>
        <Text style={completedStyles.cardMetaText}>{exercises.length} esercizi</Text>
      </View>
    </TouchableOpacity>
  );
}

const completedStyles = StyleSheet.create({
  card: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: `${Colors.dark.success}44` },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardBadge: { fontSize: 10, fontWeight: '800', color: Colors.dark.success, letterSpacing: 1.2, marginBottom: 4 },
  cardName: { fontSize: 18, fontWeight: '800', color: Colors.dark.text },
  cardArrow: { fontSize: 18, color: Colors.dark.textMuted },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMetaText: { fontSize: 13, color: Colors.dark.textMuted, fontWeight: '600' },
  cardMetaDot: { fontSize: 13, color: Colors.dark.border },
  container: { flex: 1, backgroundColor: Colors.dark.background, paddingHorizontal: 20, paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.dark.border, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  content: { paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.dark.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.dark.textMuted, fontWeight: '600', marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.dark.border },
  statValue: { fontSize: 17, fontWeight: '800', color: PRIMARY },
  statLabel: { fontSize: 11, color: Colors.dark.textMuted, fontWeight: '600' },
  exBlock: { backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 10 },
  exName: { fontSize: 16, fontWeight: '800', color: Colors.dark.text, marginBottom: 2 },
  exCategory: { fontSize: 12, color: Colors.dark.textMuted, marginBottom: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: Colors.dark.border },
  setIdx: { fontSize: 11, fontWeight: '800', color: PRIMARY, width: 22 },
  setDetail: { fontSize: 13, color: Colors.dark.text, fontWeight: '600', flex: 1 },
  closeBtn: { backgroundColor: Colors.dark.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border, marginTop: 8 },
  closeBtnText: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const router = useRouter();
  const { preferences } = useUserPreferences();

  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [cancellingSession, setCancellingSession] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [dbEmpty, setDbEmpty] = useState(false);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [sessionData, setSessionData] = useState<SessionExerciseWithSets[]>([]);
  const [todayCompletedSessions, setTodayCompletedSessions] = useState<WorkoutSessionDetail[]>([]);
  const [selectedCompletedSession, setSelectedCompletedSession] = useState<WorkoutSessionDetail | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeSession) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const status = classifySession(activeSession);
    if (status !== 'recent') return;
    const tick = () => setElapsed(formatElapsed(activeSession.started_at));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  const loadScreenData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesData, activeSessionData, empty, completedToday] = await Promise.all([
        getWorkoutTemplates(),
        getActiveWorkoutSession(),
        isDatabaseEmpty(),
        getTodayCompletedSessions(),
      ]);
      setTemplates(templatesData);
      setActiveSession(activeSessionData);
      setDbEmpty(empty);
      setTodayCompletedSessions(completedToday);
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

  const handleOpenActiveSession = useCallback(() => {
    if (!activeSession) return;
    router.push(`/workout-session/${activeSession.id}`);
  }, [activeSession, router]);

  const handleCancelSession = useCallback(async () => {
    if (!activeSession) return;
    Alert.alert(
      'Annulla sessione',
      'La sessione verrà marcata come annullata. I dati parzialmente inseriti andranno persi.',
      [
        { text: 'Indietro', style: 'cancel' },
        {
          text: 'Annulla sessione',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingSession(true);
              await cancelWorkoutSession(activeSession.id);
              await loadScreenData();
            } catch {
              Alert.alert('Errore', 'Impossibile annullare la sessione.');
            } finally {
              setCancellingSession(false);
            }
          },
        },
      ]
    );
  }, [activeSession, loadScreenData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const sessionStatus = activeSession ? classifySession(activeSession) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Oggi</Text>

      {!activeSession ? (
        dbEmpty ? (
          // ── DB vuoto — empty state guidato ────────────────────────────────
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inizia qui 👋</Text>
            <Text style={styles.cardText}>
              Non hai ancora nessun template di allenamento. Vai nel tab Allenamenti per crearne uno — ci vogliono pochi minuti.
            </Text>
            <TouchableOpacity
              style={styles.onboardingButton}
              onPress={() => router.push('/(tabs)/workouts')}
              activeOpacity={0.85}
            >
              <Text style={styles.onboardingButtonText}>Vai ad Allenamenti →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // ── Nessuna sessione attiva — scegli template ─────────────────────
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
        )
      ) : sessionStatus === 'orphan' || sessionStatus === 'stale' ? (
        // ── Sessione orfana o in pausa da troppo tempo ─────────────────────
        <SessionRecoveryCard
          session={activeSession}
          status={sessionStatus}
          cancelling={cancellingSession}
          onResume={handleOpenActiveSession}
          onCancel={handleCancelSession}
        />
      ) : (
        // ── Sessione attiva recente ────────────────────────────────────────
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
            <Text style={styles.progressLabel}>
              {completedSetsCount} / {totalSetsCount} serie completate
            </Text>
          </View>

          <RestTimerBanner />

          <ExerciseBreakdownCard
            sessionData={sessionData}
            unit={preferences.unit}
            onPress={handleOpenActiveSession}
          />


        </>
      )}

      {/* Sessioni completate oggi */}
      {todayCompletedSessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Completati oggi</Text>
          {todayCompletedSessions.map((detail) => (
            <CompletedSessionCard
              key={detail.session.id}
              data={detail}
              unit={preferences.unit}
              onPress={() => setSelectedCompletedSession(detail)}
            />
          ))}
        </>
      )}

      {selectedCompletedSession && (
        <CompletedSessionDetailModal
          data={selectedCompletedSession}
          unit={preferences.unit}
          onClose={() => setSelectedCompletedSession(null)}
        />
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  loadingContainer: { flex: 1, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginTop: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.dark.textMuted, letterSpacing: 0.5, marginTop: 4 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, marginBottom: 12 },
  cardText: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  cancelSessionBtn: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.danger,
  },
  cancelSessionBtnText: {
    color: Colors.dark.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  onboardingButton: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  onboardingButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
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