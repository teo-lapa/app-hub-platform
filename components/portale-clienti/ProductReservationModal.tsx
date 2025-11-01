'use client';

import { useState, useRef } from 'react';
import { X, Mic, Square, Pause, Play, Trash2, Upload, Image as ImageIcon, Send } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  code: string | null;
  image: string;
  unit: string;
}

interface ProductReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onSubmit: (data: ReservationData) => Promise<void>;
}

export interface ReservationData {
  productId: number;
  textNote: string;
  audioFile?: File;
  imageFile?: File;
}

export function ProductReservationModal({
  isOpen,
  onClose,
  product,
  onSubmit,
}: ProductReservationModalProps) {
  const [textNote, setTextNote] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    error: audioError,
  } = useAudioRecorder();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Immagine troppo grande (max 5MB)');
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    // Validazione: almeno un campo compilato
    if (!textNote.trim() && !audioBlob && !imageFile) {
      toast.error('Inserisci almeno una nota, un audio o una foto');
      return;
    }

    setIsSubmitting(true);
    try {
      // Converti audioBlob in File se presente
      let audioFile: File | undefined;
      if (audioBlob) {
        audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
      }

      await onSubmit({
        productId: product.id,
        textNote: textNote.trim(),
        audioFile,
        imageFile: imageFile || undefined,
      });

      // Reset form
      setTextNote('');
      clearRecording();
      handleRemoveImage();
      toast.success('Prenotazione salvata!');
      onClose();
    } catch (error: any) {
      console.error('Error submitting reservation:', error);
      toast.error(error.message || 'Errore nel salvare la prenotazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-white">Prenota Prodotto</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-full transition-all active:scale-90"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Product Info */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-700 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{product.name}</h3>
              {product.code && (
                <p className="text-sm text-gray-400">{product.code}</p>
              )}
              <p className="text-xs text-emerald-400 mt-1">
                Prodotto non disponibile - Richiedi disponibilità
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Text Note */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Messaggio (opzionale)
            </label>
            <textarea
              value={textNote}
              onChange={(e) => setTextNote(e.target.value)}
              placeholder="Es: Ho bisogno di 10 pezzi per lunedì prossimo..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {textNote.length}/500 caratteri
            </p>
          </div>

          {/* Audio Recording */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Messaggio Vocale (opzionale)
            </label>

            {audioError && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {audioError}
              </div>
            )}

            {!audioUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all active:scale-95"
                    >
                      <Mic className="h-5 w-5" />
                      Inizia Registrazione
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                      >
                        <Square className="h-5 w-5" />
                        Stop
                      </button>
                      <button
                        onClick={isPaused ? resumeRecording : pauseRecording}
                        className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                      >
                        {isPaused ? (
                          <>
                            <Play className="h-5 w-5" />
                            Riprendi
                          </>
                        ) : (
                          <>
                            <Pause className="h-5 w-5" />
                            Pausa
                          </>
                        )}
                      </button>
                      <div className="flex-1 text-center">
                        <span className={`text-lg font-mono ${isPaused ? 'text-yellow-400' : 'text-red-400'}`}>
                          {isPaused ? '⏸ ' : '🔴 '}
                          {formatTime(recordingTime)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <audio src={audioUrl} controls className="w-full" />
                <button
                  onClick={clearRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina e Registra Nuovo
                </button>
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Foto (opzionale)
            </label>

            {!imagePreview ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all w-full justify-center"
                >
                  <Upload className="h-5 w-5" />
                  Carica Foto
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-slate-700">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-contain"
                  />
                </div>
                <button
                  onClick={handleRemoveImage}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Rimuovi Foto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!textNote.trim() && !audioBlob && !imageFile)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <Send className="h-5 w-5" />
            {isSubmitting ? 'Invio in corso...' : 'Invia Richiesta'}
          </button>
        </div>
      </div>
    </div>
  );
}
