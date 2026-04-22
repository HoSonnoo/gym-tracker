#!/usr/bin/env node
/**
 * Sincronizza lo stato da CHECKLIST.md → CHECKLIST.xlsx.
 * Legge i [x]/[~]/[ ] dal markdown e aggiorna le colonne Mobile (B) e Web (C)
 * nel foglio xlsx, preservando tutta la formattazione.
 *
 * Usage:
 *   node scripts/sync-checklist.mjs           # mostra diff (dry run)
 *   node scripts/sync-checklist.mjs --apply   # applica le modifiche
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MD_PATH = join(ROOT, 'CHECKLIST.md');
const XLSX_PATH = join(ROOT, 'CHECKLIST.xlsx');

const APPLY = process.argv.includes('--apply');
const STYLE = { '✓': 15, '~': 8, '': 7 };

// ─── Parsing CHECKLIST.md ────────────────────────────────────────────────────

function parseMd(content) {
  const lines = content.split('\n');
  const mobile = [];
  const web = [];
  let section = null;

  for (const line of lines) {
    if (line.startsWith('## App Mobile')) { section = 'mobile'; continue; }
    if (line.startsWith('## Web SPA'))    { section = 'web';    continue; }
    if (line.startsWith('## '))           { section = null;      continue; }
    if (!section) continue;

    const m = line.match(/^- \[(.)\] (.+)/);
    if (!m) continue;

    const status = m[1] === 'x' ? '✓' : m[1] === '~' ? '~' : '';
    // Rimuovi note parentetiche lunghe per migliorare il matching
    const text = m[2].replace(/\s*\([^)]{15,}\)/g, '').trim();

    (section === 'mobile' ? mobile : web).push({ text, status });
  }

  return { mobile, web };
}

// ─── Tokenizzazione e similarità Jaccard ────────────────────────────────────

const STOP = new Set(['per', 'con', 'dal', 'del', 'dei', 'gli', 'nel', 'una',
                      'uno', 'non', 'tra', 'che', 'alla', 'alle', 'agli',
                      'da', 'di', 'in', 'su', 'le', 'la', 'lo', 'and', 'the']);

function tokenize(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // rimuovi accenti
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w));
}

function jaccard(a, b) {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (!sa.size || !sb.size) return 0;
  const inter = [...sa].filter(w => sb.has(w)).length;
  return inter / (sa.size + sb.size - inter);
}

function bestMatch(xlsxText, items, threshold = 0.2) {
  let best = null, score = 0;
  for (const item of items) {
    const s = jaccard(xlsxText, item.text);
    if (s > score) { score = s; best = item; }
  }
  return score >= threshold ? { item: best, score } : null;
}

// ─── Parsing xlsx (sheet1.xml + sharedStrings.xml) ──────────────────────────

function parseXlsx(tmpDir) {
  const sharedStrXml = readFileSync(join(tmpDir, 'xl', 'sharedStrings.xml'), 'utf8');
  // Gestisce sia <si><t>text</t></si> che <si><t/></si> (tag self-closing = stringa vuota)
  const strings = [...sharedStrXml.matchAll(/<si>(.*?)<\/si>/gs)].map(([, inner]) => {
    if (/<t\s*\/>/.test(inner)) return '';
    const m = inner.match(/<t[^>]*>([^<]*)<\/t>/);
    return m ? m[1] : '';
  });

  // Trova gli indici delle stringhe chiave
  const strIdx = {
    '✓': strings.indexOf('✓'),
    '~': strings.indexOf('~'),
    '': strings.findIndex(s => s === ''),
  };

  const sheetXml = readFileSync(join(tmpDir, 'xl', 'worksheets', 'sheet1.xml'), 'utf8');

  // Stile sezioni header (s=18 = sfondo viola grande)
  const HEADER_STYLE = 18;

  const rows = [];
  for (const [, rowNum, rowContent] of sheetXml.matchAll(/<row r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
    const cells = {};
    for (const [, col, style, vIdx] of rowContent.matchAll(/<c r="([A-Z]+)\d+" s="(\d+)" t="s"><v>(\d+)<\/v><\/c>/g)) {
      cells[col] = { style: +style, text: strings[+vIdx] ?? '' };
    }
    if (!cells.A) continue;
    if (+cells.A.style === HEADER_STYLE) continue; // salta intestazioni sezione
    if (!cells.A.text || /^\d+\./.test(cells.A.text)) continue;

    rows.push({
      rowNum: +rowNum,
      text: cells.A.text,
      mobile: cells.B?.text ?? '',
      web: cells.C?.text ?? '',
    });
  }

  return { strings, strIdx, rows, sheetXml };
}

// ─── Applica modifiche a sheet1.xml ─────────────────────────────────────────

function applyChanges(sheetXml, changes, strIdx) {
  let xml = sheetXml;
  for (const { rowNum, col, newVal } of changes) {
    const ref = `${col}${rowNum}`;
    const idx = strIdx[newVal] ?? (newVal === '✓' ? 6 : newVal === '~' ? 20 : 7);
    xml = xml.replace(
      new RegExp(`<c r="${ref}" s="\\d+" t="s"><v>\\d+</v></c>`),
      `<c r="${ref}" s="${STYLE[newVal]}" t="s"><v>${idx}</v></c>`
    );
  }
  return xml;
}

// ─── Estrai / ricomprimi xlsx ────────────────────────────────────────────────

function extractXlsx(src, destDir) {
  mkdirSync(destDir, { recursive: true });
  execSync(`unzip -o "${src}" -d "${destDir}"`, { stdio: 'pipe' });
}

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

// ─── Formattazione output ────────────────────────────────────────────────────

const SYMBOL = { '✓': '✓', '~': '~', '': ' ' };
const COL_LABEL = { B: 'Mobile', C: 'Web' };

function formatDiff(changes) {
  if (!changes.length) return '  Nessuna differenza — xlsx già allineato con il markdown.';
  const lines = [`  ${'RIGA'.padEnd(5)} ${'COL'.padEnd(8)} ${'DA'.padEnd(4)} → ${'A'.padEnd(4)} FUNZIONALITÀ`];
  lines.push('  ' + '─'.repeat(70));
  for (const { rowNum, col, oldVal, newVal, text } of changes) {
    const from = SYMBOL[oldVal] || ' ';
    const to   = SYMBOL[newVal] || ' ';
    lines.push(`  ${String(rowNum).padEnd(5)} ${COL_LABEL[col].padEnd(8)} [${from}]  → [${to}]   ${text.slice(0, 45)}`);
  }
  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

const tmpDir = join(tmpdir(), `checklist_${randomBytes(4).toString('hex')}`);
const tmpOut = XLSX_PATH + '.tmp';

try {
  console.log('Lettura CHECKLIST.md...');
  const { mobile: mobileItems, web: webItems } = parseMd(readFileSync(MD_PATH, 'utf8'));
  console.log(`  ${mobileItems.length} voci Mobile, ${webItems.length} voci Web`);

  console.log('Estrazione CHECKLIST.xlsx...');
  extractXlsx(XLSX_PATH, tmpDir);
  const { strings, strIdx, rows, sheetXml } = parseXlsx(tmpDir);
  console.log(`  ${rows.length} righe funzionalità trovate`);

  // Calcola diff
  const changes = [];
  let skipped = 0;

  for (const row of rows) {
    const mMatch = bestMatch(row.text, mobileItems);
    const wMatch = bestMatch(row.text, webItems);

    if (mMatch && mMatch.item.status !== row.mobile) {
      changes.push({ rowNum: row.rowNum, col: 'B', oldVal: row.mobile, newVal: mMatch.item.status, text: row.text });
    }
    if (wMatch && wMatch.item.status !== row.web) {
      changes.push({ rowNum: row.rowNum, col: 'C', oldVal: row.web, newVal: wMatch.item.status, text: row.text });
    }
    if (!mMatch && !wMatch) skipped++;
  }

  console.log(`\nDiff (${changes.length} modifiche proposte, ${skipped} righe senza corrispondenza nel markdown):\n`);
  console.log(formatDiff(changes));

  if (!changes.length) process.exit(0);

  if (!APPLY) {
    console.log('\n  Aggiungi --apply per applicare le modifiche.');
    process.exit(0);
  }

  console.log('\nApplicazione modifiche...');
  const updatedXml = applyChanges(sheetXml, changes, strIdx);
  writeFileSync(join(tmpDir, 'xl', 'worksheets', 'sheet1.xml'), updatedXml);

  repackXlsx(tmpDir, tmpOut);
  if (existsSync(XLSX_PATH)) rmSync(XLSX_PATH);
  renameSync(tmpOut, XLSX_PATH);

  console.log(`\n✓ CHECKLIST.xlsx aggiornato — ${changes.length} modifica${changes.length > 1 ? 'he' : ''} applicate.`);
} catch (err) {
  console.error('Errore:', err.message);
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
  if (existsSync(tmpOut)) rmSync(tmpOut);
}
