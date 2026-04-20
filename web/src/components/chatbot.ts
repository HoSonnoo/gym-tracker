const SUPABASE_URL   = 'https://xttmvtgkoshsfyqmizja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dG12dGdrb3Noc2Z5cW1pemphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDk5MjUsImV4cCI6MjA4OTQ4NTkyNX0.3ooDzd5rLe8GeJ1sLWkpKSjp_D5TAey_acThZN_2WiU';
const PROXY_URL = `${SUPABASE_URL}/functions/v1/anthropic-proxy`;

const SYSTEM_PROMPT = `Sei Vyro Assistant, l'assistente AI integrato nell'app VYRO — un tracker di allenamento e nutrizione.

Rispondi SEMPRE in italiano, in modo chiaro, amichevole e conciso.

FUNZIONALITÀ DELL'APP che conosci:
- ALLENAMENTI: creazione template con esercizi e serie, sessioni reali da template, timer recupero, personal record automatici
- NUTRIZIONE: diario alimentare giornaliero, catalogo alimenti, piano alimentare (importabile da PDF tramite AI), tracciamento acqua, peso corporeo con fasi Bulk/Cut, ricette manuali o da PDF
- PROGRESSI: record personali, volume per esercizio, statistiche globali
- CALENDARIO: storico sessioni
- ACCOUNT: registrazione email, accesso Google/Apple, modalità ospite, backup/export JSON e CSV, import dati, reset selettivo, nickname personalizzato
- IMPOSTAZIONI: unità di misura (kg/lbs), obiettivo settimanale, gestione dati

RISPONDI a:
1. Domande su come usare l'app (es. "come creo un esercizio?", "come importo un piano PDF?")
2. Domande su fitness e allenamento (es. "quante volte allenarsi a settimana?")
3. Domande su nutrizione (es. "quante proteine dovrei mangiare?", "cosa significa Bulk/Cut?")

Se non sai qualcosa di specifico sull'app, dillo chiaramente. Sii breve: risposte di 2-4 frasi salvo quando serve più dettaglio.`;

type Message = { id: string; role: 'user' | 'assistant'; text: string };

