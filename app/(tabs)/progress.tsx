import ProgressGuide, { PROGRESS_GUIDE_KEY } from '@/components/ProgressGuide';
import { Colors } from '@/constants/Colors';
import { formatWeight, useUserPreferences } from '@/context/UserPreferencesContext';
import {
  getBodyWeightLogs,
  getExerciseVolumeSummary,
  getExerciseWeightHistory,
  getPersonalRecords,
  getWeeklyFrequency,
  type BodyWeightLog,
  type ExercisePR,
  type ExerciseVolume,
  type ExerciseWeightHistory,
} from '@/database';
import { useGuestLimits } from '@/hooks/use-guest-limits';
import { getHealthDataLast30Days, initHealthKit, type DailyHealthData } from '@/lib/healthkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const PRIMARY = '#7e47ff';
const SCREEN_W = Dimensions.get('window').width;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(isoString: string): string {
  const MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const d = new Date(isoString);
  return `${d.getDate()} ${MESI_SHORT[d.getMonth()]} ${String(d.getFullYear())}`;
}

function formatDateAxis(isoString: string): string {
  const MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const d = new Date(isoString);
  return `${d.getDate()} ${MESI_SHORT[d.getMonth()]}`;
}

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
  return Array.from(map.values()).reverse();
}

// ─── Segmented Control ────────────────────────────────────────────────────────

type TabKey = 'pr' | 'volume' | 'frequency' | 'peso' | 'attivita';

function SegmentedControl({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'pr', label: 'PR' },
    { key: 'volume', label: 'Volume' },
    { key: 'frequency', label: 'Frequenza' },
    { key: 'peso', label: 'Peso' },
    { key: 'attivita', label: 'Attività' },
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
  container: { flexDirection: 'row', backgroundColor: Colors.dark.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.border, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: PRIMARY },
  label: { fontSize: 11, fontWeight: '700', color: Colors.dark.textMuted },
  labelActive: { color: '#fff' },
});

// ─── Exercise History Detail ──────────────────────────────────────────────────

