'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UseMaestroChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  isTyping: boolean;
}

const STORAGE_KEY = 'maestro_chat_history';
const MAX_STORED_MESSAGES = 50;

/**
 * useMaestroChat Hook
 *
 * Manages Maestro AI chat state with:
 * - Conversation history management
 * - Optimistic updates for smooth UX
 * - localStorage persistence
 * - Loading and error states
 * - Typing indicator simulation
 * - Mock AI responses (for now - will integrate with API later)
 */
export function useMaestroChat(): UseMaestroChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation from localStorage on mount
  useEffect(() => {
    loadConversationFromStorage();
  }, []);

  // Save conversation to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      saveConversationToStorage(messages);
    }
  }, [messages]);

  /**
   * Load conversation history from localStorage
   */
  const loadConversationFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[];
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsed.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      // Don't show error to user - just start fresh
    }
  };

  /**
   * Save conversation history to localStorage
   */
  const saveConversationToStorage = (msgs: ChatMessage[]) => {
    try {
      // Keep only last N messages to avoid storage limits
      const toStore = msgs.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (err) {
      console.error('Failed to save chat history:', err);
    }
  };

  /**
   * Clear conversation history
   */
  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  }, []);

  /**
   * Send message and get AI response
   */
  const sendMessage = useCallback(async (content: string) => {
    // Clear any previous errors
    setError(null);

    // Create user message with optimistic update
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);

    // Start loading state
    setIsLoading(true);

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Simulate typing indicator
      setIsTyping(true);

      // TODO: Replace with actual API call
      // For now, use mock response
      const aiResponse = await getMockAIResponse(
        content,
        abortControllerRef.current.signal
      );

      // Stop typing indicator
      setIsTyping(false);

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      // Add assistant message
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setIsTyping(false);

      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(`Errore durante l'invio del messaggio: ${errorMessage}`);

      // Add error message to chat
      const errorChatMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: 'Mi dispiace, si è verificato un errore. Riprova tra poco.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorChatMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    isTyping,
  };
}

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mock AI response generator
 * TODO: Replace with actual API call to Maestro AI endpoint
 */
async function getMockAIResponse(
  userMessage: string,
  signal: AbortSignal
): Promise<string> {
  // Simulate network delay
  await delay(1000 + Math.random() * 1500, signal);

  const lowerMessage = userMessage.toLowerCase();

  // Context-aware responses based on keywords
  if (lowerMessage.includes('cliente') || lowerMessage.includes('clienti')) {
    return `Ecco le informazioni sui clienti:

**Clienti attivi**: 156 clienti nel tuo portfolio
**Performance media**: 85% di consegne in orario

I tuoi **top 3 clienti** per volume:
1. Ristorante Da Mario - €12.450/mese
2. Hotel Bellavista - €9.800/mese
3. Pizzeria Napoli - €7.650/mese

Vuoi vedere i dettagli di un cliente specifico?`;
  }

  if (lowerMessage.includes('route') || lowerMessage.includes('percorso') || lowerMessage.includes('consegne')) {
    return `**Route di oggi** - 18 Ottobre 2025

Hai **14 consegne** programmate:
- 🟢 Zona Nord: 6 consegne (8:00-10:30)
- 🟡 Zona Centro: 5 consegne (11:00-13:00)
- 🔵 Zona Sud: 3 consegne (14:00-16:00)

**Percorso ottimizzato**: 45 km totali
**Tempo stimato**: 6h 15min

Vuoi visualizzare la mappa del percorso?`;
  }

  if (lowerMessage.includes('performance') || lowerMessage.includes('statistiche')) {
    return `**Le tue performance** (ultimi 30 giorni)

📦 **Consegne**: 342 completate / 358 totali (95.5%)
⏱️ **Puntualità**: 92% consegne in orario
⭐ **Soddisfazione**: 4.7/5.0 media

**Trend**: +3.2% rispetto al mese scorso

Le tue aree di eccellenza:
- Comunicazione con clienti: 98%
- Precisione ordini: 97%
- Gestione imprevisti: 89%

Ottimo lavoro! 🎉`;
  }

  if (lowerMessage.includes('aiuto') || lowerMessage.includes('help') || lowerMessage.includes('cosa puoi fare')) {
    return `Ciao! Sono **Maestro AI**, il tuo assistente intelligente.

Posso aiutarti con:

- **Info clienti**: dettagli, storico, preferenze
- **Route planning**: percorsi ottimizzati, consegne
- **Performance**: statistiche, trend, obiettivi
- **Ordini**: stato, tracking, problemi
- **Suggerimenti**: best practices, ottimizzazioni

Chiedi pure quello che ti serve!`;
  }

  if (lowerMessage.includes('grazie') || lowerMessage.includes('thanks')) {
    return 'Prego! Sono qui per aiutarti. Se hai altre domande, chiedi pure! 😊';
  }

  // Default response
  return `Ho capito la tua richiesta: "${userMessage}"

Al momento sto imparando a rispondere a sempre più domande. Prova a chiedermi:
- Informazioni sui tuoi clienti
- Il percorso di consegne di oggi
- Le tue statistiche performance

Oppure chiedimi aiuto per vedere tutte le funzionalità disponibili!`;
}

/**
 * Delay utility with abort support
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }
  });
}
