import { Colors } from '@/constants/Colors';
import { useUserPreferences, type WeightUnit } from '@/context/UserPreferencesContext';
import { exportAllData, exportAllDataCSV, importData, type ImportMode, resetAll, resetSessions } from '@/database';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
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

// ─── Data Management Modal ────────────────────────────────────────────────────

type DataModalProps = {
  visible: boolean;
  onClose: () => void;
  busy: boolean;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: () => void;
  onResetSessions: () => void;
  onResetAll: () => void;
};

function DataManagementModal({
  visible,
  onClose,
  busy,
  onExportJSON,
  onExportCSV,
  onImport,
  onResetSessions,
  onResetAll,
}: DataModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Gestione dati</Text>

          {/* EXPORT */}
          <Text style={styles.modalSectionLabel}>ESPORTA</Text>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={[styles.modalRow, styles.modalRowBorder]}
              onPress={() => { onClose(); setTimeout(onExportJSON, 300); }}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View style={styles.modalRowIcon}>
                <Text style={styles.modalRowIconText}>📦</Text>
              </View>
              <View style={styles.modalRowContent}>
                <Text style={styles.modalRowLabel}>Backup JSON</Text>
                <Text style={styles.modalRowSubtitle}>Backup completo, reimportabile</Text>
              </View>
              <Text style={styles.modalRowChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => { onClose(); setTimeout(onExportCSV, 300); }}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View style={styles.modalRowIcon}>
                <Text style={styles.modalRowIconText}>📊</Text>
              </View>
              <View style={styles.modalRowContent}>
                <Text style={styles.modalRowLabel}>Esporta CSV</Text>
                <Text style={styles.modalRowSubtitle}>Leggibile in Excel, Numbers, Fogli Google</Text>
              </View>
              <Text style={styles.modalRowChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* IMPORT */}
          <Text style={styles.modalSectionLabel}>IMPORTA</Text>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => { onClose(); setTimeout(onImport, 300); }}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View style={styles.modalRowIcon}>
                <Text style={styles.modalRowIconText}>📥</Text>
              </View>
              <View style={styles.modalRowContent}>
                <Text style={styles.modalRowLabel}>Importa backup JSON</Text>
                <Text style={styles.modalRowSubtitle}>Ripristina da un file esportato in precedenza</Text>
              </View>
              <Text style={styles.modalRowChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* RESET */}
          <Text style={styles.modalSectionLabel}>RESET</Text>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={[styles.modalRow, styles.modalRowBorder]}
              onPress={() => { onClose(); setTimeout(onResetSessions, 300); }}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View style={styles.modalRowIcon}>
                <Text style={styles.modalRowIconText}>🗑️</Text>
              </View>
              <View style={styles.modalRowContent}>
                <Text style={[styles.modalRowLabel, styles.modalRowLabelDanger]}>Reset sessioni</Text>
                <Text style={styles.modalRowSubtitle}>Mantiene template ed esercizi</Text>
              </View>
              <Text style={styles.modalRowChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => { onClose(); setTimeout(onResetAll, 300); }}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View style={styles.modalRowIcon}>
                <Text style={styles.modalRowIconText}>⚠️</Text>
              </View>
              <View style={styles.modalRowContent}>
                <Text style={[styles.modalRowLabel, styles.modalRowLabelDanger]}>Reset completo</Text>
                <Text style={styles.modalRowSubtitle}>Cancella tutti i dati dell'app</Text>
              </View>
              <Text style={styles.modalRowChevron}>›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalCancelText}>Annulla</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { preferences, setUnit, setWeeklyGoal } = useUserPreferences();
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dataModalVisible, setDataModalVisible] = useState(false);

  const busy = resetting || exporting || importing;

  // ── Export JSON ──────────────────────────────────────────────────────────
  const handleExportJSON = async () => {
    try {
      setExporting(true);
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `gym-tracker-backup-${timestamp}.json`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, json, { encoding: 'utf8' as any });
      if (Platform.OS === 'ios') {
        await Share.share({ url: filePath, title: fileName });
      } else {
        await Share.share({ title: fileName, message: json });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== 'User did not share') {
        Alert.alert('Errore', 'Impossibile esportare i dati.');
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Export CSV ───────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const csv = await exportAllDataCSV();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `gym-tracker-export-${timestamp}.csv`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: 'utf8' as any });
      if (Platform.OS === 'ios') {
        await Share.share({ url: filePath, title: fileName });
      } else {
        await Share.share({ title: fileName, message: csv });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== 'User did not share') {
        Alert.alert('Errore', 'Impossibile esportare il CSV.');
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Import JSON ──────────────────────────────────────────────────────────
  const handleImportJSON = async () => {
    Alert.alert(
      'Importa backup JSON',
      'Scegli come gestire i dati esistenti:',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Sostituisci tutto',
          style: 'destructive',
          onPress: () => pickAndImport('replace_all'),
        },
        {
          text: 'Sovrascrivi esistenti',
          onPress: () => pickAndImport('overwrite_existing'),
        },
        {
          text: 'Aggiungi senza sovrascrivere',
          onPress: () => pickAndImport('add_only'),
        },
      ]
    );
  };

  const pickAndImport = async (mode: ImportMode) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setImporting(true);
      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' as any });
      const payload = JSON.parse(content);

      if (!payload.exported_at || !payload.app_version) {
        Alert.alert('Errore', 'Il file selezionato non è un backup valido di Gym Tracker.');
        return;
      }

      await importData(payload, mode);
      Alert.alert('Importazione completata', 'I dati sono stati importati correttamente.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert('Errore importazione', msg.length < 120 ? msg : 'Impossibile importare il file.');
    } finally {
      setImporting(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
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
            label="Gestione dati"
            subtitle="Esporta, importa o reimposta i tuoi dati"
            isLast
          >
            <TouchableOpacity
              style={[styles.dataButton, busy && styles.dataButtonDisabled]}
              onPress={() => setDataModalVisible(true)}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={styles.dataButtonText}>
                {busy ? '…' : 'Gestisci'}
              </Text>
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

      {/* Data Management Modal */}
      <DataManagementModal
        visible={dataModalVisible}
        onClose={() => setDataModalVisible(false)}
        busy={busy}
        onExportJSON={handleExportJSON}
        onExportCSV={handleExportCSV}
        onImport={handleImportJSON}
        onResetSessions={handleResetSessions}
        onResetAll={handleResetAll}
      />
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

  // Gestione dati button
  dataButton: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dataButtonDisabled: {
    opacity: 0.5,
  },
  dataButtonText: {
    color: Colors.dark.text,
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

  // ── Modal bottom sheet ───────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 20,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    letterSpacing: 1.1,
    marginBottom: 6,
    marginLeft: 2,
  },
  modalCard: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  modalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowIconText: {
    fontSize: 16,
  },
  modalRowContent: {
    flex: 1,
    gap: 2,
  },
  modalRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  modalRowLabelDanger: {
    color: Colors.dark.danger,
  },
  modalRowSubtitle: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  modalRowChevron: {
    fontSize: 20,
    color: Colors.dark.textMuted,
    fontWeight: '300',
  },
  modalCancelButton: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
});
