import {
  getGlobalStats,
  getPersonalRecords,
  getExerciseVolumeSummary,
  getWeeklyFrequency,
  getWeeklyFrequencyHistory,
  getExerciseVolumeHistory,
  getPRHistoryByExercise,
  getExerciseNamesWithHistory,
} from '@/repository/workouts';
import type { ExercisePR, ExerciseVolume } from '@/types';
import {
  Chart,
  LineController, BarController,
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(
  LineController, BarController,
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Tooltip, Legend, Filler,
);

// Distrugge istanze Chart precedenti per evitare conflitti al re-render
const chartInstances = new Map<string, Chart>();
function destroyChart(id: string) {
  chartInstances.get(id)?.destroy();
  chartInstances.delete(id);
}

const BRAND = '#9066ff';
const BRAND_DIM = 'rgba(144, 102, 255, 0.15)';
const GRID_COLOR = 'rgba(44, 52, 66, 0.8)';
const TEXT_COLOR = '#a1a1aa';

const BASE_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#181C23',
      borderColor: '#2C3442',
      borderWidth: 1,
      titleColor: '#f4f4f5',
      bodyColor: '#a1a1aa',
    },
  },
  scales: {
    x: {
      grid: { color: GRID_COLOR },
      ticks: { color: TEXT_COLOR, maxTicksLimit: 8, maxRotation: 30 },
    },
    y: {
      grid: { color: GRID_COLOR },
      ticks: { color: TEXT_COLOR },
    },
  },
} as const;

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
    const [stats, prs, volumes, weeklyFreq, exerciseNames] = await Promise.all([
      getGlobalStats(),
      getPersonalRecords(),
      getExerciseVolumeSummary(),
      getWeeklyFrequency(),
      getExerciseNamesWithHistory(),
    ]);

    container.innerHTML = `
      <!-- Statistiche globali -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="stat-card"><div class="stat-value">${stats.totalSessions}</div><div class="stat-label">Sessioni</div></div>
        <div class="stat-card"><div class="stat-value">${formatVolume(stats.totalVolumeKg)}</div><div class="stat-label">Volume totale</div></div>
        <div class="stat-card"><div class="stat-value">${stats.currentStreak} 🔥</div><div class="stat-label">Streak</div></div>
        <div class="stat-card"><div class="stat-value">${weeklyFreq.toFixed(1)}</div><div class="stat-label">Sessioni / sett.</div></div>
      </div>

      <!-- Grafico frequenza settimanale -->
      <div class="card mb-4">
        <h2 class="section-title">Frequenza settimanale</h2>
        <div style="height:200px"><canvas id="chart-frequency"></canvas></div>
      </div>

      <!-- Grafico volume per esercizio -->
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">Volume per esercizio</h2>
          <select id="select-volume-exercise" class="input w-auto text-xs">
            <option value="">— scegli esercizio —</option>
            ${exerciseNames.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('')}
          </select>
        </div>
        <div style="height:200px" id="chart-volume-wrap">
          <p class="text-zinc-500 text-sm text-center pt-16">Seleziona un esercizio</p>
        </div>
      </div>

      <!-- Grafico PR timeline -->
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">PR timeline</h2>
          <select id="select-pr-exercise" class="input w-auto text-xs">
            <option value="">— scegli esercizio —</option>
            ${exerciseNames.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('')}
          </select>
        </div>
        <div style="height:200px" id="chart-pr-wrap">
          <p class="text-zinc-500 text-sm text-center pt-16">Seleziona un esercizio</p>
        </div>
      </div>

      <!-- Record personali -->
      <div class="card mb-4">
        <h2 class="section-title">Record personali</h2>
        ${prs.length === 0
          ? '<p class="text-zinc-500 text-sm">Nessun record ancora.</p>'
          : `<div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
              ${prs.map(pr => prRow(pr)).join('')}
             </div>`
        }
      </div>

      <!-- Volume per esercizio (tabella) -->
      <div class="card">
        <h2 class="section-title">Volume totale per esercizio</h2>
        ${volumes.length === 0
          ? '<p class="text-zinc-500 text-sm">Nessun dato.</p>'
          : `<div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
              ${volumes.map(v => volumeRow(v)).join('')}
             </div>`
        }
      </div>
    `;

    // Render grafico frequenza settimanale
    await renderFrequencyChart();

    // Listener selettori esercizi
    container.querySelector('#select-volume-exercise')?.addEventListener('change', async (e) => {
      const name = (e.target as HTMLSelectElement).value;
      const wrap = container.querySelector('#chart-volume-wrap') as HTMLElement;
      if (!name) {
        destroyChart('volume');
        wrap.innerHTML = '<p class="text-zinc-500 text-sm text-center pt-16">Seleziona un esercizio</p>';
        return;
      }
      wrap.innerHTML = '<canvas id="chart-volume"></canvas>';
      (wrap.querySelector('canvas') as HTMLCanvasElement).style.height = '200px';
      await renderVolumeChart(name);
    });

    container.querySelector('#select-pr-exercise')?.addEventListener('change', async (e) => {
      const name = (e.target as HTMLSelectElement).value;
      const wrap = container.querySelector('#chart-pr-wrap') as HTMLElement;
      if (!name) {
        destroyChart('pr');
        wrap.innerHTML = '<p class="text-zinc-500 text-sm text-center pt-16">Seleziona un esercizio</p>';
        return;
      }
      wrap.innerHTML = '<canvas id="chart-pr"></canvas>';
      (wrap.querySelector('canvas') as HTMLCanvasElement).style.height = '200px';
      await renderPRChart(name);
    });

  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-sm">Errore: ${err}</p>`;
  }
}

