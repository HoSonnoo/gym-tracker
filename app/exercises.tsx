import { Colors } from '@/constants/Colors';
import {
  addExercise,
  deleteExercise,
  Exercise,
  getExercises,
  updateExercise,
} from '@/database';
import { useGuestLimits } from '@/hooks/use-guest-limits';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExercisesScreen() {
  const router = useRouter();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const { checkExerciseLimit } = useGuestLimits();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [renamingExercise, setRenamingExercise] = useState<Exercise | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadExercises = useCallback(async () => {
    try {
      const data = await getExercises();
      setExercises(data);
    } catch (error) {
      console.error('Errore caricamento esercizi:', error);
    }
  }, []);

  const handleAddExercise = useCallback(async () => {
    if (!checkExerciseLimit(exercises.length)) return;
    try {
      setIsSaving(true);
      await addExercise(name, category);
      setName('');
      setCategory('');
      await loadExercises();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Errore durante il salvataggio dell’esercizio.';
      Alert.alert('Impossibile aggiungere l’esercizio', message);
    } finally {
      setIsSaving(false);
    }
  }, [name, category, loadExercises]);

  const handleRenameExercise = (exercise: Exercise) => {
    setRenameValue(exercise.name);
    setRenamingExercise(exercise);
  };

  const handleConfirmRename = async () => {
    if (!renamingExercise || !renameValue.trim()) return;
    if (renameValue.trim() === renamingExercise.name) {
      setRenamingExercise(null);
      return;
    }
    try {
      await updateExercise(renamingExercise.id, renameValue.trim());
      setRenamingExercise(null);
      await loadExercises();
    } catch {
      Alert.alert('Errore', `Impossibile rinominare l’esercizio.`);
    }
  };

  const handleDeleteExercise = useCallback(
    (exercise: Exercise) => {
      Alert.alert(
        'Rimuovi esercizio',
        `Vuoi eliminare "${exercise.name}"?`,
        [
          {
            text: 'Annulla',
            style: 'cancel',
          },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteExercise(exercise.id);
                await loadExercises();
              } catch (error) {
                Alert.alert(
                  'Impossibile rimuovere l’esercizio',
                  'Si è verificato un errore durante l’eliminazione.'
                );
              }
            },
          },
        ]
      );
    },
    [loadExercises]
  );

  useFocusEffect(
    useCallback(() => {
      loadExercises();
    }, [loadExercises])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Indietro</Text>
          </Pressable>
        </View>

        <Text style={styles.pageTitle}>Gestisci esercizi</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nuovo esercizio</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nome esercizio"
            placeholderTextColor={Colors.dark.textMuted}
            style={styles.input}
          />

          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Categoria (es. Petto, Schiena...)"
            placeholderTextColor={Colors.dark.textMuted}
            style={styles.input}
          />

          <Pressable
            style={[styles.button, isSaving && styles.buttonDisabled]}
            onPress={handleAddExercise}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>
              {isSaving ? 'Salvataggio...' : 'Aggiungi esercizio'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>I tuoi esercizi</Text>
          <Text style={styles.sectionDescription}>
            Qui puoi aggiungere e rimuovere gli esercizi disponibili nel database.
          </Text>
        </View>

        {/* Modal rinomina esercizio */}
        <Modal
          visible={!!renamingExercise}
          transparent
          animationType="fade"
          onRequestClose={() => setRenamingExercise(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.renameOverlay}
          >
            <View style={styles.renameModal}>
              <Text style={styles.renameModalTitle}>Rinomina esercizio</Text>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                style={styles.renameInput}
                placeholder="Nuovo nome"
                placeholderTextColor={Colors.dark.textMuted}
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.renameModalActions}>
                <Pressable style={styles.renameConfirmBtn} onPress={handleConfirmRename}>
                  <Text style={styles.renameConfirmBtnText}>Salva</Text>
                </Pressable>
                <Pressable style={styles.renameCancelBtn} onPress={() => setRenamingExercise(null)}>
                  <Text style={styles.renameCancelBtnText}>Annulla</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          scrollIndicatorInsets={{ right: 1 }}
          renderItem={({ item }) => (
            <View style={styles.exerciseItem}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseTextContainer}>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <Text style={styles.exerciseCategory}>
                    {item.category ?? 'Nessuna categoria'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={styles.renameButton}
                    onPress={() => handleRenameExercise(item)}
                  >
                    <Text style={styles.renameButtonText}>Modifica</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeleteExercise(item)}
                  >
                    <Text style={styles.deleteButtonText}>Elimina</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nessun esercizio trovato</Text>
              <Text style={styles.cardText}>
                Aggiungi il primo esercizio dal form qui sopra.
              </Text>
            </View>
          }
        />
      </View>
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
    paddingTop: 8,
  },
  topBar: {
    paddingHorizontal: 20,
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
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.textMuted,
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
  sectionHeader: {
    marginBottom: 16,
    paddingHorizontal: 20,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  exerciseItem: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  exerciseTextContainer: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  exerciseCategory: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  renameButton: {
    backgroundColor: 'rgba(126,71,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.35)',
  },
  renameButtonText: {
    color: '#7e47ff',
    fontSize: 13,
    fontWeight: '700',
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  renameModal: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 14,
  },
  renameModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  renameInput: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
  },
  renameModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  renameConfirmBtn: {
    flex: 1,
    backgroundColor: '#7e47ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  renameConfirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  renameCancelBtn: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  renameCancelBtnText: {
    color: Colors.dark.textMuted,
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
});