'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  Shield,
  Camera,
  X,
  CheckCircle,
  Banknote,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  loadModels,
  getFaceEmbeddingFromBase64,
  findBestMatch,
} from '@/lib/face-recognition';
import { formatCurrency } from '@/lib/registro-cassaforte/helpers';
import { ADMIN_EMAIL } from '@/lib/registro-cassaforte/constants';
import type { EnrolledFace } from '@/lib/registro-cassaforte/types';

const API_KEY = process.env.NEXT_PUBLIC_CASSAFORTE_API_KEY || '';

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (API_KEY) headers['x-cassaforte-key'] = API_KEY;
  return headers;
}

export default function PrelievoPage() {
  const router = useRouter();

  // Auth state
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showFaceScanner, setShowFaceScanner] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authorizedName, setAuthorizedName] = useState('');

  // Face recognition
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [enrolledFaces, setEnrolledFaces] = useState<EnrolledFace[]>([]);

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Withdrawal state
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawalDone, setWithdrawalDone] = useState(false);
  const [lastWithdrawal, setLastWithdrawal] = useState<{ amount: number; moveId: number | null } | null>(null);

  // Load face models
  useEffect(() => {
    const init = async () => {
      try {
        await loadModels();
        setFaceModelsLoaded(true);
        const response = await fetch('/api/registro-cassaforte/face-embeddings', {
          headers: getApiHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setEnrolledFaces(data.embeddings?.map((e: any) => ({
            employee_id: e.employee_id,
            employee_name: e.employee_name,
            embedding: e.embedding,
          })) || []);
        }
      } catch (error) {
        console.error('Failed to load face models:', error);
        toast.error('Errore nel caricamento dei modelli facciali');
      }
    };
    init();
  }, []);

  // Camera management
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Impossibile accedere alla camera');
      setShowFaceScanner(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (showFaceScanner) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [showFaceScanner]);

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current || !faceModelsLoaded) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = imageData.split(',')[1];

      const embedding = await getFaceEmbeddingFromBase64(base64);
      if (!embedding) {
        setAuthError('Nessun volto rilevato. Riprova.');
        setIsAuthenticating(false);
        return;
      }

      const match = findBestMatch(embedding, enrolledFaces, 0.5);
      if (match) {
        // Check if this person is authorized for withdrawals (admin only)
        const empResponse = await fetch('/api/registro-cassaforte/employees', {
          headers: getApiHeaders(),
        });
        if (empResponse.ok) {
          const empData = await empResponse.json();
          const employee = empData.employees?.find((e: any) => e.id === match.employee_id);

          if (employee && employee.work_email === ADMIN_EMAIL) {
            setIsAuthorized(true);
            setAuthorizedName(employee.name);
            setShowFaceScanner(false);
            toast.success(`Benvenuto ${employee.name}!`);
          } else {
            setAuthError(`${match.employee_name} non è autorizzato ai prelievi`);
          }
        }
      } else {
        setAuthError('Volto non riconosciuto');
      }
    } catch (error) {
      console.error('Face recognition error:', error);
      setAuthError('Errore nel riconoscimento');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleWithdraw = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Inserisci un importo valido');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/registro-cassaforte/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
        body: JSON.stringify({
          employee_id: 0, // Admin withdrawal
          employee_name: authorizedName,
          amount: numAmount,
          note: note || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWithdrawalDone(true);
        setLastWithdrawal({ amount: numAmount, moveId: data.move_id });
        toast.success('Prelievo registrato!');
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Errore nel prelievo');
      }
    } catch (e: any) {
      console.error('Withdrawal error:', e);
      toast.error(e.message || 'Errore nel prelievo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewWithdrawal = () => {
    setAmount('');
    setNote('');
    setWithdrawalDone(false);
    setLastWithdrawal(null);
  };

  // Quick amount buttons
  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  // ==================== AUTH SCREEN ====================
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Banknote className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Prelievo Cassaforte</h1>
            <p className="text-white/60">Verifica la tua identità per prelevare</p>
          </div>

          {!showFaceScanner ? (
            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFaceScanner(true)}
                disabled={!faceModelsLoaded}
                className="w-full p-6 bg-gradient-to-r from-red-500 to-orange-600 rounded-2xl text-white text-xl font-bold shadow-xl disabled:opacity-50"
              >
                <div className="flex items-center justify-center gap-3">
                  {faceModelsLoaded ? (
                    <><Camera className="w-7 h-7" /> Verifica Identità</>
                  ) : (
                    <><Loader2 className="w-7 h-7 animate-spin" /> Caricamento modelli...</>
                  )}
                </div>
              </motion.button>

              <button
                onClick={() => router.push('/registro-cassaforte')}
                className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-medium transition-colors"
              >
                <div className="flex items-center justify-center gap-2">
                  <ArrowLeft className="w-5 h-5" /> Torna Indietro
                </div>
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <button onClick={() => setShowFaceScanner(false)} className="absolute top-3 right-3 p-2 bg-black/50 rounded-full">
                  <X className="w-5 h-5 text-white" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-red-400/50 rounded-full" />
                </div>
                {authError && (
                  <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-500/90 rounded-xl">
                    <p className="text-white text-center font-medium">{authError}</p>
                  </div>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={captureAndRecognize}
                disabled={isAuthenticating}
                className="w-full mt-4 p-4 bg-red-500 hover:bg-red-600 rounded-2xl text-white font-bold transition-colors disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Verifica in corso...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Camera className="w-5 h-5" /> Scatta e Verifica
                  </div>
                )}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== WITHDRAWAL DONE ====================
  if (withdrawalDone && lastWithdrawal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8"
          >
            <CheckCircle className="w-16 h-16 text-emerald-400" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-4">Prelievo Completato!</h1>
          <p className="text-xl text-white/60 mb-2">{authorizedName}</p>
          <p className="text-5xl font-bold text-red-400 mb-8">{formatCurrency(lastWithdrawal.amount)}</p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleNewWithdrawal}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
            >
              Nuovo Prelievo
            </button>
            <button
              onClick={() => router.push('/registro-cassaforte')}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== WITHDRAWAL FORM ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/registro-cassaforte')}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Prelievo Cassaforte</h1>
          </div>
          <p className="text-white/60">{authorizedName} - Prelievo contanti</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-8">
        {/* Amount Input */}
        <div className="mb-8">
          <label className="block text-white/80 mb-3 text-lg">Importo (CHF)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.05"
            className="w-full px-6 py-5 bg-white/10 border border-white/20 rounded-2xl text-white text-3xl font-bold placeholder-white/30 focus:outline-none focus:border-red-400/50 text-center"
          />
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {quickAmounts.map((qa) => (
            <motion.button
              key={qa}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAmount(qa.toString())}
              className={`py-3 rounded-xl font-semibold transition-colors ${
                amount === qa.toString()
                  ? 'bg-red-500 text-white'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {formatCurrency(qa)}
            </motion.button>
          ))}
        </div>

        {/* Note */}
        <div className="mb-8">
          <label className="block text-white/80 mb-3 text-lg">Nota (opzionale)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Es. Fondo cassa, pagamento fornitore..."
            className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-lg placeholder-white/30 focus:outline-none focus:border-white/40"
          />
        </div>

        {/* Warning */}
        {parseFloat(amount) > 2000 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-400" />
              <p className="text-amber-300 text-sm">
                Prelievo superiore a CHF 2'000 - Assicurati che sia corretto
              </p>
            </div>
          </div>
        )}

        {/* Confirm Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleWithdraw}
          disabled={isProcessing || !amount || parseFloat(amount) <= 0}
          className="w-full py-5 bg-gradient-to-r from-red-500 to-orange-600 rounded-2xl text-white text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isProcessing ? (
            <><Loader2 className="w-6 h-6 animate-spin" /> Registrazione in corso...</>
          ) : (
            <><Banknote className="w-6 h-6" /> Conferma Prelievo {amount ? formatCurrency(parseFloat(amount) || 0) : ''}</>
          )}
        </motion.button>
      </div>
    </div>
  );
}
