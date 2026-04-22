#!/usr/bin/env node
/**
 * Aggiorna celle specifiche di CHECKLIST.xlsx preservando la formattazione.
 *
 * Usage:
 *   node scripts/update-checklist.mjs B7=✓ C108=~ C5=
 *
 * Valori accettati per ogni cella:
 *   ✓  x  done            →  fatto
 *   ~  p  partial         →  parziale
 *   (vuoto)  n  no  none  →  non fatto
 *
 * Esempi:
 *   node scripts/update-checklist.mjs C7=✓ C108=✓ C109=✓
 *   node scripts/update-checklist.mjs B80=~ C80=~
 *   node scripts/update-checklist.mjs C7=
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = resolve(__dirname, '..', 'CHECKLIST.xlsx');

// Indici stile nelle cellXfs di styles.xml (analizzati dall'xlsx originale)
const STYLE = { '✓': 15, '~': 8, '': 7 };

// Normalizza il valore passato dall'utente
function normalizeValue(raw) {
  const v = raw.trim();
  if (['✓', 'x', 'done', 'si', 'sì'].includes(v)) return '✓';
  if (['~', 'p', 'partial', 'parziale'].includes(v)) return '~';
  if (['', 'n', 'no', 'none'].includes(v)) return '';
  throw new Error(`Valore non riconosciuto: "${v}" — usa ✓, ~ oppure (vuoto)`);
}

// Legge gli indici delle stringhe condivise direttamente dal file
function getStringIndex(sharedStringsXml, target) {
  // Gestisce sia <si><t>text</t></si> che <si><t/></si> (stringa vuota self-closing)
  const entries = [...sharedStringsXml.matchAll(/<si>(.*?)<\/si>/gs)].map(([, inner]) => {
    if (/<t\s*\/>/.test(inner)) return '';
    const m = inner.match(/<t[^>]*>([^<]*)<\/t>/);
    return m ? m[1] : '';
  });
  const idx = entries.indexOf(target);
  if (idx !== -1) return idx;
  // fallback: valori noti dall'xlsx formattato originale
  return { '✓': 6, '~': 20, '': 7 }[target] ?? -1;
}

// Parsing argomenti CLI
function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(`
update-checklist.mjs — aggiorna celle xlsx preservando la formattazione

Usage:  node scripts/update-checklist.mjs CELLA=VALORE [CELLA=VALORE ...]

Valori: ✓ o x (fatto)   ~ o p (parziale)   (vuoto) o n (non fatto)

Esempi:
  node scripts/update-checklist.mjs C7=✓ B108=~ C5=
  node scripts/update-checklist.mjs C108=✓ C109=✓ C110=✓ C111=✓
    `);
    process.exit(0);
  }
  return args.map(arg => {
    const eq = arg.indexOf('=');
    if (eq === -1) throw new Error(`Argomento non valido: "${arg}" — formato atteso CELLA=VALORE`);
    const ref = arg.slice(0, eq).toUpperCase();
    if (!/^[A-Z]+\d+$/.test(ref)) throw new Error(`Riferimento cella non valido: "${ref}"`);
    return { ref, val: normalizeValue(arg.slice(eq + 1)) };
  });
}

// Estrai xlsx in una dir temporanea
function extractXlsx(src, destDir) {
  mkdirSync(destDir, { recursive: true });
  execSync(`unzip -o "${src}" -d "${destDir}"`, { stdio: 'pipe' });
}

// Ricrea xlsx da dir estratta (Windows: PowerShell ZipArchive con slash corretti)
function repackXlsx(srcDir, destPath) {
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

// --- Main ---
const updates = parseArgs();
const tmpDir = join(tmpdir(), `checklist_${randomBytes(4).toString('hex')}`);
const tmpOut = XLSX_PATH + '.tmp';

try {
  process.stdout.write('Estrazione xlsx...\n');
  extractXlsx(XLSX_PATH, tmpDir);

  const sharedStrPath = join(tmpDir, 'xl', 'sharedStrings.xml');
  const sharedStrXml = readFileSync(sharedStrPath, 'utf8');

  const sheetPath = join(tmpDir, 'xl', 'worksheets', 'sheet1.xml');
  let sheetXml = readFileSync(sheetPath, 'utf8');

  let changed = 0;
  for (const { ref, val } of updates) {
    const strIdx = getStringIndex(sharedStrXml, val);
    const styleIdx = STYLE[val];
    if (strIdx === -1) {
      console.warn(`  Attenzione: stringa "${val}" non trovata in sharedStrings — salto ${ref}`);
      continue;
    }
    const before = sheetXml;
    sheetXml = sheetXml.replace(
      new RegExp(`<c r="${ref}" s="\\d+" t="s"><v>\\d+</v></c>`),
      `<c r="${ref}" s="${styleIdx}" t="s"><v>${strIdx}</v></c>`
    );
    if (sheetXml === before) {
      console.warn(`  Attenzione: cella ${ref} non trovata nel foglio`);
    } else {
      const label = val === '✓' ? 'fatto' : val === '~' ? 'parziale' : 'non fatto';
      console.log(`  ${ref} → ${val || '(vuoto)'}  [${label}]`);
      changed++;
    }
  }

  if (changed === 0) {
    console.log('Nessuna modifica necessaria.');
    process.exit(0);
  }

  writeFileSync(sheetPath, sheetXml);
  process.stdout.write('Ricompressione xlsx...\n');
  repackXlsx(tmpDir, tmpOut);
  if (existsSync(XLSX_PATH)) rmSync(XLSX_PATH);
  renameSync(tmpOut, XLSX_PATH);

  console.log(`\n✓ CHECKLIST.xlsx aggiornato — ${changed} cella${changed > 1 ? 'e' : ''} modificata${changed > 1 ? '' : ''}.`);
} catch (err) {
  console.error('Errore:', err.message);
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
  if (existsSync(tmpOut)) rmSync(tmpOut);
}
