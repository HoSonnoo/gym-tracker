import { Colors } from '@/constants/Colors';
import {
  addFoodItem,
  addMealPlan,
  addMealPlanDay,
  addMealPlanEntry,
  addNutritionLog,
  addRecipe,
  addWaterLog,
  deleteBodyWeightLog,
  deleteMealPlan,
  deleteMealPlanDay,
  deleteMealPlanEntry,
  deleteRecipe,
  getActivePlanEntriesForToday,
  getBodyWeightLogs,
  getFoodItems,
  getMealPlanDays,
  getMealPlanEntries,
  getMealPlans,
  getNutritionLogsByDate,
  getRecipes,
  getWaterLogByDate,
  resetWaterLog,
  setMealPlanActiveDays,
  updateMealPlanEntry,
  upsertBodyWeightLog,
  type BodyWeightLog,
  type FoodItem,
  type MealPlan,
  type MealPlanDay,
  type MealPlanEntry,
  type NutritionLog,
  type Recipe
} from '@/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';


// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#7e47ff';
const ANTHROPIC_API_KEY = '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';

const MEAL_TYPES = [
  { key: 'integrazione', label: 'Integrazione', emoji: '💊' },
  { key: 'colazione',    label: 'Colazione',     emoji: '☀️' },
  { key: 'pranzo',       label: 'Pranzo',        emoji: '🍽️' },
  { key: 'cena',         label: 'Cena',          emoji: '🌙' },
  { key: 'spuntino',     label: 'Spuntini',      emoji: '🍎' },
] as const;

type MealType = typeof MEAL_TYPES[number]['key'];
type SectionKey = 'diario' | 'catalogo' | 'piano' | 'corpo' | 'ricette';

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
    { key: 'ricette',  label: 'Ricette' },
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
    fontSize: 10,
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

  divider: { height: 1, backgroundColor: Colors.dark.border, marginVertical: 24 },
  importBtn: { backgroundColor: 'rgba(126,71,255,0.12)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: PRIMARY, borderStyle: 'dashed' },
  importBtnText: { color: PRIMARY, fontSize: 15, fontWeight: '800' },
  importHint: { fontSize: 12, color: Colors.dark.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 17, paddingBottom: 20 },
});

// ─── Diario Section ───────────────────────────────────────────────────────────

type DiarioProps = {
  date: string;
  onDateChange: (iso: string) => void;
};

