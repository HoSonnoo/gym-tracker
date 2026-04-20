import { supabase } from '@/lib/supabase';

export async function renderAuth(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'min-h-screen flex items-center justify-center bg-[#0F1115] p-4';

  el.innerHTML = `
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">V</div>
        <h1 class="text-2xl font-bold text-zinc-100">Vyro</h1>
        <p class="text-zinc-500 text-sm mt-1">Il tuo tracker fitness</p>
      </div>

      <div class="card">
        <!-- OAuth buttons -->
        <div class="flex flex-col gap-2 mb-5">
          <button id="google-btn" class="btn-secondary w-full gap-3">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continua con Google
          </button>
          <button id="apple-btn" class="btn-secondary w-full gap-3">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Continua con Apple
          </button>
        </div>

        <div class="flex items-center gap-3 mb-5">
          <div class="flex-1 border-t border-[#2C3442]"></div>
          <span class="text-xs text-zinc-600">oppure</span>
          <div class="flex-1 border-t border-[#2C3442]"></div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-5 bg-[#222834] rounded-lg p-1">
          <button id="tab-login" class="flex-1 py-1.5 text-sm font-medium rounded-md bg-[#2C3442] text-zinc-100 transition-all">Accedi</button>
          <button id="tab-register" class="flex-1 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-100 transition-all">Registrati</button>
        </div>

        <!-- Login form -->
        <form id="form-login" class="flex flex-col gap-4">
          <div>
            <label class="label">Email</label>
            <input id="login-email" type="email" class="input" placeholder="tu@esempio.com" autocomplete="email" />
          </div>
          <div>
            <label class="label">Password</label>
            <input id="login-password" type="password" class="input" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <p id="login-error" class="text-red-400 text-sm hidden"></p>
          <button type="submit" id="login-submit" class="btn-primary w-full">Accedi</button>
        </form>

        <!-- Register form (hidden) -->
        <form id="form-register" class="flex flex-col gap-4 hidden">
          <div>
            <label class="label">Email</label>
            <input id="reg-email" type="email" class="input" placeholder="tu@esempio.com" autocomplete="email" />
          </div>
          <div>
            <label class="label">Password</label>
            <input id="reg-password" type="password" class="input" placeholder="Minimo 6 caratteri" autocomplete="new-password" />
          </div>
          <p id="reg-error" class="text-red-400 text-sm hidden"></p>
          <p id="reg-success" class="text-brand-400 text-sm hidden">Controlla la tua email per confermare la registrazione.</p>
          <button type="submit" id="reg-submit" class="btn-primary w-full">Crea account</button>
        </form>

        <div class="divider"></div>

        <button id="guest-btn" class="btn-secondary w-full">Continua come ospite</button>
      </div>
    </div>
  `;

  // Tab switching
  const tabLogin = el.querySelector('#tab-login') as HTMLButtonElement;
  const tabRegister = el.querySelector('#tab-register') as HTMLButtonElement;
  const formLogin = el.querySelector('#form-login') as HTMLFormElement;
  const formRegister = el.querySelector('#form-register') as HTMLFormElement;

  function setTab(active: 'login' | 'register'): void {
    const activeClass = 'flex-1 py-1.5 text-sm font-medium rounded-md bg-[#2C3442] text-zinc-100 transition-all';
    const inactiveClass = 'flex-1 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-100 transition-all';
    if (active === 'login') {
      tabLogin.className = activeClass;
      tabRegister.className = inactiveClass;
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    } else {
      tabRegister.className = activeClass;
      tabLogin.className = inactiveClass;
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
    }
  }

  tabLogin.addEventListener('click', () => setTab('login'));
  tabRegister.addEventListener('click', () => setTab('register'));

  // Google OAuth
  el.querySelector('#google-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#google-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Reindirizzamento…';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  });

  // Apple OAuth
  el.querySelector('#apple-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#apple-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Reindirizzamento…';
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
  });

  // Login submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (el.querySelector('#login-email') as HTMLInputElement).value.trim();
    const password = (el.querySelector('#login-password') as HTMLInputElement).value;
    const errEl = el.querySelector('#login-error') as HTMLElement;
    const btn = el.querySelector('#login-submit') as HTMLButtonElement;

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Accesso in corso…';

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errEl.textContent = error.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Accedi';
    }
    // On success: onAuthStateChange in main.ts calls mountApp()
  });

  // Register submit
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (el.querySelector('#reg-email') as HTMLInputElement).value.trim();
    const password = (el.querySelector('#reg-password') as HTMLInputElement).value;
    const errEl = el.querySelector('#reg-error') as HTMLElement;
    const successEl = el.querySelector('#reg-success') as HTMLElement;
    const btn = el.querySelector('#reg-submit') as HTMLButtonElement;

    errEl.classList.add('hidden');
    successEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Registrazione…';

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      errEl.textContent = error.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Crea account';
    } else {
      successEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Crea account';
    }
  });

  // Guest
  el.querySelector('#guest-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#guest-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Caricamento…';
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      btn.disabled = false;
      btn.textContent = 'Continua come ospite';
      alert('Login ospite non disponibile: ' + error.message);
    }
    // On success: onAuthStateChange in main.ts calls mountApp()
  });

  return el;
}
