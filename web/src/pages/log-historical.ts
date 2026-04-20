import { getExercises } from '@/repository/exercises';
import { getWorkoutTemplates, saveHistoricalSession } from '@/repository/workouts';
import { navigate } from '@/router';
import type { Exercise } from '@/types';

type SetEntry = { id: string; set_type: 'warmup' | 'target'; weight_kg: string; reps: string };
type ExerciseEntry = { id: string; exercise_name: string; category: string | null; sets: SetEntry[] };

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export async function renderLogHistorical(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-2xl mx-auto';

  const [templates, allExercises] = await Promise.all([
    getWorkoutTemplates(),
    getExercises(),
  ]);

  let exercises: ExerciseEntry[] = [];
  let saving = false;

  // ─── Render ────────────────────────────────────────────────────────────────

  function render(): void {
    el.innerHTML = `
      <div class="flex items-center gap-3 mb-6">
        <button id="back-btn" class="btn-ghost text-sm">← Indietro</button>
        <h1 class="text-2xl font-bold text-zinc-100 flex-1">Allenamento pregresso</h1>
        <button id="save-btn" class="btn-primary" ${saving ? 'disabled' : ''}>
          ${saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>

      <!-- Intestazione sessione -->
      <div class="card mb-4 flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Data *</label>
            <input id="session-date" type="date" class="input" value="${todayISO()}" max="${todayISO()}" />
          </div>
          <div>
            <label class="label">Nome sessione *</label>
            <input id="session-name" type="text" class="input" placeholder="Es. Push A, Full Body…" />
          </div>
        </div>
        <div>
          <label class="label">Note</label>
          <textarea id="session-notes" class="input resize-none h-16" placeholder="Come ti sei sentito, condizioni..."></textarea>
        </div>
        ${templates.length > 0 ? `
          <div>
            <label class="label">Usa nome da template (opzionale)</label>
            <select id="template-select" class="input">
              <option value="">— nessuno —</option>
              ${templates.map(t => `<option value="${escHtml(t.name)}">${escHtml(t.name)}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <!-- Esercizi -->
      <div id="exercises-list" class="flex flex-col gap-3 mb-4">
        ${exercises.map((ex, i) => renderExerciseCard(ex, i)).join('')}
      </div>

      <!-- Aggiungi esercizio -->
      <button id="add-exercise-btn"
        class="w-full py-3 rounded-xl border border-dashed border-brand-500/40 text-brand-400 text-sm font-semibold hover:bg-brand-500/5 transition-all mb-6">
        + Aggiungi esercizio
      </button>

      <!-- Picker esercizi (overlay) -->
      <div id="exercise-picker" class="hidden fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
        <div class="bg-[#181C23] border border-[#2C3442] rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col">
          <div class="flex items-center justify-between p-4 border-b border-[#2C3442]">
            <span class="font-semibold text-zinc-100">Scegli esercizio</span>
            <button id="close-picker" class="btn-ghost text-sm">Chiudi</button>
          </div>
          <input id="exercise-search" type="text" class="input m-3" placeholder="Cerca…" autocomplete="off" />
          <div id="exercise-picker-list" class="overflow-y-auto flex-1 px-3 pb-3 flex flex-col gap-1">
            ${renderExercisePickerItems(allExercises, '')}
          </div>
        </div>
      </div>

      <p id="save-error" class="text-red-400 text-sm hidden mb-4"></p>
    `;

    bindEvents();
  }

  function renderExerciseCard(ex: ExerciseEntry, _idx: number): string {
    return `
      <div class="card" data-ex-id="${ex.id}">
        <div class="flex items-center gap-2 mb-3">
          <input class="input flex-1 font-semibold ex-name-input" value="${escHtml(ex.exercise_name)}"
            placeholder="Nome esercizio" data-ex-id="${ex.id}" />
          <button class="btn-ghost text-red-400 text-xs remove-ex-btn" data-ex-id="${ex.id}">✕</button>
        </div>

        <!-- Header colonne -->
        <div class="grid grid-cols-[40px_1fr_1fr_28px] gap-2 mb-1 px-1">
          <span class="text-xs text-zinc-600 font-medium text-center">Tipo</span>
          <span class="text-xs text-zinc-600 font-medium text-center">Peso (kg)</span>
          <span class="text-xs text-zinc-600 font-medium text-center">Reps</span>
          <span></span>
        </div>

        <!-- Serie -->
        <div class="flex flex-col gap-1 mb-2" id="sets-${ex.id}">
          ${ex.sets.map((s, si) => renderSetRow(ex.id, s, si)).join('')}
        </div>

        <button class="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-xs hover:border-zinc-600 hover:text-zinc-400 transition-all add-set-btn"
          data-ex-id="${ex.id}">
          + Serie
        </button>
      </div>
    `;
  }

  function renderSetRow(exId: string, s: SetEntry, _idx: number): string {
    const isWarmup = s.set_type === 'warmup';
    return `
      <div class="grid grid-cols-[40px_1fr_1fr_28px] gap-2 items-center" data-set-id="${s.id}">
        <button class="h-8 w-8 rounded-lg text-xs font-bold text-white transition-all toggle-set-type
          ${isWarmup ? 'bg-zinc-600' : 'bg-brand-500'}"
          data-ex-id="${exId}" data-set-id="${s.id}" title="${isWarmup ? 'Warmup — clicca per cambiare' : 'Target — clicca per cambiare'}">
          ${isWarmup ? 'W' : '●'}
        </button>
        <input type="number" step="0.5" min="0"
          class="input text-center font-semibold set-weight-input"
          value="${s.weight_kg}" placeholder="—"
          data-ex-id="${exId}" data-set-id="${s.id}" />
        <input type="number" min="0"
          class="input text-center font-semibold set-reps-input"
          value="${s.reps}" placeholder="—"
          data-ex-id="${exId}" data-set-id="${s.id}" />
        <button class="w-7 h-7 rounded-md bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-all remove-set-btn flex items-center justify-center"
          data-ex-id="${exId}" data-set-id="${s.id}">✕</button>
      </div>
    `;
  }

  function renderExercisePickerItems(list: Exercise[], search: string): string {
    const filtered = search.trim()
      ? list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
      : list;
    if (filtered.length === 0) return '<p class="text-zinc-500 text-sm text-center py-8">Nessun esercizio trovato</p>';
    return filtered.map(e => `
      <button class="text-left w-full px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-all pick-exercise-btn"
        data-name="${escHtml(e.name)}" data-category="${escHtml(e.category ?? '')}">
        <div class="text-sm font-semibold text-zinc-200">${escHtml(e.name)}</div>
        ${e.category ? `<div class="text-xs text-zinc-500">${escHtml(e.category)}</div>` : ''}
      </button>
    `).join('');
  }

  // ─── Event binding ─────────────────────────────────────────────────────────

  function bindEvents(): void {
    el.querySelector('#back-btn')?.addEventListener('click', () => navigate('/workouts'));

    // Template selector
    el.querySelector('#template-select')?.addEventListener('change', (e) => {
      const name = (e.target as HTMLSelectElement).value;
      if (name) (el.querySelector('#session-name') as HTMLInputElement).value = name;
    });

    // Aggiungi esercizio
    el.querySelector('#add-exercise-btn')?.addEventListener('click', () => {
      el.querySelector('#exercise-picker')?.classList.remove('hidden');
      (el.querySelector('#exercise-search') as HTMLInputElement)?.focus();
    });

    el.querySelector('#close-picker')?.addEventListener('click', closePicker);
    el.querySelector('#exercise-picker')?.addEventListener('click', (e) => {
      if (e.target === el.querySelector('#exercise-picker')) closePicker();
    });

    el.querySelector('#exercise-search')?.addEventListener('input', (e) => {
      const search = (e.target as HTMLInputElement).value;
      const listEl = el.querySelector('#exercise-picker-list') as HTMLElement;
      listEl.innerHTML = renderExercisePickerItems(allExercises, search);
      bindPickerItemEvents();
    });
    bindPickerItemEvents();

    // Rimuovi esercizio
    el.querySelectorAll('.remove-ex-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset['exId']!;
        exercises = exercises.filter(e => e.id !== id);
        render();
      });
    });

    // Nome esercizio
    el.querySelectorAll('.ex-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = (e.target as HTMLInputElement).dataset['exId']!;
        const ex = exercises.find(e => e.id === id);
        if (ex) ex.exercise_name = (e.target as HTMLInputElement).value;
      });
    });

    // Toggle tipo serie
    el.querySelectorAll('.toggle-set-type').forEach(btn => {
      btn.addEventListener('click', () => {
        const exId = (btn as HTMLElement).dataset['exId']!;
        const setId = (btn as HTMLElement).dataset['setId']!;
        const ex = exercises.find(e => e.id === exId);
        const s = ex?.sets.find(s => s.id === setId);
        if (s) { s.set_type = s.set_type === 'target' ? 'warmup' : 'target'; render(); }
      });
    });

    // Peso serie
    el.querySelectorAll('.set-weight-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const el2 = e.target as HTMLInputElement;
        const ex = exercises.find(e => e.id === el2.dataset['exId']);
        const s = ex?.sets.find(s => s.id === el2.dataset['setId']);
        if (s) s.weight_kg = el2.value;
      });
    });

    // Reps serie
    el.querySelectorAll('.set-reps-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const el2 = e.target as HTMLInputElement;
        const ex = exercises.find(e => e.id === el2.dataset['exId']);
        const s = ex?.sets.find(s => s.id === el2.dataset['setId']);
        if (s) s.reps = el2.value;
      });
    });

    // Aggiungi serie
    el.querySelectorAll('.add-set-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const exId = (btn as HTMLElement).dataset['exId']!;
        const ex = exercises.find(e => e.id === exId);
        if (ex) { ex.sets.push({ id: uid(), set_type: 'target', weight_kg: '', reps: '' }); render(); }
      });
    });

    // Rimuovi serie
    el.querySelectorAll('.remove-set-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const exId = (btn as HTMLElement).dataset['exId']!;
        const setId = (btn as HTMLElement).dataset['setId']!;
        const ex = exercises.find(e => e.id === exId);
        if (ex && ex.sets.length > 1) {
          ex.sets = ex.sets.filter(s => s.id !== setId);
          render();
        }
      });
    });

    // Salva
    el.querySelector('#save-btn')?.addEventListener('click', handleSave);
  }

  function bindPickerItemEvents(): void {
    el.querySelectorAll('.pick-exercise-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = (btn as HTMLElement).dataset['name'] ?? '';
        const category = (btn as HTMLElement).dataset['category'] || null;
        exercises.push({
          id: uid(),
          exercise_name: name,
          category,
          sets: [{ id: uid(), set_type: 'target', weight_kg: '', reps: '' }],
        });
        closePicker();
        render();
      });
    });
  }

  function closePicker(): void {
    el.querySelector('#exercise-picker')?.classList.add('hidden');
    (el.querySelector('#exercise-search') as HTMLInputElement | null)?.value && ((el.querySelector('#exercise-search') as HTMLInputElement).value = '');
  }

  async function handleSave(): Promise<void> {
    const name = (el.querySelector('#session-name') as HTMLInputElement).value.trim();
    const date = (el.querySelector('#session-date') as HTMLInputElement).value;
    const notes = (el.querySelector('#session-notes') as HTMLTextAreaElement).value.trim() || null;
    const errEl = el.querySelector('#save-error') as HTMLElement;

    errEl.classList.add('hidden');

    if (!name) { showError('Inserisci un nome per la sessione.'); return; }
    if (!date) { showError('Seleziona una data.'); return; }
    if (exercises.length === 0) { showError('Aggiungi almeno un esercizio.'); return; }

    saving = true;
    render();

    try {
      await saveHistoricalSession({
        date,
        name,
        notes,
        templateId: null,
        exercises: exercises.map(ex => ({
          exercise_name: ex.exercise_name.trim() || 'Esercizio',
          category: ex.category,
          sets: ex.sets.map(s => ({
            weight_kg: parseFloat(s.weight_kg.replace(',', '.')) || null,
            reps: parseInt(s.reps) || null,
            set_type: s.set_type,
          })),
        })),
      });
      navigate('/workouts');
    } catch (e: unknown) {
      saving = false;
      showError((e as Error)?.message ?? 'Impossibile salvare la sessione.');
      render();
    }
  }

  function showError(msg: string): void {
    const errEl = el.querySelector('#save-error') as HTMLElement;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  render();
  return el;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
