'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
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
  Mic,
  MicOff,
  ArrowLeft
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';
import StellaRealTime from '../components/StellaRealTime';

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
  isSystemPrompt?: boolean; // Flag to hide system prompts
}

interface ActionButton {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  prompt: string;
}

const actionButtons: Record<string, ActionButton> = {
  order: {
    id: 'order',
    title: 'Voglio Fare un Ordine',
    description: 'Effettua un nuovo ordine dal catalogo',
    icon: ShoppingCart,
    color: 'bg-green-600 hover:bg-green-700',
    prompt: 'Ciao! Sono Stella e ti aiuterò a fare il tuo ordine. Dimmi cosa stai cercando e ti mostrerò i prodotti disponibili con le offerte attive.'
  },
  complaint: {
    id: 'complaint',
    title: 'Lamentele',
    description: 'Segnala un problema o reclamo',
    icon: AlertTriangle,
    color: 'bg-red-600 hover:bg-red-700',
    prompt: 'Ciao! Mi dispiace per il disagio. Sono qui per aiutarti a risolvere il problema. Puoi spiegarmi nel dettaglio cosa è successo?'
  },
  search: {
    id: 'search',
    title: 'Ricerca Prodotto',
    description: 'Trova prodotti nel nostro catalogo',
    icon: Search,
    color: 'bg-blue-600 hover:bg-blue-700',
    prompt: 'Ciao! Sono Stella e ti aiuterò a trovare quello che cerchi. Dimmi il nome del prodotto o descrivimi di cosa hai bisogno.'
  },
  intervention: {
    id: 'intervention',
    title: 'Richiesta di Intervento',
    description: 'Richiedi supporto tecnico o intervento',
    icon: Wrench,
    color: 'bg-orange-600 hover:bg-orange-700',
    prompt: 'Ciao! Sono qui per organizzare il tuo intervento tecnico. Dimmi che tipo di problema hai e dove ti trovi, così posso programmare l\'assistenza.'
  },
  other: {
    id: 'other',
    title: 'Altre Richieste',
    description: 'Qualsiasi altra domanda o richiesta',
    icon: HelpCircle,
    color: 'bg-purple-600 hover:bg-purple-700',
    prompt: 'Ciao! Sono Stella, il tuo assistente personale. Dimmi pure di cosa hai bisogno, sono qui per aiutarti in qualsiasi modo!'
  }
};

function StellaChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const userProfileRef = useRef<any>(null);

  // Get action from URL params
  const actionId = searchParams.get('action') || 'other';
  const selectedAction = actionButtons[actionId] || actionButtons.other;

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [showRealTime, setShowRealTime] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [fullPromptForAI, setFullPromptForAI] = useState(''); // Hidden prompt for AI
  const [isSavingConversation, setIsSavingConversation] = useState(false);

  // Update refs when state changes
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  // Auto-save ogni volta che arriva un nuovo messaggio
  useEffect(() => {
    // Skip se non ci sono abbastanza messaggi (solo il messaggio di benvenuto)
    if (messages.length <= 1 || !userProfile) {
      return;
    }

    // Salva solo l'ultimo messaggio (non tutta la conversazione)
    const lastMessage = messages[messages.length - 1];

    const autoSave = async () => {
      try {
        console.log(`💾 Auto-save ultimo messaggio: "${lastMessage.text.substring(0, 50)}..."`);
        const response = await fetch('/api/stella/save-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lastMessage: lastMessage, // Manda solo l'ultimo messaggio
            actionType: selectedAction.id,
            actionTitle: selectedAction.title,
            userEmail: userProfile?.user?.email || user?.email
          })
        });

        if (response.ok) {
          console.log('✅ Auto-save completato');
        } else {
          console.error('❌ Auto-save fallito:', response.status);
        }
      } catch (error) {
        console.error('❌ Errore auto-save:', error);
      }
    };

    autoSave();
  }, [messages, userProfile, selectedAction, user]);

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


  // Welcome message on load with action context
  useEffect(() => {
    if (!userProfile) return;

    const loadActionPrompt = async () => {
      try {
        // Carica il prompt dinamicamente dal task Odoo
        const response = await fetch(`/api/stella/tasks?action_id=${selectedAction.id}`);
        const data = await response.json();

        let promptText = selectedAction.prompt; // Fallback al prompt statico

        if (data.success && data.prompt) {
          promptText = data.prompt;
          console.log(`✅ Prompt caricato da task Odoo per ${selectedAction.title}`);
        } else {
          console.log(`⚠️ Usando prompt statico per ${selectedAction.title}`);
        }

        // Build complete prompt with user context (HIDDEN FROM USER)
        let completePromptForAI = '';

        if (userProfile) {
          const userName = userProfile.user?.name || 'Cliente';
          const isContact = userProfile.user?.isContact;
          const company = userProfile.company;

          completePromptForAI += `INFORMAZIONI CLIENTE:\n`;
          completePromptForAI += `- Nome: ${userName}\n`;
          completePromptForAI += `- Email: ${userProfile.user?.email || 'N/D'}\n`;
          completePromptForAI += `- Telefono: ${userProfile.user?.phone || 'N/D'}\n`;

          if (isContact && company) {
            completePromptForAI += `- Tipo: Contatto aziendale\n`;
            completePromptForAI += `- Azienda: ${company.name}\n`;
            completePromptForAI += `- P.IVA: ${company.vat || 'N/D'}\n`;
            completePromptForAI += `- Codice Cliente: ${company.ref || 'N/D'}\n`;
            completePromptForAI += `- Fatturato: €${company.totalInvoiced?.toFixed(2) || '0.00'}\n`;
            completePromptForAI += `- Limite credito: €${company.creditLimit?.toFixed(2) || 'Non impostato'}\n\n`;
            completePromptForAI += `IMPORTANTE: Rispondi chiamando ${userName} per nome, ma usa i dati dell'azienda "${company.name}" per le informazioni commerciali.\n\n`;
          } else if (company) {
            completePromptForAI += `- Tipo: Azienda\n`;
            completePromptForAI += `- P.IVA: ${company.vat || 'N/D'}\n`;
            completePromptForAI += `- Codice Cliente: ${company.ref || 'N/D'}\n`;
            completePromptForAI += `- Fatturato: €${company.totalInvoiced?.toFixed(2) || '0.00'}\n\n`;
          }

          completePromptForAI += `---\n\n`;
        }

        completePromptForAI += promptText;

        // Store full prompt for AI calls (hidden)
        setFullPromptForAI(completePromptForAI);

        // Show ONLY the friendly short prompt to user (NO system data, NO HTML)
        const welcomeMessage: Message = {
          id: '1',
          text: selectedAction.prompt, // Use short friendly prompt, NOT full task prompt
          isUser: false,
          timestamp: new Date(),
          isSystemPrompt: false
        };
        setMessages([welcomeMessage]);

      } catch (error) {
        console.error('Errore caricamento prompt:', error);
        const fallbackMessage: Message = {
          id: '1',
          text: selectedAction.prompt,
          isUser: false,
          timestamp: new Date(),
          isSystemPrompt: false
        };
        setMessages([fallbackMessage]);
        setFullPromptForAI(selectedAction.prompt);
      }
    };

    loadActionPrompt();
  }, [userProfile, selectedAction]);

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
      // Call Stella AI API with FULL PROMPT (including hidden system data)
      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          systemPrompt: fullPromptForAI, // Send full prompt with user data
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

  // Go back to action selection + Auto-save conversation
  const goBack = async () => {
    // Auto-save conversation if there are messages
    if (messages.length > 1) {
      console.log('💾 Salvataggio automatico conversazione...');

      try {
        await fetch('/api/stella/save-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages,
            actionType: selectedAction.id,
            actionTitle: selectedAction.title,
            userEmail: userProfile?.user?.email || user?.email
          })
        });
        console.log('✅ Conversazione salvata automaticamente');
      } catch (error) {
        console.error('❌ Errore salvataggio automatico:', error);
        // Non mostriamo errore all'utente, è un'operazione in background
      }
    }

    router.push('/stella-assistant');
  };

  // Save conversation to Odoo as ticket
  const saveConversation = async () => {
    if (messages.length <= 1) {
      toast.error('Non ci sono abbastanza messaggi da salvare');
      return;
    }

    setIsSavingConversation(true);

    try {
      console.log('💾 Salvataggio conversazione in Odoo...');

      const response = await fetch('/api/stella/save-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          actionType: selectedAction.id,
          actionTitle: selectedAction.title,
          userEmail: userProfile?.user?.email || user?.email
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Conversazione salvata - Task ID:', data.taskId);
        toast.success('✅ Conversazione salvata come ticket!');

        // Optional: Show link to Odoo task
        if (data.taskUrl) {
          console.log('🔗 Link task Odoo:', data.taskUrl);
        }
      } else {
        console.error('❌ Errore salvataggio:', data.error);
        toast.error('❌ Errore: ' + (data.error || 'Impossibile salvare'));
      }

    } catch (error) {
      console.error('❌ Errore chiamata API save-conversation:', error);
      toast.error('❌ Errore di connessione al server');
    } finally {
      setIsSavingConversation(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <AppHeader
        title="🌟 Stella - Assistenza Clienti AI"
        subtitle="La tua assistente personale sempre disponibile"
      />

      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={goBack}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Torna alla selezione</span>
        </motion.button>

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

        {/* Chat Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border-2 border-gray-300 shadow-xl"
        >
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Conversazione con Stella</h3>
                <p className="text-sm opacity-90">{selectedAction.title}</p>
              </div>
            </div>
          </div>

          {/* Messages - FILTER OUT SYSTEM PROMPTS */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.filter(msg => !msg.isSystemPrompt).map((message) => (
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
                      {new Date(message.timestamp).toLocaleTimeString()}
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
            onMessageReceived={(msg) => {
              // Aggiungi i messaggi vocali all'array messages principale
              setMessages(prev => [...prev, {
                id: `voice-${Date.now()}`,
                text: msg.text,
                isUser: msg.isUser,
                timestamp: new Date(msg.timestamp),
                isSystemPrompt: false
              }]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StellaChat() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-xl animate-pulse">
            🌟
          </div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    }>
      <StellaChatContent />
    </Suspense>
  );
}
