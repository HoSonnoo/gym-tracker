type RouteHandler = () => Promise<HTMLElement>;

const routes = new Map<string, RouteHandler>();

export function registerRoute(path: string, handler: RouteHandler): void {
  routes.set(path, handler);
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function currentPath(): string {
  const hash = window.location.hash.slice(1); // strip '#'
  return hash || '/';
}

export async function startRouter(container: HTMLElement): Promise<void> {
  async function render(): Promise<void> {
    const path = currentPath();

    // Match exact or strip query params
    const basePath = path.split('?')[0];
    const handler = routes.get(basePath) ?? routes.get('/404');

    container.innerHTML = '';

    if (!handler) {
      container.innerHTML = '<div class="p-8 text-zinc-400">Pagina non trovata.</div>';
      return;
    }

    // Show loading state briefly
    container.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="spinner"></div>
      </div>
    `;

    try {
      const el = await handler();
      container.innerHTML = '';
      container.appendChild(el);
    } catch (err) {
      console.error('Router render error:', err);
      container.innerHTML = `
        <div class="p-8 text-red-400">
          Errore nel caricamento della pagina.
        </div>
      `;
    }
  }

  window.addEventListener('hashchange', () => render());
  await render();
}
