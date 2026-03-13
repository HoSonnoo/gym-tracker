import { Colors } from '@/constants/Colors';
import {
  getActiveWorkoutSession,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  getWorkoutTemplates,
  startWorkoutSessionFromTemplate,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
  type WorkoutTemplate,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';

type SessionExerciseWithSets = {
  exercise: WorkoutSessionExercise;
  sets: WorkoutSessionSet[];
};

export default function TodayScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [sessionData, setSessionData] = useState<SessionExerciseWithSets[]>([]);

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

      setSessionData(exercisesWithSets);
    } catch {
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

  const allSets = useMemo(() => {
    return sessionData.flatMap((item) => item.sets);
  }, [sessionData]);

  const completedSetsCount = useMemo(() => {
    return allSets.filter((set) => set.is_completed === 1).length;
  }, [allSets]);

  const totalSetsCount = useMemo(() => {
    return allSets.length;
  }, [allSets]);

  const remainingSetsCount = totalSetsCount - completedSetsCount;

  const handleStartSession = async (templateId: number) => {
    try {
      setStartingSession(true);
      const sessionId = await startWorkoutSessionFromTemplate(templateId);
      await loadScreenData();
      router.push(`/workout-session/${sessionId}`);
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

  const handleOpenActiveSession = () => {
    if (!activeSession) return;
    router.push(`/workout-session/${activeSession.id}`);
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
            <Text style={styles.cardTitle}>Allenamento del giorno</Text>
            <Text style={styles.activeSessionTitle}>{activeSession.name}</Text>
            <Text style={styles.cardText}>
              Sessione attiva generata dal template selezionato.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.card, styles.clickableCard]}
            activeOpacity={0.88}
            onPress={handleOpenActiveSession}
          >
            <Text style={styles.cardTitle}>Sessione attiva</Text>
            <Text style={styles.cardText}>
              Hai un allenamento in corso. Apri la schermata dedicata per
              compilare rapidamente le serie.
            </Text>

            <View style={styles.sessionStatsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeLabel}>Completate</Text>
                <Text style={styles.statBadgeValue}>
                  {completedSetsCount}/{totalSetsCount}
                </Text>
              </View>

              <View style={styles.statBadge}>
                <Text style={styles.statBadgeLabel}>Rimanenti</Text>
                <Text style={styles.statBadgeValue}>{remainingSetsCount}</Text>
              </View>
            </View>

            <View style={styles.nextSetButton}>
              <Text style={styles.nextSetButtonText}>
                Apri allenamento attivo
              </Text>
            </View>
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
  clickableCard: {
    borderColor: 'rgba(126, 71, 255, 0.35)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  activeSessionTitle: {
    fontSize: 22,
    fontWeight: '800',
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
  nextSetButton: {
    marginTop: 14,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextSetButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});