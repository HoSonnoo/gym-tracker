import { Colors } from '@/constants/Colors';
import {
  getExerciseVolumeSummary,
  getExerciseWeightHistory,
  getPersonalRecords,
  getWeeklyFrequency,
  type ExercisePR,
  type ExerciseVolume,
  type ExerciseWeightHistory,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(isoString: string): string {
  const MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const d = new Date(isoString);
  return `${d.getDate()} ${MESI_SHORT[d.getMonth()]} ${String(d.getFullYear())}`;
}

// Raggruppa le serie per sessione (completed_at + session_name)
type SessionGroup = {
  session_name: string;
  completed_at: string;
  sets: ExerciseWeightHistory[];
};

function groupBySession(history: ExerciseWeightHistory[]): SessionGroup[] {
  const map = new Map<string, SessionGroup>();
  for (const row of history) {
    const key = row.completed_at;
    if (!map.has(key)) {
      map.set(key, { session_name: row.session_name, completed_at: row.completed_at, sets: [] });
    }
    map.get(key)!.sets.push(row);
  }
  // Ordine cronologico inverso (più recente in cima)
  return Array.from(map.values()).reverse();
}

// ─── Segmented Control ────────────────────────────────────────────────────────

type TabKey = 'pr' | 'volume' | 'frequency';

function SegmentedControl({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'pr', label: 'PR' },
    { key: 'volume', label: 'Volume' },
    { key: 'frequency', label: 'Frequenza' },
  ];

  return (
    <View style={segStyles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[segStyles.tab, active === tab.key && segStyles.tabActive]}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.8}
        >
          <Text style={[segStyles.label, active === tab.key && segStyles.labelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const segStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: PRIMARY },
  label: { fontSize: 14, fontWeight: '700', color: Colors.dark.textMuted },
  labelActive: { color: '#fff' },
});

// ─── Exercise History Detail ──────────────────────────────────────────────────

