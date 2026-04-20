import { supabase } from '@/lib/supabase';
import { navigate } from '@/router';

// ─── Preferences (localStorage) ──────────────────────────────────────────────

type WeightUnit = 'kg' | 'lbs';

function getUnit(): WeightUnit {
  return (localStorage.getItem('vyro_unit') as WeightUnit) ?? 'kg';
}
function setUnit(unit: WeightUnit): void {
  localStorage.setItem('vyro_unit', unit);
}
function getWeeklyGoal(): number {
  return parseInt(localStorage.getItem('vyro_weekly_goal') ?? '3', 10);
}
function setWeeklyGoal(goal: number): void {
  localStorage.setItem('vyro_weekly_goal', String(goal));
}

// ─── Reset options ────────────────────────────────────────────────────────────

type ResetKey = 'sessions' | 'templates' | 'nutritionLogs' | 'mealPlans' | 'bodyWeight' | 'foodCatalog';

const RESET_LABELS: Record<ResetKey, { label: string; subtitle: string; emoji: string }> = {
  sessions:      { emoji: '🏋️', label: 'Sessioni allenamento',  subtitle: 'Storico allenamenti e sessione attiva' },
  templates:     { emoji: '📋', label: 'Template ed esercizi',  subtitle: 'Tutti i template e il catalogo esercizi' },
  nutritionLogs: { emoji: '🥗', label: 'Log nutrizione',         subtitle: 'Diario alimentare e log acqua giornalieri' },
  mealPlans:     { emoji: '📅', label: 'Piani alimentari',       subtitle: 'Tutti i piani alimentari salvati' },
  bodyWeight:    { emoji: '⚖️', label: 'Peso corporeo',          subtitle: 'Tutto lo storico delle pesate' },
  foodCatalog:   { emoji: '🍎', label: 'Catalogo alimenti',      subtitle: 'Tutti gli alimenti salvati manualmente' },
};

