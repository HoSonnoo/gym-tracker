import { Colors } from '@/constants/Colors';
import {
  addWorkoutTemplate,
  deleteWorkoutTemplate,
  getWorkoutTemplates,
  WorkoutTemplate,
} from '@/database';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function WorkoutsScreen() {
  const router = useRouter();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await getWorkoutTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Errore caricamento template:', error);
    }
  }, []);

  const handleAddTemplate = useCallback(async () => {
    try {
      setIsSaving(true);
      await addWorkoutTemplate(name, notes);
      setName('');
      setNotes('');
      await loadTemplates();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Errore durante il salvataggio del template.';
      Alert.alert('Impossibile creare il template', message);
    } finally {
      setIsSaving(false);
    }
  }, [name, notes, loadTemplates]);

  const handleDeleteTemplate = useCallback(
    (template: WorkoutTemplate) => {
      Alert.alert(
        'Rimuovi template',
        `Vuoi eliminare "${template.name}"?`,
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
                await deleteWorkoutTemplate(template.id);
                await loadTemplates();
              } catch (error) {
                Alert.alert(
                  'Impossibile rimuovere il template',
                  'Si è verificato un errore durante l’eliminazione.'
                );
              }
            },
          },
        ]
      );
    },
    [loadTemplates]
  );

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [loadTemplates])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Allenamenti</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nuovo template</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome template (es. Push A)"
          placeholderTextColor={Colors.dark.textMuted}
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
          onPress={handleAddTemplate}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>
            {isSaving ? 'Salvataggio...' : 'Crea template'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push('/exercises')}
      >
        <Text style={styles.secondaryButtonText}>Gestisci esercizi</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>I tuoi template</Text>
        <Text style={styles.sectionDescription}>
          Qui compariranno le tue schede di allenamento da riutilizzare nei vari giorni.
        </Text>
      </View>

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        scrollIndicatorInsets={{ right: 1 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.templateItem}
            onPress={() => router.push(`/template/${item.id}`)}
          >
            <View style={styles.templateHeader}>
              <View style={styles.templateTextContainer}>
                <Text style={styles.templateName}>{item.name}</Text>
                <Text style={styles.templateNotes}>
                  {item.notes?.trim() || 'Nessuna nota'}
                </Text>
              </View>

              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteTemplate(item)}
              >
                <Text style={styles.deleteButtonText}>Elimina</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Nessun template trovato</Text>
            <Text style={styles.cardText}>
              Crea il tuo primo template dal form qui sopra.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 20,
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
    marginBottom: 14,
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
  notesInput: {
    minHeight: 88,
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
  secondaryButton: {
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryButtonText: {
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
  templateItem: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  templateTextContainer: {
    flex: 1,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  templateNotes: {
    fontSize: 14,
    color: Colors.dark.textMuted,
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
  },
});