'use client';

import { useState } from 'react';
import type { MatchedProduct } from './types';
import MediaUploadButtons from './MediaUploadButtons';

interface AIOrderInputProps {
  customerId: number | null;
  onProductsMatched: (
    products: MatchedProduct[],
    aiData: {
      transcription: string;
      messageType: string;
      allMatches: MatchedProduct[];
    }
  ) => void;
}

export default function AIOrderInput({ customerId, onProductsMatched }: AIOrderInputProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatchedProduct[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'image' | 'audio' | 'recording' | 'document'>('text');

  const handleFileSelected = (file: File, type: 'image' | 'audio' | 'document') => {
    setSelectedFile(file);
    setInputMode(type);
    setError(null);
    console.log(`📎 File selected: ${file.name} (${file.type})`);
  };

  const handleRecordingStart = () => {
    setInputMode('recording');
    setError(null);
    console.log('🎤 Recording started');
  };

  const handleRecordingStop = (audioBlob: Blob) => {
    const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
    setSelectedFile(audioFile);
    setInputMode('audio');
    console.log('🎤 Recording stopped, file created');
  };

  const handleProcess = async () => {
    if (!message.trim() && !selectedFile) {
      setError('Inserisci un messaggio o carica un file');
      return;
    }

    if (!customerId) {
      setError('Seleziona prima un cliente');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      let response: Response;

      if (selectedFile) {
        // Send file via FormData (Gemini will extract text, then Claude will match products)
        console.log(`📤 Sending ${selectedFile.type} file to AI for processing (Gemini→Claude flow)`);

        const formData = new FormData();
        formData.append('customerId', customerId.toString());
        formData.append('file', selectedFile);
        formData.append('messageType', inputMode);

        // Add text message if present (can be additional notes with file)
        if (message.trim()) {
          formData.append('message', message.trim());
        }

        response = await fetch('/api/catalogo-venditori/ai-process-order', {
          method: 'POST',
          body: formData,
          // Note: Don't set Content-Type header, browser will set it with boundary
        });
      } else {
        // Send text-only via JSON
        response = await fetch('/api/catalogo-venditori/ai-process-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId,
            message: message.trim(),
            messageType: inputMode
          }),
        });
      }

      if (!response.ok) {
        throw new Error('Errore nel processamento AI');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel processamento AI');
      }

      if (data.matches && data.matches.length > 0) {
        setResults(data.matches);

        // Pass AI data to parent (including transcription and all matches)
        onProductsMatched(data.matches, {
          transcription: data.message_analyzed || messageText,
          messageType: data.message_type || messageType,
          allMatches: data.matches // Include all matches (found and not found)
        });

        console.log(`✅ AI found ${data.matches.length} products`);

        // Clear input after successful processing
        setMessage('');
        setSelectedFile(null);
        setInputMode('text');
      } else {
        setError('Nessun prodotto trovato nel messaggio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'low':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      case 'low':
        return 'Bassa';
      default:
        return confidence;
    }
  };

  return (
    <div className="space-y-4">
      {/* Message Input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          Messaggio Ordine
        </label>

        {/* Media Upload Buttons - ABOVE textarea */}
        <div className="mb-3">
          <MediaUploadButtons
            onFileSelected={handleFileSelected}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
            disabled={loading || !customerId}
          />
        </div>

        {/* Selected File Indicator */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-emerald-400 font-medium">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setInputMode('text');
              }}
              className="text-slate-400 hover:text-red-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Incolla qui il messaggio WhatsApp, email o testo dell'ordine...&#10;&#10;Esempio:&#10;Buongiorno, vorrei ordinare:&#10;- 10 kg pomodori&#10;- 5 kg zucchine&#10;- 3 cassette insalata"
          rows={6}
          disabled={loading || !customerId}
          className="w-full min-h-[120px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontSize: '16px',
            lineHeight: '1.5',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            WebkitFontSmoothing: 'antialiased',
          }}
        />
        {!customerId && (
          <div className="flex items-center gap-2 text-yellow-400 mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm" style={{ fontSize: '14px', lineHeight: '1.5' }}>
              Seleziona prima un cliente per abilitare l'elaborazione AI
            </p>
          </div>
        )}
      </div>

      {/* Process Button */}
      <button
        onClick={handleProcess}
        disabled={loading || !customerId || (!message.trim() && !selectedFile)}
        className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
        style={{
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          fontSize: '16px',
          lineHeight: '1.5',
        }}
      >
        {loading ? (
          <>
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" style={{ transform: 'translateZ(0)' }} />
            <span>Elaborazione in corso...</span>
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>Processa con AI</span>
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-500">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* AI Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ transform: 'translateZ(0)' }} />
            <h3 className="text-lg font-semibold text-white" style={{ fontSize: '18px', lineHeight: '1.5' }}>
              Prodotti da Verificare ({results.filter(p => p.confidence !== 'ALTA').length})
            </h3>
          </div>

          <div className="space-y-3">
            {results.filter(product => product.confidence !== 'ALTA').map((product, index) => (
              <div
                key={index}
                className="bg-slate-800 rounded-lg p-4 border border-slate-700 active:border-slate-600 transition-all"
                style={{ contain: 'layout style' }}
              >
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white mb-2" style={{ fontSize: '16px', lineHeight: '1.5' }}>
                      {product.product_name}
                    </h4>
                    <div className="text-sm text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                      Quantità: <span className="text-emerald-400 font-semibold text-base">{product.quantita}</span>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border flex-shrink-0 ${getConfidenceBadgeColor(product.confidence)}`}
                    style={{ fontSize: '12px', lineHeight: '1.5' }}
                  >
                    {getConfidenceLabel(product.confidence)}
                  </span>
                </div>

                {/* Show reasoning only for MEDIA, BASSA, or NON_TROVATO confidence */}
                {product.reasoning && product.confidence !== 'ALTA' && (
                  <div className="bg-slate-900 rounded-md p-3 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1" style={{ fontSize: '12px', lineHeight: '1.5' }}>Motivazione AI:</div>
                    <div className="text-sm text-slate-300" style={{ fontSize: '14px', lineHeight: '1.5' }}>{product.reasoning}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white mb-1" style={{ fontSize: '14px', lineHeight: '1.5' }}>Prodotti aggiunti al carrello</p>
                <p style={{ fontSize: '14px', lineHeight: '1.5' }}>Controlla le quantità e i prodotti identificati prima di confermare l'ordine.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
