import { navigate, currentPath } from '@/router';
import { supabase } from '@/lib/supabase';

type NavItem = {
  path: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { path: '/',           label: 'Home',        icon: homeIcon() },
  { path: '/workouts',   label: 'Allenamenti', icon: workoutsIcon() },
  { path: '/nutrition',  label: 'Nutrizione',  icon: nutritionIcon() },
  { path: '/calendar',   label: 'Calendario',  icon: calendarIcon() },
  { path: '/progress',   label: 'Progressi',   icon: progressIcon() },
];

export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'flex flex-col w-60 min-h-screen bg-zinc-900 border-r border-zinc-800 px-3 py-5 shrink-0';

  // Logo
  const logo = document.createElement('div');
  logo.className = 'flex items-center gap-2 px-3 mb-8';
  logo.innerHTML = `
    <div class="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm">V</div>
    <span class="text-lg font-bold text-zinc-100">Vyro</span>
  `;
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

  supabase.auth.getSession().then(({ data: { session } }) => {
    const email = session?.user?.email;
    const isAnon = session?.user?.is_anonymous;

    bottom.innerHTML = `
      <div class="px-3 py-2 text-xs text-zinc-500 truncate mb-1">
        ${isAnon ? 'Ospite' : (email ?? '')}
      </div>
      <button id="logout-btn" class="nav-link-inactive w-full text-left">
        ${logoutIcon()}
        <span>Esci</span>
      </button>
    `;

    bottom.querySelector('#logout-btn')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      navigate('/auth');
    });
  });

  sidebar.appendChild(bottom);
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

function logoutIcon(): string {
  return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
  </svg>`;
}
