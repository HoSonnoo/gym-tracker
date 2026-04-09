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
