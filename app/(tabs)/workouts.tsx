import { Colors } from '@/constants/Colors';
import {
  addWorkoutTemplate,
  deleteWorkoutTemplate,
  getWorkoutTemplates,
  hasExercises,
  hasTemplates,
  WorkoutTemplate,
} from '@/database';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';

type OnboardingPhase = 'empty' | 'has_exercises' | 'ready';

// ─── Onboarding Empty State ───────────────────────────────────────────────────

function OnboardingEmptyState({
  phase,
  name,
  notes,
  isSaving,
  onNameChange,
  onNotesChange,
  onCreateTemplate,
  onManageExercises,
}: {
  phase: OnboardingPhase;
  name: string;
  notes: string;
  isSaving: boolean;
  onNameChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onCreateTemplate: () => void;
  onManageExercises: () => void;
}) {
  return (
    <ScrollView
      style={onboardStyles.container}
      contentContainerStyle={onboardStyles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={onboardStyles.pageTitle}>Allenamenti</Text>

      {/* Benvenuto */}
      <View style={onboardStyles.welcomeCard}>
        <Text style={onboardStyles.welcomeEmoji}>💪</Text>
        <Text style={onboardStyles.welcomeTitle}>Benvenuto in GymTracker</Text>
        <Text style={onboardStyles.welcomeText}>
          Inizia configurando il tuo primo allenamento. Ci vogliono solo pochi minuti.
        </Text>
      </View>

      {/* Step 1 */}
      <View style={[
        onboardStyles.stepCard,
        phase !== 'empty' && onboardStyles.stepCardCompleted,
      ]}>
        <View style={onboardStyles.stepHeader}>
          <View style={[
            onboardStyles.stepBadge,
            phase !== 'empty' && onboardStyles.stepBadgeDone,
          ]}>
            <Text style={onboardStyles.stepBadgeText}>
              {phase !== 'empty' ? '✓' : '1'}
            </Text>
          </View>
          <Text style={[
            onboardStyles.stepTitle,
            phase !== 'empty' && onboardStyles.stepTitleDone,
          ]}>
            Aggiungi i tuoi esercizi
          </Text>
        </View>
        {phase === 'empty' && (
          <>
            <Text style={onboardStyles.stepText}>
              Gli esercizi sono il catalogo base da cui costruisci i tuoi template. Aggiungine quanti ne vuoi: panca piana, squat, lat machine...
            </Text>
            <Pressable style={onboardStyles.stepButton} onPress={onManageExercises}>
              <Text style={onboardStyles.stepButtonText}>Gestisci esercizi →</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Step 2 */}
      <View style={[
        onboardStyles.stepCard,
        phase === 'empty' && onboardStyles.stepCardMuted,
      ]}>
        <View style={onboardStyles.stepHeader}>
          <View style={[
            onboardStyles.stepBadge,
            phase === 'empty' && onboardStyles.stepBadgeMuted,
          ]}>
            <Text style={[
              onboardStyles.stepBadgeText,
              phase === 'empty' && onboardStyles.stepBadgeTextMuted,
            ]}>
              2
            </Text>
          </View>
          <Text style={[
            onboardStyles.stepTitle,
            phase === 'empty' && { color: Colors.dark.textMuted },
          ]}>
            Crea un template
          </Text>
        </View>

        {phase === 'has_exercises' && (
          <>
            <Text style={onboardStyles.stepText}>
              Dai un nome al tuo primo template — ad esempio "Push A", "Full Body" o il giorno della settimana.
            </Text>
            <TextInput
              value={name}
              onChangeText={onNameChange}
              placeholder="Nome template (es. Push A)"
              placeholderTextColor={Colors.dark.textMuted}
              style={onboardStyles.input}
            />
            <TextInput
              value={notes}
              onChangeText={onNotesChange}
              placeholder="Note opzionali"
              placeholderTextColor={Colors.dark.textMuted}
              style={[onboardStyles.input, onboardStyles.notesInput]}
              multiline
            />
            <Pressable
              style={[onboardStyles.stepButton, isSaving && onboardStyles.stepButtonDisabled]}
              onPress={onCreateTemplate}
              disabled={isSaving}
            >
              <Text style={onboardStyles.stepButtonText}>
                {isSaving ? 'Creazione...' : 'Crea template →'}
              </Text>
            </Pressable>
          </>
        )}

        {phase === 'empty' && (
          <Text style={onboardStyles.stepTextMuted}>
            Disponibile dopo aver aggiunto almeno un esercizio.
          </Text>
        )}
      </View>

      {/* Step 3 */}
      <View style={[onboardStyles.stepCard, onboardStyles.stepCardMuted]}>
        <View style={onboardStyles.stepHeader}>
          <View style={[onboardStyles.stepBadge, onboardStyles.stepBadgeMuted]}>
            <Text style={[onboardStyles.stepBadgeText, onboardStyles.stepBadgeTextMuted]}>3</Text>
          </View>
          <Text style={[onboardStyles.stepTitle, { color: Colors.dark.textMuted }]}>
            Avvia la sessione dal tab Oggi
          </Text>
        </View>
        <Text style={onboardStyles.stepTextMuted}>
          Una volta creato il template, vai nel tab Oggi e selezionalo per avviare la sessione reale.
        </Text>
      </View>
    </ScrollView>
  );
}

const onboardStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginTop: 8, marginBottom: 4 },
  welcomeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.35)',
    alignItems: 'center',
    gap: 10,
  },
  welcomeEmoji: { fontSize: 40 },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: Colors.dark.text, textAlign: 'center' },
  welcomeText: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted, textAlign: 'center' },
  stepCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  stepCardMuted: { opacity: 0.5 },
  stepCardCompleted: { borderColor: Colors.dark.success + '55' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeMuted: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepBadgeDone: { backgroundColor: Colors.dark.success },
  stepBadgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  stepBadgeTextMuted: { color: Colors.dark.textMuted },
  stepTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  stepTitleDone: { color: Colors.dark.success },
  stepText: { fontSize: 14, lineHeight: 20, color: Colors.dark.textMuted },
  stepTextMuted: { fontSize: 14, lineHeight: 20, color: Colors.dark.textMuted },
  stepButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stepButtonDisabled: { opacity: 0.6 },
  stepButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  notesInput: { minHeight: 80, textAlignVertical: 'top', marginTop: 8 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutsScreen() {
  const router = useRouter();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const [data, exs, tmps] = await Promise.all([
        getWorkoutTemplates(),
        hasExercises(),
        hasTemplates(),
      ]);
      setTemplates(data);
      if (tmps) {
        setPhase('ready');
      } else if (exs) {
        setPhase('has_exercises');
      } else {
        setPhase('empty');
      }
    } catch (error) {
      console.error('Errore caricamento template:', error);
      setPhase('ready');
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadTemplates(); }, [loadTemplates])
  );

