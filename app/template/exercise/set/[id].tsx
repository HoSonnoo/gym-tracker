import { Colors } from '@/constants/Colors';
import {
  getTemplateExerciseSetById,
  TemplateExerciseSet,
  updateTemplateExerciseSet,
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

type EditableSetValues = {
  set_type: 'warmup' | 'target';
  weight_kg: string;
  reps_min: string;
  reps_max: string;
  rest_seconds: string;
  effort_type: 'none' | 'buffer' | 'failure' | 'drop_set';
  buffer_value: string;
  notes: string;
};

export default function TemplateExerciseSetModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const setId = Number(params.id);

  const [setData, setSetData] = useState<TemplateExerciseSet | null>(null);
  const [draft, setDraft] = useState<EditableSetValues | null>(null);

  const createDraft = useCallback((set: TemplateExerciseSet): EditableSetValues => {
    return {
      set_type: set.set_type,
      weight_kg: set.weight_kg != null ? String(set.weight_kg) : '',
      reps_min: set.reps_min != null ? String(set.reps_min) : '',
      reps_max: set.reps_max != null ? String(set.reps_max) : '',
      rest_seconds: set.rest_seconds != null ? String(set.rest_seconds) : '',
      effort_type: set.effort_type,
      buffer_value: set.buffer_value != null ? String(set.buffer_value) : '',
      notes: set.notes ?? '',
    };
  }, []);

  const loadSet = useCallback(async () => {
    if (!setId || Number.isNaN(setId)) return;

    try {
      const current = await getTemplateExerciseSetById(setId);

      setSetData(current);
      setDraft(current ? createDraft(current) : null);
    } catch (error) {
      console.error('Errore caricamento set:', error);
    }
  }, [setId, createDraft]);

  useEffect(() => {
    loadSet();
  }, [loadSet]);

  const updateField = <K extends keyof EditableSetValues>(
    field: K,
    value: EditableSetValues[K]
  ) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft) return;

    try {
      const parsedWeight =
        draft.weight_kg.trim() === ''
          ? null
          : Number(draft.weight_kg.replace(',', '.'));

      const parsedRepsMin =
        draft.reps_min.trim() === '' ? null : Number(draft.reps_min);

      const parsedRepsMax =
        draft.reps_max.trim() === '' ? null : Number(draft.reps_max);

      const parsedRestSeconds =
        draft.rest_seconds.trim() === '' ? null : Number(draft.rest_seconds);

      const parsedBufferValue =
        draft.effort_type === 'buffer' && draft.buffer_value.trim() !== ''
          ? Number(draft.buffer_value)
          : null;

      if (parsedWeight !== null && Number.isNaN(parsedWeight)) {
        throw new Error('Il peso deve essere un numero valido.');
      }

      if (parsedRepsMin !== null && Number.isNaN(parsedRepsMin)) {
        throw new Error('Le ripetizioni minime devono essere un numero valido.');
      }

      if (parsedRepsMax !== null && Number.isNaN(parsedRepsMax)) {
        throw new Error('Le ripetizioni massime devono essere un numero valido.');
      }

      if (parsedRestSeconds !== null && Number.isNaN(parsedRestSeconds)) {
        throw new Error('La pausa deve essere un numero valido.');
      }

      if (draft.effort_type === 'buffer') {
        if (parsedBufferValue === null || Number.isNaN(parsedBufferValue)) {
          throw new Error('Inserisci un valore buffer valido.');
        }
      }

      await updateTemplateExerciseSet(setId, {
        set_type: draft.set_type,
        weight_kg: parsedWeight,
        reps_min: parsedRepsMin,
        reps_max: parsedRepsMax,
        rest_seconds: parsedRestSeconds,
        effort_type: draft.effort_type,
        buffer_value: draft.effort_type === 'buffer' ? parsedBufferValue : null,
        notes: draft.notes.trim() || null,
      });

      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Errore durante il salvataggio della serie.';
      Alert.alert('Impossibile salvare la serie', message);
    }
  };

  if (!setId || Number.isNaN(setId)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>ID serie non valido.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!setData || !draft) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Caricamento serie...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable style={styles.cancelButtonTop} onPress={() => router.back()}>
            <Text style={styles.cancelButtonTopText}>Chiudi</Text>
          </Pressable>
        </View>

        <Text style={styles.pageTitle}>Configura serie {setData.set_order}</Text>

        <View style={styles.card}>
          <View style={styles.typeRow}>
            <Pressable
              style={[
                styles.typePill,
                draft.set_type === 'warmup' && styles.typePillActive,
              ]}
              onPress={() => updateField('set_type', 'warmup')}
            >
              <Text
                style={[
                  styles.typePillText,
                  draft.set_type === 'warmup' && styles.typePillTextActive,
                ]}
              >
                Warmup
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typePill,
                draft.set_type === 'target' && styles.typePillActive,
              ]}
              onPress={() => updateField('set_type', 'target')}
            >
              <Text
                style={[
                  styles.typePillText,
                  draft.set_type === 'target' && styles.typePillTextActive,
                ]}
              >
                Target
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Peso (kg)</Text>
              <TextInput
                value={draft.weight_kg}
                onChangeText={(value) => updateField('weight_kg', value)}
                placeholder="Es. 62,5"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Pausa (s)</Text>
              <TextInput
                value={draft.rest_seconds}
                onChangeText={(value) => updateField('rest_seconds', value)}
                placeholder="Es. 90"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Reps min</Text>
              <TextInput
                value={draft.reps_min}
                onChangeText={(value) => updateField('reps_min', value)}
                placeholder="Es. 6"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Reps max</Text>
              <TextInput
                value={draft.reps_max}
                onChangeText={(value) => updateField('reps_max', value)}
                placeholder="Es. 8"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Tipo di sforzo</Text>
          <View style={styles.effortWrap}>
            {[
              { label: 'Nessuno', value: 'none' },
              { label: 'Buffer', value: 'buffer' },
              { label: 'Cedimento', value: 'failure' },
              { label: 'Drop set', value: 'drop_set' },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.effortPill,
                  draft.effort_type === option.value && styles.effortPillActive,
                ]}
                onPress={() =>
                  updateField(
                    'effort_type',
                    option.value as EditableSetValues['effort_type']
                  )
                }
              >
                <Text
                  style={[
                    styles.effortPillText,
                    draft.effort_type === option.value && styles.effortPillTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {draft.effort_type === 'buffer' && (
            <View style={styles.fullField}>
              <Text style={styles.label}>Valore buffer</Text>
              <TextInput
                value={draft.buffer_value}
                onChangeText={(value) => updateField('buffer_value', value)}
                placeholder="Es. 1"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.fullField}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              value={draft.notes}
              onChangeText={(value) => updateField('notes', value)}
              placeholder="Note extra, dettagli warmup, drop set, appunti..."
              placeholderTextColor={Colors.dark.textMuted}
              style={[styles.input, styles.notesInput]}
              multiline
            />
          </View>

          <View style={styles.actionsBottom}>
            <Pressable style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </Pressable>

            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salva serie</Text>
            </Pressable>
          </View>
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
    padding: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    color: Colors.dark.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    color: Colors.dark.textMuted,
    fontSize: 16,
  },
  topBar: {
    marginBottom: 12,
  },
  cancelButtonTop: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cancelButtonTopText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  typePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
  },
  typePillActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(126, 71, 255, 0.14)',
  },
  typePillText: {
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: Colors.dark.primarySoft,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
    marginBottom: 12,
  },
  fullField: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
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
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  effortWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  effortPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
  },
  effortPillActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(126, 71, 255, 0.14)',
  },
  effortPillText: {
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
  effortPillTextActive: {
    color: Colors.dark.primarySoft,
    fontWeight: '700',
  },
  actionsBottom: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cancelButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
});