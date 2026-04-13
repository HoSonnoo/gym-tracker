import { Colors } from '@/constants/Colors';
import { useRestTimer } from '@/context/RestTimerContext';
import { formatWeight, useUserPreferences } from '@/context/UserPreferencesContext';
import {
  addEmptySetToSessionExercise,
  addExerciseToSession,
  cancelWorkoutSession,
  clearSessionSuperset,
  completeWorkoutSession,
  getExercises,
  getLastSessionSetsForExercise,
  getWorkoutSessionById,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  removeExerciseFromSession,
  removeSetFromSessionExercise,
  reorderSessionExercises,
  setSessionSuperset,
  updateSessionRatingAndNotes,
  updateWorkoutSessionSet,
  type Exercise,
  type LastSessionSet,
  type WorkoutSession,
  type WorkoutSessionDetail,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
} from '@/database';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

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
  actual_buffer_value: string;
};

type SessionExerciseWithSets = {
  exercise: WorkoutSessionExercise;
  sets: WorkoutSessionSet[];
};

type RenderGroup =
  | { type: 'single'; item: SessionExerciseWithSets }
  | { type: 'superset'; groupId: number; items: SessionExerciseWithSets[] };

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
    actual_buffer_value: set.actual_buffer_value !== null ? String(set.actual_buffer_value) : '',
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
            <ActivityIndicator size="large" color={Colors.dark.primary} />
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

// ─── Rest Timer Picker Modal ──────────────────────────────────────────────────

const DRUM_ITEM_H = 44;

function DrumColumn({
  count,
  value,
  label,
  onChange,
}: {
  count: number;
  value: number;
  label: string;
  onChange: (v: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const items = Array.from({ length: count }, (_, i) => i);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: value * DRUM_ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={drumStyles.column}>
      <Text style={drumStyles.columnLabel}>{label}</Text>
      <View style={drumStyles.columnWindow}>
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={DRUM_ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.y / DRUM_ITEM_H);
            onChange(Math.max(0, Math.min(idx, count - 1)));
          }}
          contentContainerStyle={{ paddingVertical: DRUM_ITEM_H }}
        >
          {items.map((n) => (
            <View key={n} style={drumStyles.item}>
              <Text style={drumStyles.itemText}>{String(n).padStart(2, '0')}</Text>
            </View>
          ))}
        </ScrollView>
        <View pointerEvents="none" style={drumStyles.selectionTop} />
        <View pointerEvents="none" style={drumStyles.selectionBottom} />
      </View>
    </View>
  );
}

type RestTimerPickerModalProps = {
  visible: boolean;
  selectedSeconds: number;
  onSelect: (seconds: number) => void;
  onConfirm: () => void;
  onSkip: () => void;
};

