import { supabase } from '@/lib/supabase';
import { navigate } from '@/router';

export async function renderAuth(): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.className = 'min-h-screen flex items-center justify-center bg-zinc-950 p-4';

  el.innerHTML = `
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">V</div>
        <h1 class="text-2xl font-bold text-zinc-100">Vyro</h1>
        <p class="text-zinc-500 text-sm mt-1">Il tuo tracker fitness</p>
      </div>

      <div class="card">
        <!-- Tabs -->
        <div class="flex gap-1 mb-6 bg-zinc-800 rounded-lg p-1">
          <button id="tab-login" class="flex-1 py-1.5 text-sm font-medium rounded-md bg-zinc-700 text-zinc-100 transition-all">Accedi</button>
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

  tabLogin.addEventListener('click', () => {
    tabLogin.className = 'flex-1 py-1.5 text-sm font-medium rounded-md bg-zinc-700 text-zinc-100 transition-all';
    tabRegister.className = 'flex-1 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-100 transition-all';
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.className = 'flex-1 py-1.5 text-sm font-medium rounded-md bg-zinc-700 text-zinc-100 transition-all';
    tabLogin.className = 'flex-1 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-100 transition-all';
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
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
    } else {
      navigate('/');
    }
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
    if (!error) {
      navigate('/');
    } else {
      btn.disabled = false;
      btn.textContent = 'Continua come ospite';
      alert('Login ospite non disponibile: ' + error.message);
    }
  });

  return el;
}
