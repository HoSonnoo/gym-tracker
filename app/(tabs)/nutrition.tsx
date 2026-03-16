import { Colors } from '@/constants/Colors';
import {
  addFoodItem,
  addMealPlan,
  addMealPlanDay,
  addMealPlanEntry,
  addNutritionLog,
  addWaterLog,
  deleteBodyWeightLog,
  deleteMealPlan,
  deleteMealPlanDay,
  deleteMealPlanEntry,
  deleteNutritionLog,
  getBodyWeightLogs,
  getFoodItems,
  getMealPlanDays,
  getMealPlanEntries,
  getMealPlans,
  getNutritionLogsByDate,
  getWaterLogByDate,
  resetWaterLog,
  upsertBodyWeightLog,
  type BodyWeightLog,
  type FoodItem,
  type MealPlan,
  type MealPlanDay,
  type MealPlanEntry,
  type NutritionLog,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';


// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#7e47ff';

const MEAL_TYPES = [
  { key: 'colazione', label: 'Colazione', emoji: '☀️' },
  { key: 'pranzo',    label: 'Pranzo',    emoji: '🍽️' },
  { key: 'cena',      label: 'Cena',      emoji: '🌙' },
  { key: 'spuntino',  label: 'Spuntini',  emoji: '🍎' },
] as const;

type MealType = typeof MEAL_TYPES[number]['key'];
type SectionKey = 'diario' | 'catalogo' | 'piano' | 'corpo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayISO(): string {
  return localISO(new Date());
}

function formatDateDisplay(iso: string): string {
  const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const d = new Date(iso + 'T00:00:00');
  const ieri = new Date(); ieri.setDate(ieri.getDate() - 1);
  if (iso === todayISO()) return 'Oggi';
  if (iso === localISO(ieri)) return 'Ieri';
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return localISO(d);
}