async function renderFrequencyChart(): Promise<void> {
  const canvas = document.getElementById('chart-frequency') as HTMLCanvasElement | null;
  if (!canvas) return;
  destroyChart('frequency');

  const all = await getWeeklyFrequencyHistory();
  // Mostra ultime 16 settimane
  const data = all.slice(-16);
  if (data.length === 0) {
    canvas.parentElement!.innerHTML = '<p class="text-zinc-500 text-sm text-center pt-16">Nessun allenamento completato.</p>';
    return;
  }

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => formatWeekLabel(d.week)),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: BRAND_DIM,
        borderColor: BRAND,
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: {
      ...BASE_CHART_OPTIONS,
      scales: {
        ...BASE_CHART_OPTIONS.scales,
        y: { ...BASE_CHART_OPTIONS.scales.y, beginAtZero: true, ticks: { color: TEXT_COLOR, stepSize: 1 } },
      },
    },
  });
  chartInstances.set('frequency', chart);
}

async function renderVolumeChart(exerciseName: string): Promise<void> {
  const canvas = document.getElementById('chart-volume') as HTMLCanvasElement | null;
  if (!canvas) return;
  destroyChart('volume');

  const data = await getExerciseVolumeHistory(exerciseName);
  if (data.length === 0) {
    canvas.parentElement!.innerHTML = '<p class="text-zinc-500 text-sm text-center pt-16">Nessun dato per questo esercizio.</p>';
    return;
  }

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => formatDateLabel(d.date)),
      datasets: [{
        data: data.map(d => Math.round(d.volume_kg)),
        borderColor: BRAND,
        backgroundColor: BRAND_DIM,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: BRAND,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      ...BASE_CHART_OPTIONS,
      plugins: {
        ...BASE_CHART_OPTIONS.plugins,
        tooltip: {
          ...BASE_CHART_OPTIONS.plugins.tooltip,
          callbacks: { label: (ctx) => ` ${ctx.parsed.y} kg` },
        },
      },
    },
  });
  chartInstances.set('volume', chart);
}

async function renderPRChart(exerciseName: string): Promise<void> {
  const canvas = document.getElementById('chart-pr') as HTMLCanvasElement | null;
  if (!canvas) return;
  destroyChart('pr');

  const data = await getPRHistoryByExercise(exerciseName);
  if (data.length === 0) {
    canvas.parentElement!.innerHTML = '<p class="text-zinc-500 text-sm text-center pt-16">Nessun dato per questo esercizio.</p>';
    return;
  }

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => formatDateLabel(d.date)),
      datasets: [{
        data: data.map(d => d.max_weight_kg),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#f59e0b',
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      ...BASE_CHART_OPTIONS,
      plugins: {
        ...BASE_CHART_OPTIONS.plugins,
        tooltip: {
          ...BASE_CHART_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const d = data[ctx.dataIndex];
              return ` ${d.max_weight_kg} kg${d.reps ? ` × ${d.reps}` : ''}`;
            },
          },
        },
      },
    },
  });
  chartInstances.set('pr', chart);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
