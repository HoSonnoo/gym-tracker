import {
  getFoodItems,
  addFoodItem,
  deleteFoodItem,
  getNutritionLogsByDate,
  addNutritionLog,
  deleteNutritionLog,
  getWaterLogByDate,
  addWaterLog,
  resetWaterLog,
} from '@/repository/nutrition';
import type { FoodItem, NutritionLog } from '@/types';

const MEAL_TYPES = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];

export async function renderNutrition(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  const today = new Date().toISOString().slice(0, 10);

  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-zinc-100">Nutrizione</h1>
      <input id="date-picker" type="date" class="input w-auto" value="${today}" />
    </div>

    <!-- Macro summary -->
    <div id="macro-summary" class="grid grid-cols-4 gap-3 mb-6"></div>

    <!-- Water -->
    <div class="card mb-4">
      <div class="flex items-center justify-between mb-2">
        <h2 class="section-title mb-0">💧 Acqua</h2>
        <span id="water-total" class="text-brand-400 font-semibold text-sm">0 ml</span>
      </div>
      <div class="flex gap-2">
        <button class="add-water-btn btn-secondary text-xs" data-ml="250">+250 ml</button>
        <button class="add-water-btn btn-secondary text-xs" data-ml="500">+500 ml</button>
        <button class="add-water-btn btn-secondary text-xs" data-ml="750">+750 ml</button>
        <button id="reset-water-btn" class="btn-ghost text-xs text-red-400 ml-auto">Reset</button>
      </div>
    </div>

    <!-- Log by meal -->
    <div id="logs-section" class="flex flex-col gap-4 mb-6">
      <div class="flex items-center justify-center h-32"><div class="spinner"></div></div>
    </div>

    <!-- Add food log -->
    <div class="card mb-4">
      <h2 class="section-title">Aggiungi alimento</h2>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="label">Pasto</label>
          <select id="log-meal-type" class="input">
            ${MEAL_TYPES.map(m => `<option value="${m}">${m}</option>`).join('')}
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

    <!-- Food catalog -->
    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="section-title mb-0">Catalogo alimenti</h2>
        <button id="toggle-catalog-btn" class="btn-ghost text-xs">Mostra/Nascondi</button>
      </div>
      <div id="catalog-section" class="hidden">
        <!-- Add food form -->
        <div class="flex flex-col gap-3 mb-4 pb-4 border-b border-zinc-800">
          <div class="grid grid-cols-2 gap-2">
            <div class="col-span-2">
              <label class="label">Nome alimento</label>
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
          <p id="food-error" class="text-red-400 text-sm hidden"></p>
          <button id="add-food-btn" class="btn-primary w-fit">Aggiungi al catalogo</button>
        </div>
        <div id="food-list"></div>
      </div>
    </div>
  `;

  let currentDate = today;
  let foodItems: FoodItem[] = [];

  async function refresh(): Promise<void> {
    await Promise.all([
      loadLogs(el, currentDate, foodItems),
      loadWater(el, currentDate),
    ]);
    updateMacroSummary(el, currentDate);
  }

  // Load food catalog
  async function loadFoods(): Promise<void> {
    foodItems = await getFoodItems();
    const select = el.querySelector('#log-food-select') as HTMLSelectElement;
    select.innerHTML = '<option value="">— seleziona —</option>' +
      foodItems.map(f => `<option value="${f.id}">${f.name}</option>`).join('');

    const list = el.querySelector('#food-list') as HTMLElement;
    if (foodItems.length === 0) {
      list.innerHTML = '<p class="text-zinc-500 text-sm">Catalogo vuoto.</p>';
      return;
    }
    list.innerHTML = foodItems.map(f => `
      <div class="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
        <div>
          <span class="text-sm text-zinc-200">${f.name}</span>
          <span class="text-xs text-zinc-500 ml-2">${f.kcal_per_100g ?? '?'} kcal | P:${f.protein_g ?? '?'}g C:${f.carbs_g ?? '?'}g F:${f.fat_g ?? '?'}g</span>
        </div>
        <button class="delete-food-btn btn-ghost text-xs text-red-400" data-id="${f.id}">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.delete-food-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteFoodItem(Number((btn as HTMLElement).dataset['id']));
        await loadFoods();
      });
    });
  }

  // Date change
  (el.querySelector('#date-picker') as HTMLInputElement).addEventListener('change', async (e) => {
    currentDate = (e.target as HTMLInputElement).value;
    await refresh();
  });

  // Water buttons
  el.querySelectorAll('.add-water-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await addWaterLog(currentDate, Number((btn as HTMLElement).dataset['ml']));
      await loadWater(el, currentDate);
    });
  });

  el.querySelector('#reset-water-btn')?.addEventListener('click', async () => {
    await resetWaterLog(currentDate);
    await loadWater(el, currentDate);
  });

  // Add log
  el.querySelector('#add-log-btn')?.addEventListener('click', async () => {
    const mealType = (el.querySelector('#log-meal-type') as HTMLSelectElement).value;
    const foodId = Number((el.querySelector('#log-food-select') as HTMLSelectElement).value);
    const grams = Number((el.querySelector('#log-grams') as HTMLInputElement).value);
    const errEl = el.querySelector('#log-error') as HTMLElement;
    errEl.classList.add('hidden');

    if (!foodId || !grams) {
      errEl.textContent = 'Seleziona un alimento e inserisci i grammi.';
      errEl.classList.remove('hidden');
      return;
    }

    const food = foodItems.find(f => f.id === foodId);
    if (!food) return;

    const ratio = grams / 100;
    await addNutritionLog({
      date: currentDate,
      meal_type: mealType,
      food_item_id: foodId,
      food_name: food.name,
      grams,
      kcal: food.kcal_per_100g != null ? Math.round(food.kcal_per_100g * ratio) : null,
      protein: food.protein_g != null ? Math.round(food.protein_g * ratio * 10) / 10 : null,
      carbs: food.carbs_g != null ? Math.round(food.carbs_g * ratio * 10) / 10 : null,
      fat: food.fat_g != null ? Math.round(food.fat_g * ratio * 10) / 10 : null,
    });
    (el.querySelector('#log-grams') as HTMLInputElement).value = '';
    await refresh();
  });

  // Add food to catalog
  el.querySelector('#add-food-btn')?.addEventListener('click', async () => {
    const name = (el.querySelector('#food-name') as HTMLInputElement).value;
    const kcal = parseFloat((el.querySelector('#food-kcal') as HTMLInputElement).value) || null;
    const protein = parseFloat((el.querySelector('#food-protein') as HTMLInputElement).value) || null;
    const carbs = parseFloat((el.querySelector('#food-carbs') as HTMLInputElement).value) || null;
    const fat = parseFloat((el.querySelector('#food-fat') as HTMLInputElement).value) || null;
    const errEl = el.querySelector('#food-error') as HTMLElement;

    try {
      await addFoodItem({ name, kcal_per_100g: kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, source: 'manual' });
      ['#food-name', '#food-kcal', '#food-protein', '#food-carbs', '#food-fat'].forEach(id => {
        (el.querySelector(id) as HTMLInputElement).value = '';
      });
      await loadFoods();
    } catch (err: unknown) {
      errEl.textContent = err instanceof Error ? err.message : 'Errore.';
      errEl.classList.remove('hidden');
    }
  });

  // Toggle catalog
  el.querySelector('#toggle-catalog-btn')?.addEventListener('click', () => {
    el.querySelector('#catalog-section')?.classList.toggle('hidden');
  });

  await loadFoods();
  await refresh();

  return el;
}

