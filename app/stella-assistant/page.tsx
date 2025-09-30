'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  ShoppingCart,
  AlertTriangle,
  Search,
  Wrench,
  HelpCircle,
  User,
  Bot,
  Image as ImageIcon,
  Mic,
  MicOff
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';
import StellaRealTime from './components/StellaRealTime';

// Browser API types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  attachments?: string[];
}

interface ActionButton {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  prompt: string;
}

const actionButtons: ActionButton[] = [
  {
    id: 'order',
    title: 'Voglio Fare un Ordine',
    description: 'Effettua un nuovo ordine dal catalogo',
    icon: ShoppingCart,
    color: 'bg-green-600 hover:bg-green-700',
    prompt: 'Ciao! Sono Stella e ti aiuterò a fare il tuo ordine. Dimmi cosa stai cercando e ti mostrerò i prodotti disponibili con le offerte attive.'
  },
  {
    id: 'complaint',
    title: 'Lamentele',
    description: 'Segnala un problema o reclamo',
    icon: AlertTriangle,
    color: 'bg-red-600 hover:bg-red-700',
    prompt: 'Ciao! Mi dispiace per il disagio. Sono qui per aiutarti a risolvere il problema. Puoi spiegarmi nel dettaglio cosa è successo?'
  },
  {
    id: 'search',
    title: 'Ricerca Prodotto',
    description: 'Trova prodotti nel nostro catalogo',
    icon: Search,
    color: 'bg-blue-600 hover:bg-blue-700',
    prompt: 'Ciao! Sono Stella e ti aiuterò a trovare quello che cerchi. Dimmi il nome del prodotto o descrivimi di cosa hai bisogno.'
  },
  {
    id: 'intervention',
    title: 'Richiesta di Intervento',
    description: 'Richiedi supporto tecnico o intervento',
    icon: Wrench,
    color: 'bg-orange-600 hover:bg-orange-700',
    prompt: 'Ciao! Sono qui per organizzare il tuo intervento tecnico. Dimmi che tipo di problema hai e dove ti trovi, così posso programmare l\'assistenza.'
  },
  {
    id: 'other',
    title: 'Altre Richieste',
    description: 'Qualsiasi altra domanda o richiesta',
    icon: HelpCircle,
    color: 'bg-purple-600 hover:bg-purple-700',
    prompt: 'Ciao! Sono Stella, il tuo assistente personale. Dimmi pure di cosa hai bisogno, sono qui per aiutarti in qualsiasi modo!'
  }
];

