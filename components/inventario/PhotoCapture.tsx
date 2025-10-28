'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Trash2, Check, Image as ImageIcon } from 'lucide-react';

interface PhotoCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoBase64: string) => void;
  title?: string;
  maxPhotos?: number;
}

interface CapturedPhoto {
  id: string;
  base64: string;
  thumbnail: string;
}

export function PhotoCapture({
  isOpen,
  onClose,
  onCapture,
  title = "Scatta Foto",
  maxPhotos = 3
}: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Calcola dimensioni mantenendo aspect ratio
          const maxSize = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          // Crea canvas per compressione
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context non disponibile'));
            return;
          }

          // Disegna immagine ridimensionata
          ctx.drawImage(img, 0, 0, width, height);

          // Converti a base64 con qualità 0.8
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          resolve(base64);
        };

        img.onerror = () => reject(new Error('Errore caricamento immagine'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Errore lettura file'));
      reader.readAsDataURL(file);
    });
  };

  const createThumbnail = async (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const thumbnailSize = 150;
        const canvas = document.createElement('canvas');

        // Calcola crop quadrato al centro
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;

        canvas.width = thumbnailSize;
        canvas.height = thumbnailSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context non disponibile'));
          return;
        }

        ctx.drawImage(
          img,
          x, y, size, size,
          0, 0, thumbnailSize, thumbnailSize
        );

        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        resolve(thumbnail);
      };

      img.onerror = () => reject(new Error('Errore creazione thumbnail'));
      img.src = base64;
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);

    try {
      const newPhotos: CapturedPhoto[] = [];
      const availableSlots = maxPhotos - photos.length;
      const filesToProcess = Array.from(files).slice(0, availableSlots);

      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) continue;

        // Comprimi immagine
        const base64 = await compressImage(file);

        // Crea thumbnail
        const thumbnail = await createThumbnail(base64);

        newPhotos.push({
          id: `${Date.now()}-${Math.random()}`,
          base64,
          thumbnail
        });
      }

      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (error) {
      console.error('Errore elaborazione foto:', error);
      alert('Errore durante l\'elaborazione delle foto');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== id));
  };

  const handleConfirm = () => {
    if (photos.length === 0) return;

    // Se c'è una sola foto, ritorna quella
    if (photos.length === 1) {
      onCapture(photos[0].base64);
    } else {
      // Se ci sono più foto, ritorna tutte come array JSON stringificato
      const photosData = photos.map(p => p.base64);
      onCapture(JSON.stringify(photosData));
    }

    handleClose();
  };

  const handleClose = () => {
    setPhotos([]);
    onClose();
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  const canAddMore = photos.length < maxPhotos;
  const hasPhotos = photos.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="glass-strong rounded-t-xl p-4 flex items-center justify-between border-b border-white/20">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              {title}
              {maxPhotos > 1 && (
                <span className="text-sm text-muted-foreground">
                  ({photos.length}/{maxPhotos})
                </span>
              )}
            </h3>
            <button
              onClick={handleClose}
              className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="glass-strong rounded-b-xl p-6">
            {/* Photos Grid */}
            {hasPhotos && (
              <div className={`grid gap-3 mb-6 ${
                photos.length === 1 ? 'grid-cols-1' :
                photos.length === 2 ? 'grid-cols-2' :
                'grid-cols-3'
              }`}>
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative aspect-square group"
                  >
                    <img
                      src={photo.thumbnail}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border-2 border-white/20"
                    />

                    {/* Delete Button */}
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    {/* Photo Number Badge */}
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                      {index + 1}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Empty State / Camera Button */}
            {!hasPhotos && (
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="w-10 h-10 text-blue-400" />
                </div>
                <p className="text-muted-foreground text-sm mb-2">
                  Nessuna foto scattata
                </p>
                <p className="text-muted-foreground text-xs">
                  {maxPhotos > 1
                    ? `Puoi scattare fino a ${maxPhotos} foto`
                    : 'Scatta una foto per continuare'}
                </p>
              </div>
            )}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="glass-strong p-4 rounded-lg mb-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Elaborazione foto...
                </p>
              </div>
            )}

            {/* Instructions */}
            <div className="glass-strong p-3 rounded-lg mb-6">
              <p className="text-sm text-muted-foreground text-center">
                {canAddMore
                  ? maxPhotos > 1
                    ? 'Tocca per scattare o selezionare più foto'
                    : 'Tocca per scattare o selezionare una foto'
                  : 'Massimo numero di foto raggiunto'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Camera/Add Button */}
              <button
                onClick={handleCameraClick}
                disabled={!canAddMore || isProcessing}
                className={`
                  flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all active:scale-95
                  ${canAddMore && !isProcessing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'}
                `}
              >
                <Camera className="w-4 h-4" />
                {hasPhotos ? 'Aggiungi' : 'Scatta'}
              </button>

              {/* Confirm Button */}
              <button
                onClick={handleConfirm}
                disabled={!hasPhotos || isProcessing}
                className={`
                  flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all active:scale-95
                  ${hasPhotos && !isProcessing
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'}
                `}
              >
                <Check className="w-4 h-4" />
                Conferma
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="w-full mt-3 glass-strong py-3 px-4 rounded-lg hover:bg-white/20 transition-colors font-semibold"
            >
              Annulla
            </button>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple={maxPhotos > 1}
              onChange={handleFileChange}
              className="hidden"
              disabled={!canAddMore || isProcessing}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
