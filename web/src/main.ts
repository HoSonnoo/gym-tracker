import '@/styles.css';
import { supabase } from '@/lib/supabase';
import { registerRoute, startRouter, navigate, currentPath } from '@/router';
import { createAppLayout } from '@/components/layout';
import { renderAuth } from '@/pages/auth';
import { renderHome } from '@/pages/home';
import { renderWorkouts } from '@/pages/workouts';
import { renderNutrition } from '@/pages/nutrition';
import { renderCalendar } from '@/pages/calendar';
import { renderProgress } from '@/pages/progress';

const appEl = document.getElementById('app')!;

async function bootstrap(): Promise<void> {
  // Handle OAuth redirect
  const { data: { session } } = await supabase.auth.getSession();

  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, _session) => {
    if (event === 'SIGNED_OUT') {
      mountAuth();
    } else if (event === 'SIGNED_IN' && currentPath() === '/auth') {
      navigate('/');
    }
  });

  if (!session) {
    mountAuth();
    return;
  }

  mountApp();
}

function mountAuth(): void {
  appEl.innerHTML = '';
  // Auth page is standalone (no sidebar)
  registerRoute('/auth', renderAuth);
  startRouter(appEl);
  if (currentPath() !== '/auth') navigate('/auth');
}

function mountApp(): void {
  appEl.innerHTML = '';

  const contentContainer = document.createElement('div');
  contentContainer.className = 'p-0';

  const layout = createAppLayout(contentContainer);
  appEl.appendChild(layout);

  // Register all app routes
  registerRoute('/', renderHome);
  registerRoute('/workouts', renderWorkouts);
  registerRoute('/nutrition', renderNutrition);
  registerRoute('/calendar', renderCalendar);
  registerRoute('/progress', renderProgress);
  registerRoute('/auth', renderAuth);

  startRouter(contentContainer);

  // If on auth route, redirect to home
  if (currentPath() === '/auth') navigate('/');
}

bootstrap();
