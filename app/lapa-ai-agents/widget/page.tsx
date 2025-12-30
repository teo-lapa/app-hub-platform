'use client';

/**
 * LAPA AI AGENTS - Embeddable Widget
 *
 * Versione minimal della chat da embeddare in iframe sul sito LAPA (Odoo)
 * Comunica con la piattaforma AI Agents via API
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  Loader2,
  RefreshCw,
  Paperclip,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FileText,
  Image as ImageIcon,
  File,
  X,
  ShoppingCart
} from 'lucide-react';

interface Attachment {
  name: string;
  content: string;
  mimetype: string;
  size?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: string;
  suggestedActions?: string[];
  attachments?: Attachment[];
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

export default function LapaAgentsWidgetPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `widget-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // File upload states
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice chat states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: 'Ciao! Sono l\'assistente AI di LAPA. Come posso aiutarti oggi?',
      timestamp: new Date(),
      agentId: 'orchestrator',
      suggestedActions: ['Cerca un prodotto', 'Dov\'è la mia spedizione?', 'Ho fatture da pagare?']
    };
    setMessages([welcomeMessage]);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'it-IT';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');

        if (event.results[0].isFinal) {
          setInput(transcript);
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // File upload handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxSize = 5 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > maxSize) continue;
      if (!allowedTypes.includes(file.type)) continue;

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        name: file.name,
        content: base64,
        mimetype: file.type,
        size: file.size
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakMessage = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthesisRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return ImageIcon;
    if (mimetype === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render message content with clickable links
  const renderMessageContent = (content: string) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = linkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-600 hover:text-red-700 underline font-medium"
        >
          {linkText}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    if (parts.length === 0) {
      return content;
    }

    return parts;
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const currentAttachments = [...attachments];
    setAttachments([]);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get the API base URL - use parent origin or default
      const apiBaseUrl = window.location.origin;

      const response = await fetch(`${apiBaseUrl}/api/lapa-agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          customerType: 'anonymous',
          sessionId,
          language: 'it',
          attachments: currentAttachments.length > 0 ? currentAttachments.map(a => ({
            name: a.name,
            content: a.content,
            mimetype: a.mimetype
          })) : undefined
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

      if (voiceEnabled && data.message) {
        speakMessage(data.message);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Mi dispiace, si è verificato un errore. Riprova tra qualche istante.',
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
      content: 'Ciao! Sono l\'assistente AI di LAPA. Come posso aiutarti oggi?',
      timestamp: new Date(),
      agentId: 'orchestrator',
      suggestedActions: ['Cerca un prodotto', 'Dov\'è la mia spedizione?', 'Ho fatture da pagare?']
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
      orders: 'Ordini',
      invoices: 'Fatture',
      shipping: 'Spedizioni',
      products: 'Prodotti',
      helpdesk: 'Supporto',
      error: 'Sistema'
    };
    return names[agentId || 'orchestrator'] || 'LAPA AI';
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">LAPA Assistente</h3>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white/80 text-[10px]">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={resetChat}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          title="Ricomincia"
        >
          <RefreshCw className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className={`w-6 h-6 rounded-full ${getAgentColor(msg.agentId)} flex items-center justify-center mr-2 flex-shrink-0`}>
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1 ml-1 mb-0.5">
                  <span className="text-[10px] text-gray-500">
                    {getAgentName(msg.agentId)}
                  </span>
                  <button
                    onClick={() => speakMessage(msg.content)}
                    className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Volume2 className="w-2.5 h-2.5 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              )}
              <div
                className={`p-2.5 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-red-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</p>

                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-red-500/20 flex flex-wrap gap-1">
                    {msg.attachments.map((att, i) => {
                      const FileIcon = getFileIcon(att.mimetype);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 rounded text-[10px]"
                        >
                          <FileIcon className="w-2.5 h-2.5" />
                          <span className="max-w-[60px] truncate">{att.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {msg.suggestedActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(action)}
                      className="px-2 py-1 bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-700 text-[11px] rounded-full transition-colors shadow-sm"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center ml-2 flex-shrink-0">
                <User className="w-3 h-3 text-gray-600" />
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-white p-2 rounded-xl rounded-bl-sm shadow-sm border border-gray-100">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-200 bg-white shrink-0">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((att, index) => {
              const FileIcon = getFileIcon(att.mimetype);
              return (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg group"
                >
                  <FileIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] text-gray-700 max-w-[80px] truncate">
                    {att.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="p-0.5 hover:bg-gray-200 rounded-full"
                  >
                    <X className="w-2.5 h-2.5 text-gray-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,.pdf,.txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-full transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            onClick={toggleListening}
            disabled={isLoading}
            className={`p-2 rounded-full transition-colors ${
              isListening
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            } disabled:opacity-50`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
            placeholder={isListening ? 'Sto ascoltando...' : 'Scrivi un messaggio...'}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
          />

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-full transition-colors ${
              voiceEnabled
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage()}
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </motion.button>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5 text-center">
          Powered by LAPA AI
        </p>
      </div>
    </div>
  );
}
