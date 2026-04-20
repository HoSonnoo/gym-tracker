import { createSidebar } from '@/components/sidebar';

export function createAppLayout(contentContainer: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex h-screen overflow-hidden';

  const sidebar = createSidebar();
  wrapper.appendChild(sidebar);

  const main = document.createElement('main');
  main.className = 'flex-1 overflow-y-auto';
  main.appendChild(contentContainer);
  wrapper.appendChild(main);

  return wrapper;
}
