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
  Sparkles,
  Search,
  Building2,
  UserCircle,
  XCircle,
  Paperclip,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FileText,
  Image as ImageIcon,
  File
} from 'lucide-react';

interface Attachment {
  name: string;
  content: string; // base64
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

interface Customer {
  id: number;
  name: string;
  email?: string;
  vat?: string;
  is_company: boolean;
  customer_rank: number;
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

  // Customer search states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

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
      content: 'Ciao! Sono l\'assistente AI di LAPA. Come posso aiutarti oggi?\n\nPosso aiutarti con ordini, fatture, spedizioni, informazioni sui prodotti e molto altro.',
      timestamp: new Date(),
      agentId: 'orchestrator',
      suggestedActions: ['Vorrei fare un ordine', 'Dov\'è la mia spedizione?', 'Ho fatture da pagare?', 'Cercate la burrata?']
    };
    setMessages([welcomeMessage]);
  }, []);

  // Search customers
  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/debug/search-all-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query })
      });
      const data = await response.json();

      if (data.success && data.contacts) {
        // Filter only customers (customer_rank > 0) or companies
        const customers = data.contacts.filter((c: any) =>
          c.customer_rank > 0 || c.is_company
        );
        setCustomerResults(customers.slice(0, 10));
        setShowCustomerDropdown(true);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch) {
        searchCustomers(customerSearch);
      } else {
        setCustomerResults([]);
        setShowCustomerDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

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

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
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

    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > maxSize) {
        alert(`Il file "${file.name}" è troppo grande. Massimo 5MB.`);
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        alert(`Il tipo di file "${file.type}" non è supportato.`);
        continue;
      }

      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data:*/*;base64, prefix
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

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Toggle voice listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Il riconoscimento vocale non è supportato dal tuo browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Text-to-speech for assistant messages
  const speakMessage = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('La sintesi vocale non è supportata dal tuo browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthesisRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Get file icon based on mimetype
  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return ImageIcon;
    if (mimetype === 'application/pdf') return FileText;
    return File;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render message content with clickable links
  // Converts markdown links [text](url) to clickable links
  const renderMessageContent = (content: string) => {
    // Regex to match markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = linkRegex.exec(content)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Add the clickable link
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-600 hover:text-red-700 underline font-medium hover:bg-red-50 px-1 py-0.5 rounded transition-colors"
        >
          {linkText}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last link
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    // If no links found, return original content
    if (parts.length === 0) {
      return content;
    }

    return parts;
  };

  // Select customer
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerType(customer.is_company ? 'b2b' : 'b2c');
    setCustomerSearch('');
    setCustomerResults([]);
    setShowCustomerDropdown(false);

    // Reset chat with personalized welcome
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Ciao ${customer.name}! Sono l'assistente AI di LAPA. Come posso aiutarti oggi?\n\nPosso aiutarti con i tuoi ordini, fatture, spedizioni e molto altro.`,
      timestamp: new Date(),
      agentId: 'orchestrator',
      suggestedActions: ['Vedi i miei ordini', 'Ho fatture da pagare?', 'Dove sono le mie spedizioni?', 'Cerca un prodotto']
    }]);
  };

  // Clear selected customer
  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerType('anonymous');
    resetChat();
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    // Capture current attachments and clear them
    const currentAttachments = [...attachments];
    setAttachments([]);

    // Add user message with attachments
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
      const response = await fetch('/api/lapa-agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          customerType,
          customerId: selectedCustomer?.id,
          customerName: selectedCustomer?.name,
          customerEmail: selectedCustomer?.email,
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

      // Auto-speak response if voice is enabled
      if (voiceEnabled && data.message) {
        speakMessage(data.message);
      }
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
            {/* Customer Search */}
            <div className="flex-1 min-w-[300px] relative">
              <span className="text-sm font-medium text-gray-700 mb-1 block">Simula Cliente:</span>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-300 rounded-lg">
                  {selectedCustomer.is_company ? (
                    <Building2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <UserCircle className="w-4 h-4 text-green-600" />
                  )}
                  <span className="text-sm font-medium text-green-800">{selectedCustomer.name}</span>
                  {selectedCustomer.vat && (
                    <span className="text-xs text-green-600">({selectedCustomer.vat})</span>
                  )}
                  <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded-full">
                    {customerType.toUpperCase()}
                  </span>
                  <button
                    onClick={clearCustomer}
                    className="ml-auto p-1 hover:bg-green-200 rounded-full transition-colors"
                  >
                    <XCircle className="w-4 h-4 text-green-600" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center">
                    <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Cerca cliente per nome..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      {customerResults.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
                        >
                          {customer.is_company ? (
                            <Building2 className="w-5 h-5 text-blue-500" />
                          ) : (
                            <UserCircle className="w-5 h-5 text-gray-400" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            {customer.vat && (
                              <div className="text-xs text-gray-500">P.IVA: {customer.vat}</div>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            customer.is_company ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {customer.is_company ? 'B2B' : 'B2C'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showCustomerDropdown && customerSearch.length >= 2 && customerResults.length === 0 && !isSearching && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-center text-gray-500 text-sm">
                      Nessun cliente trovato
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer Type (shown when no customer selected) */}
            {!selectedCustomer && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">oppure:</span>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as any)}
                  className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="anonymous">Visitatore Anonimo</option>
                  <option value="b2c">Cliente B2C (Privato)</option>
                  <option value="b2b">Cliente B2B (Azienda)</option>
                </select>
              </div>
            )}

            <button
              onClick={resetChat}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
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
              className="absolute bottom-4 right-4 w-[550px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
              style={{ maxHeight: isMinimized ? '60px' : '750px' }}
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
                  <div className="h-[550px] overflow-y-auto p-4 space-y-4 bg-gray-50">
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
                            <div className="flex items-center gap-2 ml-1 mb-1">
                              <span className="text-xs text-gray-500">
                                {getAgentName(msg.agentId)}
                              </span>
                              {/* TTS Button for assistant messages */}
                              <button
                                onClick={() => speakMessage(msg.content)}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                                title="Ascolta messaggio"
                              >
                                <Volume2 className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                              </button>
                            </div>
                          )}
                          <div
                            className={`p-3 rounded-2xl ${
                              msg.role === 'user'
                                ? 'bg-red-600 text-white rounded-br-md'
                                : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{renderMessageContent(msg.content)}</p>

                            {/* Show attachments in user messages */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-red-500/20 flex flex-wrap gap-2">
                                {msg.attachments.map((att, i) => {
                                  const FileIcon = getFileIcon(att.mimetype);
                                  return (
                                    <div
                                      key={i}
                                      className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded text-xs"
                                    >
                                      <FileIcon className="w-3 h-3" />
                                      <span className="max-w-[80px] truncate">{att.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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
                    {/* Attachments Preview */}
                    {attachments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {attachments.map((att, index) => {
                          const FileIcon = getFileIcon(att.mimetype);
                          return (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg group"
                            >
                              <FileIcon className="w-4 h-4 text-gray-500" />
                              <span className="text-xs text-gray-700 max-w-[100px] truncate">
                                {att.name}
                              </span>
                              {att.size && (
                                <span className="text-[10px] text-gray-400">
                                  {formatFileSize(att.size)}
                                </span>
                              )}
                              <button
                                onClick={() => removeAttachment(index)}
                                className="p-0.5 hover:bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3 text-gray-500" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {/* File Upload Button */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        multiple
                        accept="image/*,.pdf,.txt,.doc,.docx"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="p-2.5 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-full transition-colors disabled:opacity-50"
                        title="Allega file"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>

                      {/* Voice Input Button */}
                      <button
                        onClick={toggleListening}
                        disabled={isLoading}
                        className={`p-2.5 rounded-full transition-colors ${
                          isListening
                            ? 'bg-red-100 text-red-600 animate-pulse'
                            : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                        } disabled:opacity-50`}
                        title={isListening ? 'Ferma registrazione' : 'Parla'}
                      >
                        {isListening ? (
                          <MicOff className="w-5 h-5" />
                        ) : (
                          <Mic className="w-5 h-5" />
                        )}
                      </button>

                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                        placeholder={isListening ? 'Sto ascoltando...' : 'Scrivi un messaggio...'}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
                      />

                      {/* Voice Output Toggle */}
                      <button
                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                        className={`p-2.5 rounded-full transition-colors ${
                          voiceEnabled
                            ? 'bg-blue-100 text-blue-600'
                            : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                        }`}
                        title={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'}
                      >
                        {voiceEnabled ? (
                          <Volume2 className="w-5 h-5" />
                        ) : (
                          <VolumeX className="w-5 h-5" />
                        )}
                      </button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => sendMessage()}
                        disabled={isLoading || (!input.trim() && attachments.length === 0)}
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
                      Powered by LAPA AI Agents • {attachments.length > 0 ? `${attachments.length} file allegati` : 'Puoi allegare file'}
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
