import {
  getGlobalStats,
  getPersonalRecords,
  getExerciseVolumeSummary,
  getWeeklyFrequency,
} from '@/repository/workouts';
import { getBodyWeightLogs, upsertBodyWeightLog, deleteBodyWeightLog } from '@/repository/health';
import type { ExercisePR, ExerciseVolume, BodyWeightLog } from '@/types';

export async function renderProgress(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  el.innerHTML = `
    <h1 class="page-header">Progressi</h1>
    <div id="progress-content">
      <div class="flex items-center justify-center h-40"><div class="spinner"></div></div>
    </div>
  `;

  loadProgress(el.querySelector('#progress-content') as HTMLElement);
  return el;
}

async function loadProgress(container: HTMLElement): Promise<void> {
  try {
    const [stats, prs, volumes, weeklyFreq, weightLogs] = await Promise.all([
      getGlobalStats(),
      getPersonalRecords(),
      getExerciseVolumeSummary(),
      getWeeklyFrequency(),
      getBodyWeightLogs(),
    ]);

    container.innerHTML = `
      <!-- Global stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="stat-card"><div class="stat-value">${stats.totalSessions}</div><div class="stat-label">Sessioni</div></div>
        <div class="stat-card"><div class="stat-value">${formatVolume(stats.totalVolumeKg)}</div><div class="stat-label">Volume totale</div></div>
        <div class="stat-card"><div class="stat-value">${stats.currentStreak} 🔥</div><div class="stat-label">Streak</div></div>
        <div class="stat-card"><div class="stat-value">${weeklyFreq.toFixed(1)}</div><div class="stat-label">Sessioni / sett.</div></div>
      </div>

      <!-- Body weight -->
      <div class="card mb-4">
        <h2 class="section-title">Peso corporeo</h2>
        <div id="weight-form" class="flex gap-2 mb-4">
          <input id="weight-date" type="date" class="input w-36" value="${new Date().toISOString().slice(0, 10)}" />
          <input id="weight-value" type="number" step="0.1" class="input w-24" placeholder="kg" />
          <select id="weight-phase" class="input w-28">
            <option value="">— fase —</option>
            <option value="bulk">Bulk</option>
            <option value="cut">Cut</option>
          </select>
          <button id="save-weight-btn" class="btn-primary shrink-0">Salva</button>
        </div>
        <div id="weight-list">
          ${weightLogs.length === 0
            ? '<p class="text-zinc-500 text-sm">Nessun log.</p>'
            : `<div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
                ${weightLogs.slice(0, 20).map(w => weightRow(w)).join('')}
               </div>`
          }
        </div>
      </div>

      <!-- PRs -->
      <div class="card mb-4">
        <h2 class="section-title">Record personali</h2>
        ${prs.length === 0
          ? '<p class="text-zinc-500 text-sm">Nessun record ancora.</p>'
          : `<div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
              ${prs.map(pr => prRow(pr)).join('')}
             </div>`
        }
      </div>

      <!-- Volume by exercise -->
      <div class="card">
        <h2 class="section-title">Volume per esercizio</h2>
        ${volumes.length === 0
          ? '<p class="text-zinc-500 text-sm">Nessun dato.</p>'
          : `<div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
              ${volumes.map(v => volumeRow(v)).join('')}
             </div>`
        }
      </div>
    `;

    // Save weight
    container.querySelector('#save-weight-btn')?.addEventListener('click', async () => {
      const date = (container.querySelector('#weight-date') as HTMLInputElement).value;
      const value = parseFloat((container.querySelector('#weight-value') as HTMLInputElement).value);
      const phase = (container.querySelector('#weight-phase') as HTMLSelectElement).value as 'bulk' | 'cut' | '';
      if (!date || isNaN(value)) return;
      await upsertBodyWeightLog(date, value, null, phase || null);
      await refreshWeightList(container);
    });

    // Delete weight
    bindWeightDelete(container);

  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-sm">Errore: ${err}</p>`;
  }
}

async function refreshWeightList(container: HTMLElement): Promise<void> {
  const logs = await getBodyWeightLogs();
  const listEl = container.querySelector('#weight-list') as HTMLElement;
  if (logs.length === 0) {
    listEl.innerHTML = '<p class="text-zinc-500 text-sm">Nessun log.</p>';
    return;
  }
  listEl.innerHTML = `
    <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
      ${logs.slice(0, 20).map(w => weightRow(w)).join('')}
    </div>
  `;
  bindWeightDelete(container);
}

function bindWeightDelete(container: HTMLElement): void {
  container.querySelectorAll('.delete-weight-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteBodyWeightLog(Number((btn as HTMLElement).dataset['id']));
      await refreshWeightList(container);
    });
  });
}

function weightRow(w: BodyWeightLog): string {
  const phase = w.phase ? `<span class="badge-zinc ml-2">${w.phase}</span>` : '';
  return `
    <div class="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
      <div class="flex items-center gap-2">
        <span class="text-sm text-zinc-400">${w.date}</span>
        <span class="font-medium text-zinc-100">${w.weight_kg} kg</span>
        ${phase}
      </div>
      <button class="delete-weight-btn btn-ghost text-xs text-red-400" data-id="${w.id}">✕</button>
    </div>
  `;
}

function prRow(pr: ExercisePR): string {
  const date = pr.achieved_at ? new Date(pr.achieved_at).toLocaleDateString('it-IT') : '';
  return `
    <div class="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
      <span class="text-sm text-zinc-200">${pr.exercise_name}</span>
      <div class="flex items-center gap-2">
        <span class="font-semibold text-brand-400">${pr.max_weight_kg} kg</span>
        ${pr.reps_at_max ? `<span class="text-xs text-zinc-500">× ${pr.reps_at_max}</span>` : ''}
        <span class="text-xs text-zinc-600">${date}</span>
      </div>
    </div>
  `;
}

function volumeRow(v: ExerciseVolume): string {
  return `
    <div class="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
      <span class="text-sm text-zinc-200">${v.exercise_name}</span>
      <div class="flex items-center gap-3 text-xs text-zinc-500">
        <span>${v.total_sets} set</span>
        <span>${v.total_reps} reps</span>
        <span class="text-brand-400 font-medium">${formatVolume(v.total_volume_kg)}</span>
      </div>
    </div>
  `;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return (kg / 1000).toFixed(1) + 't';
  return kg.toFixed(0) + ' kg';
}
