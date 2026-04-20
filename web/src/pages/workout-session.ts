import {
  startWorkoutSessionFromTemplate,
  getActiveWorkoutSession,
  getWorkoutSessionExercises,
  getWorkoutSessionSets,
  updateWorkoutSessionSet,
  completeWorkoutSession,
  cancelWorkoutSession,
  addExerciseToSession,
  addEmptySetToSessionExercise,
  removeSetFromSessionExercise,
  removeExerciseFromSession,
  getLastSessionSetsForExercise,
} from '@/repository/workouts';
import { getExercises } from '@/repository/exercises';
import { navigate } from '@/router';
import type { WorkoutSession, WorkoutSessionExercise, WorkoutSessionSet, Exercise, LastSessionSet } from '@/types';

function getHashParam(key: string): string | null {
  const hash = window.location.hash;
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return null;
  return new URLSearchParams(hash.slice(qIdx + 1)).get(key);
}

export async function renderWorkoutSession(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-3xl mx-auto';

  const templateId = Number(getHashParam('template'));
  const sessionIdParam = Number(getHashParam('session'));

  // ── State ──────────────────────────────────────────────────────────────────
  let session: WorkoutSession | null = null;
  let exercises: WorkoutSessionExercise[] = [];
  let setsMap: Map<number, WorkoutSessionSet[]> = new Map();
  let lastSessionMap: Map<number, LastSessionSet[]> = new Map();
  let allExercises: Exercise[] = [];
  let elapsedSeconds = 0;
  let timerInterval: number | null = null;
  let addExOpen = false;
  let exSearch = '';

  // ── Rest timer ─────────────────────────────────────────────────────────────
  let restTimerEl: HTMLDivElement | null = null;
  let restTimerInterval: number | null = null;
  let restSecondsLeft = 0;

  function startRestTimer(seconds: number): void {
    if (seconds <= 0) return;
    if (restTimerInterval !== null) clearInterval(restTimerInterval);

    restSecondsLeft = seconds;

    if (!restTimerEl) {
      restTimerEl = document.createElement('div');
      restTimerEl.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1E2330] border border-brand-500 rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 z-50';
      document.body.appendChild(restTimerEl);
    }

    function updateDisplay(): void {
      if (!restTimerEl) return;
      const m = Math.floor(restSecondsLeft / 60);
      const s = restSecondsLeft % 60;
      restTimerEl.innerHTML = `
        <span class="text-sm text-zinc-400">⏱ Recupero</span>
        <span id="rest-countdown" class="font-mono font-bold text-brand-400 text-xl">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>
        <button id="skip-rest-btn" class="btn-secondary text-xs">Salta</button>
      `;
      restTimerEl.querySelector('#skip-rest-btn')?.addEventListener('click', stopRestTimer);
    }

    updateDisplay();
    restTimerInterval = window.setInterval(() => {
      restSecondsLeft--;
      if (restSecondsLeft <= 0) {
        stopRestTimer();
        // Flash "done" notification
        const doneEl = document.createElement('div');
        doneEl.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-500 rounded-2xl shadow-2xl px-6 py-3 text-white font-bold z-50 text-sm';
        doneEl.textContent = '✓ Recupero terminato!';
        document.body.appendChild(doneEl);
        setTimeout(() => doneEl.remove(), 2500);
      } else {
        updateDisplay();
      }
    }, 1000);
  }

  function stopRestTimer(): void {
    if (restTimerInterval !== null) { clearInterval(restTimerInterval); restTimerInterval = null; }
    if (restTimerEl) { restTimerEl.remove(); restTimerEl = null; }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function escHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatEffortType(type: string | null): string {
    switch (type) {
      case 'buffer': return 'Buffer (RIR)';
      case 'failure': return 'Cedimento';
      case 'drop_set': return 'Drop set';
      default: return 'Nessuno';
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  function startTimer(): void {
    if (timerInterval !== null) return;
    if (session?.started_at) {
      elapsedSeconds = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    }
    timerInterval = window.setInterval(() => {
      elapsedSeconds++;
      const timerEl = document.getElementById('session-timer');
      if (timerEl) timerEl.textContent = formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer(): void {
    if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; }
  }

  // ── Load session data ──────────────────────────────────────────────────────
  async function loadSessionData(): Promise<void> {
    if (!session) return;
    exercises = await getWorkoutSessionExercises(session.id);
    setsMap = new Map();
    lastSessionMap = new Map();
    await Promise.all(exercises.map(async ex => {
      setsMap.set(ex.id, await getWorkoutSessionSets(ex.id));
      lastSessionMap.set(ex.id, await getLastSessionSetsForExercise(ex.exercise_name, session!.id));
    }));
  }

  // ── Get update data from DOM ───────────────────────────────────────────────
  function getSetUpdateData(setId: number): Parameters<typeof updateWorkoutSessionSet>[1] {
    const weightInput  = el.querySelector(`.actual-weight-input[data-set-id="${setId}"]`)  as HTMLInputElement | null;
    const repsInput    = el.querySelector(`.actual-reps-input[data-set-id="${setId}"]`)    as HTMLInputElement | null;
    const effortSel    = el.querySelector(`.actual-effort-select[data-set-id="${setId}"]`) as HTMLSelectElement | null;
    const bufferInput  = el.querySelector(`.actual-buffer-input[data-set-id="${setId}"]`)  as HTMLInputElement | null;
    const notesInput   = el.querySelector(`.actual-notes-input[data-set-id="${setId}"]`)   as HTMLInputElement | null;
    const s = Array.from(setsMap.values()).flat().find(x => x.id === setId);
    return {
      actual_weight_kg:    weightInput?.value  ? parseFloat(weightInput.value)  : null,
      actual_reps:         repsInput?.value    ? parseInt(repsInput.value)      : null,
      actual_effort_type:  (effortSel?.value ?? s?.actual_effort_type ?? 'none') as 'none' | 'buffer' | 'failure' | 'drop_set',
      actual_buffer_value: bufferInput?.value  ? parseInt(bufferInput.value)    : null,
      actual_rir:          null,
      actual_notes:        notesInput?.value?.trim() || null,
      is_completed:        s?.is_completed ?? 0,
    };
  }

  // ── Init: start or resume session ─────────────────────────────────────────
  el.innerHTML = `<div class="flex items-center justify-center h-40"><div class="spinner"></div></div>`;

  try {
    if (sessionIdParam) {
      session = await getActiveWorkoutSession();
      if (!session || session.id !== sessionIdParam) {
        el.innerHTML = `<p class="text-red-400">Sessione non trovata.</p>`;
        return el;
      }
    } else if (templateId) {
      const existing = await getActiveWorkoutSession();
      if (existing) {
        if (!confirm('Esiste già una sessione attiva. Vuoi riprenderla?')) {
          el.innerHTML = `<p class="text-zinc-400 text-sm">Sessione annullata.</p>`;
          return el;
        }
        session = existing;
      } else {
        const newId = await startWorkoutSessionFromTemplate(templateId);
        session = await getActiveWorkoutSession();
        if (!session || session.id !== newId) throw new Error('Impossibile avviare la sessione.');
      }
    } else {
      el.innerHTML = `<p class="text-red-400">Parametri mancanti.</p>`;
      return el;
    }

    allExercises = await getExercises();
    await loadSessionData();
    startTimer();
    render();
  } catch (err) {
    el.innerHTML = `<p class="text-red-400">Errore: ${err instanceof Error ? err.message : String(err)}</p>`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render(): void {
    if (!session) return;
    const filteredExs = allExercises.filter(e =>
      e.name.toLowerCase().includes(exSearch.toLowerCase()) ||
      (e.category ?? '').toLowerCase().includes(exSearch.toLowerCase())
    );

    el.innerHTML = `
      <!-- Header -->
      <div class="flex items-center justify-between mb-5 gap-4">
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-bold text-zinc-100 truncate">${escHtml(session!.name)}</h1>
          <span id="session-timer" class="text-sm text-brand-400 font-mono font-bold">${formatTime(elapsedSeconds)}</span>
        </div>
        <div class="flex gap-2 shrink-0">
          <button id="finish-btn" class="btn-primary text-xs">✓ Termina</button>
          <button id="cancel-btn" class="btn-ghost text-xs text-red-400">✕ Annulla</button>
        </div>
      </div>

      <!-- Exercises -->
      <div id="session-exercises" class="flex flex-col gap-5 mb-6">
        ${exercises.map(ex => exerciseBlock(ex)).join('')}
      </div>

      <!-- Add exercise -->
      <div class="card mb-4">
        <button id="toggle-add-ex" class="w-full flex items-center justify-between text-sm font-semibold text-zinc-300">
          <span>+ Aggiungi esercizio</span>
          <span>${addExOpen ? '▲' : '▼'}</span>
        </button>
        ${addExOpen ? `
          <div class="mt-3">
            <input id="ex-search-input" type="text" class="input mb-3" placeholder="Cerca esercizio…" value="${escHtml(exSearch)}" />
            <div class="flex flex-col gap-2 max-h-60 overflow-y-auto">
              ${filteredExs.map(ex => `
                <button class="add-session-ex-btn flex items-center justify-between px-3 py-2 rounded-lg bg-[#222834] hover:bg-[#2C3442] transition-all text-left" data-id="${ex.id}" data-name="${escHtml(ex.name)}" data-cat="${escHtml(ex.category ?? '')}">
                  <div>
                    <p class="text-sm font-semibold text-zinc-100">${escHtml(ex.name)}</p>
                    <p class="text-xs text-zinc-500">${escHtml(ex.category ?? 'Nessuna categoria')}</p>
                  </div>
                  <span class="text-xs font-bold text-brand-400">+</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    bindEvents();
  }

  function exerciseBlock(ex: WorkoutSessionExercise): string {
    const sets = setsMap.get(ex.id) ?? [];
    const lastSets = lastSessionMap.get(ex.id) ?? [];

    const lastSessionHint = lastSets.length > 0
      ? `<div class="text-xs text-zinc-600 mb-3 pl-2 border-l-2 border-zinc-700">
           <span class="font-semibold text-zinc-500">Ultima sessione:</span>
           ${lastSets.map((ls, i) => {
             let hint = `${i + 1}) ${ls.actual_weight_kg ?? '—'} kg × ${ls.actual_reps ?? '—'}`;
             if (ls.actual_effort_type && ls.actual_effort_type !== 'none') {
               hint += ` (${formatEffortType(ls.actual_effort_type)}${ls.actual_effort_type === 'buffer' && ls.actual_buffer_value != null ? ` ${ls.actual_buffer_value}` : ''})`;
             }
             return hint;
           }).join('  ')}
         </div>`
      : '';

    return `
      <div class="card" data-ex-id="${ex.id}">
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-zinc-100">${escHtml(ex.exercise_name)}</h3>
            ${ex.category ? `<p class="text-xs text-zinc-500">${escHtml(ex.category)}</p>` : ''}
          </div>
          <button class="remove-ex-btn btn-ghost text-xs text-red-400 ml-2 shrink-0" data-id="${ex.id}">✕ Rimuovi</button>
        </div>

        ${lastSessionHint}

        <div class="flex flex-col gap-3" id="sets-${ex.id}">
          ${sets.map((s, i) => setRow(s, i, lastSets)).join('')}
        </div>

        <button class="add-set-btn btn-secondary text-xs w-full mt-3" data-ex-id="${ex.id}">+ Aggiungi serie</button>
      </div>
    `;
  }

  function setRow(s: WorkoutSessionSet, i: number, lastSets: LastSessionSet[]): string {
    const done = s.is_completed === 1;
    const isWarmup = s.target_set_type === 'warmup';
    const effort = s.actual_effort_type ?? 'none';
    const lastRef = lastSets[i];

    // Build target hint
    const targetParts: string[] = [];
    if (s.target_weight_kg != null) targetParts.push(`${s.target_weight_kg} kg`);
    if (s.target_reps_min != null) {
      const repsStr = s.target_reps_max != null && s.target_reps_max !== s.target_reps_min
        ? `${s.target_reps_min}–${s.target_reps_max} reps`
        : `${s.target_reps_min} reps`;
      targetParts.push(repsStr);
    }
    if (s.target_rest_seconds != null) targetParts.push(`${s.target_rest_seconds}s recupero`);
    const targetHint = targetParts.length > 0 ? `🎯 Target: ${targetParts.join(' × ')}` : '';

    // Last session reference for this set position
    const lastRefHint = lastRef
      ? `📅 Ultima: ${lastRef.actual_weight_kg ?? '—'} kg × ${lastRef.actual_reps ?? '—'} reps${lastRef.actual_effort_type && lastRef.actual_effort_type !== 'none' ? ` (${formatEffortType(lastRef.actual_effort_type)})` : ''}`
      : '';

    return `
      <div class="rounded-xl border ${done ? 'border-brand-500/40 bg-brand-500/5' : 'border-[#2C3442] bg-[#181C23]'} p-3" data-set-id="${s.id}">
        <!-- Set header -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full ${done ? 'bg-brand-500' : 'bg-[#222834]'} flex items-center justify-center text-xs font-bold ${done ? 'text-white' : 'text-zinc-400'}">${i + 1}</span>
            <span class="text-xs font-semibold ${isWarmup ? 'text-zinc-500' : 'text-brand-400'}">${isWarmup ? 'Riscaldamento' : 'Lavoro'}</span>
          </div>
          <button class="remove-set-btn text-xs text-zinc-600 hover:text-red-400 transition-all" data-set-id="${s.id}">✕ rimuovi</button>
        </div>

        <!-- Hints -->
        ${targetHint ? `<p class="text-xs text-zinc-600 mb-1.5">${targetHint}</p>` : ''}
        ${lastRefHint ? `<p class="text-xs text-zinc-600 mb-2">${escHtml(lastRefHint)}</p>` : ''}

        <!-- Weight + Reps -->
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="label text-xs">Peso (kg)</label>
            <input type="number" step="0.5" min="0"
              class="actual-weight-input input text-sm h-9"
              data-set-id="${s.id}"
              value="${s.actual_weight_kg ?? ''}"
              placeholder="${s.target_weight_kg ?? '0'}" />
          </div>
          <div>
            <label class="label text-xs">Reps</label>
            <input type="number" min="0"
              class="actual-reps-input input text-sm h-9"
              data-set-id="${s.id}"
              value="${s.actual_reps ?? ''}"
              placeholder="${s.target_reps_min ?? '0'}" />
          </div>
        </div>

        <!-- Effort type -->
        <div class="mb-2">
          <label class="label text-xs">Tipo di sforzo</label>
          <select class="actual-effort-select input text-sm h-9" data-set-id="${s.id}">
            <option value="none" ${effort === 'none' ? 'selected' : ''}>Nessuno</option>
            <option value="buffer" ${effort === 'buffer' ? 'selected' : ''}>Buffer (RIR)</option>
            <option value="failure" ${effort === 'failure' ? 'selected' : ''}>Cedimento</option>
            <option value="drop_set" ${effort === 'drop_set' ? 'selected' : ''}>Drop set</option>
          </select>
        </div>

        <!-- Buffer value (hidden unless effort = buffer) -->
        <div id="buffer-row-${s.id}" class="mb-2 ${effort !== 'buffer' ? 'hidden' : ''}">
          <label class="label text-xs">Reps in riserva (RIR)</label>
          <input type="number" min="0" max="10"
            class="actual-buffer-input input text-sm h-9"
            data-set-id="${s.id}"
            value="${s.actual_buffer_value ?? ''}"
            placeholder="0" />
        </div>

        <!-- Notes -->
        <div class="mb-3">
          <label class="label text-xs">Note</label>
          <input type="text"
            class="actual-notes-input input text-sm h-9"
            data-set-id="${s.id}"
            value="${escHtml(s.actual_notes ?? '')}"
            placeholder="—" />
        </div>

        <!-- Complete button -->
        <button class="complete-set-btn w-full py-2 rounded-lg text-sm font-bold transition-all ${done ? 'bg-brand-500 text-white' : 'bg-[#222834] border border-[#2C3442] text-zinc-400 hover:border-brand-500 hover:text-zinc-200'}" data-set-id="${s.id}">
          ${done ? '✓ Completata' : '○ Segna come completata'}
        </button>
      </div>
    `;
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  function bindEvents(): void {
    // Finish session
    el.querySelector('#finish-btn')?.addEventListener('click', async () => {
      if (!confirm('Terminare la sessione?')) return;
      stopTimer(); stopRestTimer();
      await completeWorkoutSession(session!.id);
      navigate('/workouts');
    });

    // Cancel session
    el.querySelector('#cancel-btn')?.addEventListener('click', async () => {
      if (!confirm('Annullare la sessione? I dati non verranno salvati.')) return;
      stopTimer(); stopRestTimer();
      await cancelWorkoutSession(session!.id);
      navigate('/workouts');
    });

    // Toggle add exercise panel
    el.querySelector('#toggle-add-ex')?.addEventListener('click', () => {
      addExOpen = !addExOpen; render();
    });

    // Search exercises
    el.querySelector('#ex-search-input')?.addEventListener('input', e => {
      exSearch = (e.target as HTMLInputElement).value; render();
    });

    // Add exercise to session
    el.querySelectorAll('.add-session-ex-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id   = Number((btn as HTMLElement).dataset['id']);
        const name = (btn as HTMLElement).dataset['name'] ?? '';
        const cat  = (btn as HTMLElement).dataset['cat'] || null;
        (btn as HTMLButtonElement).disabled = true;
        const seId = await addExerciseToSession(session!.id, id, name, cat);
        await addEmptySetToSessionExercise(seId);
        addExOpen = false; exSearch = '';
        await loadSessionData();
        render();
      });
    });

    // Remove exercise from session
    el.querySelectorAll('.remove-ex-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Rimuovere questo esercizio dalla sessione?')) return;
        const id = Number((btn as HTMLElement).dataset['id']);
        await removeExerciseFromSession(id);
        await loadSessionData();
        render();
      });
    });

    // Add set
    el.querySelectorAll('.add-set-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const exId = Number((btn as HTMLElement).dataset['exId']);
        await addEmptySetToSessionExercise(exId);
        await loadSessionData();
        render();
      });
    });

    // Remove set
    el.querySelectorAll('.remove-set-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const setId = Number((btn as HTMLElement).dataset['setId']);
        await removeSetFromSessionExercise(setId);
        await loadSessionData();
        render();
      });
    });

    // Effort type selector → show/hide buffer row
    el.querySelectorAll('.actual-effort-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const setId = (sel as HTMLElement).dataset['setId'];
        const value = (sel as HTMLSelectElement).value;
        const bufferRow = el.querySelector(`#buffer-row-${setId}`);
        if (bufferRow) (bufferRow as HTMLElement).classList.toggle('hidden', value !== 'buffer');
        // Update local state
        const s = Array.from(setsMap.values()).flat().find(x => x.id === Number(setId));
        if (s) s.actual_effort_type = value as 'none' | 'buffer' | 'failure' | 'drop_set';
      });
    });

    // Complete set (toggle)
    el.querySelectorAll('.complete-set-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const setId = Number((btn as HTMLElement).dataset['setId']);
        const allSets = Array.from(setsMap.values()).flat();
        const s = allSets.find(x => x.id === setId);
        if (!s) return;

        const newDone = s.is_completed !== 1 ? 1 : 0;
        const data = getSetUpdateData(setId);
        data.is_completed = newDone;

        await updateWorkoutSessionSet(setId, data);

        // Update local state
        s.is_completed        = newDone;
        s.actual_weight_kg    = data.actual_weight_kg;
        s.actual_reps         = data.actual_reps;
        s.actual_effort_type  = data.actual_effort_type;
        s.actual_buffer_value = data.actual_buffer_value;
        s.actual_notes        = data.actual_notes;

        // Start rest timer when marking done
        if (newDone === 1 && s.target_rest_seconds) {
          startRestTimer(s.target_rest_seconds);
        }

        render();
      });
    });

    // Auto-save on blur for all input fields
    el.querySelectorAll('.actual-weight-input, .actual-reps-input, .actual-notes-input, .actual-buffer-input').forEach(input => {
      input.addEventListener('blur', async () => {
        const setId = Number((input as HTMLElement).dataset['setId']);
        const data = getSetUpdateData(setId);
        await updateWorkoutSessionSet(setId, data);
        const s = Array.from(setsMap.values()).flat().find(x => x.id === setId);
        if (s) {
          s.actual_weight_kg    = data.actual_weight_kg;
          s.actual_reps         = data.actual_reps;
          s.actual_notes        = data.actual_notes;
          s.actual_buffer_value = data.actual_buffer_value;
        }
      });
    });
  }

  return el;
}