function RestTimerPickerModal({
  visible,
  selectedSeconds,
  onSelect,
  onConfirm,
  onSkip,
}: RestTimerPickerModalProps) {
  const [h, setH] = useState(Math.floor(selectedSeconds / 3600));
  const [m, setM] = useState(Math.floor((selectedSeconds % 3600) / 60));
  const [s, setS] = useState(selectedSeconds % 60);

  useEffect(() => {
    if (visible) {
      setH(Math.floor(selectedSeconds / 3600));
      setM(Math.floor((selectedSeconds % 3600) / 60));
      setS(selectedSeconds % 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleH = (v: number) => { setH(v); onSelect(v * 3600 + m * 60 + s); };
  const handleM = (v: number) => { setM(v); onSelect(h * 3600 + v * 60 + s); };
  const handleS = (v: number) => { setS(v); onSelect(h * 3600 + m * 60 + v); };

  const total = h * 3600 + m * 60 + s;
  const label = h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
    : m > 0
    ? `${m}:${String(s).padStart(2, '0')}`
    : `${s}s`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onSkip}
    >
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />

          <Text style={pickerStyles.title}>Imposta recupero</Text>
          <Text style={pickerStyles.subtitle}>
            Questa serie non ha un recupero configurato.{'\n'}Quanto vuoi riposare?
          </Text>

          <View style={pickerStyles.drumRow}>
            <DrumColumn key={visible ? 'h-open' : 'h-closed'} count={24} value={h} label="ore" onChange={handleH} />
            <Text style={pickerStyles.drumSep}>:</Text>
            <DrumColumn key={visible ? 'm-open' : 'm-closed'} count={60} value={m} label="min" onChange={handleM} />
            <Text style={pickerStyles.drumSep}>:</Text>
            <DrumColumn key={visible ? 's-open' : 's-closed'} count={60} value={s} label="sec" onChange={handleS} />
          </View>

          <TouchableOpacity
            style={[pickerStyles.confirmButton, total === 0 && pickerStyles.confirmButtonDisabled]}
            onPress={total > 0 ? onConfirm : undefined}
            activeOpacity={0.85}
          >
            <Text style={pickerStyles.confirmButtonText}>
              {total > 0 ? `▶  Avvia timer · ${label}` : 'Seleziona una durata'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={pickerStyles.skipButton}
            onPress={onSkip}
            activeOpacity={0.8}
          >
            <Text style={pickerStyles.skipButtonText}>Salta recupero</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderColor: Colors.dark.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  drumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  drumSep: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    marginHorizontal: 4,
    marginTop: 18,
  },
  confirmButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.dark.surfaceSoft,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
});

const drumStyles = StyleSheet.create({
  column: {
    alignItems: 'center',
    flex: 1,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  columnWindow: {
    height: 44 * 3,
    overflow: 'hidden',
    position: 'relative',
  },
  item: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  selectionTop: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  selectionBottom: {
    position: 'absolute',
    top: 44 * 2,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
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
  setViewRef: (ref: View | null) => void;
  lastSet: LastSessionSet | null;
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
  setViewRef,
  lastSet,
  onFieldChange,
  onSave,
  onUncheck,
  onRemove,
}: SetCardProps) {
  const isHighlighted = isCompleted || isNextIncomplete;
  const statusLabel = isCompleted ? 'Completata' : isNextIncomplete ? 'Prossima' : 'Da fare';

  return (
    <View
      ref={setViewRef}
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

      {lastSet && (
        <View style={styles.lastSessionRow}>
          <Text style={styles.lastSessionLabel}>Ultima volta</Text>
          <Text style={styles.lastSessionValue}>
            {lastSet.actual_weight_kg != null ? `${lastSet.actual_weight_kg} ${unit}` : '—'}
            {' × '}
            {lastSet.actual_reps != null ? `${lastSet.actual_reps} rep` : '—'}
            {lastSet.actual_effort_type && lastSet.actual_effort_type !== 'none'
              ? ` · ${formatEffortType(lastSet.actual_effort_type)}${lastSet.actual_effort_type === 'buffer' && lastSet.actual_buffer_value != null ? `: ${lastSet.actual_buffer_value}` : ''}`
              : ''}
          </Text>
        </View>
      )}

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
        {form.actual_effort_type === 'buffer' && (
          <TextInput
            value={form.actual_buffer_value}
            onChangeText={(v) => onFieldChange('actual_buffer_value', v)}
            placeholder="Valore buffer (es. 2)"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="number-pad"
            style={[styles.input, { marginTop: 10 }]}
          />
        )}
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

// ─── Exercise Card ────────────────────────────────────────────────────────────

type ExerciseCardProps = {
  exercise: WorkoutSessionExercise;
  sets: WorkoutSessionSet[];
  isInSuperset: boolean;
  showDivider: boolean;
  isCollapsed: boolean;
  lastSets: LastSessionSet[];
  setForms: Record<number, SetFormState>;
  nextIncompleteSetId: number | null;
  savingSetId: number | null;
  addingSet: boolean;
  unit: 'kg' | 'lbs';
  setCardRefsMap: React.MutableRefObject<Record<number, View | null>>;
  onToggleCollapse: () => void;
  onClearSuperset: () => void;
  onPairSuperset: () => void;
  onRemoveExercise: () => void;
  onFieldChange: (setId: number, field: keyof SetFormState, value: string) => void;
  onSaveSet: (set: WorkoutSessionSet) => void;
  onUncheckSet: (set: WorkoutSessionSet) => void;
  onRemoveSet: (set: WorkoutSessionSet) => void;
  onAddSet: () => void;
};

function ExerciseCard({
  exercise,
  sets,
  isInSuperset,
  showDivider,
  isCollapsed,
  lastSets,
  setForms,
  nextIncompleteSetId,
  savingSetId,
  addingSet,
  unit,
  setCardRefsMap,
  onToggleCollapse,
  onClearSuperset,
  onPairSuperset,
  onRemoveExercise,
  onFieldChange,
  onSaveSet,
  onUncheckSet,
  onRemoveSet,
  onAddSet,
}: ExerciseCardProps) {
  const isInSupersetGroup = exercise.superset_group_id !== null;
  const completedCount = sets.filter((s) => s.is_completed === 1).length;

  return (
    <View>
      <View style={[styles.exerciseCard, isInSuperset && styles.exerciseCardInSuperset]}>
        {/* Header — sempre visibile, tocco per collassare */}
        <TouchableOpacity
          style={styles.exerciseHeader}
          onPress={onToggleCollapse}
          activeOpacity={0.8}
        >
          <View style={styles.exerciseHeaderText}>
            <View style={styles.exerciseTitleRow}>
              <Text style={styles.exerciseTitle}>{exercise.exercise_name}</Text>
              {isInSupersetGroup && (
                <View style={styles.ssBadgeSession}>
                  <Text style={styles.ssBadgeSessionText}>SS</Text>
                </View>
              )}
            </View>
            <Text style={styles.exerciseSubtitle}>
              {exercise.category ?? 'Nessuna categoria'}
              {exercise.template_exercise_id === null && (
                <Text style={styles.freeExerciseBadge}> · Libero</Text>
              )}
            </Text>
          </View>
          <View style={styles.exerciseHeaderActions}>
            {isInSupersetGroup ? (
              <TouchableOpacity
                style={styles.ssClearButton}
                onPress={(e) => { e.stopPropagation?.(); onClearSuperset(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.ssClearButtonText}>Rimuovi SS</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.ssPairButton}
                onPress={(e) => { e.stopPropagation?.(); onPairSuperset(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.ssPairButtonText}>Abbina SS</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.removeExerciseButton}
              onPress={(e) => { e.stopPropagation?.(); onRemoveExercise(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.removeExerciseButtonText}>Rimuovi</Text>
            </TouchableOpacity>
            <Text style={styles.collapseChevron}>{isCollapsed ? '▶' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {/* Riepilogo collassato */}
        {isCollapsed ? (
          <View style={styles.collapsedSummary}>
            <Text style={styles.collapsedSummaryText}>
              {completedCount}/{sets.length} serie completate
            </Text>
            {lastSets.length > 0 && (
              <Text style={styles.collapsedLastSession}>
                Ultima volta: {lastSets.map((s) =>
                  `${s.actual_weight_kg ?? '—'} × ${s.actual_reps ?? '—'}`
                ).join(' · ')}
              </Text>
            )}
          </View>
        ) : (
          <>
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
                const isNextIncomplete = nextIncompleteSetId === set.id && !isCompleted;
                return (
                  <SetCard
                    key={set.id}
                    set={set}
                    index={index}
                    form={form}
                    isCompleted={isCompleted}
                    isNextIncomplete={isNextIncomplete}
                    isSaving={savingSetId === set.id}
                    unit={unit}
                    setViewRef={(ref) => { setCardRefsMap.current[set.id] = ref; }}
                    lastSet={lastSets[index] ?? null}
                    onFieldChange={(field, value) => onFieldChange(set.id, field, value)}
                    onSave={() => onSaveSet(set)}
                    onUncheck={() => onUncheckSet(set)}
                    onRemove={() => onRemoveSet(set)}
                  />
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.addSetButton, addingSet && styles.disabledButton]}
              onPress={onAddSet}
              disabled={addingSet}
              activeOpacity={0.85}
            >
              <Text style={styles.addSetButtonText}>
                {addingSet ? 'Aggiunta...' : '+ Serie'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {showDivider && (
        <View style={styles.supersetDivider}>
          <View style={styles.supersetDividerLine} />
          <Text style={styles.supersetDividerText}>poi</Text>
          <View style={styles.supersetDividerLine} />
        </View>
      )}
    </View>
  );
}

// ─── Draggable Session Row ────────────────────────────────────────────────────

type DraggableSessionRowProps = {
  exercise: WorkoutSessionExercise;
  index: number;
  total: number;
  itemHeightRef: React.MutableRefObject<number>;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onLayout?: (e: any) => void;
};

function DraggableSessionRow({
  exercise,
  index,
  total,
  itemHeightRef,
  onDragStart,
  onDragEnd,
  onLayout,
}: DraggableSessionRowProps) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isActive = useSharedValue(false);
  const toIndexRef = useRef(index);

  const pan = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      isActive.value = true;
      scale.value = withSpring(1.03, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(0.9, { duration: 150 });
      zIndex.value = 999;
      runOnJS(onDragStart)(index);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      const rawOffset = Math.round(e.translationY / itemHeightRef.current);
      const clamped = Math.max(-index, Math.min(total - 1 - index, rawOffset));
      toIndexRef.current = index + clamped;
    })
    .onEnd(() => {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      scale.value = withSpring(1, { damping: 20 });
      opacity.value = withTiming(1, { duration: 150 });
      zIndex.value = 0;
      isActive.value = false;
      runOnJS(onDragEnd)(index, toIndexRef.current);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onFinalize(() => {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      scale.value = withSpring(1);
      opacity.value = withTiming(1);
      zIndex.value = 0;
      isActive.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    zIndex: zIndex.value,
    opacity: opacity.value,
    shadowOpacity: isActive.value ? 0.3 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[sessionDragStyles.row, animatedStyle]}
        onLayout={onLayout}
      >
        <View style={sessionDragStyles.handleCol}>
          <View style={sessionDragStyles.handleIcon}>
            <Text style={sessionDragStyles.handleDots}>⠿</Text>
          </View>
          <View style={sessionDragStyles.orderBadge}>
            <Text style={sessionDragStyles.orderText}>{index + 1}</Text>
          </View>
        </View>
        <View style={sessionDragStyles.infoCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={sessionDragStyles.exerciseName}>{exercise.exercise_name}</Text>
            {exercise.superset_group_id !== null && (
              <View style={sessionDragStyles.ssBadge}>
                <Text style={sessionDragStyles.ssBadgeText}>SS</Text>
              </View>
            )}
          </View>
          <Text style={sessionDragStyles.exerciseCategory}>
            {exercise.category ?? 'Nessuna categoria'}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const sessionDragStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
    marginBottom: 10,
    minHeight: 64,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 0,
  },
  handleCol: { width: 30, alignItems: 'center', justifyContent: 'center', gap: 5 },
  handleIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.dark.surfaceSoft, borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  handleDots: { fontSize: 22, color: Colors.dark.textMuted, lineHeight: 28 },
  orderBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(126,71,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 11, fontWeight: '800', color: Colors.dark.primary },
  infoCol: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '700', color: Colors.dark.text },
  exerciseCategory: { fontSize: 13, color: Colors.dark.textMuted, marginTop: 2 },
  ssBadge: { backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 6, borderWidth: 1, borderColor: Colors.dark.warning, paddingHorizontal: 6, paddingVertical: 2 },
  ssBadgeText: { color: Colors.dark.warning, fontSize: 11, fontWeight: '800' },
});

// ─── Session Summary Modal ────────────────────────────────────────────────────

function formatDuration(startedAt: string, completedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const totalSeconds = Math.floor((end - start) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

const RATING_OPTIONS = [
  { value: 1, emoji: '😓', label: 'Duro' },
  { value: 2, emoji: '😕', label: 'Faticoso' },
  { value: 3, emoji: '😐', label: 'Normale' },
  { value: 4, emoji: '💪', label: 'Buono' },
  { value: 5, emoji: '🔥', label: 'Ottimo' },
];

type SummaryModalProps = {
  data: WorkoutSessionDetail;
  unit: 'kg' | 'lbs';
  onSaveAndClose: (rating: number | null, notes: string) => void;
};

function SummaryModal({ data, unit, onSaveAndClose }: SummaryModalProps) {
  const { session, exercises } = data;
  const [rating, setRating] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState('');

  const allCompletedSets = exercises.flatMap((e) =>
    e.sets.filter((s) => s.is_completed === 1)
  );
  const totalVolume = allCompletedSets.reduce((sum, s) => {
    if (s.actual_weight_kg != null && s.actual_reps != null) {
      return sum + s.actual_weight_kg * s.actual_reps;
    }
    return sum;
  }, 0);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onSaveAndClose(rating, notes)}>
      <View style={summaryStyles.container}>
        <View style={summaryStyles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={summaryStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={summaryStyles.title}>Allenamento completato 💪</Text>
          <Text style={summaryStyles.sessionName}>{session.name}</Text>

          {/* Statistiche rapide */}
          <View style={summaryStyles.statsRow}>
            <View style={summaryStyles.statBox}>
              <Text style={summaryStyles.statValue}>
                {formatDuration(session.started_at, session.completed_at)}
              </Text>
              <Text style={summaryStyles.statLabel}>Durata</Text>
            </View>
            <View style={summaryStyles.statBox}>
              <Text style={summaryStyles.statValue}>{allCompletedSets.length}</Text>
              <Text style={summaryStyles.statLabel}>Serie</Text>
            </View>
            <View style={summaryStyles.statBox}>
              <Text style={summaryStyles.statValue}>
                {totalVolume > 0 ? `${Math.round(totalVolume).toLocaleString()} ${unit}` : '—'}
              </Text>
              <Text style={summaryStyles.statLabel}>Volume</Text>
            </View>
          </View>

          {/* Rating */}
          <View style={summaryStyles.ratingSection}>
            <Text style={summaryStyles.ratingTitle}>Com'è andata?</Text>
            <View style={summaryStyles.ratingRow}>
              {RATING_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[summaryStyles.ratingBtn, rating === opt.value && summaryStyles.ratingBtnActive]}
                  onPress={() => setRating(rating === opt.value ? null : opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={summaryStyles.ratingEmoji}>{opt.emoji}</Text>
                  <Text style={[summaryStyles.ratingLabel, rating === opt.value && summaryStyles.ratingLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Note */}
          <View style={summaryStyles.notesSection}>
            <Text style={summaryStyles.ratingTitle}>Note sessione</Text>
            <TextInput
              style={summaryStyles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Come ti sei sentito? Cosa hai migliorato?"
              placeholderTextColor={Colors.dark.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Dettaglio esercizi */}
          {exercises.map(({ exercise, sets }) => {
            const completedSets = sets.filter((s) => s.is_completed === 1);
            if (completedSets.length === 0) return null;
            return (
              <View key={exercise.id} style={summaryStyles.exerciseBlock}>
                <Text style={summaryStyles.exerciseName}>{exercise.exercise_name}</Text>
                <Text style={summaryStyles.exerciseCategory}>
                  {exercise.category ?? 'Nessuna categoria'}
                </Text>
                {completedSets.map((s, i) => {
                  const effortLabel = s.actual_effort_type && s.actual_effort_type !== 'none'
                    ? ` · ${formatEffortType(s.actual_effort_type)}${s.actual_effort_type === 'buffer' && s.actual_buffer_value != null ? `: ${s.actual_buffer_value}` : ''}`
                    : '';
                  return (
                    <View key={s.id} style={summaryStyles.setRow}>
                      <Text style={summaryStyles.setIndex}>S{i + 1}</Text>
                      <Text style={summaryStyles.setDetail}>
                        {s.actual_weight_kg != null ? formatWeight(s.actual_weight_kg, unit) : '—'}
                        {' × '}
                        {s.actual_reps != null ? `${s.actual_reps} rep` : '—'}
                        {effortLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={summaryStyles.closeButton} onPress={onClose} activeOpacity={0.9}>
          <Text style={summaryStyles.closeButtonText}>Torna alla home</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const summaryStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, paddingHorizontal: 20, paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.dark.border, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  content: { paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.dark.text, marginBottom: 4 },
  sessionName: { fontSize: 16, color: Colors.dark.textMuted, fontWeight: '600', marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.dark.border },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.dark.primary },
  statLabel: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: '600' },
  exerciseBlock: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  exerciseName: { fontSize: 17, fontWeight: '800', color: Colors.dark.text, marginBottom: 2 },
  exerciseCategory: { fontSize: 13, color: Colors.dark.textMuted, marginBottom: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.dark.border },
  setIndex: { fontSize: 12, fontWeight: '800', color: Colors.dark.primary, width: 24 },
  setDetail: { fontSize: 14, color: Colors.dark.text, fontWeight: '600', flex: 1 },
  closeButton: { backgroundColor: Colors.dark.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── Rest Timer Banner ────────────────────────────────────────────────────────

function RestTimerBanner() {
  const { timer, stopTimer } = useRestTimer();
  if (!timer.isActive && timer.remainingSeconds === 0) return null;

  const progress = timer.durationSeconds > 0
    ? timer.remainingSeconds / timer.durationSeconds
    : 0;
  const isExpired = !timer.isActive && timer.remainingSeconds === 0 && timer.durationSeconds > 0;
  const accentColor = isExpired ? Colors.dark.success : Colors.dark.primary;

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
  const setCardRefsMap = useRef<Record<number, View | null>>({});
  const scrollYRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sessionData, setSessionData] = useState<SessionExerciseWithSets[]>([]);
  const [setForms, setSetForms] = useState<Record<number, SetFormState>>({});
  const [savingSetId, setSavingSetId] = useState<number | null>(null);
  const [finishingSession, setFinishingSession] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [addingSetForExercise, setAddingSetForExercise] = useState<Record<number, boolean>>({});
  const [pendingTimerSet, setPendingTimerSet] = useState<WorkoutSessionSet | null>(null);
  const [pickerRestSeconds, setPickerRestSeconds] = useState(60);
  const [sessionSupersetTarget, setSessionSupersetTarget] = useState<WorkoutSessionExercise | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [lastSessionSetsMap, setLastSessionSetsMap] = useState<Record<string, LastSessionSet[]>>({});
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());
  const [summaryData, setSummaryData] = useState<WorkoutSessionDetail | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const reorderItemHeightRef = useRef<number>(64);

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

      // Carica "ultima volta" per ogni esercizio (in parallelo, senza bloccare)
      const lastSetsEntries = await Promise.all(
        exercisesWithSets.map(async ({ exercise }) => {
          const sets = await getLastSessionSetsForExercise(exercise.exercise_name, sessionFromDb.id);
          return [exercise.exercise_name, sets] as [string, LastSessionSet[]];
        })
      );
      setLastSessionSetsMap(Object.fromEntries(lastSetsEntries));
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

  const renderGroups = useMemo((): RenderGroup[] => {
    const groups: RenderGroup[] = [];
    const seen = new Set<number>();
    for (const item of sessionData) {
      const gid = item.exercise.superset_group_id;
      if (gid === null) {
        groups.push({ type: 'single', item });
      } else if (!seen.has(gid)) {
        seen.add(gid);
        const paired = sessionData.filter((d) => d.exercise.superset_group_id === gid);
        groups.push({ type: 'superset', groupId: gid, items: paired });
      }
    }
    return groups;
  }, [sessionData]);

  const reorderItems = useMemo(
    () =>
      [...sessionData]
        .sort((a, b) => a.exercise.exercise_order - b.exercise.exercise_order)
        .map((d) => d.exercise),
    [sessionData]
  );

  // ── Scroll ────────────────────────────────────────────────────────────────────

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const scrollToNextIncompleteSet = useCallback(() => {
    if (!nextIncompleteSet || !scrollRef.current) return;
    const setCardView = setCardRefsMap.current[nextIncompleteSet.id];
    if (!setCardView) return;
    setCardView.measure((_x, _y, _w, _h, _pageX, pageY) => {
      scrollRef.current?.measure((_sx, _sy, _sw, _sh, _spx, spy) => {
        const targetY = pageY - spy + scrollYRef.current - NEXT_SET_SCROLL_OFFSET;
        scrollRef.current?.scrollTo({ y: Math.max(targetY, 0), animated: true });
      });
    });
  }, [nextIncompleteSet]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollYRef.current = y;
    setShowScrollTop(y > 200);
  }, []);

  // ── Payload builder ───────────────────────────────────────────────────────────

  const buildSetPayload = useCallback(
    (setId: number, isCompleted: 0 | 1) => {
      const form = setForms[setId];
      return {
        actual_weight_kg: parseNullableNumber(form?.actual_weight_kg ?? ''),
        actual_reps: parseNullableNumber(form?.actual_reps ?? ''),
        actual_effort_type: (form?.actual_effort_type as EffortType | '') || null,
        actual_buffer_value: form?.actual_effort_type === 'buffer'
          ? parseNullableNumber(form?.actual_buffer_value ?? '')
          : null,
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
        } else {
          setPendingTimerSet(set);
          setPickerRestSeconds(60);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const handleSetSessionSuperset = useCallback(
    async (target: WorkoutSessionExercise, partnerId: number) => {
      try {
        await setSessionSuperset(target.id, partnerId);
        await loadSessionData();
      } catch {
        Alert.alert('Errore', 'Impossibile creare la super serie.');
      }
    },
    [loadSessionData]
  );

  const handleClearSessionSuperset = useCallback(
    (exercise: WorkoutSessionExercise) => {
      Alert.alert(
        'Rimuovi super serie',
        `Vuoi rimuovere l'abbinamento di "${exercise.exercise_name}"?`,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Rimuovi',
            style: 'destructive',
            onPress: async () => {
              try {
                await clearSessionSuperset(exercise.id);
                await loadSessionData();
              } catch {
                Alert.alert('Errore', 'Impossibile rimuovere la super serie.');
              }
            },
          },
        ]
      );
    },
    [loadSessionData]
  );

  const handlePickerConfirm = useCallback(() => {
    if (!pendingTimerSet) return;
    const ownerItem = sessionData.find((item) =>
      item.sets.some((s) => s.id === pendingTimerSet.id)
    );
    const exerciseName = ownerItem?.exercise.exercise_name ?? '';
    const setIndex = ownerItem?.sets.findIndex((s) => s.id === pendingTimerSet.id) ?? 0;
    const setLabel = `Serie ${setIndex + 1} · ${formatSetType(pendingTimerSet)}`;
    startTimer(pickerRestSeconds, exerciseName, setLabel);
    setPendingTimerSet(null);
  }, [pendingTimerSet, sessionData, pickerRestSeconds, startTimer]);

  const handlePickerSkip = useCallback(() => {
    setPendingTimerSet(null);
  }, []);

  const handleUncheckSet = useCallback(
    async (set: WorkoutSessionSet) => {
      try {
        setSavingSetId(set.id);
        await updateWorkoutSessionSet(set.id, buildSetPayload(set.id, 0));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        setSummaryData({ session, exercises: sessionData });
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

  const handleSessionDragEnd = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const newItems = [...reorderItems];
      const [moved] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, moved);
      const reordered = newItems.map((ex, i) => ({ id: ex.id, exercise_order: i }));
      // Aggiorna UI ottimisticamente
      setSessionData((prev) => {
        const orderMap: Record<number, number> = {};
        for (const r of reordered) orderMap[r.id] = r.exercise_order;
        return [...prev]
          .map((item) => ({
            ...item,
            exercise: {
              ...item.exercise,
              exercise_order: orderMap[item.exercise.id] ?? item.exercise.exercise_order,
            },
          }))
          .sort((a, b) => a.exercise.exercise_order - b.exercise.exercise_order);
      });
      try {
        await reorderSessionExercises(reordered);
      } catch {
        Alert.alert('Errore', 'Impossibile riordinare gli esercizi.');
        await loadSessionData();
      }
    },
    [reorderItems, loadSessionData]
  );

  // ── Exercise card helper ─────────────────────────────────────────────────────

  const renderExercise = (
    exercise: WorkoutSessionExercise,
    sets: WorkoutSessionSet[],
    isInSuperset: boolean,
    showDivider: boolean
  ) => (
    <ExerciseCard
      key={exercise.id}
      exercise={exercise}
      sets={sets}
      isInSuperset={isInSuperset}
      showDivider={showDivider}
      isCollapsed={collapsedExercises.has(exercise.id)}
      lastSets={lastSessionSetsMap[exercise.exercise_name] ?? []}
      setForms={setForms}
      nextIncompleteSetId={nextIncompleteSet?.id ?? null}
      savingSetId={savingSetId}
      addingSet={!!addingSetForExercise[exercise.id]}
      unit={preferences.unit}
      setCardRefsMap={setCardRefsMap}
      onToggleCollapse={() => setCollapsedExercises((prev) => {
        const next = new Set(prev);
        if (next.has(exercise.id)) next.delete(exercise.id); else next.add(exercise.id);
        return next;
      })}
      onClearSuperset={() => handleClearSessionSuperset(exercise)}
      onPairSuperset={() => setSessionSupersetTarget(exercise)}
      onRemoveExercise={() => handleRemoveExercise(exercise)}
      onFieldChange={updateSetField}
      onSaveSet={handleSaveSet}
      onUncheckSet={handleUncheckSet}
      onRemoveSet={(set) => handleRemoveSet(set, exercise.exercise_name)}
      onAddSet={() => handleAddSet(exercise.id)}
    />
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
          <ActivityIndicator size="large" color={Colors.dark.primary} />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
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

        {/* Exercise list header */}
        <View style={styles.exerciseSectionHeader}>
          <Text style={styles.exerciseSectionTitle}>Esercizi</Text>
          {sessionData.length > 1 && (
            <TouchableOpacity
              style={[styles.reorderToggleBtn, isReorderMode && styles.reorderToggleBtnActive]}
              onPress={() => setIsReorderMode((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={[styles.reorderToggleBtnText, isReorderMode && styles.reorderToggleBtnTextActive]}>
                {isReorderMode ? 'Fine' : '↕ Riordina'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isReorderMode ? (
          reorderItems.map((exercise, index) => (
            <DraggableSessionRow
              key={exercise.id}
              exercise={exercise}
              index={index}
              total={reorderItems.length}
              itemHeightRef={reorderItemHeightRef}
              onDragStart={() => {}}
              onDragEnd={handleSessionDragEnd}
              onLayout={index === 0
                ? (e: any) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0) reorderItemHeightRef.current = h;
                  }
                : undefined}
            />
          ))
        ) : (
          <>
            {renderGroups.map((group) => {
              if (group.type === 'superset') {
                return (
                  <View key={`ss-${group.groupId}`} style={styles.supersetContainer}>
                    <View style={styles.supersetHeader}>
                      <Text style={styles.supersetLabel}>⚡ SUPER SERIE</Text>
                      <Text style={styles.supersetHint}>Esegui gli esercizi in sequenza, poi riposa</Text>
                    </View>
                    {group.items.map(({ exercise, sets }, ssIdx) =>
                      renderExercise(exercise, sets, true, ssIdx < group.items.length - 1)
                    )}
                  </View>
                );
              }
              const { exercise, sets } = group.item;
              return renderExercise(exercise, sets, false, false);
            })}

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
          </>
        )}
      </ScrollView>

      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopButton}
          onPress={scrollToTop}
          activeOpacity={0.8}
        >
          <Text style={styles.scrollTopButtonIcon}>↑</Text>
        </TouchableOpacity>
      )}

      <AddExerciseModal
        visible={showAddExerciseModal}
        onClose={() => setShowAddExerciseModal(false)}
        onSelect={handleAddFreeExercise}
      />

      <RestTimerPickerModal
        visible={pendingTimerSet !== null}
        selectedSeconds={pickerRestSeconds}
        onSelect={setPickerRestSeconds}
        onConfirm={handlePickerConfirm}
        onSkip={handlePickerSkip}
      />

      {/* Superset picker per la sessione */}
      <Modal
        visible={sessionSupersetTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSessionSupersetTarget(null)}
      >
        <View style={styles.ssOverlay}>
          <View style={styles.ssSheet}>
            <View style={styles.ssSheetHandle} />
            <Text style={styles.ssSheetTitle}>Scegli l'esercizio da abbinare</Text>
            <Text style={styles.ssSheetSubtitle}>
              Seleziona un esercizio per creare una super serie in questa sessione
            </Text>
            {sessionData
              .filter(
                (d) =>
                  d.exercise.id !== sessionSupersetTarget?.id &&
                  d.exercise.superset_group_id === null
              )
              .map(({ exercise }) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.ssExerciseRow}
                  onPress={() => {
                    if (sessionSupersetTarget)
                      handleSetSessionSuperset(sessionSupersetTarget, exercise.id);
                    setSessionSupersetTarget(null);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ssExerciseName}>{exercise.exercise_name}</Text>
                    <Text style={styles.ssExerciseCategory}>
                      {exercise.category ?? 'Nessuna categoria'}
                    </Text>
                  </View>
                  <View style={styles.ssAbbinaBadge}>
                    <Text style={styles.ssAbbinaBadgeText}>Abbina</Text>
                  </View>
                </TouchableOpacity>
              ))}
            {sessionData.filter(
              (d) =>
                d.exercise.id !== sessionSupersetTarget?.id &&
                d.exercise.superset_group_id === null
            ).length === 0 && (
              <View style={styles.ssEmptyBox}>
                <Text style={styles.ssEmptyText}>
                  Nessun esercizio disponibile da abbinare.
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.ssCloseButton}
              onPress={() => setSessionSupersetTarget(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.ssCloseButtonText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {summaryData && (
        <SummaryModal
          data={summaryData}
          unit={preferences.unit}
          onClose={() => router.back()}
        />
      )}
    </SafeAreaView>
    </GestureHandlerRootView>
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
  progressBarFill: { height: '100%', backgroundColor: Colors.dark.primary, borderRadius: 6 },
  progressBarFillComplete: { backgroundColor: Colors.dark.success },
  progressLabel: { fontSize: 13, color: Colors.dark.textMuted, marginBottom: 14 },
  nextSetButton: { backgroundColor: Colors.dark.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  nextSetButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  exerciseCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border, marginTop: 12 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  collapseChevron: { color: Colors.dark.textMuted, fontSize: 12, marginLeft: 4, marginTop: 2 },
  collapsedSummary: { paddingTop: 4, gap: 4 },
  collapsedSummaryText: { fontSize: 14, color: Colors.dark.textMuted, fontWeight: '600' },
  collapsedLastSession: { fontSize: 12, color: Colors.dark.primary, fontWeight: '600' },
  exerciseHeaderText: { flex: 1 },
  exerciseTitle: { color: Colors.dark.text, fontSize: 20, fontWeight: '800' },
  exerciseSubtitle: { color: Colors.dark.textMuted, fontSize: 14, marginTop: 4 },
  freeExerciseBadge: { color: Colors.dark.primary, fontWeight: '700' },
  removeExerciseButton: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.danger, paddingHorizontal: 10, paddingVertical: 6 },
  removeExerciseButtonText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '700' },
  exerciseNoteBox: { backgroundColor: '#1a1a21', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 14 },
  exerciseSetsList: { gap: 14 },
  setCard: { backgroundColor: '#141419', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.dark.border },
  setCardCompleted: { borderColor: Colors.dark.primary },
  setCardNext: { borderColor: 'rgba(126,71,255,0.7)', shadowColor: Colors.dark.primary, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  setHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700', flex: 1 },
  removeSetButton: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.danger, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeSetButtonText: { color: Colors.dark.danger, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  statusPill: { backgroundColor: '#24242b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillActive: { backgroundColor: 'rgba(126,71,255,0.18)' },
  statusPillText: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '700' },
  statusPillTextActive: { color: Colors.dark.primary },
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  targetBox: { width: '48%', backgroundColor: '#1a1a21', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.border },
  targetLabel: { color: Colors.dark.textMuted, fontSize: 12, marginBottom: 6 },
  targetValue: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' },
  lastSessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(126,71,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  lastSessionLabel: { fontSize: 11, fontWeight: '800', color: Colors.dark.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
  lastSessionValue: { fontSize: 13, color: Colors.dark.text, fontWeight: '600', flex: 1 },
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
  effortChipSelected: { backgroundColor: 'rgba(126,71,255,0.18)', borderColor: Colors.dark.primary },
  effortChipText: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '700' },
  effortChipTextSelected: { color: Colors.dark.primary },
  setActions: { gap: 10, marginTop: 2 },
  primaryButton: { backgroundColor: Colors.dark.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
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
  finishButton: { backgroundColor: Colors.dark.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 12 },
  finishButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
  addExerciseButton: { marginTop: 16, backgroundColor: Colors.dark.surface, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  addExerciseButtonText: { color: Colors.dark.primary, fontSize: 15, fontWeight: '700' },
  addSetButton: { marginTop: 12, backgroundColor: 'rgba(126,71,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  addSetButtonText: { color: Colors.dark.primary, fontSize: 14, fontWeight: '700' },

  exerciseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  exerciseSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  reorderToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  reorderToggleBtnActive: {
    backgroundColor: 'rgba(126,71,255,0.14)',
    borderColor: Colors.dark.primary,
  },
  reorderToggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  reorderToggleBtnTextActive: {
    color: Colors.dark.primary,
  },

  scrollTopButton: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  scrollTopButtonIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },

  // ── Superset styles ──────────────────────────────────────────────────────────
  supersetContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.dark.warning + '66',
    borderRadius: 20,
    padding: 12,
    backgroundColor: 'rgba(245,158,11,0.04)',
  },
  supersetHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 4,
    gap: 2,
  },
  supersetLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dark.warning,
    letterSpacing: 1,
  },
  supersetHint: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontStyle: 'italic',
  },
  supersetDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 8,
  },
  supersetDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.warning + '44',
  },
  supersetDividerText: {
    fontSize: 13,
    color: Colors.dark.warning,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  exerciseCardInSuperset: {
    borderColor: Colors.dark.warning + '44',
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.warning,
    marginTop: 0,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ssBadgeSession: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.dark.warning,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ssBadgeSessionText: {
    color: Colors.dark.warning,
    fontSize: 11,
    fontWeight: '800',
  },
  exerciseHeaderActions: {
    gap: 6,
    alignItems: 'flex-end',
  },
  ssPairButton: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.warning,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ssPairButtonText: {
    color: Colors.dark.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  ssClearButton: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.warning,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ssClearButtonText: {
    color: Colors.dark.warning,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Session superset modal ───────────────────────────────────────────────────
  ssOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  ssSheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderColor: Colors.dark.border,
    maxHeight: '80%',
  },
  ssSheetHandle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  ssSheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.dark.text, textAlign: 'center', marginBottom: 8 },
  ssSheetSubtitle: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  ssExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
    gap: 12,
  },
  ssExerciseName: { fontSize: 15, fontWeight: '700', color: Colors.dark.text, marginBottom: 2 },
  ssExerciseCategory: { fontSize: 13, color: Colors.dark.textMuted },
  ssAbbinaBadge: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ssAbbinaBadgeText: { color: Colors.dark.warning, fontSize: 13, fontWeight: '700' },
  ssEmptyBox: { paddingVertical: 24, alignItems: 'center' },
  ssEmptyText: { color: Colors.dark.textMuted, fontSize: 14, textAlign: 'center' },
  ssCloseButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  ssCloseButtonText: { color: Colors.dark.textMuted, fontSize: 15, fontWeight: '600' },
});