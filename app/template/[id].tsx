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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#7e47ff';

// Abilita LayoutAnimation su Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Draggable Exercise List ──────────────────────────────────────────────────

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
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  // Sincronizza quando cambiano gli esercizi dall'esterno
  useEffect(() => {
    setItems(exercises);
  }, [exercises]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setItems(newItems);
    onReorder(newItems);
  }, [items, onReorder]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === items.length - 1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setItems(newItems);
    onReorder(newItems);
  }, [items, onReorder]);

  return (
    <View style={dragStyles.container}>
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const isDragging = draggingId === item.id;

        return (
          <View
            key={item.id}
            style={[
              dragStyles.item,
              isDragging && dragStyles.itemDragging,
            ]}
          >
            {/* Drag handle + ordine */}
            <View style={dragStyles.handleCol}>
              <TouchableOpacity
                style={[dragStyles.arrowButton, isFirst && dragStyles.arrowButtonDisabled]}
                onPress={() => handleMoveUp(index)}
                disabled={isFirst}
                activeOpacity={0.7}
              >
                <Text style={[dragStyles.arrowText, isFirst && dragStyles.arrowTextDisabled]}>
                  ↑
                </Text>
              </TouchableOpacity>

              <View style={dragStyles.orderBadge}>
                <Text style={dragStyles.orderText}>{index + 1}</Text>
              </View>

              <TouchableOpacity
                style={[dragStyles.arrowButton, isLast && dragStyles.arrowButtonDisabled]}
                onPress={() => handleMoveDown(index)}
                disabled={isLast}
                activeOpacity={0.7}
              >
                <Text style={[dragStyles.arrowText, isLast && dragStyles.arrowTextDisabled]}>
                  ↓
                </Text>
              </TouchableOpacity>
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
              <Pressable
                style={dragStyles.configureButton}
                onPress={() => onConfigure(item)}
              >
                <Text style={dragStyles.configureButtonText}>Configura</Text>
              </Pressable>
              <Pressable
                style={dragStyles.removeButton}
                onPress={() => onRemove(item)}
              >
                <Text style={dragStyles.removeButtonText}>Rimuovi</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const dragStyles = StyleSheet.create({
  container: { gap: 10, marginBottom: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  itemDragging: {
    borderColor: PRIMARY,
    backgroundColor: 'rgba(126,71,255,0.08)',
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  handleCol: {
    alignItems: 'center',
    gap: 2,
    width: 32,
  },
  arrowButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    opacity: 0.25,
  },
  arrowText: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '700',
    lineHeight: 18,
  },
  arrowTextDisabled: {
    color: Colors.dark.textMuted,
  },
  orderBadge: {
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
      console.error('Errore caricamento dettaglio template:', error);
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
      const message = error instanceof Error ? error.message : 'Impossibile salvare le modifiche.';
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

  // Gestisce il riordinamento: aggiorna lo stato locale immediatamente,
  // poi persiste nel DB con un debounce di 600ms per evitare troppe scritture
  const handleReorder = useCallback((reordered: TemplateExercise[]) => {
    // Aggiorna lo stato locale con i nuovi ordini
    const withUpdatedOrder = reordered.map((ex, idx) => ({
      ...ex,
      exercise_order: idx + 1,
    }));
    setTemplateExercises(withUpdatedOrder);

    // Debounce la scrittura su DB
    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(async () => {
      try {
        setIsReordering(true);
        await reorderTemplateExercises(
          withUpdatedOrder.map((ex) => ({ id: ex.id, exercise_order: ex.exercise_order }))
        );
      } catch {
        // Silenzioso — il DB verrà risincronizzato al prossimo focus
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
          : 'Errore durante l\'aggiunta dell\'esercizio al template.';
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
                Alert.alert('Impossibile rimuovere l\'esercizio', 'Si è verificato un errore.');
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
        // Cleanup del timeout al blur
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

            {/* Header */}
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

            {/* Banner onboarding */}
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
                  su quelli che vuoi inserire in questo template. Potrai configurare serie, peso e recupero per ognuno dopo averli aggiunti.
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
                  <Text style={styles.savingOrderText}>Salvataggio ordine...</Text>
                )}
              </View>
              <Text style={styles.sectionDescription}>
                {templateExercises.length > 1
                  ? 'Usa ↑ ↓ per cambiare l\'ordine degli esercizi.'
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

                {templateExercises.length > 0 && (
                  <View style={styles.configureTip}>
                    <Text style={styles.configureTipText}>
                      💡 Tocca{' '}
                      <Text style={styles.configureTipHighlight}>Configura</Text>
                      {' '}su un esercizio per impostare serie, peso target e tempi di recupero.
                    </Text>
                  </View>
                )}
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
              Vai in "Gestisci esercizi" e crea qualche esercizio da usare nei template.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
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