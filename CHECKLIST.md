# Vyro — Checklist di sviluppo
> Aggiornata al 2026-04-21 — allineata al codice reale

---

## App Mobile (React Native + Expo)

### Auth & Account
- [x] Registrazione email/password
- [x] Login email/password
- [x] Login Google OAuth (deep link)
- [x] Login Apple ID
- [x] Reset password via email
- [x] Modalità ospite (guest) con limiti (2 template, 15 esercizi, 14 gg storia)
- [x] Schermata onboarding al primo accesso
- [x] Redirect automatico auth → tab principale
- [x] User tier: guest / registered / premium (modello dati + UI settings)
- [x] Profilo utente (tabella profiles)
- [x] Modifica nickname (sync su Supabase profiles)
- [x] Modifica password
- [x] Eliminazione account
- [x] Logout
- [ ] Premium: feature gating reale (paywall, acquisto in-app)

### Home (Dashboard)
- [x] Stats globali: sessioni totali, volume totale, streak attuale, miglior streak
- [x] Sessione attiva con timer live
- [x] Sessioni completate oggi
- [x] Avvio rapido da template
- [x] Preview piano alimentare del giorno (piano attivo)

### Allenamenti — Template
- [x] Lista template ordinata per data
- [x] Creazione template (nome + note)
- [x] Modifica nome/note template
- [x] Eliminazione template
- [x] Aggiunta esercizio a template (da catalogo)
- [x] Rimozione esercizio dal template
- [x] Riordino esercizi (drag & drop)
- [x] Superset: abbina 2 esercizi
- [x] Configurazione serie per esercizio (sets target)
- [x] Tipo serie: warmup / lavoro
- [x] Target peso (kg) per serie
- [x] Target reps min/max per serie
- [x] Tempo di recupero (secondi) per serie
- [x] Tipo sforzo: Nessuno / Buffer RIR / Cedimento / Drop set
- [x] Buffer value (RIR) per serie
- [x] Note per serie

### Allenamenti — Sessione attiva
- [x] Avvio sessione da template
- [x] Riprendi sessione attiva
- [x] Timer sessione live (tick ogni secondo)
- [x] Mostra target (peso × reps × recupero) per ogni serie
- [x] Riferimento ultima sessione per esercizio e set
- [x] Registra peso/reps effettivi per serie
- [x] Tipo sforzo effettivo per serie
- [x] Buffer value effettivo (RIR)
- [x] Note effettive per serie
- [x] Segna serie come completata
- [x] Rest timer con countdown overlay + dismiss ("Salta")
- [x] Notifica push fine recupero (iOS/Android)
- [x] Aggiunta serie extra durante sessione
- [x] Rimozione serie durante sessione
- [x] Aggiunta esercizi extra durante sessione
- [x] Rimozione esercizio durante sessione
- [x] Completamento sessione (salva tutto)
- [x] Rating sessione (1-5 stelle) post-allenamento
- [x] Cancellazione sessione
- [x] Auto-save on blur su tutti i campi
- [x] Rilevamento sessione orfana / scaduta

### Allenamenti — Log storico
- [x] Inserimento manuale sessione passata (data, nome, note)
- [x] Selezione esercizi da catalogo o nome libero
- [x] Serie per ogni esercizio (warmup/target, peso, reps)
- [x] Opzione usa nome da template esistente

### Esercizi
- [x] Catalogo esercizi con categorie
- [x] Creazione esercizio (nome + categoria)
- [x] Modifica esercizio (nome + categoria)
- [x] Eliminazione esercizio
- [x] Ricerca per nome
- [x] Limite esercizi utenti ospite (15)

### Nutrizione — Diario
- [x] Vista giornaliera con navigazione data
- [x] Riepilogo macro totali giornalieri (kcal / P / C / G)
- [x] Aggiungi alimento a un pasto (Colazione, Pranzo, Cena, Spuntino, Integrazione)
- [x] Calcolo automatico macros dai grammi
- [x] Visualizzazione macros per ogni alimento loggato
- [x] Eliminazione alimento dal diario

