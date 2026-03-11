import { Colors } from '@/constants/Colors';
import {
    getTemplateExerciseById,
    TemplateExercise,
    updateTemplateExercise,
} from '@/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TemplateExerciseEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const templateExerciseId = Number(params.id);

  const [item, setItem] = useState<TemplateExercise | null>(null);
  const [targetSets, setTargetSets] = useState('');
  const [targetRepsMin, setTargetRepsMin] = useState('');
  const [targetRepsMax, setTargetRepsMax] = useState('');
  const [restSeconds, setRestSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadItem = useCallback(async () => {
    if (!templateExerciseId || Number.isNaN(templateExerciseId)) return;

    try {
      const data = await getTemplateExerciseById(templateExerciseId);
      setItem(data);

      if (data) {
        setTargetSets(data.target_sets?.toString() ?? '');
        setTargetRepsMin(data.target_reps_min?.toString() ?? '');
        setTargetRepsMax(data.target_reps_max?.toString() ?? '');
        setRestSeconds(data.rest_seconds?.toString() ?? '');
        setNotes(data.notes ?? '');
      }
    } catch (error) {
      console.error('Errore caricamento esercizio template:', error);
    }
  }, [templateExerciseId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const parseOptionalInt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error('Inserisci solo numeri interi validi nei campi numerici.');
    }

    return parsed;
  };

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);

      const parsedTargetSets = parseOptionalInt(targetSets);
      const parsedTargetRepsMin = parseOptionalInt(targetRepsMin);
      const parsedTargetRepsMax = parseOptionalInt(targetRepsMax);
      const parsedRestSeconds = parseOptionalInt(restSeconds);

      if (
        parsedTargetRepsMin !== null &&
        parsedTargetRepsMax !== null &&
        parsedTargetRepsMin > parsedTargetRepsMax
      ) {
        throw new Error('Le ripetizioni minime non possono essere maggiori delle massime.');
      }

      await updateTemplateExercise(templateExerciseId, {
        targetSets: parsedTargetSets,
        targetRepsMin: parsedTargetRepsMin,
        targetRepsMax: parsedTargetRepsMax,
        restSeconds: parsedRestSeconds,
        notes: notes.trim() || null,
      });

      Alert.alert('Salvato', 'Parametri aggiornati correttamente.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Errore durante il salvataggio dei parametri.';
      Alert.alert('Impossibile salvare', message);
    } finally {
      setIsSaving(false);
    }
  }, [
    targetSets,
    targetRepsMin,
    targetRepsMax,
    restSeconds,
    notes,
    templateExerciseId,
    router,
  ]);

  if (!templateExerciseId || Number.isNaN(templateExerciseId)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>ID esercizio template non valido.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        scrollIndicatorInsets={{ right: 1 }}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Indietro</Text>
          </Pressable>
        </View>

        <View style={styles.headerBlock}>
          <Text style={styles.pageTitle}>
            {item?.exercise_name ?? 'Esercizio'}
          </Text>
          <Text style={styles.pageSubtitle}>
            {item?.exercise_category ?? 'Nessuna categoria'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parametri del template</Text>

          <TextInput
            value={targetSets}
            onChangeText={setTargetSets}
            placeholder="Serie target"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            value={targetRepsMin}
            onChangeText={setTargetRepsMin}
            placeholder="Ripetizioni minime"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            value={targetRepsMax}
            onChangeText={setTargetRepsMax}
            placeholder="Ripetizioni massime"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            value={restSeconds}
            onChangeText={setRestSeconds}
            placeholder="Recupero in secondi"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Note opzionali"
            placeholderTextColor={Colors.dark.textMuted}
            style={[styles.input, styles.notesInput]}
            multiline
          />

          <Pressable
            style={[styles.button, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>
              {isSaving ? 'Salvataggio...' : 'Salva parametri'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
  content: {
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
  input: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 15,
    marginBottom: 12,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
});