'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Flashlight, FlashlightOff, Package, MapPin } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string, type: 'product' | 'location') => void;
  scanMode: 'product' | 'location';
  expectedCode?: string; // Per verificare se il codice scansionato è quello atteso
  title?: string;
}

export function QRScanner({
  isOpen,
  onClose,
  onScan,
  scanMode,
  expectedCode,
  title = "Scanner QR/Barcode"
}: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [wrongCodeScanned, setWrongCodeScanned] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isOpen) {
      startScanner();
      setHasScanned(false);
      setWrongCodeScanned(false);
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

      const html5QrCode = new Html5Qrcode("qr-reader-picking");
      scannerRef.current = html5QrCode;

      const qrCodeSuccessCallback = (decodedText: string) => {
        // Evita scansioni multiple dello stesso codice
        if (!hasScanned) {
          setHasScanned(true);

          // Verifica se il codice scansionato è quello atteso (per modalità prodotto)
          if (expectedCode && scanMode === 'product' && decodedText !== expectedCode) {
            setWrongCodeScanned(true);
            setHasScanned(false); // Permetti nuova scansione

            // Vibrazione per feedback errore
            if ('vibrate' in navigator) {
              navigator.vibrate([100, 50, 100]);
            }

            setTimeout(() => {
              setWrongCodeScanned(false);
            }, 2000);

            return;
          }

          console.log(`✅ Codice scansionato (${scanMode}): ${decodedText}`);

          // Vibrazione per feedback successo
          if ('vibrate' in navigator) {
            navigator.vibrate(200);
          }

          onScan(decodedText, scanMode);
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
          () => {} // Ignora errori di scansione continui
        );
      } catch (err) {
        console.warn('Camera posteriore non disponibile, provo con anteriore');
        await html5QrCode.start(
          { facingMode: "user" },
          config,
          qrCodeSuccessCallback,
          () => {}
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

  const handleManualInput = () => {
    const typeLabel = scanMode === 'product' ? 'prodotto' : 'ubicazione';
    const input = prompt(`Inserisci codice ${typeLabel} manualmente:`);
    if (input && input.trim()) {
      onScan(input.trim(), scanMode);
      onClose();
    }
  };

  if (!isOpen) return null;

  const ScanIcon = scanMode === 'product' ? Package : MapPin;
  const scanColor = scanMode === 'product' ? 'blue' : 'green';

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
          <div className={`glass-strong rounded-t-xl p-4 flex items-center justify-between border-b border-white/20`}>
            <h3 className="font-semibold flex items-center gap-2">
              <ScanIcon className={`w-5 h-5 text-${scanColor}-400`} />
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
                  <div id="qr-reader-picking" className="w-full"></div>

                  {/* Wrong Code Alert */}
                  {wrongCodeScanned && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg"
                    >
                      <p className="font-semibold">❌ Prodotto errato!</p>
                      <p className="text-sm">Scansiona il prodotto corretto</p>
                    </motion.div>
                  )}

                  {/* Status Indicator */}
                  {!wrongCodeScanned && (
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium bg-${scanColor}-500/20 text-${scanColor}-400`}>
                        {scanning ? `Scansione ${scanMode === 'product' ? 'prodotto' : 'ubicazione'}...` : 'Avvio scanner...'}
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
                  )}
                </div>

                {/* Instructions */}
                <div className="text-center mb-4">
                  <p className="text-muted-foreground text-sm">
                    {scanMode === 'product'
                      ? 'Inquadra il codice a barre del prodotto'
                      : 'Inquadra il QR code dell\'ubicazione'}
                  </p>
                  {expectedCode && (
                    <p className="text-xs text-yellow-400 mt-2">
                      Codice atteso: {expectedCode}
                    </p>
                  )}
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