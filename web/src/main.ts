import '@/styles.css';
import { supabase } from '@/lib/supabase';
import { registerRoute, startRouter, navigate, currentPath, resetRouter } from '@/router';
import { mountChatbot } from '@/components/chatbot';
import { createAppLayout } from '@/components/layout';
import { renderAuth } from '@/pages/auth';
import { renderHome } from '@/pages/home';
import { renderWorkouts } from '@/pages/workouts';
import { renderNutrition } from '@/pages/nutrition';
import { renderCalendar } from '@/pages/calendar';
import { renderProgress } from '@/pages/progress';
import { renderExercises } from '@/pages/exercises';
import { renderSettings } from '@/pages/settings';
import { renderTemplate } from '@/pages/template';
import { renderTemplateExercise } from '@/pages/template-exercise';
import { renderWorkoutSession } from '@/pages/workout-session';
import { renderLogHistorical } from '@/pages/log-historical';

const appEl = document.getElementById('app')!;
let appMounted = false;

function mountAuth(): void {
  appMounted = false;
  resetRouter();
  appEl.innerHTML = '';
  registerRoute('/auth', renderAuth);
  startRouter(appEl);
  if (currentPath() !== '/auth') navigate('/auth');
}

function mountApp(): void {
  if (appMounted) {
    // Already mounted — just redirect away from auth if needed
    if (currentPath() === '/auth') navigate('/');
    return;
  }
  appMounted = true;
  resetRouter();
  appEl.innerHTML = '';

  const contentContainer = document.createElement('div');
  const layout = createAppLayout(contentContainer);
  appEl.appendChild(layout);

  registerRoute('/', renderHome);
  registerRoute('/workouts', renderWorkouts);
  registerRoute('/nutrition', renderNutrition);
  registerRoute('/calendar', renderCalendar);
  registerRoute('/progress', renderProgress);
  registerRoute('/exercises', renderExercises);
  registerRoute('/settings', renderSettings);
  registerRoute('/template', renderTemplate);
  registerRoute('/template-exercise', renderTemplateExercise);
  registerRoute('/workout-session', renderWorkoutSession);
  registerRoute('/log-historical', renderLogHistorical);
  registerRoute('/auth', renderAuth);

  startRouter(contentContainer);

  if (currentPath() === '/auth' || currentPath() === '') navigate('/');
}

async function bootstrap(): Promise<void> {
  mountChatbot();
  const { data: { session } } = await supabase.auth.getSession();

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      appMounted = false;
      mountAuth();
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      mountApp();
    }
  });

  if (session) {
    mountApp();
  } else {
    mountAuth();
  }
}

bootstrap();
