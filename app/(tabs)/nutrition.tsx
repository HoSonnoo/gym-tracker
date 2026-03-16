import { Colors } from '@/constants/Colors';
import {
    addFoodItem,
    addNutritionLog,
    deleteNutritionLog,
    getFoodItems,
    getNutritionLogsByDate,
    type FoodItem,
    type NutritionLog,
} from '@/database';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
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


// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#7e47ff';

const MEAL_TYPES = [
  { key: 'colazione', label: 'Colazione', emoji: '☀️' },
  { key: 'pranzo',    label: 'Pranzo',    emoji: '🍽️' },
  { key: 'cena',      label: 'Cena',      emoji: '🌙' },
  { key: 'spuntino',  label: 'Spuntini',  emoji: '🍎' },
] as const;

type MealType = typeof MEAL_TYPES[number]['key'];
type SectionKey = 'diario' | 'catalogo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateDisplay(iso: string): string {
  const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const d = new Date(iso + 'T00:00:00');
  const oggi = new Date();
  const ieri = new Date(); ieri.setDate(ieri.getDate() - 1);
  if (iso === todayISO()) return 'Oggi';
  if (iso === ieri.toISOString().split('T')[0]) return 'Ieri';
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0];
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
    fontSize: 14,
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