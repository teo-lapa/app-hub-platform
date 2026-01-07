'use client';

/**
 * CHAT GESTIONALE - Interfaccia Chat per Team Gestionale LAPA
 *
 * Pagina di chat full-screen per il team gestionale che permette di:
 * - Interrogare Odoo tramite linguaggio naturale
 * - Visualizzare ordini, fatture, clienti
 * - Eseguire ricerche e analisi
 * - Visualizzare esecuzione tools in tempo reale
 */

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  MessageCircle,
  Send,
  Loader2,
  Home,
  Trash2,
  Settings,
  Bot,
  User,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Search,
  Database,
  FileText,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  ChevronDown
} from 'lucide-react';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  toolExecution?: string;
  error?: boolean;
}

interface ChatResponse {
  success: boolean;
  message: string;
  error?: string;
  toolsUsed?: string[];
  conversationId?: string;
  metadata?: {
    duration?: number;
    timestamp?: string;
  };
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Quick action suggestions
const QUICK_ACTIONS = [
  { icon: ShoppingCart, label: 'Ordini di oggi', prompt: 'Mostrami gli ordini di oggi' },
  { icon: FileText, label: 'Fatture in scadenza', prompt: 'Quali fatture sono in scadenza questa settimana?' },
  { icon: Users, label: 'Clienti top', prompt: 'Chi sono i nostri 10 clienti migliori per fatturato?' },
  { icon: Package, label: 'Prodotti piu venduti', prompt: 'Quali sono i prodotti piu venduti questo mese?' },
  { icon: TrendingUp, label: 'Analisi vendite', prompt: 'Analizza le vendite degli ultimi 7 giorni' },
  { icon: Database, label: 'Stock critico', prompt: 'Mostrami i prodotti con stock critico' },
];

// Markdown renderer component
const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let listKey = 0;

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.type;
      elements.push(
        <ListTag
          key={`list-${listKey++}`}
          className={`ml-4 my-2 space-y-1 ${
            currentList.type === 'ul' ? 'list-disc' : 'list-decimal'
          }`}
        >
          {currentList.items.map((item, idx) => (
            <li key={idx} className="text-slate-100">
              <RichText text={item} />
            </li>
          ))}
        </ListTag>
      );
      currentList = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(trimmed.substring(2));
      return;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      return;
    }

    // Not a list item - flush any pending list
    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={`br-${idx}`} className="h-2" />);
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${idx}`} className="text-lg font-semibold text-white mt-4 mb-2">
          <RichText text={trimmed.substring(4)} />
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${idx}`} className="text-xl font-bold text-white mt-4 mb-2">
          <RichText text={trimmed.substring(3)} />
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${idx}`} className="text-2xl font-bold text-white mt-4 mb-2">
          <RichText text={trimmed.substring(2)} />
        </h1>
      );
      return;
    }

    // Code blocks (simple inline)
    if (trimmed.startsWith('```')) {
      // Skip code block markers for now
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        <RichText text={line} />
      </p>
    );
  });

  // Flush any remaining list
  flushList();

  return <div className="space-y-1">{elements}</div>;
});

// Rich text renderer for bold, links, code
function RichText({ text }: { text: string }) {
  // Combined regex for bold, markdown links, code, and plain URLs
  const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*.*?\*\*)|(`[^`]+`)|(https?:\/\/[^\s<>"{}|\\^\[\]`]+)/g;

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Markdown link: [text](url)
      const linkText = match[2];
      const linkUrl = match[3];
      parts.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline hover:no-underline transition-colors"
        >
          {linkText}
        </a>
      );
    } else if (match[4]) {
      // Bold: **text**
      const boldText = match[4].slice(2, -2);
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold text-white">
          {boldText}
        </strong>
      );
    } else if (match[5]) {
      // Inline code: `code`
      const codeText = match[5].slice(1, -1);
      parts.push(
        <code key={`code-${keyIndex++}`} className="px-1.5 py-0.5 rounded bg-slate-700 text-emerald-400 text-sm font-mono">
          {codeText}
        </code>
      );
    } else if (match[6]) {
      // Plain URL
      parts.push(
        <a
          key={`url-${keyIndex++}`}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline hover:no-underline transition-colors break-all"
        >
          {match[6]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, idx) =>
        typeof part === 'string' ? <span key={`text-${idx}`}>{part}</span> : part
      )}
    </>
  );
}

// Format timestamp
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Adesso';
  if (diffMins < 60) return `${diffMins} min fa`;

  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Chat Message Component