function ExerciseHistoryDetail({
  exerciseName,
  onClose,
}: {
  exerciseName: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ExerciseWeightHistory[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    setLoading(true);
    getExerciseWeightHistory(exerciseName)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [exerciseName]);

  const groups = groupBySession(history);

  // Trova il PR (massimo peso) per evidenziarlo
  const maxWeight = history.length > 0
    ? Math.max(...history.map((h) => h.actual_weight_kg))
    : null;

  return (
    <View style={histStyles.container}>
      {/* Header */}
      <View style={histStyles.header}>
        <TouchableOpacity onPress={onClose} style={histStyles.backButton} activeOpacity={0.8}>
          <Text style={histStyles.backButtonText}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={histStyles.title} numberOfLines={1}>{exerciseName}</Text>
      </View>

      {loading ? (
        <View style={histStyles.loadingBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nessuno storico</Text>
          <Text style={styles.emptyText}>
            Non sono ancora stati registrati pesi per questo esercizio.
          </Text>
        </View>
      ) : (
        <View style={histStyles.list}>
          {groups.map((group) => (
            <View key={group.completed_at} style={histStyles.sessionCard}>
              {/* Data sessione */}
              <View style={histStyles.sessionHeader}>
                <Text style={histStyles.sessionDate}>
                  {formatDateShort(group.completed_at)}
                </Text>
                <Text style={histStyles.sessionName}>{group.session_name}</Text>
              </View>

              {/* Serie */}
              <View style={histStyles.setsList}>
                {group.sets.map((set, idx) => {
                  const isPR = set.actual_weight_kg === maxWeight;
                  return (
                    <View key={idx} style={histStyles.setRow}>
                      <Text style={histStyles.setIndex}>{idx + 1}</Text>
                      <View style={histStyles.setBadge}>
                        <Text style={[histStyles.setWeight, isPR && histStyles.setWeightPR]}>
                          {set.actual_weight_kg} kg
                        </Text>
                      </View>
                      {set.actual_reps != null && (
                        <View style={histStyles.setBadge}>
                          <Text style={histStyles.setReps}>× {set.actual_reps} rep</Text>
                        </View>
                      )}
                      {set.target_set_type === 'warmup' && (
                        <View style={histStyles.warmupBadge}>
                          <Text style={histStyles.warmupText}>W</Text>
                        </View>
                      )}
                      {isPR && (
                        <View style={histStyles.prBadge}>
                          <Text style={histStyles.prBadgeText}>PR</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const histStyles = StyleSheet.create({
  container: { gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backButton: {
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
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  loadingBox: {
    paddingTop: 40,
    alignItems: 'center',
  },
  list: { gap: 12 },
  sessionCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  sessionName: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  setsList: { gap: 8 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    width: 16,
    textAlign: 'center',
  },
  setBadge: {
    backgroundColor: '#2a2a35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  setWeight: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  setWeightPR: {
    color: PRIMARY,
  },
  setReps: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  warmupBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  warmupText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.dark.warning,
  },
  prBadge: {
    backgroundColor: 'rgba(126,71,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  prBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
});

// ─── PR Section ───────────────────────────────────────────────────────────────

function PRSection({
  records,
  onSelectExercise,
}: {
  records: ExercisePR[];
  onSelectExercise: (name: string) => void;
}) {
  if (records.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nessun PR ancora</Text>
        <Text style={styles.emptyText}>
          Completa degli allenamenti con pesi registrati per vedere i tuoi record personali.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {records.map((pr) => (
        <TouchableOpacity
          key={pr.exercise_name}
          style={styles.prCard}
          onPress={() => onSelectExercise(pr.exercise_name)}
          activeOpacity={0.85}
        >
          <View style={styles.prLeft}>
            <Text style={styles.prExerciseName}>{pr.exercise_name}</Text>
            <Text style={styles.prDate}>{formatDateShort(pr.achieved_at)}</Text>
          </View>
          <View style={styles.prRight}>
            <Text style={styles.prWeight}>{pr.max_weight_kg} kg</Text>
            {pr.reps_at_max != null && (
              <Text style={styles.prReps}>× {pr.reps_at_max} rep</Text>
            )}
            <Text style={styles.prChevron}>›</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Volume Section ───────────────────────────────────────────────────────────

function VolumeSection({
  volumes,
  onSelectExercise,
}: {
  volumes: ExerciseVolume[];
  onSelectExercise: (name: string) => void;
}) {
  if (volumes.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nessun dato ancora</Text>
        <Text style={styles.emptyText}>
          Completa degli allenamenti per vedere il volume accumulato per esercizio.
        </Text>
      </View>
    );
  }

  const maxVolume = Math.max(...volumes.map((v) => v.total_volume_kg));

  return (
    <View style={styles.list}>
      {volumes.map((v) => {
        const pct = maxVolume > 0 ? v.total_volume_kg / maxVolume : 0;
        return (
          <TouchableOpacity
            key={v.exercise_name}
            style={styles.volumeCard}
            onPress={() => onSelectExercise(v.exercise_name)}
            activeOpacity={0.85}
          >
            <View style={styles.volumeHeader}>
              <Text style={styles.volumeExerciseName}>{v.exercise_name}</Text>
              <View style={styles.volumeRightRow}>
                <Text style={styles.volumeTotal}>
                  {v.total_volume_kg > 0
                    ? `${v.total_volume_kg.toLocaleString('it-IT')} kg`
                    : `${v.total_sets} serie`}
                </Text>
                <Text style={styles.prChevron}>›</Text>
              </View>
            </View>
            <View style={styles.volumeBarTrack}>
              <View style={[styles.volumeBarFill, { width: `${pct * 100}%` as any }]} />
            </View>
            <View style={styles.volumeMeta}>
              <Text style={styles.volumeMetaText}>{v.total_sets} serie</Text>
              <Text style={styles.volumeMetaText}>{v.total_reps} reps totali</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Frequency Section ────────────────────────────────────────────────────────

function FrequencySection({
  data,
}: {
  data: {
    average_per_week: number;
    total_sessions: number;
    weeks_active: number;
    first_session_at: string | null;
  };
}) {
  if (data.total_sessions === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nessun allenamento ancora</Text>
        <Text style={styles.emptyText}>
          Completa il tuo primo allenamento per vedere le statistiche di frequenza.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.freqMainCard}>
        <Text style={styles.freqMainLabel}>MEDIA SETTIMANALE</Text>
        <Text style={styles.freqMainValue}>{data.average_per_week}</Text>
        <Text style={styles.freqMainSub}>allenamenti a settimana</Text>
      </View>
      <View style={styles.freqStatsRow}>
        <View style={styles.freqStatBox}>
          <Text style={styles.freqStatLabel}>Totale sessioni</Text>
          <Text style={styles.freqStatValue}>{data.total_sessions}</Text>
        </View>
        <View style={styles.freqStatBox}>
          <Text style={styles.freqStatLabel}>Settimane attive</Text>
          <Text style={styles.freqStatValue}>{data.weeks_active}</Text>
        </View>
        <View style={styles.freqStatBox}>
          <Text style={styles.freqStatLabel}>Dal</Text>
          <Text style={styles.freqStatValue}>
            {data.first_session_at ? formatDateShort(data.first_session_at) : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('pr');
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const [records, setRecords] = useState<ExercisePR[]>([]);
  const [volumes, setVolumes] = useState<ExerciseVolume[]>([]);
  const [frequency, setFrequency] = useState<{
    average_per_week: number;
    total_sessions: number;
    weeks_active: number;
    first_session_at: string | null;
  }>({ average_per_week: 0, total_sessions: 0, weeks_active: 0, first_session_at: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prs, vols, freq] = await Promise.all([
        getPersonalRecords(),
        getExerciseVolumeSummary(),
        getWeeklyFrequency(),
      ]);
      setRecords(prs);
      setVolumes(vols);
      setFrequency(freq);
    } catch {
      // silenzioso — le sezioni mostrano empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Reset selezione esercizio quando si torna al tab
      setSelectedExercise(null);
    }, [loadData])
  );

  const handleSelectExercise = useCallback((name: string) => {
    setSelectedExercise(name);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setSelectedExercise(null);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Progressi</Text>

      {/* Se è selezionato un esercizio, mostra il dettaglio storico */}
      {selectedExercise ? (
        <ExerciseHistoryDetail
          exerciseName={selectedExercise}
          onClose={handleCloseHistory}
        />
      ) : (
        <>
          <SegmentedControl active={activeTab} onChange={(tab) => {
            setActiveTab(tab);
            setSelectedExercise(null);
          }} />

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <>
              {activeTab === 'pr' && (
                <PRSection records={records} onSelectExercise={handleSelectExercise} />
              )}
              {activeTab === 'volume' && (
                <VolumeSection volumes={volumes} onSelectExercise={handleSelectExercise} />
              )}
              {activeTab === 'frequency' && <FrequencySection data={frequency} />}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 8,
    marginBottom: 4,
  },
  loadingBox: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  list: { gap: 12 },

  // PR
  prCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prLeft: { flex: 1, gap: 4 },
  prExerciseName: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  prDate: { fontSize: 12, color: Colors.dark.textMuted },
  prRight: { alignItems: 'flex-end', gap: 2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  prWeight: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  prReps: { fontSize: 13, color: Colors.dark.textMuted },
  prChevron: { fontSize: 20, color: Colors.dark.textMuted, fontWeight: '300' },

  // Volume
  volumeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volumeExerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
  },
  volumeRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeTotal: { fontSize: 15, fontWeight: '800', color: PRIMARY },
  volumeBarTrack: {
    height: 6,
    backgroundColor: '#2a2a35',
    borderRadius: 6,
    overflow: 'hidden',
  },
  volumeBarFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 6 },
  volumeMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  volumeMetaText: { fontSize: 12, color: Colors.dark.textMuted },

  // Frequenza
  freqMainCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.35)',
    alignItems: 'center',
    gap: 4,
  },
  freqMainLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  freqMainValue: {
    fontSize: 56,
    fontWeight: '800',
    color: Colors.dark.text,
    lineHeight: 64,
  },
  freqMainSub: { fontSize: 15, color: Colors.dark.textMuted, fontWeight: '500' },
  freqStatsRow: { flexDirection: 'row', gap: 10 },
  freqStatBox: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  freqStatLabel: { fontSize: 11, color: Colors.dark.textMuted, fontWeight: '600' },
  freqStatValue: { fontSize: 16, fontWeight: '800', color: Colors.dark.text },
});