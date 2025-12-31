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
      gap: 12px;
      align-items: center;
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
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: ${CONFIG.primaryColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, opacity 0.2s;
    }

    #lapa-ai-send-btn:hover {
      transform: scale(1.05);
    }

    #lapa-ai-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #lapa-ai-send-btn svg {
      width: 20px;
      height: 20px;
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
          <input type="text" id="lapa-ai-input" placeholder="${CONFIG.placeholder}" autocomplete="off">
          <button id="lapa-ai-send-btn" aria-label="Invia messaggio">
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
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
    messages: []
  };

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
    const chatWindow = document.getElementById('lapa-ai-chat-window');

    toggleBtn.addEventListener('click', () => toggleChat());
    closeBtn.addEventListener('click', () => toggleChat(false));
    sendBtn.addEventListener('click', () => sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Chiudi con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) toggleChat(false);
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
  function addMessage(text, sender = 'user') {
    const messagesEl = document.getElementById('lapa-ai-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `lapa-ai-message ${sender}`;

    // Converti link in anchor tags
    const linkedText = text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    messageEl.innerHTML = linkedText;

    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    state.messages.push({ text, sender, timestamp: Date.now() });
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

    if (!message || state.isTyping) return;

    input.value = '';
    addMessage(message, 'user');
    showTyping();

    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          customerType: state.config.customerType,
          customerId: state.config.customerId ? parseInt(state.config.customerId) : undefined,
          parentId: state.config.parentId ? parseInt(state.config.parentId) : undefined,  // ID azienda padre
          customerName: state.config.customerName,
          customerEmail: state.config.customerEmail,
          sessionId: state.sessionId,  // Fallback per utenti anonimi
          language: state.config.language
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