const ChatMessage = memo(function ChatMessage({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          ${isUser
            ? 'bg-blue-600 text-white'
            : message.error
            ? 'bg-red-600 text-white'
            : 'bg-gradient-to-br from-red-600 to-red-500 text-white'
          }
        `}
      >
        {isUser ? (
          <User className="w-5 h-5" />
        ) : message.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : message.error ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Bot className="w-5 h-5" />
        )}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Tool execution indicator */}
        {message.toolExecution && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm"
          >
            <Search className="w-4 h-4 animate-pulse" />
            <span>{message.toolExecution}</span>
          </motion.div>
        )}

        <div
          className={`
            rounded-2xl px-4 py-3 shadow-sm
            ${isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : message.error
              ? 'bg-red-500/10 text-red-200 border border-red-500/20 rounded-tl-sm'
              : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-sm'
            }
          `}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            <div className="text-sm leading-relaxed">
              <MarkdownContent content={message.content} />
            </div>
          )}
        </div>

        {/* Timestamp */}
        {!message.isLoading && (
          <span className="text-xs text-slate-500 px-2">
            {formatTimestamp(message.timestamp)}
          </span>
        )}
      </div>
    </motion.div>
  );
});

// Main Page Component
export default function ChatGestionalePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = `${newHeight}px`;
  }, [input]);

  // Send message
  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    // Clear input
    setInput('');
    setShowQuickActions(false);

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add loading message
    const loadingId = generateId();
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      toolExecution: 'Elaborando richiesta...',
    }]);

    setIsLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat-gestionale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId,
        }),
        signal: abortControllerRef.current.signal,
      });

      const data: ChatResponse = await response.json();

      // Save conversation ID for persistence
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Remove loading message and add response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== loadingId);
        return [...filtered, {
          id: generateId(),
          role: 'assistant',
          content: data.message || (data.error ? `Errore: ${data.error}` : 'Risposta vuota'),
          timestamp: new Date(),
          error: !data.success,
        }];
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled
        setMessages(prev => prev.filter(m => m.id !== loadingId));
      } else {
        console.error('Chat error:', error);
        // Remove loading and add error message
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== loadingId);
          return [...filtered, {
            id: generateId(),
            role: 'assistant',
            content: `Errore di comunicazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
            timestamp: new Date(),
            error: true,
          }];
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, conversationId]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Clear history
  const clearHistory = () => {
    if (confirm('Vuoi davvero cancellare tutta la cronologia chat?')) {
      setMessages([]);
      setConversationId(null); // Reset conversation to start fresh
      setShowQuickActions(true);
    }
  };

  // Cancel request
  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Torna alla Home"
                >
                  <Home className="w-5 h-5" />
                </motion.button>
              </Link>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Chat Gestionale</h1>
                <p className="text-xs text-slate-400">Assistente AI per il team LAPA</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasMessages && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearHistory}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                  title="Cancella cronologia"
                >
                  <Trash2 className="w-5 h-5" />
                </motion.button>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Welcome Message */}
          <AnimatePresence>
            {!hasMessages && showQuickActions && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-600/20">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Ciao! Sono l'assistente gestionale LAPA
                </h2>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                  Posso aiutarti a cercare informazioni in Odoo, analizzare dati e rispondere alle tue domande sul gestionale.
                </p>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
                  {QUICK_ACTIONS.map((action, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendMessage(action.prompt)}
                      className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-red-500/30 hover:bg-slate-800 text-left transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-red-600/10 group-hover:bg-red-600/20 flex items-center justify-center text-red-500 transition-colors">
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm text-slate-300 group-hover:text-white font-medium">
                        {action.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Quick actions bar (when messages exist) */}
          {hasMessages && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {QUICK_ACTIONS.slice(0, 4).map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-white text-xs font-medium whitespace-nowrap transition-all disabled:opacity-50"
                >
                  <action.icon className="w-3 h-3" />
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chiedi qualcosa... (es. 'Mostrami gli ordini di oggi')"
                disabled={isLoading}
                rows={1}
                className="
                  w-full resize-none rounded-xl px-4 py-3 pr-4
                  bg-slate-800 border border-slate-700
                  text-slate-100 placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                "
                style={{
                  maxHeight: '150px',
                  minHeight: '48px',
                }}
              />
            </div>

            {/* Send/Cancel Button */}
            {isLoading ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={cancelRequest}
                className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-colors"
                title="Annulla richiesta"
              >
                <RefreshCw className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className={`
                  flex-shrink-0 w-12 h-12 rounded-xl
                  flex items-center justify-center
                  transition-all duration-200
                  ${input.trim()
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }
                `}
                title="Invia messaggio"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            )}
          </div>

          {/* Helper Text */}
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
                Enter
              </kbd>{' '}
              per inviare,{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
                Shift+Enter
              </kbd>{' '}
              per nuova riga
            </span>
            <span className="text-slate-600">
              Powered by Claude AI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
