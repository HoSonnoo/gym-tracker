import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { navigate } from '@/router';
import { deleteWorkoutSession, getWorkoutSessionDetail } from '@/repository/workouts';
import type { WorkoutSessionDetail } from '@/types';

type SessionRow = {
  id: number;
  name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
};

export async function renderCalendar(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth(); // 0-indexed

  el.innerHTML = `
    <h1 class="page-header">Calendario</h1>
    <div id="calendar-nav" class="flex items-center justify-between mb-4">
      <button id="prev-month" class="btn-secondary">←</button>
      <span id="month-label" class="text-lg font-semibold text-zinc-100"></span>
      <button id="next-month" class="btn-secondary">→</button>
    </div>
    <div id="calendar-grid" class="mb-6"></div>
    <div id="selected-day-info" class="card hidden">
      <h2 id="selected-day-title" class="section-title"></h2>
      <div id="selected-day-sessions"></div>
      <button id="start-from-calendar" class="btn-primary mt-3 hidden">+ Avvia allenamento</button>
    </div>
  `;

  let sessions: SessionRow[] = [];
  let selectedDate: string | null = null;

  async function loadSessions(): Promise<void> {
    const userId = await getUserId();
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, name, status, started_at, completed_at')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
    sessions = (data ?? []) as SessionRow[];
  }

  function renderGrid(): void {
    const label = el.querySelector('#month-label') as HTMLElement;
    label.textContent = new Date(viewYear, viewMonth).toLocaleDateString('it-IT', {
      month: 'long', year: 'numeric',
    });

    const grid = el.querySelector('#calendar-grid') as HTMLElement;
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const offset = (firstDay + 6) % 7; // Monday-first

    const sessionDateSet = new Set(
      sessions
        .filter(s => s.status === 'completed')
        .map(s => s.completed_at?.slice(0, 10) ?? s.started_at.slice(0, 10))
    );

    const today = new Date().toISOString().slice(0, 10);

    let html = `
      <div class="grid grid-cols-7 gap-1 text-center mb-1">
        ${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d =>
          `<div class="text-xs text-zinc-600 font-medium py-1">${d}</div>`
        ).join('')}
      </div>
      <div class="grid grid-cols-7 gap-1">
        ${'<div></div>'.repeat(offset)}
    `;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasSession = sessionDateSet.has(dateStr);
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;

      let cls = 'calendar-day relative flex flex-col items-center justify-center h-10 rounded-lg cursor-pointer text-sm transition-all ';
      if (isSelected) cls += 'bg-brand-500 text-white';
      else if (isToday) cls += 'bg-zinc-700 text-zinc-100';
      else cls += 'hover:bg-zinc-800 text-zinc-300';

      html += `
        <div class="${cls}" data-date="${dateStr}">
          ${d}
          ${hasSession ? `<div class="absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}"></div>` : ''}
        </div>
      `;
    }

    html += '</div>';
    grid.innerHTML = html;

    grid.querySelectorAll('.calendar-day').forEach(day => {
      day.addEventListener('click', () => {
        selectedDate = (day as HTMLElement).dataset['date'] ?? null;
        renderGrid();
        showDayInfo();
      });
    });
  }

  function showDayInfo(): void {
    if (!selectedDate) return;
    const panel = el.querySelector('#selected-day-info') as HTMLElement;
    const title = el.querySelector('#selected-day-title') as HTMLElement;
    const sessionsEl = el.querySelector('#selected-day-sessions') as HTMLElement;
    const startBtn = el.querySelector('#start-from-calendar') as HTMLButtonElement;

    panel.classList.remove('hidden');
    title.textContent = new Date(selectedDate + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    const daySessions = sessions.filter(s => {
      const d = (s.completed_at ?? s.started_at).slice(0, 10);
      return d === selectedDate;
    });

    if (daySessions.length === 0) {
      sessionsEl.innerHTML = '<p class="text-zinc-500 text-sm">Nessuna sessione.</p>';
    } else {
      sessionsEl.innerHTML = daySessions.map(s => `
        <div class="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
          <span class="text-sm text-zinc-200">${s.name}</span>
          <div class="flex items-center gap-2">
            <span class="badge-${s.status === 'completed' ? 'green' : 'zinc'}">${s.status}</span>
            ${s.status === 'completed' ? `<button class="detail-session-btn btn-ghost text-xs text-brand-400 hover:text-brand-300" data-id="${s.id}" title="Dettaglio">Dettaglio</button>` : ''}
            <button class="delete-session-btn btn-ghost text-xs text-red-400 hover:text-red-300" data-id="${s.id}" title="Elimina allenamento">✕</button>
          </div>
        </div>
      `).join('');

      sessionsEl.querySelectorAll('.detail-session-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number((btn as HTMLElement).dataset['id']);
          await showSessionDetailModal(id);
        });
      });

      sessionsEl.querySelectorAll('.delete-session-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Eliminare questo allenamento? I dati non saranno recuperabili.')) return;
          const id = Number((btn as HTMLElement).dataset['id']);
          await deleteWorkoutSession(id);
          await loadSessions();
          renderGrid();
          showDayInfo();
        });
      });
    }

    // Show start button only for today or future
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate >= today) {
      startBtn.classList.remove('hidden');
    } else {
      startBtn.classList.add('hidden');
    }
  }

  el.querySelector('#prev-month')?.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderGrid();
  });

  el.querySelector('#next-month')?.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderGrid();
  });

  el.querySelector('#start-from-calendar')?.addEventListener('click', () => {
    navigate('/workouts');
  });

  async function showSessionDetailModal(sessionId: number): Promise<void> {
    const existing = document.getElementById('session-detail-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'session-detail-modal';
    modal.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-[#181C23] border border-[#2C3442] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-[#2C3442] shrink-0">
          <span class="font-semibold text-zinc-100">Dettaglio sessione</span>
          <button id="close-detail-modal" class="btn-ghost text-sm">✕</button>
        </div>
        <div class="overflow-y-auto flex-1 p-4">
          <div class="flex items-center justify-center h-32"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#close-detail-modal')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const body = modal.querySelector('.overflow-y-auto') as HTMLElement;
    try {
      const detail = await getWorkoutSessionDetail(sessionId);
      if (!detail) { body.innerHTML = '<p class="text-zinc-500 text-sm">Dati non trovati.</p>'; return; }
      body.innerHTML = renderSessionDetail(detail);
    } catch {
      body.innerHTML = '<p class="text-red-400 text-sm">Errore nel caricamento.</p>';
    }
  }

  function renderSessionDetail(detail: WorkoutSessionDetail): string {
    const s = detail.session;
    const date = s.completed_at ? new Date(s.completed_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const duration = s.started_at && s.completed_at
      ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000)
      : null;

    return `
      <div class="mb-4">
        <h2 class="text-lg font-bold text-zinc-100">${s.name}</h2>
        <div class="flex items-center gap-3 mt-1 text-xs text-zinc-500">
          <span>${date}</span>
          ${duration !== null ? `<span>${duration} min</span>` : ''}
          ${s.rating ? `<span>${'★'.repeat(s.rating)}${'☆'.repeat(5 - s.rating)}</span>` : ''}
        </div>
        ${s.notes ? `<p class="text-sm text-zinc-400 mt-2">${s.notes}</p>` : ''}
      </div>

      ${detail.exercises.length === 0
        ? '<p class="text-zinc-500 text-sm">Nessun esercizio registrato.</p>'
        : detail.exercises.map(({ exercise, sets }) => {
            const completedSets = sets.filter(s => s.is_completed);
            return `
              <div class="mb-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="font-semibold text-zinc-200 text-sm">${exercise.exercise_name}</span>
                  ${exercise.category ? `<span class="text-xs text-zinc-600">${exercise.category}</span>` : ''}
                </div>
                ${completedSets.length === 0
                  ? '<p class="text-xs text-zinc-600 pl-2">Nessuna serie completata</p>'
                  : `<div class="flex flex-col gap-1">
                      <div class="grid grid-cols-[32px_1fr_1fr_1fr] gap-2 px-2 mb-1">
                        <span class="text-xs text-zinc-600">#</span>
                        <span class="text-xs text-zinc-600 text-center">Peso</span>
                        <span class="text-xs text-zinc-600 text-center">Reps</span>
                        <span class="text-xs text-zinc-600 text-center">Sforzo</span>
                      </div>
                      ${completedSets.map((s, i) => `
                        <div class="grid grid-cols-[32px_1fr_1fr_1fr] gap-2 items-center px-2 py-1 rounded-lg ${i % 2 === 0 ? 'bg-zinc-800/30' : ''}">
                          <span class="text-xs font-bold ${s.target_set_type === 'warmup' ? 'text-zinc-500' : 'text-brand-400'}">
                            ${s.target_set_type === 'warmup' ? 'W' : i + 1}
                          </span>
                          <span class="text-sm font-semibold text-zinc-200 text-center">
                            ${s.actual_weight_kg != null ? s.actual_weight_kg + ' kg' : '—'}
                          </span>
                          <span class="text-sm font-semibold text-zinc-200 text-center">
                            ${s.actual_reps != null ? s.actual_reps : '—'}
                          </span>
                          <span class="text-xs text-zinc-500 text-center">
                            ${formatEffort(s.actual_effort_type, s.actual_buffer_value)}
                          </span>
                        </div>
                      `).join('')}
                    </div>`
                }
              </div>
            `;
          }).join('<div class="border-t border-zinc-800 my-3"></div>')}
    `;
  }

  function formatEffort(type: string | null, buffer: number | null): string {
    if (!type || type === 'none') return '—';
    if (type === 'buffer' && buffer != null) return `RIR ${buffer}`;
    if (type === 'failure') return 'Cedimento';
    if (type === 'drop_set') return 'Drop set';
    return type;
  }

  await loadSessions();
  renderGrid();

  return el;
}
