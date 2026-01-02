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

    #lapa-chat-button:hover {
      background: ${CONFIG.buttonHoverColor};
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
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

    /* Mobile responsive */
    @media (max-width: 480px) {
      #lapa-chat-iframe-container {
        width: calc(100vw - 40px);
        height: calc(100vh - 120px);
        bottom: ${CONFIG.buttonSize + 15}px;
        ${CONFIG.position}: -${CONFIG.sideOffset - 10}px;
      }
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

  // Ottieni dati utente Odoo se loggato
  function getOdooUser() {
    try {
      // Metodo 1: Odoo session_info (backend e alcune pagine frontend)
      if (window.odoo) {
        const session = window.odoo.session_info || window.odoo.__session_info__;
        if (session && session.user_id && session.user_id !== false) {
          console.log('LAPA Chat: found user via odoo.session_info');
          return {
            id: session.partner_id,
            name: session.name || session.username,
            email: session.username,
            userId: session.user_id
          };
        }
      }

      // Metodo 2: Cerca icona utente loggato nell'header Odoo
      // Quando loggato, Odoo mostra un'icona utente invece di "Accedi"
      const userIcon = document.querySelector('a[href="/my/home"] i.fa-user, a[href="/my"] i.fa-user, .o_header_affix a[href*="/my"]');
      if (userIcon) {
        // Utente loggato - cerca il nome nel dropdown
        const dropdown = userIcon.closest('.dropdown');
        if (dropdown) {
          const nameEl = dropdown.querySelector('.dropdown-menu a[href*="/my"]');
          if (nameEl) {
            console.log('LAPA Chat: found user via header dropdown');
            return { name: nameEl.textContent?.trim() || 'Cliente' };
          }
        }
        // Se non trova il nome, comunque è loggato
        console.log('LAPA Chat: user is logged in (icon found)');
        return { name: 'Cliente' };
      }

      // Metodo 3: Controlla se esiste il link "Il mio account" o "Logout"
      const myAccountLink = document.querySelector('a[href="/my/home"], a[href="/my"], a[href*="/web/session/logout"]');
      const loginLink = document.querySelector('a[href*="/web/login"]:not([href*="redirect"])');

      // Se c'è "Il mio account" ma NON c'è "Accedi", utente è loggato
      if (myAccountLink && !loginLink) {
        console.log('LAPA Chat: user logged in (my account link present, no login link)');
        return { name: 'Cliente' };
      }

      // Metodo 4: Cerca nella pagina /my (portale)
      if (window.location.pathname.startsWith('/my')) {
        // Siamo nel portale, utente sicuramente loggato
        const pageTitle = document.querySelector('h1, .o_page_header h1');
        if (pageTitle) {
          const titleText = pageTitle.textContent?.trim();
          if (titleText && titleText !== 'Il mio account') {
            console.log('LAPA Chat: found user name in portal page');
            return { name: titleText };
          }
        }
        console.log('LAPA Chat: user in portal (logged in)');
        return { name: 'Cliente' };
      }

      // Metodo 5: Controlla cookie di sessione Odoo
      const hasSessionCookie = document.cookie.includes('session_id=');
      const hasFrontendCookie = document.cookie.includes('frontend_lang=');
      if (hasSessionCookie) {
        // C'è una sessione, verifica se utente loggato controllando elementi UI
        const cartQty = document.querySelector('.my_cart_quantity');
        const wishlist = document.querySelector('a[href*="/shop/wishlist"]');
        if (cartQty || wishlist) {
          console.log('LAPA Chat: session cookie found, likely logged in');
          return { name: 'Cliente' };
        }
      }

    } catch (e) {
      console.log('LAPA Chat: error getting user', e);
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

    // Iframe (lazy load)
    let iframe = null;

    // Event handler
    let isOpen = false;

    button.addEventListener('click', function() {
      isOpen = !isOpen;

      if (isOpen) {
        // Nascondi tooltip e badge
        tooltip.classList.add('hidden');
        badge.style.display = 'none';

        // Apri chat
        button.classList.add('open');
        iframeContainer.classList.add('open');

        // Lazy load iframe
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'lapa-chat-iframe';

          // Costruisci URL con dati utente se loggato
          let widgetUrl = CONFIG.widgetUrl;
          const user = getOdooUser();
          if (user) {
            const params = new URLSearchParams();
            if (user.id) params.set('partnerId', user.id);
            if (user.name) params.set('name', user.name);
            if (user.email) params.set('email', user.email);
            if (user.userId) params.set('userId', user.userId);
            widgetUrl += '?' + params.toString();
          }

          iframe.src = widgetUrl;
          iframe.setAttribute('allow', 'microphone');
          iframe.setAttribute('loading', 'lazy');
          iframeContainer.appendChild(iframe);
        }
      } else {
        // Chiudi chat
        button.classList.remove('open');
        iframeContainer.classList.remove('open');
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
