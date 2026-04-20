import {
  getTemplateExercises,
  getTemplateExerciseSets,
  addTemplateExerciseSet,
  updateTemplateExerciseSet,
  deleteTemplateExerciseSet,
} from '@/repository/workouts';
import { navigate } from '@/router';
import type { TemplateExercise, TemplateExerciseSet } from '@/types';

function getHashParam(key: string): string | null {
  const hash = window.location.hash;
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return null;
  return new URLSearchParams(hash.slice(qIdx + 1)).get(key);
}

export async function renderTemplateExercise(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-2xl mx-auto';

  const teId       = Number(getHashParam('id'));
  const templateId = Number(getHashParam('template'));

  if (!teId || isNaN(teId)) {
    el.innerHTML = `<p class="text-red-400">ID esercizio non valido.</p>`;
    return el;
  }

  let exercise: TemplateExercise | null = null;
  let sets: TemplateExerciseSet[] = [];

  function escHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function loadData(): Promise<void> {
    if (templateId) {
      const allTe = await getTemplateExercises(templateId);
      exercise = allTe.find(te => te.id === teId) ?? null;
    }
    sets = await getTemplateExerciseSets(teId);
    render();
  }

  function render(): void {
    el.innerHTML = `
      <button id="back-btn" class="btn-secondary text-xs mb-4">← Indietro</button>

      <div class="flex items-start justify-between mb-5">
        <div>
          <h1 class="text-xl font-bold text-zinc-100">${escHtml(exercise?.exercise_name ?? 'Esercizio')}</h1>
          ${exercise?.exercise_category ? `<p class="text-xs text-zinc-500 mt-0.5">${escHtml(exercise.exercise_category)}</p>` : ''}
        </div>
      </div>

      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">Serie</h2>
          <div class="flex gap-2">
            <button id="add-warmup-btn" class="btn-secondary text-xs">+ Riscaldamento</button>
            <button id="add-target-btn" class="btn-primary text-xs">+ Lavoro</button>
          </div>
        </div>

        ${sets.length === 0 ? `
          <p class="text-zinc-500 text-sm">Nessuna serie. Aggiungine una.</p>
        ` : `
          <div class="flex flex-col gap-2" id="sets-container">
            ${sets.map((s, i) => setRow(s, i)).join('')}
          </div>
        `}
      </div>

      <p class="text-xs text-zinc-600">Le modifiche vengono salvate automaticamente alla perdita del focus.</p>
    `;

    bindEvents();
  }

  function setRow(s: TemplateExerciseSet, i: number): string {
    const isWarmup = s.set_type === 'warmup';
    return `
      <div class="rounded-xl border border-[#2C3442] p-3 ${isWarmup ? 'bg-[#1a1d24]' : 'bg-[#181C23]'}" data-set-id="${s.id}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold ${isWarmup ? 'text-zinc-500' : 'text-brand-400'}">
            ${isWarmup ? `Riscaldamento ${i + 1}` : `Serie ${i + 1}`}
          </span>
          <button class="delete-set-btn btn-ghost text-xs text-red-400" data-id="${s.id}">✕</button>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="label text-xs">Peso (kg)</label>
            <input type="number" step="0.5" min="0" class="input text-sm py-1.5 set-weight" data-id="${s.id}" value="${s.weight_kg ?? ''}" placeholder="—" />
          </div>
          <div>
            <label class="label text-xs">Reps min</label>
            <input type="number" min="0" class="input text-sm py-1.5 set-reps-min" data-id="${s.id}" value="${s.reps_min ?? ''}" placeholder="—" />
          </div>
          <div>
            <label class="label text-xs">Reps max</label>
            <input type="number" min="0" class="input text-sm py-1.5 set-reps-max" data-id="${s.id}" value="${s.reps_max ?? ''}" placeholder="—" />
          </div>
          <div>
            <label class="label text-xs">Recupero (sec)</label>
            <input type="number" min="0" class="input text-sm py-1.5 set-rest" data-id="${s.id}" value="${s.rest_seconds ?? ''}" placeholder="—" />
          </div>
          <div>
            <label class="label text-xs">Note</label>
            <input type="text" class="input text-sm py-1.5 set-notes" data-id="${s.id}" value="${escHtml(s.notes ?? '')}" placeholder="—" />
          </div>
        </div>
      </div>
    `;
  }

  function getSetData(id: number): Parameters<typeof updateTemplateExerciseSet>[1] {
    const weightEl   = el.querySelector(`.set-weight[data-id="${id}"]`)   as HTMLInputElement | null;
    const repsMinEl  = el.querySelector(`.set-reps-min[data-id="${id}"]`) as HTMLInputElement | null;
    const repsMaxEl  = el.querySelector(`.set-reps-max[data-id="${id}"]`) as HTMLInputElement | null;
    const restEl     = el.querySelector(`.set-rest[data-id="${id}"]`)     as HTMLInputElement | null;
    const notesEl    = el.querySelector(`.set-notes[data-id="${id}"]`)    as HTMLInputElement | null;
    const s = sets.find(x => x.id === id);
    return {
      set_type:     s?.set_type     ?? 'target',
      weight_kg:    weightEl?.value  ? parseFloat(weightEl.value)  : null,
      reps_min:     repsMinEl?.value ? parseInt(repsMinEl.value)   : null,
      reps_max:     repsMaxEl?.value ? parseInt(repsMaxEl.value)   : null,
      rest_seconds: restEl?.value    ? parseInt(restEl.value)      : null,
      effort_type:  s?.effort_type  ?? 'none',
      buffer_value: s?.buffer_value ?? null,
      notes:        notesEl?.value?.trim() || null,
    };
  }

  function bindEvents(): void {
    el.querySelector('#back-btn')?.addEventListener('click', () => {
      if (templateId) navigate(`/template?id=${templateId}`);
      else navigate('/workouts');
    });

    el.querySelector('#add-warmup-btn')?.addEventListener('click', async () => {
      await addTemplateExerciseSet(teId, 'warmup');
      sets = await getTemplateExerciseSets(teId);
      render();
    });

    el.querySelector('#add-target-btn')?.addEventListener('click', async () => {
      await addTemplateExerciseSet(teId, 'target');
      sets = await getTemplateExerciseSets(teId);
      render();
    });

    el.querySelectorAll('.delete-set-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number((btn as HTMLElement).dataset['id']);
        await deleteTemplateExerciseSet(id);
        sets = await getTemplateExerciseSets(teId);
        render();
      });
    });

    // Auto-save on blur for all inputs
    el.querySelectorAll('.set-weight, .set-reps-min, .set-reps-max, .set-rest, .set-notes').forEach(input => {
      input.addEventListener('blur', async () => {
        const id = Number((input as HTMLElement).dataset['id']);
        await updateTemplateExerciseSet(id, getSetData(id));
      });
    });
  }

  el.innerHTML = `<div class="flex items-center justify-center h-40"><div class="spinner"></div></div>`;
  await loadData();

  return el;
}
