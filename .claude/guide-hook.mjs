// Hook: remind Claude to update Vyro_Guida_Utente.docx after source file edits
let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const json = JSON.parse(data);
    const fp = (json.tool_input || {}).file_path || (json.tool_input || {}).path || '';
    const isSourceFile = /[/\\](app|components|context|hooks|lib|database)[/\\]/.test(fp);
    const isGuideFile = fp.includes('generate-guide') || fp.includes('Guida_Utente');
    if (isSourceFile && !isGuideFile) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext:
            `[GUIDA UTENTE] File modificato: ${fp}\n` +
            `Se questa modifica aggiunge, rimuove o cambia funzionalità visibili all'utente (nuova schermata, nuovo tasto, nuovo flusso, nuova sezione), ` +
            `aggiorna il contenuto corrispondente in generate-guide.mjs e rigenera la guida con:\n  node generate-guide.mjs`
        }
      }));
    }
  } catch (_) {}
});
