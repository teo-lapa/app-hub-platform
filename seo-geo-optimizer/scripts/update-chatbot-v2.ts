/**
 * Update Chatbot V2 - Design AI moderno + Notifiche
 * - Colore blu/viola AI style
 * - Rimuove LiveChat Odoo
 * - Invia email quando serve intervento umano
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

// Leggi knowledge base
let knowledgeBase = '';
try {
  const kb = JSON.parse(readFileSync(resolve(__dirname, 'chatbot-knowledge.json'), 'utf-8'));
  knowledgeBase = `
CATEGORIE PRODOTTI: ${kb.categorie?.slice(0, 20).map((c: any) => c.nome).join(', ')}

PRODOTTI POPOLARI: ${kb.prodotti?.slice(0, 15).map((p: any) => p.nome).join(', ')}

FAQ:
${kb.faq?.map((f: any) => `Q: ${f.domanda}\nA: ${f.risposta}`).join('\n\n')}
`;
} catch (e) {}

// System prompt con istruzione per escalation
const SYSTEM_PROMPT = `Sei LAPA AI Assistant, l'assistente virtuale intelligente di LAPA - il principale distributore di prodotti alimentari italiani autentici in Svizzera.

🎯 IL TUO RUOLO:
Assistenza clienti AI professionale per il sito www.lapa.ch

📋 COSA PUOI FARE:
- Aiutare a trovare prodotti italiani (pasta, olio, salumi, formaggi, conserve, vini, ecc.)
- Informazioni su ordini, spedizioni e consegne
- Supporto clienti B2B (ristoranti, pizzerie, hotel, catering)
- Rispondere a domande sull'azienda e i servizi

💼 INFORMAZIONI AZIENDA:
- Nome: LAPA - Zero Pensieri
- Sito: www.lapa.ch
- Shop online: www.lapa.ch/shop
- Email: info@lapa.ch / lapa@lapa.ch
- Telefono: +41 76 361 70 21
- Zona: Tutta la Svizzera
- Orari: Lun-Ven 8:00-17:00
- Indirizzo: LAPA GmbH, Svizzera

🚚 CONSEGNE:
- Consegna in tutta la Svizzera
- Ordini entro le 12:00 → consegna giorno successivo (zone principali)
- Spedizione gratuita per ordini B2B sopra CHF 150

💳 PAGAMENTI:
- Carte di credito (Visa, Mastercard)
- PostFinance, TWINT
- Fattura (solo clienti business registrati)

${knowledgeBase}

📝 ISTRUZIONI COMPORTAMENTO:
1. Sii sempre cordiale e professionale
2. Rispondi nella STESSA LINGUA del cliente (italiano, tedesco, francese, inglese)
3. Risposte brevi e concise (max 2-3 frasi quando possibile)
4. Suggerisci sempre di visitare lo shop: www.lapa.ch/shop
5. NON inventare prezzi specifici → rimanda allo shop
6. Sii proattivo: suggerisci prodotti correlati quando appropriato
7. Usa emoji con moderazione per rendere la chat più amichevole

🚨 ESCALATION - QUANDO CHIEDERE INTERVENTO UMANO:
Se il cliente chiede una di queste cose, rispondi normalmente MA aggiungi alla fine della tua risposta il tag speciale [NEED_HUMAN]:
- Reclami o problemi con ordini esistenti
- Richieste di preventivi personalizzati B2B
- Problemi di pagamento o fatturazione
- Richieste urgenti
- Se il cliente chiede esplicitamente di parlare con una persona
- Se non riesci a rispondere dopo 2 tentativi
- Richieste di partnership o collaborazioni

Esempio: "Capisco, mi dispiace per il problema con il tuo ordine. Ho notificato il nostro team che ti contatterà al più presto. Nel frattempo, puoi scrivere a info@lapa.ch per velocizzare la risoluzione. [NEED_HUMAN]"

🚫 NON FARE:
- Non parlare di concorrenti
- Non promettere sconti senza verifica
- Non dare informazioni tecniche sui sistemi interni`;

// Widget Chatbot V2 - Design AI moderno
const CHATBOT_WIDGET_V2 = `
<!-- LAPA AI Assistant Widget V2 -->
<style>
/* Nascondi LiveChat Odoo */
.o_livechat_button, #o_livechat_button, .o-livechat-root, [class*="livechat"], .o_LivechatButton { display: none !important; }