const RESET_TABLES: Record<ResetKey, string[]> = {
  sessions:      ['workout_sessions'],
  templates:     ['workout_templates', 'exercises'],
  nutritionLogs: ['nutrition_logs'],
  mealPlans:     ['meal_plans'],
  bodyWeight:    ['body_weight_logs'],
  foodCatalog:   ['food_items'],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function renderSettings(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'p-6 max-w-2xl mx-auto';

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const isAnon = user?.is_anonymous;

  // state
  let unit = getUnit();
  let weeklyGoal = getWeeklyGoal();
  let resetOptions: Record<ResetKey, boolean> = {
    sessions: false, templates: false, nutritionLogs: false,
    mealPlans: false, bodyWeight: false, foodCatalog: false,
  };
  let dataModalOpen = false;
  let resetModalOpen = false;
  let importMode: 'replace_all' | 'overwrite_existing' | 'add_only' | null = null;
  let busy = false;

  // Fetch current display_name
  let currentNickname = '';
  if (user && !isAnon) {
    supabase.from('profiles').select('display_name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.display_name) currentNickname = data.display_name; });
  }

  // ── render ──────────────────────────────────────────────────────────────────
  function render(): void {
    const allSelected = (Object.keys(resetOptions) as ResetKey[]).every(k => resetOptions[k]);
    const anySelected = (Object.keys(resetOptions) as ResetKey[]).some(k => resetOptions[k]);

    el.innerHTML = `
      <h1 class="text-2xl font-bold text-zinc-100 mb-6">Impostazioni</h1>

      <!-- ── PREFERENZE ── -->
      <p class="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mb-2 ml-1">Preferenze</p>
      <div class="card mb-5">
        <!-- Unità di misura -->
        <div class="flex items-center justify-between py-3 px-4 border-b border-[#2C3442]">
          <div>
            <p class="text-sm font-semibold text-zinc-100">Unità di misura</p>
            <p class="text-xs text-zinc-500 mt-0.5">Applicata a tutti i pesi</p>
          </div>
          <div class="inline-flex bg-[#181C23] border border-[#2C3442] rounded-lg p-0.5 gap-0.5">
            <button id="unit-kg" class="${unit === 'kg' ? 'unit-btn-active' : 'unit-btn-inactive'}">kg</button>
            <button id="unit-lbs" class="${unit === 'lbs' ? 'unit-btn-active' : 'unit-btn-inactive'}">lbs</button>
          </div>
        </div>
        <!-- Obiettivo settimanale -->
        <div class="flex items-center justify-between py-3 px-4">
          <div>
            <p class="text-sm font-semibold text-zinc-100">Obiettivo settimanale</p>
            <p class="text-xs text-zinc-500 mt-0.5">Allenamenti a settimana</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="goal-dec" class="stepper-btn ${weeklyGoal <= 1 ? 'opacity-30 cursor-not-allowed' : ''}" ${weeklyGoal <= 1 ? 'disabled' : ''}>−</button>
            <span id="goal-val" class="text-base font-bold text-zinc-100 w-6 text-center">${weeklyGoal}</span>
            <button id="goal-inc" class="stepper-btn ${weeklyGoal >= 7 ? 'opacity-30 cursor-not-allowed' : ''}" ${weeklyGoal >= 7 ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>

      <!-- ── DATI ── -->
      <p class="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mb-2 ml-1">Dati</p>
      <div class="card mb-5">
        <div class="flex items-center justify-between py-3 px-4">
          <div>
            <p class="text-sm font-semibold text-zinc-100">Gestione dati</p>
            <p class="text-xs text-zinc-500 mt-0.5">Esporta, importa o reimposta i tuoi dati</p>
          </div>
          <button id="open-data-modal" class="btn-secondary text-xs ${busy ? 'opacity-50 cursor-not-allowed' : ''}" ${busy ? 'disabled' : ''}>
            ${busy ? '…' : 'Gestisci'}
          </button>
        </div>
      </div>

      <!-- ── ACCOUNT ── -->
      <p class="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mb-2 ml-1">Account</p>
      <div class="card mb-5">
        ${!isAnon && user?.email ? `
          <div class="flex items-center justify-between py-3 px-4 border-b border-[#2C3442]">
            <div>
              <p class="text-sm font-semibold text-zinc-100">Account</p>
              <p class="text-xs text-zinc-500 mt-0.5">${user.email}</p>
            </div>
            <span class="text-xs font-bold text-brand-400 bg-brand-500/10 border border-brand-500/30 rounded-lg px-2.5 py-1">Registrato</span>
          </div>
          <div class="flex items-center justify-between py-3 px-4 border-b border-[#2C3442]">
            <div>
              <p class="text-sm font-semibold text-zinc-100">Nickname</p>
              <p class="text-xs text-zinc-500 mt-0.5">${currentNickname || 'Non impostato'}</p>
            </div>
            <button id="edit-nickname-btn" class="btn-secondary text-xs">Modifica</button>
          </div>
          <div id="nickname-form" class="hidden px-4 pb-4 border-b border-[#2C3442]">
            <input id="nickname-input" type="text" class="input mt-2 mb-2" placeholder="Il tuo nickname…" value="${currentNickname}" maxlength="32" />
            <p id="nickname-error" class="text-red-400 text-xs mb-2 hidden"></p>
            <p id="nickname-success" class="text-brand-400 text-xs mb-2 hidden">Nickname aggiornato.</p>
            <div class="flex gap-2">
              <button id="save-nickname-btn" class="btn-primary text-xs">Salva</button>
              <button id="cancel-nickname-btn" class="btn-secondary text-xs">Annulla</button>
            </div>
          </div>
          <div class="flex items-center justify-between py-3 px-4 border-b border-[#2C3442]">
            <div>
              <p class="text-sm font-semibold text-zinc-100">Cambia password</p>
              <p class="text-xs text-zinc-500 mt-0.5">Aggiorna la password del tuo account</p>
            </div>
            <button id="change-pw-btn" class="btn-secondary text-xs">Cambia</button>
          </div>
          <div id="pw-form" class="hidden px-4 pb-4">
            <input id="new-password" type="password" class="input mt-2 mb-2" placeholder="Nuova password (min. 6 caratteri)" />
            <p id="pw-error" class="text-red-400 text-xs mb-2 hidden"></p>
            <p id="pw-success" class="text-brand-400 text-xs mb-2 hidden">Password aggiornata.</p>
            <div class="flex gap-2">
              <button id="save-pw-btn" class="btn-primary text-xs">Salva</button>
              <button id="cancel-pw-btn" class="btn-secondary text-xs">Annulla</button>
            </div>
          </div>
          <div class="flex items-center justify-between py-3 px-4 border-b border-[#2C3442]">
            <div>
              <p class="text-sm font-semibold text-zinc-100">Disconnetti</p>
              <p class="text-xs text-zinc-500 mt-0.5">Esci dal tuo account su questo dispositivo</p>
            </div>
            <button id="logout-btn" class="text-xs font-bold text-red-400 border border-red-800 bg-red-950/30 rounded-lg px-3 py-1.5 hover:bg-red-900/40 transition-all">Esci</button>
          </div>
          <div class="flex items-center justify-between py-3 px-4">
            <div>
              <p class="text-sm font-semibold text-red-400">Elimina account</p>
              <p class="text-xs text-zinc-500 mt-0.5">Cancella definitivamente account e dati cloud</p>
            </div>
            <button id="delete-account-btn" class="text-xs font-bold text-red-400 border border-red-800 bg-red-950/30 rounded-lg px-3 py-1.5 hover:bg-red-900/40 transition-all">Elimina</button>
          </div>
        ` : `
          <div class="flex items-center justify-between py-3 px-4 border-b border-[#2C3442]">
            <div>
              <p class="text-sm font-semibold text-zinc-100">Tipo account</p>
              <p class="text-xs text-zinc-500 mt-0.5">Stai usando Vyro come ospite</p>
            </div>
            <span class="badge-zinc">Ospite</span>
          </div>
          <div class="flex items-center justify-between py-3 px-4">
            <div>
              <p class="text-sm font-semibold text-zinc-100">Sblocca backup cloud</p>
              <p class="text-xs text-zinc-500 mt-0.5">Registrati per non perdere i dati</p>
            </div>
            <button id="upgrade-btn" class="btn-primary text-xs">Crea account</button>
          </div>
        `}
      </div>

      <!-- ── APP ── -->
      <p class="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mb-2 ml-1">App</p>
      <div class="card mb-8">
        <div class="flex items-center justify-between py-3 px-4">
          <p class="text-sm font-semibold text-zinc-100">Versione</p>
          <span class="text-sm text-zinc-500 font-semibold">1.0.0</span>
        </div>
      </div>

      <!-- ══ DATA MANAGEMENT MODAL ══ -->
      <div id="data-modal" class="${dataModalOpen ? '' : 'hidden'} fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
        <div class="card w-full max-w-lg rounded-2xl p-6 mb-2">
          <h3 class="text-lg font-bold text-zinc-100 mb-5">Gestione dati</h3>

          <p class="text-[10px] font-bold text-zinc-500 tracking-widest uppercase mb-2">ESPORTA</p>
          <div class="card p-0 overflow-hidden mb-4">
            <button id="export-json-btn" class="flex items-center gap-3 px-4 py-3 w-full text-left border-b border-[#2C3442] hover:bg-[#2C3442]/40 transition-all">
              <span class="text-xl">📦</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-zinc-100">Backup JSON</p>
                <p class="text-xs text-zinc-500">Backup completo, reimportabile</p>
              </div>
              <span class="text-zinc-600 text-xl">›</span>
            </button>
            <button id="export-csv-btn" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-[#2C3442]/40 transition-all">
              <span class="text-xl">📊</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-zinc-100">Esporta CSV</p>
                <p class="text-xs text-zinc-500">Leggibile in Excel, Numbers, Fogli Google</p>
              </div>
              <span class="text-zinc-600 text-xl">›</span>
            </button>
          </div>

          <p class="text-[10px] font-bold text-zinc-500 tracking-widest uppercase mb-2">IMPORTA</p>
          <div class="card p-0 overflow-hidden mb-4">
            <button id="import-btn" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-[#2C3442]/40 transition-all">
              <span class="text-xl">📥</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-zinc-100">Importa backup JSON</p>
                <p class="text-xs text-zinc-500">Ripristina da un file esportato in precedenza</p>
              </div>
              <span class="text-zinc-600 text-xl">›</span>
            </button>
          </div>

          <p class="text-[10px] font-bold text-zinc-500 tracking-widest uppercase mb-2">RESET</p>
          <div class="card p-0 overflow-hidden mb-4">
            <button id="open-reset-modal" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-[#2C3442]/40 transition-all">
              <span class="text-xl">🗑️</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-red-400">Reset dati</p>
                <p class="text-xs text-zinc-500">Scegli cosa cancellare</p>
              </div>
              <span class="text-zinc-600 text-xl">›</span>
            </button>
          </div>

          <button id="close-data-modal" class="btn-secondary w-full">Annulla</button>
        </div>
      </div>

      <!-- ══ IMPORT MODE MODAL ══ -->
      <div id="import-modal" class="${importMode !== null ? '' : 'hidden'} fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
        <div class="card w-full max-w-lg rounded-2xl p-6 mb-2">
          <h3 class="text-lg font-bold text-zinc-100 mb-2">Importa backup JSON</h3>
          <p class="text-sm text-zinc-400 mb-5">Scegli come gestire i dati esistenti:</p>
          <div class="card p-0 overflow-hidden mb-4">
            <button id="import-mode-replace" class="flex items-center gap-3 px-4 py-3 w-full text-left border-b border-[#2C3442] hover:bg-[#2C3442]/40 transition-all">
              <div class="flex-1">
                <p class="text-sm font-semibold text-red-400">Sostituisci tutto</p>
                <p class="text-xs text-zinc-500">Cancella i dati attuali e importa il backup</p>
              </div>
            </button>
            <button id="import-mode-overwrite" class="flex items-center gap-3 px-4 py-3 w-full text-left border-b border-[#2C3442] hover:bg-[#2C3442]/40 transition-all">
              <div class="flex-1">
                <p class="text-sm font-semibold text-zinc-100">Sovrascrivi esistenti</p>
                <p class="text-xs text-zinc-500">Aggiorna i record con lo stesso ID</p>
              </div>
            </button>
            <button id="import-mode-add" class="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-[#2C3442]/40 transition-all">
              <div class="flex-1">
                <p class="text-sm font-semibold text-zinc-100">Aggiungi senza sovrascrivere</p>
                <p class="text-xs text-zinc-500">Inserisce solo i nuovi record</p>
              </div>
            </button>
          </div>
          <button id="close-import-modal" class="btn-secondary w-full">Annulla</button>
        </div>
      </div>

      <!-- ══ RESET MODAL ══ -->
      <div id="reset-modal" class="${resetModalOpen ? '' : 'hidden'} fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
        <div class="card w-full max-w-lg rounded-2xl p-6 mb-2">
          <h3 class="text-lg font-bold text-zinc-100 mb-1">Reset dati</h3>
          <p class="text-sm text-zinc-400 mb-4">Seleziona le categorie da cancellare definitivamente.</p>

          <button id="toggle-all-btn" class="flex items-center gap-3 w-full py-2.5 border-b border-[#2C3442] mb-3 text-left">
            <div class="w-6 h-6 rounded-md border-2 flex items-center justify-center ${allSelected ? 'border-red-500 bg-red-950/40' : 'border-[#2C3442] bg-[#181C23]'}">
              ${allSelected ? '<span class="text-red-400 text-xs font-black">✓</span>' : ''}
            </div>
            <span class="text-sm font-bold text-zinc-100">Seleziona tutto</span>
          </button>

          <div class="card p-0 overflow-hidden mb-4">
            ${(Object.keys(RESET_LABELS) as ResetKey[]).map((key, idx, arr) => `
              <button class="reset-option-btn flex items-center gap-3 px-4 py-3 w-full text-left ${idx < arr.length - 1 ? 'border-b border-[#2C3442]' : ''} hover:bg-[#2C3442]/40 transition-all" data-key="${key}">
                <span class="text-lg">${RESET_LABELS[key].emoji}</span>
                <div class="flex-1 text-left">
                  <p class="text-sm font-semibold ${resetOptions[key] ? 'text-red-400' : 'text-zinc-400'}">${RESET_LABELS[key].label}</p>
                  <p class="text-xs text-zinc-500">${RESET_LABELS[key].subtitle}</p>
                </div>
                <div class="w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${resetOptions[key] ? 'border-red-500 bg-red-950/40' : 'border-[#2C3442] bg-[#181C23]'}">
                  ${resetOptions[key] ? '<span class="text-red-400 text-xs font-black">✓</span>' : ''}
                </div>
              </button>
            `).join('')}
          </div>

          <button id="confirm-reset-btn" class="w-full py-3 rounded-xl border text-sm font-bold transition-all mb-2 ${anySelected ? 'border-red-600 text-red-400 bg-red-950/30 hover:bg-red-900/40' : 'border-[#2C3442] text-zinc-600 bg-[#181C23] cursor-not-allowed opacity-40'}" ${anySelected ? '' : 'disabled'}>
            ${busy ? 'Reset in corso…' : 'Resetta selezionati'}
          </button>
          <button id="close-reset-modal" class="btn-secondary w-full">Annulla</button>
        </div>
      </div>

      <!-- hidden file input -->
      <input id="import-file-input" type="file" accept=".json" class="hidden" />
      <p id="global-msg" class="text-sm mt-3 hidden text-center"></p>
    `;

    attachStyles(el);
    attachListeners();
  }

  function attachStyles(root: HTMLElement): void {
    // Inject stepper/unit btn classes if not present
    if (!document.getElementById('settings-extra-styles')) {
      const s = document.createElement('style');
      s.id = 'settings-extra-styles';
      s.textContent = `
        .unit-btn-active  { padding: 5px 14px; border-radius: 7px; font-size: 13px; font-weight: 700; background: #7e47ff; color: #fff; transition: all .15s; }
        .unit-btn-inactive { padding: 5px 14px; border-radius: 7px; font-size: 13px; font-weight: 700; color: #71717a; transition: all .15s; }
        .unit-btn-inactive:hover { color: #e4e4e7; }
        .stepper-btn { width: 34px; height: 34px; border-radius: 10px; background: #181C23; border: 1px solid #2C3442; font-size: 18px; font-weight: 600; color: #e4e4e7; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
        .stepper-btn:not(:disabled):hover { background: #2C3442; }
      `;
      document.head.appendChild(s);
    }
    void root;
  }

  function attachListeners(): void {
    // Unit toggle
    el.querySelector('#unit-kg')?.addEventListener('click', () => { unit = 'kg'; setUnit('kg'); render(); });
    el.querySelector('#unit-lbs')?.addEventListener('click', () => { unit = 'lbs'; setUnit('lbs'); render(); });

    // Weekly goal stepper
    el.querySelector('#goal-dec')?.addEventListener('click', () => {
      if (weeklyGoal > 1) { weeklyGoal--; setWeeklyGoal(weeklyGoal); render(); }
    });
    el.querySelector('#goal-inc')?.addEventListener('click', () => {
      if (weeklyGoal < 7) { weeklyGoal++; setWeeklyGoal(weeklyGoal); render(); }
    });

    // Open data modal
    el.querySelector('#open-data-modal')?.addEventListener('click', () => { dataModalOpen = true; render(); });
    el.querySelector('#close-data-modal')?.addEventListener('click', () => { dataModalOpen = false; render(); });
    el.querySelector('#data-modal')?.addEventListener('click', (e) => {
      if (e.target === el.querySelector('#data-modal')) { dataModalOpen = false; render(); }
    });

    // Export JSON
    el.querySelector('#export-json-btn')?.addEventListener('click', async () => {
      dataModalOpen = false; render();
      await handleExportJSON();
    });

    // Export CSV
    el.querySelector('#export-csv-btn')?.addEventListener('click', async () => {
      dataModalOpen = false; render();
      await handleExportCSV();
    });

    // Import — open mode picker
    el.querySelector('#import-btn')?.addEventListener('click', () => {
      dataModalOpen = false;
      importMode = 'add_only'; // placeholder to show modal
      render();
    });
    el.querySelector('#close-import-modal')?.addEventListener('click', () => { importMode = null; render(); });
    el.querySelector('#import-modal')?.addEventListener('click', (e) => {
      if (e.target === el.querySelector('#import-modal')) { importMode = null; render(); }
    });
    el.querySelector('#import-mode-replace')?.addEventListener('click', () => { importMode = null; render(); triggerImport('replace_all'); });
    el.querySelector('#import-mode-overwrite')?.addEventListener('click', () => { importMode = null; render(); triggerImport('overwrite_existing'); });
    el.querySelector('#import-mode-add')?.addEventListener('click', () => { importMode = null; render(); triggerImport('add_only'); });

    // Hidden file input
    el.querySelector('#import-file-input')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !pendingImportMode) return;
      await handleImportFile(file, pendingImportMode);
      pendingImportMode = null;
      (el.querySelector('#import-file-input') as HTMLInputElement).value = '';
    });

    // Open reset modal
    el.querySelector('#open-reset-modal')?.addEventListener('click', () => { dataModalOpen = false; resetModalOpen = true; render(); });
    el.querySelector('#close-reset-modal')?.addEventListener('click', () => { resetModalOpen = false; render(); });
    el.querySelector('#reset-modal')?.addEventListener('click', (e) => {
      if (e.target === el.querySelector('#reset-modal')) { resetModalOpen = false; render(); }
    });

    // Reset option checkboxes
    el.querySelectorAll('.reset-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset['key'] as ResetKey;
        resetOptions[key] = !resetOptions[key];
        render();
      });
    });

    // Toggle all
    el.querySelector('#toggle-all-btn')?.addEventListener('click', () => {
      const allSel = (Object.keys(resetOptions) as ResetKey[]).every(k => resetOptions[k]);
      (Object.keys(resetOptions) as ResetKey[]).forEach(k => { resetOptions[k] = !allSel; });
      render();
    });

    // Confirm reset
    el.querySelector('#confirm-reset-btn')?.addEventListener('click', async () => {
      const selectedLabels = (Object.keys(resetOptions) as ResetKey[])
        .filter(k => resetOptions[k])
        .map(k => `• ${RESET_LABELS[k].label}`)
        .join('\n');
      if (!confirm(`Stai per cancellare definitivamente:\n\n${selectedLabels}\n\nQuesta operazione è irreversibile.`)) return;
      if (!confirm('Sei sicuro? I dati selezionati verranno eliminati permanentemente.')) return;
      await handleReset();
    });

    // Account actions
    el.querySelector('#upgrade-btn')?.addEventListener('click', () => navigate('/auth'));
    el.querySelector('#logout-btn')?.addEventListener('click', async () => {
      if (!confirm('Sei sicuro di voler uscire?')) return;
      await supabase.auth.signOut();
      navigate('/auth');
    });
    el.querySelector('#delete-account-btn')?.addEventListener('click', async () => {
      if (!confirm('Sei sicuro di voler eliminare definitivamente il tuo account? Tutti i tuoi dati cloud verranno cancellati.')) return;
      if (!confirm('Conferma: questa operazione è irreversibile. Il tuo account verrà eliminato permanentemente.')) return;
      try {
        const { error } = await supabase.rpc('delete_user_account');
        if (error) throw error;
        await supabase.auth.signOut();
        navigate('/auth');
      } catch {
        await supabase.auth.signOut();
        navigate('/auth');
      }
    });

    // Nickname toggle
    el.querySelector('#edit-nickname-btn')?.addEventListener('click', () => {
      el.querySelector('#nickname-form')?.classList.toggle('hidden');
      (el.querySelector('#nickname-input') as HTMLInputElement)?.focus();
    });
    el.querySelector('#cancel-nickname-btn')?.addEventListener('click', () => {
      el.querySelector('#nickname-form')?.classList.add('hidden');
      (el.querySelector('#nickname-input') as HTMLInputElement).value = currentNickname;
      el.querySelector('#nickname-error')?.classList.add('hidden');
      el.querySelector('#nickname-success')?.classList.add('hidden');
    });
    el.querySelector('#save-nickname-btn')?.addEventListener('click', async () => {
      const name = (el.querySelector('#nickname-input') as HTMLInputElement).value.trim();
      const errEl = el.querySelector('#nickname-error') as HTMLElement;
      const okEl  = el.querySelector('#nickname-success') as HTMLElement;
      const btn   = el.querySelector('#save-nickname-btn') as HTMLButtonElement;
      errEl.classList.add('hidden');
      okEl.classList.add('hidden');
      if (!name) { errEl.textContent = 'Inserisci un nickname.'; errEl.classList.remove('hidden'); return; }
      btn.disabled = true; btn.textContent = 'Salvataggio…';
      const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', user?.id);
      btn.disabled = false; btn.textContent = 'Salva';
      if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('hidden');
      } else {
        currentNickname = name;
        okEl.classList.remove('hidden');
        // Update sidebar nickname live without a full page re-render
        window.dispatchEvent(new CustomEvent('vyro:nicknameChanged', { detail: name }));
        // Update the subtitle in the current card
        const subtitleEl = el.querySelector('#edit-nickname-btn')?.closest('.flex')?.querySelector('p.text-xs');
        if (subtitleEl) subtitleEl.textContent = name;
      }
    });

    // Change password toggle
    el.querySelector('#change-pw-btn')?.addEventListener('click', () => {
      el.querySelector('#pw-form')?.classList.toggle('hidden');
    });
    el.querySelector('#cancel-pw-btn')?.addEventListener('click', () => {
      el.querySelector('#pw-form')?.classList.add('hidden');
      (el.querySelector('#new-password') as HTMLInputElement).value = '';
      el.querySelector('#pw-error')?.classList.add('hidden');
      el.querySelector('#pw-success')?.classList.add('hidden');
    });
    el.querySelector('#save-pw-btn')?.addEventListener('click', async () => {
      const pw = (el.querySelector('#new-password') as HTMLInputElement).value;
      const errEl = el.querySelector('#pw-error') as HTMLElement;
      const okEl = el.querySelector('#pw-success') as HTMLElement;
      const btn = el.querySelector('#save-pw-btn') as HTMLButtonElement;
      errEl.classList.add('hidden');
      okEl.classList.add('hidden');
      if (pw.length < 6) {
        errEl.textContent = 'Minimo 6 caratteri.';
        errEl.classList.remove('hidden');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Aggiornamento…';
      const { error } = await supabase.auth.updateUser({ password: pw });
      btn.disabled = false;
      btn.textContent = 'Salva';
      if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('hidden');
      } else {
        (el.querySelector('#new-password') as HTMLInputElement).value = '';
        okEl.classList.remove('hidden');
      }
    });
  }

  // ── Export JSON ─────────────────────────────────────────────────────────────
  async function handleExportJSON(): Promise<void> {
    busy = true; render();
    try {
      const userId = user?.id;
      const [
        { data: exercises },
        { data: templates },
        { data: sessions },
        { data: foodItems },
        { data: nutritionLogs },
        { data: bodyWeight },
        { data: mealPlans },
        { data: recipes },
      ] = await Promise.all([
        supabase.from('exercises').select('*').eq('user_id', userId),
        supabase.from('workout_templates').select('*').eq('user_id', userId),
        supabase.from('workout_sessions').select('*').eq('user_id', userId),
        supabase.from('food_items').select('*').eq('user_id', userId),
        supabase.from('nutrition_logs').select('*').eq('user_id', userId),
        supabase.from('body_weight_logs').select('*').eq('user_id', userId),
        supabase.from('meal_plans').select('*').eq('user_id', userId),
        supabase.from('recipes').select('*').eq('user_id', userId),
      ]);

      const backup = {
        exported_at: new Date().toISOString(),
        app_version: '1.0.0',
        exercises, templates, sessions,
        foodItems, nutritionLogs, bodyWeight,
        mealPlans, recipes,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vyro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Errore durante l\'esportazione: ' + err);
    } finally {
      busy = false; render();
    }
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────
  async function handleExportCSV(): Promise<void> {
    busy = true; render();
    try {
      const userId = user?.id;
      const [
        { data: sessions },
        { data: nutritionLogs },
        { data: bodyWeight },
      ] = await Promise.all([
        supabase.from('workout_sessions').select('*').eq('user_id', userId),
        supabase.from('nutrition_logs').select('*').eq('user_id', userId),
        supabase.from('body_weight_logs').select('*').eq('user_id', userId),
      ]);

      const csvParts: string[] = [];

      // Sessions
      csvParts.push('=== SESSIONI ALLENAMENTO ===');
      csvParts.push('data,template_id,durata_secondi,note');
      (sessions ?? []).forEach((s: Record<string, unknown>) => {
        csvParts.push(`"${s['started_at'] ?? ''}","${s['template_id'] ?? ''}","${s['duration_seconds'] ?? ''}","${String(s['notes'] ?? '').replace(/"/g, '""')}"`);
      });

      csvParts.push('');
      csvParts.push('=== LOG NUTRIZIONE ===');
      csvParts.push('data,tipo_pasto,alimento_id,quantita_g,kcal,proteine,carboidrati,grassi');
      (nutritionLogs ?? []).forEach((n: Record<string, unknown>) => {
        csvParts.push(`"${n['logged_at'] ?? ''}","${n['meal_type'] ?? ''}","${n['food_item_id'] ?? ''}","${n['quantity_g'] ?? ''}","${n['kcal'] ?? ''}","${n['protein_g'] ?? ''}","${n['carbs_g'] ?? ''}","${n['fat_g'] ?? ''}"`);
      });

      csvParts.push('');
      csvParts.push('=== PESO CORPOREO ===');
      csvParts.push('data,peso_kg,fase,note');
      (bodyWeight ?? []).forEach((b: Record<string, unknown>) => {
        csvParts.push(`"${b['logged_at'] ?? ''}","${b['weight_kg'] ?? ''}","${b['phase'] ?? ''}","${String(b['notes'] ?? '').replace(/"/g, '""')}"`);
      });

      const csv = csvParts.join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vyro-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Errore durante l\'esportazione CSV: ' + err);
    } finally {
      busy = false; render();
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  let pendingImportMode: 'replace_all' | 'overwrite_existing' | 'add_only' | null = null;

  function triggerImport(mode: 'replace_all' | 'overwrite_existing' | 'add_only'): void {
    pendingImportMode = mode;
    (el.querySelector('#import-file-input') as HTMLInputElement).click();
  }

  async function handleImportFile(file: File, mode: 'replace_all' | 'overwrite_existing' | 'add_only'): Promise<void> {
    busy = true; render();
    const msgEl = el.querySelector('#global-msg') as HTMLElement;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.exported_at) throw new Error('File non valido: non è un backup Vyro.');

      const userId = user?.id;
      if (!userId) throw new Error('Utente non autenticato.');

      const tableMap: Record<string, unknown[]> = {
        exercises:      data.exercises      ?? [],
        workout_templates: data.templates   ?? [],
        workout_sessions:  data.sessions    ?? [],
        food_items:     data.foodItems      ?? [],
        nutrition_logs: data.nutritionLogs  ?? [],
        body_weight_logs: data.bodyWeight   ?? [],
        meal_plans:     data.mealPlans      ?? [],
        recipes:        data.recipes        ?? [],
      };

      if (mode === 'replace_all') {
        // Delete all first
        for (const table of Object.keys(tableMap)) {
          await supabase.from(table).delete().eq('user_id', userId);
        }
      }

      for (const [table, rows] of Object.entries(tableMap)) {
        if (!rows.length) continue;
        const enriched = rows.map((r: unknown) => ({ ...(r as Record<string, unknown>), user_id: userId }));
        if (mode === 'add_only') {
          await supabase.from(table).insert(enriched);
        } else {
          // replace_all (already deleted) or overwrite_existing
          await supabase.from(table).upsert(enriched, { onConflict: 'id' });
        }
      }

      msgEl.textContent = 'Importazione completata con successo.';
      msgEl.className = 'text-sm mt-3 text-brand-400 text-center';
      msgEl.classList.remove('hidden');
      setTimeout(() => msgEl.classList.add('hidden'), 4000);
    } catch (err) {
      msgEl.textContent = 'Errore: ' + (err instanceof Error ? err.message : String(err));
      msgEl.className = 'text-sm mt-3 text-red-400 text-center';
      msgEl.classList.remove('hidden');
      setTimeout(() => msgEl.classList.add('hidden'), 5000);
    } finally {
      busy = false; render();
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  async function handleReset(): Promise<void> {
    const userId = user?.id;
    if (!userId) return;
    busy = true; resetModalOpen = false; render();
    const msgEl = el.querySelector('#global-msg') as HTMLElement;
    try {
      const selected = (Object.keys(resetOptions) as ResetKey[]).filter(k => resetOptions[k]);
      for (const key of selected) {
        for (const table of RESET_TABLES[key]) {
          await supabase.from(table).delete().eq('user_id', userId);
        }
      }
      resetOptions = { sessions: false, templates: false, nutritionLogs: false, mealPlans: false, bodyWeight: false, foodCatalog: false };
      msgEl.textContent = 'Reset completato.';
      msgEl.className = 'text-sm mt-3 text-brand-400 text-center';
      msgEl.classList.remove('hidden');
      setTimeout(() => msgEl.classList.add('hidden'), 4000);
    } catch (err) {
      msgEl.textContent = 'Errore durante il reset: ' + (err instanceof Error ? err.message : String(err));
      msgEl.className = 'text-sm mt-3 text-red-400 text-center';
      msgEl.classList.remove('hidden');
      setTimeout(() => msgEl.classList.add('hidden'), 5000);
    } finally {
      busy = false; render();
    }
  }

  render();
  return el;
}
