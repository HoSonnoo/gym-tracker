import { getExercises, addExercise, updateExercise, deleteExercise } from '@/repository/exercises';
import type { Exercise } from '@/types';

const CATEGORIES = [
  'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti',
  'Gambe', 'Glutei', 'Addome', 'Cardio', 'Altro',
];

export async function renderExercises(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-zinc-100">Esercizi</h1>
    </div>

    <!-- Add form -->
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

    <!-- Search -->
    <div class="mb-4">
      <input id="ex-search" type="text" class="input" placeholder="Cerca esercizio…" />
    </div>

    <!-- List -->
    <div id="ex-list">
      <div class="flex items-center justify-center h-32"><div class="spinner"></div></div>
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

  let exercises: Exercise[] = [];
  let renamingId: number | null = null;

  async function load(): Promise<void> {
    exercises = await getExercises();
    renderList();
  }

  function renderList(): void {
    const search = (el.querySelector('#ex-search') as HTMLInputElement).value.toLowerCase();
    const filtered = exercises.filter(e =>
      e.name.toLowerCase().includes(search) ||
      (e.category ?? '').toLowerCase().includes(search)
    );

    const listEl = el.querySelector('#ex-list') as HTMLElement;

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <p>${search ? 'Nessun risultato.' : 'Nessun esercizio. Aggiungine uno.'}</p>
        </div>
      `;
      return;
    }

    // Group by category
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

    // Rename buttons
    listEl.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        const name = (btn as HTMLElement).dataset['name'] ?? '';
        renamingId = id;
        (el.querySelector('#rename-input') as HTMLInputElement).value = name;
        el.querySelector('#rename-modal')?.classList.remove('hidden');
        (el.querySelector('#rename-input') as HTMLInputElement).focus();
      });
    });

    // Delete buttons
    listEl.querySelectorAll('.delete-ex-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminare questo esercizio?')) return;
        await deleteExercise(Number((btn as HTMLElement).dataset['id']));
        await load();
      });
    });
  }

  // Add exercise
  el.querySelector('#add-ex-btn')?.addEventListener('click', async () => {
    const name = (el.querySelector('#ex-name') as HTMLInputElement).value.trim();
    const category = (el.querySelector('#ex-category') as HTMLSelectElement).value || null;
    const errEl = el.querySelector('#ex-error') as HTMLElement;
    errEl.classList.add('hidden');

    try {
      await addExercise(name, category);
      (el.querySelector('#ex-name') as HTMLInputElement).value = '';
      (el.querySelector('#ex-category') as HTMLSelectElement).value = '';
      await load();
    } catch (err: unknown) {
      errEl.textContent = err instanceof Error ? err.message : 'Errore.';
      errEl.classList.remove('hidden');
    }
  });

  // Enter key on name input
  (el.querySelector('#ex-name') as HTMLInputElement).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (el.querySelector('#add-ex-btn') as HTMLButtonElement).click();
  });

  // Search
  (el.querySelector('#ex-search') as HTMLInputElement).addEventListener('input', renderList);

  // Rename modal
  el.querySelector('#rename-confirm')?.addEventListener('click', async () => {
    if (renamingId === null) return;
    const newName = (el.querySelector('#rename-input') as HTMLInputElement).value.trim();
    if (!newName) return;
    await updateExercise(renamingId, newName);
    renamingId = null;
    el.querySelector('#rename-modal')?.classList.add('hidden');
    await load();
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

  await load();
  return el;
}
