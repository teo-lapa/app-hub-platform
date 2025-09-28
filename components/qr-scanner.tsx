'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface QrScannerProps {
  onResult: (result: string) => void;
  onError?: (error: string) => void;
}

export function QrScanner({ onResult, onError }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setScanning(true);

        // Simulazione lettura barcode - in produzione useresti una libreria come QuaggaJS
        setTimeout(() => {
          simulateScan();
        }, 3000);
      }
    } catch (error) {
      console.error('Errore accesso camera:', error);
      setHasCamera(false);
      if (onError) {
        onError('Camera non disponibile');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const simulateScan = () => {
    // Simula lettura di un barcode
    const testBarcodes = ['LOC-001', 'WH/Stock', 'A-01-01', 'BUFFER-01'];
    const randomBarcode = testBarcodes[Math.floor(Math.random() * testBarcodes.length)];
    onResult(randomBarcode);
  };

  const handleManualInput = () => {
    const input = prompt('Inserisci manualmente il codice:');
    if (input) {
      onResult(input);
    }
  };

  if (!hasCamera) {
    return (
      <div className="text-center py-10">
        <Camera className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-white mb-4">Camera non disponibile</p>
        <button
          onClick={handleManualInput}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
        >
          Inserisci Manualmente
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-lg"
      />
      {scanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="border-2 border-emerald-500 w-64 h-64 rounded-lg animate-pulse" />
        </div>
      )}
      <div className="mt-4 flex gap-3">
        <button
          onClick={simulateScan}
          className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium"
        >
          Simula Scansione
        </button>
        <button
          onClick={handleManualInput}
          className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
        >
          Inserisci Manualmente
        </button>
      </div>
      <p className="text-gray-400 text-sm text-center mt-4">
        Punta la camera verso il codice a barre
      </p>
    </div>
  );
}