/* Pulsante Chat AI */
#lapa-ai-btn{position:fixed;bottom:25px;right:25px;z-index:10000;width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%);border:none;cursor:pointer;box-shadow:0 8px 32px rgba(102,126,234,.4);display:flex;align-items:center;justify-content:center;transition:all .3s cubic-bezier(.4,0,.2,1);overflow:hidden}
#lapa-ai-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);opacity:0;transition:opacity .3s}
#lapa-ai-btn:hover{transform:translateY(-4px) scale(1.05);box-shadow:0 12px 40px rgba(102,126,234,.5)}
#lapa-ai-btn:hover::before{opacity:1}
#lapa-ai-btn svg{width:32px;height:32px;fill:#fff;position:relative;z-index:1}
#lapa-ai-btn .pulse{position:absolute;inset:0;border-radius:20px;background:linear-gradient(135deg,#667eea,#764ba2);animation:pulse 2s infinite}
@keyframes pulse{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.5);opacity:0}}

/* Finestra Chat */
#lapa-ai-chat{position:fixed;bottom:100px;right:25px;z-index:10001;width:400px;max-width:calc(100vw - 40px);height:550px;max-height:calc(100vh - 130px);background:#fff;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#lapa-ai-chat.open{display:flex;animation:slideUp .4s cubic-bezier(.4,0,.2,1)}
@keyframes slideUp{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}

/* Header */
#lapa-ai-header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px;display:flex;align-items:center;gap:14px}
#lapa-ai-header .avatar{width:48px;height:48px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px)}
#lapa-ai-header .avatar svg{width:28px;height:28px;fill:#fff}
#lapa-ai-header .info h4{margin:0;font-size:17px;font-weight:600}
#lapa-ai-header .info p{margin:4px 0 0;font-size:13px;opacity:.9;display:flex;align-items:center;gap:6px}
#lapa-ai-header .info p::before{content:'';width:8px;height:8px;background:#4ade80;border-radius:50%;animation:blink 2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.5}}
#lapa-ai-header .close{margin-left:auto;background:rgba(255,255,255,.2);border:none;color:#fff;width:36px;height:36px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
#lapa-ai-header .close:hover{background:rgba(255,255,255,.3)}
#lapa-ai-header .close svg{width:20px;height:20px;fill:#fff}

