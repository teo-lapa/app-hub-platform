'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Flashlight, FlashlightOff } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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
  const scannerRef = useRef<Html5Qrcode | null>(null);

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

      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      const qrCodeSuccessCallback = (decodedText: string) => {
        // Evita scansioni multiple dello stesso codice
        if (!hasScanned) {
          setHasScanned(true);
          console.log(`✅ QR Code scansionato: ${decodedText}`);
          onScan(decodedText);
          stopScanner();
          onClose();
        }
      };

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      // Prova prima con la camera posteriore
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          (errorMessage) => {
            // Ignora errori di scansione continui
          }
        );
      } catch (err) {
        console.warn('Camera posteriore non disponibile, provo con anteriore');
        // Se fallisce, prova con qualsiasi camera disponibile
        await html5QrCode.start(
          { facingMode: "user" },
          config,
          qrCodeSuccessCallback,
          (errorMessage) => {
            // Ignora errori di scansione continui
          }
        );
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
        const isScanning = scannerRef.current.isScanning;
        if (isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error('Errore stop scanner:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          // Ottieni le capacità della camera
          const track = scannerRef.current.getRunningTrack();
          if (track) {
            const capabilities = track.getCapabilities() as any;
            if (capabilities.torch) {
              await track.applyConstraints({
                advanced: [{ torch: !torchEnabled } as any]
              });
              setTorchEnabled(!torchEnabled);
            }
          }
        }
      } catch (err) {
        console.error('Errore controllo flash:', err);
      }
    }
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
                {/* QR Scanner Container */}
                <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                  <div id="qr-reader" className="w-full"></div>

                  {/* Status Indicator */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      scanning ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {scanning ? 'Scansione attiva' : 'Avvio scanner...'}
                    </div>

                    <button
                      onClick={toggleTorch}
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
                    Inquadra il codice QR o barcode nel riquadro
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