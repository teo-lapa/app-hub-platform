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

      // Call the Maestro Agent Network API
      const aiResponse = await callAgentNetworkAPI(
        content,
        messages,
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
 * Call Maestro Agent Network API
 * Uses the new multi-agent system for intelligent responses
 */
async function callAgentNetworkAPI(
  userMessage: string,
  conversationHistory: ChatMessage[],
  signal: AbortSignal
): Promise<string> {
  try {
    // Get current user's salesperson_id from context or default to 2
    // TODO: Get this from auth context when user auth is implemented
    const salespersonId = 2; // Luca Rossi for now

    // Prepare context from current page/state if available
    const context: Record<string, any> = {
      current_page: 'chat',
    };

    // Add customer context if we're on a customer page
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const customerMatch = pathname.match(/\/maestro-ai\/customers\/(\d+)/);
      if (customerMatch) {
        context.customer_id = parseInt(customerMatch[1]);
      }
    }

    const response = await fetch('/api/maestro/agent-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        salesperson_id: salespersonId,
        context,
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'API returned unsuccessful response');
    }

    return data.data.reply || 'Mi dispiace, non ho ricevuto una risposta valida.';
  } catch (error) {
    // Re-throw abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    // Log error for debugging
    console.error('Agent Network API error:', error);

    // Throw with user-friendly message
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Errore durante la comunicazione con Maestro AI'
    );
  }
}

