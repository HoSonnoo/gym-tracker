import {
  getFoodItems, addFoodItem, deleteFoodItem,
  getNutritionLogsByDate, addNutritionLog, deleteNutritionLog,
  getWaterLogByDate, addWaterLog, resetWaterLog,
} from '@/repository/nutrition';
import {
  getMealPlans, addMealPlan, deleteMealPlan,
  addMealPlanDay, addMealPlanEntry,
} from '@/repository/mealplans';
import { getBodyWeightLogs, upsertBodyWeightLog, deleteBodyWeightLog } from '@/repository/health';
import { getRecipes, addRecipe, deleteRecipe } from '@/repository/recipes';
import type { FoodItem, NutritionLog, Recipe } from '@/types';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://xttmvtgkoshsfyqmizja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dG12dGdrb3Noc2Z5cW1pemphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDk5MjUsImV4cCI6MjA4OTQ4NTkyNX0.3ooDzd5rLe8GeJ1sLWkpKSjp_D5TAey_acThZN_2WiU';
const PROXY_URL = `${SUPABASE_URL}/functions/v1/anthropic-proxy`;

const MEAL_TYPES = ['Integrazione', 'Colazione', 'Pranzo', 'Cena', 'Spuntino'];

const PLAN_PROMPT = `Analizza questo piano alimentare e restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo, senza markdown, senza backtick.
Il JSON deve seguire esattamente questa struttura:
{"name":"Nome del piano","plan_type":"weekly","days":[{"label":"Lunedì","meals":[{"meal_type":"colazione","entries":[{"food_name":"nome","grams":100,"kcal":250,"protein":20,"carbs":30,"fat":10}]}]}]}
Se i valori nutrizionali non sono specificati, usa null. Estrai tutti i giorni e tutti i pasti presenti nel documento.`;

const RECIPE_PROMPT = `Analizza questo documento e restituisci SOLO un array JSON valido di ricette, senza testo aggiuntivo, senza markdown, senza backtick.
Il JSON deve seguire esattamente questa struttura:
[{"title":"Nome ricetta","description":"descrizione breve","servings":2,"kcal":400,"protein":30,"carbs":40,"fat":15,"ingredients":"[{\"name\":\"...\",\"grams\":100}]","instructions":"passaggi..."}]
Se i valori nutrizionali non sono specificati, usa null.`;

type ImportedEntry = { food_name: string; grams: number; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };
type ImportedMeal  = { meal_type: string; entries: ImportedEntry[] };
type ImportedDay   = { label: string; meals: ImportedMeal[] };
type ImportedPlan  = { name: string; plan_type: 'weekly' | 'cycle'; days: ImportedDay[] };

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Tab helper ───────────────────────────────────────────────────────────────

