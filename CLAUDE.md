# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo dev server (interactive)
npm run ios        # Start with iOS simulator
npm run android    # Start with Android emulator
npm run web        # Start web version
npm run lint       # Run ESLint (expo config)
eas build          # Production build via EAS
```

No test runner is configured — there are no test files in this repo.

## Architecture

**Vyro** is a React Native + Expo fitness tracking app (iOS/Android/Web) with bundle ID `com.hosonno.gymtracker`.

### Navigation
File-based routing via **expo-router 6**. The entry point is `app/_layout.tsx`, which initializes the SQLite database and checks auth state before rendering. Main navigation is a tab bar at `app/(tabs)/` with 5 screens: Home, Workouts, Nutrition, Calendar, Progress. Modal/stack screens live at the root `app/` level (`auth.tsx`, `onboarding.tsx`, `settings.tsx`, `exercises.tsx`, etc.).

### Data Layer
Two parallel storage systems:
- **SQLite** (`database/index.ts`) — local offline-first store for all fitness data: exercises, workout templates, sessions, meal plans. All CRUD operations are defined here (~1000 LOC). The DB is initialized async at app start in the root layout.
- **Supabase** (`lib/supabase.ts`) — cloud backend for authentication and user profiles. Client uses AsyncStorage for session persistence.

### Auth & User Tiers
`context/AuthContext.tsx` manages auth state. Users can be `guest | registered | premium`. Auth options: email/password, Apple ID, Google OAuth (via deep linking). Unauthenticated users land on `app/auth.tsx`; new users go through `app/onboarding.tsx`. Feature gating for guests is handled by the `hooks/use-guest-limits.ts` hook.

### iOS Health Integration
`lib/healthkit.ts` wraps `react-native-health` for HealthKit access (steps, distance, active energy burned). Only active on iOS.

### State Management
React Context only — no Redux or Zustand. Key contexts:
- `AuthContext` — user session and tier
- `UserPreferencesContext` — theme and user settings
- `RestTimerContext` — rest timer state shared across workout screens

### Key Config
- `app.json` — Expo config, build numbers, permissions
- `eas.json` — EAS build profiles (development/preview/production)
- TypeScript strict mode, path alias `@/*` → repo root
- React Compiler experiment and New Architecture (`newArchEnabled`) both enabled

---

## Web Version (`web/`)

A standalone SPA built with **Vanilla TypeScript + Vite + Tailwind CSS**, separate from the React Native app. Entry point: `web/src/main.ts`.

### Commands

```bash
cd web
npm run dev    # Start Vite dev server (default port 5173)
npm run build  # Production build → web/dist/
npm run preview # Preview production build
npx tsc --noEmit # Type-check without emitting
```

### Architecture

No framework — pure DOM manipulation. Each page is a function that returns an `HTMLElement`, mounted by a hash-based router.

**Stack:**
- **Vite** — bundler and dev server
- **Tailwind CSS v4** — utility classes, custom components in `src/styles.css`
- **TypeScript strict mode** — path alias `@/*` → `web/src/`
- **Supabase JS client** — all data (auth + database). No SQLite.

### Router (`src/router.ts`)

Hash-based SPA router (`#/path?param=value`). Key functions:
- `registerRoute(path, renderFn)` — maps a path to an async render function
- `startRouter(container)` — begins listening and mounts the first page
- `navigate(path)` — pushes a new hash
- `currentPath()` — returns the current path (without query string)
- `resetRouter()` — clears all routes (called on auth state change)

Query params are read from the hash manually in each page:
```ts
function getHashParam(key: string): string | null {
  const hash = window.location.hash;
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return null;
  return new URLSearchParams(hash.slice(qIdx + 1)).get(key);
}
```

### Layout (`src/components/layout.ts`, `src/components/sidebar.ts`)

`createAppLayout(contentContainer)` returns a flex wrapper (`h-screen overflow-hidden`) with:
- **Sidebar** (`w-72`, `h-full overflow-y-auto`) — fixed vertically, independent scroll
- **Main** (`flex-1 overflow-y-auto`) — scrollable content area

The sidebar fetches the user's `display_name` from the `profiles` Supabase table and keeps a live DOM reference to the nickname span. Cross-component nickname sync uses a custom DOM event:
```ts
// settings page dispatches:
window.dispatchEvent(new CustomEvent('vyro:nicknameChanged', { detail: name }));
// sidebar listens:
window.addEventListener('vyro:nicknameChanged', (e) => { nicknameSpan.textContent = e.detail; });
```

### Pages (`src/pages/`)

| File | Route | Description |
|------|-------|-------------|
| `auth.ts` | `/auth` | Login / register |
| `home.ts` | `/` | Dashboard |
| `workouts.ts` | `/workouts` | Templates list, exercises catalog |
| `template.ts` | `/template?id=X` | Template detail: exercises, reorder, superset pairing |
| `template-exercise.ts` | `/template-exercise?id=X&template=Y` | Set configuration for a template exercise |
| `workout-session.ts` | `/workout-session?template=X` or `?session=X` | Active workout session with live timer, rest timer, per-set fields |
| `nutrition.ts` | `/nutrition` | Food diary, meal plans, recipes, body tracking |
| `calendar.ts` | `/calendar` | Monthly grid, completed sessions per day, delete sessions |
| `progress.ts` | `/progress` | Global stats, PRs, exercise volume |
| `exercises.ts` | `/exercises` | Exercise catalog CRUD |
| `settings.ts` | `/settings` | Nickname, preferences, data import/export, account management |

### Data Layer (`src/repository/`)

All repositories use the Supabase JS client with RLS. Key pattern: **`pgErr()` helper** wraps `PostgrestError` (plain object, not an `instanceof Error`) so it can be caught and displayed:
```ts
function pgErr(error: { message?: string }): Error {
  return new Error(error.message ?? JSON.stringify(error));
}
```

| File | Tables |
|------|--------|
| `workouts.ts` | `workout_templates`, `workout_template_exercises`, `template_exercise_sets`, `workout_sessions`, `workout_session_exercises`, `workout_session_sets` |
| `nutrition.ts` | `food_items`, `nutrition_logs`, `water_logs` |
| `exercises.ts` | `exercises` |
| `mealplans.ts` | `meal_plans`, `recipes` |

**Known schema quirk:** `nutrition_logs` does NOT have a `food_item_id` column — it is omitted from the insert in `repository/nutrition.ts`.

### Components (`src/components/`)

- **`sidebar.ts`** — `createSidebar()` — nav links, user nickname, settings/logout
- **`layout.ts`** — `createAppLayout(contentContainer)` — full-page flex wrapper
- **`chatbot.ts`** — `mountChatbot()` — floating 🤖 button, chat window, calls `anthropic-proxy` Supabase Edge Function with model `claude-haiku-4-5-20251001`

### Chatbot (`src/components/chatbot.ts`)

Floating FAB (fixed bottom-right). Calls the `anthropic-proxy` Edge Function on the same Supabase project as auth. Model: `claude-haiku-4-5-20251001`. Enter = send, Shift+Enter = newline.

### Styles (`src/styles.css`)

Tailwind v4 with custom component classes:
- `.nav-link`, `.nav-link-active`, `.nav-link-inactive` — sidebar navigation
- `.btn-primary`, `.btn-secondary`, `.btn-ghost` — buttons
- `.card` — dark rounded card
- `.input`, `.label` — form controls
- `.badge-green`, `.badge-zinc` — status badges
- `.page-header`, `.section-title` — typography
- `.spinner` — loading spinner

### Workout Session Features

`src/pages/workout-session.ts` implements:
- **Live session timer** — `setInterval` ticking every second, survives re-renders via `id="session-timer"` lookup
- **Rest timer** — fixed bottom overlay (`document.body`) counting down `target_rest_seconds` after marking a set complete; "Salta" button to dismiss
- **Last session reference** — fetches previous session sets via `getLastSessionSetsForExercise()`, shown per exercise and per set position
- **Effort type** — selector per set (Nessuno / Buffer RIR / Cedimento / Drop set); buffer value row toggles without full re-render
- **Auto-save on blur** — all inputs (weight, reps, effort, buffer, notes) save to Supabase on `blur`
