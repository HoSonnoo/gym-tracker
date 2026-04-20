import { createSidebar } from '@/components/sidebar';

export function createAppLayout(contentContainer: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex min-h-screen';

  const sidebar = createSidebar();
  wrapper.appendChild(sidebar);

  const main = document.createElement('main');
  main.className = 'flex-1 overflow-auto';
  main.appendChild(contentContainer);
  wrapper.appendChild(main);

  return wrapper;
}
