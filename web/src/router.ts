type RouteHandler = () => Promise<HTMLElement>;

const routes = new Map<string, RouteHandler>();
let routerStarted = false;
let routerContainer: HTMLElement | null = null;

export function registerRoute(path: string, handler: RouteHandler): void {
  routes.set(path, handler);
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function currentPath(): string {
  const hash = window.location.hash.slice(1);
  return hash || '/';
}

export async function startRouter(container: HTMLElement): Promise<void> {
  routerContainer = container;

  async function render(): Promise<void> {
    if (!routerContainer) return;
    const path = currentPath().split('?')[0];
    const handler = routes.get(path) ?? routes.get('/404');

    routerContainer.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="spinner"></div>
      </div>
    `;

    if (!handler) {
      routerContainer.innerHTML = '<div class="p-8 text-zinc-400">Pagina non trovata.</div>';
      return;
    }

    try {
      const el = await handler();
      if (routerContainer) {
        routerContainer.innerHTML = '';
        routerContainer.appendChild(el);
      }
    } catch (err) {
      console.error('Router render error:', err);
      if (routerContainer) {
        routerContainer.innerHTML = `<div class="p-8 text-red-400">Errore nel caricamento della pagina: ${err}</div>`;
      }
    }
  }

  if (!routerStarted) {
    routerStarted = true;
    window.addEventListener('hashchange', () => render());
  }

  await render();
}

export function resetRouter(): void {
  routes.clear();
  routerStarted = false;
  routerContainer = null;
}