### Nutrizione — Acqua
- [x] Log ml giornalieri con pulsanti rapidi (+250ml, +500ml, +750ml)
- [x] Reset giornaliero
- [x] Totale giornaliero visibile

### Nutrizione — Catalogo Alimenti
- [x] Aggiungi alimento manuale (nome + kcal + P/C/G per 100g)
- [x] Elimina alimento
- [x] Ricerca per nome
- [ ] Import da OpenFoodFacts (barcode / nome)

### Nutrizione — Peso Corporeo
- [x] Registra peso con data
- [x] Fasi: Bulk / Cut / Nessuna
- [x] Note opzionali
- [x] Lista storico pesate con eliminazione
- [x] Grafico trend peso nel tempo
- [x] Animazione "Bulk pulsante" sul tracking peso

### Nutrizione — Piani Alimentari
- [x] Crea piano (nome + tipo: weekly/cycle)
- [x] Aggiungi giorni al piano con assegnazione giorno della settimana
- [x] Aggiungi entry (alimento + grammi) ai giorni
- [x] Elimina entry e giorni
- [x] Attiva/disattiva piano
- [x] Piano attivo visibile in Home
- [x] AI import piano da PDF (claude-haiku via Edge Function)

### Ricette
- [x] Crea ricetta manuale (titolo, porzioni, macros, ingredienti, istruzioni)
- [x] Elimina ricetta
- [x] Visualizza dettagli ricetta
- [x] AI import ricetta da PDF (claude-haiku via Edge Function)
- [x] Usa ricetta nel diario / piano alimentare

### Calendario
- [x] Griglia mensile con giorni di allenamento evidenziati
- [x] Navigazione mese precedente/successivo
- [x] Click su giorno: lista sessioni del giorno
- [x] Dettaglio sessione (esercizi + serie effettive)
- [x] Eliminazione sessione dal calendario
- [x] Avvio sessione da calendario

### Progressi
- [x] Statistiche globali (sessioni totali, volume, streak)
- [x] Personal Records per esercizio (max peso + data)
- [x] Volume totale per esercizio (grafico SVG)
- [x] Frequenza settimanale media (chart SVG)
- [x] Grafico peso corporeo nel tempo (con fase)
- [x] Grafico volume per esercizio nel tempo
- [x] Grafico PR timeline per esercizio
- [~] Attività HealthKit: passi, distanza, calorie attive (solo iOS)

### Settings
- [x] Unità di misura (kg / lbs)
- [x] Obiettivo sessioni settimanali
- [x] Export dati JSON completo
- [x] Export dati CSV
- [x] Import dati JSON (replace_all / overwrite_existing / add_only)
- [x] Reset selettivo (sessioni, template, log nutrizione, piani, peso, catalogo)
- [x] Reset completo
- [x] Info account (email, tier, logout)
- [x] Notifiche timer recupero (permessi OS)
- [x] Guide interattive (Workout / Nutrition / Progress)

### ChatBot AI
- [x] Interfaccia chat conversazionale (FAB floating button)
- [x] Modello: claude-haiku-4-5-20251001 via Supabase Edge Function proxy
- [x] System prompt specializzato su Vyro
- [x] Risposte in italiano
- [x] Contesto conversazione multi-turn

### Infrastruttura Mobile
- [x] SQLite locale offline-first (database/index.ts ~1000 LOC)
- [x] Supabase: auth + cloud backup
- [x] Sync Engine SQLite → Supabase (12 tabelle)
- [x] Pull da Supabase all'avvio (sync bidirezionale base)
- [x] Autenticazione persistente (AsyncStorage)
- [x] HealthKit wrapper (iOS)
- [x] Deep link OAuth Google
- [x] EAS Build config (development / preview / production)
- [x] Codemagic CI config
- [x] Tema dark fisso
- [x] New Architecture abilitata (newArchEnabled)
- [x] React Compiler experiment

