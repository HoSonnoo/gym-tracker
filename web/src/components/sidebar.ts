import { supabase } from '@/lib/supabase';
import { currentPath, navigate } from '@/router';

type NavItem = {
  path: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { path: '/',          label: 'Home',        icon: homeIcon() },
  { path: '/workouts',  label: 'Allenamenti', icon: workoutsIcon() },
  { path: '/nutrition', label: 'Nutrizione',  icon: nutritionIcon() },
  { path: '/calendar',  label: 'Calendario',  icon: calendarIcon() },
  { path: '/progress',  label: 'Progressi',   icon: progressIcon() },
];

export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'flex flex-col w-72 h-full bg-zinc-900 border-r border-zinc-800 px-3 py-5 shrink-0 overflow-y-auto';

  // Logo
  const logo = document.createElement('div');
  logo.className = 'flex items-center gap-2 px-3 mb-8';
  logo.innerHTML = `<span class="text-lg font-bold text-zinc-100">Vyro</span>`;
  sidebar.appendChild(logo);

  // Nav links
  const nav = document.createElement('nav');
  nav.className = 'flex flex-col gap-1 flex-1';

  function renderLinks(): void {
    nav.innerHTML = '';
    const path = currentPath().split('?')[0];

    for (const item of NAV_ITEMS) {
      const link = document.createElement('a');
      const isActive = path === item.path;
      link.className = isActive ? 'nav-link-active' : 'nav-link-inactive';
      link.innerHTML = `${item.icon}<span>${item.label}</span>`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.path);
      });
      nav.appendChild(link);
    }
  }

  renderLinks();
  window.addEventListener('hashchange', renderLinks);
  sidebar.appendChild(nav);

  // Bottom: user / logout
  const bottom = document.createElement('div');
  bottom.className = 'mt-auto pt-4 border-t border-zinc-800';

  // Nickname span — kept as a live reference so it can be updated without
  // re-rendering the whole bottom section.
  const nicknameSpan = document.createElement('span');
  nicknameSpan.className = 'text-xs text-zinc-500 truncate max-w-[130px]';
  nicknameSpan.textContent = '…';

  supabase.auth.getSession().then(async ({ data: { session } }) => {
    const user   = session?.user;
    const isAnon = user?.is_anonymous;

    // Fetch display_name from profiles
    let nickname = isAnon ? 'Ospite' : (user?.email ?? '');
    if (user && !isAnon) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();
        if (profile?.display_name) nickname = profile.display_name;
      } catch { /* use email fallback */ }
    }

    nicknameSpan.textContent = nickname;
    nicknameSpan.title = nickname;

    const topRow = document.createElement('div');
    topRow.className = 'flex items-center justify-between px-3 py-2 mb-1';
    topRow.appendChild(nicknameSpan);

    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'settings-btn';
    settingsBtn.title = 'Impostazioni';
    settingsBtn.className = 'p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-all';
    settingsBtn.innerHTML = settingsIcon();
    settingsBtn.addEventListener('click', () => navigate('/settings'));
    topRow.appendChild(settingsBtn);

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-link-inactive w-full text-left';
    logoutBtn.innerHTML = `${logoutIcon()}<span>Esci</span>`;
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      navigate('/auth');
    });

    bottom.appendChild(topRow);
    bottom.appendChild(logoutBtn);
  });

  sidebar.appendChild(bottom);

  // Listen for nickname changes dispatched from the settings page
  window.addEventListener('vyro:nicknameChanged', (e: Event) => {
    const newName = (e as CustomEvent<string>).detail;
    nicknameSpan.textContent = newName;
    nicknameSpan.title = newName;
  });

  return sidebar;
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

function homeIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 21V12h6v9"/>
  </svg>`;
}

function workoutsIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
  </svg>`;
}

function nutritionIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M12 3c-1.5 4-4 6-4 9a4 4 0 008 0c0-3-2.5-5-4-9z"/>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 12v9"/>
  </svg>`;
}

function calendarIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke-width="2" stroke-linecap="round"/>
    <path stroke-linecap="round" stroke-width="2" d="M16 2v4M8 2v4M3 10h18"/>
  </svg>`;
}

function progressIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M3 17l4-8 4 4 4-6 4 5"/>
  </svg>`;
}

function settingsIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>`;
}

function logoutIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
  </svg>`;
}
