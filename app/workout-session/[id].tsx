import { Colors } from '@/constants/Colors';
import { useRestTimer } from '@/context/RestTimerContext';
import { formatWeight, useUserPreferences } from '@/context/UserPreferencesContext';
import {
  addEmptySetToSessionExercise,
  addExerciseToSession,
  cancelWorkoutSession,
  completeWorkoutSession,
  getExercises,
  getWorkoutSessionById,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  removeExerciseFromSession,
  removeSetFromSessionExercise,
  updateWorkoutSessionSet,
  type Exercise,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutChangeEvent,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#7e47ff';
const NEXT_SET_SCROLL_OFFSET = 20;

const EFFORT_OPTIONS: { key: EffortType; label: string }[] = [
  { key: 'none', label: 'Nessuno' },
  { key: 'buffer', label: 'Buffer' },
  { key: 'failure', label: 'Cedimento' },
  { key: 'drop_set', label: 'Drop set' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type EffortType = 'none' | 'buffer' | 'failure' | 'drop_set';

type SetFormState = {
  actual_weight_kg: string;
  actual_reps: string;
  actual_notes: string;
  actual_effort_type: EffortType | '';
};

type SessionExerciseWithSets = {
  exercise: WorkoutSessionExercise;
  sets: WorkoutSessionSet[];
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function parseNullableNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildInitialForm(set: WorkoutSessionSet): SetFormState {
  return {
    actual_weight_kg: set.actual_weight_kg !== null ? String(set.actual_weight_kg) : '',
    actual_reps: set.actual_reps !== null ? String(set.actual_reps) : '',
    actual_notes: set.actual_notes ?? '',
    actual_effort_type:
      (set.actual_effort_type as EffortType | null) ??
      (set.target_effort_type as EffortType) ??
      'none',
  };
}

function formatTargetReps(set: WorkoutSessionSet): string {
  const { target_reps_min: min, target_reps_max: max } = set;
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  return `${min ?? max ?? '—'}`;
}

function formatRest(set: WorkoutSessionSet): string {
  return set.target_rest_seconds !== null ? `${set.target_rest_seconds}s` : '—';
}

function formatSetType(set: WorkoutSessionSet): string {
  return set.target_set_type === 'warmup' ? 'Warmup' : 'Target';
}

function formatEffortType(value: string | null): string {
  switch (value) {
    case 'buffer':   return 'Buffer';
    case 'failure':  return 'Cedimento';
    case 'drop_set': return 'Drop set';
    default:         return 'Nessuno';
  }
}

// ─── Add Exercise Modal ───────────────────────────────────────────────────────

type AddExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
};

function AddExerciseModal({ visible, onClose, onSelect }: AddExerciseModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getExercises()
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const q = search.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.category?.toLowerCase().includes(q) ?? false)
    );
  }, [exercises, search]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modalStyles.container}>
        <View style={modalStyles.handle} />

        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Aggiungi esercizio</Text>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeButton} activeOpacity={0.8}>
            <Text style={modalStyles.closeButtonText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca esercizio..."
            placeholderTextColor={Colors.dark.textMuted}
            style={modalStyles.searchInput}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        {loading ? (
          <View style={modalStyles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={modalStyles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={modalStyles.emptyBox}>
                <Text style={modalStyles.emptyText}>
                  {search.trim()
                    ? `Nessun esercizio trovato per "${search}"`
                    : 'Nessun esercizio nel catalogo.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={modalStyles.exerciseRow}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <View style={modalStyles.exerciseInfo}>
                  <Text style={modalStyles.exerciseName}>{item.name}</Text>
                  <Text style={modalStyles.exerciseCategory}>
                    {item.category ?? 'Nessuna categoria'}
                  </Text>
                </View>
                <View style={modalStyles.addBadge}>
                  <Text style={modalStyles.addBadgeText}>+ Aggiungi</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  closeButton: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  closeButtonText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  searchRow: { paddingHorizontal: 20, marginBottom: 12 },
  searchInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: Colors.dark.text, fontSize: 15 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyBox: { paddingTop: 40, alignItems: 'center' },
  emptyText: { color: Colors.dark.textMuted, fontSize: 15, textAlign: 'center' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 10, gap: 12 },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, marginBottom: 4 },
  exerciseCategory: { fontSize: 13, color: Colors.dark.textMuted },
  addBadge: { backgroundColor: 'rgba(126,71,255,0.14)', borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.primary, paddingHorizontal: 12, paddingVertical: 6 },
  addBadgeText: { color: Colors.dark.primarySoft, fontSize: 13, fontWeight: '700' },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function BackButton({ onPress, label = 'Indietro' }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity style={styles.topBackButton} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.topBackButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function TargetBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.targetBox}>
      <Text style={styles.targetLabel}>{label}</Text>
      <Text style={styles.targetValue}>{value}</Text>
    </View>
  );
}

type SetCardProps = {
  set: WorkoutSessionSet;
  index: number;
  form: SetFormState;
  isCompleted: boolean;
  isNextIncomplete: boolean;
  isSaving: boolean;
  unit: 'kg' | 'lbs';
  onLayout: (e: LayoutChangeEvent) => void;
  onFieldChange: (field: keyof SetFormState, value: string) => void;
  onSave: () => void;
  onUncheck: () => void;
  onRemove: () => void;
};

function SetCard({
  set,
  index,
  form,
  isCompleted,
  isNextIncomplete,
  isSaving,
  unit,
  onLayout,
  onFieldChange,
  onSave,
  onUncheck,
  onRemove,
}: SetCardProps) {
  const isHighlighted = isCompleted || isNextIncomplete;
  const statusLabel = isCompleted ? 'Completata' : isNextIncomplete ? 'Prossima' : 'Da fare';

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.setCard,
        isCompleted && styles.setCardCompleted,
        isNextIncomplete && styles.setCardNext,
      ]}
    >
      <View style={styles.setHeaderRow}>
        <Text style={styles.setTitle}>
          Serie {index + 1} · {formatSetType(set)}
        </Text>
        <View style={styles.setHeaderRight}>
          <View style={[styles.statusPill, isHighlighted && styles.statusPillActive]}>
            <Text style={[styles.statusPillText, isHighlighted && styles.statusPillTextActive]}>
              {statusLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.removeSetButton}
            onPress={onRemove}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.removeSetButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.targetGrid}>
        <TargetBox label="Target peso" value={formatWeight(set.target_weight_kg, unit)} />
        <TargetBox label="Target reps" value={formatTargetReps(set)} />
        <TargetBox label="Pausa" value={formatRest(set)} />
        <TargetBox label="Sforzo" value={formatEffortType(set.target_effort_type)} />
      </View>

      {set.target_notes ? (
        <View style={styles.inlineNoteBox}>
          <Text style={styles.noteLabel}>Note target</Text>
          <Text style={styles.noteText}>{set.target_notes}</Text>
        </View>
      ) : null}

      <View style={styles.inputsRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Peso reale ({unit})</Text>
          <TextInput
            value={form.actual_weight_kg}
            onChangeText={(v) => onFieldChange('actual_weight_kg', v)}
            placeholder={unit === 'kg' ? 'Es. 60' : 'Es. 132'}
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Reps reali</Text>
          <TextInput
            value={form.actual_reps}
            onChangeText={(v) => onFieldChange('actual_reps', v)}
            placeholder="Es. 8"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Sforzo reale</Text>
        <View style={styles.effortRow}>
          {EFFORT_OPTIONS.map((option) => {
            const selected = form.actual_effort_type === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.effortChip, selected && styles.effortChipSelected]}
                activeOpacity={0.85}
                onPress={() => onFieldChange('actual_effort_type', option.key)}
              >
                <Text style={[styles.effortChipText, selected && styles.effortChipTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Note serie</Text>
        <TextInput
          value={form.actual_notes}
          onChangeText={(v) => onFieldChange('actual_notes', v)}
          placeholder="Note opzionali"
          placeholderTextColor={Colors.dark.textMuted}
          multiline
          style={[styles.input, styles.notesInput]}
        />
      </View>

      <View style={styles.setActions}>
        <TouchableOpacity
          style={[styles.primaryButton, isSaving && styles.disabledButton]}
          onPress={onSave}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? 'Salvataggio...' : isCompleted ? 'Aggiorna serie' : 'Completa serie'}
          </Text>
        </TouchableOpacity>

        {isCompleted ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onUncheck}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Segna come non completata</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ─── Rest Timer Banner ────────────────────────────────────────────────────────

function RestTimerBanner() {
  const { timer, stopTimer } = useRestTimer();
  if (!timer.isActive && timer.remainingSeconds === 0) return null;

  const progress = timer.durationSeconds > 0
    ? timer.remainingSeconds / timer.durationSeconds
    : 0;
  const isExpired = !timer.isActive && timer.remainingSeconds === 0 && timer.durationSeconds > 0;
  const accentColor = isExpired ? Colors.dark.success : PRIMARY;

  return (
    <View style={[bannerStyles.container, { borderColor: accentColor + '55' }]}>
      <View style={bannerStyles.top}>
        <View>
          <Text style={[bannerStyles.label, { color: accentColor }]}>
            {isExpired ? 'RECUPERO COMPLETATO' : 'RECUPERO'}
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
  container: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 14 },
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const { startTimer } = useRestTimer();
  const { preferences } = useUserPreferences();

  const scrollRef = useRef<ScrollView | null>(null);
  const exerciseCardPositionsRef = useRef<Record<number, number>>({});
  const setCardRelativePositionsRef = useRef<Record<number, number>>({});

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sessionData, setSessionData] = useState<SessionExerciseWithSets[]>([]);
  const [setForms, setSetForms] = useState<Record<number, SetFormState>>({});
  const [savingSetId, setSavingSetId] = useState<number | null>(null);
  const [finishingSession, setFinishingSession] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [addingSetForExercise, setAddingSetForExercise] = useState<Record<number, boolean>>({});

  // ── Data loading ──────────────────────────────────────────────────────────────

  const loadSessionData = useCallback(async () => {
    if (!sessionId || Number.isNaN(sessionId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sessionFromDb = await getWorkoutSessionById(sessionId);
      setSession(sessionFromDb);
      if (!sessionFromDb) {
        setSessionData([]);
        setSetForms({});
        return;
      }
      const exercises = await getWorkoutSessionExercises(sessionFromDb.id);
      const exercisesWithSets = await Promise.all(
        exercises.map(async (exercise) => ({
          exercise,
          sets: await getWorkoutSessionSets(exercise.id),
        }))
      );
      const initialForms: Record<number, SetFormState> = {};
      for (const { sets } of exercisesWithSets) {
        for (const set of sets) {
          initialForms[set.id] = buildInitialForm(set);
        }
      }
      setSessionData(exercisesWithSets);
      setSetForms(initialForms);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la sessione di allenamento.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => { loadSessionData(); }, [loadSessionData])
  );

  // ── Derived state ─────────────────────────────────────────────────────────────

  const allSets = useMemo(() => sessionData.flatMap((item) => item.sets), [sessionData]);
  const completedSetsCount = useMemo(() => allSets.filter((s) => s.is_completed === 1).length, [allSets]);
  const totalSetsCount = allSets.length;
  const remainingSetsCount = totalSetsCount - completedSetsCount;
  const progressPercent = totalSetsCount > 0 ? completedSetsCount / totalSetsCount : 0;
  const nextIncompleteSet = useMemo(() => allSets.find((s) => s.is_completed === 0) ?? null, [allSets]);

  // ── Scroll ────────────────────────────────────────────────────────────────────

  const registerExerciseCardPosition = useCallback(
    (exerciseId: number) => (event: LayoutChangeEvent) => {
      exerciseCardPositionsRef.current[exerciseId] = event.nativeEvent.layout.y;
    }, []
  );

  const registerSetCardPosition = useCallback(
    (setId: number) => (event: LayoutChangeEvent) => {
      setCardRelativePositionsRef.current[setId] = event.nativeEvent.layout.y;
    }, []
  );

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const scrollToNextIncompleteSet = useCallback(() => {
    if (!nextIncompleteSet || !scrollRef.current) return;
    const ownerExercise = sessionData.find((item) =>
      item.sets.some((s) => s.id === nextIncompleteSet.id)
    );
    if (!ownerExercise) return;
    const exerciseY = exerciseCardPositionsRef.current[ownerExercise.exercise.id] ?? 0;
    const setRelativeY = setCardRelativePositionsRef.current[nextIncompleteSet.id];
    if (typeof setRelativeY !== 'number') return;
    scrollRef.current.scrollTo({
      y: Math.max(exerciseY + setRelativeY - NEXT_SET_SCROLL_OFFSET, 0),
      animated: true,
    });
  }, [nextIncompleteSet, sessionData]);

  // ── Payload builder ───────────────────────────────────────────────────────────

  const buildSetPayload = useCallback(
    (setId: number, isCompleted: 0 | 1) => {
      const form = setForms[setId];
      return {
        actual_weight_kg: parseNullableNumber(form?.actual_weight_kg ?? ''),
        actual_reps: parseNullableNumber(form?.actual_reps ?? ''),
        actual_effort_type: (form?.actual_effort_type as EffortType | '') || null,
        actual_buffer_value: null,
        actual_rir: null,
        actual_notes: form?.actual_notes?.trim() || null,
        is_completed: isCompleted,
      };
    }, [setForms]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const updateSetField = useCallback(
    (setId: number, field: keyof SetFormState, value: string) => {
      setSetForms((prev) => ({
        ...prev,
        [setId]: { ...prev[setId], [field]: value },
      }));
    }, []
  );

  const handleSaveSet = useCallback(
    async (set: WorkoutSessionSet) => {
      if (!setForms[set.id]) return;
      try {
        setSavingSetId(set.id);
        await updateWorkoutSessionSet(set.id, buildSetPayload(set.id, 1));
        if (set.target_rest_seconds && set.target_rest_seconds > 0) {
          const ownerItem = sessionData.find((item) =>
            item.sets.some((s) => s.id === set.id)
          );
          const exerciseName = ownerItem?.exercise.exercise_name ?? '';
          const setIndex = ownerItem?.sets.findIndex((s) => s.id === set.id) ?? 0;
          const setLabel = `Serie ${setIndex + 1} · ${formatSetType(set)}`;
          startTimer(set.target_rest_seconds, exerciseName, setLabel);
        }
        await loadSessionData();
        scrollToTop();
      } catch {
        Alert.alert('Errore', 'Impossibile salvare la serie.');
      } finally {
        setSavingSetId(null);
      }
    },
    [setForms, buildSetPayload, loadSessionData, scrollToTop, sessionData, startTimer]
  );

  const handleUncheckSet = useCallback(
    async (set: WorkoutSessionSet) => {
      try {
        setSavingSetId(set.id);
        await updateWorkoutSessionSet(set.id, buildSetPayload(set.id, 0));
        await loadSessionData();
        scrollToTop();
      } catch {
        Alert.alert('Errore', 'Impossibile aggiornare la serie.');
      } finally {
        setSavingSetId(null);
      }
    },
    [buildSetPayload, loadSessionData, scrollToTop]
  );

  const handleCompleteSession = useCallback(async () => {
    if (!session) return;
    const proceed = async () => {
      try {
        setFinishingSession(true);
        await completeWorkoutSession(session.id);
        router.back();
      } catch {
        Alert.alert('Errore', 'Impossibile completare la sessione.');
      } finally {
        setFinishingSession(false);
      }
    };
    if (remainingSetsCount > 0) {
      Alert.alert(
        'Serie non completate',
        `Ci sono ancora ${remainingSetsCount} serie da eseguire. Vuoi chiudere comunque l'allenamento?`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Conferma', onPress: proceed },
        ]
      );
      return;
    }
    await proceed();
  }, [session, remainingSetsCount, router]);

  const handleCancelSession = () => {
    Alert.alert(
      'Annulla allenamento',
      'Vuoi annullare questo allenamento? I dati inseriti andranno persi.',
      [
        { text: 'Continua ad allenarti', style: 'cancel' },
        {
          text: 'Annulla allenamento',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelWorkoutSession(sessionId);
              router.back();
            } catch {
              Alert.alert('Errore', 'Impossibile annullare la sessione.');
            }
          },
        },
      ]
    );
  };


  const handleAddFreeExercise = useCallback(
    async (exercise: Exercise) => {
      if (!session) return;
      try {
        setAddingExercise(true);
        const sessionExerciseId = await addExerciseToSession(
          session.id,
          exercise.id,
          exercise.name,
          exercise.category
        );
        await addEmptySetToSessionExercise(sessionExerciseId);
        await loadSessionData();
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 300);
      } catch {
        Alert.alert('Errore', 'Impossibile aggiungere l\'esercizio alla sessione.');
      } finally {
        setAddingExercise(false);
      }
    },
    [session, loadSessionData]
  );

  const handleRemoveExercise = useCallback(
    (exercise: WorkoutSessionExercise) => {
      const completedCount = sessionData
        .find((item) => item.exercise.id === exercise.id)
        ?.sets.filter((s) => s.is_completed === 1).length ?? 0;

      const message = completedCount > 0
        ? `Hai già completato ${completedCount} serie di "${exercise.exercise_name}". Rimuovendolo perderai i dati registrati. Continuare?`
        : `Vuoi rimuovere "${exercise.exercise_name}" da questa sessione?`;

      Alert.alert('Rimuovi esercizio', message, [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeExerciseFromSession(exercise.id);
              await loadSessionData();
            } catch {
              Alert.alert('Errore', 'Impossibile rimuovere l\'esercizio.');
            }
          },
        },
      ]);
    },
    [sessionData, loadSessionData]
  );

  const handleAddSet = useCallback(
    async (sessionExerciseId: number) => {
      try {
        setAddingSetForExercise((prev) => ({ ...prev, [sessionExerciseId]: true }));
        await addEmptySetToSessionExercise(sessionExerciseId);
        await loadSessionData();
      } catch {
        Alert.alert('Errore', 'Impossibile aggiungere la serie.');
      } finally {
        setAddingSetForExercise((prev) => ({ ...prev, [sessionExerciseId]: false }));
      }
    },
    [loadSessionData]
  );

  const handleRemoveSet = useCallback(
    (set: WorkoutSessionSet, exerciseName: string) => {
      const message = set.is_completed === 1
        ? `La serie è già stata completata. Rimuovendola perderai i dati registrati. Continuare?`
        : `Vuoi rimuovere questa serie da "${exerciseName}"?`;

      Alert.alert('Rimuovi serie', message, [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSetFromSessionExercise(set.id);
              await loadSessionData();
            } catch {
              Alert.alert('Errore', 'Impossibile rimuovere la serie.');
            }
          },
        },
      ]);
    },
    [loadSessionData]
  );

  // ── Guards ────────────────────────────────────────────────────────────────────

  if (!sessionId || Number.isNaN(sessionId)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>ID sessione non valido.</Text>
          <BackButton onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Sessione non trovata.</Text>
          <BackButton onPress={() => router.back()} label="Torna a Oggi" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <BackButton onPress={() => router.back()} />
        </View>

        <Text style={styles.pageTitle}>{session.name}</Text>
        <Text style={styles.pageSubtitle}>
          Sessione attiva. Inserisci i dati reali e completa le serie durante l’allenamento.
        </Text>

        <RestTimerBanner />

        {/* Progress card */}
        <View style={styles.progressCard}>
          <Text style={styles.cardTitle}>Stato</Text>
          <View style={styles.progressBarTrack}>
            <View style={[
              styles.progressBarFill,
              { width: `${progressPercent * 100}%` as any },
              progressPercent === 1 && styles.progressBarFillComplete,
            ]} />
          </View>
          <Text style={styles.progressLabel}>
            {completedSetsCount} / {totalSetsCount} serie completate
          </Text>

          {nextIncompleteSet ? (
            <TouchableOpacity
              style={styles.nextSetButton}
              activeOpacity={0.9}
              onPress={scrollToNextIncompleteSet}
            >
              <Text style={styles.nextSetButtonText}>Prossima serie</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.cardText, { color: Colors.dark.success, marginTop: 14 }]}>
              ✓ Tutte le serie completate. Puoi chiudere l’allenamento.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.finishButton, finishingSession && styles.disabledButton]}
            onPress={handleCompleteSession}
            disabled={finishingSession}
            activeOpacity={0.9}
          >
            <Text style={styles.finishButtonText}>
              {finishingSession ? 'Chiusura allenamento...' : 'Completa allenamento'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelSessionBtn}
            onPress={handleCancelSession}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelSessionBtnText}>Annulla allenamento</Text>
          </TouchableOpacity>
        </View>

        {/* Exercise list */}
        {sessionData.map(({ exercise, sets }) => (
          <View
            key={exercise.id}
            onLayout={registerExerciseCardPosition(exercise.id)}
            style={styles.exerciseCard}
          >
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseHeaderText}>
                <Text style={styles.exerciseTitle}>{exercise.exercise_name}</Text>
                <Text style={styles.exerciseSubtitle}>
                  {exercise.category ?? 'Nessuna categoria'}
                  {exercise.template_exercise_id === null && (
                    <Text style={styles.freeExerciseBadge}> · Libero</Text>
                  )}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeExerciseButton}
                onPress={() => handleRemoveExercise(exercise)}
                activeOpacity={0.8}
              >
                <Text style={styles.removeExerciseButtonText}>Rimuovi</Text>
              </TouchableOpacity>
            </View>

            {exercise.notes ? (
              <View style={styles.exerciseNoteBox}>
                <Text style={styles.noteLabel}>Note esercizio</Text>
                <Text style={styles.noteText}>{exercise.notes}</Text>
              </View>
            ) : null}

            <View style={styles.exerciseSetsList}>
              {sets.map((set, index) => {
                const form: SetFormState = setForms[set.id] ?? {
                  actual_weight_kg: '',
                  actual_reps: '',
                  actual_notes: '',
                  actual_effort_type: (set.target_effort_type as EffortType) ?? 'none',
                };
                const isCompleted = set.is_completed === 1;
                const isNextIncomplete = nextIncompleteSet?.id === set.id && !isCompleted;

                return (
                  <SetCard
                    key={set.id}
                    set={set}
                    index={index}
                    form={form}
                    isCompleted={isCompleted}
                    isNextIncomplete={isNextIncomplete}
                    isSaving={savingSetId === set.id}
                    unit={preferences.unit}
                    onLayout={registerSetCardPosition(set.id)}
                    onFieldChange={(field, value) => updateSetField(set.id, field, value)}
                    onSave={() => handleSaveSet(set)}
                    onUncheck={() => handleUncheckSet(set)}
                    onRemove={() => handleRemoveSet(set, exercise.exercise_name)}
                  />
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.addSetButton, addingSetForExercise[exercise.id] && styles.disabledButton]}
              onPress={() => handleAddSet(exercise.id)}
              disabled={!!addingSetForExercise[exercise.id]}
              activeOpacity={0.85}
            >
              <Text style={styles.addSetButtonText}>
                {addingSetForExercise[exercise.id] ? 'Aggiunta...' : '+ Serie'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Bottone aggiungi esercizio libero */}
        <TouchableOpacity
          style={[styles.addExerciseButton, addingExercise && styles.disabledButton]}
          onPress={() => setShowAddExerciseModal(true)}
          disabled={addingExercise}
          activeOpacity={0.85}
        >
          <Text style={styles.addExerciseButtonText}>
            {addingExercise ? 'Aggiunta...' : '+ Aggiungi esercizio'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <AddExerciseModal
        visible={showAddExerciseModal}
        onClose={() => setShowAddExerciseModal(false)}
        onSelect={handleAddFreeExercise}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.dark.background },
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  loadingContainer: { flex: 1, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { color: Colors.dark.danger, fontSize: 16, fontWeight: '600' },
  topBar: { marginBottom: 12 },
  topBackButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  topBackButtonText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text },
  pageSubtitle: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted, marginBottom: 12 },
  progressCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', marginBottom: 14 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, marginBottom: 10 },
  cardText: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  progressBarTrack: { height: 6, backgroundColor: '#2a2a35', borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 6 },
  progressBarFillComplete: { backgroundColor: Colors.dark.success },
  progressLabel: { fontSize: 13, color: Colors.dark.textMuted, marginBottom: 14 },
  nextSetButton: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  nextSetButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  exerciseCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border, marginTop: 12 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  exerciseHeaderText: { flex: 1 },
  exerciseTitle: { color: Colors.dark.text, fontSize: 20, fontWeight: '800' },
  exerciseSubtitle: { color: Colors.dark.textMuted, fontSize: 14, marginTop: 4 },
  freeExerciseBadge: { color: PRIMARY, fontWeight: '700' },
  removeExerciseButton: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.danger, paddingHorizontal: 10, paddingVertical: 6 },
  removeExerciseButtonText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '700' },
  exerciseNoteBox: { backgroundColor: '#1a1a21', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 14 },
  exerciseSetsList: { gap: 14 },
  setCard: { backgroundColor: '#141419', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.dark.border },
  setCardCompleted: { borderColor: PRIMARY },
  setCardNext: { borderColor: 'rgba(126,71,255,0.7)', shadowColor: PRIMARY, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  setHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700', flex: 1 },
  removeSetButton: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.danger, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeSetButtonText: { color: Colors.dark.danger, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  statusPill: { backgroundColor: '#24242b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillActive: { backgroundColor: 'rgba(126,71,255,0.18)' },
  statusPillText: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '700' },
  statusPillTextActive: { color: PRIMARY },
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  targetBox: { width: '48%', backgroundColor: '#1a1a21', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.border },
  targetLabel: { color: Colors.dark.textMuted, fontSize: 12, marginBottom: 6 },
  targetValue: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' },
  inlineNoteBox: { backgroundColor: '#1a1a21', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  noteLabel: { color: Colors.dark.textMuted, fontSize: 12, marginBottom: 6 },
  noteText: { color: Colors.dark.text, fontSize: 14, lineHeight: 20 },
  inputsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  inputGroup: { flex: 1, gap: 6, marginBottom: 12 },
  inputLabel: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#101015', borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border, color: Colors.dark.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  notesInput: { minHeight: 92, textAlignVertical: 'top' },
  effortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effortChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#16161d', borderWidth: 1, borderColor: Colors.dark.border },
  effortChipSelected: { backgroundColor: 'rgba(126,71,255,0.18)', borderColor: PRIMARY },
  effortChipText: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '700' },
  effortChipTextSelected: { color: PRIMARY },
  setActions: { gap: 10, marginTop: 2 },
  primaryButton: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { backgroundColor: 'transparent', borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.border, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' },
  cancelSessionBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  cancelSessionBtnText: {
    color: Colors.dark.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  finishButton: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 12 },
  finishButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
  addExerciseButton: { marginTop: 16, backgroundColor: Colors.dark.surface, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  addExerciseButtonText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  addSetButton: { marginTop: 12, backgroundColor: 'rgba(126,71,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  addSetButtonText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
});