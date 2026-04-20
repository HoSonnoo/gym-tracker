import { getWorkoutTemplates, addWorkoutTemplate, deleteWorkoutTemplate } from '@/repository/workouts';
import { navigate } from '@/router';
import type { WorkoutTemplate } from '@/types';

export async function renderWorkouts(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-zinc-100">Allenamenti</h1>
      <button id="new-template-btn" class="btn-primary">+ Nuovo template</button>
    </div>

    <!-- New template form (hidden) -->
    <div id="new-template-form" class="card mb-6 hidden">
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
  `;

  const listContainer = el.querySelector('#templates-list') as HTMLElement;
  const newBtn = el.querySelector('#new-template-btn') as HTMLButtonElement;
  const form = el.querySelector('#new-template-form') as HTMLElement;
  const cancelBtn = el.querySelector('#cancel-template-btn') as HTMLButtonElement;
  const saveBtn = el.querySelector('#save-template-btn') as HTMLButtonElement;
  const errorEl = el.querySelector('#template-error') as HTMLElement;

  newBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
  });

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
      errorEl.textContent = err instanceof Error ? err.message : 'Errore sconosciuto.';
      errorEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salva';
    }
  });

  await loadTemplates(listContainer);
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
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="flex flex-col gap-3">
        ${templates.map(t => templateCard(t)).join('')}
      </div>
    `;

    // Bind events
    container.querySelectorAll('.open-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigate(`/template?id=${(btn as HTMLElement).dataset['id']}`);
      });
    });

    container.querySelectorAll('.start-session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigate(`/workout-session?template=${(btn as HTMLElement).dataset['id']}`);
      });
    });

    container.querySelectorAll('.delete-template-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        if (!confirm('Eliminare questo template?')) return;
        await deleteWorkoutTemplate(id);
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
    </div>
  `;
}
