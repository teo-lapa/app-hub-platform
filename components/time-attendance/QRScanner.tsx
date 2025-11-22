'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion } from 'framer-motion';
import { Camera, X, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (qrSecret: string, locationData: LocationValidation) => void;
  gpsPosition: { lat: number; lng: number } | null;
}

interface LocationValidation {
  location_id: string;
  location_name: string;
  company_id: number;
  distance_meters: number;
  radius_meters: number;
  within_geofence: boolean;
}

export default function QRScanner({ isOpen, onClose, onScanSuccess, gpsPosition }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<LocationValidation | null>(null);

  // Initialize scanner when modal opens
  useEffect(() => {
    if (isOpen && !scannerRef.current) {
      initScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const initScanner = async () => {
    try {
      setError(null);
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onQRCodeDetected,
        () => {} // Ignore errors during scanning
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner init error:', err);
      setError('Impossibile accedere alla fotocamera. Verifica i permessi.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const onQRCodeDetected = async (decodedText: string) => {
    // Stop scanning while we validate
    await stopScanner();

    // Try to parse QR data
    let qrSecret: string;

    try {
      // QR could be JSON with secret or just the secret string
      const parsed = JSON.parse(decodedText);
      qrSecret = parsed.secret || parsed.qr_secret || decodedText;
    } catch {
      // Not JSON, use as-is (could be the secret directly or a URL)
      // Extract secret from URL if present
      const urlMatch = decodedText.match(/[?&]qr=([^&]+)/);
      qrSecret = urlMatch ? urlMatch[1] : decodedText;
    }

    // Validate QR + GPS with backend
    await validateQRAndLocation(qrSecret);
  };

  const validateQRAndLocation = async (qrSecret: string) => {
    if (!gpsPosition) {
      setError('Posizione GPS non disponibile. Attiva la geolocalizzazione.');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const res = await fetch('/api/time-attendance/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_secret: qrSecret,
          latitude: gpsPosition.lat,
          longitude: gpsPosition.lng,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setValidationResult(data.data);
        // Success! Pass data to parent
        setTimeout(() => {
          onScanSuccess(qrSecret, data.data);
        }, 1500);
      } else {
        // Handle specific errors
        if (data.code === 'OUT_OF_GEOFENCE') {
          setError(`Sei troppo lontano! Distanza: ${data.data?.distance_meters}m (max ${data.data?.radius_meters}m)`);
          setValidationResult({
            ...data.data,
            within_geofence: false,
          });
        } else if (data.code === 'INVALID_QR') {
          setError('QR Code non riconosciuto o sede non attiva');
        } else {
          setError(data.error || 'Errore validazione');
        }
        // Allow retry
        setTimeout(() => initScanner(), 2000);
      }
    } catch (err) {
      console.error('Validation error:', err);
      setError('Errore di rete. Riprova.');
      setTimeout(() => initScanner(), 2000);
    } finally {
      setValidating(false);
    }
  };

  const handleClose = () => {
    stopScanner();
    setError(null);
    setValidationResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Scansiona QR Code</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* GPS Status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${
          gpsPosition ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <MapPin className="w-4 h-4" />
          <span className="text-sm">
            {gpsPosition
              ? `GPS attivo (${gpsPosition.lat.toFixed(4)}, ${gpsPosition.lng.toFixed(4)})`
              : 'GPS non disponibile - attivalo!'}
          </span>
        </div>

        {/* Scanner Area */}
        <div className="aspect-square bg-black rounded-2xl overflow-hidden relative mb-4">
          {/* QR Reader Container */}
          <div id="qr-reader" className="w-full h-full" />

          {/* Overlay when not scanning */}
          {!isScanning && !validating && !validationResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white/50">
                <Camera className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Inizializzazione fotocamera...</p>
              </div>
            </div>
          )}

          {/* Validation Loading */}
          {validating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-2 text-blue-400 animate-spin" />
                <p className="text-white">Verifica posizione...</p>
              </div>
            </div>
          )}

          {/* Validation Success */}
          {validationResult?.within_geofence && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/90">
              <div className="text-center text-white">
                <CheckCircle className="w-16 h-16 mx-auto mb-2" />
                <p className="text-xl font-bold">{validationResult.location_name}</p>
                <p className="text-sm opacity-80">
                  Distanza: {validationResult.distance_meters}m
                </p>
              </div>
            </div>
          )}

          {/* Scan corners */}
          {isScanning && (
            <>
              <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl pointer-events-none" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl pointer-events-none" />

              {/* Scan line */}
              <motion.div
                animate={{ y: [-100, 100] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent pointer-events-none"
              />
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 rounded-xl mb-4">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <p className="text-center text-white/60 text-sm">
          Inquadra il QR Code della sede.
          {!gpsPosition && (
            <span className="block mt-1 text-yellow-400">
              Devi attivare il GPS per continuare!
            </span>
          )}
        </p>

        {/* Manual retry button */}
        {error && (
          <button
            onClick={() => {
              setError(null);
              setValidationResult(null);
              initScanner();
            }}
            className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
          >
            Riprova Scansione
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
