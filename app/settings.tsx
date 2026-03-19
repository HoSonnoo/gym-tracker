import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useUserPreferences, type WeightUnit } from '@/context/UserPreferencesContext';
import { exportAllData, exportAllDataCSV, importData, resetSelective, type ImportMode, type ResetOptions } from '@/database';
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
  Switch,
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
  onReset: () => void;
};

function DataManagementModal({
  visible,
  onClose,
  busy,
  onExportJSON,
  onExportCSV,
  onImport,
  onReset,
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
              style={styles.modalRow}
              onPress={() => { onClose(); setTimeout(onReset, 300); }}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View style={styles.modalRowIcon}>
                <Text style={styles.modalRowIconText}>🗑️</Text>
              </View>
              <View style={styles.modalRowContent}>
                <Text style={[styles.modalRowLabel, styles.modalRowLabelDanger]}>Reset dati</Text>
                <Text style={styles.modalRowSubtitle}>Scegli cosa cancellare</Text>
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

// ─── Reset Modal ─────────────────────────────────────────────────────────────

type ResetModalProps = {
  visible: boolean;
  onClose: () => void;
  options: ResetOptions;
  onToggle: (key: keyof ResetOptions) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  onConfirm: () => void;
  labels: Record<keyof ResetOptions, { label: string; subtitle: string; emoji: string }>;
  busy: boolean;
};

function ResetModal({
  visible,
  onClose,
  options,
  onToggle,
  allSelected,
  onToggleAll,
  onConfirm,
  labels,
  busy,
}: ResetModalProps) {
  const keys = Object.keys(options) as (keyof ResetOptions)[];
  const anySelected = keys.some((k) => options[k]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Reset dati</Text>
          <Text style={resetStyles.subtitle}>
            Seleziona le categorie da cancellare definitivamente.
          </Text>

          {/* Seleziona tutto */}
          <TouchableOpacity
            style={resetStyles.selectAllRow}
            onPress={onToggleAll}
            activeOpacity={0.8}
          >
            <View style={[resetStyles.checkbox, allSelected && resetStyles.checkboxActive]}>
              {allSelected && <Text style={resetStyles.checkmark}>✓</Text>}
            </View>
            <Text style={resetStyles.selectAllLabel}>Seleziona tutto</Text>
          </TouchableOpacity>

          {/* Lista categorie */}
          <View style={styles.modalCard}>
            {keys.map((key, idx) => {
              const item = labels[key];
              const checked = options[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[resetStyles.optionRow, idx < keys.length - 1 && resetStyles.optionRowBorder]}
                  onPress={() => onToggle(key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalRowIcon}>
                    <Text style={styles.modalRowIconText}>{item.emoji}</Text>
                  </View>
                  <View style={resetStyles.optionContent}>
                    <Text style={[resetStyles.optionLabel, checked && resetStyles.optionLabelActive]}>
                      {item.label}
                    </Text>
                    <Text style={resetStyles.optionSubtitle}>{item.subtitle}</Text>
                  </View>
                  <View style={[resetStyles.checkbox, checked && resetStyles.checkboxActive]}>
                    {checked && <Text style={resetStyles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottone conferma */}
          <TouchableOpacity
            style={[resetStyles.confirmBtn, !anySelected && resetStyles.confirmBtnDisabled, busy && resetStyles.confirmBtnDisabled]}
            onPress={onConfirm}
            disabled={!anySelected || busy}
            activeOpacity={0.85}
          >
            <Text style={resetStyles.confirmBtnText}>
              {busy ? 'Reset in corso…' : 'Resetta selezionati'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalCancelText}>Annulla</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const resetStyles = StyleSheet.create({
  subtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  selectAllLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: Colors.dark.danger,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.dark.danger,
    lineHeight: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  optionLabelActive: {
    color: Colors.dark.danger,
  },
  optionSubtitle: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  confirmBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.35,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.danger,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { preferences, setUnit, setWeeklyGoal } = useUserPreferences();
  const { user, isGuest, isRegistered, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dataModalVisible, setDataModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetOptions, setResetOptions] = useState<ResetOptions>({
    sessions: false,
    templates: false,
    nutritionLogs: false,
    mealPlans: false,
    bodyWeight: false,
    foodCatalog: false,
  });

  const busy = resetting || exporting || importing;

  const resetKeys = Object.keys(resetOptions) as (keyof ResetOptions)[];
  const allSelected = resetKeys.every((k) => resetOptions[k]);
  const noneSelected = resetKeys.every((k) => !resetOptions[k]);

  const toggleAll = () => {
    const next = !allSelected;
    setResetOptions({ sessions: next, templates: next, nutritionLogs: next, mealPlans: next, bodyWeight: next, foodCatalog: next });
  };

  const RESET_LABELS: Record<keyof ResetOptions, { label: string; subtitle: string; emoji: string }> = {
    sessions:     { emoji: '🏋️', label: 'Sessioni allenamento', subtitle: 'Storico allenamenti e sessione attiva' },
    templates:    { emoji: '📋', label: 'Template ed esercizi', subtitle: 'Tutti i template e il catalogo esercizi' },
    nutritionLogs:{ emoji: '🥗', label: 'Log nutrizione', subtitle: 'Diario alimentare e log acqua giornalieri' },
    mealPlans:    { emoji: '📅', label: 'Piani alimentari', subtitle: 'Tutti i piani alimentari salvati' },
    bodyWeight:   { emoji: '⚖️', label: 'Peso corporeo', subtitle: 'Tutto lo storico delle pesate' },
    foodCatalog:  { emoji: '🍎', label: 'Catalogo alimenti', subtitle: 'Tutti gli alimenti salvati manualmente' },
  };

  const handleConfirmReset = () => {
    if (noneSelected) {
      Alert.alert('Nessuna selezione', 'Seleziona almeno una categoria da resettare.');
      return;
    }
    const selectedLabels = resetKeys
      .filter((k) => resetOptions[k])
      .map((k) => `• ${RESET_LABELS[k].label}`)
      .join('\n');
    Alert.alert(
      'Conferma reset',
      `Stai per cancellare definitivamente:\n\n${selectedLabels}\n\nQuesta operazione è irreversibile.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Resetta',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Sei sicuro?',
              'I dati selezionati verranno eliminati permanentemente.',
              [
                { text: 'Annulla', style: 'cancel' },
                {
                  text: 'Sì, resetta',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setResetting(true);
                      setResetModalVisible(false);
                      await resetSelective(resetOptions);
                      setResetOptions({ sessions: false, templates: false, nutritionLogs: false, mealPlans: false, bodyWeight: false, foodCatalog: false });
                      Alert.alert('Fatto', 'I dati selezionati sono stati cancellati.');
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

  // ── Reset ── (gestito da handleConfirmReset sopra)

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
          {isRegistered && user ? (
            <>
              <Row label="Account" subtitle={user.email ?? ''}>
                <View style={styles.tierBadge}>
                  <Text style={styles.tierBadgeText}>
                    {user.tier === 'premium' ? '💎 Premium' : '✓ Registrato'}
                  </Text>
                </View>
              </Row>
              <Row label="Disconnetti" subtitle="Esci dal tuo account" isLast>
                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={async () => {
                    await signOut();
                    router.replace('/auth');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.signOutButtonText}>Esci</Text>
                </TouchableOpacity>
              </Row>
            </>
          ) : (
            <Row label={isGuest ? 'Stai usando l'app come ospite' : 'Accedi o registrati'} subtitle="Sblocca backup cloud e storico illimitato" isLast>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push('/auth')}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>Accedi</Text>
              </TouchableOpacity>
            </Row>
          )}
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
        onReset={() => setResetModalVisible(true)}
      />

      {/* Reset Modal */}
      <ResetModal
        visible={resetModalVisible}
        onClose={() => setResetModalVisible(false)}
        options={resetOptions}
        onToggle={(key) => setResetOptions((prev) => ({ ...prev, [key]: !prev[key] }))}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onConfirm={handleConfirmReset}
        labels={RESET_LABELS}
        busy={resetting}
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

  // Account
  tierBadge: {
    backgroundColor: 'rgba(126,71,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.3)',
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7e47ff',
  },
  signOutButton: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signOutButtonText: {
    color: Colors.dark.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  signInButton: {
    backgroundColor: 'rgba(126,71,255,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7e47ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signInButtonText: {
    color: '#7e47ff',
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