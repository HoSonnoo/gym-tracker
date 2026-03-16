import { Colors } from '@/constants/Colors';
import {
  addExerciseToTemplate,
  Exercise,
  getExercises,
  getTemplateExercises,
  getWorkoutTemplateById,
  removeExerciseFromTemplate,
  reorderTemplateExercises,
  TemplateExercise,
  updateWorkoutTemplate,
  WorkoutTemplate,
} from '@/database';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
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

const PRIMARY = '#7e47ff';

// ─── Draggable Item ───────────────────────────────────────────────────────────

type DraggableItemProps = {
  item: TemplateExercise;
  index: number;
  total: number;
  itemHeightRef: React.MutableRefObject<number>;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onConfigure: () => void;
  onRemove: () => void;
  onLayout?: (e: any) => void;
};

function DraggableItem({
  item,
  index,
  total,
  itemHeightRef,
  onDragStart,
  onDragEnd,
  onConfigure,
  onRemove,
  onLayout,
}: DraggableItemProps) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isActive = useSharedValue(false);

  // Tiene traccia dell'index di destinazione sul JS thread
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
      // Muove solo questo item visivamente — nessun re-render React
      translateY.value = e.translationY;

      // Calcola il target index ma non aggiorna lo stato
      const rawOffset = Math.round(e.translationY / itemHeightRef.current);
      const clamped = Math.max(-index, Math.min(total - 1 - index, rawOffset));
      toIndexRef.current = index + clamped;
    })
    .onEnd(() => {
      // Anima il ritorno alla posizione (la lista si riordinerà dopo)
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      scale.value = withSpring(1, { damping: 20 });
      opacity.value = withTiming(1, { duration: 150 });
      zIndex.value = 0;
      isActive.value = false;
      runOnJS(onDragEnd)(index, toIndexRef.current);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onFinalize(() => {
      // Safety: resetta sempre in caso di cancellazione gesture
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      scale.value = withSpring(1);
      opacity.value = withTiming(1);
      zIndex.value = 0;
      isActive.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    opacity: opacity.value,
    shadowOpacity: isActive.value ? 0.3 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[dragStyles.item, animatedStyle]}
        onLayout={onLayout}>
        {/* Handle drag */}
        <View style={dragStyles.handleCol}>
          <View style={dragStyles.handleIcon}>
            <Text style={dragStyles.handleDots}>⠿</Text>
          </View>
          <View style={dragStyles.orderBadge}>
            <Text style={dragStyles.orderText}>{index + 1}</Text>
          </View>
        </View>

        {/* Info esercizio */}
        <View style={dragStyles.infoCol}>
          <Text style={dragStyles.exerciseName}>{item.exercise_name}</Text>
          <Text style={dragStyles.exerciseCategory}>
            {item.exercise_category ?? 'Nessuna categoria'}
          </Text>
        </View>

        {/* Azioni */}
        <View style={dragStyles.actionsCol}>
          <Pressable style={dragStyles.configureButton} onPress={onConfigure}>
            <Text style={dragStyles.configureButtonText}>Configura</Text>
          </Pressable>
          <Pressable style={dragStyles.removeButton} onPress={onRemove}>
            <Text style={dragStyles.removeButtonText}>Rimuovi</Text>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const dragStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
    marginBottom: 10,
    minHeight: 72,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 0,
  },
  handleCol: {
  width: 36,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  },
  handleIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDots: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    lineHeight: 18,
  },
  orderBadge: {
    // rimuovi position: 'absolute', bottom, left
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(126,71,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  exerciseCategory: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  actionsCol: {
    gap: 6,
    alignItems: 'flex-end',
  },
  configureButton: {
    backgroundColor: 'rgba(126,71,255,0.14)',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  configureButtonText: {
    color: Colors.dark.primarySoft,
    fontSize: 12,
    fontWeight: '700',
  },
  removeButton: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  removeButtonText: {
    color: Colors.dark.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── Draggable List ───────────────────────────────────────────────────────────

type DraggableExerciseListProps = {
  exercises: TemplateExercise[];
  onReorder: (reordered: TemplateExercise[]) => void;
  onConfigure: (item: TemplateExercise) => void;
  onRemove: (item: TemplateExercise) => void;
};

function DraggableExerciseList({
  exercises,
  onReorder,
  onConfigure,
  onRemove,
}: DraggableExerciseListProps) {
  const [items, setItems] = useState(exercises);
  const itemHeightRef = useRef(82); // fallback iniziale

  useEffect(() => {
    setItems(exercises);
  }, [exercises]);

  const handleDragStart = useCallback((_index: number) => {
    // noop — lo stato non cambia durante il drag
  }, []);

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const newItems = [...items];
      const [moved] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, moved);
      setItems(newItems);
      onReorder(newItems);
    },
    [items, onReorder]
  );

  return (
    <View>
      {items.map((item, index) => (
        <DraggableItem
          key={item.id}
          item={item}
          index={index}
          total={items.length}
          itemHeightRef={itemHeightRef}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onConfigure={() => onConfigure(item)}
          onRemove={() => onRemove(item)}
          onLayout={index === 0
            ? (e) => { itemHeightRef.current = e.nativeEvent.layout.height; }
            : undefined}
        />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TemplateDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (!templateId || Number.isNaN(templateId)) return;
    try {
      const [templateData, templateExercisesData, exercisesData] = await Promise.all([
        getWorkoutTemplateById(templateId),
        getTemplateExercises(templateId),
        getExercises(),
      ]);
      setTemplate(templateData);
      setTemplateExercises(templateExercisesData);
      setAllExercises(exercisesData);
    } catch (error) {
      console.error('Errore caricamento:', error);
    }
  }, [templateId]);

  useEffect(() => {
    if (template) {
      setEditName(template.name);
      setEditNotes(template.notes ?? '');
    }
  }, [template]);

  const handleSaveEdit = useCallback(async () => {
    if (!template) return;
    try {
      setIsSaving(true);
      await updateWorkoutTemplate(templateId, editName, editNotes || null);
      await loadData();
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossibile salvare.';
      Alert.alert('Errore', message);
    } finally {
      setIsSaving(false);
    }
  }, [template, templateId, editName, editNotes, loadData]);

  const handleCancelEdit = useCallback(() => {
    if (template) {
      setEditName(template.name);
      setEditNotes(template.notes ?? '');
    }
    setIsEditing(false);
  }, [template]);

  const handleReorder = useCallback((reordered: TemplateExercise[]) => {
    const withUpdatedOrder = reordered.map((ex, idx) => ({
      ...ex,
      exercise_order: idx + 1,
    }));
    setTemplateExercises(withUpdatedOrder);

    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(async () => {
      try {
        setIsReordering(true);
        await reorderTemplateExercises(
          withUpdatedOrder.map((ex) => ({ id: ex.id, exercise_order: ex.exercise_order }))
        );
      } catch {
        // silenzioso
      } finally {
        setIsReordering(false);
      }
    }, 600);
  }, []);

  const handleAddExerciseToTemplate = useCallback(
    async (exercise: Exercise) => {
      try {
        await addExerciseToTemplate(templateId, exercise.id);
        await loadData();
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Errore durante l\'aggiunta.';
        Alert.alert('Impossibile aggiungere l\'esercizio', message);
      }
    },
    [templateId, loadData]
  );

  const handleRemoveExerciseFromTemplate = useCallback(
    (item: TemplateExercise) => {
      Alert.alert(
        'Rimuovi esercizio',
        `Vuoi rimuovere "${item.exercise_name}" da questo template?`,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Rimuovi',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeExerciseFromTemplate(item.id);
                await loadData();
              } catch {
                Alert.alert('Errore', 'Impossibile rimuovere l\'esercizio.');
              }
            },
          },
        ]
      );
    },
    [loadData]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
      };
    }, [loadData])
  );

  if (!templateId || Number.isNaN(templateId)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>ID template non valido.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showOnboardingBanner = templateExercises.length === 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          style={styles.container}
          data={allExercises}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          scrollIndicatorInsets={{ right: 1 }}
          ListHeaderComponent={
            <>
              <View style={styles.topBar}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                  <Text style={styles.backButtonText}>Indietro</Text>
                </Pressable>
              </View>

              {isEditing ? (
                <View style={styles.editBlock}>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    style={styles.editNameInput}
                    placeholder="Nome template"
                    placeholderTextColor={Colors.dark.textMuted}
                    autoFocus
                  />
                  <TextInput
                    value={editNotes}
                    onChangeText={setEditNotes}
                    style={styles.editNotesInput}
                    placeholder="Note opzionali"
                    placeholderTextColor={Colors.dark.textMuted}
                    multiline
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.saveButton, isSaving && styles.buttonDisabled]}
                      onPress={handleSaveEdit}
                      disabled={isSaving}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.saveButtonText}>
                        {isSaving ? 'Salvataggio...' : 'Salva'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancelEdit}
                      disabled={isSaving}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.cancelButtonText}>Annulla</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.headerBlock}>
                  <View style={styles.headerRow}>
                    <Text style={styles.pageTitle}>{template?.name ?? 'Template'}</Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setIsEditing(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.editButtonText}>Modifica</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.pageSubtitle}>
                    {template?.notes?.trim() || 'Nessuna nota per questo template.'}
                  </Text>
                </View>
              )}

              {showOnboardingBanner && !isEditing && (
                <View style={styles.onboardingBanner}>
                  <View style={styles.onboardingBannerHeader}>
                    <View style={styles.onboardingStep}>
                      <Text style={styles.onboardingStepText}>3</Text>
                    </View>
                    <Text style={styles.onboardingBannerTitle}>
                      Aggiungi esercizi al template
                    </Text>
                  </View>
                  <Text style={styles.onboardingBannerText}>
                    Qui sotto trovi tutti gli esercizi del tuo catalogo. Tocca{' '}
                    <Text style={styles.onboardingBannerHighlight}>Aggiungi</Text>{' '}
                    su quelli che vuoi inserire in questo template.
                  </Text>
                  <View style={styles.onboardingArrow}>
                    <Text style={styles.onboardingArrowText}>↓ Gli esercizi disponibili sono qui sotto</Text>
                  </View>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Esercizi del template</Text>
                  {isReordering && (
                    <Text style={styles.savingOrderText}>Salvataggio...</Text>
                  )}
                </View>
                <Text style={styles.sectionDescription}>
                  {templateExercises.length > 1
                    ? 'Tieni premuto ⠿ e trascina per riordinare.'
                    : 'Qui trovi gli esercizi già presenti in questa scheda.'}
                </Text>
              </View>

              {templateExercises.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.cardTitle}>Nessun esercizio nel template</Text>
                  <Text style={styles.cardText}>
                    Aggiungi uno o più esercizi dalla sezione qui sotto.
                  </Text>
                </View>
              ) : (
                <>
                  <DraggableExerciseList
                    exercises={templateExercises}
                    onReorder={handleReorder}
                    onConfigure={(item) => router.push(`/template/exercise/${item.id}`)}
                    onRemove={handleRemoveExerciseFromTemplate}
                  />
                  <View style={styles.configureTip}>
                    <Text style={styles.configureTipText}>
                      💡 Tocca{' '}
                      <Text style={styles.configureTipHighlight}>Configura</Text>
                      {' '}per impostare serie, peso target e tempi di recupero.
                    </Text>
                  </View>
                </>
              )}

              <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>Aggiungi dal catalogo</Text>
                <Text style={styles.sectionDescription}>
                  Tocca "Aggiungi" per inserire un esercizio nel template.
                </Text>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.exerciseItem}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseTextContainer}>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <Text style={styles.exerciseCategory}>
                    {item.category ?? 'Nessuna categoria'}
                  </Text>
                </View>
                <Pressable
                  style={styles.addButton}
                  onPress={() => handleAddExerciseToTemplate(item)}
                >
                  <Text style={styles.addButtonText}>Aggiungi</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.cardTitle}>Nessun esercizio disponibile</Text>
              <Text style={styles.cardText}>
                Vai in "Gestisci esercizi" e crea qualche esercizio.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.dark.background },
  container: { flex: 1, backgroundColor: Colors.dark.background },
  listContent: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 28 },
  centered: { flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: Colors.dark.danger, fontSize: 16, fontWeight: '600' },
  topBar: { marginBottom: 8 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  backButtonText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  headerBlock: { marginTop: 8, marginBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, flex: 1 },
  pageSubtitle: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  editButton: { marginTop: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.border },
  editButtonText: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' },
  editBlock: { marginTop: 8, marginBottom: 24, gap: 12 },
  editNameInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: PRIMARY, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: Colors.dark.text, fontSize: 22, fontWeight: '800' },
  editNotesInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: Colors.dark.text, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelButton: { flex: 1, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  cancelButtonText: { color: Colors.dark.text, fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  onboardingBanner: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(126,71,255,0.4)', marginBottom: 24, gap: 12 },
  onboardingBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onboardingStep: { width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  onboardingStepText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  onboardingBannerTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  onboardingBannerText: { fontSize: 14, lineHeight: 21, color: Colors.dark.textMuted },
  onboardingBannerHighlight: { color: Colors.dark.primarySoft, fontWeight: '700' },
  onboardingArrow: { backgroundColor: 'rgba(126,71,255,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  onboardingArrowText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  sectionHeader: { marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: Colors.dark.text },
  sectionDescription: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  savingOrderText: { fontSize: 12, color: Colors.dark.textMuted, fontStyle: 'italic' },
  emptyCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, marginBottom: 8 },
  cardText: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  configureTip: { backgroundColor: 'rgba(126,71,255,0.06)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(126,71,255,0.15)', marginBottom: 4 },
  configureTipText: { fontSize: 13, lineHeight: 19, color: Colors.dark.textMuted },
  configureTipHighlight: { color: Colors.dark.primarySoft, fontWeight: '700' },
  exerciseItem: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  exerciseTextContainer: { flex: 1 },
  exerciseName: { fontSize: 17, fontWeight: '700', color: Colors.dark.text, marginBottom: 4 },
  exerciseCategory: { fontSize: 14, color: Colors.dark.textMuted },
  addButton: { backgroundColor: 'rgba(126,71,255,0.14)', borderWidth: 1, borderColor: Colors.dark.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: Colors.dark.primarySoft, fontSize: 14, fontWeight: '700' },
});