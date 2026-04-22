#!/usr/bin/env node
/**
 * Aggiorna Vyro_Guida_Utente.docx con le sezioni mancanti.
 * Eseguito una volta sola — aggiunge contenuto preservando la formattazione.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCX_PATH = resolve(__dirname, '..', 'Vyro_Guida_Utente.docx');

// ── XML helpers ───────────────────────────────────────────────────────────────

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function titolo1(num, text) {
  return `<w:p><w:pPr><w:pStyle w:val="Titolo1"/><w:spacing w:after="80"/></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="7E47FF"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr>` +
    `<w:t xml:space="preserve">${esc(num + '. ' + text)}</w:t></w:r></w:p>`;
}

function titolo2(emoji, text) {
  return `<w:p><w:pPr><w:pStyle w:val="Titolo2"/><w:spacing w:before="340" w:after="120"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Emoji" w:hAnsi="Segoe UI Emoji" w:cs="Segoe UI Emoji"/>` +
    `<w:b/><w:bCs/><w:color w:val="16213E"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>${esc(emoji)}</w:t></w:r>` +
    `<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="16213E"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>` +
    `<w:t xml:space="preserve"> ${esc(text)}</w:t></w:r></w:p>`;
}

function body(text) {
  return `<w:p><w:pPr><w:spacing w:before="60" w:after="100"/></w:pPr>` +
    `<w:r><w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function bold(text) {
  return `<w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function tip(text) {
  return `<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>` +
    `<w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
    `<w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function separator() {
  return `<w:p><w:pPr><w:spacing w:after="400" w:before="200"/><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:rPr><w:color w:val="D0D0D0"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>` +
    `<w:t>&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;</w:t></w:r></w:p>`;
}

// ── Contenuto da aggiungere ───────────────────────────────────────────────────

const ACQUA_SECTION =
  separator() +
  titolo2('💧', 'Acqua') +
  body('Traccia l\'idratazione giornaliera direttamente dalla sezione Nutrizione.') +
  bold('Aggiungere acqua') +
  body('Usa i pulsanti rapidi +250ml, +500ml, +750ml per registrare rapidamente. Il totale giornaliero ' +
       'è sempre visibile in cima alla sezione e si azzera automaticamente a mezzanotte.') +
  bold('Reset manuale') +
  body('Tocca il pulsante "Reset" per azzerare il contatore del giorno corrente.');

const AI_IMPORT_SECTION =
  bold('🤖 Import da PDF tramite AI') +
  body('Vyro può importare automaticamente ricette e piani alimentari da un file PDF. ' +
       'Tocca "Import da PDF" nella sezione Ricette o nella sezione Piano: l\'AI analizza il documento ' +
       'ed estrae titolo, ingredienti, macro e istruzioni senza che tu debba inserire nulla manualmente.');

const RATING_ADDITION =
  ' Ti verrà chiesto di valutare la sessione con 1-5 stelle prima di tornare alla Home.';

const SETTINGS_PASSWORD =
  bold('🔑 Modifica password') +
  body('Vai in Impostazioni e tocca "Modifica password". Inserisci la nuova password ' +
       '(minimo 6 caratteri) e conferma. Disponibile solo per account registrati via email/password.');

const SETTINGS_DELETE =
  bold('🗑 Eliminazione account') +
  body('In fondo alle Impostazioni trovi il pulsante "Elimina account". L\'operazione è ' +
       'irreversibile: tutti i dati cloud vengono rimossi definitivamente. I dati locali sul ' +
       'dispositivo rimangono fino alla disinstallazione dell\'app.');

const CHATBOT_SECTION =
  separator() +
  titolo1('13', 'ChatBot AI') +
  body('Vyro include un assistente AI conversazionale. Il pulsante 🤖 è visibile in basso a destra ' +
       'in ogni schermata, sia nell\'app mobile che nella versione web.') +
  titolo2('🤖', 'Come usare il ChatBot') +
  bold('Apri la chat') +
  body('Tocca il pulsante 🤖 in basso a destra. Si apre una finestra sovrapposta alla schermata corrente.') +
  bold('Fai la tua domanda') +
  body('Scrivi liberamente in italiano. Esempi: "Come configuro un superset?", ' +
       '"Quante proteine per la massa muscolare?", "Come interpreto il grafico del volume?"') +
  bold('Conversazione multi-turn') +
  body('Il ChatBot ricorda il contesto della conversazione: puoi fare domande di follow-up ' +
       'senza ripetere le informazioni già fornite.') +
  bold('Chiudi la chat') +
  body('Tocca fuori dalla finestra o il pulsante ✕ per chiuderla. ' +
       'La conversazione viene resettata alla prossima apertura.') +
  tip('💡 Suggerimento: Il ChatBot è specializzato su Vyro e risponde in italiano. ' +
      'Può aiutarti con l\'uso dell\'app, consigli di allenamento e nutrizione. ' +
      'Non sostituisce il parere di un professionista della salute.');

// ── Helpers per trovare e modificare paragrafi ───────────────────────────────

function insertBeforeParagraph(xml, textAnchor, newContent) {
  const idx = xml.indexOf(textAnchor);
  if (idx === -1) return null;
  const paraStart = xml.lastIndexOf('<w:p ', idx);
  if (paraStart === -1) return null;
  return xml.slice(0, paraStart) + newContent + xml.slice(paraStart);
}

function insertAfterParagraph(xml, textAnchor, newContent) {
  const idx = xml.indexOf(textAnchor);
  if (idx === -1) return null;
  const paraEnd = xml.indexOf('</w:p>', idx);
  if (paraEnd === -1) return null;
  const after = paraEnd + 6;
  return xml.slice(0, after) + newContent + xml.slice(after);
}

// ── Applica modifiche al document.xml ────────────────────────────────────────

function applyChanges(xml) {
  let out = xml;

  // 1. Aggiorna versione: "1.1 ·" → "1.2 ·"
  if (out.includes('1.1 ·')) {
    out = out.replace('1.1 ·', '1.2 ·');
    console.log('  [OK] Versione aggiornata a 1.2');
  } else {
    console.warn('  [!!] Stringa versione non trovata');
  }

  // 2. Acqua — inserisci prima del paragrafo "Piano alimentare" (Titolo2)
  const r2 = insertBeforeParagraph(out, 'xml:space="preserve"> Piano alimentare</w:t>', ACQUA_SECTION);
  if (r2) { out = r2; console.log('  [OK] Sezione Acqua aggiunta'); }
  else console.warn('  [!!] Anchor "Piano alimentare" non trovato');

  // 3. AI import — inserisci dopo il paragrafo che termina con "vengono calcolate automaticamente"
  const r3 = insertAfterParagraph(out, 'per porzione vengono calcolate automaticamente</w:t>', AI_IMPORT_SECTION);
  if (r3) { out = r3; console.log('  [OK] AI import aggiunto in Ricette'); }
  else console.warn('  [!!] Anchor ricette non trovato');

  // 4. Rating sessione — l'em-dash nel testo originale è U+2014
  const completeAnchor = 'Salva definitivamente tutti i dati registrati — la sessione appare nel Calendario e nel Progressi';
  if (out.includes(completeAnchor)) {
    out = out.replace(completeAnchor, completeAnchor + RATING_ADDITION);
    console.log('  [OK] Rating sessione aggiunto');
  } else {
    console.warn('  [!!] Anchor "Completa sessione" non trovato');
  }

  // 5. Impostazioni: password e eliminazione — inserisci prima del Titolo2 "🔔 Notifiche"
  const r5 = insertBeforeParagraph(out, 'xml:space="preserve"> Notifiche</w:t></w:r></w:p>', SETTINGS_PASSWORD + SETTINGS_DELETE);
  if (r5) { out = r5; console.log('  [OK] Modifica password e Eliminazione account aggiunti'); }
  else console.warn('  [!!] Anchor "Notifiche" Titolo2 non trovato');

  // 6. ChatBot — inserisci prima del paragrafo "FINE GUIDA" (contiene "─ FINE")
  const r6 = insertBeforeParagraph(out, '─ FINE', CHATBOT_SECTION);
  if (r6) { out = r6; console.log('  [OK] Sezione ChatBot AI aggiunta'); }
  else console.warn('  [!!] Anchor "FINE GUIDA" non trovato');

  return out;
}

// ── Estrai / ricomprimi docx ──────────────────────────────────────────────────

function extractDocx(src, destDir) {
  mkdirSync(destDir, { recursive: true });
  const script = [
    `Add-Type -Assembly 'System.IO.Compression.FileSystem'`,
    `$src = [System.IO.Path]::GetFullPath('${src.replace(/\//g, '\\')}')`,
    `$dst = [System.IO.Path]::GetFullPath('${destDir.replace(/\//g, '\\')}')`,
    `[System.IO.Compression.ZipFile]::ExtractToDirectory($src, $dst)`,
  ].join('; ');
  execSync(`powershell.exe -Command "${script}"`, { stdio: 'pipe' });
}

function repackDocx(srcDir, destPath) {
  const script = [
    `Add-Type -Assembly 'System.IO.Compression'`,
    `Add-Type -Assembly 'System.IO.Compression.FileSystem'`,
    `$src = [System.IO.Path]::GetFullPath('${srcDir.replace(/\//g, '\\')}')`,
    `$dst = [System.IO.Path]::GetFullPath('${destPath.replace(/\//g, '\\')}')`,
    `if (Test-Path $dst) { Remove-Item $dst }`,
    `$zip = [System.IO.Compression.ZipFile]::Open($dst, 'Create')`,
    `Get-ChildItem -Path $src -Recurse -File | ForEach-Object {`,
    `  $rel = $_.FullName.Substring($src.Length + 1).Replace([System.IO.Path]::DirectorySeparatorChar, '/')`,
    `  $e = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)`,
    `  $es = $e.Open(); $fs = [System.IO.File]::OpenRead($_.FullName)`,
    `  $fs.CopyTo($es); $fs.Close(); $es.Close()`,
    `}`,
    `$zip.Dispose()`,
  ].join('; ');
  execSync(`powershell.exe -Command "${script}"`, { stdio: 'pipe' });
}

// ── Main ──────────────────────────────────────────────────────────────────────

const tmpDir = join(tmpdir(), `docx_${randomBytes(4).toString('hex')}`);
const tmpOut = DOCX_PATH + '.tmp';

try {
  console.log('Estrazione docx...');
  extractDocx(DOCX_PATH, tmpDir);

  const docPath = join(tmpDir, 'word', 'document.xml');
  const xml = readFileSync(docPath, 'utf8');

  console.log('Applicazione modifiche...');
  const updated = applyChanges(xml);

  writeFileSync(docPath, updated, 'utf8');
  console.log('Ricompressione docx...');
  repackDocx(tmpDir, tmpOut);

  if (existsSync(DOCX_PATH)) rmSync(DOCX_PATH);
  renameSync(tmpOut, DOCX_PATH);
  console.log('\n✓ Vyro_Guida_Utente.docx aggiornato.');
} catch (err) {
  console.error('Errore:', err.message);
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
  if (existsSync(tmpOut)) rmSync(tmpOut);
}
