import { Colors } from '@/constants/Colors';
import {
    getExercises,
    getWorkoutTemplates,
    saveHistoricalSession,
    type Exercise,
    type WorkoutTemplate
} from '@/database';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO() { return localISO(new Date()); }

function shiftDate(iso: string, delta: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return localISO(d);
}

function formatDate(iso: string) {
  const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const d = new Date(iso + 'T00:00:00');
  const ieri = new Date(); ieri.setDate(ieri.getDate() - 1);
  if (iso === todayISO()) return 'Oggi';
  if (iso === localISO(ieri)) return 'Ieri';
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type SetEntry = {
  id: string;
  set_type: 'warmup' | 'target';
  weight_kg: string;
  reps: string;
};

type ExerciseEntry = {
  id: string;
  exercise_name: string;
  category: string | null;
  sets: SetEntry[];
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogHistoricalScreen() {
  const router = useRouter();

  // Dati sessione
  const [date, setDate] = useState(todayISO());
  const [sessionName, setSessionName] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Sorgente (template o libero)
  const [mode, setMode] = useState<'choose' | 'template' | 'free'>('choose');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  useEffect(() => {
    getWorkoutTemplates().then(setTemplates).catch(() => {});
    getExercises().then(setAllExercises).catch(() => {});
  }, []);

  // Carica esercizi da template selezionato
  const loadFromTemplate = (template: WorkoutTemplate) => {
    setSessionName(template.name);
    setMode('template');
    // Template non ha esercizi precaricati qui — l'utente li aggiunge manualmente
    // ma partiamo con il nome già compilato
    setExercises([]);
  };

  const addExercise = (ex: Exercise) => {
    const entry: ExerciseEntry = {
      id: Date.now().toString(),
      exercise_name: ex.name,
      category: ex.category,
      sets: [{ id: Date.now().toString() + '_s', set_type: 'target', weight_kg: '', reps: '' }],
    };
    setExercises((prev) => [...prev, entry]);
    setShowExercisePicker(false);
    setExerciseSearch('');
  };

  const addFreeExercise = () => {
    const entry: ExerciseEntry = {
      id: Date.now().toString(),
      exercise_name: '',
      category: null,
      sets: [{ id: Date.now().toString() + '_s', set_type: 'target', weight_kg: '', reps: '' }],
    };
    setExercises((prev) => [...prev, entry]);
  };

  const updateExerciseName = (id: string, name: string) => {
    setExercises((prev) => prev.map((e) => e.id === id ? { ...e, exercise_name: name } : e));
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const addSet = (exerciseId: string) => {
    setExercises((prev) => prev.map((e) => e.id === exerciseId
      ? { ...e, sets: [...e.sets, { id: Date.now().toString(), set_type: 'target', weight_kg: '', reps: '' }] }
      : e
    ));
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises((prev) => prev.map((e) => e.id === exerciseId
      ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
      : e
    ));
  };

  const updateSet = (exerciseId: string, setId: string, field: 'weight_kg' | 'reps' | 'set_type', value: string) => {
    setExercises((prev) => prev.map((e) => e.id === exerciseId
      ? { ...e, sets: e.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s) }
      : e
    ));
  };

  const handleSave = async () => {
    if (!sessionName.trim()) {
      Alert.alert('Nome mancante', 'Inserisci un nome per la sessione.');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Nessun esercizio', 'Aggiungi almeno un esercizio.');
      return;
    }

    try {
      setSaving(true);
      await saveHistoricalSession({
        date,
        name: sessionName.trim(),
        notes: notes.trim() || null,
        templateId: null,
        exercises: exercises.map((e) => ({
          exercise_name: e.exercise_name || 'Esercizio',
          category: e.category,
          sets: e.sets.map((s) => ({
            weight_kg: parseFloat(s.weight_kg.replace(',', '.')) || null,
            reps: parseInt(s.reps) || null,
            set_type: s.set_type,
          })),
        })),
      });
      Alert.alert('Salvato!', 'Allenamento registrato correttamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Impossibile salvare la sessione.');
    } finally {
      setSaving(false);
    }
  };

  const filteredExercises = allExercises.filter((e) =>
    !exerciseSearch.trim() || e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  // ─── Choose mode ───────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backBtnText}>‹ Indietro</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Allenamento pregresso</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView contentContainerStyle={styles.choosePad}>
          <Text style={styles.chooseTitle}>Come vuoi registrare l’allenamento?</Text>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => setMode('template')}
            activeOpacity={0.85}
          >
            <Text style={styles.modeEmoji}>📋</Text>
            <Text style={styles.modeLabel}>Da template</Text>
            <Text style={styles.modeDesc}>Parti da un template esistente e inserisci i dati reali.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => setMode('free')}
            activeOpacity={0.85}
          >
            <Text style={styles.modeEmoji}>✏️</Text>
            <Text style={styles.modeLabel}>Libero</Text>
            <Text style={styles.modeDesc}>Aggiungi esercizi uno per uno e inserisci pesi e reps.</Text>
          </TouchableOpacity>

          {mode === 'choose' && templates.length > 0 && (
            <View style={styles.templateList}>
              <Text style={styles.templateListTitle}>Template disponibili</Text>
              {templates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.templateChip}
                  onPress={() => loadFromTemplate(t)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.templateChipText}>{t.name}</Text>
                  <Text style={styles.templateChipArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMode('choose')} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>‹ Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registra sessione</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saving ? '...' : 'Salva'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.formPad}
          keyboardShouldPersistTaps="handled"
        >
          {/* Data */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Data allenamento</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() => setDate(shiftDate(date, -1))}
                activeOpacity={0.8}
              >
                <Text style={styles.dateArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.dateLabel}>{formatDate(date)}</Text>
              <TouchableOpacity
                style={[styles.dateArrow, date >= todayISO() && { opacity: 0.3 }]}
                onPress={() => date < todayISO() && setDate(shiftDate(date, 1))}
                disabled={date >= todayISO()}
                activeOpacity={0.8}
              >
                <Text style={styles.dateArrowText}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nome */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nome sessione *</Text>
            <TextInput
              value={sessionName}
              onChangeText={setSessionName}
              placeholder="Es. Push A, Full Body..."
              placeholderTextColor={Colors.dark.textMuted}
              style={styles.input}
            />
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Note</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Come ti sei sentito, condizioni..."
              placeholderTextColor={Colors.dark.textMuted}
              style={[styles.input, { height: 80 }]}
              multiline
            />
          </View>

          {/* Esercizi */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Esercizi</Text>

            {exercises.map((ex, exIdx) => (
              <View key={ex.id} style={styles.exerciseCard}>
                {/* Nome esercizio */}
                <View style={styles.exerciseHeader}>
                  <TextInput
                    value={ex.exercise_name}
                    onChangeText={(v) => updateExerciseName(ex.id, v)}
                    placeholder="Nome esercizio"
                    placeholderTextColor={Colors.dark.textMuted}
                    style={styles.exerciseNameInput}
                  />
                  <TouchableOpacity
                    onPress={() => removeExercise(ex.id)}
                    style={styles.removeBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Header colonne serie */}
                <View style={styles.setHeaderRow}>
                  <Text style={styles.setHeaderCell}>Tipo</Text>
                  <Text style={[styles.setHeaderCell, { flex: 2 }]}>Peso (kg)</Text>
                  <Text style={[styles.setHeaderCell, { flex: 2 }]}>Reps</Text>
                  <View style={{ width: 28 }} />
                </View>

                {/* Serie */}
                {ex.sets.map((s, sIdx) => (
                  <View key={s.id} style={styles.setRow}>
                    <TouchableOpacity
                      style={[styles.setTypeBadge, s.set_type === 'warmup' && styles.setTypeBadgeWarmup]}
                      onPress={() => updateSet(ex.id, s.id, 'set_type', s.set_type === 'target' ? 'warmup' : 'target')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.setTypeBadgeText}>
                        {s.set_type === 'warmup' ? 'W' : `${sIdx + 1}`}
                      </Text>
                    </TouchableOpacity>

                    <TextInput
                      value={s.weight_kg}
                      onChangeText={(v) => updateSet(ex.id, s.id, 'weight_kg', v)}
                      placeholder="—"
                      placeholderTextColor={Colors.dark.textMuted}
                      keyboardType="decimal-pad"
                      style={[styles.setInput, { flex: 2 }]}
                    />

                    <TextInput
                      value={s.reps}
                      onChangeText={(v) => updateSet(ex.id, s.id, 'reps', v)}
                      placeholder="—"
                      placeholderTextColor={Colors.dark.textMuted}
                      keyboardType="number-pad"
                      style={[styles.setInput, { flex: 2 }]}
                    />

                    <TouchableOpacity
                      onPress={() => ex.sets.length > 1 && removeSet(ex.id, s.id)}
                      style={[styles.removeSetBtn, ex.sets.length <= 1 && { opacity: 0.3 }]}
                      disabled={ex.sets.length <= 1}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.removeSetBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addSetBtn}
                  onPress={() => addSet(ex.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addSetBtnText}>+ Serie</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Aggiungi esercizio */}
            <TouchableOpacity
              style={styles.addExerciseBtn}
              onPress={() => setShowExercisePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.addExerciseBtnText}>+ Aggiungi esercizio</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Picker esercizi */}
      <Modal
        visible={showExercisePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Scegli esercizio</Text>
            <TouchableOpacity
              onPress={() => setShowExercisePicker(false)}
              style={styles.pickerCloseBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerCloseBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={exerciseSearch}
            onChangeText={setExerciseSearch}
            placeholder="Cerca..."
            placeholderTextColor={Colors.dark.textMuted}
            style={styles.pickerSearch}
            autoFocus
          />

          <ScrollView contentContainerStyle={styles.pickerList} keyboardShouldPersistTaps="handled">
            {filteredExercises.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={styles.pickerItem}
                onPress={() => addExercise(ex)}
                activeOpacity={0.85}
              >
                <Text style={styles.pickerItemName}>{ex.name}</Text>
                {ex.category && <Text style={styles.pickerItemCat}>{ex.category}</Text>}
              </TouchableOpacity>
            ))}
            {filteredExercises.length === 0 && (
              <Text style={styles.pickerEmpty}>Nessun esercizio trovato</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  backBtnText: { color: Colors.dark.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text },
  saveBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Choose mode
  choosePad: { padding: 20, gap: 14 },
  chooseTitle: { fontSize: 20, fontWeight: '800', color: Colors.dark.text, marginBottom: 8 },
  modeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  modeEmoji: { fontSize: 32 },
  modeLabel: { fontSize: 18, fontWeight: '700', color: Colors.dark.text },
  modeDesc: { fontSize: 14, color: Colors.dark.textMuted, lineHeight: 20 },
  templateList: { gap: 8, marginTop: 8 },
  templateListTitle: { fontSize: 13, fontWeight: '700', color: Colors.dark.textMuted, marginBottom: 4 },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.3)',
  },
  templateChipText: { fontSize: 15, fontWeight: '600', color: Colors.dark.text },
  templateChipArrow: { fontSize: 18, color: Colors.dark.primary },

  // Form
  formPad: { padding: 20, gap: 20, paddingBottom: 60 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.dark.textMuted },
  input: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  dateArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dateArrowText: { fontSize: 22, color: Colors.dark.text, fontWeight: '600' },
  dateLabel: { fontSize: 16, fontWeight: '700', color: Colors.dark.text },

  // Esercizi
  exerciseCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
    marginBottom: 10,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseNameInput: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  removeBtn: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: Colors.dark.danger, fontSize: 13, fontWeight: '800' },

  setHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  setHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', color: Colors.dark.textMuted, textAlign: 'center' },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTypeBadgeWarmup: { backgroundColor: Colors.dark.border },
  setTypeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  setInput: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  removeSetBtn: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSetBtnText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '800' },
  addSetBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  addSetBtnText: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '700' },
  addExerciseBtn: {
    backgroundColor: 'rgba(126,71,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.35)',
    borderStyle: 'dashed',
  },
  addExerciseBtnText: { color: Colors.dark.primary, fontSize: 15, fontWeight: '700' },

  // Picker
  pickerContainer: { flex: 1, backgroundColor: Colors.dark.background, paddingTop: 12 },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text },
  pickerCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pickerCloseBtnText: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '600' },
  pickerSearch: {
    margin: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
  },
  pickerList: { paddingHorizontal: 16, paddingBottom: 40, gap: 6 },
  pickerItem: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 2,
  },
  pickerItemName: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  pickerItemCat: { fontSize: 12, color: Colors.dark.textMuted },
  pickerEmpty: { textAlign: 'center', color: Colors.dark.textMuted, paddingTop: 40, fontSize: 14 },
});