async function loadLogs(el: HTMLElement, date: string, foods: FoodItem[]): Promise<void> {
  const container = el.querySelector('#logs-section') as HTMLElement;
  try {
    const logs = await getNutritionLogsByDate(date);
    const byMeal: Record<string, NutritionLog[]> = {};
    for (const m of MEAL_TYPES) byMeal[m] = [];
    for (const log of logs) {
      if (!byMeal[log.meal_type]) byMeal[log.meal_type] = [];
      byMeal[log.meal_type].push(log);
    }

    container.innerHTML = MEAL_TYPES.map(meal => {
      const entries = byMeal[meal] ?? [];
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
                <div class="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
                  <div>
                    <span class="text-sm text-zinc-200">${log.food_name}</span>
                    <span class="text-xs text-zinc-500 ml-2">${log.grams}g · ${log.kcal ?? '?'} kcal</span>
                  </div>
                  <button class="delete-log-btn btn-ghost text-xs text-red-400" data-id="${log.id}">✕</button>
                </div>
              `).join('')
          }
        </div>
      `;
    }).join('');

    container.querySelectorAll('.delete-log-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteNutritionLog(Number((btn as HTMLElement).dataset['id']));
        await loadLogs(el, date, foods);
        await updateMacroSummary(el, date);
      });
    });

  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-sm">Errore: ${err}</p>`;
  }
}

async function loadWater(el: HTMLElement, date: string): Promise<void> {
  const ml = await getWaterLogByDate(date);
  const waterEl = el.querySelector('#water-total');
  if (waterEl) waterEl.textContent = `${ml} ml`;
}

async function updateMacroSummary(el: HTMLElement, date: string): Promise<void> {
  const container = el.querySelector('#macro-summary') as HTMLElement;
  try {
    const logs = await getNutritionLogsByDate(date);
    const totals = logs.reduce((acc, l) => ({
      kcal: acc.kcal + (l.kcal ?? 0),
      protein: acc.protein + (l.protein ?? 0),
      carbs: acc.carbs + (l.carbs ?? 0),
      fat: acc.fat + (l.fat ?? 0),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    container.innerHTML = [
      { value: `${Math.round(totals.kcal)}`, label: 'Kcal', color: 'text-yellow-400' },
      { value: `${totals.protein.toFixed(1)}g`, label: 'Proteine', color: 'text-brand-400' },
      { value: `${totals.carbs.toFixed(1)}g`, label: 'Carboidrati', color: 'text-blue-400' },
      { value: `${totals.fat.toFixed(1)}g`, label: 'Grassi', color: 'text-orange-400' },
    ].map(s => `
      <div class="stat-card text-center">
        <div class="stat-value ${s.color}">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');
  } catch { /* ignore */ }
}
