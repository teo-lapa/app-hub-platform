'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import StellaRealTime from './components/StellaRealTime';

interface OdooTask {
  id: number;
  name: string;
  description: string;
  action_id: string;
  prompt_text: string;
}

export default function StellaAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [tasks, setTasks] = useState<OdooTask[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState('general');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognitionInstance = new (window as any).webkitSpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'it-IT';

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCurrentMessage(transcript);
        setIsListening(false);
        toast.success(`Riconosciuto: "${transcript}"`);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast.error('Errore nel riconoscimento vocale');
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }

    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/stella/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const startListening = () => {
    if (recognition) {
      setIsListening(true);
      setCurrentMessage('');
      recognition.start();
    } else {
      toast.error('Riconoscimento vocale non supportato');
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 animate-pulse"></div>
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            🌟 Stella - AI Assistant
          </h1>
          <p className="text-xl text-purple-200">
            La tua assistente AI vocale per LAPA
          </p>
        </motion.div>

        {/* Prompt Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <label className="block text-sm font-medium text-purple-200 mb-2">
            Seleziona modalità Stella:
          </label>
          <select
            value={selectedPrompt}
            onChange={(e) => setSelectedPrompt(e.target.value)}
            className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-400"
          >
            <option value="general">Conversazione Generale</option>
            <option value="inventory">Assistente Magazzino</option>
            <option value="sales">Assistente Vendite</option>
            <option value="support">Supporto Tecnico</option>
            <option value="training">Formazione Team</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.action_id}>
                {task.name}
              </option>
            ))}
          </select>
        </motion.div>

        {/* Real-Time Voice Component */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <StellaRealTime
            actionId={selectedPrompt}
            onListeningChange={setIsListening}
            onSpeakingChange={setIsSpeaking}
          />
        </motion.div>

        {/* Status Display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <AnimatePresence mode="wait">
            {isListening && (
              <motion.div
                key="listening"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center justify-center space-x-3"
              >
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-300">Ascolto...</span>
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              </motion.div>
            )}
            {isSpeaking && (
              <motion.div
                key="speaking"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center justify-center space-x-3"
              >
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
                <span className="text-blue-300">Stella sta parlando...</span>
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
              </motion.div>
            )}
            {!isListening && !isSpeaking && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-purple-300"
              >
                Pronta ad aiutarti ✨
              </motion.div>
            )}
          </AnimatePresence>

          {currentMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-white/10 rounded-lg backdrop-blur-sm"
            >
              <p className="text-white">
                <strong>Tu:</strong> {currentMessage}
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Info Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-6 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10"
        >
          <h3 className="text-lg font-semibold mb-4 text-purple-300">
            Come usare Stella:
          </h3>
          <ul className="space-y-2 text-purple-200">
            <li>• Clicca "Inizia Conversazione" per connetterti</li>
            <li>• Stella ti ascolterà automaticamente</li>
            <li>• Parla naturalmente in italiano</li>
            <li>• Stella risponderà vocalmente</li>
            <li>• Scegli diversi prompt per personalizzare l'assistenza</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}