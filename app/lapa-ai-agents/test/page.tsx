'use client';

/**
 * LAPA AI AGENTS - Test Chat Page
 *
 * Pagina di test che simula la chat come apparirebbe sul sito LAPA
 * per i clienti reali. Comunica con tutti gli agenti AI.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  Loader2,
  MessageCircle,
  X,
  Minimize2,
  Maximize2,
  RefreshCw,
  ChevronDown,
  Sparkles
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: string;
  suggestedActions?: string[];
}

interface ChatResponse {
  success: boolean;
  message: string;
  agentId: string;
  suggestedActions?: string[];
  requiresHumanEscalation?: boolean;
  metadata?: {
    duration: number;
    aiEnabled: boolean;
  };
}

export default function LapaAgentsTestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [customerType, setCustomerType] = useState<'b2b' | 'b2c' | 'anonymous'>('anonymous');
  const [sessionId] = useState(() => `test-${Date.now()}`);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: 'Ciao! Sono l\'assistente AI di LAPA. Come posso aiutarti oggi?\n\nPosso aiutarti con ordini, fatture, spedizioni, informazioni sui prodotti e molto altro.',
      timestamp: new Date(),
      agentId: 'orchestrator',
      suggestedActions: ['Vorrei fare un ordine', 'Dov\'è la mia spedizione?', 'Ho fatture da pagare?', 'Cercate la burrata?']
    };
    setMessages([welcomeMessage]);
  }, []);

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/lapa-agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          customerType,
          sessionId,
          language: 'it'
        })
      });

      const data: ChatResponse = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Mi dispiace, non ho capito. Puoi ripetere?',
        timestamp: new Date(),
        agentId: data.agentId,
        suggestedActions: data.suggestedActions
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Mi dispiace, si è verificato un errore di connessione. Riprova tra qualche istante.',
        timestamp: new Date(),
        agentId: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Ciao! Sono l\'assistente AI di LAPA. Come posso aiutarti oggi?\n\nPosso aiutarti con ordini, fatture, spedizioni, informazioni sui prodotti e molto altro.',
      timestamp: new Date(),
      agentId: 'orchestrator',
      suggestedActions: ['Vorrei fare un ordine', 'Dov\'è la mia spedizione?', 'Ho fatture da pagare?', 'Cercate la burrata?']
    }]);
  };

  const getAgentColor = (agentId?: string) => {
    const colors: Record<string, string> = {
      orchestrator: 'bg-purple-500',
      orders: 'bg-blue-500',
      invoices: 'bg-green-500',
      shipping: 'bg-orange-500',
      products: 'bg-pink-500',
      helpdesk: 'bg-red-500',
      error: 'bg-gray-500'
    };
    return colors[agentId || 'orchestrator'] || 'bg-red-600';
  };

  const getAgentName = (agentId?: string) => {
    const names: Record<string, string> = {
      orchestrator: 'LAPA AI',
      orders: 'Agente Ordini',
      invoices: 'Agente Fatture',
      shipping: 'Agente Spedizioni',
      products: 'Agente Prodotti',
      helpdesk: 'Supporto',
      error: 'Sistema'
    };
    return names[agentId || 'orchestrator'] || 'LAPA AI';
  };

  // Simulated chat widget position for site preview
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4 md:p-8">
      {/* Page Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">LAPA AI Chat - Test Page</h1>
        <p className="text-gray-600">
          Questa pagina simula come apparira la chat sul sito LAPA per i clienti.
          Prova a interagire con gli agenti AI!
        </p>

        {/* Settings Bar */}
        <div className="mt-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Tipo Cliente:</span>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as any)}
                className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="anonymous">Visitatore Anonimo</option>
                <option value="b2c">Cliente B2C (Privato)</option>
                <option value="b2b">Cliente B2B (Azienda)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Session: {sessionId}</span>
            </div>

            <button
              onClick={resetChat}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Chat
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Website Background */}
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl min-h-[600px] relative overflow-hidden">
        {/* Fake website content */}
        <div className="p-8 opacity-30">
          <div className="h-16 bg-red-600 rounded-lg mb-6"></div>
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="h-48 bg-gray-200 rounded-lg"></div>
            <div className="h-48 bg-gray-200 rounded-lg"></div>
            <div className="h-48 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-32 bg-gray-100 rounded-lg mb-6"></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
        </div>

        {/* Chat Widget - Fixed position simulation */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-4 right-4 w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
              style={{ maxHeight: isMinimized ? '60px' : '550px' }}
            >
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">LAPA Assistente</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-white/80 text-xs">Online</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {isMinimized ? (
                      <Maximize2 className="w-4 h-4 text-white" />
                    ) : (
                      <Minimize2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Chat Content */}
              {!isMinimized && (
                <>
                  {/* Messages */}
                  <div className="h-[350px] overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className={`w-8 h-8 rounded-full ${getAgentColor(msg.agentId)} flex items-center justify-center mr-2 flex-shrink-0`}>
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                          {msg.role === 'assistant' && (
                            <span className="text-xs text-gray-500 ml-1 mb-1 block">
                              {getAgentName(msg.agentId)}
                            </span>
                          )}
                          <div
                            className={`p-3 rounded-2xl ${
                              msg.role === 'user'
                                ? 'bg-red-600 text-white rounded-br-md'
                                : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>

                          {/* Suggested Actions */}
                          {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {msg.suggestedActions.map((action, i) => (
                                <button
                                  key={i}
                                  onClick={() => sendMessage(action)}
                                  className="px-3 py-1.5 bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-700 text-xs rounded-full transition-colors shadow-sm"
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center ml-2 flex-shrink-0">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                        )}
                      </motion.div>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-white p-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                        placeholder="Scrivi un messaggio..."
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
                      />
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => sendMessage()}
                        disabled={isLoading || !input.trim()}
                        className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </motion.button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                      Powered by LAPA AI Agents
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Toggle Button */}
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="absolute bottom-4 right-4 w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </div>

      {/* Test Examples */}
      <div className="max-w-4xl mx-auto mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Esempi di domande da provare:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { text: 'Vorrei ordinare della mozzarella di bufala', agent: 'Ordini' },
            { text: 'Avete la burrata disponibile?', agent: 'Prodotti' },
            { text: 'Dove si trova il mio ordine #12345?', agent: 'Spedizioni' },
            { text: 'Ho delle fatture da pagare?', agent: 'Fatture' },
            { text: 'Ho un problema con un prodotto', agent: 'Helpdesk' },
            { text: 'Quali sono le vostre specialita?', agent: 'Prodotti' }
          ].map((example, i) => (
            <button
              key={i}
              onClick={() => sendMessage(example.text)}
              className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-red-300 hover:shadow-md transition-all text-left"
            >
              <p className="text-gray-800 text-sm mb-2">&quot;{example.text}&quot;</p>
              <span className="text-xs text-gray-500">Gestito da: {example.agent}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
