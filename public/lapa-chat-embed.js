/**
 * LAPA AI Chat Widget - Embeddable Script
 *
 * Questo script crea un bottone flottante che apre la chat LAPA AI in un iframe.
 * Da inserire nel sito Odoo per sostituire il livechat nativo.
 *
 * Uso: <script src="https://hub.lapa.ch/lapa-chat-embed.js"></script>
 */

(function() {
  'use strict';

  // Configurazione
  const CONFIG = {
    widgetUrl: 'https://hub.lapa.ch/lapa-ai-agents/widget',
    buttonColor: '#dc2626', // red-600
    buttonHoverColor: '#b91c1c', // red-700
    buttonSize: 60,
    chatWidth: 380,
    chatHeight: 600,
    position: 'right', // 'right' o 'left'
    bottomOffset: 20,
    sideOffset: 20,
    zIndex: 99999
  };

  // Stili CSS
  const styles = `
    #lapa-chat-widget-container {
      position: fixed;
      bottom: ${CONFIG.bottomOffset}px;
      ${CONFIG.position}: ${CONFIG.sideOffset}px;
      z-index: ${CONFIG.zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #lapa-chat-button {
      width: ${CONFIG.buttonSize}px;
      height: ${CONFIG.buttonSize}px;
      border-radius: 50%;
      background: ${CONFIG.buttonColor};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    #lapa-chat-button {
      animation: heartbeat 2s ease-in-out infinite;
    }

    #lapa-chat-button:hover {
      background: ${CONFIG.buttonHoverColor};
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
      animation: none;
    }

    #lapa-chat-button.open {
      animation: none;
    }

    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      10% { transform: scale(1.1); }
      20% { transform: scale(1); }
      30% { transform: scale(1.1); }
      40%, 100% { transform: scale(1); }
    }

    #lapa-chat-button svg {
      width: 28px;
      height: 28px;
      fill: white;
    }

    #lapa-chat-button.open svg.chat-icon {
      display: none;
    }

    #lapa-chat-button.open svg.close-icon {
      display: block;
    }

    #lapa-chat-button svg.close-icon {
      display: none;
    }

    #lapa-chat-iframe-container {
      position: absolute;
      bottom: ${CONFIG.buttonSize + 15}px;
      ${CONFIG.position}: 0;
      width: ${CONFIG.chatWidth}px;
      height: ${CONFIG.chatHeight}px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      opacity: 0;
      transform: scale(0.9) translateY(20px);
      transform-origin: bottom ${CONFIG.position};
      transition: all 0.3s ease;
      pointer-events: none;
      background: white;
    }

    #lapa-chat-iframe-container.open {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    #lapa-chat-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Mobile responsive - FULLSCREEN */
    @media (max-width: 768px) {
      #lapa-chat-widget-container {
        bottom: 100px;
        right: 15px;
      }

      #lapa-chat-button {
        width: 55px;
        height: 55px;
      }

      #lapa-chat-button svg {
        width: 26px;
        height: 26px;
      }

      /* FULLSCREEN on mobile */
      #lapa-chat-iframe-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        transform-origin: center center;
        z-index: 9999999 !important;
      }

      #lapa-chat-iframe-container.open {
        transform: none;
      }

      /* Pulsante chiudi visibile su mobile */
      #lapa-chat-close-btn {
        display: flex !important;
      }
    }

    /* Pulsante chiudi per mobile (nascosto su desktop) */
    #lapa-chat-close-btn {
      display: none;
      position: fixed;
      top: 15px;
      right: 15px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #dc2626;
      border: none;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      z-index: 99999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    #lapa-chat-close-btn svg {
      width: 24px;
      height: 24px;
      fill: white;
    }

    /* Notification badge */
    #lapa-chat-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #22c55e;
      color: white;
      font-size: 11px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    /* Tooltip */
    #lapa-chat-tooltip {
      position: absolute;
      bottom: ${CONFIG.buttonSize + 10}px;
      ${CONFIG.position}: 0;
      background: white;
      padding: 10px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      font-size: 14px;
      color: #374151;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
      pointer-events: none;
    }

    #lapa-chat-tooltip::after {
      content: '';
      position: absolute;
      bottom: -8px;
      ${CONFIG.position}: 24px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid white;
    }

    #lapa-chat-widget-container:hover #lapa-chat-tooltip:not(.hidden) {
      opacity: 1;
      transform: translateY(0);
    }
  `;

  // Chat icon SVG
  const chatIconSvg = `
    <svg class="chat-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      <circle cx="8" cy="10" r="1.5"/>
      <circle cx="12" cy="10" r="1.5"/>
      <circle cx="16" cy="10" r="1.5"/>
    </svg>
  `;

  // Close icon SVG
  const closeIconSvg = `
    <svg class="close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  `;

  // Variabile per memorizzare i dati utente una volta ottenuti
  let cachedUser = null;

  // Ottieni dati utente Odoo chiamando l'API
  async function fetchOdooUser() {
    try {
      // Chiama l'endpoint Odoo per ottenere info sessione
      const response = await fetch('/web/session/get_session_info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {},
          id: Date.now()
        }),
        credentials: 'include' // Importante per inviare i cookie
      });

      const data = await response.json();

      if (data.result && data.result.user_id && data.result.user_id !== false) {
        console.log('LAPA Chat: user found via API', data.result.name);
        return {
          id: data.result.partner_id,
          name: data.result.name,
          email: data.result.username,
          userId: data.result.user_id
        };
      }
    } catch (e) {
      console.log('LAPA Chat: API call failed', e);
    }
    return null;
  }

  // Versione sincrona che usa la cache o dati dal DOM
  function getOdooUser() {
    if (cachedUser) return cachedUser;

    try {
      // Controlla se c'è il link "Il mio account" (utente loggato sul portale)
      const myAccountIcon = document.querySelector('a[href="/my/home"] i.fa-user, a[href="/my"] i.fa-user');
      const logoutLink = document.querySelector('a[href*="/web/session/logout"]');

      if (myAccountIcon || logoutLink) {
        console.log('LAPA Chat: user appears logged in (UI check)');
        return { name: 'Cliente' }; // Placeholder, verrà aggiornato
      }
    } catch (e) {
      console.log('LAPA Chat: error in sync check', e);
    }
    return null;
  }

  // Crea il widget
  function createWidget() {
    // Aggiungi stili
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Container principale
    const container = document.createElement('div');
    container.id = 'lapa-chat-widget-container';

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'lapa-chat-tooltip';
    tooltip.textContent = 'Ciao! Come posso aiutarti?';
    container.appendChild(tooltip);

    // Bottone
    const button = document.createElement('button');
    button.id = 'lapa-chat-button';
    button.innerHTML = chatIconSvg + closeIconSvg;
    button.setAttribute('aria-label', 'Apri chat assistenza');
    container.appendChild(button);

    // Badge notifica (opzionale)
    const badge = document.createElement('div');
    badge.id = 'lapa-chat-badge';
    badge.textContent = '1';
    button.appendChild(badge);

    // Container iframe
    const iframeContainer = document.createElement('div');
    iframeContainer.id = 'lapa-chat-iframe-container';
    container.appendChild(iframeContainer);

    // Pulsante chiudi per mobile (fuori dal container per z-index)
    const closeBtn = document.createElement('button');
    closeBtn.id = 'lapa-chat-close-btn';
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    closeBtn.setAttribute('aria-label', 'Chiudi chat');
    document.body.appendChild(closeBtn);

    // Iframe (lazy load)
    let iframe = null;

    // Event handler
    let isOpen = false;

    // Funzione per chiudere la chat
    function closeChat() {
      isOpen = false;
      button.classList.remove('open');
      iframeContainer.classList.remove('open');
      closeBtn.style.display = 'none';
    }

    // Click sul pulsante chiudi
    closeBtn.addEventListener('click', closeChat);

    button.addEventListener('click', function() {
      isOpen = !isOpen;

      if (isOpen) {
        // Nascondi tooltip e badge
        tooltip.classList.add('hidden');
        badge.style.display = 'none';

        // Apri chat
        button.classList.add('open');
        iframeContainer.classList.add('open');

        // Mostra pulsante chiudi su mobile
        if (window.innerWidth <= 768) {
          closeBtn.style.display = 'flex';
        }

        // Lazy load iframe
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'lapa-chat-iframe';
          iframe.setAttribute('allow', 'microphone');
          iframe.setAttribute('loading', 'lazy');

          // Prima carica l'iframe con URL base
          iframe.src = CONFIG.widgetUrl;
          iframeContainer.appendChild(iframe);

          // Poi cerca dati utente via API (asincrono)
          fetchOdooUser().then(function(user) {
            if (user) {
              cachedUser = user;
              // Ricarica iframe con dati utente
              const params = new URLSearchParams();
              if (user.id) params.set('partnerId', user.id);
              if (user.name) params.set('name', user.name);
              if (user.email) params.set('email', user.email);
              if (user.userId) params.set('userId', user.userId);
              iframe.src = CONFIG.widgetUrl + '?' + params.toString();
              console.log('LAPA Chat: iframe updated with user data', user.name);
            }
          });
        }
      } else {
        // Chiudi chat
        closeChat();
      }
    });

    // Auto-hide tooltip dopo 5 secondi
    setTimeout(() => {
      tooltip.classList.add('hidden');
    }, 5000);

    // Aggiungi al DOM
    document.body.appendChild(container);
  }

  // Nascondi livechat Odoo se presente
  function hideOdooLivechat() {
    const style = document.createElement('style');
    style.textContent = `
      /* Nascondi livechat Odoo */
      .o_livechat_button,
      .o-livechat-root,
      .o_mail_systray_dropdown,
      [class*="o_livechat"],
      #website_livechat,
      .im_livechat {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Inizializza quando il DOM è pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      hideOdooLivechat();
      createWidget();
    });
  } else {
    hideOdooLivechat();
    createWidget();
  }

})();