// Grafico torta SVG semplice
function PieChart({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein + carbs + fat;
  if (total === 0) return null;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 54;
  const innerR = 32;

  const slices = [
    { value: protein, color: '#60a5fa', label: 'P' },
    { value: carbs,   color: '#fbbf24', label: 'C' },
    { value: fat,     color: '#f87171', label: 'G' },
  ];

  let currentAngle = -Math.PI / 2;
  const paths: { d: string; color: string }[] = [];

  for (const slice of slices) {
    const angle = (slice.value / total) * 2 * Math.PI;
    const endAngle = currentAngle + angle;
    const x1 = cx + r * Math.cos(currentAngle);
    const y1 = cy + r * Math.sin(currentAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(currentAngle);
    const iy1 = cy + innerR * Math.sin(currentAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    paths.push({
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`,
      color: slice.color,
    });
    currentAngle = endAngle;
  }

  return (
    <Svg width={size} height={size}>
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.color} />
      ))}
    </Svg>
  );
}

function MacroProgressBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const remaining = Math.max(target - value, 0);
  return (
    <View style={diarioStyles.progressRow}>
      <View style={diarioStyles.progressHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[diarioStyles.progressDot, { backgroundColor: color }]} />
          <Text style={diarioStyles.progressLabel}>{label}</Text>
        </View>
        <Text style={diarioStyles.progressValues}>
          <Text style={{ color }}>{Math.round(value)}</Text>
          {target > 0 && <Text style={diarioStyles.progressTarget}> / {Math.round(target)}g</Text>}
        </Text>
      </View>
      <View style={diarioStyles.progressTrack}>
        <View style={[diarioStyles.progressFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      {target > 0 && remaining > 0 && (
        <Text style={diarioStyles.progressRemaining}>Mancano {Math.round(remaining)}g</Text>
      )}
    </View>
  );
}

function DiarioSection({ date, onDateChange }: DiarioProps) {
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [consumedTotals, setConsumedTotals] = useState<{ kcal: number; protein: number; carbs: number; fat: number } | null>(null);
  const [remainingTotals, setRemainingTotals] = useState<{ kcal: number; protein: number; carbs: number; fat: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const COMPLETED_KEY = '@vyro:piano_completed';

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem(COMPLETED_KEY).catch(() => null);
      const completedIds: number[] = stored ? JSON.parse(stored) : [];

      const [data, planData] = await Promise.all([
        getNutritionLogsByDate(date),
        getActivePlanEntriesForToday(completedIds),
      ]);
      setLogs(data);
      // Mostra consumed anche se kcal=0 (es. solo integratori) purché ci siano voci spuntate
      setConsumedTotals(completedIds.length > 0 ? planData.consumedTotals : null);
      setRemainingTotals(planData.remainingTotals.kcal > 0 ? planData.remainingTotals : null);
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

  const isFuture = date > todayISO();

  return (
    <>
      {/* Date navigator */}
      <View style={diarioStyles.dateNav}>
        <TouchableOpacity style={diarioStyles.dateArrow} onPress={() => onDateChange(shiftDate(date, -1))} activeOpacity={0.8}>
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
        <View style={diarioStyles.loadingBox}><ActivityIndicator color={PRIMARY} /></View>
      ) : (
        <View style={diarioStyles.content}>
          {/* Grafico torta + kcal */}
          <View style={diarioStyles.chartCard}>
            <View style={diarioStyles.chartRow}>
              <PieChart
                protein={consumedTotals?.protein ?? 0}
                carbs={consumedTotals?.carbs ?? 0}
                fat={consumedTotals?.fat ?? 0}
              />
              <View style={diarioStyles.kcalBox}>
                <Text style={diarioStyles.kcalValue}>{Math.round(consumedTotals?.kcal ?? 0)}</Text>
                <Text style={diarioStyles.kcalUnit}>kcal assunte</Text>
                {remainingTotals && (
                  <Text style={diarioStyles.kcalTarget}>
                    ancora {Math.round(remainingTotals.kcal)} kcal
                  </Text>
                )}
              </View>
            </View>

            {/* Barre macro — consumed vs remaining */}
            <View style={diarioStyles.barsContainer}>
              <MacroProgressBar label="Proteine" value={consumedTotals?.protein ?? 0} target={(consumedTotals?.protein ?? 0) + (remainingTotals?.protein ?? 0)} color="#60a5fa" />
              <MacroProgressBar label="Carboidrati" value={consumedTotals?.carbs ?? 0} target={(consumedTotals?.carbs ?? 0) + (remainingTotals?.carbs ?? 0)} color="#fbbf24" />
              <MacroProgressBar label="Grassi" value={consumedTotals?.fat ?? 0} target={(consumedTotals?.fat ?? 0) + (remainingTotals?.fat ?? 0)} color="#f87171" />
            </View>

            {/* Legenda */}
            <View style={diarioStyles.legend}>
              {[
                { label: 'Proteine', color: '#60a5fa' },
                { label: 'Carbo', color: '#fbbf24' },
                { label: 'Grassi', color: '#f87171' },
              ].map((item) => (
                <View key={item.label} style={diarioStyles.legendItem}>
                  <View style={[diarioStyles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={diarioStyles.legendLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {!remainingTotals && !consumedTotals && (
              <Text style={diarioStyles.noPlanHint}>
                💡 Collega un piano alimentare per vedere gli obiettivi giornalieri
              </Text>
            )}
          </View>
        </View>
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
  content: { gap: 16 },
  chartCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', gap: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  kcalBox: { alignItems: 'center', gap: 2 },
  kcalValue: { fontSize: 42, fontWeight: '900', color: Colors.dark.text },
  kcalUnit: { fontSize: 15, color: Colors.dark.textMuted, fontWeight: '600' },
  kcalTarget: { fontSize: 12, color: Colors.dark.textMuted, marginTop: 4 },
  kcalRemaining: { fontSize: 13, color: Colors.dark.success, fontWeight: '700' },
  barsContainer: { gap: 12 },
  progressRow: { gap: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: Colors.dark.text },
  progressValues: { fontSize: 13, fontWeight: '700', color: Colors.dark.text },
  progressTarget: { color: Colors.dark.textMuted, fontWeight: '400' },
  progressTrack: { height: 6, backgroundColor: '#2a2a35', borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%' as any, borderRadius: 6 },
  progressRemaining: { fontSize: 11, color: Colors.dark.textMuted, textAlign: 'right' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: '600' },
  noPlanHint: { fontSize: 12, color: Colors.dark.textMuted, textAlign: 'center', fontStyle: 'italic' },
});


// ─── Catalogo Section ─────────────────────────────────────────────────────────

// ─── Open Food Facts helpers ──────────────────────────────────────────────────

type OFFProduct = {
  id: string;
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

async function searchOpenFoodFacts(query: string): Promise<OFFProduct[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=id,product_name,nutriments`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.products ?? [])
    .filter((p: any) => p.product_name)
    .map((p: any) => ({
      id: p.id ?? p._id ?? '',
      name: p.product_name,
      kcal: p.nutriments?.['energy-kcal_100g'] ?? null,
      protein: p.nutriments?.proteins_100g ?? null,
      carbs: p.nutriments?.carbohydrates_100g ?? null,
      fat: p.nutriments?.fat_100g ?? null,
    }));
}

// ─── OFFProductModal — scegli cosa fare con un risultato online ───────────────

function OFFProductModal({ product, onClose, onSavedToCatalog, onAddedToDiary }: {
  product: OFFProduct;
  onClose: () => void;
  onSavedToCatalog: () => void;
  onAddedToDiary: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSaveToCatalog = async () => {
    try {
      setSaving(true);
      await addFoodItem({
        name: product.name,
        kcal_per_100g: product.kcal,
        protein_g: product.protein,
        carbs_g: product.carbs,
        fat_g: product.fat,
        source: 'openfoodfacts',
        external_id: product.id,
      });
      onSavedToCatalog();
      onClose();
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? `Impossibile salvare l'alimento.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={offStyles.container}>
        <View style={offStyles.handle} />
        <View style={offStyles.header}>
          <Text style={offStyles.title} numberOfLines={2}>{product.name}</Text>
          <TouchableOpacity onPress={onClose} style={offStyles.closeBtn} activeOpacity={0.8}>
            <Text style={offStyles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        <Text style={offStyles.sourceTag}>🌐 Open Food Facts</Text>

        <View style={offStyles.macroGrid}>
          {[
            { label: 'kcal', value: product.kcal, color: Colors.dark.text },
            { label: 'Proteine', value: product.protein, color: '#60a5fa' },
            { label: 'Carboidrati', value: product.carbs, color: '#fbbf24' },
            { label: 'Grassi', value: product.fat, color: '#f87171' },
          ].map((m) => (
            <View key={m.label} style={offStyles.macroCell}>
              <Text style={[offStyles.macroValue, { color: m.color }]}>{roundMacro(m.value)}</Text>
              <Text style={offStyles.macroLabel}>{m.label}</Text>
              <Text style={offStyles.macroPer}>per 100g</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[offStyles.btn, saving && offStyles.btnDisabled]}
          onPress={handleSaveToCatalog}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={offStyles.btnText}>{saving ? `Salvataggio...` : `📚 Salva nel catalogo`}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={offStyles.btnSecondary}
          onPress={() => { onAddedToDiary(); onClose(); }}
          activeOpacity={0.85}
        >
          <Text style={offStyles.btnSecondaryText}>📓 Aggiungi al diario</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const offStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, padding: 20, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.dark.text, flex: 1 },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  closeBtnText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  sourceTag: { fontSize: 12, color: Colors.dark.textMuted, marginBottom: 20, fontWeight: '600' },
  macroGrid: { flexDirection: 'row', backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 24 },
  macroCell: { flex: 1, alignItems: 'center', gap: 2 },
  macroValue: { fontSize: 18, fontWeight: '800' },
  macroLabel: { fontSize: 11, color: Colors.dark.textMuted, fontWeight: '600' },
  macroPer: { fontSize: 11, color: 'rgba(211, 211, 211, 0.8)' },
  btn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnSecondary: { backgroundColor: Colors.dark.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  btnSecondaryText: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' },
});

// ─── Catalogo Section ─────────────────────────────────────────────────────────

function CatalogoSection() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [offResults, setOffResults] = useState<OFFProduct[]>([]);
  const [offLoading, setOffLoading] = useState(false);
  const [selectedOFF, setSelectedOFF] = useState<OFFProduct | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Ricerca online con debounce 600ms
  const handleSearchChange = (text: string) => {
    setSearch(text);
    setOffResults([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length >= 2) {
      searchTimer.current = setTimeout(async () => {
        setOffLoading(true);
        try {
          const results = await searchOpenFoodFacts(text.trim());
          setOffResults(results);
        } catch {
          setOffResults([]);
        } finally {
          setOffLoading(false);
        }
      }, 600);
    }
  };

  const renderFoodCard = (item: FoodItem) => (
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
  );

  return (
    <>
      <View style={catStyles.searchRow}>
        <TextInput
          value={search}
          onChangeText={handleSearchChange}
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

      {/* Risultati catalogo locale */}
      {loading ? (
        <View style={catStyles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : filtered.length === 0 && !search.trim() ? (
        <View style={catStyles.emptyBox}>
          <Text style={catStyles.emptyTitle}>Catalogo vuoto</Text>
          <Text style={catStyles.emptyText}>Aggiungi il tuo primo alimento con il pulsante qui sopra.</Text>
        </View>
      ) : (
        <View style={catStyles.list}>
          {filtered.map(renderFoodCard)}
        </View>
      )}

      {/* Risultati Open Food Facts */}
      {search.trim().length >= 2 && (
        <View style={catStyles.offSection}>
          <Text style={catStyles.offSectionTitle}>🌐 Risultati online</Text>
          {offLoading ? (
            <View style={catStyles.loadingBox}>
              <ActivityIndicator color={PRIMARY} size="small" />
            </View>
          ) : offResults.length === 0 && !offLoading ? (
            <Text style={catStyles.offEmpty}>Nessun risultato online.</Text>
          ) : (
            offResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={catStyles.offCard}
                onPress={() => setSelectedOFF(item)}
                activeOpacity={0.85}
              >
                <View style={catStyles.offCardLeft}>
                  <Text style={catStyles.offCardName}>{item.name}</Text>
                  <Text style={catStyles.offCardMacros}>
                    {roundMacro(item.kcal)} kcal · P {roundMacro(item.protein)}g · C {roundMacro(item.carbs)}g · G {roundMacro(item.fat)}g
                  </Text>
                </View>
                <Text style={catStyles.offCardChevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <AddFoodItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={loadFoods}
      />

      {selectedOFF && (
        <OFFProductModal
          product={selectedOFF}
          onClose={() => setSelectedOFF(null)}
          onSavedToCatalog={loadFoods}
          onAddedToDiary={() => {
            // TODO step 2: aprire direttamente il diario con l'alimento preselezionato
            Alert.alert('Suggerimento', `Vai nel tab Diario e aggiungi "${selectedOFF.name}" dal catalogo dopo averlo salvato.`);
          }}
        />
      )}
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
  offSection: { marginTop: 20, gap: 8 },
  offSectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.dark.textMuted, marginBottom: 4 },
  offEmpty: { fontSize: 13, color: Colors.dark.textMuted, fontStyle: 'italic' },
  offCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.border, gap: 10 },
  offCardLeft: { flex: 1 },
  offCardName: { fontSize: 14, fontWeight: '700', color: Colors.dark.text, marginBottom: 3 },
  offCardMacros: { fontSize: 12, color: Colors.dark.textMuted },
  offCardChevron: { fontSize: 20, color: Colors.dark.textMuted },
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
  const fillProgress = useSharedValue(targetFill);
  // waveRipple oscilla tra -4 e +4 px — modifica l'altezza del fill
  const waveRipple = useSharedValue(0);

  useEffect(() => {
    fillProgress.value = withSpring(targetFill, {
      damping: 18,
      stiffness: 80,
      mass: 1,
    });
  }, [targetFill]);

  // Loop perpetuo: la superficie sale e scende di 4px
  useEffect(() => {
    waveRipple.value = withRepeat(
      withTiming(4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true  // reverse: 0 → 4 → 0 → -4 → 0, continuo senza scatti
    );
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    height: fillProgress.value * BOTTLE_BODY_H +
      (fillProgress.value > 0.03 && fillProgress.value < 0.97 ? waveRipple.value : 0),
    backgroundColor: interpolateColor(
      fillProgress.value,
      [0, 0.5, 1],
      ['#3b82f6', '#38bdf8', '#22c55e']
    ),
    borderBottomLeftRadius: 18 - fillProgress.value * 4,
    borderBottomRightRadius: 18 - fillProgress.value * 4,
    borderTopLeftRadius: fillProgress.value > 0.88 ? 16 : 0,
    borderTopRightRadius: fillProgress.value > 0.88 ? 16 : 0,
  }));

  return (
    <View style={bottleStyles.bottleWrapper}>
      {/* Tappo */}
      <View style={bottleStyles.neck}>
        <View style={bottleStyles.neckInner} />
      </View>

      {/* Corpo */}
      <View style={[bottleStyles.body, { height: BOTTLE_BODY_H }]}>

        {/* Acqua con superficie che ondeggia */}
        <Animated.View
          style={[bottleStyles.fill, fillStyle]}
        />

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
    overflow: 'visible',
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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

// ─── Ricette Section ──────────────────────────────────────────────────────────

function RicetteSection() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    const data = await getRecipes().catch(() => []);
    setRecipes(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadRecipes(); }, [loadRecipes]));

  const handleDelete = (recipe: Recipe) => {
    Alert.alert('Elimina ricetta', `Vuoi eliminare "${recipe.title}"?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await deleteRecipe(recipe.id);
        await loadRecipes();
      }},
    ]);
  };

  if (loading) return <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={PRIMARY} /></View>;

  return (
    <View style={ricetteStyles.container}>
      <TouchableOpacity style={ricetteStyles.addBtn} onPress={() => setShowNewModal(true)} activeOpacity={0.85}>
        <Text style={ricetteStyles.addBtnText}>+ Crea ricetta</Text>
      </TouchableOpacity>

      {recipes.length === 0 ? (
        <View style={ricetteStyles.emptyBox}>
          <Text style={ricetteStyles.emptyEmoji}>🍳</Text>
          <Text style={ricetteStyles.emptyTitle}>Nessuna ricetta</Text>
          <Text style={ricetteStyles.emptyText}>Crea le tue ricette manualmente o importale da PDF.</Text>
        </View>
      ) : (
        <View style={ricetteStyles.list}>
          {recipes.map((recipe) => {
            const isExpanded = expandedId === recipe.id;
            const ingredients = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
            return (
              <View key={recipe.id} style={ricetteStyles.card}>
                <TouchableOpacity
                  style={ricetteStyles.cardHeader}
                  onPress={() => setExpandedId(isExpanded ? null : recipe.id)}
                  activeOpacity={0.8}
                >
                  <View style={ricetteStyles.cardHeaderLeft}>
                    <Text style={ricetteStyles.cardTitle}>{recipe.title}</Text>
                    <Text style={ricetteStyles.cardMacros}>
                      {Math.round(recipe.kcal ?? 0)} kcal · P {Math.round(recipe.protein ?? 0)}g · C {Math.round(recipe.carbs ?? 0)}g · G {Math.round(recipe.fat ?? 0)}g
                    </Text>
                  </View>
                  <View style={ricetteStyles.cardHeaderRight}>
                    <TouchableOpacity onPress={() => handleDelete(recipe)} activeOpacity={0.8} style={ricetteStyles.deleteBtn}>
                      <Text style={ricetteStyles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={ricetteStyles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={ricetteStyles.cardBody}>
                    {recipe.description ? <Text style={ricetteStyles.description}>{recipe.description}</Text> : null}
                    {ingredients.length > 0 && (
                      <>
                        <Text style={ricetteStyles.sectionTitle}>🥗 Ingredienti ({recipe.servings} porzioni)</Text>
                        {ingredients.map((ing: any, i: number) => (
                          <Text key={i} style={ricetteStyles.ingredient}>• {ing.name} — {ing.grams}g</Text>
                        ))}
                      </>
                    )}
                    {recipe.instructions ? (
                      <>
                        <Text style={ricetteStyles.sectionTitle}>📝 Procedimento</Text>
                        <Text style={ricetteStyles.instructions}>{recipe.instructions}</Text>
                      </>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {showNewModal && (
        <NewRecipeModal
          visible={showNewModal}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); loadRecipes(); }}
        />
      )}
    </View>
  );
}

function NewRecipeModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('1');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<{ name: string; grams: string }[]>([{ name: '', grams: '' }]);
  const [saving, setSaving] = useState(false);

  const totalMacros = useMemo(() => {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }, [ingredients]);

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Titolo mancante', 'Inserisci il nome della ricetta.'); return; }
    try {
      setSaving(true);
      const parsedIngredients = ingredients
        .filter((i) => i.name.trim() && parseFloat(i.grams) > 0)
        .map((i) => ({ name: i.name.trim(), grams: parseFloat(i.grams) }));

      await addRecipe({
        title: title.trim(),
        description: description.trim() || null,
        servings: parseInt(servings) || 1,
        kcal: null,
        protein: null,
        carbs: null,
        fat: null,
        ingredients: parsedIngredients.length > 0 ? JSON.stringify(parsedIngredients) : null,
        instructions: instructions.trim() || null,
        source: 'manual',
      });
      onSaved();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare la ricetta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ricetteStyles.modalContainer}>
        <View style={ricetteStyles.modalHeader}>
          <Text style={ricetteStyles.modalTitle}>Nuova ricetta</Text>
          <TouchableOpacity onPress={onClose} style={ricetteStyles.modalCloseBtn} activeOpacity={0.8}>
            <Text style={ricetteStyles.modalCloseBtnText}>Annulla</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={ricetteStyles.inputGroup}>
            <Text style={ricetteStyles.inputLabel}>Nome ricetta *</Text>
            <TextInput style={ricetteStyles.input} value={title} onChangeText={setTitle} placeholder="Es. Pasta al pomodoro" placeholderTextColor={Colors.dark.textMuted} />
          </View>
          <View style={ricetteStyles.inputGroup}>
            <Text style={ricetteStyles.inputLabel}>Descrizione</Text>
            <TextInput style={[ricetteStyles.input, { height: 80 }]} value={description} onChangeText={setDescription} placeholder="Breve descrizione..." placeholderTextColor={Colors.dark.textMuted} multiline />
          </View>
          <View style={ricetteStyles.inputGroup}>
            <Text style={ricetteStyles.inputLabel}>Porzioni</Text>
            <TextInput style={ricetteStyles.input} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="1" placeholderTextColor={Colors.dark.textMuted} />
          </View>
          <View style={ricetteStyles.inputGroup}>
            <Text style={ricetteStyles.inputLabel}>Ingredienti</Text>
            {ingredients.map((ing, i) => (
              <View key={i} style={ricetteStyles.ingredientRow}>
                <TextInput style={[ricetteStyles.input, { flex: 2 }]} value={ing.name} onChangeText={(v) => { const n = [...ingredients]; n[i].name = v; setIngredients(n); }} placeholder="Alimento" placeholderTextColor={Colors.dark.textMuted} />
                <TextInput style={[ricetteStyles.input, { flex: 1 }]} value={ing.grams} onChangeText={(v) => { const n = [...ingredients]; n[i].grams = v; setIngredients(n); }} placeholder="g" keyboardType="decimal-pad" placeholderTextColor={Colors.dark.textMuted} />
                {ingredients.length > 1 && (
                  <TouchableOpacity onPress={() => setIngredients(ingredients.filter((_, j) => j !== i))} style={ricetteStyles.removeIngBtn}>
                    <Text style={{ color: Colors.dark.danger, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={() => setIngredients([...ingredients, { name: '', grams: '' }])} style={ricetteStyles.addIngBtn}>
              <Text style={ricetteStyles.addIngBtnText}>+ Aggiungi ingrediente</Text>
            </TouchableOpacity>
          </View>
          <View style={ricetteStyles.inputGroup}>
            <Text style={ricetteStyles.inputLabel}>Procedimento</Text>
            <TextInput style={[ricetteStyles.input, { height: 120 }]} value={instructions} onChangeText={setInstructions} placeholder="Descrivi i passaggi..." placeholderTextColor={Colors.dark.textMuted} multiline />
          </View>
          <TouchableOpacity style={[ricetteStyles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <Text style={ricetteStyles.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva ricetta'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const ricetteStyles = StyleSheet.create({
  container: { gap: 16 },
  addBtn: { backgroundColor: 'rgba(126,71,255,0.12)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: PRIMARY },
  addBtnText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text },
  emptyText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center' },
  list: { gap: 12 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.dark.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
  cardHeaderLeft: { flex: 1, gap: 4 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text },
  cardMacros: { fontSize: 12, color: Colors.dark.textMuted },
  deleteBtn: { width: 28, height: 28, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: Colors.dark.danger, fontSize: 13, fontWeight: '800' },
  chevron: { fontSize: 14, color: Colors.dark.textMuted },
  cardBody: { padding: 16, paddingTop: 0, gap: 10, borderTopWidth: 1, borderTopColor: Colors.dark.border },
  description: { fontSize: 14, color: Colors.dark.textMuted, lineHeight: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.dark.text, marginTop: 4 },
  ingredient: { fontSize: 13, color: Colors.dark.textMuted },
  instructions: { fontSize: 13, color: Colors.dark.textMuted, lineHeight: 20 },
  modalContainer: { flex: 1, backgroundColor: Colors.dark.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.dark.text },
  modalCloseBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.border },
  modalCloseBtnText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted },
  input: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.dark.text },
  ingredientRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  removeIngBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addIngBtn: { marginTop: 4, paddingVertical: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.surfaceSoft },
  addIngBtnText: { color: PRIMARY, fontSize: 13, fontWeight: '700' },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── Corpo Section ────────────────────────────────────────────────────────────

const WATER_QUICK_OPTIONS = [150, 250, 330, 500];

function CorpoSection() {
  const today = todayISO();

  // Peso
  const [weightLogs, setWeightLogs] = useState<BodyWeightLog[]>([]);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightDate, setWeightDate] = useState(today);
  const [weightValue, setWeightValue] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [weightPhase, setWeightPhase] = useState<'bulk' | 'cut' | null>(null);
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

  // Aggiorna solo l'acqua senza mostrare il loading globale
  const refreshWater = useCallback(async () => {
    try {
      const water = await getWaterLogByDate(today);
      setWaterTotal(water);
    } catch {}
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
      await upsertBodyWeightLog(weightDate, val, weightNotes.trim() || null, weightPhase);
      setWeightValue('');
      setWeightNotes('');
      setWeightPhase(null);
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
      await refreshWater(); // solo acqua, niente flash
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
        await refreshWater(); // solo acqua, niente flash
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
                setWeightDate(today);
                setWeightValue(todayWeight ? String(todayWeight.weight_kg) : '');
                setWeightNotes(todayWeight?.notes ?? '');
                setWeightPhase(todayWeight?.phase ?? null);
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
            {todayWeight.phase && (
              <View style={[corpoStyles.phaseBadge, todayWeight.phase === 'bulk' ? corpoStyles.phaseBadgeBulk : corpoStyles.phaseBadgeCut]}>
                <Text style={corpoStyles.phaseBadgeText}>
                  {todayWeight.phase === 'bulk' ? '💪 Bulk' : '🔥 Cut'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          !showWeightInput && (
            <Text style={corpoStyles.emptyText}>Nessuna registrazione per oggi.</Text>
          )
        )}

        {/* Input */}
        {showWeightInput && (
          <View style={corpoStyles.weightInputBox}>
            <Text style={corpoStyles.inputLabel}>Data pesata</Text>
            <View style={corpoStyles.datePicker}>
              <TouchableOpacity
                style={corpoStyles.dateArrow}
                onPress={() => setWeightDate(shiftDate(weightDate, -1))}
                activeOpacity={0.8}
              >
                <Text style={corpoStyles.dateArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={corpoStyles.datePickerLabel}>{formatDateDisplay(weightDate)}</Text>
              <TouchableOpacity
                style={[corpoStyles.dateArrow, weightDate >= today && corpoStyles.dateArrowDisabled]}
                onPress={() => weightDate < today && setWeightDate(shiftDate(weightDate, 1))}
                disabled={weightDate >= today}
                activeOpacity={0.8}
              >
                <Text style={[corpoStyles.dateArrowText, weightDate >= today && corpoStyles.dateArrowTextDisabled]}>›</Text>
              </TouchableOpacity>
            </View>
            <Text style={[corpoStyles.inputLabel, { marginTop: 10 }]}>Peso (kg)</Text>
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
            <Text style={[corpoStyles.inputLabel, { marginTop: 10 }]}>Fase (opzionale)</Text>
            <View style={corpoStyles.phaseSelector}>
              {([null, 'bulk', 'cut'] as const).map((p) => (
                <TouchableOpacity
                  key={String(p)}
                  style={[corpoStyles.phaseOption, weightPhase === p && corpoStyles.phaseOptionActive]}
                  onPress={() => setWeightPhase(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[corpoStyles.phaseOptionText, weightPhase === p && corpoStyles.phaseOptionTextActive]}>
                    {p === null ? 'Nessuna' : p === 'bulk' ? '💪 Bulk' : '🔥 Cut'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  datePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.dark.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border, paddingVertical: 4, paddingHorizontal: 4, marginBottom: 4 },
  datePickerLabel: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  dateArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dateArrowDisabled: { opacity: 0.3 },
  dateArrowText: { fontSize: 22, color: Colors.dark.text, fontWeight: '600', lineHeight: 26 },
  dateArrowTextDisabled: { color: Colors.dark.textMuted },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.dark.textMuted, marginBottom: 6 },
  weightInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: Colors.dark.text, fontSize: 22, fontWeight: '800' },
  phaseSelector: { flexDirection: 'row', gap: 8, marginTop: 4 },
  phaseOption: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.surfaceSoft, alignItems: 'center' },
  phaseOptionActive: { borderColor: '#7e47ff', backgroundColor: 'rgba(126,71,255,0.12)' },
  phaseOptionText: { fontSize: 13, fontWeight: '700', color: Colors.dark.textMuted },
  phaseOptionTextActive: { color: '#7e47ff' },
  phaseBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  phaseBadgeBulk: { backgroundColor: 'rgba(126,71,255,0.15)' },
  phaseBadgeCut: { backgroundColor: 'rgba(239,68,68,0.12)' },
  phaseBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.dark.text },
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
  const COMPLETED_KEY = '@vyro:piano_completed';

  // Carica completedEntries da AsyncStorage al mount
  React.useEffect(() => {
    AsyncStorage.getItem(COMPLETED_KEY).then((val) => {
      if (val) {
        try {
          const arr = JSON.parse(val) as number[];
          setCompletedEntries(new Set(arr));
        } catch {}
      }
    });
  }, []);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);
  const [importStep, setImportStep] = useState<'idle' | 'loading' | 'preview' | 'error'>('idle');
  const [importError, setImportError] = useState('');
  const [importedPlan, setImportedPlan] = useState<ImportedPlan | null>(null);
  const [showAddEntryModal, setShowAddEntryModal] = useState<{ dayId: number; mealType: string } | null>(null);
  const [showDayAssignModal, setShowDayAssignModal] = useState<{ planId: number } | null>(null);

  const handlePickAndImportPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      if (!result.assets || result.assets.length === 0) {
        Alert.alert('Errore', 'Nessun file selezionato.');
        return;
      }
      // Reset stato solo dopo selezione riuscita
      setImportError('');
      setImportStep('loading');
      await processFile(result.assets[0]);
    } catch (e: any) {
      setImportError(e?.message ?? `Errore nella selezione del file.`);
      setImportStep('error');
    }
  };

  const processFile = async (file: { uri: string; name: string; mimeType?: string; size?: number }) => {
    try {

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });

      if (!base64 || base64.length === 0) {
        throw new Error('File vuoto o non leggibile.');
      }

      // Base64 letto correttamente, ora chiamata API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: CLAUDE_PROMPT },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error ${response.status}: ${errBody.substring(0, 200)}`);
      }

      const data = await response.json();
      const rawText = data.content?.find((b: any) => b.type === 'text')?.text ?? '';

      if (!rawText) {
        throw new Error(`Nessuna risposta dall'AI. Riprova.`);
      }

      Alert.alert('RAW', rawText.substring(0, 400));

      // Estrae il JSON anche se è dentro backtick o ha testo prima/dopo
      let jsonStr = rawText;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        jsonStr = rawText.replace(/```json|```/g, '').trim();
      }

      const parsed: ImportedPlan = JSON.parse(jsonStr);
      setImportedPlan(JSON.parse(JSON.stringify(parsed)));
      setImportStep('preview');
    } catch (e: any) {
      const msg = e?.message ?? `Errore durante l'elaborazione del PDF.`;
      setImportError(msg);
      setImportStep('error');
    }
  };

  const handleConfirmImport = async () => {
    if (!importedPlan) return;
    try {
      const planId = await addMealPlan(importedPlan.name, importedPlan.plan_type);
      for (let di = 0; di < importedPlan.days.length; di++) {
        const day = importedPlan.days[di];
        const dayId = await addMealPlanDay(planId, di + 1, day.label);
        for (const meal of day.meals) {
          for (const entry of meal.entries) {
            await addMealPlanEntry({
              meal_plan_day_id: dayId,
              meal_type: meal.meal_type,
              food_item_id: null,
              food_name: entry.food_name,
              grams: entry.grams ?? 0,
              kcal: entry.kcal ?? null,
              protein: entry.protein ?? null,
              carbs: entry.carbs ?? null,
              fat: entry.fat ?? null,
            });
          }
        }
      }
      setImportStep('idle');
      setImportedPlan(null);
      await loadPlans();
      // Apri modal per assegnare i giorni della settimana
      setShowDayAssignModal({ planId });
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? `Impossibile salvare il piano.`);
    }
  };

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
      // Persisti in AsyncStorage
      AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify([...next])).catch(() => {});
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
            <Text style={pianoStyles.createBtnText}>Crea piano</Text>
          </TouchableOpacity>
          <Text style={pianoStyles.importPDFHint}>
            Hai già un piano del nutrizionista in PDF? Caricalo e Claude lo importerà automaticamente.
          </Text>
          <TouchableOpacity style={pianoStyles.importPDFBtn} onPress={handlePickAndImportPDF} activeOpacity={0.85}>
            <Text style={pianoStyles.importPDFBtnText}>📄 Seleziona PDF</Text>
          </TouchableOpacity>
        </View>
        <NewPlanModal visible={showNewPlanModal} onClose={() => setShowNewPlanModal(false)} onSaved={() => { loadPlans(); setShowNewPlanModal(false); }} />
        <Modal visible={importStep === 'preview' || importStep === 'loading' || importStep === 'error'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setImportStep('idle')}>
          <View style={importStyles.container}>
            <View style={importStyles.handle} />
            <View style={importStyles.header}>
              <Text style={importStyles.title}>Importa da PDF</Text>
              <TouchableOpacity onPress={() => setImportStep('idle')} style={importStyles.closeBtn} activeOpacity={0.8}>
                <Text style={importStyles.closeBtnText}>Chiudi</Text>
              </TouchableOpacity>
            </View>
            {importStep === 'loading' && (
              <View style={importStyles.centered}>
                <ActivityIndicator size="large" color={PRIMARY} />
                <Text style={importStyles.loadingText}>Analisi del documento in corso...</Text>
                <Text style={importStyles.loadingSubtext}>Potrebbe richiedere qualche secondo</Text>
              </View>
            )}
            {importStep === 'error' && (
              <View style={importStyles.centered}>
                <Text style={importStyles.errorEmoji}>⚠️</Text>
                <Text style={importStyles.errorTitle}>Impossibile leggere il piano</Text>
                <Text style={importStyles.errorDesc}>{importError}</Text>
                <TouchableOpacity style={importStyles.pickBtn} onPress={() => { setImportStep('idle'); setTimeout(handlePickAndImportPDF, 300); }} activeOpacity={0.85}>
                  <Text style={importStyles.pickBtnText}>Riprova</Text>
                </TouchableOpacity>
              </View>
            )}
            {importStep === 'preview' && importedPlan && (
              <ScrollView contentContainerStyle={importStyles.previewContent} keyboardShouldPersistTaps="handled">
                <View style={importStyles.previewHeader}>
                  <Text style={importStyles.previewTitle}>{importedPlan.name}</Text>
                  <Text style={importStyles.previewMeta}>{importedPlan.plan_type === 'weekly' ? '📅 Settimanale' : '🔄 Ciclo libero'} · {importedPlan.days.length} giorni</Text>
                </View>
                <Text style={importStyles.previewHint}>Controlla i dati estratti e modifica se necessario.</Text>
                {importedPlan.days.map((day, dayIdx) => (
                  <View key={dayIdx} style={importStyles.dayCard}>
                    <Text style={importStyles.dayLabel}>{day.label}</Text>
                    {day.meals.map((meal, mealIdx) => meal.entries.length > 0 ? (
                      <View key={mealIdx} style={importStyles.mealGroup}>
                        <Text style={importStyles.mealLabel}>{{ integrazione: 'Integrazione', colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntini' }[meal.meal_type] ?? meal.meal_type}</Text>
                        {meal.entries.map((entry, entryIdx) => (
                          <View key={entryIdx} style={importStyles.entryRow}>
                            <View style={importStyles.entryMain}>
                              <TextInput value={entry.food_name} onChangeText={(v) => { const p = JSON.parse(JSON.stringify(importedPlan)); p.days[dayIdx].meals[mealIdx].entries[entryIdx].food_name = v; setImportedPlan(p); }} style={importStyles.entryNameInput} />
                              <View style={importStyles.entryMacroRow}>
                                {(['grams','kcal','protein','carbs','fat'] as const).map((f) => (
                                  <View key={f} style={importStyles.macroField}>
                                    <Text style={importStyles.macroFieldLabel}>{f==='grams'?'g':f==='kcal'?'kcal':f==='protein'?'Prot':f==='carbs'?'Carb':'Gras'}</Text>
                                    <TextInput value={entry[f] !== null ? String(entry[f]) : ''} onChangeText={(v) => { const p = JSON.parse(JSON.stringify(importedPlan)); const n = parseFloat(v.replace(',','.')); p.days[dayIdx].meals[mealIdx].entries[entryIdx][f] = isNaN(n) ? null : n; setImportedPlan(p); }} keyboardType="decimal-pad" style={importStyles.macroInput} placeholder="—" placeholderTextColor={Colors.dark.textMuted} />
                                  </View>
                                ))}
                              </View>
                            </View>
                            <TouchableOpacity style={importStyles.removeEntryBtn} onPress={() => { const p = JSON.parse(JSON.stringify(importedPlan)); p.days[dayIdx].meals[mealIdx].entries.splice(entryIdx, 1); setImportedPlan(p); }} activeOpacity={0.8}>
                              <Text style={importStyles.removeEntryBtnText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : null)}
                  </View>
                ))}
                <TouchableOpacity style={importStyles.confirmBtn} onPress={handleConfirmImport} activeOpacity={0.85}>
                  <Text style={importStyles.confirmBtnText}>✓ Importa piano</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </Modal>
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
                      const isEmpty = mealEntries.length === 0;
                      return (
                        <View key={meal.key} style={pianoStyles.mealGroup}>
                          <View style={pianoStyles.mealGroupHeader}>
                            <Text style={[pianoStyles.mealGroupTitle, isEmpty && pianoStyles.mealGroupTitleEmpty]}>
                              {meal.emoji} {meal.label}
                            </Text>
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
                                    <TouchableOpacity style={pianoStyles.entryInfo} onPress={() => setEditingEntry(entry)} activeOpacity={0.7}>
                                      <Text style={[pianoStyles.entryName, done && pianoStyles.entryNameDone]}>{entry.food_name}</Text>
                                      <Text style={pianoStyles.entryMacros}>
                                        {entry.grams}g · {roundMacro(entry.kcal)} kcal · P {roundMacro(entry.protein)}g · C {roundMacro(entry.carbs)}g · G {roundMacro(entry.fat)}g
                                      </Text>
                                    </TouchableOpacity>
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
      <Text style={pianoStyles.importPDFHint}>
        Hai già un piano del nutrizionista in PDF? Caricalo e Claude lo importerà automaticamente.
      </Text>
      <TouchableOpacity style={pianoStyles.importPDFBtn} onPress={handlePickAndImportPDF} activeOpacity={0.85}>
        <Text style={pianoStyles.importPDFBtnText}>📄 Seleziona PDF</Text>
      </TouchableOpacity>

      <NewPlanModal visible={showNewPlanModal} onClose={() => setShowNewPlanModal(false)} onSaved={() => { loadPlans(); setShowNewPlanModal(false); }} />

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={async () => {
            setEditingEntry(null);
            if (activePlanId) await loadPlanDetails(activePlanId);
          }}
        />
      )}

      <Modal visible={importStep === 'preview' || importStep === 'loading' || importStep === 'error'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setImportStep('idle')}>
        <View style={importStyles.container}>
          <View style={importStyles.handle} />
          <View style={importStyles.header}>
            <Text style={importStyles.title}>Importa da PDF</Text>
            <TouchableOpacity onPress={() => setImportStep('idle')} style={importStyles.closeBtn} activeOpacity={0.8}>
              <Text style={importStyles.closeBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
          {importStep === 'loading' && (
            <View style={importStyles.centered}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={importStyles.loadingText}>Analisi del documento in corso...</Text>
              <Text style={importStyles.loadingSubtext}>Potrebbe richiedere qualche secondo</Text>
            </View>
          )}
          {importStep === 'error' && (
            <View style={importStyles.centered}>
              <Text style={importStyles.errorEmoji}>⚠️</Text>
              <Text style={importStyles.errorTitle}>Impossibile leggere il piano</Text>
              <Text style={importStyles.errorDesc}>{importError}</Text>
              <TouchableOpacity style={importStyles.pickBtn} onPress={() => { setImportStep('idle'); setTimeout(handlePickAndImportPDF, 300); }} activeOpacity={0.85}>
                <Text style={importStyles.pickBtnText}>Riprova</Text>
              </TouchableOpacity>
            </View>
          )}
          {importStep === 'preview' && importedPlan && (
            <ScrollView contentContainerStyle={importStyles.previewContent} keyboardShouldPersistTaps="handled">
              <View style={importStyles.previewHeader}>
                <Text style={importStyles.previewTitle}>{importedPlan.name}</Text>
                <Text style={importStyles.previewMeta}>{importedPlan.plan_type === 'weekly' ? '📅 Settimanale' : '🔄 Ciclo libero'} · {importedPlan.days.length} giorni</Text>
              </View>
              <Text style={importStyles.previewHint}>Controlla i dati estratti e modifica se necessario.</Text>
              {importedPlan.days.map((day, dayIdx) => (
                <View key={dayIdx} style={importStyles.dayCard}>
                  <Text style={importStyles.dayLabel}>{day.label}</Text>
                  {day.meals.map((meal, mealIdx) => meal.entries.length > 0 ? (
                    <View key={mealIdx} style={importStyles.mealGroup}>
                      <Text style={importStyles.mealLabel}>{{ integrazione: 'Integrazione', colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntini' }[meal.meal_type] ?? meal.meal_type}</Text>
                      {meal.entries.map((entry, entryIdx) => (
                        <View key={entryIdx} style={importStyles.entryRow}>
                          <View style={importStyles.entryMain}>
                            <TextInput value={entry.food_name} onChangeText={(v) => { const p = JSON.parse(JSON.stringify(importedPlan)); p.days[dayIdx].meals[mealIdx].entries[entryIdx].food_name = v; setImportedPlan(p); }} style={importStyles.entryNameInput} />
                            <View style={importStyles.entryMacroRow}>
                              {(['grams','kcal','protein','carbs','fat'] as const).map((f) => (
                                <View key={f} style={importStyles.macroField}>
                                  <Text style={importStyles.macroFieldLabel}>{f==='grams'?'g':f==='kcal'?'kcal':f==='protein'?'Prot':f==='carbs'?'Carb':'Gras'}</Text>
                                  <TextInput value={entry[f] !== null ? String(entry[f]) : ''} onChangeText={(v) => { const p = JSON.parse(JSON.stringify(importedPlan)); const n = parseFloat(v.replace(',','.')); p.days[dayIdx].meals[mealIdx].entries[entryIdx][f] = isNaN(n) ? null : n; setImportedPlan(p); }} keyboardType="decimal-pad" style={importStyles.macroInput} placeholder="—" placeholderTextColor={Colors.dark.textMuted} />
                                </View>
                              ))}
                            </View>
                          </View>
                          <TouchableOpacity style={importStyles.removeEntryBtn} onPress={() => { const p = JSON.parse(JSON.stringify(importedPlan)); p.days[dayIdx].meals[mealIdx].entries.splice(entryIdx, 1); setImportedPlan(p); }} activeOpacity={0.8}>
                            <Text style={importStyles.removeEntryBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null)}
                </View>
              ))}
              <TouchableOpacity style={importStyles.confirmBtn} onPress={handleConfirmImport} activeOpacity={0.85}>
                <Text style={importStyles.confirmBtnText}>✓ Importa piano</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>

      {showAddEntryModal && (
        <AddEntryToPlanModal
          visible={!!showAddEntryModal}
          dayId={showAddEntryModal.dayId}
          mealType={showAddEntryModal.mealType}
          onClose={() => setShowAddEntryModal(null)}
          onAdded={async () => { if (activePlanId) await loadPlanDetails(activePlanId); }}
        />
      )}

      {showDayAssignModal && (
        <DayAssignModal
          visible={!!showDayAssignModal}
          planId={showDayAssignModal.planId}
          onClose={() => setShowDayAssignModal(null)}
          onSaved={() => setShowDayAssignModal(null)}
        />
      )}
    </>
  );
}

// ─── Day Assign Modal ─────────────────────────────────────────────────────────

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function DayAssignModal({ visible, planId, onClose, onSaved }: {
  visible: boolean;
  planId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [days, setDays] = useState<MealPlanDay[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    getMealPlanDays(planId).then((d) => {
      setDays(d);
      const init: Record<number, number[]> = {};
      d.forEach((day) => { init[day.id] = []; });
      setAssignments(init);
    });
  }, [visible, planId]);

  const toggleWeekday = (dayId: number, weekday: number) => {
    setAssignments((prev) => {
      const curr = prev[dayId] ?? [];
      const next = curr.includes(weekday)
        ? curr.filter((w) => w !== weekday)
        : [...curr, weekday];
      return { ...prev, [dayId]: next };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const assignList = Object.entries(assignments).map(([dayId, weekdays]) => ({
        dayId: parseInt(dayId),
        weekdays,
      }));
      await setMealPlanActiveDays(planId, assignList);
      onSaved();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare la configurazione.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={dayAssignStyles.container}>
        <View style={dayAssignStyles.header}>
          <Text style={dayAssignStyles.title}>Collega giorni al calendario</Text>
          <TouchableOpacity onPress={onClose} style={dayAssignStyles.skipBtn} activeOpacity={0.8}>
            <Text style={dayAssignStyles.skipBtnText}>Salta</Text>
          </TouchableOpacity>
        </View>
        <Text style={dayAssignStyles.subtitle}>
          Seleziona a quali giorni della settimana corrisponde ogni giorno del piano. Gli alimenti fleggati appariranno nel Diario come obiettivo giornaliero.
        </Text>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {days.map((day) => (
            <View key={day.id} style={dayAssignStyles.dayCard}>
              <Text style={dayAssignStyles.dayLabel}>{day.label}</Text>
              <View style={dayAssignStyles.weekdayList}>
                {WEEKDAYS.map((wd, i) => {
                  const selected = (assignments[day.id] ?? []).includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={dayAssignStyles.weekdayRow}
                      onPress={() => toggleWeekday(day.id, i)}
                      activeOpacity={0.8}
                    >
                      <View style={[dayAssignStyles.checkbox, selected && dayAssignStyles.checkboxChecked]}>
                        {selected && <Text style={dayAssignStyles.checkboxTick}>✓</Text>}
                      </View>
                      <Text style={[dayAssignStyles.weekdayLabel, selected && dayAssignStyles.weekdayLabelActive]}>
                        {wd}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[dayAssignStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={dayAssignStyles.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva configurazione'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const dayAssignStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  title: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.border },
  skipBtnText: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 13, color: Colors.dark.textMuted, padding: 20, paddingTop: 16, paddingBottom: 0, lineHeight: 18 },
  dayCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border, gap: 8 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: Colors.dark.text, marginBottom: 4 },
  weekdayList: { gap: 4 },
  weekdayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.dark.border, backgroundColor: Colors.dark.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '800' },
  weekdayLabel: { fontSize: 14, fontWeight: '600', color: Colors.dark.textMuted },
  weekdayLabelActive: { color: Colors.dark.text, fontWeight: '700' },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── New Plan Modal ───────────────────────────────────────────────────────────

// ─── Tipi per import PDF ──────────────────────────────────────────────────────

type ImportedEntry = {
  food_name: string;
  grams: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type ImportedMeal = {
  meal_type: 'integrazione' | 'colazione' | 'pranzo' | 'cena' | 'spuntino';
  entries: ImportedEntry[];
};

type ImportedDay = {
  label: string;
  meals: ImportedMeal[];
};

type ImportedPlan = {
  name: string;
  plan_type: 'weekly' | 'cycle';
  days: ImportedDay[];
};

// ─── Import PDF Modal ─────────────────────────────────────────────────────────

const CLAUDE_PROMPT = `Analizza questo piano alimentare e restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo, senza markdown, senza backtick.

Il JSON deve seguire esattamente questa struttura:
{
  "name": "Nome del piano (es. Piano settimanale)",
  "plan_type": "weekly" oppure "cycle",
  "days": [
    {
      "label": "Lunedì" oppure "Giorno 1" ecc.,
      "meals": [
        {
          "meal_type": "integrazione" oppure "colazione" oppure "pranzo" oppure "cena" oppure "spuntino",
          "entries": [
            {
              "food_name": "nome alimento",
              "grams": 100,
              "kcal": 250,
              "protein": 20,
              "carbs": 30,
              "fat": 10
            }
          ]
        }
      ]
    }
  ]
}

Se i valori nutrizionali non sono specificati, usa null. Estrai tutti i giorni e tutti i pasti presenti nel documento.`;

function ImportPDFModal({ visible, onClose, onImported, autoStart = false }: {
  visible: boolean;
  onClose: () => void;
  onImported: (plan: ImportedPlan) => void;
  autoStart?: boolean;
}) {
  const [step, setStep] = useState<'pick' | 'loading' | 'preview' | 'error'>('pick');
  const [errorMsg, setErrorMsg] = useState('');
  const [extractedPlan, setExtractedPlan] = useState<ImportedPlan | null>(null);
  const [editingPlan, setEditingPlan] = useState<ImportedPlan | null>(null);

  React.useEffect(() => {
    if (!visible) { setStep('pick'); setExtractedPlan(null); setEditingPlan(null); setErrorMsg(''); }
  }, [visible]);

  // Avvia il picker automaticamente dopo che la modal è completamente montata
  React.useEffect(() => {
    if (visible && autoStart && step === 'pick') {
      const t = setTimeout(() => handlePickPDF(), 600);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const handlePickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setStep('loading');
      const file = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              },
              { type: 'text', text: CLAUDE_PROMPT },
            ],
          }],
        }),
      });

      const data = await response.json();
      const rawText = data.content?.find((b: any) => b.type === 'text')?.text ?? '';

      // Pulisce eventuali backtick residui
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsed: ImportedPlan = JSON.parse(cleaned);

      setExtractedPlan(parsed);
      setEditingPlan(JSON.parse(JSON.stringify(parsed))); // deep copy per editing
      setStep('preview');
    } catch (e: any) {
      setErrorMsg(e?.message ?? `Errore durante l'elaborazione del PDF.`);
      setStep('error');
    }
  };

  const handleConfirm = () => {
    if (!editingPlan) return;
    onImported(editingPlan);
    onClose();
  };

  const updateEntryField = (
    dayIdx: number, mealIdx: number, entryIdx: number,
    field: keyof ImportedEntry, value: string
  ) => {
    if (!editingPlan) return;
    const plan = JSON.parse(JSON.stringify(editingPlan));
    const entry = plan.days[dayIdx].meals[mealIdx].entries[entryIdx];
    if (field === 'food_name') {
      entry.food_name = value;
    } else {
      const n = parseFloat(value.replace(',', '.'));
      (entry as any)[field] = isNaN(n) ? null : n;
    }
    setEditingPlan(plan);
  };

  const removeEntry = (dayIdx: number, mealIdx: number, entryIdx: number) => {
    if (!editingPlan) return;
    const plan = JSON.parse(JSON.stringify(editingPlan));
    plan.days[dayIdx].meals[mealIdx].entries.splice(entryIdx, 1);
    setEditingPlan(plan);
  };

  const mealLabel = (t: string) => ({ integrazione: 'Integrazione', colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntini' }[t] ?? t);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={importStyles.container}>
        <View style={importStyles.handle} />
        <View style={importStyles.header}>
          <Text style={importStyles.title}>Importa da PDF</Text>
          <TouchableOpacity onPress={onClose} style={importStyles.closeBtn} activeOpacity={0.8}>
            <Text style={importStyles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        {step === 'pick' && (
          <View style={importStyles.centered}>
            <Text style={importStyles.pickEmoji}>📄</Text>
            <Text style={importStyles.pickTitle}>Carica il tuo piano alimentare</Text>
            <Text style={importStyles.pickDesc}>
              Seleziona un PDF (es. piano del nutrizionista). Claude analizzerà il documento e compilerà automaticamente i giorni e i pasti.
            </Text>
            <TouchableOpacity style={importStyles.pickBtn} onPress={handlePickPDF} activeOpacity={0.85}>
              <Text style={importStyles.pickBtnText}>Seleziona PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'loading' && (
          <View style={importStyles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={importStyles.loadingText}>Analisi del documento in corso...</Text>
            <Text style={importStyles.loadingSubtext}>Potrebbe richiedere qualche secondo</Text>
          </View>
        )}

        {step === 'error' && (
          <View style={importStyles.centered}>
            <Text style={importStyles.errorEmoji}>⚠️</Text>
            <Text style={importStyles.errorTitle}>Impossibile leggere il piano</Text>
            <Text style={importStyles.errorDesc}>{errorMsg}</Text>
            <TouchableOpacity style={importStyles.pickBtn} onPress={() => setStep('pick')} activeOpacity={0.85}>
              <Text style={importStyles.pickBtnText}>Riprova</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'preview' && editingPlan && (
          <ScrollView contentContainerStyle={importStyles.previewContent} keyboardShouldPersistTaps="handled">
            <View style={importStyles.previewHeader}>
              <Text style={importStyles.previewTitle}>{editingPlan.name}</Text>
              <Text style={importStyles.previewMeta}>
                {editingPlan.plan_type === 'weekly' ? '📅 Settimanale' : '🔄 Ciclo libero'} · {editingPlan.days.length} giorni
              </Text>
            </View>

            <Text style={importStyles.previewHint}>
              Controlla i dati estratti e modifica se necessario prima di importare.
            </Text>

            {editingPlan.days.map((day, dayIdx) => (
              <View key={dayIdx} style={importStyles.dayCard}>
                <Text style={importStyles.dayLabel}>{day.label}</Text>
                {day.meals.map((meal, mealIdx) => (
                  meal.entries.length > 0 ? (
                    <View key={mealIdx} style={importStyles.mealGroup}>
                      <Text style={importStyles.mealLabel}>{mealLabel(meal.meal_type)}</Text>
                      {meal.entries.map((entry, entryIdx) => (
                        <View key={entryIdx} style={importStyles.entryRow}>
                          <View style={importStyles.entryMain}>
                            <TextInput
                              value={entry.food_name}
                              onChangeText={(v) => updateEntryField(dayIdx, mealIdx, entryIdx, 'food_name', v)}
                              style={importStyles.entryNameInput}
                              placeholderTextColor={Colors.dark.textMuted}
                            />
                            <View style={importStyles.entryMacroRow}>
                              {(['grams', 'kcal', 'protein', 'carbs', 'fat'] as const).map((field) => (
                                <View key={field} style={importStyles.macroField}>
                                  <Text style={importStyles.macroFieldLabel}>
                                    {field === 'grams' ? 'g' : field === 'kcal' ? 'kcal' : field === 'protein' ? 'Prot' : field === 'carbs' ? 'Carb' : 'Gras'}
                                  </Text>
                                  <TextInput
                                    value={entry[field] !== null ? String(entry[field]) : ''}
                                    onChangeText={(v) => updateEntryField(dayIdx, mealIdx, entryIdx, field, v)}
                                    keyboardType="decimal-pad"
                                    style={importStyles.macroInput}
                                    placeholderTextColor={Colors.dark.textMuted}
                                    placeholder="—"
                                  />
                                </View>
                              ))}
                            </View>
                          </View>
                          <TouchableOpacity
                            style={importStyles.removeEntryBtn}
                            onPress={() => removeEntry(dayIdx, mealIdx, entryIdx)}
                            activeOpacity={0.8}
                          >
                            <Text style={importStyles.removeEntryBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null
                ))}
              </View>
            ))}

            <TouchableOpacity style={importStyles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={importStyles.confirmBtnText}>✓ Importa piano</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const importStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  closeBtnText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  pickEmoji: { fontSize: 48 },
  pickTitle: { fontSize: 18, fontWeight: '800', color: Colors.dark.text, textAlign: 'center' },
  pickDesc: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 20 },
  pickBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  pickBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  loadingText: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, marginTop: 16 },
  loadingSubtext: { fontSize: 13, color: Colors.dark.textMuted },
  errorEmoji: { fontSize: 48 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: Colors.dark.danger, textAlign: 'center' },
  errorDesc: { fontSize: 13, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 18 },
  previewContent: { padding: 20, paddingBottom: 40 },
  previewHeader: { marginBottom: 8, gap: 4 },
  previewTitle: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  previewMeta: { fontSize: 13, color: Colors.dark.textMuted, fontWeight: '600' },
  previewHint: { fontSize: 13, color: Colors.dark.textMuted, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 10, padding: 12, marginBottom: 16, lineHeight: 18 },
  dayCard: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 12 },
  dayLabel: { fontSize: 16, fontWeight: '800', color: Colors.dark.text, marginBottom: 10 },
  mealGroup: { marginBottom: 10 },
  mealLabel: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginBottom: 6, letterSpacing: 0.3 },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#101015', borderRadius: 10, padding: 10, marginBottom: 6 },
  entryMain: { flex: 1, gap: 6 },
  entryNameInput: { fontSize: 14, fontWeight: '700', color: Colors.dark.text, borderBottomWidth: 1, borderBottomColor: Colors.dark.border, paddingBottom: 4 },
  entryMacroRow: { flexDirection: 'row', gap: 6 },
  macroField: { flex: 1, alignItems: 'center', gap: 2 },
  macroFieldLabel: { fontSize: 9, color: Colors.dark.textMuted, fontWeight: '700' },
  macroInput: { width: '100%', fontSize: 12, color: Colors.dark.text, textAlign: 'center', backgroundColor: Colors.dark.surface, borderRadius: 6, paddingVertical: 4 },
  removeEntryBtn: { width: 26, height: 26, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 7, borderWidth: 1, borderColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  removeEntryBtnText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '800' },
  confirmBtn: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── Edit Entry Modal ─────────────────────────────────────────────────────────

function EditEntryModal({ entry, onClose, onSaved }: {
  entry: MealPlanEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [foodName, setFoodName] = useState(entry.food_name);
  const [grams, setGrams] = useState(entry.grams !== null ? String(entry.grams) : '');
  const [kcal, setKcal] = useState(entry.kcal !== null ? String(entry.kcal) : '');
  const [protein, setProtein] = useState(entry.protein !== null ? String(entry.protein) : '');
  const [carbs, setCarbs] = useState(entry.carbs !== null ? String(entry.carbs) : '');
  const [fat, setFat] = useState(entry.fat !== null ? String(entry.fat) : '');
  const [saving, setSaving] = useState(false);

  const parseField = (v: string): number | null => {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const handleSave = async () => {
    const g = parseField(grams);
    if (!g || g <= 0) {
      Alert.alert('Grammi mancanti', 'Inserisci la quantità in grammi.');
      return;
    }
    try {
      setSaving(true);
      await updateMealPlanEntry(entry.id, g, parseField(kcal), parseField(protein), parseField(carbs), parseField(fat));
      onSaved();
    } catch {
      Alert.alert('Errore', `Impossibile salvare le modifiche.`);
    } finally {
      setSaving(false);
    }
  };

  const fields: { label: string; value: string; onChange: (v: string) => void; placeholder: string }[] = [
    { label: 'Grammi *', value: grams, onChange: setGrams, placeholder: 'Es. 100' },
    { label: 'Calorie (kcal)', value: kcal, onChange: setKcal, placeholder: 'Es. 250' },
    { label: 'Proteine (g)', value: protein, onChange: setProtein, placeholder: 'Es. 20' },
    { label: 'Carboidrati (g)', value: carbs, onChange: setCarbs, placeholder: 'Es. 30' },
    { label: 'Grassi (g)', value: fat, onChange: setFat, placeholder: 'Es. 10' },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <ScrollView style={editEntryStyles.container} contentContainerStyle={editEntryStyles.content} keyboardShouldPersistTaps="handled">
        <View style={editEntryStyles.handle} />
        <View style={editEntryStyles.header}>
          <Text style={editEntryStyles.title} numberOfLines={1}>{entry.food_name}</Text>
          <TouchableOpacity onPress={onClose} style={editEntryStyles.closeBtn} activeOpacity={0.8}>
            <Text style={editEntryStyles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        <Text style={editEntryStyles.fieldLabel}>Nome alimento</Text>
        <TextInput
          value={foodName}
          onChangeText={setFoodName}
          style={editEntryStyles.input}
          placeholderTextColor={Colors.dark.textMuted}
        />

        {fields.map((f) => (
          <View key={f.label} style={{ marginBottom: 12 }}>
            <Text style={editEntryStyles.fieldLabel}>{f.label}</Text>
            <TextInput
              value={f.value}
              onChangeText={f.onChange}
              placeholder={f.placeholder}
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="decimal-pad"
              style={editEntryStyles.input}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[editEntryStyles.saveBtn, saving && editEntryStyles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={editEntryStyles.saveBtnText}>{saving ? `Salvataggio...` : `Salva modifiche`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const editEntryStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 60 },
  handle: { width: 40, height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.dark.text, flex: 1, marginRight: 12 },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.dark.surfaceSoft, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  closeBtnText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted, marginBottom: 8 },
  input: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: Colors.dark.text, fontSize: 15, marginBottom: 4 },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

function NewPlanModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState<PlanType>('weekly');
  const [sameEveryDay, setSameEveryDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  React.useEffect(() => { if (!visible) { setName(''); setPlanType('weekly'); setSameEveryDay(false); } }, [visible]);

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

  const handleImported = async (plan: ImportedPlan) => {
    try {
      setSaving(true);
      const planId = await addMealPlan(plan.name, plan.plan_type);
      for (let di = 0; di < plan.days.length; di++) {
        const day = plan.days[di];
        const dayId = await addMealPlanDay(planId, di + 1, day.label);
        for (const meal of day.meals) {
          for (const entry of meal.entries) {
            await addMealPlanEntry({
              meal_plan_day_id: dayId,
              meal_type: meal.meal_type,
              food_item_id: null,
              food_name: entry.food_name,
              grams: entry.grams ?? 0,
              kcal: entry.kcal ?? null,
              protein: entry.protein ?? null,
              carbs: entry.carbs ?? null,
              fat: entry.fat ?? null,
            });
          }
        }
      }
      onSaved();
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Impossibile salvare il piano importato.');
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

        {planType === 'weekly' && (
          <TouchableOpacity
            style={newPlanStyles.sameEveryDayRow}
            onPress={() => setSameEveryDay(!sameEveryDay)}
            activeOpacity={0.8}
          >
            <View style={[newPlanStyles.toggle, sameEveryDay && newPlanStyles.toggleActive]}>
              {sameEveryDay && <View style={newPlanStyles.toggleThumb} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={newPlanStyles.sameEveryDayLabel}>Piano uguale ogni giorno</Text>
              <Text style={newPlanStyles.sameEveryDayDesc}>Crea automaticamente tutti e 7 i giorni della settimana</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[newPlanStyles.saveBtn, saving && newPlanStyles.saveBtnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={newPlanStyles.saveBtnText}>{saving ? 'Creazione...' : 'Crea piano'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </Modal>
  );
}

const newPlanStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 120 },
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
  sameEveryDayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 16 },
  sameEveryDayLabel: { fontSize: 14, fontWeight: '700', color: Colors.dark.text },
  sameEveryDayDesc: { fontSize: 12, color: Colors.dark.textMuted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.dark.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleActive: { backgroundColor: PRIMARY },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-end' },
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
  mealGroupTitleEmpty: { color: Colors.dark.textMuted, textDecorationLine: 'line-through' },
  addEntryBtn: { backgroundColor: 'rgba(126,71,255,0.14)', borderRadius: 8, borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 4 },
  addEntryBtnText: { color: Colors.dark.primarySoft, fontSize: 12, fontWeight: '700' },
  emptyMealText: { fontSize: 12, color: Colors.dark.textMuted, fontStyle: 'italic' },
  entryList: { gap: 6 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101015', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.dark.border },
  entryRowDone: { borderColor: Colors.dark.success, backgroundColor: 'rgba(34,197,94,0.06)' },
  entryCheckbox: { padding: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: Colors.dark.success, borderColor: Colors.dark.success },
  checkboxTick: { color: '#fff', fontSize: 12, fontWeight: '800' },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 13, fontWeight: '700', color: Colors.dark.text, marginBottom: 2 },
  entryNameDone: { color: Colors.dark.success },
  entryMacros: { fontSize: 11, color: Colors.dark.textMuted },
  deleteEntryBtn: { width: 26, height: 26, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 7, borderWidth: 1, borderColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center' },
  deleteEntryBtnText: { color: Colors.dark.danger, fontSize: 12, fontWeight: '800' },
  addDayBtn: { marginTop: 12, backgroundColor: Colors.dark.surface, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center' },
  addDayBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
  newPlanSeparator: { marginTop: 24, marginBottom: 12, height: 1, backgroundColor: Colors.dark.border },
  newPlanBottomBtn: { backgroundColor: Colors.dark.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.border, paddingVertical: 14, alignItems: 'center' },
  newPlanBottomBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
  importPDFHint: { fontSize: 13, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 16, paddingHorizontal: 8 },
  importPDFBtn: { marginTop: 10, backgroundColor: 'rgba(126,71,255,0.08)', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(126,71,255,0.35)', borderStyle: 'dashed', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  importPDFBtnText: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
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
          {section === 'ricette' && (
            <RicetteSection />
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