type TabDef = { id: string; label: string };
const TABS: TabDef[] = [
  { id: 'diario',   label: 'Diario'   },
  { id: 'piano',    label: 'Piano'    },
  { id: 'catalogo', label: 'Catalogo' },
  { id: 'corpo',    label: 'Corpo'    },
  { id: 'ricette',  label: 'Ricette'  },
];

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function renderNutrition(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  const today = new Date().toISOString().slice(0, 10);

  el.innerHTML = `
    <h1 class="text-2xl font-bold text-zinc-100 mb-5">Nutrizione</h1>

    <!-- Tab bar -->
    <div class="flex gap-1 mb-6 bg-[#222834] rounded-lg p-1 w-fit flex-wrap">
      ${TABS.map((t, i) => `
        <button id="tab-${t.id}"
          class="tab-btn px-4 py-1.5 text-sm font-medium rounded-md transition-all
            ${i === 0 ? 'bg-[#2C3442] text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}">
          ${t.label}
        </button>
      `).join('')}
    </div>

    <!-- ── DIARIO ── -->
    <div id="section-diario">
      <div class="flex items-center justify-between mb-5">
        <span class="text-sm text-zinc-400">Giorno</span>
        <input id="date-picker" type="date" class="input w-auto" value="${today}" />
      </div>
      <div id="macro-summary" class="grid grid-cols-4 gap-3 mb-5"></div>
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">💧 Acqua</h2>
          <span id="water-total" class="text-brand-400 font-semibold text-sm">0 ml</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button class="add-water-btn btn-secondary text-xs" data-ml="250">+250 ml</button>
          <button class="add-water-btn btn-secondary text-xs" data-ml="500">+500 ml</button>
          <button class="add-water-btn btn-secondary text-xs" data-ml="750">+750 ml</button>
          <button id="reset-water-btn" class="btn-ghost text-xs text-red-400 ml-auto">Reset</button>
        </div>
      </div>
      <div id="logs-section" class="flex flex-col gap-3 mb-5">
        <div class="flex items-center justify-center h-32"><div class="spinner"></div></div>
      </div>
      <div class="card">
        <h2 class="section-title">Aggiungi alimento</h2>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="label">Pasto</label>
            <select id="log-meal-type" class="input">
              ${MEAL_TYPES.map(m => `<option value="${m.toLowerCase()}">${m}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label">Alimento</label>
            <select id="log-food-select" class="input">
              <option value="">— seleziona —</option>
            </select>
          </div>
          <div>
            <label class="label">Grammi</label>
            <input id="log-grams" type="number" min="1" class="input" placeholder="100" />
          </div>
        </div>
        <p id="log-error" class="text-red-400 text-sm hidden mb-2"></p>
        <button id="add-log-btn" class="btn-primary">Aggiungi</button>
      </div>
    </div>

    <!-- ── PIANO ── -->
    <div id="section-piano" class="hidden">
      <div class="card mb-4">
        <h2 class="section-title">Nuovo piano</h2>
        <div class="flex gap-2 mb-4">
          <input id="plan-name" type="text" class="input flex-1" placeholder="Nome piano…" />
          <select id="plan-type" class="input w-36">
            <option value="weekly">Settimanale</option>
            <option value="cycle">Ciclico</option>
          </select>
          <button id="add-plan-btn" class="btn-primary shrink-0">Crea</button>
        </div>
        <div class="pt-4 border-t border-[#2C3442]">
          <p class="text-sm text-zinc-200 mb-1">📄 Hai un piano del nutrizionista in PDF?</p>
          <p class="text-xs text-zinc-500 mb-3">Caricalo e Vyro lo importerà automaticamente con l'AI.</p>
          <label class="btn-secondary text-sm cursor-pointer border border-dashed border-brand-500/40 text-brand-400 hover:bg-brand-500/10">
            Seleziona PDF
            <input id="import-plan-file" type="file" accept="application/pdf,.pdf" class="hidden" />
          </label>
          <p id="plans-msg" class="text-sm mt-3 hidden"></p>
        </div>
      </div>
      <div id="plans-list">
        <div class="flex items-center justify-center h-24"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- ── CATALOGO ── -->
    <div id="section-catalogo" class="hidden">
      <div class="card mb-4">
        <h2 class="section-title">Aggiungi alimento</h2>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="label">Nome</label>
            <input id="food-name" type="text" class="input" placeholder="Es. Petto di pollo" />
          </div>
          <div>
            <label class="label">Kcal / 100g</label>
            <input id="food-kcal" type="number" class="input" placeholder="165" />
          </div>
          <div>
            <label class="label">Proteine (g)</label>
            <input id="food-protein" type="number" class="input" placeholder="31" />
          </div>
          <div>
            <label class="label">Carboidrati (g)</label>
            <input id="food-carbs" type="number" class="input" placeholder="0" />
          </div>
          <div>
            <label class="label">Grassi (g)</label>
            <input id="food-fat" type="number" class="input" placeholder="3.6" />
          </div>
        </div>
        <p id="food-error" class="text-red-400 text-sm hidden mt-2"></p>
        <button id="add-food-btn" class="btn-primary mt-3">Aggiungi al catalogo</button>
      </div>
      <div id="food-list">
        <div class="flex items-center justify-center h-24"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- ── CORPO ── -->
    <div id="section-corpo" class="hidden">
      <div class="card mb-4">
        <h2 class="section-title">Registra peso</h2>
        <div class="flex gap-2 flex-wrap mb-2">
          <input id="weight-date" type="date" class="input w-36" value="${today}" />
          <input id="weight-value" type="number" step="0.1" class="input w-24" placeholder="kg" />
          <select id="weight-phase" class="input w-28">
            <option value="">— fase —</option>
            <option value="bulk">Bulk</option>
            <option value="cut">Cut</option>
          </select>
          <input id="weight-notes" type="text" class="input flex-1 min-w-[120px]" placeholder="Note (opzionale)" />
          <button id="save-weight-btn" class="btn-primary shrink-0">Salva</button>
        </div>
      </div>
      <div id="weight-list">
        <div class="flex items-center justify-center h-24"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- ── RICETTE ── -->
    <div id="section-ricette" class="hidden">
      <div class="card mb-4">
        <h2 class="section-title">Nuova ricetta</h2>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div class="col-span-2">
            <label class="label">Titolo</label>
            <input id="recipe-title" type="text" class="input" placeholder="Es. Pasta al tonno" />
          </div>
          <div class="col-span-2">
            <label class="label">Descrizione</label>
            <input id="recipe-desc" type="text" class="input" placeholder="Breve descrizione…" />
          </div>
          <div>
            <label class="label">Porzioni</label>
            <input id="recipe-servings" type="number" min="1" class="input" placeholder="2" />
          </div>
          <div>
            <label class="label">Kcal</label>
            <input id="recipe-kcal" type="number" class="input" placeholder="400" />
          </div>
          <div>
            <label class="label">Proteine (g)</label>
            <input id="recipe-protein" type="number" class="input" placeholder="30" />
          </div>
          <div>
            <label class="label">Carboidrati (g)</label>
            <input id="recipe-carbs" type="number" class="input" placeholder="40" />
          </div>
          <div>
            <label class="label">Grassi (g)</label>
            <input id="recipe-fat" type="number" class="input" placeholder="15" />
          </div>
          <div class="col-span-2">
            <label class="label">Ingredienti</label>
            <textarea id="recipe-ingredients" class="input h-20 resize-none" placeholder="Un ingrediente per riga…"></textarea>
          </div>
          <div class="col-span-2">
            <label class="label">Istruzioni</label>
            <textarea id="recipe-instructions" class="input h-24 resize-none" placeholder="Passaggi di preparazione…"></textarea>
          </div>
        </div>
        <p id="recipe-error" class="text-red-400 text-sm hidden mb-2"></p>
        <button id="add-recipe-btn" class="btn-primary">Aggiungi ricetta</button>
        <div class="mt-4 pt-4 border-t border-[#2C3442]">
          <p class="text-sm text-zinc-200 mb-1">📄 Hai ricette in PDF?</p>
          <p class="text-xs text-zinc-500 mb-3">Importale automaticamente con l'AI.</p>
          <label class="btn-secondary text-sm cursor-pointer border border-dashed border-brand-500/40 text-brand-400 hover:bg-brand-500/10">
            Importa da PDF
            <input id="import-recipe-file" type="file" accept="application/pdf,.pdf" class="hidden" />
          </label>
          <p id="recipe-import-msg" class="text-sm mt-3 hidden"></p>
        </div>
      </div>
      <div id="recipes-list">
        <div class="flex items-center justify-center h-24"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  // ─── Stato ──────────────────────────────────────────────────────────────────
  let currentDate = today;
  let foodItems: FoodItem[] = [];

  // ─── Tab switching ──────────────────────────────────────────────────────────
  const activeClass   = 'px-4 py-1.5 text-sm font-medium rounded-md bg-[#2C3442] text-zinc-100 transition-all';
  const inactiveClass = 'px-4 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-100 transition-all';

  function switchTab(id: string): void {
    TABS.forEach(t => {
      const btn = el.querySelector(`#tab-${t.id}`) as HTMLButtonElement;
      const sec = el.querySelector(`#section-${t.id}`) as HTMLElement;
      if (t.id === id) { btn.className = activeClass; sec.classList.remove('hidden'); }
      else             { btn.className = inactiveClass; sec.classList.add('hidden'); }
    });
  }

  el.querySelector('#tab-diario')  ?.addEventListener('click', () => { switchTab('diario');   refreshDiario(); });
  el.querySelector('#tab-piano')   ?.addEventListener('click', () => { switchTab('piano');    loadPlans(); });
  el.querySelector('#tab-catalogo')?.addEventListener('click', () => { switchTab('catalogo'); loadFoods(false); });
  el.querySelector('#tab-corpo')   ?.addEventListener('click', () => { switchTab('corpo');    loadWeights(); });
  el.querySelector('#tab-ricette') ?.addEventListener('click', () => { switchTab('ricette');  loadRecipes(); });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB DIARIO
  // ═══════════════════════════════════════════════════════════════════════════

  async function refreshDiario(): Promise<void> {
    await Promise.all([loadLogs(), loadWater(), updateMacroSummary()]);
  }

  async function loadLogs(): Promise<void> {
    const container = el.querySelector('#logs-section') as HTMLElement;
    try {
      const logs = await getNutritionLogsByDate(currentDate);
      const byMeal: Record<string, NutritionLog[]> = {};
      for (const m of MEAL_TYPES) byMeal[m.toLowerCase()] = [];
      for (const log of logs) {
        if (!byMeal[log.meal_type]) byMeal[log.meal_type] = [];
        byMeal[log.meal_type].push(log);
      }

      container.innerHTML = MEAL_TYPES.map(meal => {
        const key = meal.toLowerCase();
        const entries = byMeal[key] ?? [];
        const totalKcal = entries.reduce((s, e) => s + (e.kcal ?? 0), 0);
        return `
          <div class="card">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-zinc-200">${meal}</h3>
              <span class="text-xs text-zinc-500">${totalKcal} kcal</span>
            </div>
            ${entries.length === 0
              ? '<p class="text-zinc-600 text-xs">Nessun alimento registrato.</p>'
              : entries.map(log => `
                  <div class="flex items-center justify-between py-1.5 border-b border-[#2C3442] last:border-0">
                    <div>
                      <span class="text-sm text-zinc-200">${log.food_name}</span>
                      <p class="text-xs text-zinc-500 mt-0.5">${log.grams}g · ${log.kcal ?? 0} kcal · P ${log.protein ?? 0}g · C ${log.carbs ?? 0}g · G ${log.fat ?? 0}g</p>
                    </div>
                    <button class="delete-log-btn btn-ghost text-xs text-red-400" data-id="${log.id}">✕</button>
                  </div>
                `).join('')
            }
          </div>`;
      }).join('');

      container.querySelectorAll('.delete-log-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await deleteNutritionLog(Number((btn as HTMLElement).dataset['id']));
          await loadLogs();
          await updateMacroSummary();
        });
      });
    } catch (err) {
      container.innerHTML = `<p class="text-red-400 text-sm">Errore: ${err}</p>`;
    }
  }

  async function loadWater(): Promise<void> {
    const ml = await getWaterLogByDate(currentDate);
    const waterEl = el.querySelector('#water-total');
    if (waterEl) waterEl.textContent = `${ml} ml`;
  }

  async function updateMacroSummary(): Promise<void> {
    const container = el.querySelector('#macro-summary') as HTMLElement;
    try {
      const logs = await getNutritionLogsByDate(currentDate);
      const t = logs.reduce((acc, l) => ({
        kcal:    acc.kcal    + (l.kcal    ?? 0),
        protein: acc.protein + (l.protein ?? 0),
        carbs:   acc.carbs   + (l.carbs   ?? 0),
        fat:     acc.fat     + (l.fat     ?? 0),
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

      container.innerHTML = [
        { value: `${Math.round(t.kcal)}`,        label: 'Kcal',        color: 'text-yellow-400' },
        { value: `${t.protein.toFixed(1)}g`,      label: 'Proteine',    color: 'text-brand-400'  },
        { value: `${t.carbs.toFixed(1)}g`,        label: 'Carboidrati', color: 'text-blue-400'   },
        { value: `${t.fat.toFixed(1)}g`,          label: 'Grassi',      color: 'text-orange-400' },
      ].map(s => `
        <div class="stat-card text-center">
          <div class="stat-value ${s.color}">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>`).join('');
    } catch { /* ignore */ }
  }

  (el.querySelector('#date-picker') as HTMLInputElement).addEventListener('change', async (e) => {
    currentDate = (e.target as HTMLInputElement).value;
    await refreshDiario();
  });

  el.querySelectorAll('.add-water-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await addWaterLog(currentDate, Number((btn as HTMLElement).dataset['ml']));
      await loadWater();
    });
  });

  el.querySelector('#reset-water-btn')?.addEventListener('click', async () => {
    await resetWaterLog(currentDate);
    await loadWater();
  });

  el.querySelector('#add-log-btn')?.addEventListener('click', async () => {
    const mealType = (el.querySelector('#log-meal-type') as HTMLSelectElement).value;
    const foodId   = Number((el.querySelector('#log-food-select') as HTMLSelectElement).value);
    const grams    = Number((el.querySelector('#log-grams') as HTMLInputElement).value);
    const errEl    = el.querySelector('#log-error') as HTMLElement;
    const btn      = el.querySelector('#add-log-btn') as HTMLButtonElement;
    errEl.classList.add('hidden');

    if (foodItems.length === 0) {
      errEl.textContent = 'Il catalogo è vuoto. Aggiungi prima degli alimenti nel tab Catalogo.';
      errEl.classList.remove('hidden');
      return;
    }
    if (!foodId || !grams) {
      errEl.textContent = 'Seleziona un alimento e inserisci i grammi.';
      errEl.classList.remove('hidden');
      return;
    }
    const food = foodItems.find(f => f.id === foodId);
    if (!food) return;
    const ratio = grams / 100;
    btn.disabled = true;
    btn.textContent = 'Salvataggio…';
    try {
      await addNutritionLog({
        date: currentDate, meal_type: mealType,
        food_item_id: foodId, food_name: food.name, grams,
        kcal:    food.kcal_per_100g != null ? Math.round(food.kcal_per_100g * ratio) : null,
        protein: food.protein_g     != null ? Math.round(food.protein_g     * ratio * 10) / 10 : null,
        carbs:   food.carbs_g       != null ? Math.round(food.carbs_g       * ratio * 10) / 10 : null,
        fat:     food.fat_g         != null ? Math.round(food.fat_g         * ratio * 10) / 10 : null,
      });
      (el.querySelector('#log-grams') as HTMLInputElement).value = '';
      await refreshDiario();
    } catch (err: unknown) {
      errEl.textContent = err instanceof Error ? err.message : 'Errore durante il salvataggio.';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Aggiungi';
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB PIANO
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadPlans(): Promise<void> {
    const plans = await getMealPlans();
    const listEl = el.querySelector('#plans-list') as HTMLElement;
    if (plans.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>Nessun piano creato.</p></div>';
      return;
    }
    listEl.innerHTML = `<div class="flex flex-col gap-3">
      ${plans.map(p => `
        <div class="card flex items-center justify-between gap-3">
          <div>
            <p class="font-medium text-zinc-100">${p.name}</p>
            <span class="badge-zinc mt-1">${p.plan_type === 'weekly' ? 'Settimanale' : 'Ciclico'}</span>
          </div>
          <button class="delete-plan-btn btn-ghost text-xs text-red-400 shrink-0" data-id="${p.id}">✕</button>
        </div>`).join('')}
    </div>`;

    listEl.querySelectorAll('.delete-plan-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminare questo piano?')) return;
        await deleteMealPlan(Number((btn as HTMLElement).dataset['id']));
        await loadPlans();
      });
    });
  }

  el.querySelector('#add-plan-btn')?.addEventListener('click', async () => {
    const name     = (el.querySelector('#plan-name') as HTMLInputElement).value.trim();
    const planType = (el.querySelector('#plan-type') as HTMLSelectElement).value as 'weekly' | 'cycle';
    if (!name) return;
    await addMealPlan(name, planType);
    (el.querySelector('#plan-name') as HTMLInputElement).value = '';
    await loadPlans();
  });

  (el.querySelector('#import-plan-file') as HTMLInputElement).addEventListener('change', async (e) => {
    const file  = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const msgEl = el.querySelector('#plans-msg') as HTMLElement;
    msgEl.textContent = '⏳ Analisi PDF in corso…';
    msgEl.className = 'text-sm mt-3 text-zinc-400';
    msgEl.classList.remove('hidden');

    try {
      const base64 = await readFileAsBase64(file);
      if (!base64) throw new Error('File vuoto o non leggibile.');

      const res  = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 8000,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: PLAN_PROMPT },
          ]}],
        }),
      });
      const data    = await res.json();
      const rawText: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
      if (!rawText) throw new Error('Nessuna risposta dall\'AI.');

      const jsonStr = (rawText.match(/\{[\s\S]*\}/) ?? [rawText.replace(/```json|```/g, '').trim()])[0];
      const parsed: ImportedPlan = JSON.parse(jsonStr);

      const planId = await addMealPlan(parsed.name, parsed.plan_type ?? 'weekly');
      let totalEntries = 0;
      for (let di = 0; di < parsed.days.length; di++) {
        const day   = parsed.days[di];
        const dayId = await addMealPlanDay(planId, di + 1, day.label ?? `Giorno ${di + 1}`);
        for (const meal of day.meals ?? []) {
          for (const entry of meal.entries ?? []) {
            await addMealPlanEntry({ meal_plan_day_id: dayId, meal_type: meal.meal_type,
              food_item_id: null, food_name: entry.food_name, grams: entry.grams ?? 0,
              kcal: entry.kcal ?? null, protein: entry.protein ?? null, carbs: entry.carbs ?? null, fat: entry.fat ?? null });
            totalEntries++;
          }
        }
      }
      msgEl.textContent = `✓ Piano "${parsed.name}" importato: ${parsed.days.length} giorni, ${totalEntries} alimenti.`;
      msgEl.className = 'text-sm mt-3 text-brand-400';
      await loadPlans();
    } catch (err) {
      msgEl.textContent = '✕ Errore: ' + (err instanceof Error ? err.message : String(err));
      msgEl.className = 'text-sm mt-3 text-red-400';
    }
    (e.target as HTMLInputElement).value = '';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB CATALOGO
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadFoods(updateSelect = true): Promise<void> {
    foodItems = await getFoodItems();
    if (updateSelect) {
      const select = el.querySelector('#log-food-select') as HTMLSelectElement;
      if (select) {
        select.innerHTML = '<option value="">— seleziona —</option>' +
          foodItems.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
      }
    }
    const list = el.querySelector('#food-list') as HTMLElement;
    if (!list) return;
    if (foodItems.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>Catalogo vuoto.</p></div>';
      return;
    }
    list.innerHTML = `<div class="card p-0 overflow-hidden">
      ${foodItems.map((f, i) => `
        <div class="flex items-center justify-between px-4 py-3 ${i < foodItems.length - 1 ? 'border-b border-[#2C3442]' : ''}">
          <div>
            <span class="text-sm text-zinc-200">${f.name}</span>
            <span class="text-xs text-zinc-500 ml-2">
              ${f.kcal_per_100g ?? '?'} kcal · P ${f.protein_g ?? '?'}g · C ${f.carbs_g ?? '?'}g · G ${f.fat_g ?? '?'}g
            </span>
          </div>
          <button class="delete-food-btn btn-ghost text-xs text-red-400 shrink-0" data-id="${f.id}">✕</button>
        </div>`).join('')}
    </div>`;

    list.querySelectorAll('.delete-food-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteFoodItem(Number((btn as HTMLElement).dataset['id']));
        await loadFoods();
      });
    });
  }

  el.querySelector('#add-food-btn')?.addEventListener('click', async () => {
    const name    = (el.querySelector('#food-name')    as HTMLInputElement).value;
    const kcal    = parseFloat((el.querySelector('#food-kcal')    as HTMLInputElement).value) || null;
    const protein = parseFloat((el.querySelector('#food-protein') as HTMLInputElement).value) || null;
    const carbs   = parseFloat((el.querySelector('#food-carbs')   as HTMLInputElement).value) || null;
    const fat     = parseFloat((el.querySelector('#food-fat')     as HTMLInputElement).value) || null;
    const errEl   = el.querySelector('#food-error') as HTMLElement;
    errEl.classList.add('hidden');
    try {
      await addFoodItem({ name, kcal_per_100g: kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, source: 'manual' });
      ['#food-name','#food-kcal','#food-protein','#food-carbs','#food-fat'].forEach(id => {
        (el.querySelector(id) as HTMLInputElement).value = '';
      });
      await loadFoods();
    } catch (err: unknown) {
      errEl.textContent = err instanceof Error ? err.message : 'Errore.';
      errEl.classList.remove('hidden');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB CORPO
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadWeights(): Promise<void> {
    const logs   = await getBodyWeightLogs();
    const listEl = el.querySelector('#weight-list') as HTMLElement;
    if (logs.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>Nessun peso registrato.</p></div>';
      return;
    }
    listEl.innerHTML = `<div class="card p-0 overflow-hidden">
      ${logs.slice(0, 30).map((w, i) => `
        <div class="flex items-center justify-between px-4 py-3 ${i < Math.min(logs.length, 30) - 1 ? 'border-b border-[#2C3442]' : ''}">
          <div class="flex items-center gap-3">
            <span class="text-sm text-zinc-400">${w.date}</span>
            <span class="font-semibold text-zinc-100">${w.weight_kg} kg</span>
            ${w.phase ? `<span class="badge-zinc">${w.phase}</span>` : ''}
            ${w.notes ? `<span class="text-xs text-zinc-500">${w.notes}</span>` : ''}
          </div>
          <button class="delete-weight-btn btn-ghost text-xs text-red-400 shrink-0" data-id="${w.id}">✕</button>
        </div>`).join('')}
    </div>`;

    listEl.querySelectorAll('.delete-weight-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteBodyWeightLog(Number((btn as HTMLElement).dataset['id']));
        await loadWeights();
      });
    });
  }

  el.querySelector('#save-weight-btn')?.addEventListener('click', async () => {
    const date   = (el.querySelector('#weight-date')  as HTMLInputElement).value;
    const value  = parseFloat((el.querySelector('#weight-value') as HTMLInputElement).value);
    const phase  = (el.querySelector('#weight-phase') as HTMLSelectElement).value as 'bulk' | 'cut' | '';
    const notes  = (el.querySelector('#weight-notes') as HTMLInputElement).value.trim() || null;
    if (!date || isNaN(value)) return;
    await upsertBodyWeightLog(date, value, notes, phase || null);
    (el.querySelector('#weight-value') as HTMLInputElement).value = '';
    (el.querySelector('#weight-notes') as HTMLInputElement).value = '';
    await loadWeights();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB RICETTE
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadRecipes(): Promise<void> {
    const recipes = await getRecipes();
    const listEl  = el.querySelector('#recipes-list') as HTMLElement;
    if (recipes.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>Nessuna ricetta. Aggiungila manualmente o importa da PDF.</p></div>';
      return;
    }
    listEl.innerHTML = `<div class="flex flex-col gap-3">
      ${recipes.map(r => recipeCard(r)).join('')}
    </div>`;

    listEl.querySelectorAll('.delete-recipe-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminare questa ricetta?')) return;
        await deleteRecipe(Number((btn as HTMLElement).dataset['id']));
        await loadRecipes();
      });
    });

    listEl.querySelectorAll('.expand-recipe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id      = (btn as HTMLElement).dataset['id'];
        const details = listEl.querySelector(`#recipe-details-${id}`) as HTMLElement;
        details.classList.toggle('hidden');
        (btn as HTMLElement).textContent = details.classList.contains('hidden') ? '▼' : '▲';
      });
    });
  }

  el.querySelector('#add-recipe-btn')?.addEventListener('click', async () => {
    const title    = (el.querySelector('#recipe-title')        as HTMLInputElement).value.trim();
    const errEl    = el.querySelector('#recipe-error') as HTMLElement;
    errEl.classList.add('hidden');
    if (!title) { errEl.textContent = 'Inserisci il titolo.'; errEl.classList.remove('hidden'); return; }

    try {
      await addRecipe({
        title,
        description:  (el.querySelector('#recipe-desc')         as HTMLInputElement).value.trim() || null,
        servings:     parseInt((el.querySelector('#recipe-servings') as HTMLInputElement).value) || 1,
        kcal:         parseFloat((el.querySelector('#recipe-kcal')    as HTMLInputElement).value) || null,
        protein:      parseFloat((el.querySelector('#recipe-protein') as HTMLInputElement).value) || null,
        carbs:        parseFloat((el.querySelector('#recipe-carbs')   as HTMLInputElement).value) || null,
        fat:          parseFloat((el.querySelector('#recipe-fat')     as HTMLInputElement).value) || null,
        ingredients:  (el.querySelector('#recipe-ingredients')   as HTMLTextAreaElement).value.trim() || null,
        instructions: (el.querySelector('#recipe-instructions')  as HTMLTextAreaElement).value.trim() || null,
        source: 'manual',
      });
      ['#recipe-title','#recipe-desc','#recipe-servings','#recipe-kcal','#recipe-protein',
       '#recipe-carbs','#recipe-fat'].forEach(id => { (el.querySelector(id) as HTMLInputElement).value = ''; });
      (el.querySelector('#recipe-ingredients')  as HTMLTextAreaElement).value = '';
      (el.querySelector('#recipe-instructions') as HTMLTextAreaElement).value = '';
      await loadRecipes();
    } catch (err: unknown) {
      errEl.textContent = err instanceof Error ? err.message : 'Errore.';
      errEl.classList.remove('hidden');
    }
  });

  (el.querySelector('#import-recipe-file') as HTMLInputElement).addEventListener('change', async (e) => {
    const file  = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const msgEl = el.querySelector('#recipe-import-msg') as HTMLElement;
    msgEl.textContent = '⏳ Analisi PDF in corso…';
    msgEl.className = 'text-sm mt-3 text-zinc-400';
    msgEl.classList.remove('hidden');

    try {
      const base64 = await readFileAsBase64(file);
      const res    = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 8000,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: RECIPE_PROMPT },
          ]}],
        }),
      });
      const data    = await res.json();
      const rawText: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
      if (!rawText) throw new Error('Nessuna risposta dall\'AI.');

      const jsonStr  = (rawText.match(/\[[\s\S]*\]/) ?? [rawText.replace(/```json|```/g, '').trim()])[0];
      const recipes: Partial<Recipe>[] = JSON.parse(jsonStr);
      const list = Array.isArray(recipes) ? recipes : [recipes];

      for (const r of list) {
        await addRecipe({
          title:        r.title       ?? 'Ricetta importata',
          description:  r.description ?? null,
          servings:     r.servings    ?? 1,
          kcal:         r.kcal        ?? null,
          protein:      r.protein     ?? null,
          carbs:        r.carbs       ?? null,
          fat:          r.fat         ?? null,
          ingredients:  typeof r.ingredients  === 'string' ? r.ingredients  : (r.ingredients  ? JSON.stringify(r.ingredients)  : null),
          instructions: typeof r.instructions === 'string' ? r.instructions : (r.instructions ? JSON.stringify(r.instructions) : null),
          source: 'pdf',
        });
      }
      msgEl.textContent = `✓ ${list.length} ricetta${list.length > 1 ? 'e' : ''} importata${list.length > 1 ? 'e' : ''} con successo.`;
      msgEl.className = 'text-sm mt-3 text-brand-400';
      await loadRecipes();
    } catch (err) {
      msgEl.textContent = '✕ Errore: ' + (err instanceof Error ? err.message : String(err));
      msgEl.className = 'text-sm mt-3 text-red-400';
    }
    (e.target as HTMLInputElement).value = '';
  });

  // ─── Init: carica tutto il necessario per il tab di default (Diario) ────────
  await loadFoods(true);
  await refreshDiario();

  return el;
}

