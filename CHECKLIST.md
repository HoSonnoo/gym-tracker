# Vyro — Checklist di sviluppo
> Aggiornata al 2026-04-21 — allineata al codice reale

---

## App Mobile (React Native + Expo)

### Auth & Onboarding
- [x] Registrazione email/password
- [x] Login Google OAuth (deep link)
- [x] Login Apple ID
- [x] Modalità ospite (guest) con limiti (2 template, 15 esercizi, 14 gg storia)
- [x] Schermata onboarding al primo accesso
- [x] Redirect automatico auth → tab principale
- [x] User tier: guest / registered / premium (modello dati + UI settings)
- [ ] Premium: feature gating reale (paywall, acquisto in-app)

### Home (Dashboard)
- [x] Stats globali: sessioni totali, volume totale, streak attuale, miglior streak
- [x] Sessione attiva con timer live
- [x] Sessioni completate oggi
- [x] Avvio rapido da template
- [x] Preview piano alimentare del giorno

### Allenamenti — Template
- [x] Lista template
- [x] Creazione template (nome + note)
- [x] Eliminazione template
- [x] Template detail: lista esercizi, riordino drag, pairing superset
- [x] Aggiunta esercizio a template (da catalogo)
- [x] Configurazione esercizio: sets target, reps min/max, rest, note
- [x] Configurazione set singolo (type, weight, reps, effort, buffer, rest, note)

### Allenamenti — Sessione attiva
- [x] Avvio sessione da template
- [x] Timer sessione live (tick ogni secondo)
- [x] Rest timer con countdown overlay + dismiss
- [x] Notifica push rest timer (iOS/Android)
- [x] Per-set: peso, reps, tipo sforzo (Nessuno/Buffer RIR/Cedimento/Drop set)
- [x] Riferimento ultima sessione per esercizio e set
- [x] Aggiunta esercizi durante sessione
- [x] Aggiunta serie durante sessione
- [x] Rimozione serie / esercizio dalla sessione
- [x] Completamento sessione (rating, note)
- [x] Cancellazione sessione
- [x] Auto-save on blur su tutti i campi

### Allenamenti — Log storico
- [x] Inserimento manuale sessione passata (data, nome, note)
- [x] Selezione esercizi da catalogo o nome libero
- [x] Serie per ogni esercizio (warmup/target, peso, reps)
- [x] Opzione usa nome da template esistente

### Esercizi
- [x] Catalogo esercizi con categorie
- [x] Creazione esercizio
- [x] Modifica esercizio
- [x] Eliminazione esercizio
- [x] Ricerca esercizi

### Nutrizione
- [x] Diario alimentare per data (log per pasto)
- [x] Catalogo alimenti con macro (kcal, proteine, carboidrati, grassi)
- [x] Aggiunta alimento al diario
- [x] Eliminazione log
- [x] Tracciamento acqua giornaliero (ml)
- [x] Peso corporeo con fase Bulk/Cut/Mantenimento
- [x] Piano alimentare settimanale/ciclico
- [x] Giorni pasto per piano, entries per giorno
- [x] AI import piano da PDF (claude-haiku via Edge Function)
- [x] Ricette (manuale + AI import da PDF)
- [x] Calcolo macro giornalieri da diario
- [x] Animazione "Bulk pulsante" sul tracking peso

### Calendario
- [x] Griglia mensile con giorni di allenamento evidenziati
- [x] Lista sessioni per giorno selezionato
- [x] Eliminazione sessione dal calendario
- [x] Navigazione mese precedente/successivo

### Progressi
- [x] Record personali (PR) per esercizio
- [x] Volume per esercizio (grafico SVG)
- [x] Storico peso per esercizio con dettaglio per sessione
- [x] Frequenza settimanale (chart SVG)
- [x] Peso corporeo (grafico con fase)
- [x] Attività HealthKit — iOS: passi, distanza, calorie attive
- [x] Tab segmentata: PR / Volume / Frequenza / Peso / Attività

### Settings
- [x] Nickname (sync su Supabase profiles)
- [x] Unità di misura (kg / lbs)
- [x] Obiettivo settimanale allenamenti
- [x] Export dati JSON
- [x] Export dati CSV
- [x] Import dati JSON (replace_all / overwrite_existing / add_only)
- [x] Reset selettivo (sessioni, template, log nutrizione, piani, peso, catalogo)
- [x] Info account (email, tier, logout)

### Infrastruttura Mobile
- [x] SQLite locale offline-first (database/index.ts ~1000 LOC)
- [x] Supabase: auth + cloud backup
- [x] Sync Engine SQLite → Supabase (native, 12 tabelle)
- [x] Pull da Supabase all'avvio (sync bidirezionale base)
- [x] ChatBot (FAB, claude-haiku-4-5-20251001 via Edge Function)
- [x] HealthKit wrapper (iOS)
- [x] Notifiche push (rest timer)
- [x] Tema dark fisso
- [x] AppSidebar (variante web dell'app Expo)
- [x] Deep link OAuth Google
- [x] EAS Build config (development / preview / production)
- [x] Codemagic CI config

---

## Web SPA (Vanilla TypeScript + Vite + Tailwind CSS)

### Auth
- [x] Login / registrazione email
- [x] OAuth Google
- [x] Bottone Apple (UI presente, flusso OAuth web non verificato)

### Home
- [x] Stats globali
- [x] Sessioni completate oggi
- [x] Preview piano alimentare
- [x] Avvio rapido da template

### Allenamenti
- [x] Lista template + creazione + eliminazione
- [x] Template detail (esercizi, riordino, superset)
- [x] Configurazione esercizio template
- [x] Sessione attiva: timer, rest timer overlay, per-set tracking, effort, add/remove esercizi e serie
- [x] Log storico manuale

### Esercizi
- [x] CRUD completo con ricerca e categorie

### Nutrizione
- [x] Diario alimentare per data
- [x] Catalogo alimenti
- [x] Acqua giornaliera
- [x] Peso corporeo + fase
- [x] Piano alimentare (AI import PDF)
- [x] Ricette (manuale + AI import PDF)

### Calendario
- [x] Griglia mensile, sessioni per giorno, dettaglio sessione, elimina

### Progressi
- [x] Stats globali, PR, volume (Chart.js), frequenza settimanale, PR history per esercizio

### Settings
- [x] Nickname, unità, obiettivo settimanale
- [x] Export / Import JSON
- [x] Reset selettivo per categoria

### Infrastruttura Web
- [x] Hash-based router con query params
- [x] Layout flex sidebar + main scroll
- [x] Sidebar con nickname live, link, logout
- [x] ChatBot FAB (claude-haiku-4-5-20251001)
- [x] Supabase JS (auth + RLS)
- [x] Repository pattern con pgErr helper
- [x] Vite + Tailwind v4 + TypeScript strict
- [x] Custom event vyro:nicknameChanged per sync cross-component

---

## TODO / Non ancora implementato

- [ ] **Premium paywall**: acquisto in-app (RevenueCat o StoreKit), feature gating effettivo
- [ ] **Apple OAuth web**: flusso completo (solo bottone UI, non wired)
- [ ] **Notifiche web**: service worker per push (rest timer su web è solo overlay)
- [ ] **Offline web**: il web usa solo Supabase, nessun fallback offline
- [ ] **App Store / Play Store submission**: build production + review
- [ ] **Sharing sessione**: condivisione risultati allenamento
- [ ] **Amici / social**: nessuna funzione social attualmente
- [ ] **Internazionalizzazione (i18n)**: tutto hardcodato in italiano