function ExerciseHistoryDetail({
  exerciseName,
  unit,
  onClose,
}: {
  exerciseName: string;
  unit: 'kg' | 'lbs';
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
  const maxWeight = history.length > 0 ? Math.max(...history.map((h) => h.actual_weight_kg)) : null;

  return (
    <View style={histStyles.container}>
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
          <Text style={styles.emptyText}>Non sono ancora stati registrati pesi per questo esercizio.</Text>
        </View>
      ) : (
        <View style={histStyles.list}>
          {groups.map((group) => (
            <View key={group.completed_at} style={histStyles.sessionCard}>
              <View style={histStyles.sessionHeader}>
                <Text style={histStyles.sessionDate}>{formatDateShort(group.completed_at)}</Text>
                <Text style={histStyles.sessionName}>{group.session_name}</Text>
              </View>
              <View style={histStyles.setsList}>
                {group.sets.map((set, idx) => {
                  const isPR = set.actual_weight_kg === maxWeight;
                  return (
                    <View key={idx} style={histStyles.setRow}>
                      <Text style={histStyles.setIndex}>{idx + 1}</Text>
                      <View style={histStyles.setBadge}>
                        <Text style={[histStyles.setWeight, isPR && histStyles.setWeightPR]}>
                          {formatWeight(set.actual_weight_kg, unit)}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backButton: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  backButtonText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.dark.text },
  loadingBox: { paddingTop: 40, alignItems: 'center' },
  list: { gap: 12 },
  sessionCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, gap: 12 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDate: { fontSize: 14, fontWeight: '700', color: Colors.dark.text },
  sessionName: { fontSize: 13, color: Colors.dark.textMuted },
  setsList: { gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setIndex: { fontSize: 13, fontWeight: '700', color: Colors.dark.textMuted, width: 16, textAlign: 'center' },
  setBadge: { backgroundColor: '#2a2a35', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  setWeight: { fontSize: 14, fontWeight: '700', color: Colors.dark.text },
  setWeightPR: { color: PRIMARY },
  setReps: { fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted },
  warmupBadge: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  warmupText: { fontSize: 11, fontWeight: '800', color: Colors.dark.warning },
  prBadge: { backgroundColor: 'rgba(126,71,255,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  prBadgeText: { fontSize: 11, fontWeight: '800', color: PRIMARY },
});

// ─── PR Section ───────────────────────────────────────────────────────────────

function PRSection({ records, unit, onSelectExercise }: { records: ExercisePR[]; unit: 'kg' | 'lbs'; onSelectExercise: (name: string) => void }) {
  if (records.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nessun PR ancora</Text>
        <Text style={styles.emptyText}>Completa degli allenamenti con pesi registrati per vedere i tuoi record personali.</Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {records.map((pr) => (
        <TouchableOpacity key={pr.exercise_name} style={styles.prCard} onPress={() => onSelectExercise(pr.exercise_name)} activeOpacity={0.85}>
          <View style={styles.prLeft}>
            <Text style={styles.prExerciseName}>{pr.exercise_name}</Text>
            <Text style={styles.prDate}>{formatDateShort(pr.achieved_at)}</Text>
          </View>
          <View style={styles.prRight}>
            <Text style={styles.prWeight}>{formatWeight(pr.max_weight_kg, unit)}</Text>
            {pr.reps_at_max != null && <Text style={styles.prReps}>× {pr.reps_at_max} rep</Text>}
            <Text style={styles.prChevron}>›</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Volume Section ───────────────────────────────────────────────────────────

function VolumeSection({ volumes, unit, onSelectExercise }: { volumes: ExerciseVolume[]; unit: 'kg' | 'lbs'; onSelectExercise: (name: string) => void }) {
  if (volumes.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nessun dato ancora</Text>
        <Text style={styles.emptyText}>Completa degli allenamenti per vedere il volume accumulato per esercizio.</Text>
      </View>
    );
  }
  const maxVolume = Math.max(...volumes.map((v) => v.total_volume_kg));
  return (
    <View style={styles.list}>
      {volumes.map((v) => {
        const pct = maxVolume > 0 ? v.total_volume_kg / maxVolume : 0;
        const displayVolume = unit === 'lbs'
          ? `${Math.round(v.total_volume_kg * 2.20462).toLocaleString('it-IT')} lbs`
          : `${v.total_volume_kg.toLocaleString('it-IT')} kg`;
        return (
          <TouchableOpacity key={v.exercise_name} style={styles.volumeCard} onPress={() => onSelectExercise(v.exercise_name)} activeOpacity={0.85}>
            <View style={styles.volumeHeader}>
              <Text style={styles.volumeExerciseName}>{v.exercise_name}</Text>
              <View style={styles.volumeRightRow}>
                <Text style={styles.volumeTotal}>{v.total_volume_kg > 0 ? displayVolume : `${v.total_sets} serie`}</Text>
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

function FrequencySection({ data, weeklyGoal }: {
  data: { average_per_week: number; total_sessions: number; weeks_active: number; first_session_at: string | null };
  weeklyGoal: number;
}) {
  if (data.total_sessions === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nessun allenamento ancora</Text>
        <Text style={styles.emptyText}>Completa il tuo primo allenamento per vedere le statistiche di frequenza.</Text>
      </View>
    );
  }

  const goalReached = data.average_per_week >= weeklyGoal;
  const goalPct = Math.min(data.average_per_week / weeklyGoal, 1);

  return (
    <View style={styles.list}>
      <View style={styles.freqMainCard}>
        <Text style={styles.freqMainLabel}>MEDIA SETTIMANALE</Text>
        <Text style={styles.freqMainValue}>{data.average_per_week}</Text>
        <Text style={styles.freqMainSub}>allenamenti a settimana</Text>

        <View style={styles.freqGoalRow}>
          <Text style={styles.freqGoalLabel}>
            Obiettivo: {weeklyGoal} {weeklyGoal === 1 ? 'allenamento' : 'allenamenti'} / settimana
          </Text>
          <Text style={[styles.freqGoalStatus, { color: goalReached ? Colors.dark.success : Colors.dark.textMuted }]}>
            {goalReached ? '✓ Raggiunto' : 'In corso'}
          </Text>
        </View>
        <View style={styles.freqGoalTrack}>
          <View style={[
            styles.freqGoalFill,
            { width: `${goalPct * 100}%` as any },
            goalReached && styles.freqGoalFillDone,
          ]} />
        </View>
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
          <Text style={styles.freqStatValue}>{data.first_session_at ? formatDateShort(data.first_session_at) : '—'}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Weight Chart (SVG) ───────────────────────────────────────────────────────

function WeightChart({ logs, unit }: { logs: BodyWeightLog[]; unit: 'kg' | 'lbs' }) {
  // I log arrivano in ordine DESC dal db — li invertiamo per il grafico (ASC cronologico)
  const sorted = [...logs].reverse();

  const CHART_H = 180;
  const PAD_LEFT = 48;
  const PAD_RIGHT = 20;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 36;
  const MIN_POINT_SPACING = 52;

  const chartW = Math.max(
    SCREEN_W - 40, // padding schermo
    sorted.length * MIN_POINT_SPACING + PAD_LEFT + PAD_RIGHT
  );

  const weights = sorted.map((l) => (unit === 'lbs' ? l.weight_kg * 2.20462 : l.weight_kg));
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const plotW = chartW - PAD_LEFT - PAD_RIGHT;

  const toX = (i: number) =>
    sorted.length === 1
      ? PAD_LEFT + plotW / 2
      : PAD_LEFT + (i / (sorted.length - 1)) * plotW;

  const toY = (w: number) =>
    PAD_TOP + plotH - ((w - minW) / range) * plotH;

  // Linea path
  const pathD = sorted
    .map((l, i) => {
      const w = unit === 'lbs' ? l.weight_kg * 2.20462 : l.weight_kg;
      return `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(w)}`;
    })
    .join(' ');

  // Etichette asse Y (3 valori)
  const yLabels = [minW, minW + range / 2, maxW];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={weightStyles.chartScroll}>
      <Svg width={chartW} height={CHART_H}>
        {/* Linee guida orizzontali */}
        {yLabels.map((val, i) => {
          const y = toY(val);
          return (
            <React.Fragment key={i}>
              <Line
                x1={PAD_LEFT}
                y1={y}
                x2={chartW - PAD_RIGHT}
                y2={y}
                stroke={Colors.dark.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={PAD_LEFT - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill={Colors.dark.textMuted}
              >
                {unit === 'lbs'
                  ? `${Math.round(val)}`
                  : `${val % 1 === 0 ? val : val.toFixed(1)}`}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Linea del grafico */}
        {sorted.length > 1 && (
          <Path
            d={pathD}
            stroke={PRIMARY}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Punti */}
        {sorted.map((log, i) => {
          const w = unit === 'lbs' ? log.weight_kg * 2.20462 : log.weight_kg;
          const cx = toX(i);
          const cy = toY(w);
          const isLast = i === sorted.length - 1;

          return (
            <React.Fragment key={log.id}>
              {/* Etichetta data sull'asse X */}
              <SvgText
                x={cx}
                y={CHART_H - 6}
                textAnchor="middle"
                fontSize={9}
                fill={Colors.dark.textMuted}
              >
                {formatDateAxis(log.date)}
              </SvgText>

              {isLast ? (
                // Ultimo punto: pieno + alone
                <>
                  <Circle cx={cx} cy={cy} r={8} fill={PRIMARY} opacity={0.2} />
                  <Circle cx={cx} cy={cy} r={5} fill={PRIMARY} />
                </>
              ) : (
                // Punti precedenti: cerchio vuoto con bordo
                <>
                  <Circle cx={cx} cy={cy} r={5} fill={Colors.dark.surface} stroke={PRIMARY} strokeWidth={2} />
                  <Circle cx={cx} cy={cy} r={2} fill={Colors.dark.surface} />
                </>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

// ─── Weight Phase Panel ───────────────────────────────────────────────────────

function WeightPhasePanel({ logs, unit, emptyMessage }: {
  logs: BodyWeightLog[];
  unit: 'kg' | 'lbs';
  emptyMessage: string;
}) {
  if (logs.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        <Text style={styles.emptyText}>Registra il tuo peso con la fase corrispondente dalla sezione Alimentazione.</Text>
      </View>
    );
  }

  const latest = logs[0];
  const first = logs[logs.length - 1];
  const latestW = unit === 'lbs' ? latest.weight_kg * 2.20462 : latest.weight_kg;
  const firstW = unit === 'lbs' ? first.weight_kg * 2.20462 : first.weight_kg;
  const diff = latestW - firstW;
  const diffSign = diff > 0 ? '+' : '';
  const diffColor = diff < 0 ? Colors.dark.success : diff > 0 ? Colors.dark.danger : Colors.dark.textMuted;

  return (
    <View style={styles.list}>
      <View style={weightStyles.statsRow}>
        <View style={weightStyles.statCard}>
          <Text style={weightStyles.statEmoji}>⚖️</Text>
          <Text style={weightStyles.statLabel}>Ultima pesata</Text>
          <Text style={weightStyles.statValue}>
            {unit === 'lbs' ? `${latestW.toFixed(1)} lbs` : `${latestW % 1 === 0 ? latestW : latestW.toFixed(2)} kg`}
          </Text>
          <Text style={weightStyles.statSub}>{formatDateShort(latest.date)}</Text>
        </View>
        <View style={weightStyles.statCard}>
          <Text style={weightStyles.statEmoji}>{diff < 0 ? '📉' : diff > 0 ? '📈' : '➡️'}</Text>
          <Text style={weightStyles.statLabel}>Variazione totale</Text>
          <Text style={[weightStyles.statValue, { color: diffColor }]}>
            {logs.length < 2 ? '—'
              : unit === 'lbs' ? `${diffSign}${diff.toFixed(1)} lbs`
              : `${diffSign}${diff % 1 === 0 ? diff : diff.toFixed(2)} kg`}
          </Text>
          <Text style={weightStyles.statSub}>
            {logs.length < 2 ? 'Solo 1 pesata' : `dal ${formatDateShort(first.date)}`}
          </Text>
        </View>
        <View style={weightStyles.statCard}>
          <Text style={weightStyles.statEmoji}>📋</Text>
          <Text style={weightStyles.statLabel}>Pesate totali</Text>
          <Text style={weightStyles.statValue}>{logs.length}</Text>
          <Text style={weightStyles.statSub}>rilevazioni</Text>
        </View>
      </View>

      <View style={weightStyles.chartCard}>
        <Text style={weightStyles.chartTitle}>Andamento peso</Text>
        <WeightChart logs={logs} unit={unit} />
      </View>

      <Text style={weightStyles.historyTitle}>Storico pesate</Text>
      <View style={weightStyles.historyCard}>
        {logs.map((log, idx) => {
          const w = unit === 'lbs' ? log.weight_kg * 2.20462 : log.weight_kg;
          const isFirst = idx === 0;
          const prevLog = logs[idx + 1];
          const prevW = prevLog ? (unit === 'lbs' ? prevLog.weight_kg * 2.20462 : prevLog.weight_kg) : null;
          const delta = prevW != null ? w - prevW : null;
          return (
            <View key={log.id} style={[weightStyles.historyRow, idx < logs.length - 1 && weightStyles.historyRowBorder]}>
              <View style={weightStyles.historyLeft}>
                <Text style={weightStyles.historyDate}>{formatDateShort(log.date)}</Text>
                {log.notes ? <Text style={weightStyles.historyNotes}>{log.notes}</Text> : null}
              </View>
              <View style={weightStyles.historyRight}>
                {delta != null && (
                  <Text style={[weightStyles.historyDelta, { color: delta < 0 ? Colors.dark.success : delta > 0 ? Colors.dark.danger : Colors.dark.textMuted }]}>
                    {delta > 0 ? '+' : ''}{unit === 'lbs' ? `${delta.toFixed(1)} lbs` : `${delta % 1 === 0 ? delta : delta.toFixed(2)} kg`}
                  </Text>
                )}
                <Text style={[weightStyles.historyWeight, isFirst && weightStyles.historyWeightLatest]}>
                  {unit === 'lbs' ? `${w.toFixed(1)} lbs` : `${w % 1 === 0 ? w : w.toFixed(2)} kg`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Weight Section ───────────────────────────────────────────────────────────

type WeightPhase = 'bulk' | 'cut';

function WeightSection({ logs, unit }: { logs: BodyWeightLog[]; unit: 'kg' | 'lbs' }) {
  const [activePhase, setActivePhase] = useState<WeightPhase>('bulk');

  const bulkLogs = logs.filter((l) => l.phase === 'bulk');
  const cutLogs = logs.filter((l) => l.phase === 'cut');

  return (
    <View style={styles.list}>
      {/* Sub-tab Bulk / Cut */}
      <View style={weightStyles.phaseTabRow}>
        <TouchableOpacity
          style={[weightStyles.phaseTab, activePhase === 'bulk' && weightStyles.phaseTabBulkActive]}
          onPress={() => setActivePhase('bulk')}
          activeOpacity={0.8}
        >
          <Text style={[weightStyles.phaseTabText, activePhase === 'bulk' && weightStyles.phaseTabTextActive]}>
            💪 Bulk
          </Text>
          {bulkLogs.length > 0 && (
            <View style={weightStyles.phaseTabBadge}>
              <Text style={weightStyles.phaseTabBadgeText}>{bulkLogs.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[weightStyles.phaseTab, activePhase === 'cut' && weightStyles.phaseTabCutActive]}
          onPress={() => setActivePhase('cut')}
          activeOpacity={0.8}
        >
          <Text style={[weightStyles.phaseTabText, activePhase === 'cut' && weightStyles.phaseTabTextActive]}>
            🔥 Cut
          </Text>
          {cutLogs.length > 0 && (
            <View style={weightStyles.phaseTabBadge}>
              <Text style={weightStyles.phaseTabBadgeText}>{cutLogs.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activePhase === 'bulk' && (
        <WeightPhasePanel
          logs={bulkLogs}
          unit={unit}
          emptyMessage="💪 Nessuna pesata Bulk"
        />
      )}
      {activePhase === 'cut' && (
        <WeightPhasePanel
          logs={cutLogs}
          unit={unit}
          emptyMessage="🔥 Nessuna pesata Cut"
        />
      )}
    </View>
  );
}

const weightStyles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    gap: 3,
  },
  statEmoji: { fontSize: 20, marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.dark.textMuted, textAlign: 'center', letterSpacing: 0.3 },
  statValue: { fontSize: 17, fontWeight: '800', color: Colors.dark.text, textAlign: 'center' },
  statSub: { fontSize: 10, color: Colors.dark.textMuted, textAlign: 'center' },

  phaseTabRow: { flexDirection: 'row', gap: 10 },
  phaseTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.dark.border, backgroundColor: Colors.dark.surface,
  },
  phaseTabBulkActive: { borderColor: '#7e47ff', backgroundColor: 'rgba(126,71,255,0.12)' },
  phaseTabCutActive: { borderColor: Colors.dark.danger, backgroundColor: 'rgba(239,68,68,0.10)' },
  phaseTabText: { fontSize: 15, fontWeight: '700', color: Colors.dark.textMuted },
  phaseTabTextActive: { color: Colors.dark.text },
  phaseTabBadge: { backgroundColor: Colors.dark.surfaceSoft, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  phaseTabBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.dark.textMuted },
  chartCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    gap: 12,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: Colors.dark.text },
  chartScroll: { marginHorizontal: -4 },

  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    letterSpacing: 0.8,
    marginTop: 4,
    marginLeft: 2,
  },
  historyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  historyLeft: { flex: 1, gap: 2 },
  historyDate: { fontSize: 14, fontWeight: '600', color: Colors.dark.text },
  historyNotes: { fontSize: 12, color: Colors.dark.textMuted },
  historyRight: { alignItems: 'flex-end', gap: 2 },
  historyDelta: { fontSize: 12, fontWeight: '600' },
  historyWeight: { fontSize: 16, fontWeight: '800', color: Colors.dark.textMuted },
  historyWeightLatest: { color: PRIMARY },
});

// ─── Activity Chart ──────────────────────────────────────────────────────────

function ActivityChart({ data, valueKey, color }: {
  data: DailyHealthData[];
  valueKey: keyof DailyHealthData;
  color: string;
}) {
  const values = data.map((d) => Number(d[valueKey]));
  const maxVal = Math.max(...values, 1);
  const CHART_H = 120;
  const PAD_LEFT = 44;
  const PAD_RIGHT = 12;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 28;
  const POINT_W = Math.max((SCREEN_W - 40 - PAD_LEFT - PAD_RIGHT) / data.length, 8);
  const chartW = PAD_LEFT + PAD_RIGHT + POINT_W * data.length;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  const toX = (i: number) => PAD_LEFT + i * POINT_W + POINT_W / 2;
  const toY = (v: number) => PAD_TOP + plotH - (v / maxVal) * plotH;

  const pathD = data.map((d, i) => {
    const v = Number(d[valueKey]);
    return `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`;
  }).join(' ');

  const yLabels = [0, Math.round(maxVal / 2), Math.round(maxVal)];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={chartW} height={CHART_H}>
        {yLabels.map((val, i) => {
          const y = toY(val);
          return (
            <React.Fragment key={i}>
              <Line x1={PAD_LEFT} y1={y} x2={chartW - PAD_RIGHT} y2={y}
                stroke={Colors.dark.border} strokeWidth={1} strokeDasharray="3 3" />
              <SvgText x={PAD_LEFT - 4} y={y + 4} textAnchor="end" fontSize={9} fill={Colors.dark.textMuted}>
                {val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
              </SvgText>
            </React.Fragment>
          );
        })}
        {data.length > 1 && (
          <Path d={pathD} stroke={color} strokeWidth={2} fill="none"
            strokeLinejoin="round" strokeLinecap="round" />
        )}
        {data.map((d, i) => {
          const v = Number(d[valueKey]);
          const cx = toX(i);
          const cy = toY(v);
          const isLast = i === data.length - 1;
          const dateStr = d.date.slice(5); // MM-DD
          return (
            <React.Fragment key={d.date}>
              {i % 5 === 0 && (
                <SvgText x={cx} y={CHART_H - 4} textAnchor="middle" fontSize={8} fill={Colors.dark.textMuted}>
                  {dateStr}
                </SvgText>
              )}
              {isLast ? (
                <>
                  <Circle cx={cx} cy={cy} r={6} fill={color} opacity={0.2} />
                  <Circle cx={cx} cy={cy} r={4} fill={color} />
                </>
              ) : v > 0 ? (
                <Circle cx={cx} cy={cy} r={3} fill={Colors.dark.surface} stroke={color} strokeWidth={1.5} />
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

// ─── Activity Section ─────────────────────────────────────────────────────────

function ActivitySection() {
  const [healthData, setHealthData] = useState<DailyHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  React.useEffect(() => {
    // Timeout di sicurezza — se HealthKit non risponde entro 8s, mostra errore
    const timeout = setTimeout(() => {
      setPermissionDenied(true);
      setLoading(false);
    }, 8000);

    initHealthKit().then((granted) => {
      clearTimeout(timeout);
      if (!granted) {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }
      getHealthDataLast30Days()
        .then(setHealthData)
        .catch(() => setHealthData([]))
        .finally(() => setLoading(false));
    }).catch(() => {
      clearTimeout(timeout);
      setPermissionDenied(true);
      setLoading(false);
    });
  }, []);

  const today = healthData[healthData.length - 1];
  const avgSteps = healthData.length > 0
    ? Math.round(healthData.reduce((s, d) => s + d.steps, 0) / healthData.filter(d => d.steps > 0).length || 0)
    : 0;

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>🏃 Accesso negato</Text>
        <Text style={styles.emptyText}>
          Vai su Impostazioni → Privacy → Salute → Vyro e abilita l'accesso per vedere i tuoi dati di attività.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {/* Stat cards oggi */}
      <View style={activityStyles.statsRow}>
        <View style={activityStyles.statCard}>
          <Text style={activityStyles.statEmoji}>👟</Text>
          <Text style={activityStyles.statLabel}>Passi oggi</Text>
          <Text style={activityStyles.statValue}>{(today?.steps ?? 0).toLocaleString('it-IT')}</Text>
          <Text style={activityStyles.statSub}>media {avgSteps.toLocaleString('it-IT')}/g</Text>
        </View>
        <View style={activityStyles.statCard}>
          <Text style={activityStyles.statEmoji}>📍</Text>
          <Text style={activityStyles.statLabel}>Distanza oggi</Text>
          <Text style={activityStyles.statValue}>{(today?.distanceKm ?? 0).toFixed(2)} km</Text>
          <Text style={activityStyles.statSub}>ultimi 30 giorni</Text>
        </View>
        <View style={activityStyles.statCard}>
          <Text style={activityStyles.statEmoji}>🔥</Text>
          <Text style={activityStyles.statLabel}>Calorie oggi</Text>
          <Text style={activityStyles.statValue}>{Math.round(today?.caloriesBurned ?? 0)}</Text>
          <Text style={activityStyles.statSub}>kcal attive</Text>
        </View>
      </View>

      {/* Grafico passi */}
      <View style={activityStyles.chartCard}>
        <Text style={activityStyles.chartTitle}>👟 Passi — ultimi 30 giorni</Text>
        <ActivityChart data={healthData} valueKey="steps" color={PRIMARY} />
      </View>

      {/* Grafico distanza */}
      <View style={activityStyles.chartCard}>
        <Text style={activityStyles.chartTitle}>📍 Distanza (km) — ultimi 30 giorni</Text>
        <ActivityChart data={healthData} valueKey="distanceKm" color={Colors.dark.success} />
      </View>

      {/* Grafico calorie */}
      <View style={activityStyles.chartCard}>
        <Text style={activityStyles.chartTitle}>🔥 Calorie attive — ultimi 30 giorni</Text>
        <ActivityChart data={healthData} valueKey="caloriesBurned" color={Colors.dark.danger} />
      </View>
    </View>
  );
}

const activityStyles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    gap: 3,
  },
  statEmoji: { fontSize: 20, marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.dark.textMuted, textAlign: 'center' },
  statValue: { fontSize: 15, fontWeight: '800', color: Colors.dark.text, textAlign: 'center' },
  statSub: { fontSize: 9, color: Colors.dark.textMuted, textAlign: 'center' },
  chartCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    gap: 12,
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: Colors.dark.text },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { preferences } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<TabKey>('pr');
  const [guideShown, setGuideShown] = useState<boolean | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(PROGRESS_GUIDE_KEY).then((val) => {
      setGuideShown(!!val);
    });
  }, []);

  if (guideShown === null) return null;
  if (!guideShown) return <ProgressGuide onDone={() => setGuideShown(true)} />;

  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const { filterByHistoryLimit, isGuest, GUEST_LIMITS } = useGuestLimits();
  const [records, setRecords] = useState<ExercisePR[]>([]);
  const [volumes, setVolumes] = useState<ExerciseVolume[]>([]);
  const [frequency, setFrequency] = useState<{
    average_per_week: number; total_sessions: number; weeks_active: number; first_session_at: string | null;
  }>({ average_per_week: 0, total_sessions: 0, weeks_active: 0, first_session_at: null });
  const [weightLogs, setWeightLogs] = useState<BodyWeightLog[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prs, vols, freq, wlogs] = await Promise.all([
        getPersonalRecords(),
        getExerciseVolumeSummary(),
        getWeeklyFrequency(),
        getBodyWeightLogs(),
      ]);
      setRecords(prs);
      setVolumes(vols);
      setFrequency(freq);
      setWeightLogs(filterByHistoryLimit(wlogs));
    } catch {
      // silenzioso
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      setSelectedExercise(null);
    }, [loadData])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Progressi</Text>

      {selectedExercise ? (
        <ExerciseHistoryDetail
          exerciseName={selectedExercise}
          unit={preferences.unit}
          onClose={() => setSelectedExercise(null)}
        />
      ) : (
        <>
          <SegmentedControl active={activeTab} onChange={(tab) => { setActiveTab(tab); setSelectedExercise(null); }} />

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <>
              {activeTab === 'pr' && <PRSection records={records} unit={preferences.unit} onSelectExercise={setSelectedExercise} />}
              {activeTab === 'volume' && <VolumeSection volumes={volumes} unit={preferences.unit} onSelectExercise={setSelectedExercise} />}
              {activeTab === 'frequency' && <FrequencySection data={frequency} weeklyGoal={preferences.weeklyGoal} />}
              {activeTab === 'peso' && <WeightSection logs={weightLogs} unit={preferences.unit} />}
              {activeTab === 'attivita' && <ActivitySection />}
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
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginTop: 8, marginBottom: 4 },
  loadingBox: { paddingTop: 60, alignItems: 'center' },
  emptyCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: Colors.dark.border, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text },
  emptyText: { fontSize: 14, lineHeight: 20, color: Colors.dark.textMuted, textAlign: 'center' },
  list: { gap: 12 },
  prCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prLeft: { flex: 1, gap: 4 },
  prExerciseName: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  prDate: { fontSize: 12, color: Colors.dark.textMuted },
  prRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prWeight: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  prReps: { fontSize: 13, color: Colors.dark.textMuted },
  prChevron: { fontSize: 20, color: Colors.dark.textMuted, fontWeight: '300' },
  volumeCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, gap: 10 },
  volumeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeExerciseName: { fontSize: 15, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  volumeRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volumeTotal: { fontSize: 15, fontWeight: '800', color: PRIMARY },
  volumeBarTrack: { height: 6, backgroundColor: '#2a2a35', borderRadius: 6, overflow: 'hidden' },
  volumeBarFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 6 },
  volumeMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  volumeMetaText: { fontSize: 12, color: Colors.dark.textMuted },
  freqMainCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', alignItems: 'center', gap: 4 },
  freqMainLabel: { fontSize: 11, fontWeight: '800', color: PRIMARY, letterSpacing: 1.2, marginBottom: 4 },
  freqMainValue: { fontSize: 56, fontWeight: '800', color: Colors.dark.text, lineHeight: 64 },
  freqMainSub: { fontSize: 15, color: Colors.dark.textMuted, fontWeight: '500' },
  freqGoalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 16 },
  freqGoalLabel: { fontSize: 13, color: Colors.dark.textMuted },
  freqGoalStatus: { fontSize: 13, fontWeight: '700' },
  freqGoalTrack: { height: 6, backgroundColor: '#2a2a35', borderRadius: 6, overflow: 'hidden', width: '100%', marginTop: 6 },
  freqGoalFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 6 },
  freqGoalFillDone: { backgroundColor: Colors.dark.success },
  freqStatsRow: { flexDirection: 'row', gap: 10 },
  freqStatBox: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.border, gap: 6 },
  freqStatLabel: { fontSize: 11, color: Colors.dark.textMuted, fontWeight: '600' },
  freqStatValue: { fontSize: 16, fontWeight: '800', color: Colors.dark.text },
});