export default function StellaAssistant() {
  const router = useRouter();
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionButton | null>(null);
  const [showActionButtons, setShowActionButtons] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [showRealTime, setShowRealTime] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Load user profile with company data on mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log('🔄 Caricamento profilo utente...');
        const response = await fetch('/api/user/profile');
        console.log('📡 Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('📋 Response data:', data);

          if (data.success) {
            setUserProfile(data.data);
            console.log('✅ Profilo utente caricato:', data.data);
          } else {
            console.log('⚠️ Profile API returned success: false');
          }
        } else {
          console.log('❌ Profile API response not OK:', response.status);
        }
      } catch (error) {
        console.error('❌ Errore caricamento profilo:', error);
      }
    };

    // Always try to load profile (relies on cookie auth, not Zustand state)
    loadUserProfile();
  }, []); // Empty deps - run once on mount

  // Welcome message on load
  useEffect(() => {
    if (!userProfile) return;

    const userName = userProfile.user?.name || user?.email?.split('@')[0] || 'Cliente';
    const companyName = userProfile.company?.name;

    let welcomeText = `Ciao ${userName}! 👋 Sono Stella, la tua assistente personale`;

    if (userProfile.user?.isContact && companyName) {
      welcomeText += ` di ${companyName}`;
    }

    welcomeText += '. Come posso aiutarti oggi?';

    const welcomeMessage: Message = {
      id: '1',
      text: welcomeText,
      isUser: false,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, [userProfile, user]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'it-IT';

      recognitionInstance.onstart = () => {
        setIsListening(true);
        toast.success('🎤 Sto ascoltando...');
      };

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setCurrentMessage(transcript);
        setIsListening(false);
        toast.success(`Riconosciuto: "${transcript}"`);
      };

      recognitionInstance.onerror = (event) => {
        setIsListening(false);
        toast.error('Errore riconoscimento vocale');
        console.error('Speech recognition error:', event.error);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  // Handle action button click - CARICA PROMPT DAL TASK ODOO
  const handleActionClick = async (action: ActionButton) => {
    setSelectedAction(action);
    setShowActionButtons(false);

    try {
      // Carica il prompt dinamicamente dal task Odoo
      const response = await fetch(`/api/stella/tasks?action_id=${action.id}`);
      const data = await response.json();

      let promptText = action.prompt; // Fallback al prompt statico

      if (data.success && data.prompt) {
        promptText = data.prompt;
        console.log(`✅ Prompt caricato da task Odoo per ${action.title}`);
        toast.success(`Prompt caricato dal task: ${data.task_name}`);
      } else {
        console.log(`⚠️ Usando prompt statico per ${action.title}`);
        toast(`⚠️ Usando prompt statico per: ${action.title}`);
      }

      // Build complete prompt with user context
      let completePrompt = '';

      if (userProfile) {
        const userName = userProfile.user?.name || 'Cliente';
        const isContact = userProfile.user?.isContact;
        const company = userProfile.company;

        completePrompt += `INFORMAZIONI CLIENTE:\n`;
        completePrompt += `- Nome: ${userName}\n`;
        completePrompt += `- Email: ${userProfile.user?.email || 'N/D'}\n`;
        completePrompt += `- Telefono: ${userProfile.user?.phone || 'N/D'}\n`;

        if (isContact && company) {
          completePrompt += `- Tipo: Contatto aziendale\n`;
          completePrompt += `- Azienda: ${company.name}\n`;
          completePrompt += `- P.IVA: ${company.vat || 'N/D'}\n`;
          completePrompt += `- Codice Cliente: ${company.ref || 'N/D'}\n`;
          completePrompt += `- Fatturato: €${company.totalInvoiced?.toFixed(2) || '0.00'}\n`;
          completePrompt += `- Limite credito: €${company.creditLimit?.toFixed(2) || 'Non impostato'}\n\n`;
          completePrompt += `IMPORTANTE: Rispondi chiamando ${userName} per nome, ma usa i dati dell'azienda "${company.name}" per le informazioni commerciali.\n\n`;
        } else if (company) {
          completePrompt += `- Tipo: Azienda\n`;
          completePrompt += `- P.IVA: ${company.vat || 'N/D'}\n`;
          completePrompt += `- Codice Cliente: ${company.ref || 'N/D'}\n`;
          completePrompt += `- Fatturato: €${company.totalInvoiced?.toFixed(2) || '0.00'}\n\n`;
        }

        completePrompt += `---\n\n`;
      }

      completePrompt += promptText;

      // Add Stella's response con il prompt dal task
      const stellaResponse: Message = {
        id: Date.now().toString(),
        text: completePrompt,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, stellaResponse]);

    } catch (error) {
      console.error('Errore caricamento prompt:', error);
      toast.error('Errore caricamento prompt dal task');

      // Fallback al prompt statico
      const stellaResponse: Message = {
        id: Date.now().toString(),
        text: action.prompt,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, stellaResponse]);
    }
  };

  // Start Real-Time conversation
  const startRealTimeConversation = () => {
    setShowRealTime(true);
  };

  // Close Real-Time conversation
  const closeRealTimeConversation = () => {
    setShowRealTime(false);
  };

  // Handle message send
  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: currentMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);

    try {
      // Call Stella AI API
      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          action: selectedAction,
          userContext: {
            email: user?.email,
            userId: user?.id
          }
        })
      });

      const data = await response.json();

      const stellaResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: data.success ? data.response : data.response || 'Mi dispiace, ho avuto un problema tecnico. Puoi riprovare? 😅',
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, stellaResponse]);

      if (!data.success) {
        console.error('Stella API Error:', data.error);
        toast.error('Errore nella risposta AI');
      }

    } catch (error) {
      console.error('Error calling Stella API:', error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Mi dispiace, non riesco a connettermi al momento. Controlla la connessione e riprova! 🔌',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
      toast.error('Errore di connessione');
    } finally {
      setIsTyping(false);
    }
  };

  // Handle voice input
  const startListening = () => {
    if (recognition && !isListening) {
      recognition.start();
    } else if (!recognition) {
      toast.error('Riconoscimento vocale non supportato su questo browser');
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      toast.success(`${files.length} file allegato/i`);
      // TODO: Implement actual file upload logic
    }
  };

  // Reset conversation
  const resetConversation = () => {
    setShowActionButtons(true);
    setSelectedAction(null);
    setMessages([{
      id: '1',
      text: `Ciao${user?.email ? ` ${user.email.split('@')[0]}` : ''}! 👋 Sono Stella, la tua assistente personale. Come posso aiutarti oggi?`,
      isUser: false,
      timestamp: new Date()
    }]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <AppHeader
        title="🌟 Stella - Assistenza Clienti AI"
        subtitle="La tua assistente personale sempre disponibile"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Stella Avatar Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="relative inline-block">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-xl">
              🌟
            </div>
            {isTyping && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
              >
                💭
              </motion.div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Stella</h2>
          <p className="text-gray-600">La tua assistente AI personale</p>

          {/* Real-Time Voice Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startRealTimeConversation}
            className="mt-4 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
          >
            📞
            PARLA CON STELLA
          </motion.button>
        </motion.div>

        {/* Action Buttons */}
        <AnimatePresence>
          {showActionButtons && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
            >
              {actionButtons.map((action) => {
                const IconComponent = action.icon;
                return (
                  <motion.button
                    key={action.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleActionClick(action)}
                    className={`${action.color} text-white p-4 rounded-xl shadow-lg transition-all duration-200`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <IconComponent className="w-6 h-6" />
                      <span className="font-semibold">{action.title}</span>
                    </div>
                    <p className="text-sm opacity-90 text-left">{action.description}</p>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border-2 border-gray-300 shadow-xl"
        >
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Conversazione con Stella</h3>
                  {selectedAction && (
                    <p className="text-sm opacity-90">{selectedAction.title}</p>
                  )}
                </div>
              </div>
              {!showActionButtons && (
                <button
                  onClick={resetConversation}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded-full text-sm transition-all"
                >
                  Nuovo
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-2 max-w-[80%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                    message.isUser ? 'bg-blue-500' : 'bg-pink-500'
                  }`}>
                    {message.isUser ? <User className="w-4 h-4" /> : '🌟'}
                  </div>
                  <div className={`p-3 rounded-lg ${
                    message.isUser
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}>
                    <p className="text-sm">{message.text}</p>
                    <p className={`text-xs mt-1 ${message.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white text-sm">
                    🌟
                  </div>
                  <div className="bg-gray-100 p-3 rounded-lg rounded-bl-none">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
              />
              <label
                htmlFor="file-upload"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full cursor-pointer transition-all"
              >
                <Paperclip className="w-5 h-5" />
              </label>

              <button
                onClick={isListening ? stopListening : startListening}
                className={`p-2 rounded-full cursor-pointer transition-all ${
                  isListening
                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={isListening ? 'Ferma registrazione' : 'Parla con Stella'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isListening ? 'Ti sto ascoltando... 🎤' : 'Scrivi il tuo messaggio a Stella...'}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 pr-12"
                  disabled={isListening}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || isListening}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Puoi allegare foto, parlare con il microfono o scrivere il tuo messaggio
            </p>
          </div>
        </motion.div>
      </div>

      {/* Real-Time Voice Conversation Modal */}
      <AnimatePresence>
        {showRealTime && (
          <StellaRealTime
            action={selectedAction}
            userContext={{
              email: userProfile?.user?.email || user?.email,
              userId: user?.id,
              userName: userProfile?.user?.name,
              isContact: userProfile?.user?.isContact,
              companyName: userProfile?.company?.name
            }}
            onClose={closeRealTimeConversation}
          />
        )}
      </AnimatePresence>
    </div>
  );
}