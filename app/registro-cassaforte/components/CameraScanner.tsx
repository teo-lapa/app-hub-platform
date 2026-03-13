'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Camera, ScanLine, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/registro-cassaforte/helpers';

interface CameraScannerProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  onFinish?: () => void;
  mode: 'face' | 'banknote';
  isProcessing: boolean;
  lastResult?: string;
  currentTotal?: number;
  expectedTotal?: number;
}

export default function CameraScanner({
  onCapture,
  onClose,
  onFinish,
  mode,
  isProcessing,
  lastResult,
  currentTotal = 0,
  expectedTotal,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsReady(true);
        }
      } catch (error) {
        console.error('Camera error:', error);
        setHasCamera(false);
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = imageData.split(',')[1];
    onCapture(base64);
  };

  if (!hasCamera) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
        <div className="text-center p-8">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl text-white mb-2">Camera non disponibile</h2>
          <p className="text-white/60 mb-6">Impossibile accedere alla camera del dispositivo</p>
          <button onClick={onClose} className="px-6 py-3 bg-white/20 rounded-xl text-white">
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 z-10 p-3 bg-black/50 rounded-full">
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Totals bar for banknote mode */}
      {mode === 'banknote' && (
        <div className="absolute top-4 left-4 right-16 z-10">
          <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/60 text-sm">Totale contato</div>
                <div className="text-3xl font-bold text-emerald-400">{formatCurrency(currentTotal)}</div>
              </div>
              {expectedTotal !== undefined && expectedTotal > 0 && (
                <div className="text-right">
                  <div className="text-white/60 text-sm">Atteso</div>
                  <div className="text-xl font-semibold text-white">{formatCurrency(expectedTotal)}</div>
                  <div className={`text-sm font-medium ${currentTotal >= expectedTotal ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {currentTotal >= expectedTotal
                      ? '✓ Completo'
                      : `Mancano ${formatCurrency(expectedTotal - currentTotal)}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video feed */}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {mode === 'face' ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-64 h-80 border-4 border-white/50 rounded-[50%] relative">
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-lg shadow-cyan-400/50"
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-[90%] max-w-md aspect-[16/7] border-4 border-white/50 rounded-2xl relative">
              <motion.div
                animate={{ left: ['0%', '100%', '0%'] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute top-0 bottom-0 w-1 bg-emerald-400 shadow-lg shadow-emerald-400/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Result overlay for banknote mode */}
      {mode === 'banknote' && lastResult && !isProcessing && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-x-0 top-32 flex items-start justify-center pointer-events-none z-20"
        >
          <div className={`px-8 py-6 rounded-3xl ${
            lastResult.includes('DUPLICATO')
              ? 'bg-amber-500/90'
              : lastResult.includes('✓')
                ? 'bg-emerald-500/90'
                : 'bg-red-500/80'
          }`}>
            <p className="text-white text-3xl font-bold text-center">{lastResult}</p>
          </div>
        </motion.div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="text-center">
          {isProcessing ? (
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <span className="text-white text-2xl font-medium">Analisi in corso...</span>
            </div>
          ) : (
            <>
              <p className="text-white/80 text-lg mb-4">
                {mode === 'face' ? 'Posiziona il viso nel cerchio' : 'Tocca il pulsante per scansionare'}
              </p>
              <div className="flex items-center justify-center gap-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={captureImage}
                  className={`px-8 py-4 rounded-2xl text-white text-lg font-semibold pointer-events-auto ${
                    mode === 'face' ? 'bg-cyan-500' : 'bg-emerald-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {mode === 'face' ? (
                      <><Camera className="w-6 h-6" /> Scatta Foto</>
                    ) : (
                      <><ScanLine className="w-6 h-6" /> Scansiona</>
                    )}
                  </div>
                </motion.button>

                {mode === 'banknote' && onFinish && currentTotal > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onFinish}
                    className="px-8 py-4 rounded-2xl text-white text-lg font-semibold pointer-events-auto bg-blue-600"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-6 h-6" /> Ho Finito
                    </div>
                  </motion.button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
