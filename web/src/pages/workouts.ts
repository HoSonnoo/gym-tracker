import { getWorkoutTemplates, addWorkoutTemplate, deleteWorkoutTemplate } from '@/repository/workouts';
import { getExercises, addExercise, updateExercise, deleteExercise } from '@/repository/exercises';
import { navigate } from '@/router';
import type { WorkoutTemplate, Exercise } from '@/types';

const CATEGORIES = [
  'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti',
  'Gambe', 'Glutei', 'Addome', 'Cardio', 'Altro',
];

export async function renderWorkouts(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  el.innerHTML = `
    <h1 class="text-2xl font-bold text-zinc-100 mb-5">Allenamenti</h1>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 bg-[#222834] rounded-lg p-1 w-fit">
      <button id="tab-templates" class="tab-btn px-4 py-1.5 text-sm font-medium rounded-md bg-[#2C3442] text-zinc-100 transition-all">Template</button>
      <button id="tab-exercises" class="tab-btn px-4 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-100 transition-all">Esercizi</button>
    </div>

    <!-- ── TEMPLATES SECTION ── -->
    <div id="section-templates">
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-zinc-400">I tuoi template</span>
        <button id="new-template-btn" class="btn-primary text-sm">+ Nuovo template</button>
      </div>

      <div id="new-template-form" class="card mb-5 hidden">
        <h2 class="section-title">Nuovo template</h2>
        <div class="flex flex-col gap-3">
          <div>
            <label class="label">Nome</label>
            <input id="template-name" type="text" class="input" placeholder="Es. Push A, Legs, Full Body…" />
          </div>
          <div>
            <label class="label">Note (opzionale)</label>
            <input id="template-notes" type="text" class="input" placeholder="Note sul template" />
          </div>
          <p id="template-error" class="text-red-400 text-sm hidden"></p>
          <div class="flex gap-2">
            <button id="save-template-btn" class="btn-primary">Salva</button>
            <button id="cancel-template-btn" class="btn-secondary">Annulla</button>
          </div>
        </div>
      </div>

      <div id="templates-list">
        <div class="flex items-center justify-center h-32"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- ── EXERCISES SECTION ── -->
    <div id="section-exercises" class="hidden">
      <div class="card mb-5">
        <h2 class="section-title">Nuovo esercizio</h2>
        <div class="flex gap-3 flex-wrap">
          <div class="flex-1 min-w-[160px]">
            <label class="label">Nome</label>
            <input id="ex-name" type="text" class="input" placeholder="Es. Panca piana" />
          </div>
          <div class="flex-1 min-w-[140px]">
            <label class="label">Categoria</label>
            <select id="ex-category" class="input">
              <option value="">— nessuna —</option>
              ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <p id="ex-error" class="text-red-400 text-sm hidden mt-2"></p>
        <button id="add-ex-btn" class="btn-primary mt-3">Aggiungi</button>
      </div>

      <div class="mb-4">
        <input id="ex-search" type="text" class="input" placeholder="Cerca esercizio…" />
      </div>

      <div id="ex-list">
        <div class="flex items-center justify-center h-32"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Rename modal -->
    <div id="rename-modal" class="hidden fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-sm">
        <h3 class="font-semibold text-zinc-100 mb-3">Rinomina esercizio</h3>
        <input id="rename-input" type="text" class="input mb-3" />
        <div class="flex gap-2">
          <button id="rename-confirm" class="btn-primary flex-1">Salva</button>
          <button id="rename-cancel" class="btn-secondary flex-1">Annulla</button>
        </div>
      </div>
    </div>
  `;

  // ── Tab logic ──────────────────────────────────────────────────────────────
  const tabTemplates = el.querySelector('#tab-templates') as HTMLButtonElement;
  const tabExercises = el.querySelector('#tab-exercises') as HTMLButtonElement;
  const sectionTemplates = el.querySelector('#section-templates') as HTMLElement;
  const sectionExercises = el.querySelector('#section-exercises') as HTMLElement;

  const activeTab = 'px-4 py-1.5 text-sm font-medium rounded-md bg-[#2C3442] text-zinc-100 transition-all';
  const inactiveTab = 'px-4 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-100 transition-all';

  tabTemplates.addEventListener('click', () => {
    tabTemplates.className = activeTab;
    tabExercises.className = inactiveTab;
    sectionTemplates.classList.remove('hidden');
    sectionExercises.classList.add('hidden');
  });

  tabExercises.addEventListener('click', async () => {
    tabExercises.className = activeTab;
    tabTemplates.className = inactiveTab;
    sectionExercises.classList.remove('hidden');
    sectionTemplates.classList.add('hidden');
    await loadExercises();
  });

  // ── Templates ──────────────────────────────────────────────────────────────
  const listContainer = el.querySelector('#templates-list') as HTMLElement;
  const newBtn = el.querySelector('#new-template-btn') as HTMLButtonElement;
  const form = el.querySelector('#new-template-form') as HTMLElement;
  const cancelBtn = el.querySelector('#cancel-template-btn') as HTMLButtonElement;
  const saveBtn = el.querySelector('#save-template-btn') as HTMLButtonElement;
  const errorEl = el.querySelector('#template-error') as HTMLElement;

  newBtn.addEventListener('click', () => form.classList.toggle('hidden'));

  cancelBtn.addEventListener('click', () => {
    form.classList.add('hidden');
    (el.querySelector('#template-name') as HTMLInputElement).value = '';
    (el.querySelector('#template-notes') as HTMLInputElement).value = '';
    errorEl.classList.add('hidden');
  });

  saveBtn.addEventListener('click', async () => {
    const name = (el.querySelector('#template-name') as HTMLInputElement).value.trim();
    const notes = (el.querySelector('#template-notes') as HTMLInputElement).value.trim() || null;
    errorEl.classList.add('hidden');
    if (!name) {
      errorEl.textContent = 'Inserisci il nome del template.';
      errorEl.classList.remove('hidden');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvataggio…';
    try {
      await addWorkoutTemplate(name, notes);
      form.classList.add('hidden');
      (el.querySelector('#template-name') as HTMLInputElement).value = '';
      (el.querySelector('#template-notes') as HTMLInputElement).value = '';
      await loadTemplates(listContainer);
    } catch (err: unknown) {
      errorEl.textContent = err instanceof Error ? err.message : 'Errore.';
      errorEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salva';
    }
  });

  await loadTemplates(listContainer);

  // ── Exercises ──────────────────────────────────────────────────────────────
  let exercises: Exercise[] = [];
  let renamingId: number | null = null;

  async function loadExercises(): Promise<void> {
    exercises = await getExercises();
    renderExerciseList();
  }

  function renderExerciseList(): void {
    const search = (el.querySelector('#ex-search') as HTMLInputElement)?.value.toLowerCase() ?? '';
    const filtered = exercises.filter(e =>
      e.name.toLowerCase().includes(search) ||
      (e.category ?? '').toLowerCase().includes(search)
    );
    const listEl = el.querySelector('#ex-list') as HTMLElement;

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><p>${search ? 'Nessun risultato.' : 'Nessun esercizio.'}</p></div>`;
      return;
    }

    const grouped: Record<string, Exercise[]> = {};
    for (const ex of filtered) {
      const cat = ex.category ?? 'Senza categoria';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ex);
    }

    listEl.innerHTML = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, exs]) => `
      <div class="mb-4">
        <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">${cat}</h3>
        <div class="card p-0 overflow-hidden">
          ${exs.map((ex, i) => `
            <div class="flex items-center justify-between px-4 py-3 ${i < exs.length - 1 ? 'border-b border-[#2C3442]' : ''}">
              <span class="text-sm text-zinc-200">${ex.name}</span>
              <div class="flex gap-1">
                <button class="rename-btn btn-ghost text-xs px-2 py-1" data-id="${ex.id}" data-name="${ex.name}">Rinomina</button>
                <button class="delete-ex-btn btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-300" data-id="${ex.id}">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        renamingId = Number((btn as HTMLElement).dataset['id']);
        (el.querySelector('#rename-input') as HTMLInputElement).value = (btn as HTMLElement).dataset['name'] ?? '';
        el.querySelector('#rename-modal')?.classList.remove('hidden');
        (el.querySelector('#rename-input') as HTMLInputElement).focus();
      });
    });

    listEl.querySelectorAll('.delete-ex-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminare questo esercizio?')) return;
        await deleteExercise(Number((btn as HTMLElement).dataset['id']));
        await loadExercises();
      });
    });
  }

  el.querySelector('#add-ex-btn')?.addEventListener('click', async () => {
    const name = (el.querySelector('#ex-name') as HTMLInputElement).value.trim();
    const category = (el.querySelector('#ex-category') as HTMLSelectElement).value || null;
    const errEl = el.querySelector('#ex-error') as HTMLElement;
    errEl.classList.add('hidden');
    try {
      await addExercise(name, category);
      (el.querySelector('#ex-name') as HTMLInputElement).value = '';
      (el.querySelector('#ex-category') as HTMLSelectElement).value = '';
      await loadExercises();
    } catch (err: unknown) {
      errEl.textContent = err instanceof Error ? err.message : 'Errore.';
      errEl.classList.remove('hidden');
    }
  });

  (el.querySelector('#ex-name') as HTMLInputElement)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (el.querySelector('#add-ex-btn') as HTMLButtonElement).click();
  });

  el.querySelector('#ex-search')?.addEventListener('input', renderExerciseList);

  el.querySelector('#rename-confirm')?.addEventListener('click', async () => {
    if (renamingId === null) return;
    const newName = (el.querySelector('#rename-input') as HTMLInputElement).value.trim();
    if (!newName) return;
    await updateExercise(renamingId, newName);
    renamingId = null;
    el.querySelector('#rename-modal')?.classList.add('hidden');
    await loadExercises();
  });

  el.querySelector('#rename-cancel')?.addEventListener('click', () => {
    renamingId = null;
    el.querySelector('#rename-modal')?.classList.add('hidden');
  });

  el.querySelector('#rename-modal')?.addEventListener('click', (e) => {
    if (e.target === el.querySelector('#rename-modal')) {
      renamingId = null;
      el.querySelector('#rename-modal')?.classList.add('hidden');
    }
  });

  return el;
}

async function loadTemplates(container: HTMLElement): Promise<void> {
  try {
    const templates = await getWorkoutTemplates();
    if (templates.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <p>Nessun template. Creane uno per iniziare.</p>
        </div>`;
      return;
    }
    container.innerHTML = `<div class="flex flex-col gap-3">${templates.map(t => templateCard(t)).join('')}</div>`;

    container.querySelectorAll('.open-template-btn').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/template?id=${(btn as HTMLElement).dataset['id']}`));
    });
    container.querySelectorAll('.start-session-btn').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/workout-session?template=${(btn as HTMLElement).dataset['id']}`));
    });
    container.querySelectorAll('.delete-template-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminare questo template?')) return;
        await deleteWorkoutTemplate(Number((btn as HTMLElement).dataset['id']));
        await loadTemplates(container);
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-sm">Errore: ${err}</p>`;
  }
}

function templateCard(t: WorkoutTemplate): string {
  const date = new Date(t.created_at).toLocaleDateString('it-IT');
  return `
    <div class="card flex items-center justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="font-medium text-zinc-100 truncate">${t.name}</p>
        ${t.notes ? `<p class="text-xs text-zinc-500 truncate mt-0.5">${t.notes}</p>` : ''}
        <p class="text-xs text-zinc-600 mt-1">${date}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="open-template-btn btn-secondary text-xs" data-id="${t.id}">Modifica</button>
        <button class="start-session-btn btn-primary text-xs" data-id="${t.id}">▶ Avvia</button>
        <button class="delete-template-btn btn-ghost text-xs text-red-400 hover:text-red-300" data-id="${t.id}">✕</button>
      </div>
    </div>`;
}
