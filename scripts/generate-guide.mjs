#!/usr/bin/env node
/**
 * Applica aggiornamenti incrementali a Vyro_Guida_Utente.docx.
 * Eseguito ogni volta che funzionalità visibili all'utente vengono aggiunte o modificate.
 *
 * Usage:
 *   node scripts/generate-guide.mjs
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

function bold(text) {
  return `<w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function body(text) {
  return `<w:p><w:pPr><w:spacing w:before="60" w:after="100"/></w:pPr>` +
    `<w:r><w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function tip(text) {
  return `<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>` +
    `<w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
    `<w:t>${esc(text)}</w:t></w:r></w:p>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Contenuto nuovo ───────────────────────────────────────────────────────────

// Impostazioni: Rivedi onboarding (inserito prima di "🔔 Notifiche" nella sezione settings)
const ONBOARDING_REVIEW =
  bold('🔄 Rivedi onboarding') +
  body('Vai in Impostazioni → sezione APP e tocca "Apri" accanto a "Rivedi onboarding". ' +
       'Il tour guidato si avvierà dall\'inizio, permettendoti di riscoprire tutte le ' +
       'funzionalità dell\'app in qualsiasi momento.');

// Sessione allenamento: auto-compressione serie completata
const AUTO_COLLAPSE_TIP =
  tip('💡 Auto-compressione: quando completi l\'ultima serie di un esercizio, la scheda ' +
      'si comprime automaticamente per liberare spazio e mostrare gli esercizi successivi.');

// ── Applica modifiche ─────────────────────────────────────────────────────────

function applyChanges(xml) {
  let out = xml;
  let count = 0;

  // 1. Rivedi onboarding — inserisci prima di "🔔 Notifiche" nella sezione Impostazioni
  //    (seconda occorrenza di 🔔, quella che segue "Eliminazione account")
  const elimIdx = out.indexOf('Eliminazione account');
  if (elimIdx !== -1) {
    const bellAfterElim = out.indexOf('🔔', elimIdx);
    if (bellAfterElim !== -1) {
      const anchor = out.substring(bellAfterElim, bellAfterElim + 80);
      const r = insertBeforeParagraph(out, anchor, ONBOARDING_REVIEW);
      if (r) { out = r; console.log('  [OK] Rivedi onboarding aggiunto in Impostazioni'); count++; }
      else console.warn('  [!!] Anchor Notifiche (settings) non trovato');
    }
  } else {
    console.warn('  [!!] Anchor "Eliminazione account" non trovato');
  }

  // 2. Auto-compressione — inserisci dopo il paragrafo che descrive il rating finale
  const ratingAnchor = 'stelle prima di tornare alla Home.';
  if (out.includes(ratingAnchor)) {
    const r = insertAfterParagraph(out, ratingAnchor, AUTO_COLLAPSE_TIP);
    if (r) { out = r; console.log('  [OK] Auto-compressione aggiunta'); count++; }
    else console.warn('  [!!] Inserimento auto-compressione fallito');
  } else {
    console.warn('  [!!] Anchor rating non trovato');
  }

  return { xml: out, count };
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
  const { xml: updated, count } = applyChanges(xml);

  if (count === 0) {
    console.log('Nessuna modifica applicata (forse già aggiornato).');
    process.exit(0);
  }

  writeFileSync(docPath, updated, 'utf8');
  console.log('Ricompressione docx...');
  repackDocx(tmpDir, tmpOut);

  if (existsSync(DOCX_PATH)) rmSync(DOCX_PATH);
  renameSync(tmpOut, DOCX_PATH);
  console.log(`\n✓ Vyro_Guida_Utente.docx aggiornato (${count} modifica${count > 1 ? 'he' : ''}).`);
} catch (err) {
  console.error('Errore:', err.message);
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
  if (existsSync(tmpOut)) rmSync(tmpOut);
}
