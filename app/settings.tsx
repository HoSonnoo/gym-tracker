import { Colors } from '@/constants/Colors';
import { useUserPreferences, type WeightUnit } from '@/context/UserPreferencesContext';
import { resetAll, resetSessions } from '@/database';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#7e47ff';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

type RowProps = {
  label: string;
  subtitle?: string;
  children: React.ReactNode;
  isLast?: boolean;
};

function Row({ label, subtitle, children, isLast = false }: RowProps) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

type SegmentProps = {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
};

function InlineSegment({ options, selected, onSelect }: SegmentProps) {
  return (
    <View style={styles.inlineSegment}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.segOption, selected === opt.key && styles.segOptionActive]}
          onPress={() => onSelect(opt.key)}
          activeOpacity={0.8}
        >
          <Text style={[styles.segOptionText, selected === opt.key && styles.segOptionTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function Stepper({ value, min, max, onChange }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        activeOpacity={0.8}
      >
        <Text style={styles.stepperButtonText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity
        style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        activeOpacity={0.8}
      >
        <Text style={styles.stepperButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { preferences, setUnit, setWeeklyGoal } = useUserPreferences();
  const [resetting, setResetting] = useState(false);

  const handleResetSessions = () => {
    Alert.alert(
      'Reset sessioni',
      'Verranno cancellati tutti gli allenamenti completati e la sessione attiva, se presente. Template ed esercizi rimarranno intatti.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Reset sessioni',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              await resetSessions();
              Alert.alert('Fatto', 'Tutte le sessioni sono state cancellate.');
            } catch {
              Alert.alert('Errore', 'Impossibile eseguire il reset.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleResetAll = () => {
    Alert.alert(
      'Reset completo',
      'Verranno cancellati tutti i dati: sessioni, template ed esercizi. Le preferenze rimarranno invariate. Questa operazione è irreversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Sono sicuro, resetta tutto',
          style: 'destructive',
          onPress: () => {
            // Doppia conferma per il reset totale
            Alert.alert(
              'Sei davvero sicuro?',
              'Non sarà possibile recuperare i dati eliminati.',
              [
                { text: 'Annulla', style: 'cancel' },
                {
                  text: 'Resetta tutto',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setResetting(true);
                      await resetAll();
                      Alert.alert('Fatto', 'Tutti i dati sono stati cancellati.');
                    } catch {
                      Alert.alert('Errore', 'Impossibile eseguire il reset.');
                    } finally {
                      setResetting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          activeOpacity={0.8}
        >
          <Text style={styles.closeButtonText}>Chiudi</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* PREFERENZE */}
        <SectionHeader title="PREFERENZE" />
        <SettingsCard>
          <Row label="Unità di misura" subtitle="Applicata a tutti i pesi nell'app">
            <InlineSegment
              options={[
                { key: 'kg', label: 'kg' },
                { key: 'lbs', label: 'lbs' },
              ]}
              selected={preferences.unit}
              onSelect={(key) => setUnit(key as WeightUnit)}
            />
          </Row>
          <Row
            label="Obiettivo settimanale"
            subtitle="Allenamenti a settimana che vuoi raggiungere"
            isLast
          >
            <Stepper
              value={preferences.weeklyGoal}
              min={1}
              max={7}
              onChange={setWeeklyGoal}
            />
          </Row>
        </SettingsCard>

        {/* DATI */}
        <SectionHeader title="DATI" />
        <SettingsCard>
          <Row
            label="Reset sessioni"
            subtitle="Cancella lo storico allenamenti, mantiene template ed esercizi"
          >
            <TouchableOpacity
              style={[styles.dangerButton, resetting && styles.dangerButtonDisabled]}
              onPress={handleResetSessions}
              disabled={resetting}
              activeOpacity={0.8}
            >
              <Text style={styles.dangerButtonText}>Reset</Text>
            </TouchableOpacity>
          </Row>
          <Row
            label="Reset completo"
            subtitle="Cancella tutti i dati dell'app"
            isLast
          >
            <TouchableOpacity
              style={[styles.dangerButton, styles.dangerButtonFull, resetting && styles.dangerButtonDisabled]}
              onPress={handleResetAll}
              disabled={resetting}
              activeOpacity={0.8}
            >
              <Text style={styles.dangerButtonText}>Reset</Text>
            </TouchableOpacity>
          </Row>
        </SettingsCard>

        {/* ACCOUNT */}
        <SectionHeader title="ACCOUNT" />
        <SettingsCard>
          <Row label="Accedi / Registrati" subtitle="Disponibile nella versione completa" isLast>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Presto</Text>
            </View>
          </Row>
        </SettingsCard>

        {/* APP */}
        <SectionHeader title="APP" />
        <SettingsCard>
          <Row label="Versione" isLast>
            <Text style={styles.versionText}>1.0.0</Text>
          </Row>
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  closeButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  container: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    letterSpacing: 1.1,
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  rowLeft: { flex: 1, gap: 3 },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    lineHeight: 16,
  },
  rowRight: {
    alignItems: 'flex-end',
  },

  // Segment inline
  inlineSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    gap: 3,
  },
  segOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segOptionActive: {
    backgroundColor: PRIMARY,
  },
  segOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  segOptionTextActive: {
    color: '#fff',
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    lineHeight: 22,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark.text,
    width: 28,
    textAlign: 'center',
  },

  // Danger buttons
  dangerButton: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dangerButtonFull: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  dangerButtonDisabled: {
    opacity: 0.5,
  },
  dangerButtonText: {
    color: Colors.dark.danger,
    fontSize: 13,
    fontWeight: '700',
  },

  // Coming soon
  comingSoonBadge: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },

  // Version
  versionText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
});