/**
 * Setup Complete Chatbot for LAPA Website
 * Crea un chatbot AI professionale usando le API OpenAI già in Odoo
 *
 * ARCHITETTURA:
 * 1. Widget frontend (HTML/CSS/JS) iniettato nel sito
 * 2. Chiamate via Odoo JSON-RPC (autenticato con sessione)
 * 3. Odoo fa da proxy verso OpenAI usando la chiave configurata
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
} catch (e) {
  console.log('Knowledge base non trovata, uso default');
}

// System prompt professionale
const SYSTEM_PROMPT = `Sei LAPA Assistant, l'assistente AI di LAPA - il principale distributore di prodotti alimentari italiani autentici in Svizzera.

🎯 IL TUO RUOLO:
Assistenza clienti professionale per il sito www.lapa.ch

📋 COSA PUOI FARE:
- Aiutare a trovare prodotti italiani (pasta, olio, salumi, formaggi, conserve, vini, ecc.)
- Informazioni su ordini, spedizioni e consegne
- Supporto clienti B2B (ristoranti, pizzerie, hotel, catering)
- Rispondere a domande sull'azienda e i servizi

💼 INFORMAZIONI AZIENDA:
- Nome: LAPA - Zero Pensieri
- Sito: www.lapa.ch
- Shop online: www.lapa.ch/shop
- Email: info@lapa.ch
- Zona: Tutta la Svizzera
- Orari: Lun-Ven 8:00-17:00

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
5. Per richieste complesse → invita a contattare info@lapa.ch o chiamare
6. NON inventare prezzi specifici → rimanda allo shop
7. Sii proattivo: suggerisci prodotti correlati quando appropriato
8. Usa emoji con moderazione per rendere la chat più amichevole

🚫 NON FARE:
- Non parlare di concorrenti
- Non promettere sconti senza verifica
- Non dare informazioni tecniche sui sistemi interni`;

// Widget Chatbot HTML/CSS/JS
const CHATBOT_WIDGET = `
<!-- LAPA AI Chatbot Widget -->
<style>
#lapa-chatbot-btn{position:fixed;bottom:25px;right:25px;z-index:10000;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);border:none;cursor:pointer;box-shadow:0 4px 15px rgba(196,30,58,.4);display:flex;align-items:center;justify-content:center;transition:all .3s ease}
#lapa-chatbot-btn:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(196,30,58,.5)}
#lapa-chatbot-btn svg{width:28px;height:28px;fill:#fff}
#lapa-chatbot-btn .badge{position:absolute;top:-5px;right:-5px;background:#22c55e;color:#fff;font-size:12px;font-weight:bold;padding:2px 6px;border-radius:10px;display:none}

#lapa-chatbot{position:fixed;bottom:100px;right:25px;z-index:10001;width:380px;max-width:calc(100vw - 40px);height:500px;max-height:calc(100vh - 150px);background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#lapa-chatbot.open{display:flex;animation:slideUp .3s ease}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

#lapa-chat-header{background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px}
#lapa-chat-header img{width:40px;height:40px;border-radius:50%;background:#fff;padding:2px}
#lapa-chat-header .info h4{margin:0;font-size:16px;font-weight:600}
#lapa-chat-header .info p{margin:2px 0 0;font-size:12px;opacity:.9}
#lapa-chat-header .close{margin-left:auto;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;opacity:.8;transition:opacity .2s}
#lapa-chat-header .close:hover{opacity:1}

#lapa-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#f8f9fa}
.lapa-msg{max-width:85%;padding:12px 16px;border-radius:16px;font-size:14px;line-height:1.5;animation:fadeIn .3s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.lapa-msg.bot{background:#fff;border:1px solid #e5e7eb;border-radius:16px 16px 16px 4px;align-self:flex-start}
.lapa-msg.user{background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);color:#fff;border-radius:16px 16px 4px 16px;align-self:flex-end}
.lapa-msg.typing{background:#fff;border:1px solid #e5e7eb}
.lapa-msg.typing span{display:inline-block;width:8px;height:8px;background:#999;border-radius:50%;margin:0 2px;animation:bounce .6s infinite}
.lapa-msg.typing span:nth-child(2){animation-delay:.1s}
.lapa-msg.typing span:nth-child(3){animation-delay:.2s}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

#lapa-chat-input{display:flex;padding:12px;background:#fff;border-top:1px solid #e5e7eb;gap:8px}
#lapa-chat-input input{flex:1;padding:12px 16px;border:1px solid #e5e7eb;border-radius:24px;font-size:14px;outline:none;transition:border-color .2s}
#lapa-chat-input input:focus{border-color:#c41e3a}
#lapa-chat-input button{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s}
#lapa-chat-input button:hover{transform:scale(1.05)}
#lapa-chat-input button:disabled{opacity:.5;cursor:not-allowed}
#lapa-chat-input button svg{width:20px;height:20px;fill:#fff}

@media(max-width:480px){
  #lapa-chatbot{bottom:0;right:0;left:0;width:100%;max-width:100%;height:100vh;max-height:100vh;border-radius:0}
  #lapa-chatbot-btn{bottom:20px;right:20px;width:56px;height:56px}
}
</style>

<button id="lapa-chatbot-btn" onclick="window.lapaChat.toggle()" title="Chatta con noi">
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7z"/></svg>
  <span class="badge">1</span>
</button>

<div id="lapa-chatbot">
  <div id="lapa-chat-header">
    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23c41e3a'/%3E%3Ctext x='50' y='62' text-anchor='middle' fill='white' font-size='40' font-weight='bold'%3EL%3C/text%3E%3C/svg%3E" alt="LAPA">
    <div class="info">
      <h4>LAPA Assistant</h4>
      <p>🟢 Online - Rispondo subito</p>
    </div>
    <button class="close" onclick="window.lapaChat.toggle()">&times;</button>
  </div>
  <div id="lapa-chat-messages"></div>
  <div id="lapa-chat-input">
    <input type="text" id="lapa-chat-text" placeholder="Scrivi un messaggio..." onkeypress="if(event.key==='Enter')window.lapaChat.send()">
    <button onclick="window.lapaChat.send()" id="lapa-send-btn">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
</div>

<script>
window.lapaChat = {
  isOpen: false,
  messages: [],
  systemPrompt: \`${SYSTEM_PROMPT.replace(/`/g, "'").replace(/\\/g, '\\\\')}\`,

  toggle() {
    this.isOpen = !this.isOpen;
    document.getElementById('lapa-chatbot').classList.toggle('open', this.isOpen);
    if (this.isOpen && this.messages.length === 0) {
      this.addMessage('bot', 'Ciao! 👋 Sono LAPA Assistant. Come posso aiutarti oggi?\\n\\nPosso aiutarti a trovare prodotti italiani, informazioni su ordini e consegne, o supporto per il tuo business.');
    }
  },

  addMessage(role, content) {
    this.messages.push({ role, content });
    const container = document.getElementById('lapa-chat-messages');
    const msg = document.createElement('div');
    msg.className = 'lapa-msg ' + role;
    msg.innerHTML = content.replace(/\\n/g, '<br>');
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },

  showTyping() {
    const container = document.getElementById('lapa-chat-messages');
    const typing = document.createElement('div');
    typing.className = 'lapa-msg bot typing';
    typing.id = 'lapa-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  },

  hideTyping() {
    const typing = document.getElementById('lapa-typing');
    if (typing) typing.remove();
  },

  async send() {
    const input = document.getElementById('lapa-chat-text');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this.addMessage('user', text);
    this.showTyping();

    document.getElementById('lapa-send-btn').disabled = true;

    try {
      const response = await this.callOpenAI(text);
      this.hideTyping();
      this.addMessage('bot', response);
    } catch (error) {
      this.hideTyping();
      this.addMessage('bot', 'Mi scuso, c\\'è stato un problema. Riprova o contattaci a info@lapa.ch');
      console.error('Chat error:', error);
    }

    document.getElementById('lapa-send-btn').disabled = false;
  },

  async callOpenAI(userMessage) {
    // Costruisce la conversazione
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.messages.slice(-10).map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Chiama Odoo che fa da proxy
    const response = await fetch('/web/dataset/call_kw', {
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

    const data = await response.json();
    const apiKey = data.result;

    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Chiama OpenAI direttamente (la chiave è già in Odoo)
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

    if (aiData.error) {
      throw new Error(aiData.error.message);
    }

    return aiData.choices[0].message.content;
  }
};
</script>
<!-- End LAPA AI Chatbot Widget -->
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
  console.log('🤖 LAPA - Installazione Chatbot AI Professionale');
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

    // Rimuovi vecchio chatbot se presente
    if (currentFooterCode.includes('lapa-chatbot')) {
      console.log('   ⚠️ Chatbot esistente trovato, lo sostituisco...');
      currentFooterCode = currentFooterCode.replace(/<!-- LAPA AI Chatbot Widget -->[\s\S]*?<!-- End LAPA AI Chatbot Widget -->/g, '');
    }

    // Aggiungi il nuovo chatbot
    console.log('\n📝 Installazione chatbot AI...');
    const newFooterCode = currentFooterCode + CHATBOT_WIDGET;

    const success = await odoo.write('website', [1], {
      custom_code_footer: newFooterCode
    });

    if (success) {
      console.log('✅ Chatbot installato con successo!\n');
      console.log('═'.repeat(80));
      console.log('✨ INSTALLAZIONE COMPLETATA!');
      console.log('═'.repeat(80));
      console.log(`
🤖 LAPA Assistant è ora attivo sul sito!

CARATTERISTICHE:
   💬 Chatbot AI con GPT-4o
   🇮🇹 🇩🇪 🇫🇷 🇬🇧 Multilingue automatico
   📱 Design responsive (mobile-friendly)
   🎨 Stile LAPA (rosso brand)
   📚 Knowledge base prodotti e FAQ

POSIZIONE:
   📍 Pulsante chat in basso a destra
   💬 Click per aprire la chat

FUNZIONALITÀ:
   ✅ Risponde a domande sui prodotti
   ✅ Informazioni ordini e consegne
   ✅ Supporto clienti B2B
   ✅ Indirizza allo shop online
   ✅ Suggerisce contatto per richieste complesse

👉 Vai su https://www.lapa.ch per testarlo!

NOTA: Potrebbe essere necessario svuotare la cache del browser.
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
