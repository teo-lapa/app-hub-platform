'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';

/**
 * Sales AI Hub - Multi-Agent Chat Interface
 * Sistema unificato con Daily Assistant come orchestratore
 * Integrato con autenticazione piattaforma (useAuthStore)
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function SalesAIHub() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message quando l'utente è autenticato
  useEffect(() => {
    if (isAuthenticated && user) {
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `Ciao ${user.name}! 👋\n\nSono il tuo assistente AI per le vendite. Posso aiutarti con:\n\n💼 Piano giornaliero e priorità\n📊 Performance e KPI\n⚠️ Clienti a rischio churn\n💰 Opportunità di upsell\n📞 Supporto real-time sul campo\n\nCome posso aiutarti oggi?`,
        timestamp: new Date()
      }]);
    }
  }, [isAuthenticated, user]);

  // Send message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/sales-agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          salespersonId: user.email, // Usa email come ID univoco
          salespersonName: user.name
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.message || 'Errore risposta API');
      }

    } catch (error) {
      console.error('Errore chat:', error);
      toast.error('Errore durante l\'invio del messaggio');

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Si è verificato un errore. Riprova tra poco.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick suggestions
  const suggestions = [
    '💼 Cosa devo fare oggi?',
    '📊 Come sto andando questo mese?',
    '⚠️ Quali clienti sono a rischio?',
    '💰 Opportunità di upsell?'
  ];

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to home
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 p-8 max-w-md w-full text-center">
          <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Sales AI Hub
          </h1>
          <p className="text-slate-300 mb-6">
            Devi effettuare il login per accedere al Sales AI Hub
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Sales AI Hub</h1>
                <p className="text-slate-400">Assistente per {user.name}</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-slate-400 hover:text-white transition"
            >
              Torna alla Home
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 flex flex-col h-[calc(100vh-12rem)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 h-fit">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-slate-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                  <div className="text-xs opacity-50 mt-2">
                    {message.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="p-2 rounded-lg bg-slate-700 flex-shrink-0 h-fit">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}

            {messages.length === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(suggestion.replace(/^[^\s]+\s/, ''))}
                    className="bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700 rounded-lg p-3 text-left text-sm text-slate-300 hover:text-white transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrivi un messaggio..."
                className="flex-1 bg-slate-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
