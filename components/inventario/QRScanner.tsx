'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Flashlight, FlashlightOff } from 'lucide-react';
import QrScanner from 'qr-scanner';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  title?: string;
}

export function QRScanner({ isOpen, onClose, onScan, title = "Scanner QR/Barcode" }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const scannerRef = useRef<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      startScanner();
      setHasScanned(false);
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setError(null);
      setScanning(true);

      if (!videoRef.current) {
        setError('Elemento video non trovato');
        return;
      }

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          // Evita scansioni multiple dello stesso codice
          if (!hasScanned) {
            setHasScanned(true);
            console.log(`✅ QR Code scansionato: ${result.data}`);
            onScan(result.data);
            stopScanner();
            onClose();
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      scannerRef.current = qrScanner;

      // Prova prima con la camera posteriore
      try {
        await qrScanner.start();
        qrScanner.setCamera('environment').catch(() => {
          console.warn('Camera posteriore non disponibile, uso default');
        });
      } catch (err) {
        console.warn('Errore camera posteriore, provo con anteriore');
        await qrScanner.start();
      }

    } catch (err) {
      console.error('Errore avvio scanner:', err);
      setError('Impossibile accedere alla camera. Verifica i permessi.');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch (err) {
        console.error('Errore stop scanner:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
    setTorchEnabled(false);
  };

  const handleManualInput = () => {
    const input = prompt('Inserisci codice manualmente:');
    if (input && input.trim()) {
      onScan(input.trim());
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
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
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
                {/* QR Scanner Container */}
                <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    className="w-full h-64 object-cover rounded-lg"
                    autoPlay
                    muted
                    playsInline
                  />

                  {/* Status Indicator */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                    <div className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400">
                      {scanning ? 'Scansione in corso...' : 'Avvio scanner...'}
                    </div>

                    <button
                      onClick={() => console.log('Flash non disponibile')}
                      className="glass p-2 rounded-full hover:bg-white/20 transition-colors pointer-events-auto"
                      disabled={!scanning}
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
                    Inquadra il QR code o codice a barre
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
                    onClick={onClose}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Annulla
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