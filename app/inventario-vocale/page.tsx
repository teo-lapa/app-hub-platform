'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Trash2,
  Send,
  Download,
  FileText,
  FileSpreadsheet,
  ArrowLeft,
  Clock,
  Package,
  CheckCircle,
  XCircle,
  Loader,
  AlertTriangle,
  Calendar,
  Building2,
  User,
  History,
  Plus,
  Edit3,
  Save,
  X,
  Volume2,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Types
interface ExtractedProduct {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'food' | 'non_food';
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface InventorySession {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'recording' | 'processing' | 'review' | 'completed';
  location?: string;
  audio_duration?: number;
  transcription?: string;
  products: ExtractedProduct[];
  user_id?: number;
  user_name?: string;
  company_name?: string;
}

interface SavedRecording {
  id: string;
  blob: Blob;
  timestamp: Date;
  duration: number;
  synced: boolean;
}

export default function InventarioVocalePage() {
  const router = useRouter();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'idle' | 'transcribing' | 'extracting' | 'done'>('idle');
  const [transcription, setTranscription] = useState<string>('');
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [step, setStep] = useState<'record' | 'review' | 'history'>('record');
  const [location, setLocation] = useState<string>('');
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Offline storage
  const [pendingRecordings, setPendingRecordings] = useState<SavedRecording[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventorySession[]>([]);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending recordings from localStorage
  useEffect(() => {
    const loadPendingRecordings = async () => {
      try {
        const saved = localStorage.getItem('voice_inventory_pending');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Note: Blobs can't be stored directly, we store base64
          setPendingRecordings(parsed.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp)
          })));
        }
      } catch (e) {
        console.error('Error loading pending recordings:', e);
      }
    };
    loadPendingRecordings();
  }, []);

  // Load history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/inventario-vocale/history');
        if (response.ok) {
          const data = await response.json();
          setInventoryHistory(data.sessions || []);
        }
      } catch (e) {
        console.error('Error loading history:', e);
      }
    };
    if (isOnline) {
      loadHistory();
    }
  }, [isOnline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType
        });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Impossibile accedere al microfono. Verifica i permessi del browser.');
    }
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsPaused(!isPaused);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  // Delete recording
  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setTranscription('');
    setProducts([]);
    setStep('record');
  };

  // Save recording offline
  const saveRecordingOffline = async () => {
    if (!audioBlob) return;

    try {
      // Convert blob to base64 for localStorage
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const newRecording: SavedRecording = {
          id: `rec_${Date.now()}`,
          blob: audioBlob,
          timestamp: new Date(),
          duration: recordingTime,
          synced: false
        };

        // Save to localStorage (without blob, store base64)
        const toStore = {
          ...newRecording,
          base64Data: base64,
          mimeType: audioBlob.type
        };

        const existing = JSON.parse(localStorage.getItem('voice_inventory_pending') || '[]');
        existing.push(toStore);
        localStorage.setItem('voice_inventory_pending', JSON.stringify(existing));

        setPendingRecordings(prev => [...prev, newRecording]);
        deleteRecording();

        alert('Registrazione salvata! Verrà processata quando torni online.');
      };
      reader.readAsDataURL(audioBlob);
    } catch (e) {
      console.error('Error saving offline:', e);
      setError('Errore nel salvare la registrazione offline');
    }
  };

  // Process recording with AI
  const processRecording = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    setError(null);
    setProcessingStep('transcribing');

    try {
      // Step 1: Transcribe with Whisper
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('location', location);

      const transcribeResponse = await fetch('/api/inventario-vocale/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || 'Errore nella trascrizione');
      }

      const transcribeData = await transcribeResponse.json();
      setTranscription(transcribeData.transcription);

      // Step 2: Extract products with Claude
      setProcessingStep('extracting');

      const extractResponse = await fetch('/api/inventario-vocale/extract-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: transcribeData.transcription,
          location
        })
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.error || 'Errore nell\'estrazione prodotti');
      }

      const extractData = await extractResponse.json();
      setProducts(extractData.products);

      setProcessingStep('done');
      setStep('review');

    } catch (err) {
      console.error('Error processing:', err);
      setError(err instanceof Error ? err.message : 'Errore nel processamento');
      setProcessingStep('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save inventory to database
  const saveInventory = async () => {
    if (products.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/inventario-vocale/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          transcription,
          products,
          audio_duration: recordingTime
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel salvataggio');
      }

      const data = await response.json();

      // Refresh history
      const historyResponse = await fetch('/api/inventario-vocale/history');
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setInventoryHistory(historyData.sessions || []);
      }

      // Reset state
      deleteRecording();
      setProducts([]);
      setTranscription('');
      setLocation('');
      setStep('record');

      alert('Inventario salvato con successo!');

    } catch (err) {
      console.error('Error saving:', err);
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export functions
  const exportPDF = async (sessionId?: string) => {
    try {
      const id = sessionId || 'current';
      const data = sessionId ? undefined : { products, location, transcription };

      const response = await fetch('/api/inventario-vocale/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionId ? { session_id: sessionId } : data)
      });

      if (!response.ok) throw new Error('Errore export PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Errore nell\'export PDF');
    }
  };

  const exportExcel = async (sessionId?: string) => {
    try {
      const data = sessionId ? undefined : { products, location, transcription };

      const response = await fetch('/api/inventario-vocale/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionId ? { session_id: sessionId } : data)
      });

      if (!response.ok) throw new Error('Errore export Excel');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Errore nell\'export Excel');
    }
  };

  // Update product
  const updateProduct = (id: string, updates: Partial<ExtractedProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setEditingProduct(null);
  };

  // Delete product
  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Add product manually
  const addProduct = () => {
    const newProduct: ExtractedProduct = {
      id: `manual_${Date.now()}`,
      name: '',
      quantity: 1,
      unit: 'pz',
      category: 'food',
      confidence: 'high'
    };
    setProducts(prev => [...prev, newProduct]);
    setEditingProduct(newProduct.id);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                🎤 Inventario Vocale
              </h1>
              <p className="text-white/60 mt-1">
                Registra l'inventario parlando - funziona anche offline!
              </p>
            </div>

            {/* Online status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setStep('record')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
              step === 'record' || step === 'review'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            <Mic size={20} className="inline mr-2" />
            Nuova Registrazione
          </button>
          <button
            onClick={() => setStep('history')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
              step === 'history'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            <History size={20} className="inline mr-2" />
            Storico
          </button>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3"
            >
              <XCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-red-300">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending recordings notice */}
        {pendingRecordings.length > 0 && isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-yellow-400" size={20} />
                <span className="text-yellow-300">
                  {pendingRecordings.length} registrazioni da sincronizzare
                </span>
              </div>
              <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center gap-2">
                <RefreshCw size={16} />
                Sincronizza
              </button>
            </div>
          </motion.div>
        )}

        {/* Recording Step */}
        {step === 'record' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Location Input */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <label className="block text-white/80 text-sm font-medium mb-2">
                📍 Zona/Ubicazione (opzionale)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="es. Frigo principale, Magazzino secco, Congelatore..."
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Recording Interface */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              {/* Recording visualization */}
              <div className="text-center mb-8">
                <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-red-500/30 animate-pulse'
                    : audioBlob
                      ? 'bg-green-500/30'
                      : 'bg-purple-500/30'
                }`}>
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
                    isRecording
                      ? 'bg-red-500/50'
                      : audioBlob
                        ? 'bg-green-500/50'
                        : 'bg-purple-500/50'
                  }`}>
                    {isRecording ? (
                      <Mic size={48} className="text-white animate-pulse" />
                    ) : audioBlob ? (
                      <CheckCircle size={48} className="text-white" />
                    ) : (
                      <Mic size={48} className="text-white/60" />
                    )}
                  </div>
                </div>

                {/* Timer */}
                <div className="mt-4 text-4xl font-mono text-white">
                  {formatTime(recordingTime)}
                </div>

                {isRecording && (
                  <p className="text-white/60 mt-2">
                    {isPaused ? '⏸️ In pausa' : '🔴 Registrazione in corso...'}
                  </p>
                )}
              </div>

              {/* Recording Controls */}
              <div className="flex justify-center gap-4">
                {!isRecording && !audioBlob && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startRecording}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg transition-colors flex items-center gap-3"
                  >
                    <Mic size={24} />
                    Inizia Registrazione
                  </motion.button>
                )}

                {isRecording && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePause}
                      className="px-6 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-2xl font-bold transition-colors flex items-center gap-2"
                    >
                      {isPaused ? <Play size={24} /> : <Pause size={24} />}
                      {isPaused ? 'Riprendi' : 'Pausa'}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={stopRecording}
                      className="px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-2xl font-bold transition-colors flex items-center gap-2"
                    >
                      <Square size={24} />
                      Stop
                    </motion.button>
                  </>
                )}

                {audioBlob && !isRecording && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={deleteRecording}
                      className="px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-2xl font-bold transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={24} />
                      Elimina
                    </motion.button>

                    {!isOnline ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={saveRecordingOffline}
                        className="px-8 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-2xl font-bold text-lg transition-colors flex items-center gap-3"
                      >
                        <Download size={24} />
                        Salva Offline
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={processRecording}
                        disabled={isProcessing}
                        className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-lg transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <>
                            <Loader size={24} className="animate-spin" />
                            {processingStep === 'transcribing' ? 'Trascrizione...' : 'Estrazione prodotti...'}
                          </>
                        ) : (
                          <>
                            <Send size={24} />
                            Processa Inventario
                          </>
                        )}
                      </motion.button>
                    )}
                  </>
                )}
              </div>

              {/* Audio Preview */}
              {audioUrl && !isRecording && (
                <div className="mt-6 p-4 bg-black/20 rounded-xl">
                  <audio src={audioUrl} controls className="w-full" />
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-yellow-400" />
                Come funziona
              </h3>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>• Clicca "Inizia Registrazione" e parla normalmente</li>
                <li>• Esempio: "Ho 5 cartoni di scampi, 10 kg di salsiccia fresca, 4 cartoni di patatine"</li>
                <li>• Puoi mettere in pausa e riprendere quando vuoi</li>
                <li>• Quando finisci, clicca "Stop" e poi "Processa Inventario"</li>
                <li>• <strong>Funziona offline!</strong> Le registrazioni verranno processate quando torni online</li>
              </ul>
            </div>
          </motion.div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Transcription */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Volume2 size={20} />
                Trascrizione Audio
              </h3>
              <p className="text-white/80 bg-black/20 rounded-xl p-4 italic">
                "{transcription}"
              </p>
            </div>

            {/* Products List */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Package size={20} />
                  Prodotti Trovati ({products.length})
                </h3>
                <button
                  onClick={addProduct}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Aggiungi
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-black/20 rounded-xl p-4 border border-white/10"
                  >
                    {editingProduct === product.id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={product.name}
                          onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                          placeholder="Nome prodotto"
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                        <div className="flex gap-3">
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProduct(product.id, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                          />
                          <input
                            type="text"
                            value={product.unit}
                            onChange={(e) => updateProduct(product.id, { unit: e.target.value })}
                            placeholder="Unità"
                            className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                          />
                          <select
                            value={product.category}
                            onChange={(e) => updateProduct(product.id, { category: e.target.value as 'food' | 'non_food' })}
                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                          >
                            <option value="food">Food</option>
                            <option value="non_food">Non Food</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingProduct(null)}
                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                          >
                            Annulla
                          </button>
                          <button
                            onClick={() => setEditingProduct(null)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-1"
                          >
                            <Save size={14} />
                            Salva
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-white font-medium">{product.name || '(senza nome)'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getConfidenceColor(product.confidence)}`}>
                              {product.confidence}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${product.category === 'food' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {product.category === 'food' ? '🍕 Food' : '📦 Non Food'}
                            </span>
                          </div>
                          <p className="text-white/60 text-sm mt-1">
                            {product.quantity} {product.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingProduct(product.id)}
                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={() => removeProduct(product.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {products.length === 0 && (
                  <div className="text-center py-8 text-white/40">
                    <Package size={48} className="mx-auto mb-3 opacity-50" />
                    <p>Nessun prodotto trovato</p>
                    <button
                      onClick={addProduct}
                      className="mt-3 text-purple-400 hover:text-purple-300"
                    >
                      + Aggiungi manualmente
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setStep('record')}
                className="flex-1 min-w-[140px] px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft size={20} />
                Indietro
              </button>

              <button
                onClick={() => exportPDF()}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <FileText size={20} />
                PDF
              </button>

              <button
                onClick={() => exportExcel()}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <FileSpreadsheet size={20} />
                Excel
              </button>

              <button
                onClick={saveInventory}
                disabled={isProcessing || products.length === 0}
                className="flex-1 min-w-[140px] px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Salva Inventario
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* History Step */}
        {step === 'history' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {inventoryHistory.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
                <History size={64} className="mx-auto text-white/30 mb-4" />
                <h3 className="text-white text-xl font-semibold mb-2">Nessun inventario salvato</h3>
                <p className="text-white/60 mb-6">Inizia a registrare il tuo primo inventario vocale!</p>
                <button
                  onClick={() => setStep('record')}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                >
                  Nuova Registrazione
                </button>
              </div>
            ) : (
              inventoryHistory.map((session) => (
                <div
                  key={session.id}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <Calendar size={18} className="text-purple-400" />
                        <span className="text-white font-medium">
                          {new Date(session.created_at).toLocaleDateString('it-IT', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {session.location && (
                        <p className="text-white/60 text-sm mt-1 ml-7">
                          📍 {session.location}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        session.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {session.status === 'completed' ? '✅ Completato' : '⏳ In corso'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-white/60 text-sm mb-4">
                    <span className="flex items-center gap-1">
                      <Package size={14} />
                      {session.products.length} prodotti
                    </span>
                    {session.audio_duration && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatTime(session.audio_duration)}
                      </span>
                    )}
                    {session.user_name && (
                      <span className="flex items-center gap-1">
                        <User size={14} />
                        {session.user_name}
                      </span>
                    )}
                  </div>

                  {/* Products preview */}
                  <div className="bg-black/20 rounded-xl p-3 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {session.products.slice(0, 5).map((product, idx) => (
                        <span key={idx} className="px-2 py-1 bg-white/10 rounded-lg text-white/80 text-xs">
                          {product.quantity} {product.unit} {product.name}
                        </span>
                      ))}
                      {session.products.length > 5 && (
                        <span className="px-2 py-1 bg-purple-500/20 rounded-lg text-purple-400 text-xs">
                          +{session.products.length - 5} altri
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportPDF(session.id)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <FileText size={16} />
                      PDF
                    </button>
                    <button
                      onClick={() => exportExcel(session.id)}
                      className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <FileSpreadsheet size={16} />
                      Excel
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