---

## Web SPA (Vanilla TypeScript + Vite + Tailwind CSS)

### Auth
- [x] Login / registrazione email
- [x] Reset password via email
- [x] OAuth Google
- [~] Login Apple (bottone UI presente, flusso OAuth web non verificato)
- [~] Tier utente: letto da Supabase, non mostrato in UI

### Home
- [x] Stats globali
- [x] Sessioni completate oggi
- [x] Avvio rapido da template
- [ ] Preview piano alimentare (piano attivo non mostrato in Home)

### Allenamenti
- [x] Lista template + creazione + modifica + eliminazione
- [x] Template detail (esercizi, superset)
- [~] Riordino esercizi (frecce su/giù, non drag & drop)
- [x] Configurazione serie per esercizio template
- [x] Sessione attiva: timer, rest timer overlay, per-set tracking, effort, add/remove esercizi e serie
- [x] Log storico manuale

### Esercizi
- [x] CRUD completo (nome + categoria) con ricerca

### Nutrizione — Diario
- [x] Diario alimentare per data con navigazione
- [x] Riepilogo macro giornalieri
- [x] Aggiungi/elimina alimento per pasto

### Nutrizione — Acqua
- [x] Log ml giornalieri, pulsanti rapidi, totale

### Nutrizione — Catalogo Alimenti
- [x] Aggiungi / elimina alimento, ricerca per nome

### Nutrizione — Peso Corporeo
- [x] Registra peso con data, fase, note
- [x] Lista storico + grafico trend

### Nutrizione — Piani Alimentari
- [x] Crea piano, aggiungi giorni ed entry
- [~] Assegnazione giorno della settimana (parziale)
- [~] Attiva/disattiva piano (parziale)
- [x] AI import piano da PDF

### Ricette
- [x] Crea ricetta manuale + AI import da PDF
- [x] Visualizza / elimina ricetta
- [~] Usa ricetta nel diario / piano (parziale)

### Calendario
- [x] Griglia mensile, sessioni per giorno, dettaglio sessione, elimina
- [~] Avvio sessione da calendario (rimanda alla pagina Allenamenti)

### Progressi
- [x] Stats globali, PR, volume (Chart.js), frequenza settimanale, PR history per esercizio

### Settings
- [x] Nickname, unità, obiettivo settimanale
- [x] Modifica password
- [x] Export / Import JSON
- [x] Reset selettivo per categoria + reset completo
- [x] Eliminazione account

### ChatBot AI
- [x] Interfaccia chat conversazionale (FAB floating button)
- [x] Modello: claude-haiku-4-5-20251001 via Supabase Edge Function proxy
- [x] Risposte in italiano, multi-turn

### Infrastruttura Web
- [x] Hash-based router con query params
- [x] Layout flex sidebar + main scroll
- [x] Sidebar con nickname live, link, logout
- [x] Custom event `vyro:nicknameChanged` per sync cross-component
- [x] Supabase JS (auth + RLS)
- [x] Repository pattern con pgErr helper
- [x] Vite + Tailwind v4 + TypeScript strict
- [x] Autenticazione persistente (LocalStorage)

---

## TODO / Non ancora implementato

- [ ] **Premium paywall**: acquisto in-app (RevenueCat o StoreKit), feature gating effettivo
- [ ] **Apple OAuth web**: flusso completo (solo bottone UI, non wired)
- [ ] **Import OpenFoodFacts**: ricerca alimenti per barcode o nome
- [ ] **Piano attivo in Home (web)**: preview piano alimentare del giorno
- [ ] **Notifiche web**: service worker per push (rest timer su web è solo overlay)
- [ ] **Offline web**: il web usa solo Supabase, nessun fallback offline
- [ ] **App Store / Play Store submission**: build production + review
- [ ] **Sharing sessione**: condivisione risultati allenamento
- [ ] **Amici / social**: nessuna funzione social attualmente
- [ ] **Internazionalizzazione (i18n)**: tutto hardcodato in italiano
