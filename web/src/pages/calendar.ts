import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { navigate } from '@/router';
import { deleteWorkoutSession } from '@/repository/workouts';

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
            <button class="delete-session-btn btn-ghost text-xs text-red-400 hover:text-red-300" data-id="${s.id}" title="Elimina allenamento">✕</button>
          </div>
        </div>
      `).join('');

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

  await loadSessions();
  renderGrid();

  return el;
}
