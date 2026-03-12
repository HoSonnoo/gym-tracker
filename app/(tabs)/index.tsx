import { Colors } from '@/constants/Colors';
import {
  completeWorkoutSession,
  getActiveWorkoutSession,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  getWorkoutTemplates,
  startWorkoutSessionFromTemplate,
  updateWorkoutSessionSet,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
  type WorkoutTemplate,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';

type SessionExerciseWithSets = {
  exercise: WorkoutSessionExercise;
  sets: WorkoutSessionSet[];
};

type SetFormState = {
  actual_weight_kg: string;
  actual_reps: string;
  actual_notes: string;
};

export default function TodayScreen() {
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [savingSetId, setSavingSetId] = useState<number | null>(null);
  const [finishingSession, setFinishingSession] = useState(false);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [sessionData, setSessionData] = useState<SessionExerciseWithSets[]>([]);
  const [setForms, setSetForms] = useState<Record<number, SetFormState>>({});

  const loadScreenData = useCallback(async () => {
    setLoading(true);

    try {
      const [templatesData, activeSessionData] = await Promise.all([
        getWorkoutTemplates(),
        getActiveWorkoutSession(),
      ]);

      setTemplates(templatesData);
      setActiveSession(activeSessionData);

      if (!activeSessionData) {
        setSessionData([]);
        setSetForms({});
        return;
      }

      const exercises = await getWorkoutSessionExercises(activeSessionData.id);

      const exercisesWithSets = await Promise.all(
        exercises.map(async (exercise) => {
          const sets = await getWorkoutSessionSets(exercise.id);

          return {
            exercise,
            sets,
          };
        })
      );

      const initialForms: Record<number, SetFormState> = {};

      for (const item of exercisesWithSets) {
        for (const set of item.sets) {
          initialForms[set.id] = {
            actual_weight_kg:
              set.actual_weight_kg !== null ? String(set.actual_weight_kg) : '',
            actual_reps:
              set.actual_reps !== null ? String(set.actual_reps) : '',
            actual_notes: set.actual_notes ?? '',
          };
        }
      }

      setSessionData(exercisesWithSets);
      setSetForms(initialForms);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare la schermata di oggi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadScreenData();
    }, [loadScreenData])
  );

  const completedSetsCount = useMemo(() => {
    return sessionData.reduce((total, item) => {
      return total + item.sets.filter((set) => set.is_completed === 1).length;
    }, 0);
  }, [sessionData]);

  const totalSetsCount = useMemo(() => {
    return sessionData.reduce((total, item) => total + item.sets.length, 0);
  }, [sessionData]);

  const updateSetField = (
    setId: number,
    field: keyof SetFormState,
    value: string
  ) => {
    setSetForms((prev) => ({
      ...prev,
      [setId]: {
        ...prev[setId],
        [field]: value,
      },
    }));
  };

  const parseNullableNumber = (value: string): number | null => {
    const normalized = value.replace(',', '.').trim();

    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const formatTargetReps = (set: WorkoutSessionSet) => {
    if (set.target_reps_min && set.target_reps_max) {
      if (set.target_reps_min === set.target_reps_max) {
        return `${set.target_reps_min}`;
      }

      return `${set.target_reps_min}-${set.target_reps_max}`;
    }

    if (set.target_reps_min) return `${set.target_reps_min}`;
    if (set.target_reps_max) return `${set.target_reps_max}`;

    return '—';
  };

  const formatTargetWeight = (set: WorkoutSessionSet) => {
    if (set.target_weight_kg === null) return '—';
    return `${set.target_weight_kg} kg`;
  };

  const formatRest = (set: WorkoutSessionSet) => {
    if (set.target_rest_seconds === null) return '—';
    return `${set.target_rest_seconds}s`;
  };

  const formatSetType = (set: WorkoutSessionSet) => {
    return set.target_set_type === 'warmup' ? 'Warmup' : 'Target';
  };

  const handleStartSession = async (templateId: number) => {
    try {
      setStartingSession(true);
      await startWorkoutSessionFromTemplate(templateId);
      await loadScreenData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossibile avviare la sessione.';
      Alert.alert('Errore', message);
    } finally {
      setStartingSession(false);
    }
  };

  const handleSaveSet = async (set: WorkoutSessionSet) => {
    const form = setForms[set.id];

    if (!form) return;

    try {
      setSavingSetId(set.id);

      await updateWorkoutSessionSet(set.id, {
        actual_weight_kg: parseNullableNumber(form.actual_weight_kg),
        actual_reps: parseNullableNumber(form.actual_reps),
        actual_effort_type: null,
        actual_buffer_value: null,
        actual_rir: null,
        actual_notes: form.actual_notes.trim() || null,
        is_completed: 1,
      });

      await loadScreenData();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare la serie.');
    } finally {
      setSavingSetId(null);
    }
  };

  const handleUncheckSet = async (set: WorkoutSessionSet) => {
    const form = setForms[set.id];

    try {
      setSavingSetId(set.id);

      await updateWorkoutSessionSet(set.id, {
        actual_weight_kg: parseNullableNumber(form?.actual_weight_kg ?? ''),
        actual_reps: parseNullableNumber(form?.actual_reps ?? ''),
        actual_effort_type: null,
        actual_buffer_value: null,
        actual_rir: null,
        actual_notes: form?.actual_notes?.trim() || null,
        is_completed: 0,
      });

      await loadScreenData();
    } catch {
      Alert.alert('Errore', 'Impossibile aggiornare la serie.');
    } finally {
      setSavingSetId(null);
    }
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;

    const incompleteSets = totalSetsCount - completedSetsCount;

    const proceed = async () => {
      try {
        setFinishingSession(true);
        await completeWorkoutSession(activeSession.id);
        await loadScreenData();
      } catch {
        Alert.alert('Errore', 'Impossibile completare la sessione.');
      } finally {
        setFinishingSession(false);
      }
    };

    if (incompleteSets > 0) {
      Alert.alert(
        'Serie non completate',
        `Ci sono ancora ${incompleteSets} serie non completate. Vuoi chiudere comunque l’allenamento?`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Conferma', onPress: proceed },
        ]
      );
      return;
    }

    await proceed();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Oggi</Text>

      {!activeSession ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allenamento del giorno</Text>
            <Text style={styles.cardText}>
              Seleziona un template per generare una sessione reale di
              allenamento.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stato</Text>
            <Text style={styles.cardText}>
              Nessun allenamento attivo in questo momento.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scegli un template</Text>

            {templates.length === 0 ? (
              <Text style={styles.cardText}>
                Non hai ancora creato template di allenamento.
              </Text>
            ) : (
              <View style={styles.templateList}>
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateButton}
                    onPress={() => handleStartSession(template.id)}
                    activeOpacity={0.85}
                    disabled={startingSession}
                  >
                    <View style={styles.templateButtonContent}>
                      <Text style={styles.templateButtonTitle}>
                        {template.name}
                      </Text>

                      {template.notes ? (
                        <Text style={styles.templateButtonText}>
                          {template.notes}
                        </Text>
                      ) : (
                        <Text style={styles.templateButtonTextMuted}>
                          Nessuna nota
                        </Text>
                      )}
                    </View>

                    <Text style={styles.templateButtonAction}>
                      {startingSession ? 'Avvio...' : 'Inizia'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{activeSession.name}</Text>
            <Text style={styles.cardText}>
              Sessione attiva. Compila le serie e salva i dati reali man mano che
              procedi.
            </Text>

            <View style={styles.sessionStatsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeLabel}>Completate</Text>
                <Text style={styles.statBadgeValue}>
                  {completedSetsCount}/{totalSetsCount}
                </Text>
              </View>

              <View style={styles.statBadge}>
                <Text style={styles.statBadgeLabel}>Stato</Text>
                <Text style={styles.statBadgeValue}>Attiva</Text>
              </View>
            </View>
          </View>

          {sessionData.map(({ exercise, sets }) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseTitle}>{exercise.exercise_name}</Text>
                  <Text style={styles.exerciseSubtitle}>
                    {exercise.category || 'Nessuna categoria'}
                  </Text>
                </View>
              </View>

              {exercise.notes ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Note esercizio</Text>
                  <Text style={styles.noteText}>{exercise.notes}</Text>
                </View>
              ) : null}

              <View style={styles.setsList}>
                {sets.map((set, index) => {
                  const form = setForms[set.id] ?? {
                    actual_weight_kg: '',
                    actual_reps: '',
                    actual_notes: '',
                  };

                  const isSaving = savingSetId === set.id;
                  const isCompleted = set.is_completed === 1;

                  return (
                    <View
                      key={set.id}
                      style={[
                        styles.setCard,
                        isCompleted && styles.setCardCompleted,
                      ]}
                    >
                      <View style={styles.setHeaderRow}>
                        <Text style={styles.setTitle}>
                          Serie {index + 1} · {formatSetType(set)}
                        </Text>

                        <View
                          style={[
                            styles.statusPill,
                            isCompleted && styles.statusPillCompleted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              isCompleted && styles.statusPillTextCompleted,
                            ]}
                          >
                            {isCompleted ? 'Completata' : 'Da fare'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.targetGrid}>
                        <View style={styles.targetBox}>
                          <Text style={styles.targetLabel}>Target peso</Text>
                          <Text style={styles.targetValue}>
                            {formatTargetWeight(set)}
                          </Text>
                        </View>

                        <View style={styles.targetBox}>
                          <Text style={styles.targetLabel}>Target reps</Text>
                          <Text style={styles.targetValue}>
                            {formatTargetReps(set)}
                          </Text>
                        </View>

                        <View style={styles.targetBox}>
                          <Text style={styles.targetLabel}>Pausa</Text>
                          <Text style={styles.targetValue}>{formatRest(set)}</Text>
                        </View>

                        <View style={styles.targetBox}>
                          <Text style={styles.targetLabel}>Sforzo</Text>
                          <Text style={styles.targetValue}>
                            {set.target_effort_type}
                          </Text>
                        </View>
                      </View>

                      {set.target_notes ? (
                        <View style={styles.noteBox}>
                          <Text style={styles.noteLabel}>Note target</Text>
                          <Text style={styles.noteText}>{set.target_notes}</Text>
                        </View>
                      ) : null}

                      <View style={styles.inputsRow}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Peso reale</Text>
                          <TextInput
                            value={form.actual_weight_kg}
                            onChangeText={(value) =>
                              updateSetField(set.id, 'actual_weight_kg', value)
                            }
                            placeholder="Es. 60"
                            placeholderTextColor={Colors.dark.textMuted}
                            keyboardType="decimal-pad"
                            style={styles.input}
                          />
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Reps reali</Text>
                          <TextInput
                            value={form.actual_reps}
                            onChangeText={(value) =>
                              updateSetField(set.id, 'actual_reps', value)
                            }
                            placeholder="Es. 8"
                            placeholderTextColor={Colors.dark.textMuted}
                            keyboardType="number-pad"
                            style={styles.input}
                          />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Note serie</Text>
                        <TextInput
                          value={form.actual_notes}
                          onChangeText={(value) =>
                            updateSetField(set.id, 'actual_notes', value)
                          }
                          placeholder="Note opzionali"
                          placeholderTextColor={Colors.dark.textMuted}
                          multiline
                          style={[styles.input, styles.notesInput]}
                        />
                      </View>

                      <View style={styles.setActions}>
                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            isSaving && styles.disabledButton,
                          ]}
                          onPress={() => handleSaveSet(set)}
                          disabled={isSaving}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.primaryButtonText}>
                            {isSaving
                              ? 'Salvataggio...'
                              : isCompleted
                              ? 'Aggiorna serie'
                              : 'Completa serie'}
                          </Text>
                        </TouchableOpacity>

                        {isCompleted ? (
                          <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => handleUncheckSet(set)}
                            disabled={isSaving}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.secondaryButtonText}>
                              Segna come non completata
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.finishButton,
              finishingSession && styles.disabledButton,
            ]}
            onPress={handleCompleteSession}
            disabled={finishingSession}
            activeOpacity={0.9}
          >
            <Text style={styles.finishButtonText}>
              {finishingSession ? 'Chiusura allenamento...' : 'Completa allenamento'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 8,
    marginBottom: 8,
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
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.textMuted,
  },
  templateList: {
    gap: 12,
    marginTop: 8,
  },
  templateButton: {
    backgroundColor: '#17171c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  templateButtonContent: {
    flex: 1,
  },
  templateButtonTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateButtonText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  templateButtonTextMuted: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  templateButtonAction: {
    color: PRIMARY,
    fontWeight: '700',
    fontSize: 14,
  },
  sessionStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statBadge: {
    flex: 1,
    backgroundColor: '#17171c',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statBadgeLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  statBadgeValue: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 14,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '800',
  },
  exerciseSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  setsList: {
    gap: 14,
  },
  setCard: {
    backgroundColor: '#141419',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  setCardCompleted: {
    borderColor: PRIMARY,
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  setTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusPill: {
    backgroundColor: '#24242b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillCompleted: {
    backgroundColor: 'rgba(126, 71, 255, 0.18)',
  },
  statusPillText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillTextCompleted: {
    color: PRIMARY,
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  targetBox: {
    width: '48%',
    backgroundColor: '#1a1a21',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  targetLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  targetValue: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#1a1a21',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  noteLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  noteText: {
    color: Colors.dark.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#101015',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    color: Colors.dark.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  setActions: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '700',
  },
  finishButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
});