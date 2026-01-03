'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function JetsonChat() {
  const [jetsonStatus, setJetsonStatus] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    checkJetsonStatus();
  }, []);

  const checkJetsonStatus = async () => {
    try {
      const res = await fetch('/api/jetson/ocr');
      const data = await res.json();
      console.log('Jetson Status:', data);
      setJetsonStatus(data);
    } catch (err) {
      console.error('Failed to check Jetson status:', err);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;

    // Check if Jetson is online
    if (!jetsonStatus || jetsonStatus.tunnel?.status !== 'online') {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Jetson non disponibile. Assicurati che il Jetson sia acceso e il tunnel Cloudflare sia attivo.'
      }]);
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      // Usa il proxy server-side per evitare problemi CORS e gestire l'API key
      const response = await fetch('/api/jetson/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversation: chatMessages
        })
      });

      const data = await response.json();

      if (data.success) {
        setChatMessages(data.conversation);
      } else {
        throw new Error(data.error || 'Chat failed');
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Errore: ${error.message}`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-2 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/jetson-monitor">
              <button className="p-2 bg-white hover:bg-gray-100 rounded-lg transition-colors shadow-sm border border-gray-200">
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
              </button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                💬 Chat con Llama AI
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-600">
                AI locale con NVIDIA Jetson Nano + Ollama Llama 3.2 3B
              </p>
            </div>
          </div>
        </div>

        {/* Jetson Status */}
        {jetsonStatus && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">Jetson Status</h3>
                <p className="text-xs text-gray-600 truncate">{jetsonStatus.tunnel?.url}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${jetsonStatus.tunnel?.status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <span className={`text-xs sm:text-sm font-medium ${jetsonStatus.tunnel?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                  {jetsonStatus.tunnel?.status || 'offline'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Chat Container */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Chiacchiera con l'AI</h2>
            <p className="text-sm sm:text-base text-gray-600">Usa l'intelligenza artificiale locale sul tuo Jetson</p>

            {/* Chat Messages */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 h-[50vh] sm:h-96 overflow-y-auto bg-gray-50 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-center text-gray-400 text-sm sm:text-base mt-8">Inizia una conversazione...</p>
              )}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[85%] sm:max-w-[80%] p-3 rounded-lg text-sm sm:text-base
                      ${msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                      }
                    `}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 p-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChatSend()}
                placeholder="Scrivi un messaggio..."
                className="flex-1 p-3 sm:p-4 border border-gray-300 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={chatLoading}
              />
              <button
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 sm:px-6 py-3 sm:py-4 bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors touch-manipulation text-sm sm:text-base"
              >
                Invia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
