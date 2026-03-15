import { Colors } from '@/constants/Colors';
import {
  addExerciseToTemplate,
  Exercise,
  getExercises,
  getTemplateExercises,
  getWorkoutTemplateById,
  removeExerciseFromTemplate,
  TemplateExercise,
  WorkoutTemplate,
} from '@/database';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#7e47ff';

export default function TemplateDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

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
                Alert.alert('Impossibile rimuovere l\'esercizio', 'Si è verificato un errore durante la rimozione.');
              }
            },
          },
        ]
      );
    },
    [loadData]
  );

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
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

  // Banner di onboarding — visibile solo se il template è vuoto
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

            <View style={styles.headerBlock}>
              <Text style={styles.pageTitle}>{template?.name ?? 'Template'}</Text>
              <Text style={styles.pageSubtitle}>
                {template?.notes?.trim() || 'Nessuna nota per questo template.'}
              </Text>
            </View>

            {/* Banner onboarding — solo se template vuoto */}
            {showOnboardingBanner && (
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
              <Text style={styles.sectionTitle}>Esercizi del template</Text>
              <Text style={styles.sectionDescription}>
                Qui trovi gli esercizi già presenti in questa scheda.
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
              <View style={styles.templateExercisesWrapper}>
                {templateExercises.map((item) => (
                  <View key={item.id} style={styles.templateExerciseItem}>
                    <View style={styles.templateExerciseHeader}>
                      <View style={styles.templateExerciseTextContainer}>
                        <Text style={styles.templateExerciseName}>
                          {item.exercise_order}. {item.exercise_name}
                        </Text>
                        <Text style={styles.templateExerciseCategory}>
                          {item.exercise_category ?? 'Nessuna categoria'}
                        </Text>
                      </View>
                      <View style={styles.templateActions}>
                        <Pressable
                          style={styles.configureButton}
                          onPress={() => router.push(`/template/exercise/${item.id}`)}
                        >
                          <Text style={styles.configureButtonText}>Configura</Text>
                        </Pressable>
                        <Pressable
                          style={styles.removeButton}
                          onPress={() => handleRemoveExerciseFromTemplate(item)}
                        >
                          <Text style={styles.removeButtonText}>Rimuovi</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Suggerimento "configura le serie" — appare dopo il primo esercizio aggiunto */}
                <View style={styles.configureTip}>
                  <Text style={styles.configureTipText}>
                    💡 Tocca{' '}
                    <Text style={styles.configureTipHighlight}>Configura</Text>
                    {' '}su un esercizio per impostare serie, peso target e tempi di recupero.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.sectionHeader}>
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
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginBottom: 8 },
  pageSubtitle: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },

  // Onboarding banner
  onboardingBanner: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.4)',
    marginBottom: 24,
    gap: 12,
  },
  onboardingBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onboardingStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingStepText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  onboardingBannerTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  onboardingBannerText: { fontSize: 14, lineHeight: 21, color: Colors.dark.textMuted },
  onboardingBannerHighlight: { color: Colors.dark.primarySoft, fontWeight: '700' },
  onboardingArrow: {
    backgroundColor: 'rgba(126,71,255,0.08)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  onboardingArrowText: { fontSize: 13, fontWeight: '600', color: PRIMARY },

  // Tip configura serie
  configureTip: {
    backgroundColor: 'rgba(126,71,255,0.06)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.15)',
    marginTop: 4,
  },
  configureTipText: { fontSize: 13, lineHeight: 19, color: Colors.dark.textMuted },
  configureTipHighlight: { color: Colors.dark.primarySoft, fontWeight: '700' },

  sectionHeader: { marginBottom: 14 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: Colors.dark.text, marginBottom: 6 },
  sectionDescription: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  emptyCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, marginBottom: 8 },
  cardText: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  templateExercisesWrapper: { marginBottom: 20, gap: 12 },
  templateExerciseItem: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border },
  templateExerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  templateExerciseTextContainer: { flex: 1 },
  templateExerciseName: { fontSize: 17, fontWeight: '700', color: Colors.dark.text, marginBottom: 4 },
  templateExerciseCategory: { fontSize: 14, color: Colors.dark.textMuted },
  templateActions: { flexDirection: 'row', gap: 8 },
  configureButton: { backgroundColor: 'rgba(126,71,255,0.14)', borderWidth: 1, borderColor: Colors.dark.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  configureButtonText: { color: Colors.dark.primarySoft, fontSize: 14, fontWeight: '700' },
  removeButton: { backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: Colors.dark.danger, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  removeButtonText: { color: Colors.dark.danger, fontSize: 14, fontWeight: '700' },
  exerciseItem: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  exerciseTextContainer: { flex: 1 },
  exerciseName: { fontSize: 17, fontWeight: '700', color: Colors.dark.text, marginBottom: 4 },
  exerciseCategory: { fontSize: 14, color: Colors.dark.textMuted },
  addButton: { backgroundColor: 'rgba(126,71,255,0.14)', borderWidth: 1, borderColor: Colors.dark.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: Colors.dark.primarySoft, fontSize: 14, fontWeight: '700' },
});