const handleAddTemplate = useCallback(async () => {
  try {
    setIsSaving(true);
    const newTemplateId = await addWorkoutTemplate(name, notes);
    setName('');
    setNotes('');
    // Naviga direttamente dentro il template appena creato
    router.push(`/template/${newTemplateId}`);
    // Ricarica in background per aggiornare la lista al ritorno
    await loadTemplates();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Errore durante il salvataggio del template.';
    Alert.alert('Impossibile creare il template', message);
  } finally {
    setIsSaving(false);
  }
}, [name, notes, loadTemplates, router]);

  const handleDeleteTemplate = useCallback(
    (template: WorkoutTemplate) => {
      Alert.alert(
        'Rimuovi template',
        `Vuoi eliminare "${template.name}"?`,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWorkoutTemplate(template.id);
                await loadTemplates();
              } catch {
                Alert.alert('Impossibile rimuovere il template', 'Si è verificato un errore.');
              }
            },
          },
        ]
      );
    },
    [loadTemplates]
  );

  if (phase === null) return null;

  // Onboarding — DB non ancora pronto
  if (phase === 'empty' || phase === 'has_exercises') {
    return (
      <OnboardingEmptyState
        phase={phase}
        name={name}
        notes={notes}
        isSaving={isSaving}
        onNameChange={setName}
        onNotesChange={setNotes}
        onCreateTemplate={handleAddTemplate}
        onManageExercises={() => router.push('/exercises')}
      />
    );
  }

  // Stato normale
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

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/exercises')}>
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
              <Pressable style={styles.deleteButton} onPress={() => handleDeleteTemplate(item)}>
                <Text style={styles.deleteButtonText}>Elimina</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Nessun template trovato</Text>
            <Text style={styles.cardText}>Crea il tuo primo template dal form qui sopra.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, paddingTop: 20 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginTop: 8, marginBottom: 16, paddingHorizontal: 20 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 14, marginHorizontal: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, marginBottom: 12 },
  cardText: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  input: { backgroundColor: Colors.dark.background, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: Colors.dark.text, fontSize: 15, marginBottom: 12 },
  notesInput: { minHeight: 88, textAlignVertical: 'top' },
  button: { backgroundColor: Colors.dark.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' },
  secondaryButton: { marginHorizontal: 20, marginBottom: 18, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  secondaryButtonText: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' },
  sectionHeader: { marginBottom: 16, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: Colors.dark.text, marginBottom: 6 },
  sectionDescription: { fontSize: 15, lineHeight: 22, color: Colors.dark.textMuted },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  templateItem: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  templateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  templateTextContainer: { flex: 1 },
  templateName: { fontSize: 17, fontWeight: '700', color: Colors.dark.text, marginBottom: 4 },
  templateNotes: { fontSize: 14, color: Colors.dark.textMuted },
  deleteButton: { backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: Colors.dark.danger, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  deleteButtonText: { color: Colors.dark.danger, fontSize: 14, fontWeight: '700' },
  emptyCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border },
});