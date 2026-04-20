import {
  getWorkoutTemplateById,
  updateWorkoutTemplate,
  getTemplateExercises,
  addExerciseToTemplate,
  removeExerciseFromTemplate,
  reorderTemplateExercises,
  setTemplateSuperset,
  clearTemplateSuperset,
} from '@/repository/workouts';
import { getExercises } from '@/repository/exercises';
import { navigate } from '@/router';
import type { TemplateExercise, Exercise } from '@/types';

function getHashParam(key: string): string | null {
  const hash = window.location.hash;
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return null;
  return new URLSearchParams(hash.slice(qIdx + 1)).get(key);
}

export async function renderTemplate(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  const templateId = Number(getHashParam('id'));
  if (!templateId || isNaN(templateId)) {
    el.innerHTML = `<p class="text-red-400">ID template non valido.</p>`;
    return el;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let templateExercises: TemplateExercise[] = [];
  let allExercises: Exercise[] = [];
  let supersetTarget: TemplateExercise | null = null;
  let exerciseSearch = '';
  let isEditing = false;

  // ── Load data ──────────────────────────────────────────────────────────────
  async function loadAll(): Promise<void> {
    const [tmpl, texs, exs] = await Promise.allSettled([
      getWorkoutTemplateById(templateId),
      getTemplateExercises(templateId),
      getExercises(),
    ]);
    if (tmpl.status === 'fulfilled' && tmpl.value) {
      templateData.name  = tmpl.value.name;
      templateData.notes = tmpl.value.notes ?? '';
    }
    if (texs.status === 'fulfilled') templateExercises = texs.value;
    if (exs.status === 'fulfilled')  allExercises       = exs.value;
    render();
  }

  const templateData = { name: '', notes: '' };

  // ── Render ─────────────────────────────────────────────────────────────────
  function render(): void {
    const filtered = allExercises.filter(e =>
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      (e.category ?? '').toLowerCase().includes(exerciseSearch.toLowerCase())
    );

    el.innerHTML = `
      <!-- Back button -->
      <button id="back-btn" class="btn-secondary text-xs mb-4">← Indietro</button>

      <!-- Template header -->
      ${isEditing ? `
        <div class="card mb-6">
          <div class="flex flex-col gap-3">
            <div>
              <label class="label">Nome</label>
              <input id="edit-name" type="text" class="input" value="${escHtml(templateData.name)}" />
            </div>
            <div>
              <label class="label">Note (opzionale)</label>
              <input id="edit-notes" type="text" class="input" value="${escHtml(templateData.notes)}" />
            </div>
            <div class="flex gap-2">
              <button id="save-edit-btn" class="btn-primary">Salva</button>
              <button id="cancel-edit-btn" class="btn-secondary">Annulla</button>
            </div>
          </div>
        </div>
      ` : `
        <div class="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-zinc-100">${escHtml(templateData.name)}</h1>
            ${templateData.notes ? `<p class="text-sm text-zinc-500 mt-1">${escHtml(templateData.notes)}</p>` : ''}
          </div>
          <button id="edit-header-btn" class="btn-secondary text-xs shrink-0">Modifica</button>
        </div>
      `}

      <!-- Template exercises -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">Esercizi del template</h2>
          <span class="text-xs text-zinc-500">${templateExercises.length} esercizi</span>
        </div>
        ${templateExercises.length === 0 ? `
          <div class="card text-center py-8">
            <p class="text-zinc-400 text-sm">Nessun esercizio. Aggiungine uno dalla sezione qui sotto.</p>
          </div>
        ` : `
          <div class="flex flex-col gap-2" id="exercise-list">
            ${templateExercises.map((te, i) => templateExerciseRow(te, i, templateExercises.length)).join('')}
          </div>
          <p class="text-xs text-zinc-600 mt-2">💡 Usa le frecce per riordinare. Tocca <strong class="text-zinc-500">Configura</strong> per impostare serie e peso target.</p>
        `}
      </div>

      <!-- Superset modal -->
      <div id="ss-modal" class="${supersetTarget ? '' : 'hidden'} fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
        <div class="card w-full max-w-lg rounded-2xl p-6 mb-2">
          <h3 class="text-lg font-bold text-zinc-100 mb-1">Abbina super serie</h3>
          <p class="text-sm text-zinc-400 mb-4">Scegli l'esercizio da abbinare con <strong class="text-zinc-200">${escHtml(supersetTarget?.exercise_name ?? '')}</strong>:</p>
          ${templateExercises
            .filter(e => e.id !== supersetTarget?.id && e.superset_group_id == null)
            .length === 0
            ? `<p class="text-zinc-500 text-sm mb-4">Nessun esercizio disponibile da abbinare.</p>`
            : `<div class="flex flex-col gap-2 mb-4">
                ${templateExercises
                  .filter(e => e.id !== supersetTarget?.id && e.superset_group_id == null)
                  .map(e => `
                    <button class="ss-pick-btn flex items-center justify-between px-4 py-3 card hover:bg-[#2C3442]/60 transition-all" data-id="${e.id}">
                      <div>
                        <p class="text-sm font-semibold text-zinc-100">${escHtml(e.exercise_name)}</p>
                        <p class="text-xs text-zinc-500">${escHtml(e.exercise_category ?? 'Nessuna categoria')}</p>
                      </div>
                      <span class="text-xs font-bold text-yellow-400 border border-yellow-600/50 bg-yellow-950/30 rounded-lg px-2 py-1">Abbina</span>
                    </button>
                  `).join('')}
              </div>`
          }
          <button id="close-ss-modal" class="btn-secondary w-full">Annulla</button>
        </div>
      </div>

      <!-- Add from catalog -->
      <div>
        <h2 class="section-title mb-3">Aggiungi dal catalogo</h2>
        <div class="mb-3">
          <input id="catalog-search" type="text" class="input" placeholder="Cerca esercizio…" value="${escHtml(exerciseSearch)}" />
        </div>
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <p>${exerciseSearch ? 'Nessun risultato.' : 'Nessun esercizio nel catalogo. Creane uno nella sezione Allenamenti → Esercizi.'}</p>
          </div>
        ` : `
          <div class="flex flex-col gap-2">
            ${filtered.map(ex => catalogRow(ex)).join('')}
          </div>
        `}
      </div>
    `;

    bindEvents();
  }

  function templateExerciseRow(te: TemplateExercise, i: number, total: number): string {
    const isSuperset = te.superset_group_id != null;
    const partner = isSuperset
      ? templateExercises.find(e => e.superset_group_id === te.superset_group_id && e.id !== te.id)
      : null;

    return `
      <div class="card flex items-center gap-3 ${isSuperset ? 'border-l-2 border-yellow-500' : ''}">
        <div class="flex flex-col gap-1 shrink-0">
          <button class="move-up-btn btn-ghost text-xs px-1.5 py-0.5 ${i === 0 ? 'opacity-20 cursor-not-allowed' : ''}" data-id="${te.id}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <span class="text-xs font-bold text-brand-400 text-center">${i + 1}</span>
          <button class="move-down-btn btn-ghost text-xs px-1.5 py-0.5 ${i === total - 1 ? 'opacity-20 cursor-not-allowed' : ''}" data-id="${te.id}" ${i === total - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-semibold text-zinc-100">${escHtml(te.exercise_name)}</span>
            ${isSuperset ? `<span class="text-xs font-bold text-yellow-400 border border-yellow-600/50 bg-yellow-950/30 rounded px-1.5 py-0.5">SS</span>` : ''}
          </div>
          <span class="text-xs text-zinc-500">${escHtml(te.exercise_category ?? 'Nessuna categoria')}</span>
          ${isSuperset && partner ? `<p class="text-xs text-yellow-500 italic mt-0.5">con ${escHtml(partner.exercise_name)}</p>` : ''}
        </div>
        <div class="flex flex-col gap-1 shrink-0 items-end">
          <button class="configure-btn btn-secondary text-xs" data-id="${te.id}">Configura</button>
          ${isSuperset
            ? `<button class="clear-ss-btn text-xs font-semibold text-yellow-500 hover:text-yellow-300 px-2 py-1 transition-all" data-id="${te.id}">Rimuovi SS</button>`
            : `<button class="pair-ss-btn text-xs font-semibold text-yellow-600 hover:text-yellow-400 px-2 py-1 transition-all" data-id="${te.id}">Abbina SS</button>`
          }
          <button class="remove-te-btn btn-ghost text-xs text-red-400 hover:text-red-300" data-id="${te.id}">✕ Rimuovi</button>
        </div>
      </div>
    `;
  }

  function catalogRow(ex: Exercise): string {
    const alreadyIn = templateExercises.some(te => te.exercise_id === ex.id);
    return `
      <div class="card flex items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-zinc-100 truncate">${escHtml(ex.name)}</p>
          <p class="text-xs text-zinc-500">${escHtml(ex.category ?? 'Nessuna categoria')}</p>
        </div>
        <button class="add-ex-btn btn-primary text-xs shrink-0" data-id="${ex.id}" data-name="${escHtml(ex.name)}">
          ${alreadyIn ? '+ Aggiungi ancora' : '+ Aggiungi'}
        </button>
      </div>
    `;
  }

  function escHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Event binding ──────────────────────────────────────────────────────────
  function bindEvents(): void {
    el.querySelector('#back-btn')?.addEventListener('click', () => navigate('/workouts'));

    // Header edit
    el.querySelector('#edit-header-btn')?.addEventListener('click', () => { isEditing = true; render(); });
    el.querySelector('#cancel-edit-btn')?.addEventListener('click', () => { isEditing = false; render(); });
    el.querySelector('#save-edit-btn')?.addEventListener('click', async () => {
      const name  = (el.querySelector('#edit-name')  as HTMLInputElement).value.trim();
      const notes = (el.querySelector('#edit-notes') as HTMLInputElement).value.trim();
      if (!name) return;
      const btn = el.querySelector('#save-edit-btn') as HTMLButtonElement;
      btn.disabled = true; btn.textContent = 'Salvataggio…';
      try {
        await updateWorkoutTemplate(templateId, name, notes || null);
        templateData.name  = name;
        templateData.notes = notes;
        isEditing = false;
      } finally {
        render();
      }
    });

    // Move up/down
    el.querySelectorAll('.move-up-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        const idx = templateExercises.findIndex(te => te.id === id);
        if (idx <= 0) return;
        [templateExercises[idx - 1], templateExercises[idx]] = [templateExercises[idx], templateExercises[idx - 1]];
        const updated = templateExercises.map((te, i) => ({ ...te, exercise_order: i + 1 }));
        templateExercises = updated;
        render();
        await reorderTemplateExercises(updated.map(te => ({ id: te.id, exercise_order: te.exercise_order })));
      });
    });

    el.querySelectorAll('.move-down-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        const idx = templateExercises.findIndex(te => te.id === id);
        if (idx < 0 || idx >= templateExercises.length - 1) return;
        [templateExercises[idx], templateExercises[idx + 1]] = [templateExercises[idx + 1], templateExercises[idx]];
        const updated = templateExercises.map((te, i) => ({ ...te, exercise_order: i + 1 }));
        templateExercises = updated;
        render();
        await reorderTemplateExercises(updated.map(te => ({ id: te.id, exercise_order: te.exercise_order })));
      });
    });

    // Configure (opens exercise set editor)
    el.querySelectorAll('.configure-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        navigate(`/template-exercise?id=${id}&template=${templateId}`);
      });
    });

    // Remove from template
    el.querySelectorAll('.remove-te-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Rimuovere questo esercizio dal template?')) return;
        const id = Number((btn as HTMLElement).dataset['id']);
        await removeExerciseFromTemplate(id);
        templateExercises = templateExercises.filter(te => te.id !== id);
        render();
      });
    });

    // Superset pair
    el.querySelectorAll('.pair-ss-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        supersetTarget = templateExercises.find(te => te.id === id) ?? null;
        render();
      });
    });
    el.querySelector('#close-ss-modal')?.addEventListener('click', () => {
      supersetTarget = null; render();
    });
    el.querySelector('#ss-modal')?.addEventListener('click', e => {
      if (e.target === el.querySelector('#ss-modal')) { supersetTarget = null; render(); }
    });
    el.querySelectorAll('.ss-pick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!supersetTarget) return;
        const partnerId = Number((btn as HTMLElement).dataset['id']);
        await setTemplateSuperset(supersetTarget.id, partnerId);
        supersetTarget = null;
        templateExercises = await getTemplateExercises(templateId);
        render();
      });
    });

    // Clear superset
    el.querySelectorAll('.clear-ss-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        await clearTemplateSuperset(id);
        templateExercises = await getTemplateExercises(templateId);
        render();
      });
    });

    // Catalog search
    el.querySelector('#catalog-search')?.addEventListener('input', e => {
      exerciseSearch = (e.target as HTMLInputElement).value;
      render();
    });

    // Add exercise to template
    el.querySelectorAll('.add-ex-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const exId = Number((btn as HTMLElement).dataset['id']);
        (btn as HTMLButtonElement).disabled = true;
        (btn as HTMLButtonElement).textContent = 'Aggiunta…';
        try {
          await addExerciseToTemplate(templateId, exId);
          templateExercises = await getTemplateExercises(templateId);
          render();
        } catch (err) {
          alert('Errore: ' + (err instanceof Error ? err.message : String(err)));
          render();
        }
      });
    });
  }

  // ── Initial load ───────────────────────────────────────────────────────────
  el.innerHTML = `<div class="flex items-center justify-center h-40"><div class="spinner"></div></div>`;
  await loadAll();

  return el;
}