function roundMacro(value: number | null): string {
  if (value === null) return '—';
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function scaleNutrient(value: number | null, grams: number): number | null {
  if (value === null) return null;
  return Math.round((value * grams / 100) * 10) / 10;
}

// ─── Segmented Control ────────────────────────────────────────────────────────

function SegmentedControl({
  active,
  onChange,
}: {
  active: SectionKey;
  onChange: (key: SectionKey) => void;
}) {
  const tabs: { key: SectionKey; label: string }[] = [
    { key: 'diario',   label: 'Diario' },
    { key: 'piano',    label: 'Piano' },
    { key: 'corpo',    label: 'Corpo' },
    { key: 'catalogo', label: 'Catalogo' },
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
  tabActive: {
    backgroundColor: PRIMARY,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  labelActive: {
    color: '#fff',
  },
});

// ─── Macro Summary Card ───────────────────────────────────────────────────────

type DailyTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

function MacroSummaryCard({ totals }: { totals: DailyTotals }) {
  const macros = [
    { label: 'Proteine', value: totals.protein, unit: 'g', color: '#60a5fa' },
    { label: 'Carboidrati', value: totals.carbs, unit: 'g', color: '#fbbf24' },
    { label: 'Grassi', value: totals.fat, unit: 'g', color: '#f87171' },
  ];

  return (
    <View style={macroStyles.card}>
      <View style={macroStyles.kcalRow}>
        <Text style={macroStyles.kcalValue}>{Math.round(totals.kcal)}</Text>
        <Text style={macroStyles.kcalUnit}>kcal</Text>
      </View>
      <View style={macroStyles.macroRow}>
        {macros.map((m) => (
          <View key={m.label} style={macroStyles.macroItem}>
            <View style={[macroStyles.macroDot, { backgroundColor: m.color }]} />
            <Text style={macroStyles.macroValue}>
              {roundMacro(m.value)}{m.unit}
            </Text>
            <Text style={macroStyles.macroLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.35)',
    marginBottom: 14,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 14,
  },
  kcalValue: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  kcalUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 0,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  macroLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
});

// ─── Add Food to Meal Modal ───────────────────────────────────────────────────

type AddToMealModalProps = {
  visible: boolean;
  mealType: MealType;
  date: string;
  onClose: () => void;
  onAdded: () => void;
};

function AddToMealModal({ visible, mealType, date, onClose, onAdded }: AddToMealModalProps) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('100');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      setSelectedFood(null);
      setGrams('100');
      setSearch('');
      return;
    }
    setLoading(true);
    getFoodItems()
      .then(setFoods)
      .catch(() => setFoods([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = useMemo(() => {
    if (!search.trim()) return foods;
    const q = search.trim().toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, search]);

  const mealLabel = MEAL_TYPES.find((m) => m.key === mealType)?.label ?? mealType;

  const handleAdd = async () => {
    if (!selectedFood) return;
    const g = parseFloat(grams.replace(',', '.'));
    if (!g || g <= 0) {
      Alert.alert('Quantità non valida', 'Inserisci un valore in grammi maggiore di 0.');
      return;
    }
    try {
      setSaving(true);
      await addNutritionLog({
        date,
        meal_type: mealType,
        food_item_id: selectedFood.id,
        food_name: selectedFood.name,
        grams: g,
        kcal: scaleNutrient(selectedFood.kcal_per_100g, g),
        protein: scaleNutrient(selectedFood.protein_g, g),
        carbs: scaleNutrient(selectedFood.carbs_g, g),
        fat: scaleNutrient(selectedFood.fat_g, g),
      });
      onAdded();
      onClose();
    } catch {
      Alert.alert('Errore', 'Impossibile aggiungere l\'alimento.');
    } finally {
      setSaving(false);
    }
  };

  // Preview macro scaled to grams
  const g = parseFloat(grams.replace(',', '.')) || 0;
  const preview = selectedFood ? {
    kcal: scaleNutrient(selectedFood.kcal_per_100g, g),
    protein: scaleNutrient(selectedFood.protein_g, g),
    carbs: scaleNutrient(selectedFood.carbs_g, g),
    fat: scaleNutrient(selectedFood.fat_g, g),
  } : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={addModalStyles.container}>
        <View style={addModalStyles.handle} />

        <View style={addModalStyles.header}>
          <Text style={addModalStyles.title}>Aggiungi a {mealLabel}</Text>
          <TouchableOpacity onPress={onClose} style={addModalStyles.closeBtn} activeOpacity={0.8}>
            <Text style={addModalStyles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        {selectedFood ? (
          <ScrollView contentContainerStyle={addModalStyles.confirmContent} keyboardShouldPersistTaps="handled">
            <View style={addModalStyles.selectedCard}>
              <Text style={addModalStyles.selectedName}>{selectedFood.name}</Text>
              <Text style={addModalStyles.selectedPer100}>Valori per 100g: {roundMacro(selectedFood.kcal_per_100g)} kcal · P {roundMacro(selectedFood.protein_g)}g · C {roundMacro(selectedFood.carbs_g)}g · G {roundMacro(selectedFood.fat_g)}g</Text>
            </View>

            <Text style={addModalStyles.inputLabel}>Quantità (grammi)</Text>
            <TextInput
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              style={addModalStyles.gramsInput}
              placeholder="100"
              placeholderTextColor={Colors.dark.textMuted}
              selectTextOnFocus
            />

            {preview && g > 0 && (
              <View style={addModalStyles.previewCard}>
                <Text style={addModalStyles.previewTitle}>Per {g}g</Text>
                <View style={addModalStyles.previewRow}>
                  <View style={addModalStyles.previewItem}>
                    <Text style={addModalStyles.previewValue}>{roundMacro(preview.kcal)}</Text>
                    <Text style={addModalStyles.previewLabel}>kcal</Text>
                  </View>
                  <View style={addModalStyles.previewItem}>
                    <Text style={[addModalStyles.previewValue, { color: '#60a5fa' }]}>{roundMacro(preview.protein)}g</Text>
                    <Text style={addModalStyles.previewLabel}>Proteine</Text>
                  </View>
                  <View style={addModalStyles.previewItem}>
                    <Text style={[addModalStyles.previewValue, { color: '#fbbf24' }]}>{roundMacro(preview.carbs)}g</Text>
                    <Text style={addModalStyles.previewLabel}>Carbo</Text>
                  </View>
                  <View style={addModalStyles.previewItem}>
                    <Text style={[addModalStyles.previewValue, { color: '#f87171' }]}>{roundMacro(preview.fat)}g</Text>
                    <Text style={addModalStyles.previewLabel}>Grassi</Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[addModalStyles.addBtn, saving && addModalStyles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={addModalStyles.addBtnText}>
                {saving ? 'Salvataggio...' : 'Aggiungi al pasto'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={addModalStyles.backBtn}
              onPress={() => setSelectedFood(null)}
              activeOpacity={0.8}
            >
              <Text style={addModalStyles.backBtnText}>← Cambia alimento</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <>
            <View style={addModalStyles.searchRow}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cerca alimento..."
                placeholderTextColor={Colors.dark.textMuted}
                style={addModalStyles.searchInput}
                autoFocus
                clearButtonMode="while-editing"
              />
            </View>

            {loading ? (
              <View style={addModalStyles.centered}>
                <ActivityIndicator size="large" color={PRIMARY} />
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={addModalStyles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={addModalStyles.emptyBox}>
                    <Text style={addModalStyles.emptyText}>
                      {search.trim()
                        ? `Nessun alimento trovato per "${search}"`
                        : 'Nessun alimento nel catalogo.\nAggiungi alimenti dalla sezione Catalogo.'}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={addModalStyles.foodRow}
                    onPress={() => setSelectedFood(item)}
                    activeOpacity={0.85}
                  >
                    <View style={addModalStyles.foodInfo}>
                      <Text style={addModalStyles.foodName}>{item.name}</Text>
                      <Text style={addModalStyles.foodMacros}>
                        {roundMacro(item.kcal_per_100g)} kcal · P {roundMacro(item.protein_g)}g · C {roundMacro(item.carbs_g)}g · G {roundMacro(item.fat_g)}g
                      </Text>
                    </View>
                    <View style={addModalStyles.selectBadge}>
                      <Text style={addModalStyles.selectBadgeText}>Seleziona</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const addModalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  closeBtnText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  searchRow: { paddingHorizontal: 20, marginBottom: 12 },
  searchInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: Colors.dark.text, fontSize: 15 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyBox: { paddingTop: 40, alignItems: 'center' },
  emptyText: { color: Colors.dark.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  foodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 10, gap: 12 },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, marginBottom: 4 },
  foodMacros: { fontSize: 12, color: Colors.dark.textMuted },
  selectBadge: { backgroundColor: 'rgba(126,71,255,0.14)', borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.primary, paddingHorizontal: 12, paddingVertical: 6 },
  selectBadgeText: { color: Colors.dark.primarySoft, fontSize: 13, fontWeight: '700' },
  confirmContent: { padding: 20, paddingBottom: 40 },
  selectedCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 20 },
  selectedName: { fontSize: 18, fontWeight: '800', color: Colors.dark.text, marginBottom: 6 },
  selectedPer100: { fontSize: 13, color: Colors.dark.textMuted },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted, marginBottom: 8 },
  gramsInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: Colors.dark.text, fontSize: 22, fontWeight: '800', marginBottom: 16 },
  previewCard: { backgroundColor: Colors.dark.surfaceSoft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 20 },
  previewTitle: { fontSize: 12, fontWeight: '700', color: Colors.dark.textMuted, marginBottom: 10, letterSpacing: 0.5 },
  previewRow: { flexDirection: 'row' },
  previewItem: { flex: 1, alignItems: 'center', gap: 2 },
  previewValue: { fontSize: 16, fontWeight: '800', color: Colors.dark.text },
  previewLabel: { fontSize: 11, color: Colors.dark.textMuted, fontWeight: '600' },
  addBtn: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backBtnText: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '600' },
});

// ─── Add Food Item Modal (Catalogo) ──────────────────────────────────────────

type AddFoodItemModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function AddFoodItemModal({ visible, onClose, onSaved }: AddFoodItemModalProps) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat('');
  };

  React.useEffect(() => {
    if (!visible) resetForm();
  }, [visible]);

  const parseField = (v: string): number | null => {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? null : Math.round(n * 10) / 10;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Nome mancante', 'Inserisci il nome dell\'alimento.');
      return;
    }
    try {
      setSaving(true);
      await addFoodItem({
        name: name.trim(),
        kcal_per_100g: parseField(kcal),
        protein_g: parseField(protein),
        carbs_g: parseField(carbs),
        fat_g: parseField(fat),
        source: 'manual',
      });
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Impossibile salvare l\'alimento.');
    } finally {
      setSaving(false);
    }
  };

  const fields: { label: string; value: string; onChange: (v: string) => void; placeholder: string }[] = [
    { label: 'Calorie (kcal / 100g)', value: kcal, onChange: setKcal, placeholder: 'Es. 250' },
    { label: 'Proteine (g / 100g)', value: protein, onChange: setProtein, placeholder: 'Es. 20' },
    { label: 'Carboidrati (g / 100g)', value: carbs, onChange: setCarbs, placeholder: 'Es. 30' },
    { label: 'Grassi (g / 100g)', value: fat, onChange: setFat, placeholder: 'Es. 10' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScrollView
        style={foodModalStyles.container}
        contentContainerStyle={foodModalStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={foodModalStyles.handle} />

        <View style={foodModalStyles.header}>
          <Text style={foodModalStyles.title}>Nuovo alimento</Text>
          <TouchableOpacity onPress={onClose} style={foodModalStyles.closeBtn} activeOpacity={0.8}>
            <Text style={foodModalStyles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        <Text style={foodModalStyles.hint}>
          Inserisci i valori nutrizionali riferiti a 100g di prodotto.
        </Text>

        <View style={foodModalStyles.fieldGroup}>
          <Text style={foodModalStyles.fieldLabel}>Nome alimento *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Es. Petto di pollo"
            placeholderTextColor={Colors.dark.textMuted}
            style={foodModalStyles.input}
            autoFocus
          />
        </View>

        {fields.map((f) => (
          <View key={f.label} style={foodModalStyles.fieldGroup}>
            <Text style={foodModalStyles.fieldLabel}>{f.label}</Text>
            <TextInput
              value={f.value}
              onChangeText={f.onChange}
              placeholder={f.placeholder}
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="decimal-pad"
              style={foodModalStyles.input}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[foodModalStyles.saveBtn, saving && foodModalStyles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={foodModalStyles.saveBtnText}>
            {saving ? 'Salvataggio...' : 'Salva alimento'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const foodModalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 60 },
  handle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  closeBtnText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 14, color: Colors.dark.textMuted, marginBottom: 24, lineHeight: 20 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted, marginBottom: 8 },
  input: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: Colors.dark.text, fontSize: 15 },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── Diario Section ───────────────────────────────────────────────────────────

type DiarioProps = {
  date: string;
  onDateChange: (iso: string) => void;
};

function DiarioSection({ date, onDateChange }: DiarioProps) {
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalMeal, setAddModalMeal] = useState<MealType | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNutritionLogsByDate(date);
      setLogs(data);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare il diario.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { loadLogs(); }, [loadLogs]));

  const totals = useMemo((): DailyTotals => {
    return logs.reduce(
      (acc, log) => ({
        kcal:    acc.kcal    + (log.kcal    ?? 0),
        protein: acc.protein + (log.protein ?? 0),
        carbs:   acc.carbs   + (log.carbs   ?? 0),
        fat:     acc.fat     + (log.fat     ?? 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [logs]);

  const logsByMeal = useMemo(() => {
    const map: Record<MealType, NutritionLog[]> = {
      colazione: [], pranzo: [], cena: [], spuntino: [],
    };
    for (const log of logs) {
      if (log.meal_type in map) {
        map[log.meal_type as MealType].push(log);
      }
    }
    return map;
  }, [logs]);

  const handleDelete = (log: NutritionLog) => {
    Alert.alert(
      'Rimuovi alimento',
      `Vuoi rimuovere "${log.food_name}" dal diario?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNutritionLog(log.id);
              await loadLogs();
            } catch {
              Alert.alert('Errore', 'Impossibile rimuovere l\'alimento.');
            }
          },
        },
      ]
    );
  };

  const isFuture = date > todayISO();

  return (
    <>
      {/* Date navigator */}
      <View style={diarioStyles.dateNav}>
        <TouchableOpacity
          style={diarioStyles.dateArrow}
          onPress={() => onDateChange(shiftDate(date, -1))}
          activeOpacity={0.8}
        >
          <Text style={diarioStyles.dateArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={diarioStyles.dateLabel}>{formatDateDisplay(date)}</Text>
        <TouchableOpacity
          style={[diarioStyles.dateArrow, isFuture && diarioStyles.dateArrowDisabled]}
          onPress={() => !isFuture && onDateChange(shiftDate(date, 1))}
          activeOpacity={0.8}
          disabled={isFuture}
        >
          <Text style={[diarioStyles.dateArrowText, isFuture && diarioStyles.dateArrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={diarioStyles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <>
          <MacroSummaryCard totals={totals} />

          {MEAL_TYPES.map((meal) => {
            const mealLogs = logsByMeal[meal.key];
            const mealKcal = mealLogs.reduce((s, l) => s + (l.kcal ?? 0), 0);

            return (
              <View key={meal.key} style={diarioStyles.mealCard}>
                <View style={diarioStyles.mealHeader}>
                  <View style={diarioStyles.mealTitleRow}>
                    <Text style={diarioStyles.mealEmoji}>{meal.emoji}</Text>
                    <Text style={diarioStyles.mealTitle}>{meal.label}</Text>
                    {mealLogs.length > 0 && (
                      <Text style={diarioStyles.mealKcal}>{Math.round(mealKcal)} kcal</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={diarioStyles.addToMealBtn}
                    onPress={() => setAddModalMeal(meal.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={diarioStyles.addToMealBtnText}>+ Aggiungi</Text>
                  </TouchableOpacity>
                </View>

                {mealLogs.length === 0 ? (
                  <Text style={diarioStyles.emptyMealText}>Nessun alimento registrato</Text>
                ) : (
                  <View style={diarioStyles.logList}>
                    {mealLogs.map((log) => (
                      <View key={log.id} style={diarioStyles.logRow}>
                        <View style={diarioStyles.logInfo}>
                          <Text style={diarioStyles.logName}>{log.food_name}</Text>
                          <Text style={diarioStyles.logMacros}>
                            {log.grams}g · {roundMacro(log.kcal)} kcal · P {roundMacro(log.protein)}g · C {roundMacro(log.carbs)}g · G {roundMacro(log.fat)}g
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={diarioStyles.deleteBtn}
                          onPress={() => handleDelete(log)}
                          activeOpacity={0.8}
                        >
                          <Text style={diarioStyles.deleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      {addModalMeal && (
        <AddToMealModal
          visible={!!addModalMeal}
          mealType={addModalMeal}
          date={date}
          onClose={() => setAddModalMeal(null)}
          onAdded={loadLogs}
        />
      )}
    </>
  );
}

const diarioStyles = StyleSheet.create({
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dateArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  dateArrowDisabled: { opacity: 0.3 },
  dateArrowText: { fontSize: 22, color: Colors.dark.text, fontWeight: '600', lineHeight: 26 },
  dateArrowTextDisabled: { color: Colors.dark.textMuted },
  dateLabel: { fontSize: 18, fontWeight: '800', color: Colors.dark.text },
  loadingBox: { paddingTop: 60, alignItems: 'center' },
  mealCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealEmoji: { fontSize: 18 },
  mealTitle: { fontSize: 16, fontWeight: '800', color: Colors.dark.text },
  mealKcal: { fontSize: 13, color: Colors.dark.textMuted, fontWeight: '600' },
  addToMealBtn: { backgroundColor: 'rgba(126,71,255,0.14)', borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.primary, paddingHorizontal: 12, paddingVertical: 6 },
  addToMealBtnText: { color: Colors.dark.primarySoft, fontSize: 13, fontWeight: '700' },
  emptyMealText: { fontSize: 13, color: Colors.dark.textMuted, fontStyle: 'italic' },
  logList: { gap: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101015', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.border },
  logInfo: { flex: 1 },
  logName: { fontSize: 14, fontWeight: '700', color: Colors.dark.text, marginBottom: 3 },
  logMacros: { fontSize: 12, color: Colors.dark.textMuted },
  deleteBtn: { width: 28, height: 28, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: Colors.dark.danger, fontSize: 13, fontWeight: '800' },
});

// ─── Catalogo Section ─────────────────────────────────────────────────────────

function CatalogoSection() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const loadFoods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFoodItems();
      setFoods(data);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare il catalogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadFoods(); }, [loadFoods]));

  const filtered = useMemo(() => {
    if (!search.trim()) return foods;
    const q = search.trim().toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, search]);

  return (
    <>
      <View style={catStyles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Cerca alimento..."
          placeholderTextColor={Colors.dark.textMuted}
          style={catStyles.searchInput}
          clearButtonMode="while-editing"
        />
      </View>

      <TouchableOpacity
        style={catStyles.addBtn}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Text style={catStyles.addBtnText}>+ Nuovo alimento</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={catStyles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={catStyles.emptyBox}>
          <Text style={catStyles.emptyTitle}>
            {search.trim() ? `Nessun risultato per "${search}"` : 'Catalogo vuoto'}
          </Text>
          <Text style={catStyles.emptyText}>
            {!search.trim() && 'Aggiungi il tuo primo alimento con il pulsante qui sopra.'}
          </Text>
        </View>
      ) : (
        <View style={catStyles.list}>
          {filtered.map((item) => (
            <View key={item.id} style={catStyles.foodCard}>
              <Text style={catStyles.foodName}>{item.name}</Text>
              <View style={catStyles.macroGrid}>
                <View style={catStyles.macroCell}>
                  <Text style={catStyles.macroCellValue}>{roundMacro(item.kcal_per_100g)}</Text>
                  <Text style={catStyles.macroCellLabel}>kcal</Text>
                </View>
                <View style={catStyles.macroCell}>
                  <Text style={[catStyles.macroCellValue, { color: '#60a5fa' }]}>{roundMacro(item.protein_g)}g</Text>
                  <Text style={catStyles.macroCellLabel}>Proteine</Text>
                </View>
                <View style={catStyles.macroCell}>
                  <Text style={[catStyles.macroCellValue, { color: '#fbbf24' }]}>{roundMacro(item.carbs_g)}g</Text>
                  <Text style={catStyles.macroCellLabel}>Carbo</Text>
                </View>
                <View style={catStyles.macroCell}>
                  <Text style={[catStyles.macroCellValue, { color: '#f87171' }]}>{roundMacro(item.fat_g)}g</Text>
                  <Text style={catStyles.macroCellLabel}>Grassi</Text>
                </View>
              </View>
              {item.source === 'openfoodfacts' && (
                <Text style={catStyles.sourceTag}>Open Food Facts</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <AddFoodItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={loadFoods}
      />
    </>
  );
}

const catStyles = StyleSheet.create({
  searchRow: { marginBottom: 12 },
  searchInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: Colors.dark.text, fontSize: 15 },
  addBtn: { backgroundColor: Colors.dark.surface, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
  loadingBox: { paddingTop: 60, alignItems: 'center' },
  emptyBox: { paddingTop: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text },
  emptyText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center' },
  list: { gap: 10 },
  foodCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border },
  foodName: { fontSize: 16, fontWeight: '800', color: Colors.dark.text, marginBottom: 12 },
  macroGrid: { flexDirection: 'row' },
  macroCell: { flex: 1, alignItems: 'center', gap: 2 },
  macroCellValue: { fontSize: 15, fontWeight: '800', color: Colors.dark.text },
  macroCellLabel: { fontSize: 11, color: Colors.dark.textMuted, fontWeight: '600' },
  sourceTag: { marginTop: 10, alignSelf: 'flex-start', fontSize: 11, color: Colors.dark.textMuted, backgroundColor: Colors.dark.surfaceSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});

// ─── Water Bottle Component ───────────────────────────────────────────────────

const BOTTLE_CAPACITY = 2000;
const BOTTLE_BODY_H = 160;
const BOTTLE_WIDTH = 80;

function WaterBottle({ totalMl }: { totalMl: number }) {
  const fullBottles = Math.floor(totalMl / BOTTLE_CAPACITY);
  const remainder = totalMl % BOTTLE_CAPACITY;
  const bottleCount = fullBottles + 1;
  const currentFill = totalMl === 0
    ? 0
    : remainder === 0 && fullBottles > 0
      ? 1
      : remainder / BOTTLE_CAPACITY;

  return (
    <View style={bottleStyles.row}>
      {Array.from({ length: bottleCount }).map((_, i) => {
        const isComplete = i < fullBottles;
        const isCurrent = i === bottleCount - 1;
        return (
          <AnimatedBottle
            key={i}
            targetFill={isComplete ? 1 : isCurrent ? currentFill : 0}
            isComplete={isComplete}
            label={String(i + 1)}
          />
        );
      })}
    </View>
  );
}

function AnimatedBottle({ targetFill, isComplete, label }: {
  targetFill: number;
  isComplete: boolean;
  label: string;
}) {
  // Fill level — spring fluida che non riparte da 0
  const fillProgress = useSharedValue(targetFill);

  // Wave offset — loop perpetuo sul thread UI nativo
  const waveOffset = useSharedValue(0);

  useEffect(() => {
    fillProgress.value = withSpring(targetFill, {
      damping: 18,
      stiffness: 80,
      mass: 1,
    });
  }, [targetFill]);

  useEffect(() => {
    waveOffset.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, // infinito
      false
    );
  }, []);

  // Stile del fill — altezza animata
  const fillStyle = useAnimatedStyle(() => ({
    height: fillProgress.value * BOTTLE_BODY_H,
    backgroundColor: interpolateColor(
      fillProgress.value,
      [0, 0.5, 1],
      ['#3b82f6', '#38bdf8', '#22c55e']
    ),
  }));

  // Stile del contenitore onda — si sposta verticalmente con il livello
  const waveContainerStyle = useAnimatedStyle(() => ({
    bottom: fillProgress.value * BOTTLE_BODY_H - 10,
  }));

  // Onda 1 — si muove da sinistra a destra
  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: (waveOffset.value - 0.5) * 28 }],
  }));

  // Onda 2 — direzione opposta, leggermente sfasata
  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: (0.5 - waveOffset.value) * 22 }],
  }));

  const WAVE_W = BOTTLE_WIDTH * 1.7;
  const WAVE_LEFT = -(WAVE_W - BOTTLE_WIDTH) / 2;
  const showWave = targetFill > 0.03 && targetFill < 0.97;

  return (
    <View style={bottleStyles.bottleWrapper}>
      {/* Tappo */}
      <View style={bottleStyles.neck}>
        <View style={bottleStyles.neckInner} />
      </View>

      {/* Corpo */}
      <View style={[bottleStyles.body, { height: BOTTLE_BODY_H }]}>

        {/* Acqua */}
        <Animated.View
          style={[bottleStyles.fill, fillStyle]}
        />

        {/* Onde sulla superficie */}
        {showWave && (
          <Animated.View
            style={[bottleStyles.waveContainer, waveContainerStyle]}
            pointerEvents="none"
          >
            <Animated.View
              style={[{
                position: 'absolute',
                bottom: 0,
                left: WAVE_LEFT,
                width: WAVE_W,
                height: 10,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.22)',
              }, wave1Style]}
            />
            <Animated.View
              style={[{
                position: 'absolute',
                bottom: 2,
                left: WAVE_LEFT,
                width: WAVE_W,
                height: 7,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.11)',
              }, wave2Style]}
            />
          </Animated.View>
        )}

        {/* Label */}
        <View style={bottleStyles.labelOverlay} pointerEvents="none">
          <Text style={bottleStyles.percentText}>
            {isComplete ? '✓' : `${Math.round(targetFill * 100)}%`}
          </Text>
          <Text style={bottleStyles.mlText}>
            {isComplete
              ? `${BOTTLE_CAPACITY / 1000}L`
              : `${Math.round(targetFill * BOTTLE_CAPACITY)}ml`}
          </Text>
        </View>
      </View>

      <Text style={bottleStyles.bottleLabel}>#{label}</Text>
    </View>
  );
}

const bottleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 16,
    paddingVertical: 10,
  },
  bottleWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  neck: {
    width: BOTTLE_WIDTH * 0.38,
    height: 20,
    backgroundColor: Colors.dark.border,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neckInner: {
    width: '55%',
    height: 3,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 2,
  },
  body: {
    width: BOTTLE_WIDTH,
    backgroundColor: Colors.dark.surfaceSoft,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  waveContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 14,
    overflow: 'visible',
  },
  labelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  percentText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  mlText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
});
// ─── Corpo Section ────────────────────────────────────────────────────────────

const WATER_QUICK_OPTIONS = [150, 250, 330, 500];

function CorpoSection() {
  const today = todayISO();

  // Peso
  const [weightLogs, setWeightLogs] = useState<BodyWeightLog[]>([]);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightValue, setWeightValue] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  // Acqua
  const [waterTotal, setWaterTotal] = useState(0);
  const [waterCustom, setWaterCustom] = useState('');
  const [savingWater, setSavingWater] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logs, water] = await Promise.all([
        getBodyWeightLogs(),
        getWaterLogByDate(today),
      ]);
      setWeightLogs(logs);
      setWaterTotal(water);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i dati.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const todayWeight = weightLogs.find((l) => l.date === today) ?? null;

  const handleSaveWeight = async () => {
    const val = parseFloat(weightValue.replace(',', '.'));
    if (!val || val <= 0 || val > 500) {
      Alert.alert('Valore non valido', 'Inserisci un peso valido in kg.');
      return;
    }
    try {
      setSavingWeight(true);
      await upsertBodyWeightLog(today, val, weightNotes.trim() || null);
      setWeightValue('');
      setWeightNotes('');
      setShowWeightInput(false);
      await loadData();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il peso.');
    } finally {
      setSavingWeight(false);
    }
  };

  const handleDeleteWeight = (log: BodyWeightLog) => {
    Alert.alert('Rimuovi peso', `Vuoi rimuovere la registrazione del ${formatDateDisplay(log.date)}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: async () => {
        await deleteBodyWeightLog(log.id);
        await loadData();
      }},
    ]);
  };

  const handleAddWater = async (ml: number) => {
    if (!ml || ml <= 0) return;
    try {
      setSavingWater(true);
      await addWaterLog(today, ml);
      setWaterCustom('');
      await loadData();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il log acqua.');
    } finally {
      setSavingWater(false);
    }
  };

  const handleResetWater = () => {
    if (waterTotal === 0) return;
    Alert.alert('Reset acqua', 'Vuoi azzerare il contatore acqua di oggi?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Azzera', style: 'destructive', onPress: async () => {
        await resetWaterLog(today);
        await loadData();
      }},
    ]);
  };

  if (loading) {
    return <View style={corpoStyles.loadingBox}><ActivityIndicator color={PRIMARY} /></View>;
  }

  return (
    <>
      {/* ── Peso corporeo ── */}
      <View style={corpoStyles.sectionCard}>
        <View style={corpoStyles.sectionHeader}>
          <Text style={corpoStyles.sectionTitle}>⚖️ Peso corporeo</Text>
          {!showWeightInput && (
            <TouchableOpacity
              style={corpoStyles.addBtn}
              onPress={() => {
                setWeightValue(todayWeight ? String(todayWeight.weight_kg) : '');
                setWeightNotes(todayWeight?.notes ?? '');
                setShowWeightInput(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={corpoStyles.addBtnText}>
                {todayWeight ? 'Modifica' : '+ Registra'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Oggi */}
        {todayWeight ? (
          <View style={corpoStyles.todayWeightRow}>
            <Text style={corpoStyles.todayWeightValue}>{todayWeight.weight_kg}</Text>
            <Text style={corpoStyles.todayWeightUnit}>kg</Text>
            <Text style={corpoStyles.todayWeightLabel}>oggi</Text>
          </View>
        ) : (
          !showWeightInput && (
            <Text style={corpoStyles.emptyText}>Nessuna registrazione per oggi.</Text>
          )
        )}

        {/* Input */}
        {showWeightInput && (
          <View style={corpoStyles.weightInputBox}>
            <Text style={corpoStyles.inputLabel}>Peso (kg)</Text>
            <TextInput
              value={weightValue}
              onChangeText={setWeightValue}
              keyboardType="decimal-pad"
              placeholder="Es. 75.5"
              placeholderTextColor={Colors.dark.textMuted}
              style={corpoStyles.weightInput}
              autoFocus
              selectTextOnFocus
            />
            <Text style={[corpoStyles.inputLabel, { marginTop: 10 }]}>Note (opzionale)</Text>
            <TextInput
              value={weightNotes}
              onChangeText={setWeightNotes}
              placeholder="Es. mattino a digiuno"
              placeholderTextColor={Colors.dark.textMuted}
              style={corpoStyles.notesInput}
            />
            <View style={corpoStyles.weightInputActions}>
              <TouchableOpacity
                style={[corpoStyles.saveWeightBtn, savingWeight && corpoStyles.disabledBtn]}
                onPress={handleSaveWeight}
                disabled={savingWeight}
                activeOpacity={0.85}
              >
                <Text style={corpoStyles.saveWeightBtnText}>
                  {savingWeight ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={corpoStyles.cancelBtn}
                onPress={() => setShowWeightInput(false)}
                activeOpacity={0.8}
              >
                <Text style={corpoStyles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Storico */}
        {weightLogs.length > 0 && (
          <View style={corpoStyles.historyBox}>
            <Text style={corpoStyles.historyTitle}>Storico</Text>
            <View style={corpoStyles.historyList}>
              {weightLogs.map((log) => (
                <View key={log.id} style={corpoStyles.historyRow}>
                  <View style={corpoStyles.historyLeft}>
                    <Text style={corpoStyles.historyDate}>{formatDateDisplay(log.date)}</Text>
                    {log.notes ? <Text style={corpoStyles.historyNotes}>{log.notes}</Text> : null}
                  </View>
                  <Text style={corpoStyles.historyWeight}>{log.weight_kg} kg</Text>
                  <TouchableOpacity
                    style={corpoStyles.deleteBtn}
                    onPress={() => handleDeleteWeight(log)}
                    activeOpacity={0.8}
                  >
                    <Text style={corpoStyles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── Acqua ── */}
      <View style={corpoStyles.sectionCard}>
        <View style={corpoStyles.sectionHeader}>
          <Text style={corpoStyles.sectionTitle}>💧 Acqua</Text>
          {waterTotal > 0 && (
            <TouchableOpacity
              style={corpoStyles.resetWaterBtn}
              onPress={handleResetWater}
              activeOpacity={0.8}
            >
              <Text style={corpoStyles.resetWaterBtnText}>Azzera</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottle visual */}
        <WaterBottle totalMl={waterTotal} />

        {/* Total label */}
        <Text style={corpoStyles.waterTotalLabel}>
          {waterTotal >= 1000
            ? `${(waterTotal / 1000).toFixed(1).replace('.0', '')}L`
            : `${waterTotal}ml`}
          {' '}bevuti oggi
        </Text>

        {/* Quick buttons */}
        <View style={corpoStyles.waterQuickRow}>
          {WATER_QUICK_OPTIONS.map((ml) => (
            <TouchableOpacity
              key={ml}
              style={[corpoStyles.waterQuickBtn, savingWater && corpoStyles.disabledBtn]}
              onPress={() => handleAddWater(ml)}
              disabled={savingWater}
              activeOpacity={0.85}
            >
              <Text style={corpoStyles.waterQuickBtnText}>+{ml}ml</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom input */}
        <View style={corpoStyles.waterCustomRow}>
          <TextInput
            value={waterCustom}
            onChangeText={setWaterCustom}
            keyboardType="number-pad"
            placeholder="Quantità personalizzata (ml)"
            placeholderTextColor={Colors.dark.textMuted}
            style={corpoStyles.waterCustomInput}
          />
          <TouchableOpacity
            style={[corpoStyles.waterCustomBtn, (!waterCustom || savingWater) && corpoStyles.disabledBtn]}
            onPress={() => handleAddWater(parseInt(waterCustom, 10))}
            disabled={!waterCustom || savingWater}
            activeOpacity={0.85}
          >
            <Text style={corpoStyles.waterCustomBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const corpoStyles = StyleSheet.create({
  loadingBox: { paddingTop: 60, alignItems: 'center' },
  sectionCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Colors.dark.text },
  addBtn: { backgroundColor: 'rgba(126,71,255,0.14)', borderRadius: 10, borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: PRIMARY, fontSize: 13, fontWeight: '700' },
  todayWeightRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 16 },
  todayWeightValue: { fontSize: 42, fontWeight: '800', color: Colors.dark.text, fontVariant: ['tabular-nums'] },
  todayWeightUnit: { fontSize: 18, fontWeight: '600', color: Colors.dark.textMuted },
  todayWeightLabel: { fontSize: 14, color: Colors.dark.textMuted, fontWeight: '600', marginLeft: 4 },
  emptyText: { fontSize: 13, color: Colors.dark.textMuted, fontStyle: 'italic', marginBottom: 4 },
  weightInputBox: { backgroundColor: '#101015', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.dark.textMuted, marginBottom: 6 },
  weightInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: Colors.dark.text, fontSize: 22, fontWeight: '800' },
  notesInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: Colors.dark.text, fontSize: 14 },
  weightInputActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveWeightBtn: { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveWeightBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cancelBtn: { flex: 1, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  cancelBtnText: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '700' },
  historyBox: { borderTopWidth: 1, borderTopColor: Colors.dark.border, paddingTop: 14 },
  historyTitle: { fontSize: 12, fontWeight: '700', color: Colors.dark.textMuted, marginBottom: 10, letterSpacing: 0.5 },
  historyList: { gap: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101015', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.border },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: 14, fontWeight: '700', color: Colors.dark.text },
  historyNotes: { fontSize: 12, color: Colors.dark.textMuted, marginTop: 2 },
  historyWeight: { fontSize: 16, fontWeight: '800', color: Colors.dark.text, fontVariant: ['tabular-nums'] },
  deleteBtn: { width: 28, height: 28, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: Colors.dark.danger, fontSize: 13, fontWeight: '800' },
  waterTotalLabel: { fontSize: 14, fontWeight: '700', color: Colors.dark.textMuted, textAlign: 'center', marginBottom: 14, marginTop: -4 },
  resetWaterBtn: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.danger, paddingHorizontal: 10, paddingVertical: 4 },
  resetWaterBtnText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '700' },
  waterQuickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  waterQuickBtn: { flex: 1, backgroundColor: 'rgba(126,71,255,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', paddingVertical: 12, alignItems: 'center' },
  waterQuickBtnText: { color: PRIMARY, fontSize: 13, fontWeight: '800' },
  waterCustomRow: { flexDirection: 'row', gap: 10 },
  waterCustomInput: { flex: 1, backgroundColor: '#101015', borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: Colors.dark.text, fontSize: 15 },
  waterCustomBtn: { width: 46, backgroundColor: PRIMARY, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  waterCustomBtnText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  disabledBtn: { opacity: 0.5 },
});

// ─── Piano Section ────────────────────────────────────────────────────────────

type PlanType = 'weekly' | 'cycle';

const WEEK_DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

function PianoSection() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [days, setDays] = useState<MealPlanDay[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<number, MealPlanEntry[]>>({});
  const [completedEntries, setCompletedEntries] = useState<Set<number>>(new Set());
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState<{ dayId: number; mealType: string } | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMealPlans();
      setPlans(data);
      if (data.length > 0 && activePlanId === null) {
        setActivePlanId(data[0].id);
      }
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i piani.');
    } finally {
      setLoading(false);
    }
  }, [activePlanId]);

  const loadPlanDetails = useCallback(async (planId: number) => {
    try {
      const planDays = await getMealPlanDays(planId);
      setDays(planDays);
      const map: Record<number, MealPlanEntry[]> = {};
      for (const day of planDays) {
        map[day.id] = await getMealPlanEntries(day.id);
      }
      setEntriesByDay(map);
      if (planDays.length > 0 && expandedDay === null) {
        setExpandedDay(planDays[0].id);
      }
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i dettagli del piano.');
    }
  }, [expandedDay]);

  useFocusEffect(useCallback(() => { loadPlans(); }, [loadPlans]));

  React.useEffect(() => {
    if (activePlanId) loadPlanDetails(activePlanId);
  }, [activePlanId]);

  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;

  const handleDeletePlan = (plan: MealPlan) => {
    Alert.alert('Elimina piano', `Vuoi eliminare "${plan.name}"? Tutti i giorni e i pasti verranno rimossi.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await deleteMealPlan(plan.id);
        setActivePlanId(null);
        setDays([]);
        setEntriesByDay({});
        setExpandedDay(null);
        loadPlans();
      }},
    ]);
  };

  const handleAddDay = async () => {
    if (!activePlanId || !activePlan) return;
    try {
      const label = activePlan.plan_type === 'weekly'
        ? (WEEK_DAYS[days.length] ?? `Giorno ${days.length + 1}`)
        : `Giorno ${days.length + 1}`;
      await addMealPlanDay(activePlanId, days.length + 1, label);
      await loadPlanDetails(activePlanId);
    } catch {
      Alert.alert('Errore', 'Impossibile aggiungere il giorno.');
    }
  };

  const handleDeleteDay = (day: MealPlanDay) => {
    Alert.alert('Rimuovi giorno', `Vuoi rimuovere "${day.label}"?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: async () => {
        await deleteMealPlanDay(day.id);
        if (expandedDay === day.id) setExpandedDay(null);
        if (activePlanId) await loadPlanDetails(activePlanId);
      }},
    ]);
  };

  const handleDeleteEntry = (entry: MealPlanEntry, dayId: number) => {
    Alert.alert('Rimuovi voce', `Vuoi rimuovere "${entry.food_name}"?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: async () => {
        await deleteMealPlanEntry(entry.id);
        if (activePlanId) await loadPlanDetails(activePlanId);
      }},
    ]);
  };

  const toggleCompleted = (entryId: number) => {
    setCompletedEntries((prev) => {
      const next = new Set(prev);
      next.has(entryId) ? next.delete(entryId) : next.add(entryId);
      return next;
    });
  };

  if (loading) {
    return <View style={pianoStyles.loadingBox}><ActivityIndicator color={PRIMARY} /></View>;
  }

  if (plans.length === 0) {
    return (
      <>
        <View style={pianoStyles.emptyBox}>
          <Text style={pianoStyles.emptyEmoji}>📋</Text>
          <Text style={pianoStyles.emptyTitle}>Nessun piano alimentare</Text>
          <Text style={pianoStyles.emptyText}>Crea il tuo primo piano per avere sempre a portata di mano cosa mangiare.</Text>
          <TouchableOpacity style={pianoStyles.createBtn} onPress={() => setShowNewPlanModal(true)} activeOpacity={0.85}>
            <Text style={pianoStyles.createBtnText}>+ Crea piano</Text>
          </TouchableOpacity>
        </View>
        <NewPlanModal visible={showNewPlanModal} onClose={() => setShowNewPlanModal(false)} onSaved={() => { loadPlans(); setShowNewPlanModal(false); }} />
      </>
    );
  }

  return (
    <>
      {/* Piano selector */}
      {plans.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pianoStyles.planSelectorRow} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {plans.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[pianoStyles.planChip, activePlanId === p.id && pianoStyles.planChipActive]}
              onPress={() => { setActivePlanId(p.id); setExpandedDay(null); }}
              activeOpacity={0.8}
            >
              <Text style={[pianoStyles.planChipText, activePlanId === p.id && pianoStyles.planChipTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Active plan header */}
      {activePlan && (
        <View style={pianoStyles.planHeader}>
          <View style={pianoStyles.planHeaderLeft}>
            <Text style={pianoStyles.planName}>{activePlan.name}</Text>
            <View style={pianoStyles.planTypeBadge}>
              <Text style={pianoStyles.planTypeText}>
                {activePlan.plan_type === 'weekly' ? '📅 Settimanale' : '🔄 Ciclo libero'}
              </Text>
            </View>
          </View>
          <View style={pianoStyles.planHeaderActions}>
            <TouchableOpacity style={pianoStyles.deletePlanBtn} onPress={() => handleDeletePlan(activePlan)} activeOpacity={0.8}>
              <Text style={pianoStyles.deletePlanBtnText}>Elimina piano</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Days */}
      {days.length === 0 ? (
        <View style={pianoStyles.noDaysBox}>
          <Text style={pianoStyles.noDaysText}>Nessun giorno aggiunto. Inizia aggiungendo il primo giorno.</Text>
        </View>
      ) : (
        <View style={pianoStyles.daysList}>
          {days.map((day) => {
            const isExpanded = expandedDay === day.id;
            const entries = entriesByDay[day.id] ?? [];
            const mealGroups: Record<string, MealPlanEntry[]> = {};
            for (const e of entries) {
              if (!mealGroups[e.meal_type]) mealGroups[e.meal_type] = [];
              mealGroups[e.meal_type].push(e);
            }
            const dayKcal = entries.reduce((s, e) => s + (e.kcal ?? 0), 0);

            return (
              <View key={day.id} style={pianoStyles.dayCard}>
                <TouchableOpacity
                  style={pianoStyles.dayHeader}
                  onPress={() => setExpandedDay(isExpanded ? null : day.id)}
                  activeOpacity={0.8}
                >
                  <View style={pianoStyles.dayHeaderLeft}>
                    <Text style={pianoStyles.dayLabel}>{day.label}</Text>
                    {dayKcal > 0 && <Text style={pianoStyles.dayKcal}>{Math.round(dayKcal)} kcal</Text>}
                  </View>
                  <View style={pianoStyles.dayHeaderRight}>
                    <TouchableOpacity style={pianoStyles.deleteDayBtn} onPress={() => handleDeleteDay(day)} activeOpacity={0.8}>
                      <Text style={pianoStyles.deleteDayBtnText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={pianoStyles.dayChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={pianoStyles.dayContent}>
                    {MEAL_TYPES.map((meal) => {
                      const mealEntries = mealGroups[meal.key] ?? [];
                      return (
                        <View key={meal.key} style={pianoStyles.mealGroup}>
                          <View style={pianoStyles.mealGroupHeader}>
                            <Text style={pianoStyles.mealGroupTitle}>{meal.emoji} {meal.label}</Text>
                            <TouchableOpacity
                              style={pianoStyles.addEntryBtn}
                              onPress={() => setShowAddEntryModal({ dayId: day.id, mealType: meal.key })}
                              activeOpacity={0.8}
                            >
                              <Text style={pianoStyles.addEntryBtnText}>+ Aggiungi</Text>
                            </TouchableOpacity>
                          </View>
                          {mealEntries.length === 0 ? (
                            <Text style={pianoStyles.emptyMealText}>Nessun alimento</Text>
                          ) : (
                            <View style={pianoStyles.entryList}>
                              {mealEntries.map((entry) => {
                                const done = completedEntries.has(entry.id);
                                return (
                                  <View key={entry.id} style={[pianoStyles.entryRow, done && pianoStyles.entryRowDone]}>
                                    <TouchableOpacity style={pianoStyles.entryCheckbox} onPress={() => toggleCompleted(entry.id)} activeOpacity={0.8}>
                                      <View style={[pianoStyles.checkbox, done && pianoStyles.checkboxDone]}>
                                        {done && <Text style={pianoStyles.checkboxTick}>✓</Text>}
                                      </View>
                                    </TouchableOpacity>
                                    <View style={pianoStyles.entryInfo}>
                                      <Text style={[pianoStyles.entryName, done && pianoStyles.entryNameDone]}>{entry.food_name}</Text>
                                      <Text style={pianoStyles.entryMacros}>
                                        {entry.grams}g · {roundMacro(entry.kcal)} kcal · P {roundMacro(entry.protein)}g · C {roundMacro(entry.carbs)}g · G {roundMacro(entry.fat)}g
                                      </Text>
                                    </View>
                                    <TouchableOpacity style={pianoStyles.deleteEntryBtn} onPress={() => handleDeleteEntry(entry, day.id)} activeOpacity={0.8}>
                                      <Text style={pianoStyles.deleteEntryBtnText}>✕</Text>
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Add day button */}
      {activePlan && (activePlan.plan_type === 'cycle' || days.length < 7) && (
        <TouchableOpacity style={pianoStyles.addDayBtn} onPress={handleAddDay} activeOpacity={0.85}>
          <Text style={pianoStyles.addDayBtnText}>
            {activePlan.plan_type === 'weekly'
              ? `+ Aggiungi ${WEEK_DAYS[days.length] ?? 'giorno'}`
              : `+ Aggiungi Giorno ${days.length + 1}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Nuovo piano — separato dal piano attivo */}
      <View style={pianoStyles.newPlanSeparator} />
      <TouchableOpacity style={pianoStyles.newPlanBottomBtn} onPress={() => setShowNewPlanModal(true)} activeOpacity={0.85}>
        <Text style={pianoStyles.newPlanBottomBtnText}>+ Crea nuovo piano</Text>
      </TouchableOpacity>

      <NewPlanModal visible={showNewPlanModal} onClose={() => setShowNewPlanModal(false)} onSaved={() => { loadPlans(); setShowNewPlanModal(false); }} />

      {showAddEntryModal && (
        <AddEntryToPlanModal
          visible={!!showAddEntryModal}
          dayId={showAddEntryModal.dayId}
          mealType={showAddEntryModal.mealType}
          onClose={() => setShowAddEntryModal(null)}
          onAdded={async () => { if (activePlanId) await loadPlanDetails(activePlanId); }}
        />
      )}
    </>
  );
}

// ─── New Plan Modal ───────────────────────────────────────────────────────────

function NewPlanModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState<PlanType>('weekly');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => { if (!visible) { setName(''); setPlanType('weekly'); } }, [visible]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Nome mancante', 'Inserisci il nome del piano.'); return; }
    try {
      setSaving(true);
      await addMealPlan(name.trim(), planType);
      onSaved();
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Impossibile creare il piano.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={newPlanStyles.container} contentContainerStyle={newPlanStyles.content} keyboardShouldPersistTaps="handled">
        <View style={newPlanStyles.handle} />
        <View style={newPlanStyles.header}>
          <Text style={newPlanStyles.title}>Nuovo piano</Text>
          <TouchableOpacity onPress={onClose} style={newPlanStyles.closeBtn} activeOpacity={0.8}>
            <Text style={newPlanStyles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        <Text style={newPlanStyles.fieldLabel}>Nome piano *</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Es. Piano massa" placeholderTextColor={Colors.dark.textMuted} style={newPlanStyles.input} autoFocus />

        <Text style={[newPlanStyles.fieldLabel, { marginTop: 20 }]}>Tipo di piano</Text>
        <View style={newPlanStyles.typeRow}>
          {([['weekly', '📅 Settimanale', 'Lun–Dom, si ripete ogni settimana'], ['cycle', '🔄 Ciclo libero', 'Giorni numerati, senza vincolo settimanale']] as const).map(([key, label, desc]) => (
            <TouchableOpacity
              key={key}
              style={[newPlanStyles.typeCard, planType === key && newPlanStyles.typeCardActive]}
              onPress={() => setPlanType(key)}
              activeOpacity={0.85}
            >
              <Text style={[newPlanStyles.typeLabel, planType === key && newPlanStyles.typeLabelActive]}>{label}</Text>
              <Text style={newPlanStyles.typeDesc}>{desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[newPlanStyles.saveBtn, saving && newPlanStyles.saveBtnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={newPlanStyles.saveBtnText}>{saving ? 'Creazione...' : 'Crea piano'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const newPlanStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 60 },
  handle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  closeBtnText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted, marginBottom: 8 },
  input: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: Colors.dark.text, fontSize: 15, marginBottom: 4 },
  typeRow: { gap: 10, marginBottom: 24 },
  typeCard: { backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.border },
  typeCardActive: { borderColor: PRIMARY, backgroundColor: 'rgba(126,71,255,0.1)' },
  typeLabel: { fontSize: 15, fontWeight: '700', color: Colors.dark.textMuted, marginBottom: 4 },
  typeLabelActive: { color: Colors.dark.text },
  typeDesc: { fontSize: 13, color: Colors.dark.textMuted },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── Add Entry to Plan Modal ──────────────────────────────────────────────────

function AddEntryToPlanModal({ visible, dayId, mealType, onClose, onAdded }: {
  visible: boolean; dayId: number; mealType: string; onClose: () => void; onAdded: () => void;
}) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('100');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) { setSelected(null); setGrams('100'); setSearch(''); return; }
    setLoading(true);
    getFoodItems().then(setFoods).catch(() => setFoods([])).finally(() => setLoading(false));
  }, [visible]);

  const filtered = useMemo(() => {
    if (!search.trim()) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [foods, search]);

  const g = parseFloat(grams.replace(',', '.')) || 0;
  const mealLabel = MEAL_TYPES.find((m) => m.key === mealType)?.label ?? mealType;

  const handleAdd = async () => {
    if (!selected) return;
    if (!g || g <= 0) { Alert.alert('Quantità non valida', 'Inserisci un valore maggiore di 0.'); return; }
    try {
      setSaving(true);
      await addMealPlanEntry({
        meal_plan_day_id: dayId,
        meal_type: mealType,
        food_item_id: selected.id,
        food_name: selected.name,
        grams: g,
        kcal: scaleNutrient(selected.kcal_per_100g, g),
        protein: scaleNutrient(selected.protein_g, g),
        carbs: scaleNutrient(selected.carbs_g, g),
        fat: scaleNutrient(selected.fat_g, g),
      });
      onAdded();
      onClose();
    } catch {
      Alert.alert('Errore', 'Impossibile aggiungere l\'alimento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={addModalStyles.container}>
        <View style={addModalStyles.handle} />
        <View style={addModalStyles.header}>
          <Text style={addModalStyles.title}>Aggiungi a {mealLabel}</Text>
          <TouchableOpacity onPress={onClose} style={addModalStyles.closeBtn} activeOpacity={0.8}>
            <Text style={addModalStyles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        {selected ? (
          <ScrollView contentContainerStyle={addModalStyles.confirmContent} keyboardShouldPersistTaps="handled">
            <View style={addModalStyles.selectedCard}>
              <Text style={addModalStyles.selectedName}>{selected.name}</Text>
              <Text style={addModalStyles.selectedPer100}>Per 100g: {roundMacro(selected.kcal_per_100g)} kcal · P {roundMacro(selected.protein_g)}g · C {roundMacro(selected.carbs_g)}g · G {roundMacro(selected.fat_g)}g</Text>
            </View>
            <Text style={addModalStyles.inputLabel}>Quantità (grammi)</Text>
            <TextInput value={grams} onChangeText={setGrams} keyboardType="decimal-pad" style={addModalStyles.gramsInput} placeholder="100" placeholderTextColor={Colors.dark.textMuted} selectTextOnFocus />
            {g > 0 && (
              <View style={addModalStyles.previewCard}>
                <Text style={addModalStyles.previewTitle}>Per {g}g</Text>
                <View style={addModalStyles.previewRow}>
                  {[
                    { label: 'kcal', value: roundMacro(scaleNutrient(selected.kcal_per_100g, g)), color: Colors.dark.text },
                    { label: 'Proteine', value: `${roundMacro(scaleNutrient(selected.protein_g, g))}g`, color: '#60a5fa' },
                    { label: 'Carbo', value: `${roundMacro(scaleNutrient(selected.carbs_g, g))}g`, color: '#fbbf24' },
                    { label: 'Grassi', value: `${roundMacro(scaleNutrient(selected.fat_g, g))}g`, color: '#f87171' },
                  ].map((m) => (
                    <View key={m.label} style={addModalStyles.previewItem}>
                      <Text style={[addModalStyles.previewValue, { color: m.color }]}>{m.value}</Text>
                      <Text style={addModalStyles.previewLabel}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity style={[addModalStyles.addBtn, saving && addModalStyles.addBtnDisabled]} onPress={handleAdd} disabled={saving} activeOpacity={0.85}>
              <Text style={addModalStyles.addBtnText}>{saving ? 'Salvataggio...' : 'Aggiungi al piano'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={addModalStyles.backBtn} onPress={() => setSelected(null)} activeOpacity={0.8}>
              <Text style={addModalStyles.backBtnText}>← Cambia alimento</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <>
            <View style={addModalStyles.searchRow}>
              <TextInput value={search} onChangeText={setSearch} placeholder="Cerca alimento..." placeholderTextColor={Colors.dark.textMuted} style={addModalStyles.searchInput} autoFocus clearButtonMode="while-editing" />
            </View>
            {loading ? (
              <View style={addModalStyles.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={addModalStyles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={addModalStyles.emptyBox}>
                    <Text style={addModalStyles.emptyText}>{search.trim() ? `Nessun risultato per "${search}"` : 'Nessun alimento nel catalogo.'}</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={addModalStyles.foodRow} onPress={() => setSelected(item)} activeOpacity={0.85}>
                    <View style={addModalStyles.foodInfo}>
                      <Text style={addModalStyles.foodName}>{item.name}</Text>
                      <Text style={addModalStyles.foodMacros}>{roundMacro(item.kcal_per_100g)} kcal · P {roundMacro(item.protein_g)}g · C {roundMacro(item.carbs_g)}g · G {roundMacro(item.fat_g)}g</Text>
                    </View>
                    <View style={addModalStyles.selectBadge}><Text style={addModalStyles.selectBadgeText}>Seleziona</Text></View>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const pianoStyles = StyleSheet.create({
  loadingBox: { paddingTop: 60, alignItems: 'center' },
  emptyBox: { paddingTop: 40, alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.dark.text },
  emptyText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  createBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  planSelectorRow: { marginBottom: 12 },
  planChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border },
  planChipActive: { backgroundColor: 'rgba(126,71,255,0.18)', borderColor: PRIMARY },
  planChipText: { fontSize: 13, fontWeight: '700', color: Colors.dark.textMuted },
  planChipTextActive: { color: PRIMARY },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  planHeaderLeft: { flex: 1, gap: 6 },
  planName: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  planTypeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.dark.surfaceSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.dark.border },
  planTypeText: { fontSize: 12, fontWeight: '600', color: Colors.dark.textMuted },
  planHeaderActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  newPlanBtn: { backgroundColor: 'rgba(126,71,255,0.14)', borderRadius: 10, borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 6 },
  newPlanBtnText: { color: Colors.dark.primarySoft, fontSize: 12, fontWeight: '700' },
  deletePlanBtn: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.danger, paddingHorizontal: 10, paddingVertical: 6 },
  deletePlanBtnText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '700' },
  noDaysBox: { padding: 20, alignItems: 'center' },
  noDaysText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 20 },
  daysList: { gap: 10 },
  dayCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.border, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  dayHeaderLeft: { flex: 1, gap: 2 },
  dayLabel: { fontSize: 16, fontWeight: '800', color: Colors.dark.text },
  dayKcal: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: '600' },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteDayBtn: { width: 26, height: 26, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 7, borderWidth: 1, borderColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center' },
  deleteDayBtnText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '800' },
  dayChevron: { fontSize: 11, color: Colors.dark.textMuted, fontWeight: '700' },
  dayContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 14, borderTopWidth: 1, borderTopColor: Colors.dark.border },
  mealGroup: { gap: 8, paddingTop: 14 },
  mealGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealGroupTitle: { fontSize: 14, fontWeight: '700', color: Colors.dark.text },
  addEntryBtn: { backgroundColor: 'rgba(126,71,255,0.14)', borderRadius: 8, borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 4 },
  addEntryBtnText: { color: Colors.dark.primarySoft, fontSize: 12, fontWeight: '700' },
  emptyMealText: { fontSize: 12, color: Colors.dark.textMuted, fontStyle: 'italic' },
  entryList: { gap: 6 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101015', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.dark.border },
  entryRowDone: { opacity: 0.5 },
  entryCheckbox: { padding: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  checkboxTick: { color: '#fff', fontSize: 12, fontWeight: '800' },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 13, fontWeight: '700', color: Colors.dark.text, marginBottom: 2 },
  entryNameDone: { textDecorationLine: 'line-through' },
  entryMacros: { fontSize: 11, color: Colors.dark.textMuted },
  deleteEntryBtn: { width: 26, height: 26, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 7, borderWidth: 1, borderColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center' },
  deleteEntryBtnText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '800' },
  addDayBtn: { marginTop: 12, backgroundColor: Colors.dark.surface, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center' },
  addDayBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
  newPlanSeparator: { marginTop: 24, marginBottom: 12, height: 1, backgroundColor: Colors.dark.border },
  newPlanBottomBtn: { backgroundColor: Colors.dark.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.border, paddingVertical: 14, alignItems: 'center' },
  newPlanBottomBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const [section, setSection] = useState<SectionKey>('diario');
  const [currentDate, setCurrentDate] = useState(todayISO());

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Alimentazione</Text>

        <SegmentedControl active={section} onChange={setSection} />

        <View style={styles.sectionContent}>
          {section === 'diario' && (
            <DiarioSection date={currentDate} onDateChange={setCurrentDate} />
          )}
          {section === 'piano' && (
            <PianoSection />
          )}
          {section === 'corpo' && (
            <CorpoSection />
          )}
          {section === 'catalogo' && (
            <CatalogoSection />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.dark.background },
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginBottom: 16 },
  sectionContent: { marginTop: 16 },
});