/**
 * Chatbot V3 - Con Ticket Helpdesk e rilevamento utente
 * - Rileva se utente è loggato
 * - Chiede nome/email se non loggato
 * - Crea ticket Helpdesk quando serve intervento
 * - Numero telefono corretto: +41 76 361 70 21
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
`;
} catch (e) {}

// System prompt V3 - Assistente completo
const SYSTEM_PROMPT = `Sei LAPA AI Assistant, l'assistente virtuale intelligente di LAPA - il principale distributore di prodotti alimentari italiani autentici in Svizzera.

🌟 LA NOSTRA MISSIONE:
LAPA significa "Zero Pensieri" - portiamo l'autentica Italia direttamente nella tua cucina svizzera. Selezioniamo personalmente ogni prodotto dai migliori produttori italiani, garantendo qualità, freschezza e autenticità. Siamo il ponte tra le eccellenze gastronomiche italiane e i professionisti della ristorazione svizzera.

💪 PERCHÉ SCEGLIERE LAPA:
- Prodotti 100% autentici italiani, selezionati con passione
- Rapporto qualità-prezzo imbattibile
- Consegna rapida e affidabile in tutta la Svizzera
- Servizio clienti dedicato e personalizzato
- Partner di fiducia per oltre 500 ristoranti, pizzerie e hotel
- Esperienza ventennale nel settore food italiano

🎯 IL TUO RUOLO:
Sei un assistente cordiale, competente e appassionato di gastronomia italiana. Il tuo obiettivo è:
1. Far sentire ogni cliente benvenuto e a proprio agio
2. Guidarli nel percorso d'acquisto con entusiasmo
3. Consigliare prodotti in base alle loro esigenze
4. Risolvere dubbi e problemi con professionalità
5. Trasmettere la passione per la qualità italiana

📋 COSA PUOI FARE:
- Aiutare a trovare prodotti italiani (pasta, olio, salumi, formaggi, conserve, vini)
- Consigliare abbinamenti e utilizzi dei prodotti
- Informazioni su ordini, spedizioni e consegne
- Supporto clienti B2B (ristoranti, pizzerie, hotel, catering)
- Rispondere a domande sull'azienda e i nostri valori

💼 INFORMAZIONI AZIENDA:
- Nome: LAPA - Zero Pensieri
- Sito: www.lapa.ch
- Shop online: www.lapa.ch/shop
- Email: info@lapa.ch / lapa@lapa.ch
- Telefono: +41 76 361 70 21
- Zona: Tutta la Svizzera (Zurigo, Berna, Basilea, Ginevra, Lugano...)
- Orari: Lun-Ven 8:00-17:00

🚚 CONSEGNE:
- Consegna in tutta la Svizzera con mezzi refrigerati
- Ordini entro le 12:00 → consegna giorno successivo (zone principali)
- Spedizione gratuita per ordini B2B sopra CHF 150
- Tracciamento ordine disponibile

💳 PAGAMENTI:
- Carte di credito (Visa, Mastercard, AmEx)
- PostFinance
- TWINT
- Fattura (clienti business verificati)

🍝 CATEGORIE PRODOTTI:
- Pasta artigianale e industriale
- Olio extra vergine d'oliva
- Salumi e prosciutti DOP
- Formaggi italiani (Parmigiano, Mozzarella, Gorgonzola...)
- Conserve e sughi
- Farine e lieviti
- Dolci e caffè
- Vini e bevande italiane

${knowledgeBase}

📝 ISTRUZIONI DI COMPORTAMENTO:
1. Rispondi nella STESSA LINGUA del cliente (italiano, tedesco, francese, inglese)
2. Sii cordiale, professionale ma anche caloroso - siamo italiani!
3. Risposte chiare e utili (2-4 frasi)
4. Suggerisci sempre lo shop: www.lapa.ch/shop quando appropriato
5. NON inventare prezzi → rimanda allo shop per prezzi aggiornati
6. Usa emoji con moderazione per rendere la conversazione piacevole
7. Se il cliente sembra indeciso, proponi opzioni o chiedi delle sue preferenze
8. Ringrazia sempre per l'interesse e invita a tornare

💬 ESEMPI DI RISPOSTE IDEALI:
- "Ciao! Che piacere averti qui 🇮🇹 Cerchi qualcosa di specifico o vuoi scoprire le nostre specialità italiane?"
- "Ottima scelta! La nostra pasta artigianale è perfetta per chi cerca l'autentico sapore italiano. La trovi su www.lapa.ch/shop nella sezione Pasta!"
- "Per un ristorante come il tuo, consiglio di dare un'occhiata ai nostri pacchetti B2B - abbiamo condizioni speciali per i professionisti!"

🚨 ESCALATION - Aggiungi [NEED_HUMAN] alla fine SOLO se il cliente:
- Ha reclami o problemi con ordini esistenti
- Chiede preventivi B2B personalizzati per grandi quantità
- Ha problemi di pagamento/fatturazione
- Chiede esplicitamente di parlare con una persona
- Richiede appuntamenti o visite in sede
- Ha domande molto tecniche o specifiche che non sai gestire
- Segnala problemi con prodotti ricevuti

Quando serve escalation, raccogli SEMPRE:
- Nome del cliente
- Email per contattarlo
- Breve descrizione del problema/richiesta
- Numero telefono (se disponibile)

Esempio risposta con escalation:
"Capisco perfettamente, questa richiesta merita l'attenzione del nostro team dedicato. Ti metto subito in contatto con Laura che si occuperà personalmente di te. Puoi anche chiamarci al +41 76 361 70 21 o scrivere a info@lapa.ch. Ti ricontatteremo entro poche ore! [NEED_HUMAN]"`;

// Widget Chatbot V3 con Helpdesk
const CHATBOT_WIDGET_V3 = `
<!-- LAPA AI Assistant V3 - Helpdesk Integration -->
<style>
.o_livechat_button,.o-livechat-root,[class*="o_livechat"],.o_LivechatButton,.o-mail-ChatWindow{display:none!important}
#lapa-ai-btn{position:fixed;bottom:25px;right:25px;z-index:10000;width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%);border:none;cursor:pointer;box-shadow:0 8px 32px rgba(102,126,234,.4);display:flex;align-items:center;justify-content:center;transition:all .3s cubic-bezier(.4,0,.2,1)}
#lapa-ai-btn:hover{transform:translateY(-4px) scale(1.05);box-shadow:0 12px 40px rgba(102,126,234,.5)}
#lapa-ai-btn svg{width:32px;height:32px;fill:#fff}
#lapa-ai-btn .pulse{position:absolute;inset:0;border-radius:20px;background:linear-gradient(135deg,#667eea,#764ba2);animation:pulse 2s infinite}
@keyframes pulse{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.5);opacity:0}}
#lapa-ai-chat{position:fixed;bottom:100px;right:25px;z-index:10001;width:400px;max-width:calc(100vw - 40px);height:550px;max-height:calc(100vh - 130px);background:#fff;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#lapa-ai-chat.open{display:flex;animation:slideUp .4s cubic-bezier(.4,0,.2,1)}
@keyframes slideUp{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
#lapa-ai-header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px}
#lapa-ai-header .avatar{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
#lapa-ai-header .avatar svg{width:20px;height:20px;fill:#fff}
#lapa-ai-header .info h4{margin:0;font-size:14px;font-weight:600}
#lapa-ai-header .info p{margin:2px 0 0;font-size:11px;opacity:.85;display:flex;align-items:center;gap:5px}
#lapa-ai-header .info p::before{content:'';width:6px;height:6px;background:#4ade80;border-radius:50%}
#lapa-ai-header .close{margin-left:auto;background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
#lapa-ai-header .close:hover{background:rgba(255,255,255,.25)}
#lapa-ai-header .close svg{width:16px;height:16px;fill:#fff}
#lapa-ai-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)}
.lapa-ai-msg{max-width:85%;padding:14px 18px;border-radius:20px;font-size:14px;line-height:1.6;animation:msgIn .3s}
@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.lapa-ai-msg.bot{background:#fff;border:1px solid #e2e8f0;border-radius:20px 20px 20px 6px;align-self:flex-start;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.lapa-ai-msg.user{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border-radius:20px 20px 6px 20px;align-self:flex-end}
.lapa-ai-msg.typing .dots{display:flex;gap:4px}
.lapa-ai-msg.typing span{width:8px;height:8px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;animation:bounce .6s infinite}
.lapa-ai-msg.typing span:nth-child(2){animation-delay:.15s}
.lapa-ai-msg.typing span:nth-child(3){animation-delay:.3s}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.lapa-ai-msg.system{background:#fef3c7;border:1px solid #fcd34d;font-size:13px;text-align:center;align-self:center;max-width:90%}
#lapa-ai-input{display:flex;padding:16px;background:#fff;border-top:1px solid #e2e8f0;gap:8px;align-items:center}
#lapa-ai-input .attach-btn{width:40px;height:40px;border-radius:12px;background:#f1f5f9;border:2px solid #e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
#lapa-ai-input .attach-btn:hover{background:#e2e8f0;border-color:#667eea}
#lapa-ai-input .attach-btn svg{width:20px;height:20px;fill:#64748b}
#lapa-ai-input input[type="text"]{flex:1;padding:12px 16px;border:2px solid #e2e8f0;border-radius:16px;font-size:14px;outline:none;transition:all .2s;min-width:0}
#lapa-ai-input input[type="text"]:focus{border-color:#667eea}
#lapa-ai-input .send-btn{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
#lapa-ai-input .send-btn:hover:not(:disabled){transform:scale(1.05)}
#lapa-ai-input .send-btn:disabled{opacity:.5}
#lapa-ai-input .send-btn svg{width:20px;height:20px;fill:#fff}
#lapa-ai-footer{text-align:center;padding:5px;font-size:9px;color:#a1a1aa;background:#fafafa}
#lapa-attachments{display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px;background:#f8fafc;border-top:1px solid #e2e8f0}
#lapa-attachments:empty{display:none}
.lapa-attachment{display:flex;align-items:center;gap:6px;padding:6px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;max-width:150px}
.lapa-attachment span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lapa-attachment .remove{width:16px;height:16px;background:#ef4444;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lapa-attachment .remove svg{width:10px;height:10px;fill:#fff}
.lapa-ai-msg .attachment-preview{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
.lapa-ai-msg .attachment-preview img{max-width:120px;max-height:80px;border-radius:8px;cursor:pointer}
.lapa-ai-msg .attachment-preview .file-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:rgba(255,255,255,.2);border-radius:6px;font-size:11px}
#lapa-user-form{padding:20px;background:#f8fafc;border-top:1px solid #e2e8f0}
#lapa-user-form h5{margin:0 0 12px;font-size:14px;color:#374151}
#lapa-user-form input{width:100%;padding:12px;margin-bottom:10px;border:2px solid #e2e8f0;border-radius:12px;font-size:14px;box-sizing:border-box}
#lapa-user-form input:focus{border-color:#667eea;outline:none}
#lapa-user-form button{width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer}
@media(max-width:768px){#lapa-ai-chat{bottom:0;right:0;left:0;width:100%;max-width:100%;height:calc(100vh - 60px);max-height:calc(100vh - 60px);border-radius:16px 16px 0 0}#lapa-ai-btn{bottom:80px;right:15px;width:54px;height:54px}}
</style>

<button id="lapa-ai-btn" onclick="window.lapaAI.toggle()" title="Chatta con LAPA AI">
  <span class="pulse"></span>
  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
</button>

<div id="lapa-ai-chat">
  <div id="lapa-ai-header">
    <div class="avatar"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div>
    <div class="info"><h4>LAPA AI Assistant</h4><p>Online - Rispondo subito</p></div>
    <button class="close" onclick="window.lapaAI.toggle()"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
  </div>
  <div id="lapa-ai-messages"></div>
  <div id="lapa-attachments"></div>
  <div id="lapa-ai-input">
    <input type="file" id="lapa-file-input" multiple accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display:none" onchange="window.lapaAI.handleFiles(this.files)">
    <button class="attach-btn" onclick="document.getElementById('lapa-file-input').click()" title="Allega file">
      <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
    </button>
    <input type="text" id="lapa-ai-text" placeholder="Scrivi un messaggio..." onkeypress="if(event.key==='Enter')window.lapaAI.send()">
    <button class="send-btn" onclick="window.lapaAI.send()" id="lapa-ai-send" title="Invia">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
  <div id="lapa-ai-footer">Powered by AI • LAPA</div>
</div>

<script>
window.lapaAI = {
  isOpen: false,
  messages: [],
  attachments: [], // Array di {file: File, base64: string, preview: string}
  pendingAttachments: [], // Allegati in attesa di essere salvati nel ticket
  user: { name: null, email: null, phone: null, partner_id: null, logged_in: false },
  systemPrompt: \`${SYSTEM_PROMPT.replace(/`/g, "'").replace(/\\/g, '\\\\')}\`,

  async init() {
    // Prova a recuperare info utente loggato
    try {
      const resp = await fetch('/web/session/get_session_info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {}, id: Date.now() })
      });
      const data = await resp.json();
      if (data.result && data.result.uid && data.result.uid !== 4) { // 4 = public user
        this.user.logged_in = true;
        this.user.name = data.result.name || data.result.username;
        this.user.partner_id = data.result.partner_id;

        // Recupera email
        if (data.result.partner_id) {
          const partnerResp = await fetch('/web/dataset/call_kw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', method: 'call',
              params: { model: 'res.partner', method: 'read', args: [[data.result.partner_id], ['email']], kwargs: {} },
              id: Date.now()
            })
          });
          const partnerData = await partnerResp.json();
          if (partnerData.result && partnerData.result[0]) {
            this.user.email = partnerData.result[0].email;
          }
        }
        console.log('👤 Utente loggato:', this.user.name, this.user.email);
      }
    } catch (e) {
      console.log('Utente non loggato');
    }
  },

  toggle() {
    this.isOpen = !this.isOpen;
    document.getElementById('lapa-ai-chat').classList.toggle('open', this.isOpen);
    if (this.isOpen && this.messages.length === 0) {
      let greeting = 'Ciao! 👋 Benvenuto da LAPA - Zero Pensieri!';
      if (this.user.logged_in && this.user.name) {
        greeting = 'Ciao ' + this.user.name.split(' ')[0] + '! 👋 Che piacere rivederti!';
      }
      this.addMessage('bot', greeting + '\\n\\nSono il tuo assistente AI per prodotti italiani autentici. Posso aiutarti a trovare prodotti, rispondere a domande su ordini e consegne, o metterti in contatto con il nostro team.\\n\\nCome posso aiutarti oggi? 🇮🇹');
    }
  },

  addMessage(role, content) {
    const cleanContent = content.replace(/\\[NEED_HUMAN\\]/g, '').trim();
    this.messages.push({ role, content: cleanContent, timestamp: new Date().toISOString() });
    const container = document.getElementById('lapa-ai-messages');
    const msg = document.createElement('div');
    msg.className = 'lapa-ai-msg ' + role;
    msg.innerHTML = cleanContent.replace(/\\n/g, '<br>');
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    if (role === 'bot' && content.includes('[NEED_HUMAN]')) {
      this.handleEscalation();
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
    const t = document.getElementById('lapa-ai-typing');
    if (t) t.remove();
  },

  // Gestione file allegati
  async handleFiles(files) {
    const maxSize = 10 * 1024 * 1024; // 10MB max per file
    const maxFiles = 5;

    if (this.attachments.length + files.length > maxFiles) {
      alert('Puoi allegare massimo ' + maxFiles + ' file');
      return;
    }

    for (const file of files) {
      if (file.size > maxSize) {
        alert('Il file "' + file.name + '" supera i 10MB');
        continue;
      }

      // Converti in base64
      const base64 = await this.fileToBase64(file);
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

      this.attachments.push({
        file: file,
        name: file.name,
        type: file.type,
        size: file.size,
        base64: base64,
        preview: preview
      });
    }

    this.renderAttachments();
    document.getElementById('lapa-file-input').value = ''; // Reset input
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]); // Solo la parte base64
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  renderAttachments() {
    const container = document.getElementById('lapa-attachments');
    container.innerHTML = this.attachments.map((att, i) => {
      const icon = att.type.startsWith('image/') ? '🖼️' : att.type.startsWith('audio/') ? '🎵' : '📄';
      return '<div class="lapa-attachment">' + icon + ' <span title="' + att.name + '">' + att.name.substring(0, 15) + (att.name.length > 15 ? '...' : '') + '</span><button class="remove" onclick="window.lapaAI.removeAttachment(' + i + ')"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></div>';
    }).join('');
  },

  removeAttachment(index) {
    if (this.attachments[index].preview) {
      URL.revokeObjectURL(this.attachments[index].preview);
    }
    this.attachments.splice(index, 1);
    this.renderAttachments();
  },

  addMessageWithAttachments(role, content, attachments) {
    const cleanContent = content.replace(/\\[NEED_HUMAN\\]/g, '').trim();
    this.messages.push({ role, content: cleanContent, attachments: attachments || [], timestamp: new Date().toISOString() });
    const container = document.getElementById('lapa-ai-messages');
    const msg = document.createElement('div');
    msg.className = 'lapa-ai-msg ' + role;

    let html = cleanContent.replace(/\\n/g, '<br>');

    // Mostra preview degli allegati
    if (attachments && attachments.length > 0) {
      html += '<div class="attachment-preview">';
      for (const att of attachments) {
        if (att.preview) {
          html += '<img src="' + att.preview + '" alt="' + att.name + '" onclick="window.open(this.src)">';
        } else {
          const icon = att.type.startsWith('audio/') ? '🎵' : '📄';
          html += '<span class="file-badge">' + icon + ' ' + att.name + '</span>';
        }
      }
      html += '</div>';
    }

    msg.innerHTML = html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    if (role === 'bot' && content.includes('[NEED_HUMAN]')) {
      this.handleEscalation();
    }
  },

  async send() {
    const input = document.getElementById('lapa-ai-text');
    const text = input.value.trim();
    const hasAttachments = this.attachments.length > 0;

    if (!text && !hasAttachments) return;

    input.value = '';

    // Salva allegati correnti e resetta
    const currentAttachments = [...this.attachments];
    this.attachments = [];
    this.renderAttachments();

    // Mostra messaggio con allegati
    let displayText = text || '';
    if (currentAttachments.length > 0) {
      displayText += (text ? '\\n' : '') + '📎 ' + currentAttachments.length + ' allegat' + (currentAttachments.length > 1 ? 'i' : 'o');
    }
    this.addMessageWithAttachments('user', displayText, currentAttachments);

    this.showTyping();
    document.getElementById('lapa-ai-send').disabled = true;

    try {
      // Se ci sono allegati, crea subito un ticket
      if (currentAttachments.length > 0) {
        this.pendingAttachments = currentAttachments;
        const response = await this.callAI(text || 'Ho allegato dei file per la mia richiesta.');
        this.hideTyping();
        this.addMessage('bot', response);
      } else {
        const response = await this.callAI(text);
        this.hideTyping();
        this.addMessage('bot', response);
      }
    } catch (error) {
      this.hideTyping();
      this.addMessage('bot', 'Mi scuso per il problema tecnico. Contattaci al +41 76 361 70 21 o info@lapa.ch [NEED_HUMAN]');
    }
    document.getElementById('lapa-ai-send').disabled = false;
  },

  async callAI(userMessage) {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.messages.slice(-10).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: userMessage }
    ];
    const keyResp = await fetch('/web/dataset/call_kw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model: 'ir.config_parameter', method: 'get_param', args: ['openai_api_key'], kwargs: {} }, id: Date.now() })
    });
    const keyData = await keyResp.json();
    const apiKey = keyData.result;
    if (!apiKey) throw new Error('API key missing');
    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'gpt-4o', messages, max_tokens: 500, temperature: 0.7 })
    });
    const aiData = await aiResp.json();
    if (aiData.error) throw new Error(aiData.error.message);
    return aiData.choices[0].message.content;
  },

  async handleEscalation() {
    console.log('🎫 Creazione ticket Helpdesk...');

    // Se non abbiamo i dati utente, chiediamoli
    if (!this.user.name || !this.user.email) {
      this.askUserInfo();
      return;
    }

    await this.createTicket();
  },

  askUserInfo() {
    const container = document.getElementById('lapa-ai-messages');
    const form = document.createElement('div');
    form.id = 'lapa-user-form-inline';
    form.className = 'lapa-ai-msg system';
    form.innerHTML = \`
      <div style="text-align:left">
        <p style="margin:0 0 10px;font-weight:600">📝 Per metterti in contatto con il nostro team, inserisci i tuoi dati:</p>
        <input type="text" id="lapa-user-name" placeholder="Il tuo nome *" style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box">
        <input type="email" id="lapa-user-email" placeholder="La tua email *" style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box">
        <input type="tel" id="lapa-user-phone" placeholder="Telefono (opzionale)" style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box">
        <button onclick="window.lapaAI.submitUserInfo()" style="width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px">📩 Invia richiesta al team</button>
        <p style="margin:8px 0 0;font-size:11px;color:#666;text-align:center">Ti ricontatteremo entro poche ore!</p>
      </div>
    \`;
    container.appendChild(form);
    container.scrollTop = container.scrollHeight;
  },

  async submitUserInfo() {
    const name = document.getElementById('lapa-user-name').value.trim();
    const email = document.getElementById('lapa-user-email').value.trim();
    const phone = document.getElementById('lapa-user-phone').value.trim();

    if (!name || !email) {
      alert('Per favore inserisci nome e email');
      return;
    }

    // Validazione email semplice
    if (!email.includes('@') || !email.includes('.')) {
      alert('Per favore inserisci un indirizzo email valido');
      return;
    }

    this.user.name = name;
    this.user.email = email;
    this.user.phone = phone || null;

    // Rimuovi il form
    const form = document.getElementById('lapa-user-form-inline');
    if (form) form.remove();

    this.addMessage('bot', 'Grazie ' + name + '! Sto creando la tua richiesta...');

    await this.createTicket();
  },

  async createTicket() {
    const summary = this.messages.map(m =>
      (m.role === 'user' ? '👤 Cliente: ' : '🤖 AI: ') + m.content
    ).join('\\n\\n');

    const ticketDescription = \`
<h3>🤖 Conversazione con LAPA AI Assistant</h3>
<p><strong>Cliente:</strong> \${this.user.name || 'Non specificato'}</p>
<p><strong>Email:</strong> \${this.user.email || 'Non specificata'}</p>
<p><strong>Telefono:</strong> \${this.user.phone || 'Non specificato'}</p>
<p><strong>Data:</strong> \${new Date().toLocaleString('it-CH')}</p>
<hr>
<h4>Conversazione:</h4>
<pre style="background:#f5f5f5;padding:15px;border-radius:8px;white-space:pre-wrap;">\${summary}</pre>
<hr>
<p><em>Ticket creato automaticamente da LAPA AI Assistant</em></p>
    \`;

    try {
      // Crea ticket Helpdesk
      const ticketResp = await fetch('/web/dataset/call_kw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'helpdesk.ticket',
            method: 'create',
            args: [{
              name: '🤖 Chat AI - ' + (this.user.name || 'Cliente') + ' - ' + new Date().toLocaleDateString('it-CH'),
              description: ticketDescription,
              partner_name: this.user.name,
              partner_email: this.user.email,
              partner_id: this.user.partner_id || false,
              team_id: 1, // Customer Care
              priority: '2',
              user_id: 8 // Assegna a Laura Teodorescu
            }],
            kwargs: {}
          },
          id: Date.now()
        })
      });

      const ticketData = await ticketResp.json();

      if (ticketData.result) {
        const ticketId = ticketData.result;
        console.log('✅ Ticket creato: #' + ticketId);

        // Allega i file al ticket se presenti
        const allAttachments = this.getAllAttachmentsFromMessages();
        if (allAttachments.length > 0) {
          console.log('📎 Allegando ' + allAttachments.length + ' file al ticket...');
          for (const att of allAttachments) {
            try {
              await fetch('/web/dataset/call_kw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    model: 'ir.attachment',
                    method: 'create',
                    args: [{
                      name: att.name,
                      datas: att.base64,
                      res_model: 'helpdesk.ticket',
                      res_id: ticketId,
                      mimetype: att.type
                    }],
                    kwargs: {}
                  },
                  id: Date.now()
                })
              });
              console.log('✅ Allegato: ' + att.name);
            } catch (e) {
              console.log('❌ Errore allegato ' + att.name + ':', e);
            }
          }
        }

        // Aggiungi Laura (partner_id 12) e Gregorio (partner_id 5294) come follower
        await fetch('/web/dataset/call_kw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'helpdesk.ticket',
              method: 'message_subscribe',
              args: [[ticketId], [12, 5294]], // Laura e Gregorio partner IDs
              kwargs: {}
            },
            id: Date.now()
          })
        });

        // Invia notifica via messaggio interno (così arriva email ai follower)
        await fetch('/web/dataset/call_kw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'helpdesk.ticket',
              method: 'message_post',
              args: [[ticketId]],
              kwargs: {
                body: '<p>🤖 <strong>Nuovo ticket da AI Chatbot</strong></p><p>Cliente: ' + (this.user.name || 'Non specificato') + '</p><p>Email: ' + (this.user.email || 'Non specificata') + '</p><p>Richiede assistenza umana.</p>',
                message_type: 'notification',
                subtype_xmlid: 'mail.mt_comment',
                partner_ids: [12, 5294] // Notifica Laura e Gregorio
              }
            },
            id: Date.now()
          })
        });

        this.addMessage('bot', '✅ Ho creato un ticket (#' + ticketId + ') per te. Laura e il nostro team ti contatteranno presto a ' + this.user.email + '!');

        // Invia anche email diretta a lapa@lapa.ch come backup
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
                subject: '🎫 Nuovo Ticket #' + ticketId + ' da AI Chatbot - ' + (this.user.name || 'Cliente'),
                email_to: 'lapa@lapa.ch,laura@lapa.ch,gregorio@lapa.ch',
                body_html: ticketDescription,
                auto_delete: false,
                state: 'outgoing'
              }],
              kwargs: {}
            },
            id: Date.now()
          })
        });
      }
    } catch (e) {
      console.error('Errore creazione ticket:', e);
      this.addMessage('bot', 'Non sono riuscito a creare il ticket automaticamente. Per favore contatta direttamente lapa@lapa.ch o chiama +41 76 361 70 21');
    }
  },

  // Raccoglie tutti gli allegati dai messaggi della conversazione
  getAllAttachmentsFromMessages() {
    const attachments = [];
    for (const msg of this.messages) {
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          attachments.push({
            name: att.name,
            type: att.type,
            base64: att.base64
          });
        }
      }
    }
    // Aggiungi anche eventuali allegati pendenti
    if (this.pendingAttachments && this.pendingAttachments.length > 0) {
      for (const att of this.pendingAttachments) {
        attachments.push({
          name: att.name,
          type: att.type,
          base64: att.base64
        });
      }
      this.pendingAttachments = []; // Reset
    }
    return attachments;
  }
};

// Inizializza
document.addEventListener('DOMContentLoaded', () => window.lapaAI.init());
</script>
<!-- End LAPA AI Assistant V3 -->
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
        jsonrpc: '2.0', method: 'call',
        params: { model, method: 'search_read', args: [], kwargs: { domain, fields, limit: options.limit || 100 } },
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
        jsonrpc: '2.0', method: 'call',
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
  console.log('═'.repeat(70));
  console.log('🎫 LAPA AI Assistant V3 - Con Ticket Helpdesk');
  console.log('═'.repeat(70));

  const odoo = new OdooAPI();

  try {
    console.log('🔐 Connessione a Odoo...');
    await odoo.authenticate();
    console.log('✅ Connesso\\n');

    const websites = await odoo.searchRead<any>('website', [['id', '=', 1]], ['id', 'name', 'custom_code_footer'], { limit: 1 });
    if (websites.length === 0) throw new Error('Website non trovato');

    let footerCode = websites[0].custom_code_footer || '';

    // Rimuovi vecchie versioni
    footerCode = footerCode
      .replace(/<!-- LAPA AI[^>]*-->[\s\S]*?<!-- End LAPA AI[^>]*-->/g, '')
      .replace(/<!-- LAPA Floating Shop Button[^>]*-->[\s\S]*?<!-- End[^>]*-->/g, '')
      .trim();

    // Mantieni il pulsante Shop se presente
    const shopButton = `<!-- LAPA Shop Button -->
<style>.lapa-shop-btn{position:fixed;bottom:25px;left:25px;z-index:9999;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);color:#fff!important;padding:14px 24px;border-radius:50px;text-decoration:none!important;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(196,30,58,.4);transition:all .3s ease}.lapa-shop-btn:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(196,30,58,.5)}.lapa-shop-btn svg{width:22px;height:22px;fill:#fff}@media(max-width:768px){.lapa-shop-btn{bottom:90px;left:20px;padding:14px;border-radius:50%}.lapa-shop-btn span{display:none}}</style>
<a href="/shop" class="lapa-shop-btn" title="Shop"><svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg><span>Shop</span></a>`;

    const newFooterCode = footerCode + '\\n' + shopButton + '\\n' + CHATBOT_WIDGET_V3;

    console.log('📝 Installazione Chatbot V3...');
    await odoo.write('website', [1], { custom_code_footer: newFooterCode });

    console.log('✅ Installato!\n');
    console.log('═'.repeat(70));
    console.log('✨ LAPA AI Assistant V3 ATTIVO!');
    console.log('═'.repeat(70));
    console.log(`
NOVITÀ V3:
   👤 Rileva utente loggato automaticamente
   📝 Chiede nome/email se non loggato
   🎫 Crea TICKET HELPDESK (non solo lead)
   📧 Notifica a lapa@lapa.ch
   📞 Numero corretto: +41 76 361 70 21

FLUSSO ESCALATION:
   1. Cliente chiede aiuto umano
   2. Se loggato → usa i suoi dati
   3. Se non loggato → chiede nome/email
   4. Crea ticket in Helpdesk "Customer Care"
   5. Invia email notifica a lapa@lapa.ch
   6. Conferma al cliente con numero ticket

👉 Vai su https://www.lapa.ch (Ctrl+Shift+R)
`);

  } catch (error) {
    console.error('\\n❌ Errore:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