/* Messaggi */
#lapa-ai-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)}
.lapa-ai-msg{max-width:85%;padding:14px 18px;border-radius:20px;font-size:14px;line-height:1.6;animation:msgIn .3s cubic-bezier(.4,0,.2,1)}
@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.lapa-ai-msg.bot{background:#fff;border:1px solid #e2e8f0;border-radius:20px 20px 20px 6px;align-self:flex-start;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.lapa-ai-msg.user{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border-radius:20px 20px 6px 20px;align-self:flex-end;box-shadow:0 4px 12px rgba(102,126,234,.3)}
.lapa-ai-msg.typing{background:#fff;border:1px solid #e2e8f0;padding:16px 20px}
.lapa-ai-msg.typing .dots{display:flex;gap:4px}
.lapa-ai-msg.typing span{width:8px;height:8px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;animation:bounce .6s infinite}
.lapa-ai-msg.typing span:nth-child(2){animation-delay:.15s}
.lapa-ai-msg.typing span:nth-child(3){animation-delay:.3s}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

/* Input */
#lapa-ai-input{display:flex;padding:16px;background:#fff;border-top:1px solid #e2e8f0;gap:12px}
#lapa-ai-input input{flex:1;padding:14px 20px;border:2px solid #e2e8f0;border-radius:16px;font-size:14px;outline:none;transition:all .2s}
#lapa-ai-input input:focus{border-color:#667eea;box-shadow:0 0 0 4px rgba(102,126,234,.1)}
#lapa-ai-input input::placeholder{color:#94a3b8}
#lapa-ai-input button{width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
#lapa-ai-input button:hover:not(:disabled){transform:scale(1.05);box-shadow:0 4px 16px rgba(102,126,234,.4)}
#lapa-ai-input button:disabled{opacity:.5;cursor:not-allowed}
#lapa-ai-input button svg{width:22px;height:22px;fill:#fff}

/* Powered by */
#lapa-ai-footer{text-align:center;padding:8px;font-size:11px;color:#94a3b8;background:#f8fafc}
#lapa-ai-footer a{color:#667eea;text-decoration:none}

/* Mobile */
@media(max-width:480px){
  #lapa-ai-chat{bottom:0;right:0;left:0;width:100%;max-width:100%;height:100vh;max-height:100vh;border-radius:0}
  #lapa-ai-btn{bottom:20px;right:20px;width:60px;height:60px}
}
</style>

<button id="lapa-ai-btn" onclick="window.lapaAI.toggle()" title="Chatta con LAPA AI">
  <span class="pulse"></span>
  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
</button>

<div id="lapa-ai-chat">
  <div id="lapa-ai-header">
    <div class="avatar">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
    </div>
    <div class="info">
      <h4>LAPA AI Assistant</h4>
      <p>Online - Rispondo subito</p>
    </div>
    <button class="close" onclick="window.lapaAI.toggle()">
      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
  </div>
  <div id="lapa-ai-messages"></div>
  <div id="lapa-ai-input">
    <input type="text" id="lapa-ai-text" placeholder="Scrivi un messaggio..." onkeypress="if(event.key==='Enter')window.lapaAI.send()">
    <button onclick="window.lapaAI.send()" id="lapa-ai-send">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
  <div id="lapa-ai-footer">Powered by <a href="https://openai.com" target="_blank">AI</a> • LAPA</div>
</div>

<script>
window.lapaAI = {
  isOpen: false,
  messages: [],
  conversationId: 'conv_' + Date.now(),
  systemPrompt: \`${SYSTEM_PROMPT.replace(/`/g, "'").replace(/\\/g, '\\\\')}\`,

  toggle() {
    this.isOpen = !this.isOpen;
    document.getElementById('lapa-ai-chat').classList.toggle('open', this.isOpen);
    if (this.isOpen && this.messages.length === 0) {
      this.addMessage('bot', 'Ciao! 👋 Sono LAPA AI Assistant.\\n\\nCome posso aiutarti oggi? Posso consigliarti prodotti italiani, darti info su ordini e consegne, o supportarti per il tuo business.');
    }
  },

  addMessage(role, content) {
    // Rimuovi tag [NEED_HUMAN] dal messaggio visibile
    const cleanContent = content.replace(/\\[NEED_HUMAN\\]/g, '').trim();
    this.messages.push({ role, content: cleanContent, timestamp: new Date().toISOString() });

    const container = document.getElementById('lapa-ai-messages');
    const msg = document.createElement('div');
    msg.className = 'lapa-ai-msg ' + role;
    msg.innerHTML = cleanContent.replace(/\\n/g, '<br>');
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;

    // Check se serve intervento umano
    if (role === 'bot' && content.includes('[NEED_HUMAN]')) {
      this.notifyHuman();
    }
  },

  showTyping() {
    const container = document.getElementById('lapa-ai-messages');
    const typing = document.createElement('div');
    typing.className = 'lapa-ai-msg bot typing';
    typing.id = 'lapa-ai-typing';
    typing.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  },

  hideTyping() {
    const typing = document.getElementById('lapa-ai-typing');
    if (typing) typing.remove();
  },

  async send() {
    const input = document.getElementById('lapa-ai-text');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this.addMessage('user', text);
    this.showTyping();

    document.getElementById('lapa-ai-send').disabled = true;

    try {
      const response = await this.callAI(text);
      this.hideTyping();
      this.addMessage('bot', response);
    } catch (error) {
      this.hideTyping();
      this.addMessage('bot', 'Mi scuso, c\\'è stato un problema tecnico. Ti consiglio di contattarci direttamente a info@lapa.ch o chiamare durante gli orari di ufficio. [NEED_HUMAN]');
      console.error('AI error:', error);
    }

    document.getElementById('lapa-ai-send').disabled = false;
  },

  async callAI(userMessage) {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.messages.slice(-10).map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Recupera API key da Odoo
    const keyResponse = await fetch('/web/dataset/call_kw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'ir.config_parameter',
          method: 'get_param',
          args: ['openai_api_key'],
          kwargs: {}
        },
        id: Date.now()
      })
    });

    const keyData = await keyResponse.json();
    const apiKey = keyData.result;

    if (!apiKey) throw new Error('API key not configured');

    // Chiama OpenAI
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const aiData = await aiResponse.json();
    if (aiData.error) throw new Error(aiData.error.message);
    return aiData.choices[0].message.content;
  },

  async notifyHuman() {
    console.log('🔔 Richiesta intervento umano');

    // Prepara il riepilogo conversazione
    const summary = this.messages.map(m =>
      (m.role === 'user' ? '👤 Cliente: ' : '🤖 AI: ') + m.content
    ).join('\\n\\n');

    // Invia notifica via Odoo (crea un lead/ticket + email)
    try {
      // Crea lead nel CRM
      const leadResponse = await fetch('/web/dataset/call_kw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'crm.lead',
            method: 'create',
            args: [{
              name: '🤖 Richiesta da AI Chatbot - ' + new Date().toLocaleString('it-CH'),
              description: 'CONVERSAZIONE CHATBOT AI\\n' + '═'.repeat(40) + '\\n\\n' + summary + '\\n\\n' + '═'.repeat(40) + '\\nIl cliente necessita di assistenza umana.',
              email_from: 'lapa@lapa.ch',
              type: 'opportunity',
              priority: '2'
            }],
            kwargs: {}
          },
          id: Date.now()
        })
      });

      // Invia anche email direttamente
      await fetch('/web/dataset/call_kw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'mail.mail',
            method: 'create',
            args: [{
              subject: '🤖 LAPA AI Chatbot - Richiesta Assistenza Cliente',
              email_to: 'lapa@lapa.ch',
              email_from: 'noreply@lapa.ch',
              body_html: '<h2>🤖 Richiesta dal Chatbot AI</h2><p>Un cliente ha richiesto assistenza umana.</p><h3>Conversazione:</h3><pre style="background:#f5f5f5;padding:15px;border-radius:8px;">' + summary.replace(/\\n/g, '<br>') + '</pre><p><strong>Data:</strong> ' + new Date().toLocaleString('it-CH') + '</p><p>Rispondi al più presto!</p>',
              auto_delete: false
            }],
            kwargs: {}
          },
          id: Date.now()
        })
      });

      // Invia l'email
      await fetch('/web/dataset/call_kw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'mail.mail',
            method: 'send',
            args: [[]],
            kwargs: {}
          },
          id: Date.now()
        })
      });

      console.log('✅ Notifica inviata a lapa@lapa.ch');
    } catch (e) {
      console.log('Notifica non inviata:', e);
    }
  }
};

// Nascondi LiveChat Odoo se presente
document.addEventListener('DOMContentLoaded', function() {
  const style = document.createElement('style');
  style.textContent = '.o_livechat_button, #o_livechat_button, .o-livechat-root, [class*="o_livechat"], .o_LivechatButton, .o-mail-ChatWindow { display: none !important; visibility: hidden !important; }';
  document.head.appendChild(style);
});
</script>
<!-- End LAPA AI Assistant Widget V2 -->
`;

class OdooAPI {
  private uid: number | null = null;
  private cookies: string | null = null;

  async authenticate(): Promise<boolean> {
    const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
        id: Date.now()
      })
    });

    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      this.cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
    }

    const data = await response.json();
    if (data.result?.uid) {
      this.uid = data.result.uid;
      if (!this.cookies && data.result.session_id) {
        this.cookies = `session_id=${data.result.session_id}`;
      }
      return true;
    }
    throw new Error('Authentication failed');
  }

  async searchRead<T>(model: string, domain: any[], fields: string[], options: any = {}): Promise<T[]> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model, method: 'search_read', args: [],
          kwargs: { domain, fields, limit: options.limit || 100 }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${model}: ${data.error.message}`);
    return data.result || [];
  }

  async write(model: string, ids: number[], values: any): Promise<boolean> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'write', args: [ids, values], kwargs: {} },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || false;
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🤖 LAPA AI Assistant V2 - Update Design + Notifiche');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // Leggi il custom_code_footer attuale
    console.log('📖 Lettura configurazione website...');
    const websites = await odoo.searchRead<any>(
      'website',
      [['id', '=', 1]],
      ['id', 'name', 'custom_code_footer'],
      { limit: 1 }
    );

    if (websites.length === 0) {
      throw new Error('Website non trovato');
    }

    const website = websites[0];
    let currentFooterCode = website.custom_code_footer || '';

    console.log(`   Website: ${website.name} (ID: ${website.id})`);

    // Rimuovi vecchio chatbot
    if (currentFooterCode.includes('lapa-chatbot') || currentFooterCode.includes('lapa-ai')) {
      console.log('   🗑️ Rimozione vecchio chatbot...');
      currentFooterCode = currentFooterCode
        .replace(/<!-- LAPA AI Chatbot Widget -->[\s\S]*?<!-- End LAPA AI Chatbot Widget -->/g, '')
        .replace(/<!-- LAPA AI Assistant Widget[\s\S]*?<!-- End LAPA AI Assistant Widget[^>]*-->/g, '');
    }

    // Aggiungi il nuovo chatbot V2
    console.log('\n📝 Installazione LAPA AI Assistant V2...');
    const newFooterCode = currentFooterCode.trim() + '\n' + CHATBOT_WIDGET_V2;

    const success = await odoo.write('website', [1], {
      custom_code_footer: newFooterCode
    });

    if (success) {
      console.log('✅ Chatbot V2 installato!\n');
      console.log('═'.repeat(80));
      console.log('✨ AGGIORNAMENTO COMPLETATO!');
      console.log('═'.repeat(80));
      console.log(`
🤖 LAPA AI Assistant V2 è attivo!

NOVITÀ:
   🎨 Design AI moderno (blu/viola gradiente)
   🚫 LiveChat Odoo nascosto
   📧 Notifiche automatiche quando serve intervento umano
   🎯 Crea lead in CRM per follow-up

ASPETTO:
   💜 Colore: Gradiente blu-viola AI style
   ✨ Animazioni fluide e moderne
   🌐 Icona globo AI

FUNZIONALITÀ ESCALATION:
   Quando il cliente chiede:
   - Reclami ordini
   - Preventivi B2B
   - Problemi pagamento
   - Vuole parlare con una persona

   → L'AI risponde E crea automaticamente un lead nel CRM
   → Il team riceve la notifica per follow-up

👉 Vai su https://www.lapa.ch per testarlo!
   (Ctrl+Shift+R per svuotare la cache)
`);
    } else {
      throw new Error('Write ha restituito false');
    }

  } catch (error) {
    console.error('\n❌ Errore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
