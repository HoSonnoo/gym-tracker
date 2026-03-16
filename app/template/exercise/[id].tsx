import { Colors } from '@/constants/Colors';
import {
  addTemplateExerciseSet,
  deleteTemplateExerciseSet,
  getTemplateExerciseById,
  getTemplateExerciseSets,
  TemplateExercise,
  TemplateExerciseSet,
} from '@/database';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TemplateExerciseConfigScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const templateExerciseId = Number(params.id);

  const [templateExercise, setTemplateExercise] = useState<TemplateExercise | null>(null);
  const [sets, setSets] = useState<TemplateExerciseSet[]>([]);

  const loadData = useCallback(async () => {
    if (!templateExerciseId || Number.isNaN(templateExerciseId)) return;

    try {
      const [exerciseData, setsData] = await Promise.all([
        getTemplateExerciseById(templateExerciseId),
        getTemplateExerciseSets(templateExerciseId),
      ]);

      setTemplateExercise(exerciseData);
      setSets(setsData);
    } catch (error) {
      console.error('Errore caricamento configurazione esercizio:', error);
    }
  }, [templateExerciseId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAddSet = useCallback(
    async (setType: 'warmup' | 'target') => {
      try {
        await addTemplateExerciseSet(templateExerciseId, setType);
        const freshSets = await getTemplateExerciseSets(templateExerciseId);
        setSets(freshSets);

        const latestSet = freshSets[freshSets.length - 1];
        if (latestSet) {
          router.push(`/template/exercise/set/${latestSet.id}`);
        }
      } catch (error) {
        Alert.alert(
          'Impossibile aggiungere la serie',
          'Si è verificato un errore durante la creazione della serie.'
        );
      }
    },
    [templateExerciseId, router]
  );

  const handleDeleteSet = useCallback(
    (setId: number) => {
      Alert.alert('Rimuovi serie', 'Vuoi eliminare questa serie?', [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTemplateExerciseSet(setId);
              await loadData();
            } catch (error) {
              Alert.alert(
                'Impossibile rimuovere la serie',
                'Si è verificato un errore durante l’eliminazione.'
              );
            }
          },
        },
      ]);
    },
    [loadData]
  );

  const formatEffort = (set: TemplateExerciseSet) => {
    if (set.effort_type === 'buffer') {
      return set.buffer_value != null ? `Buffer ${set.buffer_value}` : 'Buffer';
    }
    if (set.effort_type === 'failure') return 'Cedimento';
    if (set.effort_type === 'drop_set') return 'Drop set';
    return 'Nessuno';
  };

  const formatSetSummary = (set: TemplateExerciseSet) => {
    const parts: string[] = [];

    parts.push(set.set_type === 'warmup' ? 'Warmup' : 'Target');

    if (set.weight_kg != null) {
      parts.push(`${set.weight_kg} kg`);
    }

    if (set.reps_min != null && set.reps_max != null) {
      parts.push(`${set.reps_min}-${set.reps_max} reps`);
    } else if (set.reps_min != null) {
      parts.push(`${set.reps_min} reps min`);
    } else if (set.reps_max != null) {
      parts.push(`${set.reps_max} reps max`);
    }

    if (set.rest_seconds != null) {
      parts.push(`${set.rest_seconds}s pausa`);
    }

    return parts.join(' · ');
  };

  if (!templateExerciseId || Number.isNaN(templateExerciseId)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>ID esercizio non valido.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        style={styles.container}
        data={sets}
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
              <Text style={styles.pageTitle}>
                {templateExercise?.exercise_name ?? 'Configura esercizio'}
              </Text>
              <Text style={styles.pageSubtitle}>
                {templateExercise?.exercise_category ?? 'Nessuna categoria'}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.secondaryActionButton}
                onPress={() => handleAddSet('warmup')}
              >
                <Text style={styles.secondaryActionButtonText}>Aggiungi warmup</Text>
              </Pressable>

              <Pressable
                style={styles.primaryActionButton}
                onPress={() => handleAddSet('target')}
              >
                <Text style={styles.primaryActionButtonText}>Aggiungi target</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Serie configurate</Text>
              <Text style={styles.sectionDescription}>
                Qui trovi il riepilogo delle serie. Tocca “Modifica” per aprire il popup della serie.
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryTitle}>Serie {item.set_order}</Text>
                <Text style={styles.summarySubtitle}>
                  {formatSetSummary(item)}
                </Text>
                <Text style={styles.summaryEffort}>
                  Sforzo: {formatEffort(item)}
                </Text>
                {item.notes ? (
                  <Text style={styles.summaryNotes}>{item.notes}</Text>
                ) : null}
              </View>

              <View style={styles.summaryActions}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => router.push(`/template/exercise/set/${item.id}`)}
                >
                  <Text style={styles.editButtonText}>Modifica</Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDeleteSet(item.id)}
                >
                  <Text style={styles.deleteButtonText}>Elimina</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Nessuna serie configurata</Text>
            <Text style={styles.cardText}>
              Aggiungi un warmup o una target per iniziare a strutturare l’esercizio.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: Colors.dark.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  topBar: {
    marginBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  backButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  headerBlock: {
    marginTop: 8,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryActionButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.textMuted,
  },
  summaryCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 14,
  },
  summaryHeader: {
    gap: 14,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  summarySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  summaryEffort: {
    fontSize: 14,
    color: Colors.dark.primarySoft,
    marginBottom: 6,
    fontWeight: '600',
  },
  summaryNotes: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark.textMuted,
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  editButton: {
    backgroundColor: 'rgba(126, 71, 255, 0.14)',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  editButtonText: {
    color: Colors.dark.primarySoft,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  deleteButtonText: {
    color: Colors.dark.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.textMuted,
  },
});