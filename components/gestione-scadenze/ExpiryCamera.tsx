'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Check, RotateCcw, Plus, Image as ImageIcon } from 'lucide-react';

interface ExpiryCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photos: string[]) => void;
  productName: string;
  maxPhotos?: number;
}

export function ExpiryCamera({
  isOpen,
  onClose,
  onCapture,
  productName,
  maxPhotos = 3
}: ExpiryCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Avvia la fotocamera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setCameraReady(false);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: any) {
      console.error('Errore accesso fotocamera:', err);
      setError('Impossibile accedere alla fotocamera. Verifica i permessi.');
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhotos([]);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Switch camera
  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Restart camera when facingMode changes
  useEffect(() => {
    if (isOpen && cameraReady) {
      startCamera();
    }
  }, [facingMode]);

  // Scatta foto
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get base64 image
    const photoData = canvas.toDataURL('image/jpeg', 0.9);

    // Add to photos array
    setPhotos(prev => [...prev, photoData]);
  };

  // Rimuovi foto
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Conferma e invia foto
  const confirmPhotos = () => {
    if (photos.length > 0) {
      stopCamera();
      onCapture(photos);
    }
  };

  // Chiudi e annulla
  const handleClose = () => {
    stopCamera();
    setPhotos([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <div className="text-center flex-1 mx-4">
              <h3 className="text-white font-semibold truncate">{productName}</h3>
              <p className="text-white/70 text-sm">Fotografa l'etichetta con lotto e scadenza</p>
            </div>
            <button
              onClick={switchCamera}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <RotateCcw className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Camera View */}
        <div className="absolute inset-0 flex items-center justify-center">
          {error ? (
            <div className="text-center p-6">
              <Camera className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <p className="text-red-400">{error}</p>
              <button
                onClick={startCamera}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg"
              >
                Riprova
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Overlay con guida */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-[80%] h-[40%] border-2 border-orange-400/50 rounded-xl">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-orange-400/70 text-sm text-center">
                      Centra l'etichetta qui
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Canvas nascosto per cattura */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Photos Preview */}
        {photos.length > 0 && (
          <div className="absolute bottom-32 left-0 right-0 px-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-orange-500"
                >
                  <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-0 right-0 p-1 bg-red-500 rounded-bl-lg"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-center text-xs text-white py-0.5">
                    {index + 1}/{maxPhotos}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex items-center justify-center gap-6">
            {/* Photo counter */}
            <div className="flex items-center gap-2 text-white/70">
              <ImageIcon className="w-5 h-5" />
              <span>{photos.length}/{maxPhotos}</span>
            </div>

            {/* Capture button */}
            {photos.length < maxPhotos && cameraReady && (
              <button
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full bg-white border-4 border-orange-500 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <div className="w-16 h-16 rounded-full bg-orange-500" />
              </button>
            )}

            {/* Confirm button */}
            {photos.length > 0 && (
              <button
                onClick={confirmPhotos}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-full font-semibold hover:bg-green-600 transition-colors"
              >
                <Check className="w-5 h-5" />
                Conferma ({photos.length})
              </button>
            )}
          </div>

          {/* Instructions */}
          <p className="text-center text-white/50 text-sm mt-4">
            {photos.length === 0
              ? 'Scatta almeno una foto dell\'etichetta'
              : photos.length < maxPhotos
                ? `Puoi aggiungere altre ${maxPhotos - photos.length} foto`
                : 'Massimo foto raggiunto. Conferma o rimuovi una foto.'}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