export function mountChatbot(): void {
  // Inject styles once
  if (!document.getElementById('chatbot-styles')) {
    const s = document.createElement('style');
    s.id = 'chatbot-styles';
    s.textContent = `
      #chatbot-fab {
        position: fixed; bottom: 24px; right: 24px; z-index: 1000;
        width: 52px; height: 52px; border-radius: 50%;
        background: #7e47ff; border: none; cursor: pointer;
        font-size: 24px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 20px rgba(126,71,255,0.5);
        animation: chatbot-pulse 1.8s ease-in-out infinite;
        transition: transform .15s, box-shadow .15s;
      }
      #chatbot-fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(126,71,255,0.65); }
      @keyframes chatbot-pulse {
        0%,100% { box-shadow: 0 4px 20px rgba(126,71,255,0.5); }
        50%      { box-shadow: 0 4px 32px rgba(126,71,255,0.8); }
      }
      #chatbot-modal {
        position: fixed; inset: 0; z-index: 1001;
        display: flex; align-items: flex-end; justify-content: flex-end;
        padding: 0 24px 92px 24px;
        pointer-events: none;
      }
      #chatbot-modal.open { pointer-events: all; }
      #chatbot-window {
        width: 380px; max-width: 100%;
        height: 520px; max-height: calc(100vh - 120px);
        background: #181C23; border: 1px solid #2C3442;
        border-radius: 20px; display: flex; flex-direction: column;
        box-shadow: 0 16px 48px rgba(0,0,0,0.6);
        transform: translateY(20px) scale(0.97);
        opacity: 0;
        transition: transform .22s cubic-bezier(.34,1.56,.64,1), opacity .18s ease;
      }
      #chatbot-modal.open #chatbot-window {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      #chatbot-messages {
        flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
      }
      #chatbot-messages::-webkit-scrollbar { width: 4px; }
      #chatbot-messages::-webkit-scrollbar-thumb { background: #2C3442; border-radius: 2px; }
      .chat-bubble {
        max-width: 82%; border-radius: 18px; padding: 10px 14px;
        font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
      }
      .chat-bubble-user {
        align-self: flex-end; background: #7e47ff; color: #fff;
        border-bottom-right-radius: 4px;
      }
      .chat-bubble-assistant {
        align-self: flex-start; background: #222834; color: #e4e4e7;
        border: 1px solid #2C3442; border-bottom-left-radius: 4px;
      }
      .chat-typing {
        align-self: flex-start; background: #222834; border: 1px solid #2C3442;
        border-radius: 18px; border-bottom-left-radius: 4px;
        padding: 10px 14px; font-size: 13px; color: #71717a; font-style: italic;
      }
      #chatbot-input-row {
        display: flex; gap: 8px; padding: 12px 14px;
        border-top: 1px solid #2C3442;
      }
      #chatbot-input {
        flex: 1; background: #222834; border: 1px solid #2C3442;
        border-radius: 14px; padding: 9px 14px; font-size: 14px;
        color: #e4e4e7; resize: none; outline: none; max-height: 96px;
        font-family: inherit;
      }
      #chatbot-input::placeholder { color: #52525b; }
      #chatbot-input:focus { border-color: #7e47ff; }
      #chatbot-send {
        width: 40px; height: 40px; border-radius: 50%;
        background: #7e47ff; border: none; cursor: pointer;
        color: #fff; font-size: 18px; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
        transition: opacity .15s;
        align-self: flex-end;
      }
      #chatbot-send:disabled { opacity: 0.35; cursor: default; }
    `;
    document.head.appendChild(s);
  }

  // FAB button
  const fab = document.createElement('button');
  fab.id = 'chatbot-fab';
  fab.textContent = '🤖';
  fab.title = 'Vyro Assistant';
  document.body.appendChild(fab);

  // Modal
  const modal = document.createElement('div');
  modal.id = 'chatbot-modal';
  modal.innerHTML = `
    <div id="chatbot-window">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #2C3442;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:28px;">🤖</span>
          <div>
            <p style="font-size:15px;font-weight:700;color:#e4e4e7;margin:0;">Vyro Assistant</p>
            <p style="font-size:11px;color:#71717a;margin:0;">App · Fitness · Nutrizione</p>
          </div>
        </div>
        <button id="chatbot-close" style="padding:6px 12px;background:#222834;border:1px solid #2C3442;border-radius:8px;color:#71717a;font-size:13px;font-weight:600;cursor:pointer;">Chiudi</button>
      </div>
      <div id="chatbot-messages"></div>
      <div id="chatbot-input-row">
        <textarea id="chatbot-input" rows="1" placeholder="Scrivi un messaggio…" maxlength="500"></textarea>
        <button id="chatbot-send" disabled>↑</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const messagesEl = modal.querySelector('#chatbot-messages') as HTMLElement;
  const inputEl    = modal.querySelector('#chatbot-input')    as HTMLTextAreaElement;
  const sendBtn    = modal.querySelector('#chatbot-send')     as HTMLButtonElement;

  // State
  const messages: Message[] = [
    { id: '0', role: 'assistant', text: "Ciao! Sono Vyro Assistant 🤖\nChiedimi come usare l'app o qualsiasi cosa su fitness e nutrizione!" },
  ];
  let loading = false;

  function renderMessages(): void {
    messagesEl.innerHTML = messages.map(m => `
      <div class="chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}">${escapeHtml(m.text)}</div>
    `).join('');
    if (loading) {
      messagesEl.insertAdjacentHTML('beforeend', `<div class="chat-typing">Vyro sta scrivendo…</div>`);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function sendMessage(): Promise<void> {
    const text = inputEl.value.trim();
    if (!text || loading) return;

    messages.push({ id: Date.now().toString(), role: 'user', text });
    inputEl.value = '';
    inputEl.style.height = 'auto';
    loading = true;
    sendBtn.disabled = true;
    renderMessages();

    try {
      const apiMessages = messages
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.text }));

      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.type === 'error') {
        throw new Error(data?.error?.message ?? `Errore API (${res.status})`);
      }
      const reply: string = data?.content?.[0]?.text ?? 'Non ho capito, riprova.';
      messages.push({ id: Date.now().toString() + '_a', role: 'assistant', text: reply });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore di connessione.';
      messages.push({ id: Date.now().toString() + '_e', role: 'assistant', text: msg });
    } finally {
      loading = false;
      sendBtn.disabled = inputEl.value.trim().length === 0;
      renderMessages();
    }
  }

  // Open / close
  fab.addEventListener('click', () => {
    modal.classList.add('open');
    inputEl.focus();
  });
  modal.querySelector('#chatbot-close')?.addEventListener('click', () => modal.classList.remove('open'));

  // Input auto-resize + send button state
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
    sendBtn.disabled = inputEl.value.trim().length === 0 || loading;
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  // Initial render
  renderMessages();
}
