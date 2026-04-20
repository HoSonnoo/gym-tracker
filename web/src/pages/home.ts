import { getGlobalStats, getWorkoutTemplates, getTodayCompletedSessions } from '@/repository/workouts';
import { getActivePlanEntriesForToday } from '@/repository/mealplans';
import { navigate } from '@/router';
import type { WorkoutTemplate as _WorkoutTemplate } from '@/types';

export async function renderHome(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  el.innerHTML = `
    <h1 class="page-header">Dashboard</h1>
    <div id="home-content">
      <div class="flex items-center justify-center h-40"><div class="spinner"></div></div>
    </div>
  `;

  loadHome(el.querySelector('#home-content') as HTMLElement);
  return el;
}

async function loadHome(container: HTMLElement): Promise<void> {
  try {
    const [stats, templates, todaySessions, planData] = await Promise.all([
      getGlobalStats(),
      getWorkoutTemplates(),
      getTodayCompletedSessions(),
      getActivePlanEntriesForToday(),
    ]);

    const dayName = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const totalPlanKcal = planData.entries.reduce((s, e) => s + (e.kcal ?? 0), 0);

    container.innerHTML = `
      <!-- Date -->
      <p class="text-zinc-500 text-sm mb-6 capitalize">${dayName}</p>

      <!-- Stats row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        ${statCard(String(stats.totalSessions), 'Sessioni totali')}
        ${statCard(formatVolume(stats.totalVolumeKg), 'Volume totale')}
        ${statCard(String(stats.currentStreak), 'Streak attuale 🔥')}
        ${statCard(String(stats.bestStreak), 'Miglior streak')}
      </div>

      <!-- Today workouts -->
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">Sessioni di oggi</h2>
          <button id="go-workouts" class="btn-ghost text-xs">Vai ad allenamenti →</button>
        </div>
        ${todaySessions.length === 0
          ? '<p class="text-zinc-500 text-sm">Nessuna sessione completata oggi.</p>'
          : todaySessions.map(s => `
              <div class="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <span class="text-sm text-zinc-200">${s.name}</span>
                <span class="badge-green">${s.status === 'completed' ? 'Completata' : s.status}</span>
              </div>
            `).join('')
        }
      </div>

      <!-- Today nutrition -->
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">Piano alimentare oggi</h2>
          <button id="go-nutrition" class="btn-ghost text-xs">Vai a nutrizione →</button>
        </div>
        ${planData.entries.length === 0
          ? '<p class="text-zinc-500 text-sm">Nessun piano attivo per oggi.</p>'
          : `<div class="flex gap-4 text-sm">
              <div><span class="text-zinc-400">Kcal totali: </span><span class="text-zinc-100 font-medium">${totalPlanKcal} kcal</span></div>
            </div>`
        }
      </div>

      <!-- Quick start -->
      <div class="card">
        <h2 class="section-title">Avvia allenamento rapido</h2>
        ${templates.length === 0
          ? `<p class="text-zinc-500 text-sm mb-3">Nessun template trovato.</p>
             <button id="create-template" class="btn-primary">+ Crea template</button>`
          : `<div class="flex flex-col gap-2">
              ${templates.slice(0, 3).map(t => `
                <button class="start-session flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all text-sm" data-id="${t.id}">
                  <span class="text-zinc-200">${t.name}</span>
                  <span class="text-brand-400">▶</span>
                </button>
              `).join('')}
             </div>`
        }
      </div>
    `;

    container.querySelector('#go-workouts')?.addEventListener('click', () => navigate('/workouts'));
    container.querySelector('#go-nutrition')?.addEventListener('click', () => navigate('/nutrition'));
    container.querySelector('#create-template')?.addEventListener('click', () => navigate('/workouts'));

    container.querySelectorAll('.start-session').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset['id'];
        navigate(`/workout-session?template=${id}`);
      });
    });

  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-sm">Errore nel caricamento: ${err}</p>`;
  }
}

function statCard(value: string, label: string): string {
  return `
    <div class="stat-card">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return (kg / 1000).toFixed(1) + 't';
  return kg.toFixed(0) + ' kg';
}
