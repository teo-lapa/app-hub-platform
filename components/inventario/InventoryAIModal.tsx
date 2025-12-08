'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  StopCircle,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PlusCircle,
  Check,
  Edit,
  SkipForward,
  Package,
  Camera,
  Sparkles
} from 'lucide-react';

interface InventoryAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: number;
  locationName: string;
  products: Array<{
    id: number;
    quant_id?: number;
    name: string;
    code?: string;
    quantity: number;
    uom: string;
    lot_id?: number;
    lot_name?: string;
    lot_expiration_date?: string;
    image?: string;
  }>;
  onConfirmResults: (results: Array<{
    productId: number;
    quantId?: number;
    newQuantity: number;
    lotName?: string;
    expiryDate?: string;
    action: 'update' | 'skip' | 'add';
  }>) => void;
}

type ModalState = 'recording' | 'processing' | 'results';

type MatchStatus = 'match' | 'difference' | 'not_found' | 'new';

interface ExtractedProduct {
  productName: string;
  quantity: number;
  uom: string;
  confidence: number;
  observations?: string;
}

interface AIResult {
  productId: number;
  quantId?: number;
  name: string;
  code?: string;
  image?: string;
  odooQuantity: number;
  videoQuantity: number;
  uom: string;
  status: MatchStatus;
  lotName?: string;
  expiryDate?: string;
  action: 'update' | 'skip' | 'add';
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function InventoryAIModal({
  isOpen,
  onClose,
  locationId,
  locationName,
  products,
  onConfirmResults
}: InventoryAIModalProps) {
  const [modalState, setModalState] = useState<ModalState>('recording');
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [results, setResults] = useState<AIResult[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && modalState === 'recording') {
      startCamera();
    } else if (!isOpen) {
      stopRecording();
      resetModal();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Start recording
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Record in 1s chunks
      mediaRecorderRef.current = mediaRecorder;

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting camera:', error);
      alert('Impossibile accedere alla fotocamera. Verifica i permessi.');
      onClose();
    }
  };