function recipeCard(r: Recipe): string {
  const macros = [r.kcal, r.protein, r.carbs, r.fat].some(v => v != null)
    ? `${Math.round(r.kcal ?? 0)} kcal · P ${Math.round(r.protein ?? 0)}g · C ${Math.round(r.carbs ?? 0)}g · G ${Math.round(r.fat ?? 0)}g`
    : '';
  return `
    <div class="card">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="font-medium text-zinc-100">${r.title}</p>
          ${r.description ? `<p class="text-xs text-zinc-500 mt-0.5">${r.description}</p>` : ''}
          ${macros ? `<p class="text-xs text-zinc-500 mt-1">${macros} · ${r.servings} porz.</p>` : ''}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button class="expand-recipe-btn btn-ghost text-xs px-2" data-id="${r.id}">▼</button>
          <button class="delete-recipe-btn btn-ghost text-xs text-red-400 px-2" data-id="${r.id}">✕</button>
        </div>
      </div>
      <div id="recipe-details-${r.id}" class="hidden mt-3 pt-3 border-t border-[#2C3442] flex flex-col gap-2">
        ${r.ingredients ? `
          <div>
            <p class="text-xs font-semibold text-zinc-400 mb-1">Ingredienti</p>
            <p class="text-sm text-zinc-300 whitespace-pre-line">${r.ingredients}</p>
          </div>` : ''}
        ${r.instructions ? `
          <div>
            <p class="text-xs font-semibold text-zinc-400 mb-1">Istruzioni</p>
            <p class="text-sm text-zinc-300 whitespace-pre-line">${r.instructions}</p>
          </div>` : ''}
      </div>
    </div>`;
}
