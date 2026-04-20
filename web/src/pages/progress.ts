import {
  getGlobalStats,
  getPersonalRecords,
  getExerciseVolumeSummary,
  getWeeklyFrequency,
} from '@/repository/workouts';
import type { ExercisePR, ExerciseVolume } from '@/types';

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
    const [stats, prs, volumes, weeklyFreq] = await Promise.all([
      getGlobalStats(),
      getPersonalRecords(),
      getExerciseVolumeSummary(),
      getWeeklyFrequency(),
    ]);

    container.innerHTML = `
      <!-- Global stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="stat-card"><div class="stat-value">${stats.totalSessions}</div><div class="stat-label">Sessioni</div></div>
        <div class="stat-card"><div class="stat-value">${formatVolume(stats.totalVolumeKg)}</div><div class="stat-label">Volume totale</div></div>
        <div class="stat-card"><div class="stat-value">${stats.currentStreak} 🔥</div><div class="stat-label">Streak</div></div>
        <div class="stat-card"><div class="stat-value">${weeklyFreq.toFixed(1)}</div><div class="stat-label">Sessioni / sett.</div></div>
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

  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-sm">Errore: ${err}</p>`;
  }
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
