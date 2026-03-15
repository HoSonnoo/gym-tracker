import { Colors } from '@/constants/Colors';
import {
  getCompletedWorkoutSessions,
  getWorkoutSessionDetail,
  type WorkoutSession,
  type WorkoutSessionDetail,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—';
  const diff = Math.floor(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDateLabel(date: Date): string {
  return `${date.getDate()} ${MESI[date.getMonth()]} ${date.getFullYear()}`;
}

// Restituisce i giorni da mostrare nella griglia per il mese dato
// (include i giorni "riempitivi" del mese precedente per allineare al lunedì)
function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  // getDay() → 0=Dom, 1=Lun… convertiamo a 0=Lun
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────

type SessionDetailModalProps = {
  sessionId: number | null;
  onClose: () => void;
};

function SessionDetailModal({ sessionId, onClose }: SessionDetailModalProps) {
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Reset quando si chiude
      if (sessionId === null) {
        setDetail(null);
        return;
      }
      setLoading(true);
      getWorkoutSessionDetail(sessionId)
        .then(setDetail)
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    }, [sessionId])
  );

  // Ricarica quando sessionId cambia (useFocusEffect non si ri-triggera
  // se la schermata è già focused, quindi usiamo anche un useCallback diretto)
  const loadDetail = useCallback(async () => {
    if (sessionId === null) return;
    setLoading(true);
    try {
      const d = await getWorkoutSessionDetail(sessionId);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Carica al mount e ogni volta che sessionId cambia
  React.useEffect(() => {
    if (sessionId !== null) loadDetail();
    else setDetail(null);
  }, [sessionId, loadDetail]);

  const totalSets = useMemo(() => {
    if (!detail) return 0;
    return detail.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  }, [detail]);

  const completedSets = useMemo(() => {
    if (!detail) return 0;
    return detail.exercises.reduce(
      (acc, e) => acc + e.sets.filter((s) => s.is_completed === 1).length,
      0
    );
  }, [detail]);

  return (
    <Modal
      visible={sessionId !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modalStyles.container}>
        {/* Handle */}
        <View style={modalStyles.handle} />

        {loading || !detail ? (
          <View style={modalStyles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <ScrollView
            style={modalStyles.scroll}
            contentContainerStyle={modalStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={modalStyles.header}>
              <View>
                <Text style={modalStyles.dateLabel}>
                  {formatDateLabel(new Date(detail.session.started_at))}
                </Text>
                <Text style={modalStyles.sessionName}>{detail.session.name}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={modalStyles.closeButton} activeOpacity={0.8}>
                <Text style={modalStyles.closeButtonText}>Chiudi</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={modalStyles.statsRow}>
              <View style={modalStyles.statBox}>
                <Text style={modalStyles.statLabel}>Inizio</Text>
                <Text style={modalStyles.statValue}>{formatTime(detail.session.started_at)}</Text>
              </View>
              <View style={modalStyles.statBox}>
                <Text style={modalStyles.statLabel}>Durata</Text>
                <Text style={modalStyles.statValue}>
                  {formatDuration(detail.session.started_at, detail.session.completed_at)}
                </Text>
              </View>
              <View style={modalStyles.statBox}>
                <Text style={modalStyles.statLabel}>Serie</Text>
                <Text style={modalStyles.statValue}>{completedSets}/{totalSets}</Text>
              </View>
              <View style={modalStyles.statBox}>
                <Text style={modalStyles.statLabel}>Esercizi</Text>
                <Text style={modalStyles.statValue}>{detail.exercises.length}</Text>
              </View>
            </View>

            {/* Esercizi */}
            {detail.exercises.map(({ exercise, sets }) => {
              const done = sets.filter((s) => s.is_completed === 1).length;
              const completedSetsList = sets.filter((s) => s.is_completed === 1);

              return (
                <View key={exercise.id} style={modalStyles.exerciseCard}>
                  <View style={modalStyles.exerciseHeader}>
                    <Text style={modalStyles.exerciseName}>{exercise.exercise_name}</Text>
                    <Text style={modalStyles.exerciseSetCount}>{done}/{sets.length} serie</Text>
                  </View>

                  {completedSetsList.length > 0 && (
                    <View style={modalStyles.setsList}>
                      {completedSetsList.map((set, idx) => (
                        <View key={set.id} style={modalStyles.setRow}>
                          <Text style={modalStyles.setIndex}>{idx + 1}</Text>
                          <View style={modalStyles.setInfo}>
                            {set.actual_weight_kg != null && (
                              <View style={modalStyles.setBadge}>
                                <Text style={modalStyles.setBadgeText}>{set.actual_weight_kg} kg</Text>
                              </View>
                            )}
                            {set.actual_reps != null && (
                              <View style={modalStyles.setBadge}>
                                <Text style={modalStyles.setBadgeText}>{set.actual_reps} rep</Text>
                              </View>
                            )}
                            {set.actual_effort_type && set.actual_effort_type !== 'none' && (
                              <View style={[modalStyles.setBadge, modalStyles.setBadgeEffort]}>
                                <Text style={[modalStyles.setBadgeText, modalStyles.setBadgeTextEffort]}>
                                  {set.actual_effort_type === 'failure' ? 'Cedimento'
                                    : set.actual_effort_type === 'buffer' ? 'Buffer'
                                    : 'Drop set'}
                                </Text>
                              </View>
                            )}
                            {set.actual_weight_kg == null && set.actual_reps == null && (
                              <Text style={modalStyles.setEmpty}>Nessun dato registrato</Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {completedSetsList.length === 0 && (
                    <Text style={modalStyles.noSetsText}>Nessuna serie completata</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48, gap: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  sessionName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  closeButton: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  closeButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 4,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  exerciseCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
  },
  exerciseSetCount: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  setsList: { gap: 8 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    width: 18,
    textAlign: 'center',
  },
  setInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  setBadge: {
    backgroundColor: '#2a2a35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  setBadgeEffort: {
    backgroundColor: 'rgba(126,71,255,0.15)',
  },
  setBadgeText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '600',
  },
  setBadgeTextEffort: {
    color: PRIMARY,
  },
  setEmpty: {
    color: Colors.dark.textMuted,
    fontSize: 13,
  },
  noSetsText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
});

// ─── Calendar Screen ──────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const today = useMemo(() => startOfDay(new Date()), []);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCompletedWorkoutSessions();
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadSessions(); }, [loadSessions])
  );

  // Mappa dateKey → sessioni per lookup veloce O(1)
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const session of sessions) {
      const d = startOfDay(new Date(session.completed_at ?? session.started_at));
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(session);
    }
    return map;
  }, [sessions]);

  const calendarDays = useMemo(
    () => buildCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 0) { setCurrentYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 11) { setCurrentYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const handleDayPress = useCallback((day: Date) => {
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const daySessions = sessionsByDay.get(key);
    if (!daySessions || daySessions.length === 0) return;
    // Se c'è una sola sessione, apri direttamente il dettaglio
    // Se ce ne sono più (raro ma possibile), apri la più recente
    setSelectedSessionId(daySessions[0].id);
  }, [sessionsByDay]);

  // Sessioni del mese corrente per la lista sotto il calendario
  const sessionsThisMonth = useMemo(() => {
    return sessions.filter((s) => {
      const d = new Date(s.completed_at ?? s.started_at);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [sessions, currentYear, currentMonth]);

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={screenStyles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={screenStyles.pageTitle}>Calendario</Text>

      {/* Navigazione mese */}
      <View style={screenStyles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={screenStyles.navButton} activeOpacity={0.8}>
          <Text style={screenStyles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={screenStyles.monthLabel}>
          {MESI[currentMonth]} {currentYear}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={screenStyles.navButton} activeOpacity={0.8}>
          <Text style={screenStyles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Griglia calendario */}
      <View style={screenStyles.calendarCard}>
        {/* Header giorni settimana */}
        <View style={screenStyles.weekHeader}>
          {GIORNI.map((g) => (
            <Text key={g} style={screenStyles.weekDay}>{g}</Text>
          ))}
        </View>

        {loading ? (
          <View style={screenStyles.loadingBox}>
            <ActivityIndicator size="small" color={PRIMARY} />
          </View>
        ) : (
          <View style={screenStyles.grid}>
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <View key={`empty-${idx}`} style={screenStyles.dayCell} />;
              }

              const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              const daySessions = sessionsByDay.get(key) ?? [];
              const hasSession = daySessions.length > 0;
              const isToday = isSameDay(day, today);

              return (
                <Pressable
                  key={key}
                  style={[
                    screenStyles.dayCell,
                    isToday && screenStyles.dayCellToday,
                    hasSession && screenStyles.dayCellActive,
                  ]}
                  onPress={() => handleDayPress(day)}
                  disabled={!hasSession}
                >
                  {/* Cerchio "oggi" come elemento assoluto — non impatta il layout */}
                  {isToday && (
                    <View style={[
                      screenStyles.todayRing,
                      hasSession && screenStyles.todayRingWithSession,
                    ]} />
                  )}

                  <Text style={[
                    screenStyles.dayNumber,
                    isToday && screenStyles.dayNumberToday,
                    hasSession && screenStyles.dayNumberActive,
                  ]}>
                    {day.getDate()}
                  </Text>
                  {hasSession && !isToday && <View style={screenStyles.dot} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Lista sessioni del mese */}
      <View style={screenStyles.sectionHeader}>
        <Text style={screenStyles.sectionTitle}>
          {sessionsThisMonth.length > 0
            ? `${sessionsThisMonth.length} allenament${sessionsThisMonth.length === 1 ? 'o' : 'i'} questo mese`
            : 'Nessun allenamento questo mese'}
        </Text>
      </View>

      {sessionsThisMonth.length > 0 && (
        <View style={screenStyles.sessionList}>
          {sessionsThisMonth.map((session) => {
            const d = new Date(session.completed_at ?? session.started_at);
            return (
              <TouchableOpacity
                key={session.id}
                style={screenStyles.sessionRow}
                onPress={() => setSelectedSessionId(session.id)}
                activeOpacity={0.85}
              >
                <View style={screenStyles.sessionDateBox}>
                  <Text style={screenStyles.sessionDateDay}>{d.getDate()}</Text>
                  <Text style={screenStyles.sessionDateMonth}>{MESI[d.getMonth()].slice(0, 3)}</Text>
                </View>
                <View style={screenStyles.sessionInfo}>
                  <Text style={screenStyles.sessionName}>{session.name}</Text>
                  <Text style={screenStyles.sessionMeta}>
                    {formatTime(session.started_at)} · {formatDuration(session.started_at, session.completed_at)}
                  </Text>
                </View>
                <Text style={screenStyles.sessionChevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Modal dettaglio */}
      <SessionDetailModal
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 8,
    marginBottom: 4,
  },

  // Navigazione mese
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },

  // Griglia
  calendarCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  loadingBox: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCellToday: {
  },
  dayCellActive: {
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.textMuted,
  },
  dayNumberToday: {
    color: PRIMARY,
    fontWeight: '800',
  },
  dayNumberActive: {
    color: Colors.dark.text,
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
    position: 'absolute',  // ← aggiunto
    bottom: 4,             // ← aggiunto
    alignSelf: 'center',   // ← aggiunto
  },

  // Lista sessioni mese
  sectionHeader: { marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  sessionList: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  sessionDateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(126,71,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.25)',
  },
  sessionDateDay: {
    fontSize: 16,
    fontWeight: '800',
    color: PRIMARY,
    lineHeight: 18,
  },
  sessionDateMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: PRIMARY,
    textTransform: 'uppercase',
  },
  sessionInfo: { flex: 1 },
  sessionName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 3,
  },
  sessionMeta: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  sessionChevron: {
    fontSize: 20,
    color: Colors.dark.textMuted,
    fontWeight: '300',
  },
  todayRing: {
  position: 'absolute',
  top: 8,
  left: 2,
  right: 2,
  bottom: -6,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(126,71,255,0.4)',
  },
  todayRingWithSession: {
  backgroundColor: 'rgba(126,71,255,0.12)',
  },
  sessionBg: {
    position: 'absolute',
    top: 8,
    left: 2,
    right: 2,
    bottom: -6,
    borderRadius: 10,
    backgroundColor: 'rgba(126,71,255,0.12)',
  },
});