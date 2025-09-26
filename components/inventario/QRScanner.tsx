'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Flashlight, FlashlightOff } from 'lucide-react';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  title?: string;
}

export function QRScanner({ isOpen, onClose, onScan, title = "Scanner QR/Barcode" }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      setScanning(true);

      const constraints = {
        video: {
          facingMode: 'environment', // Camera posteriore
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      // Simula scanner QR (in produzione useresti una libreria come html5-qrcode)
      setTimeout(() => {
        simulateQRScan();
      }, 2000);

    } catch (err) {
      console.error('Errore accesso camera:', err);
      setError('Impossibile accedere alla camera. Verifica i permessi.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setScanning(false);
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      if (capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !torchEnabled }]
          });
          setTorchEnabled(!torchEnabled);
        } catch (err) {
          console.error('Errore controllo flash:', err);
        }
      }
    }
  };

  const simulateQRScan = () => {
    // Simula la lettura di un QR code dopo 2 secondi
    const mockCodes = [
      'LOC001',
      'WH/Stock/Shelf-A',
      'PROD123456',
      'LOC_BUFFER_001'
    ];

    const randomCode = mockCodes[Math.floor(Math.random() * mockCodes.length)];
    onScan(randomCode);
    onClose();
  };

  const handleManualInput = () => {
    const input = prompt('Inserisci codice manualmente:');
    if (input) {
      onScan(input);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md mx-4"
        >
          {/* Header */}
          <div className="glass-strong rounded-t-xl p-4 flex items-center justify-between border-b border-white/20">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              {title}
            </h3>
            <button
              onClick={onClose}
              className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scanner Area */}
          <div className="glass-strong rounded-b-xl p-6">
            {error ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={handleManualInput}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Inserimento Manuale
                </button>
              </div>
            ) : (
              <>
                {/* Video Preview */}
                <div className="relative bg-black rounded-lg overflow-hidden mb-4 aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Scanning Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-blue-500 relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500"></div>

                      {/* Scanning Line */}
                      {scanning && (
                        <motion.div
                          animate={{ y: [0, 192, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          className="absolute left-0 right-0 h-0.5 bg-blue-500 shadow-lg shadow-blue-500/50"
                        />
                      )}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      scanning ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {scanning ? 'Scansione attiva' : 'Camera non attiva'}
                    </div>

                    <button
                      onClick={toggleTorch}
                      className="glass p-2 rounded-full hover:bg-white/20 transition-colors"
                      disabled={!stream}
                    >
                      {torchEnabled ? (
                        <FlashlightOff className="w-4 h-4" />
                      ) : (
                        <Flashlight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="text-center mb-4">
                  <p className="text-muted-foreground text-sm">
                    Inquadra il codice QR o barcode nell'area evidenziata
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleManualInput}
                    className="flex-1 glass-strong py-3 px-4 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Inserimento Manuale
                  </button>
                  <button
                    onClick={simulateQRScan}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Simula Scansione
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}