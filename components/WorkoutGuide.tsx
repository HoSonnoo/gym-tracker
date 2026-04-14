import { Colors } from '@/constants/Colors';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export type OnboardingPhase = 'empty' | 'has_exercises' | 'ready';

export default function WorkoutGuide({
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
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Allenamenti</Text>

      {/* Benvenuto */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeEmoji}>💪</Text>
        <Text style={styles.welcomeTitle}>Benvenuto in Allenamento</Text>
        <Text style={styles.welcomeText}>
          Inizia configurando il tuo primo allenamento. Ci vogliono solo pochi minuti.
        </Text>
      </View>

      {/* Step 1 */}
      <View style={[
        styles.stepCard,
        phase !== 'empty' && styles.stepCardCompleted,
      ]}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepBadge,
            phase !== 'empty' && styles.stepBadgeDone,
          ]}>
            <Text style={styles.stepBadgeText}>
              {phase !== 'empty' ? '✓' : '1'}
            </Text>
          </View>
          <Text style={[
            styles.stepTitle,
            phase !== 'empty' && styles.stepTitleDone,
          ]}>
            Aggiungi i tuoi esercizi
          </Text>
        </View>
        {phase === 'empty' && (
          <>
            <Text style={styles.stepText}>
              Gli esercizi sono il catalogo base da cui costruisci i tuoi template. Aggiungine quanti ne vuoi: panca piana, squat, lat machine...
            </Text>
            <Pressable style={styles.stepButton} onPress={onManageExercises}>
              <Text style={styles.stepButtonText}>Gestisci esercizi →</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Step 2 */}
      <View style={[
        styles.stepCard,
        phase === 'empty' && styles.stepCardMuted,
      ]}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepBadge,
            phase === 'empty' && styles.stepBadgeMuted,
          ]}>
            <Text style={[
              styles.stepBadgeText,
              phase === 'empty' && styles.stepBadgeTextMuted,
            ]}>
              2
            </Text>
          </View>
          <Text style={[
            styles.stepTitle,
            phase === 'empty' && { color: Colors.dark.textMuted },
          ]}>
            Crea un template
          </Text>
        </View>

        {phase === 'has_exercises' && (
          <>
            <Text style={styles.stepText}>
              Dai un nome al tuo primo template — ad esempio "Push A", "Full Body" o il giorno della settimana.
            </Text>
            <TextInput
              value={name}
              onChangeText={onNameChange}
              placeholder="Nome template (es. Push A)"
              placeholderTextColor={Colors.dark.textMuted}
              style={styles.input}
            />
            <TextInput
              value={notes}
              onChangeText={onNotesChange}
              placeholder="Note opzionali"
              placeholderTextColor={Colors.dark.textMuted}
              style={[styles.input, styles.notesInput]}
              multiline
            />
            <Pressable
              style={[styles.stepButton, isSaving && styles.stepButtonDisabled]}
              onPress={onCreateTemplate}
              disabled={isSaving}
            >
              <Text style={styles.stepButtonText}>
                {isSaving ? 'Creazione...' : 'Crea template →'}
              </Text>
            </Pressable>
          </>
        )}

        {phase === 'empty' && (
          <Text style={styles.stepTextMuted}>
            Disponibile dopo aver aggiunto almeno un esercizio.
          </Text>
        )}
      </View>

      {/* Step 3 */}
      <View style={[styles.stepCard, styles.stepCardMuted]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, styles.stepBadgeMuted]}>
            <Text style={[styles.stepBadgeText, styles.stepBadgeTextMuted]}>3</Text>
          </View>
          <Text style={[styles.stepTitle, { color: Colors.dark.textMuted }]}>
            Avvia la sessione dal tab Oggi
          </Text>
        </View>
        <Text style={styles.stepTextMuted}>
          Una volta creato il template, vai nel tab Oggi e selezionalo per avviare la sessione reale.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  stepCardCompleted: { borderColor: Colors.dark.success, backgroundColor: 'rgba(34,197,94,0.04)' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeMuted: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepBadgeDone: { backgroundColor: Colors.dark.success },
  stepBadgeText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  stepBadgeTextMuted: { color: Colors.dark.textMuted },
  stepTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  stepTitleDone: { color: Colors.dark.success },
  stepText: { fontSize: 14, lineHeight: 20, color: Colors.dark.textMuted },
  stepTextMuted: { fontSize: 14, lineHeight: 20, color: Colors.dark.textMuted },
  stepButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
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
