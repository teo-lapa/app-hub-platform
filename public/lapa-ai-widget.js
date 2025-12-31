/**
 * LAPA AI Chatbot Widget
 *
 * Widget embeddable per integrare il chatbot LAPA AI su qualsiasi sito.
 *
 * Uso:
 * <script src="https://staging.hub.lapa.ch/lapa-ai-widget.js"
 *         data-customer-type="b2b"
 *         data-customer-id="1234"
 *         data-parent-id="1000"
 *         data-language="it"></script>
 *
 * IMPORTANTE - Gestione Padre/Figli in Odoo:
 * - data-customer-id: ID del partner che sta chattando (es. Mario = 1001)
 * - data-parent-id: ID dell'azienda padre se il partner e un figlio (es. Pizza al Taglio = 1000)
 *
 * Se data-parent-id e valorizzato, la conversazione sara condivisa tra tutti i figli
 * della stessa azienda. Ogni messaggio salva chi lo ha scritto (senderId/senderName).
 */

(function() {
  'use strict';

  // Configurazione
  const CONFIG = {
    apiUrl: 'https://staging.hub.lapa.ch/api/lapa-agents/chat',
    primaryColor: '#ff0000',
    textColor: '#FFFFFF',
    title: 'LAPA AI Assistant',
    placeholder: 'Scrivi un messaggio...',
    welcomeMessage: 'Ciao! Sono l\'assistente AI di LAPA. Posso aiutarti con ordini, prodotti, fatture, spedizioni e molto altro. Come posso aiutarti oggi?'
  };

  // Genera ID sessione fallback per utenti anonimi
  function generateSessionId() {
    return 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Ottieni configurazione dal tag script
  function getScriptConfig() {
    const script = document.currentScript || document.querySelector('script[src*="lapa-ai-widget"]');
    return {
      customerType: script?.getAttribute('data-customer-type') || 'anonymous',
      customerId: script?.getAttribute('data-customer-id') || null,
      parentId: script?.getAttribute('data-parent-id') || null,  // ID azienda padre per conversazioni condivise
      customerName: script?.getAttribute('data-customer-name') || null,
      customerEmail: script?.getAttribute('data-customer-email') || null,
      language: script?.getAttribute('data-language') || 'it'
    };
  }

  // Stili CSS
  const styles = `
    #lapa-ai-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    }

    #lapa-ai-toggle-btn {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${CONFIG.primaryColor};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    #lapa-ai-toggle-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.35);
    }

    #lapa-ai-toggle-btn svg {
      width: 28px;
      height: 28px;
      fill: white;
    }

    #lapa-ai-chat-window {
      display: none;
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      flex-direction: column;
      overflow: hidden;
      z-index: 999998;
    }

    #lapa-ai-chat-window.open {
      display: flex;
    }

    #lapa-ai-header {
      background: ${CONFIG.primaryColor};
      color: ${CONFIG.textColor};
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    #lapa-ai-header-logo {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #lapa-ai-header-logo img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }

    #lapa-ai-header-info {
      flex: 1;
    }

    #lapa-ai-header-title {
      font-weight: 600;
      font-size: 16px;
      margin: 0;
    }

    #lapa-ai-header-status {
      font-size: 12px;
      opacity: 0.9;
    }

    #lapa-ai-close-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #lapa-ai-close-btn:hover {
      background: rgba(255,255,255,0.2);
    }

    #lapa-ai-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8f9fa;
    }

    .lapa-ai-message {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .lapa-ai-message.bot {
      align-self: flex-start;
      background: white;
      border: 1px solid #e9ecef;
      border-bottom-left-radius: 4px;
    }

    .lapa-ai-message.user {
      align-self: flex-end;
      background: ${CONFIG.primaryColor};
      color: white;
      border-bottom-right-radius: 4px;
    }

    .lapa-ai-message.typing {
      display: flex;
      gap: 4px;
      padding: 16px 20px;
    }

    .lapa-ai-typing-dot {
      width: 8px;
      height: 8px;
      background: #adb5bd;
      border-radius: 50%;
      animation: lapa-ai-typing 1.4s infinite;
    }

    .lapa-ai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .lapa-ai-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes lapa-ai-typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    #lapa-ai-suggestions {
      padding: 8px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: white;
      border-top: 1px solid #e9ecef;
    }

    .lapa-ai-suggestion {
      padding: 8px 14px;
      background: #f1f3f5;
      border: 1px solid #dee2e6;
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .lapa-ai-suggestion:hover {
      background: ${CONFIG.primaryColor};
      color: white;
      border-color: ${CONFIG.primaryColor};
    }

    #lapa-ai-input-container {
      padding: 12px 16px;
      background: white;
      border-top: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    #lapa-ai-attachments-preview {
      display: none;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 12px;
    }

    #lapa-ai-attachments-preview.has-files {
      display: flex;
    }

    .lapa-ai-attachment-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      font-size: 12px;
      max-width: 150px;
    }

    .lapa-ai-attachment-item img {
      width: 24px;
      height: 24px;
      object-fit: cover;
      border-radius: 4px;
    }

    .lapa-ai-attachment-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #495057;
    }

    .lapa-ai-attachment-remove {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      color: #6c757d;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lapa-ai-attachment-remove:hover {
      color: #dc3545;
    }

    #lapa-ai-input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    #lapa-ai-attach-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #f1f3f5;
      border: 1px solid #dee2e6;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    #lapa-ai-attach-btn:hover {
      background: #e9ecef;
      border-color: ${CONFIG.primaryColor};
    }

    #lapa-ai-attach-btn svg {
      width: 18px;
      height: 18px;
      fill: #495057;
    }

    #lapa-ai-file-input {
      display: none;
    }

    #lapa-ai-input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid #dee2e6;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    #lapa-ai-input:focus {
      border-color: ${CONFIG.primaryColor};
    }

    #lapa-ai-send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${CONFIG.primaryColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, opacity 0.2s;
      flex-shrink: 0;
    }

    #lapa-ai-send-btn:hover {
      transform: scale(1.05);
    }

    #lapa-ai-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #lapa-ai-send-btn svg {
      width: 18px;
      height: 18px;
      fill: white;
    }

    #lapa-ai-powered-by {
      text-align: center;
      padding: 8px;
      font-size: 11px;
      color: #6c757d;
      background: white;
    }

    .lapa-ai-message a {
      color: ${CONFIG.primaryColor};
      text-decoration: underline;
    }

    .lapa-ai-message.user a {
      color: white;
    }

    /* Stile bottone per link Markdown [testo](url) */
    .lapa-link-button {
      display: inline-block;
      background: #2563eb;
      color: white !important;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none !important;
      font-weight: 500;
      margin: 4px 0;
      transition: background 0.2s ease;
    }

    .lapa-link-button:hover {
      background: #1d4ed8;
      text-decoration: none !important;
    }

    .lapa-ai-message.user .lapa-link-button {
      background: rgba(255,255,255,0.2);
      color: white !important;
    }

    .lapa-ai-message.user .lapa-link-button:hover {
      background: rgba(255,255,255,0.3);
    }

    .lapa-ai-message-attachments {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }

    .lapa-ai-message-image {
      max-width: 200px;
      max-height: 150px;
      border-radius: 8px;
      object-fit: cover;
      cursor: pointer;
    }

    .lapa-ai-message-image:hover {
      opacity: 0.9;
    }

    .lapa-ai-message-file {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.15);
      border-radius: 8px;
      font-size: 12px;
    }

    .lapa-ai-message.bot .lapa-ai-message-file {
      background: #f1f3f5;
    }

    .lapa-ai-message-text {
      white-space: pre-wrap;
    }

    /* Responsive */
    @media (max-width: 480px) {
      #lapa-ai-chat-window {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
    }
  `;

  // HTML del widget
  const html = `
    <div id="lapa-ai-widget-container">
      <div id="lapa-ai-chat-window">
        <div id="lapa-ai-header">
          <div id="lapa-ai-header-logo">
            <img src="https://staging.hub.lapa.ch/lapa-logo.jpeg" alt="LAPA AI">
          </div>
          <div id="lapa-ai-header-info">
            <h4 id="lapa-ai-header-title">${CONFIG.title}</h4>
            <span id="lapa-ai-header-status">Online - Rispondo subito</span>
          </div>
          <button id="lapa-ai-close-btn" aria-label="Chiudi chat">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div id="lapa-ai-messages"></div>
        <div id="lapa-ai-suggestions"></div>
        <div id="lapa-ai-input-container">
          <div id="lapa-ai-attachments-preview"></div>
          <div id="lapa-ai-input-row">
            <input type="file" id="lapa-ai-file-input" multiple accept="image/*,.pdf,.doc,.docx,.txt">
            <button id="lapa-ai-attach-btn" aria-label="Allega file">
              <svg viewBox="0 0 24 24">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
              </svg>
            </button>
            <input type="text" id="lapa-ai-input" placeholder="${CONFIG.placeholder}" autocomplete="off">
            <button id="lapa-ai-send-btn" aria-label="Invia messaggio">
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
        <div id="lapa-ai-powered-by">Powered by LAPA AI</div>
      </div>
      <button id="lapa-ai-toggle-btn" aria-label="Apri chat LAPA AI">
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>
    </div>
  `;

  // Stato del widget
  const state = {
    isOpen: false,
    isTyping: false,
    sessionId: generateSessionId(),
    config: null,
    messages: [],
    attachments: []  // Array di file allegati { name, content (base64), mimetype }
  };

  // Dimensione massima file (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  // Inizializza il widget
  function init() {
    state.config = getScriptConfig();

    // Inietta CSS
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Inietta HTML
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);

    // Bind eventi
    bindEvents();

    // Messaggio di benvenuto
    addMessage(CONFIG.welcomeMessage, 'bot');

    // Suggerimenti iniziali
    showSuggestions(['Ordini', 'Prodotti', 'Fatture', 'Spedizioni', 'Assistenza']);
  }

  // Bind eventi
  function bindEvents() {
    const toggleBtn = document.getElementById('lapa-ai-toggle-btn');
    const closeBtn = document.getElementById('lapa-ai-close-btn');
    const input = document.getElementById('lapa-ai-input');
    const sendBtn = document.getElementById('lapa-ai-send-btn');
    const attachBtn = document.getElementById('lapa-ai-attach-btn');
    const fileInput = document.getElementById('lapa-ai-file-input');
    const chatWindow = document.getElementById('lapa-ai-chat-window');

    toggleBtn.addEventListener('click', () => toggleChat());
    closeBtn.addEventListener('click', () => toggleChat(false));
    sendBtn.addEventListener('click', () => sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Gestione allegati
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // Chiudi con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) toggleChat(false);
    });
  }

  // Gestisce selezione file
  async function handleFileSelect(e) {
    const files = Array.from(e.target.files);

    for (const file of files) {
      // Verifica dimensione
      if (file.size > MAX_FILE_SIZE) {
        alert('Il file "' + file.name + '" e troppo grande. Massimo 10MB.');
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        state.attachments.push({
          name: file.name,
          content: base64,
          mimetype: file.type || 'application/octet-stream'
        });
      } catch (err) {
        console.error('Errore lettura file:', err);
      }
    }

    // Reset input e aggiorna preview
    e.target.value = '';
    updateAttachmentsPreview();
  }

  // Converte file in base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Rimuovi il prefisso "data:...;base64,"
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Aggiorna preview allegati
  function updateAttachmentsPreview() {
    const previewEl = document.getElementById('lapa-ai-attachments-preview');

    if (state.attachments.length === 0) {
      previewEl.classList.remove('has-files');
      previewEl.innerHTML = '';
      return;
    }

    previewEl.classList.add('has-files');
    previewEl.innerHTML = state.attachments.map((att, index) => {
      const isImage = att.mimetype.startsWith('image/');
      const icon = isImage
        ? '<img src="data:' + att.mimetype + ';base64,' + att.content + '" alt="">'
        : '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#6c757d" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>';

      return '<div class="lapa-ai-attachment-item">' +
        icon +
        '<span class="lapa-ai-attachment-name">' + att.name + '</span>' +
        '<button class="lapa-ai-attachment-remove" data-index="' + index + '" aria-label="Rimuovi">' +
          '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');

    // Bind rimozione allegati
    previewEl.querySelectorAll('.lapa-ai-attachment-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        state.attachments.splice(index, 1);
        updateAttachmentsPreview();
      });
    });
  }

  // Toggle chat
  function toggleChat(forceState = null) {
    state.isOpen = forceState !== null ? forceState : !state.isOpen;
    const chatWindow = document.getElementById('lapa-ai-chat-window');

    if (state.isOpen) {
      chatWindow.classList.add('open');
      document.getElementById('lapa-ai-input').focus();
    } else {
      chatWindow.classList.remove('open');
    }
  }

  // Aggiungi messaggio
  function addMessage(text, sender = 'user', attachments = []) {
    const messagesEl = document.getElementById('lapa-ai-messages');
    const messageEl = document.createElement('div');
    messageEl.className = 'lapa-ai-message ' + sender;

    let html = '';

    // Mostra thumbnail allegati per messaggi utente
    if (attachments && attachments.length > 0) {
      html += '<div class="lapa-ai-message-attachments">';
      attachments.forEach(att => {
        if (att.mimetype.startsWith('image/')) {
          html += '<img src="data:' + att.mimetype + ';base64,' + att.content + '" alt="' + att.name + '" class="lapa-ai-message-image">';
        } else {
          html += '<div class="lapa-ai-message-file"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg> ' + att.name + '</div>';
        }
      });
      html += '</div>';
    }

    // Converti link Markdown [testo](url) in anchor tags cliccabili
    let linkedText = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="lapa-link-button">$1</a>'
    );
    // Poi converti URL nudi che non sono già dentro href="..."
    // Usa un approccio compatibile con tutti i browser (senza lookbehind)
    linkedText = linkedText.replace(
      /(^|[^"'])(https?:\/\/[^\s<"']+)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>'
    );
    html += '<div class="lapa-ai-message-text">' + linkedText + '</div>';

    messageEl.innerHTML = html;

    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    state.messages.push({ text, sender, timestamp: Date.now(), attachments });
  }

  // Mostra indicatore typing
  function showTyping() {
    state.isTyping = true;
    const messagesEl = document.getElementById('lapa-ai-messages');
    const typingEl = document.createElement('div');
    typingEl.className = 'lapa-ai-message bot typing';
    typingEl.id = 'lapa-ai-typing';
    typingEl.innerHTML = `
      <div class="lapa-ai-typing-dot"></div>
      <div class="lapa-ai-typing-dot"></div>
      <div class="lapa-ai-typing-dot"></div>
    `;
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Nascondi indicatore typing
  function hideTyping() {
    state.isTyping = false;
    const typingEl = document.getElementById('lapa-ai-typing');
    if (typingEl) typingEl.remove();
  }

  // Mostra suggerimenti
  function showSuggestions(suggestions) {
    const suggestionsEl = document.getElementById('lapa-ai-suggestions');
    suggestionsEl.innerHTML = suggestions.map(s =>
      `<button class="lapa-ai-suggestion">${s}</button>`
    ).join('');

    // Bind click sui suggerimenti
    suggestionsEl.querySelectorAll('.lapa-ai-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('lapa-ai-input').value = btn.textContent;
        sendMessage();
      });
    });
  }

  // Invia messaggio
  async function sendMessage() {
    const input = document.getElementById('lapa-ai-input');
    const message = input.value.trim();

    // Permetti invio solo con messaggio O allegati
    if ((!message && state.attachments.length === 0) || state.isTyping) return;

    // Prepara messaggio con info allegati per la UI
    const displayMessage = message || ('Allegato: ' + state.attachments.map(a => a.name).join(', '));

    input.value = '';
    addMessage(displayMessage, 'user', state.attachments);

    // Salva allegati per invio e poi resetta
    const attachmentsToSend = [...state.attachments];
    state.attachments = [];
    updateAttachmentsPreview();

    showTyping();

    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message || 'Analizza questo file',
          customerType: state.config.customerType,
          customerId: state.config.customerId ? parseInt(state.config.customerId) : undefined,
          parentId: state.config.parentId ? parseInt(state.config.parentId) : undefined,
          customerName: state.config.customerName,
          customerEmail: state.config.customerEmail,
          sessionId: state.sessionId,
          language: state.config.language,
          attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined
        })
      });

      const data = await response.json();
      hideTyping();

      if (data.success !== false && data.message) {
        addMessage(data.message, 'bot');

        // Mostra suggerimenti se presenti
        if (data.suggestedActions && data.suggestedActions.length > 0) {
          showSuggestions(data.suggestedActions);
        } else {
          showSuggestions(['Ordini', 'Prodotti', 'Fatture', 'Assistenza']);
        }
      } else {
        addMessage('Mi scuso, si e verificato un errore. Riprova tra un momento.', 'bot');
      }
    } catch (error) {
      hideTyping();
      console.error('LAPA AI Widget Error:', error);
      addMessage('Mi scuso, non riesco a connettermi al server. Riprova tra un momento.', 'bot');
    }
  }

  // Inizializza quando il DOM e pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