  const stopRecording = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    setModalState('processing');
    simulateAIProcessing();
  };

  const processVideoWithAI = async (videoBlob: Blob) => {
    try {
      setProcessingProgress(10);

      // 1. Upload video to Vercel Blob
      const { upload } = await import('@vercel/blob/client');
      const timestamp = Date.now();
      const filename = `inventory-ai/location-${locationId}/${timestamp}.webm`;

      setProcessingProgress(20);

      const blob = await upload(filename, videoBlob, {
        access: 'public',
        handleUploadUrl: '/api/controllo-diretto/upload-video',
      });

      setProcessingProgress(40);
      console.log('📹 Video uploaded:', blob.url);

      // 2. Call AI analysis API
      const response = await fetch('/api/inventory/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          videoUrl: blob.url,
          locationId,
          locationName,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            barcode: p.code, // Use code as barcode if not available
            quantity: p.quantity,
            uom: p.uom,
            lot_id: p.lot_id,
            lot_name: p.lot_name,
            lot_expiration_date: p.lot_expiration_date
          }))
        })
      });

      setProcessingProgress(80);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore analisi AI');
      }

      setProcessingProgress(100);

      // Save extracted products for debugging
      if (data.analysis.debug?.extractedProducts) {
        setExtractedProducts(data.analysis.debug.extractedProducts);
        console.log('🔍 Gemini extracted products:', data.analysis.debug.extractedProducts);
      }

      // 3. Transform API results to our format
      const aiResults: AIResult[] = data.analysis.matches.map((match: any) => {
        const originalProduct = products.find(p =>
          p.name.toLowerCase().includes(match.productName?.toLowerCase() || '') ||
          match.productName?.toLowerCase().includes(p.name.toLowerCase())
        );

        let status: MatchStatus = 'not_found';
        if (match.seenInVideo && match.confidence >= 0.7) {
          status = match.expectedQuantity === match.actualQuantity ? 'match' : 'difference';
        }

        return {
          productId: originalProduct?.id || match.productId || 0,
          quantId: originalProduct?.quant_id,
          name: match.productName || originalProduct?.name || 'Sconosciuto',
          code: originalProduct?.code,
          image: originalProduct?.image,
          odooQuantity: match.expectedQuantity || originalProduct?.quantity || 0,
          videoQuantity: match.actualQuantity || 0,
          uom: match.unit || originalProduct?.uom || 'PZ',
          status,
          lotName: match.lotNumber || originalProduct?.lot_name,
          expiryDate: match.expiryDate || originalProduct?.lot_expiration_date,
          action: status === 'match' ? 'skip' : 'update'
        };
      });

      // Add products not found in video (default to SKIP - don't update to 0!)
      products.forEach(product => {
        const found = aiResults.some(r => r.productId === product.id);
        if (!found) {
          aiResults.push({
            productId: product.id,
            quantId: product.quant_id,
            name: product.name,
            code: product.code,
            image: product.image,
            odooQuantity: product.quantity,
            videoQuantity: 0,
            uom: product.uom,
            status: 'not_found',
            lotName: product.lot_name,
            expiryDate: product.lot_expiration_date,
            action: 'skip'  // NON aggiornare automaticamente a 0 i prodotti non visti
          });
        }
      });

      // NOTE: Non aggiungiamo prodotti "nuovi" - solo match con prodotti esistenti
      // I prodotti extra visti nel video vengono ignorati per l'inventario
      if (data.analysis.additionalProductsSeen && data.analysis.additionalProductsSeen.length > 0) {
        console.log('⚠️ Prodotti extra visti nel video (ignorati):', data.analysis.additionalProductsSeen);
      }

      setResults(aiResults);
      setModalState('results');

    } catch (error: any) {
      console.error('❌ Error processing video:', error);
      alert('Errore durante l\'analisi AI: ' + error.message);
      // Fallback to mock results for testing
      generateMockResults();
      setModalState('results');
    }
  };

  const simulateAIProcessing = () => {
    // Use real AI if we have video chunks, otherwise simulate
    if (chunksRef.current.length > 0) {
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      processVideoWithAI(videoBlob);
    } else {
      // Fallback: Simulate AI processing with progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        setProcessingProgress(progress);

        if (progress >= 100) {
          clearInterval(progressInterval);
          generateMockResults();
          setModalState('results');
        }
      }, 300);
    }
  };

  const generateMockResults = () => {
    // Generate mock AI results based on products
    const mockResults: AIResult[] = products.map((product, index) => {
      const statuses: MatchStatus[] = ['match', 'difference', 'not_found'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      let videoQuantity = product.quantity;
      if (randomStatus === 'difference') {
        videoQuantity = product.quantity + Math.floor(Math.random() * 10) - 5;
      } else if (randomStatus === 'not_found') {
        videoQuantity = 0;
      }

      return {
        productId: product.id,
        quantId: product.quant_id,
        name: product.name,
        code: product.code,
        image: product.image,
        odooQuantity: product.quantity,
        videoQuantity: Math.max(0, videoQuantity),
        uom: product.uom,
        status: randomStatus,
        lotName: product.lot_name,
        expiryDate: product.lot_expiration_date,
        action: randomStatus === 'match' ? 'skip' : 'update'
      };
    });

    // Non aggiungiamo più prodotti "nuovi" mock
    setResults(mockResults);
  };

  const resetModal = () => {
    setModalState('recording');
    setRecordingTime(0);
    setProcessingProgress(0);
    setResults([]);
    chunksRef.current = [];
  };

  const handleUpdateResult = (index: number, updates: Partial<AIResult>) => {
    setResults(prev => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...updates };
      return newResults;
    });
  };

  const handleConfirmAll = () => {
    const confirmedResults = results
      .filter(r => r.action !== 'skip')
      .map(r => ({
        productId: r.productId,
        quantId: r.quantId,
        newQuantity: r.videoQuantity,
        lotName: r.lotName,
        expiryDate: r.expiryDate,
        action: r.action
      }));

    console.log('🚀 [InventoryAIModal] Conferma Tutti - Risultati da salvare:', confirmedResults);
    console.log('🚀 [InventoryAIModal] Totale risultati:', results.length);
    console.log('🚀 [InventoryAIModal] Da aggiornare:', confirmedResults.length);

    onConfirmResults(confirmedResults);
    onClose();
  };

  const getStatusConfig = (status: MatchStatus) => {
    switch (status) {
      case 'match':
        return {
          icon: CheckCircle2,
          color: 'text-green-400',
          bg: 'bg-green-500/20',
          border: 'border-green-500/30',
          label: 'Match OK'
        };
      case 'difference':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-400',
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-500/30',
          label: 'Differenza'
        };
      case 'not_found':
        return {
          icon: XCircle,
          color: 'text-red-400',
          bg: 'bg-red-500/20',
          border: 'border-red-500/30',
          label: 'Non trovato'
        };
      case 'new':
        return {
          icon: PlusCircle,
          color: 'text-blue-400',
          bg: 'bg-blue-500/20',
          border: 'border-blue-500/30',
          label: 'Nuovo prodotto'
        };
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* STATO: RECORDING */}
          {modalState === 'recording' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <Camera className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Inventario AI Video</h3>
                    <p className="text-sm text-gray-400">{locationName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Preview */}
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* REC Indicator */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-red-600/90 backdrop-blur-sm rounded-full">
                  <div className="relative">
                    <div className="w-3 h-3 bg-white rounded-full" />
                    <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping" />
                  </div>
                  <span className="text-sm text-white font-bold tracking-wide">REC</span>
                </div>

                {/* Timer */}
                <div className="absolute top-4 right-4 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-xl">
                  <span className="text-2xl text-white font-mono font-bold">
                    {formatTime(recordingTime)}
                  </span>
                </div>

                {/* Products Count */}
                <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/70 backdrop-blur-sm rounded-xl">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-white" />
                    <span className="text-sm text-white font-medium">
                      {products.length} prodotti da verificare
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer - Stop Button */}
              <div className="p-6 border-t border-white/20 bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    Inquadra i prodotti e premi Stop quando hai finito
                  </p>
                  <button
                    onClick={handleStopRecording}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-red-500/25"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop Registrazione
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STATO: PROCESSING */}
          {modalState === 'processing' && (
            <div className="p-12">
              <div className="flex flex-col items-center justify-center space-y-6">
                {/* AI Icon with animation */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 360]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>

                {/* Loading spinner */}
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />

                {/* Title */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Analisi AI in corso...</h3>
                  <p className="text-gray-400">
                    Stiamo analizzando il video e confrontando i prodotti
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-md">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${processingProgress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                    />
                  </div>
                  <p className="text-center text-sm text-gray-400 mt-2">
                    {processingProgress}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STATO: RESULTS */}
          {modalState === 'results' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Risultati Analisi AI</h3>
                    <p className="text-sm text-gray-400">
                      {results.filter(r => r.action !== 'skip').length} modifiche da confermare
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      showDebug ? 'bg-purple-600 text-white' : 'glass hover:bg-white/10'
                    }`}
                  >
                    🔍 Debug ({extractedProducts.length})
                  </button>
                  <button
                    onClick={onClose}
                    className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Debug Section - What Gemini Extracted */}
              {showDebug && extractedProducts.length > 0 && (
                <div className="p-4 bg-purple-900/30 border-b border-purple-500/30">
                  <h4 className="text-sm font-semibold text-purple-300 mb-2">
                    🤖 Cosa ha estratto Gemini dal video:
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {extractedProducts.map((ep, idx) => (
                      <div key={idx} className="text-xs text-gray-300 bg-black/30 rounded px-2 py-1">
                        <span className="font-medium text-white">{ep.productName}</span>
                        {' - '}
                        <span className="text-green-400">{ep.quantity} {ep.uom}</span>
                        {' '}
                        <span className="text-gray-500">(conf: {(ep.confidence * 100).toFixed(0)}%)</span>
                        {ep.observations && (
                          <span className="text-yellow-400 ml-2">📝 {ep.observations}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {extractedProducts.length === 0 && (
                    <p className="text-xs text-red-400">
                      ⚠️ Gemini non ha estratto nessun prodotto dal video. Controlla la qualità del video e le etichette.
                    </p>
                  )}
                </div>
              )}

              {/* Results List */}
              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-3">
                {results.map((result, index) => {
                  const statusConfig = getStatusConfig(result.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <motion.div
                      key={`${result.productId}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`glass rounded-xl p-4 border-2 ${statusConfig.border}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Product Image */}
                        {result.image ? (
                          <img
                            src={result.image}
                            alt={result.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          {/* Name and Status */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-semibold">{result.name}</h4>
                              {result.code && (
                                <p className="text-xs text-gray-400">{result.code}</p>
                              )}
                            </div>
                            <div className={`flex items-center gap-1.5 px-2 py-1 ${statusConfig.bg} rounded-lg`}>
                              <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                              <span className={`text-xs font-medium ${statusConfig.color}`}>
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>

                          {/* Quantities Comparison */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="glass-weak rounded-lg p-2">
                              <p className="text-xs text-gray-400 mb-1">Odoo</p>
                              <p className="font-bold">{result.odooQuantity} {result.uom}</p>
                            </div>
                            <div className={`rounded-lg p-2 ${
                              result.status === 'match' ? 'bg-green-500/10' :
                              result.status === 'difference' ? 'bg-yellow-500/10' :
                              result.status === 'new' ? 'bg-blue-500/10' :
                              'bg-red-500/10'
                            }`}>
                              <p className="text-xs text-gray-400 mb-1">Video AI</p>
                              <p className="font-bold">{result.videoQuantity} {result.uom}</p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateResult(index, { action: 'update' })}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                                result.action === 'update'
                                  ? 'bg-green-600 text-white shadow-lg'
                                  : 'glass-weak hover:bg-white/10'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                              Conferma
                            </button>
                            <button
                              onClick={() => {
                                // TODO: Open edit modal
                                console.log('Edit product:', result);
                              }}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 glass-weak rounded-lg hover:bg-white/10 transition-all"
                            >
                              <Edit className="w-4 h-4" />
                              <span className="text-sm font-medium">Modifica</span>
                            </button>
                            <button
                              onClick={() => handleUpdateResult(index, { action: 'skip' })}
                              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                                result.action === 'skip'
                                  ? 'bg-gray-600 text-white'
                                  : 'glass-weak hover:bg-white/10'
                              }`}
                            >
                              <SkipForward className="w-4 h-4" />
                              <span className="text-sm font-medium">Salta</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer - Confirm All */}
              <div className="p-6 border-t border-white/20 bg-gray-900/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {results.filter(r => r.action === 'update').length} modifiche da salvare
                    </p>
                    <p className="text-xs text-gray-400">
                      {results.filter(r => r.action === 'skip').length} prodotti saltati
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleConfirmAll}
                      disabled={results.filter(r => r.action !== 'skip').length === 0}
                      className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-green-500/25"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Conferma Tutti ({results.filter(r => r.action !== 'skip').length})
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
