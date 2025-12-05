'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  User,
  Clock,
  Banknote,
  Coins,
  Camera,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Plus,
  Minus,
  Send,
  RefreshCw,
  Loader2,
  Package,
  UserCheck,
  Users,
  Receipt,
  Video,
  VideoOff,
  X,
  ChevronRight,
  Scan,
  CreditCard,
  ScanLine,
  Eye,
  XCircle,
  Shield,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  loadModels,
  getFaceEmbeddingFromBase64,
  findBestMatch,
  serializeEmbedding,
} from '@/lib/face-recognition';

// ==================== TYPES ====================
interface Employee {
  id: number;
  name: string;
  work_email: string;
  department_id?: [number, string];
  has_face_enrolled: boolean;
}

interface PendingPayment {
  picking_id: number;
  picking_name: string;
  partner_id: number;
  partner_name: string;
  amount: number;
  date: string;
  driver_name: string;
}

interface BanknoteCount {
  denomination: number;
  count: number;
  serial_numbers: string[]; // Numeri di serie delle banconote scansionate
}

interface CoinCount {
  denomination: number;
  count: number;
}

interface DepositSession {
  employee_id: number;
  employee_name: string;
  type: 'from_delivery' | 'extra';
  picking_ids?: number[];
  expected_amount?: number;
  customer_name?: string;
  banknotes: BanknoteCount[];
  coins: CoinCount[];
  total: number;
  video_session_id?: string;
  started_at: string;
}

// CHF Denominations
const BANKNOTE_DENOMINATIONS = [1000, 200, 100, 50, 20, 10];
const COIN_DENOMINATIONS = [5, 2, 1, 0.5, 0.2, 0.1, 0.05];

// Banknote colors for visual feedback
const BANKNOTE_COLORS: Record<number, string> = {
  10: 'from-yellow-400 to-amber-500',
  20: 'from-red-400 to-rose-500',
  50: 'from-green-400 to-emerald-500',
  100: 'from-blue-400 to-indigo-500',
  200: 'from-amber-600 to-orange-700',
  1000: 'from-purple-400 to-violet-500',
};

// ==================== HELPER FUNCTIONS ====================
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amount);
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('it-CH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// ==================== CAMERA COMPONENT ====================
interface CameraScannerProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  onFinish?: () => void; // For banknote mode - finish scanning
  mode: 'face' | 'banknote';
  isProcessing: boolean;
  lastResult?: string;
  // For banknote mode - show totals
  currentTotal?: number;
  expectedTotal?: number;
}

const CameraScanner: React.FC<CameraScannerProps> = ({
  onCapture,
  onClose,
  onFinish,
  mode,
  isProcessing,
  lastResult,
  currentTotal = 0,
  expectedTotal,
}) => {
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

  // NO auto-capture - manual click only for banknotes

  if (!hasCamera) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
        <div className="text-center p-8">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl text-white mb-2">Camera non disponibile</h2>
          <p className="text-white/60 mb-6">
            Impossibile accedere alla camera del dispositivo
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/20 rounded-xl text-white"
          >
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  // Format currency helper
  const formatCHF = (amount: number) => {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 bg-black/50 rounded-full"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Totals bar for banknote mode - TOP of screen */}
      {mode === 'banknote' && (
        <div className="absolute top-4 left-4 right-16 z-10">
          <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/60 text-sm">Totale contato</div>
                <div className="text-3xl font-bold text-emerald-400">{formatCHF(currentTotal)}</div>
              </div>
              {expectedTotal !== undefined && expectedTotal > 0 && (
                <div className="text-right">
                  <div className="text-white/60 text-sm">Atteso</div>
                  <div className="text-xl font-semibold text-white">{formatCHF(expectedTotal)}</div>
                  <div className={`text-sm font-medium ${
                    currentTotal >= expectedTotal ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {currentTotal >= expectedTotal
                      ? '✓ Completo'
                      : `Mancano ${formatCHF(expectedTotal - currentTotal)}`
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay based on mode */}
      <div className="absolute inset-0 pointer-events-none">
        {mode === 'face' ? (
          // Face scanning overlay
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
          // Banknote scanning overlay
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

      {/* Result overlay - BIG message near TOP for banknotes */}
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

      {/* Status bar */}
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
                {mode === 'face'
                  ? 'Posiziona il viso nel cerchio'
                  : 'Tocca il pulsante per scansionare'}
              </p>

              {/* Buttons row */}
              <div className="flex items-center justify-center gap-4">
                {/* Capture button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={captureImage}
                  className={`px-8 py-4 rounded-2xl text-white text-lg font-semibold pointer-events-auto ${
                    mode === 'face' ? 'bg-cyan-500' : 'bg-emerald-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {mode === 'face' ? (
                      <>
                        <Camera className="w-6 h-6" />
                        Scatta Foto
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-6 h-6" />
                        Scansiona
                      </>
                    )}
                  </div>
                </motion.button>

                {/* Finish button - only for banknote mode */}
                {mode === 'banknote' && onFinish && currentTotal > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onFinish}
                    className="px-8 py-4 rounded-2xl text-white text-lg font-semibold pointer-events-auto bg-blue-600"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-6 h-6" />
                      Ho Finito
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
};

// Admin email
const ADMIN_EMAIL = 'paul@lapa.ch';

// ==================== MAIN COMPONENT ====================
export default function RegistroCassafortePage() {
  const router = useRouter();

  // Admin state - check via URL parameter for simplicity
  const [isAdmin, setIsAdmin] = useState(false);

  // App State
  const [step, setStep] = useState<
    'idle' | 'face_scan' | 'enrollment' | 'face_enroll' | 'welcome' | 'select_type' | 'select_pickings' | 'extra_input' | 'counting' | 'banknote_scan' | 'confirm' | 'success'
  >('idle');

  // Employee State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  // Payments State
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);
  const [extraCustomerName, setExtraCustomerName] = useState('');

  // Counting State
  const [banknotes, setBanknotes] = useState<BanknoteCount[]>(
    BANKNOTE_DENOMINATIONS.map(d => ({ denomination: d, count: 0, serial_numbers: [] }))
  );
  const [coins, setCoins] = useState<CoinCount[]>(
    COIN_DENOMINATIONS.map(d => ({ denomination: d, count: 0 }))
  );

  // UI State
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSessionId, setVideoSessionId] = useState<string | null>(null);
  const [depositType, setDepositType] = useState<'from_delivery' | 'extra'>('from_delivery');

  // Camera Scanner State
  const [showFaceScanner, setShowFaceScanner] = useState(false);
  const [showBanknoteScanner, setShowBanknoteScanner] = useState(false);
  const [showEnrollScanner, setShowEnrollScanner] = useState(false);
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [isScanningBanknote, setIsScanningBanknote] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | undefined>();
  const [enrollmentImages, setEnrollmentImages] = useState<string[]>([]);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showFinalConfirmDialog, setShowFinalConfirmDialog] = useState(false);

  // Face Recognition State (face-api.js)
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [enrolledFaces, setEnrolledFaces] = useState<Array<{ employee_id: number; employee_name: string; embedding: number[] }>>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ==================== EFFECTS ====================

  // Note: Admin access is now determined by face recognition
  // When the user is recognized as paul@lapa.ch, isAdmin is set to true

  // Mount and clock update - client-only to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Unlock screen orientation for this page only (allow rotation)
  useEffect(() => {
    const unlockOrientation = async () => {
      try {
        // @ts-ignore - screen.orientation.unlock() is not in all TS definitions
        if (screen.orientation && screen.orientation.unlock) {
          await screen.orientation.unlock();
        }
      } catch (error) {
        // Orientation API not supported or permission denied - ignore silently
        console.log('Screen orientation unlock not supported');
      }
    };

    unlockOrientation();

    // Cleanup: lock back to portrait when leaving the page
    return () => {
      try {
        // @ts-ignore - Screen Orientation API not fully typed
        if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock('portrait-primary').catch(() => {});
        }
      } catch (error) {
        // Ignore errors
      }
    };
  }, []);

  // Auto-return to idle after success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        resetSession();
      }, 10000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  // Load face-api.js models and enrolled faces
  useEffect(() => {
    const initFaceRecognition = async () => {
      try {
        console.log('Loading face recognition models...');
        const loaded = await loadModels();
        setFaceModelsLoaded(loaded);
        if (loaded) {
          console.log('✅ Face models loaded successfully');
        }

        // Load enrolled faces from API
        const response = await fetch('/api/registro-cassaforte/face-embeddings');
        if (response.ok) {
          const data = await response.json();
          setEnrolledFaces(data.embeddings || []);
          console.log(`Loaded ${data.embeddings?.length || 0} enrolled faces`);
        }
      } catch (error) {
        console.error('Error initializing face recognition:', error);
      }
    };

    initFaceRecognition();
  }, []);

  // ==================== API CALLS ====================

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/registro-cassaforte/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error('Error loading employees:', e);
    }
  };

  const loadPendingPayments = async (employeeId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/registro-cassaforte/pending-pickings?employee_id=${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setPendingPayments(data.pickings || []);
      }
    } catch (e) {
      console.error('Error loading pending payments:', e);
      toast.error('Errore nel caricamento degli incassi');
    } finally {
      setIsLoading(false);
    }
  };

  const startVideoRecording = async () => {
    try {
      const response = await fetch('/api/registro-cassaforte/video/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: currentEmployee?.id,
          employee_name: currentEmployee?.name,
          deposit_type: depositType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setVideoSessionId(data.session_id);
        if (!data.camera_offline) {
          toast.success('Registrazione video avviata');
        }
      }
    } catch (e) {
      console.error('Error starting video:', e);
    }
  };

  const stopVideoRecording = async () => {
    if (!videoSessionId) return;

    try {
      await fetch('/api/registro-cassaforte/video/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: videoSessionId,
        }),
      });
    } catch (e) {
      console.error('Error stopping video:', e);
    }
  };

  const recognizeFace = async (imageBase64: string) => {
    setIsScanningFace(true);
    try {
      if (!faceModelsLoaded) {
        toast.error('Modelli di riconoscimento non ancora caricati. Riprova.');
        return;
      }

      // Get face embedding using face-api.js (client-side)
      const embedding = await getFaceEmbeddingFromBase64(imageBase64);

      if (!embedding) {
        setLastScanResult('Nessun volto rilevato');
        toast.error('Nessun volto rilevato. Posiziona meglio il viso.');
        return;
      }

      console.log('Face embedding extracted, comparing with enrolled faces...');

      // Compare with enrolled faces
      if (enrolledFaces.length === 0) {
        setLastScanResult('Nessun volto registrato nel sistema');
        toast.error('Nessun volto registrato. Effettua la registrazione.');
        return;
      }

      const match = findBestMatch(embedding, enrolledFaces, 0.5);

      if (match) {
        // Employee recognized!
        const employee = employees.find(e => e.id === match.employee_id);
        if (employee) {
          setCurrentEmployee(employee);
          setShowFaceScanner(false);

          // Check if this employee is admin (paul@lapa.ch)
          if (employee.work_email === ADMIN_EMAIL) {
            setIsAdmin(true);
            toast.success(`Ciao ${employee.name}! (Admin) (${Math.round(match.similarity * 100)}% match)`);
          } else {
            toast.success(`Ciao ${employee.name}! (${Math.round(match.similarity * 100)}% match)`);
          }

          await loadPendingPayments(employee.id);
          setStep('select_type');
        }
      } else {
        setLastScanResult('Volto non riconosciuto');
        toast.error('Volto non riconosciuto. Seleziona manualmente.');
      }
    } catch (e) {
      console.error('Face recognition error:', e);
      toast.error('Errore nel riconoscimento facciale');
    } finally {
      setIsScanningFace(false);
    }
  };

  // Helper to check if serial number already exists
  const isSerialNumberDuplicate = (serialNumber: string): boolean => {
    if (!serialNumber) return false;
    return banknotes.some(b => b.serial_numbers.includes(serialNumber));
  };

  // Helper to validate serial number format (Swiss banknotes have 10 characters: 1 letter + 9 digits)
  const isValidSerialNumber = (serialNumber: string): boolean => {
    if (!serialNumber) return false;
    // Remove any spaces or special characters
    const cleaned = serialNumber.replace(/[^A-Za-z0-9]/g, '');
    // Swiss CHF banknotes have exactly 10 characters
    return cleaned.length === 10;
  };

  const recognizeBanknote = async (imageBase64: string) => {
    setIsScanningBanknote(true);
    setLastScanResult('Analisi in corso...');
    try {
      const formData = new FormData();
      const blob = await fetch(`data:image/jpeg;base64,${imageBase64}`).then(r => r.blob());
      formData.append('image', blob, 'banknote.jpg');

      const response = await fetch('/api/registro-cassaforte/recognize-banknote', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.denomination > 0) {
          const denomination = data.denomination;
          const serialNumber = data.serial_number;

          // MANDATORY: Serial number must be complete (10 characters for Swiss banknotes)
          if (!serialNumber || !isValidSerialNumber(serialNumber)) {
            const cleanedLength = serialNumber ? serialNumber.replace(/[^A-Za-z0-9]/g, '').length : 0;
            setLastScanResult(`⚠️ Numero di serie incompleto (${cleanedLength}/10). Riprova!`);
            toast.error('Inquadra meglio - numero di serie non completo');
            // Vibrate for warning
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
            return;
          }

          // Check for duplicate serial number
          if (isSerialNumberDuplicate(serialNumber)) {
            setLastScanResult(`⚠️ DUPLICATO! S/N: ${serialNumber} già registrato`);
            toast.error('Questa banconota è già stata scansionata!');
            // Vibrate longer for error
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100, 50, 100]);
            }
            return;
          }

          // Banknote recognized with valid serial number - add to count
          setBanknotes(prev => prev.map(b =>
            b.denomination === denomination
              ? {
                  ...b,
                  count: b.count + 1,
                  serial_numbers: [...b.serial_numbers, serialNumber]
                }
              : b
          ));

          // Show result with serial number
          setLastScanResult(`✓ ${denomination} CHF - S/N: ${serialNumber}`);

          // Vibrate for success
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
        } else {
          setLastScanResult('Banconota non riconosciuta. Riprova.');
        }
      } else {
        setLastScanResult('Errore. Riprova.');
      }
    } catch (e) {
      console.error('Banknote recognition error:', e);
      setLastScanResult('Errore di connessione');
    } finally {
      setIsScanningBanknote(false);
    }
  };

  const enrollFace = async (imageBase64: string) => {
    // Add image to enrollment collection
    const newImages = [...enrollmentImages, imageBase64];
    setEnrollmentImages(newImages);

    if (newImages.length < 3) {
      setLastScanResult(`Foto ${newImages.length}/3 - Continua...`);
      toast.success(`Foto ${newImages.length} salvata. Scatta altre ${3 - newImages.length}`);
      return;
    }

    // We have 3 images, proceed with enrollment using face-api.js
    setIsEnrolling(true);
    setLastScanResult('Analisi in corso...');

    try {
      if (!currentEmployee) {
        throw new Error('Dipendente non selezionato');
      }

      if (!faceModelsLoaded) {
        throw new Error('Modelli di riconoscimento non caricati');
      }

      // Extract face embedding from the best image (use the last one as it's likely the best)
      let bestEmbedding: Float32Array | null = null;

      for (const img of newImages) {
        const embedding = await getFaceEmbeddingFromBase64(img);
        if (embedding) {
          bestEmbedding = embedding;
          break; // Use the first valid embedding
        }
      }

      if (!bestEmbedding) {
        throw new Error('Nessun volto rilevato nelle foto. Riprova.');
      }

      // Save embedding to database
      const response = await fetch('/api/registro-cassaforte/face-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: currentEmployee.id,
          employee_name: currentEmployee.name,
          embedding: serializeEmbedding(bestEmbedding),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local enrolled faces list
        setEnrolledFaces(prev => [
          ...prev.filter(f => f.employee_id !== currentEmployee.id),
          {
            employee_id: currentEmployee.id,
            employee_name: currentEmployee.name,
            embedding: serializeEmbedding(bestEmbedding!),
          },
        ]);

        toast.success('Volto registrato con successo!');
        setShowEnrollScanner(false);
        setEnrollmentImages([]);
        // Proceed to deposit type selection
        await loadPendingPayments(currentEmployee.id);
        setStep('select_type');
      } else {
        throw new Error(data.error || 'Errore nel salvataggio');
      }
    } catch (e: any) {
      console.error('Enrollment error:', e);
      toast.error(e.message || 'Errore nella registrazione del volto');
      setEnrollmentImages([]);
      setLastScanResult('Errore - Riprova');
    } finally {
      setIsEnrolling(false);
    }
  };

  const confirmDeposit = async () => {
    if (!currentEmployee) return;

    setIsLoading(true);
    try {
      const total = calculateTotal();
      const expectedAmount = selectedPayments.length > 0
        ? pendingPayments
            .filter(p => selectedPayments.includes(p.picking_id))
            .reduce((sum, p) => sum + p.amount, 0)
        : undefined;

      const response = await fetch('/api/registro-cassaforte/confirm-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: currentEmployee.id,
          employee_name: currentEmployee.name,
          type: depositType,
          picking_ids: selectedPayments.length > 0 ? selectedPayments : undefined,
          customer_name: depositType === 'extra' ? extraCustomerName : undefined,
          expected_amount: expectedAmount,
          amount: total,
          banknotes: banknotes.filter(b => b.count > 0),
          coins: coins.filter(c => c.count > 0),
        }),
      });

      // Stop video recording
      await stopVideoRecording();

      if (response.ok) {
        setStep('success');
        toast.success('Versamento registrato con successo!');
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Errore nel salvataggio');
      }
    } catch (e: any) {
      console.error('Error confirming deposit:', e);
      toast.error(e.message || 'Errore nel salvataggio del versamento');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== HELPERS ====================

  const calculateBanknotesTotal = (): number => {
    return banknotes.reduce((sum, b) => sum + (b.denomination * b.count), 0);
  };

  const calculateCoinsTotal = (): number => {
    return coins.reduce((sum, c) => sum + (c.denomination * c.count), 0);
  };

  const calculateTotal = (): number => {
    return calculateBanknotesTotal() + calculateCoinsTotal();
  };

  const calculateExpectedTotal = (): number => {
    return pendingPayments
      .filter(p => selectedPayments.includes(p.picking_id))
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const resetSession = () => {
    setStep('idle');
    setCurrentEmployee(null);
    setSelectedEmployeeId(null);
    setPendingPayments([]);
    setSelectedPayments([]);
    setExtraCustomerName('');
    setBanknotes(BANKNOTE_DENOMINATIONS.map(d => ({ denomination: d, count: 0, serial_numbers: [] })));
    setCoins(COIN_DENOMINATIONS.map(d => ({ denomination: d, count: 0 })));
    setDepositType('from_delivery');
    setError(null);
    setVideoSessionId(null);
    setLastScanResult(undefined);
  };

  const updateCoinCount = (denomination: number, delta: number) => {
    setCoins(prev => prev.map(c =>
      c.denomination === denomination
        ? { ...c, count: Math.max(0, c.count + delta) }
        : c
    ));
  };

  const handleStartDeposit = () => {
    // Try face recognition first
    setShowFaceScanner(true);
  };

  const handleSkipFaceRecognition = () => {
    setShowFaceScanner(false);
    // Non permettere accesso diretto alla selezione - deve prima registrarsi
    toast.error('Per versare soldi devi prima registrarti con il riconoscimento facciale');
    setStep('idle');
  };

  const handleStartRegistration = () => {
    // Va direttamente alla selezione dipendente per registrazione volto
    setStep('enrollment');
  };

  const handleSelectEmployee = async (employee: Employee) => {
    setCurrentEmployee(employee);
    setSelectedEmployeeId(employee.id);
    // Show face enrollment step
    setStep('face_enroll');
  };

  const handleSkipEnrollment = async () => {
    if (!currentEmployee) return;
    await loadPendingPayments(currentEmployee.id);
    setStep('select_type');
  };

  const handleStartEnrollment = () => {
    setEnrollmentImages([]);
    setLastScanResult(undefined);
    setShowEnrollScanner(true);
  };

  const handleSelectType = (type: 'from_delivery' | 'extra') => {
    setDepositType(type);
    if (type === 'from_delivery') {
      setStep('select_pickings');
    } else {
      setStep('extra_input');
    }
  };

  const handleProceedToCounting = async () => {
    if (depositType === 'extra' && !extraCustomerName.trim()) {
      toast.error('Inserisci il nome del cliente');
      return;
    }
    // Show loading state while starting video recording
    setIsLoading(true);
    try {
      // Start video recording
      await startVideoRecording();
      setStep('counting');
    } catch (error) {
      console.error('Errore avvio registrazione:', error);
      toast.error('Errore durante l\'avvio della registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    setStep('confirm');
  };

  const handleOpenBanknoteScanner = () => {
    setShowBanknoteScanner(true);
    setLastScanResult(undefined);
  };

  // ==================== RENDER FUNCTIONS ====================

  // Idle Screen
  const renderIdleScreen = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-screen p-8"
    >
      {/* Logo and Time */}
      <div className="text-center mb-12">
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-8xl mb-6"
        >
          🔐
        </motion.div>
        <h1 className="text-4xl font-bold text-white mb-4">Registro Cassaforte</h1>
        <div className="text-6xl font-mono text-white/90 mb-2">
          {currentTime ? formatTime(currentTime) : '--:--:--'}
        </div>
        <div className="text-xl text-white/60">
          {currentTime ? currentTime.toLocaleDateString('it-CH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }) : '---'}
        </div>
      </div>

      {/* Start Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Versa Soldi - per utenti già registrati */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStartDeposit}
          className="px-12 py-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white text-2xl font-bold shadow-2xl shadow-emerald-500/30"
        >
          <div className="flex items-center gap-4">
            <Lock className="w-10 h-10" />
            VERSA SOLDI
          </div>
        </motion.button>

        {/* Registrati - per nuovi utenti */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStartRegistration}
          className="px-12 py-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-white text-2xl font-bold shadow-2xl shadow-cyan-500/30"
        >
          <div className="flex items-center gap-4">
            <UserCheck className="w-10 h-10" />
            REGISTRATI
          </div>
        </motion.button>
      </div>

    </motion.div>
  );

  // Employee Selection (Enrollment)
  // Filter out employees who already have face enrolled (they must use face recognition)
  // EXCEPTION: Admin (paul@lapa.ch recognized by face) can see ALL employees to re-enroll anyone
  const availableEmployees = employees.filter(emp => {
    const hasEnrolledFace = enrolledFaces.some(face => face.employee_id === emp.id);

    // Admin can see ALL employees (to re-enroll anyone)
    if (isAdmin) {
      return true;
    }
    // Normal users can only see employees without enrolled face
    return !hasEnrolledFace;
  });

  const renderEnrollmentScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={resetSession}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Chi sei?</h1>
          <p className="text-white/60">Seleziona il tuo nome dalla lista</p>
        </div>
      </div>

      {/* Employee List - only show employees without face enrolled (or all for admin) */}
      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        {availableEmployees.map((employee) => {
          const hasEnrolledFace = enrolledFaces.some(face => face.employee_id === employee.id);
          const isReEnrolling = isAdmin && hasEnrolledFace;

          return (
            <motion.button
              key={employee.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectEmployee(employee)}
              className={`p-6 backdrop-blur-lg rounded-2xl border transition-all text-left ${
                isReEnrolling
                  ? 'bg-amber-500/20 border-amber-400/40 hover:bg-amber-500/30'
                  : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  isReEnrolling
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : hasEnrolledFace
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {isReEnrolling ? (
                    <RefreshCw className="w-7 h-7 text-white" />
                  ) : hasEnrolledFace ? (
                    <UserCheck className="w-7 h-7 text-white" />
                  ) : (
                    <User className="w-7 h-7 text-white" />
                  )}
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">{employee.name}</div>
                  <div className="text-sm text-white/60">
                    {employee.department_id?.[1] || 'Dipendente'}
                    {isReEnrolling && (
                      <span className="ml-2 text-amber-400">• Ri-registra volto</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {availableEmployees.length === 0 && employees.length > 0 && (
        <div className="text-center py-12">
          <UserCheck className="w-16 h-16 text-emerald-400/40 mx-auto mb-4" />
          <p className="text-white/60 text-lg">Tutti i dipendenti hanno già registrato il volto</p>
          <p className="text-white/40 mt-2">Usa il riconoscimento facciale per accedere</p>
        </div>
      )}

      {employees.length === 0 && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-white/40 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Caricamento dipendenti...</p>
        </div>
      )}
    </motion.div>
  );

  // Face Enrollment Screen
  const renderFaceEnrollScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setStep('enrollment')}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Ciao, {currentEmployee?.name}!</h1>
          <p className="text-white/60">Vuoi registrare il tuo volto?</p>
        </div>
      </div>

      {/* Enrollment Options */}
      <div className="max-w-2xl mx-auto mt-8">
        <div className="text-center mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Camera className="w-16 h-16 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Registrazione Volto</h2>
          <p className="text-white/60 max-w-md mx-auto">
            Registra il tuo volto per accedere automaticamente la prossima volta senza selezionare il nome dalla lista.
          </p>
        </div>

        <div className="space-y-4">
          {/* Enroll Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartEnrollment}
            className="w-full p-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-white text-xl font-bold shadow-xl shadow-cyan-500/20"
          >
            <div className="flex items-center justify-center gap-3">
              <Camera className="w-7 h-7" />
              Registra il mio volto
            </div>
          </motion.button>
        </div>

        <p className="text-center text-white/40 text-sm mt-6">
          Serviranno 3 foto del tuo volto da diverse angolazioni
        </p>
      </div>
    </motion.div>
  );

  // Select Type Screen
  const renderSelectTypeScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setStep('enrollment')}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Ciao, {currentEmployee?.name}!</h1>
          <p className="text-white/60">Cosa vuoi fare?</p>
        </div>
      </div>

      {/* Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mt-12">
        {/* From Delivery */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelectType('from_delivery')}
          className="p-8 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-3xl border border-blue-400/30 hover:border-blue-400/50 transition-all"
        >
          <Package className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Versa Incassi</h2>
          <p className="text-white/60">Soldi dalle consegne</p>
          {pendingPayments.length > 0 && (
            <div className="mt-4 px-4 py-2 bg-blue-500/30 rounded-full inline-block">
              <span className="text-blue-200 font-semibold">{pendingPayments.length} da versare</span>
            </div>
          )}
        </motion.button>

        {/* Extra */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelectType('extra')}
          className="p-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-3xl border border-purple-400/30 hover:border-purple-400/50 transition-all"
        >
          <CreditCard className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Versa Extra</h2>
          <p className="text-white/60">Altri soldi (non da consegne)</p>
        </motion.button>
      </div>

      {/* Admin Button - only visible when logged in as admin */}
      {isAdmin && (
        <div className="max-w-3xl mx-auto mt-8">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/registro-cassaforte/admin')}
            className="w-full p-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 rounded-2xl text-amber-400 font-medium transition-colors"
          >
            <div className="flex items-center justify-center gap-3">
              <Shield className="w-6 h-6" />
              <span className="text-lg">Gestione Admin - Volti Dipendenti</span>
            </div>
          </motion.button>
        </div>
      )}
    </motion.div>
  );

  // Select Pickings Screen
  const renderSelectPickingsScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep('select_type')}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Seleziona Incassi</h1>
            <p className="text-white/60">Scegli quali incassi stai versando</p>
          </div>
        </div>

        {selectedPayments.length > 0 && (
          <button
            onClick={handleProceedToCounting}
            disabled={isLoading}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-wait rounded-xl text-white font-semibold flex items-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Caricamento...
              </>
            ) : (
              <>
                Continua
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Payments List */}
      <div className="space-y-3 max-w-3xl mx-auto">
        {pendingPayments.map((payment) => (
          <motion.button
            key={payment.picking_id}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedPayments(prev =>
                prev.includes(payment.picking_id)
                  ? prev.filter(id => id !== payment.picking_id)
                  : [...prev, payment.picking_id]
              );
            }}
            className={`w-full p-5 rounded-2xl border transition-all text-left ${
              selectedPayments.includes(payment.picking_id)
                ? 'bg-emerald-500/20 border-emerald-400/50'
                : 'bg-white/10 border-white/20 hover:bg-white/15'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPayments.includes(payment.picking_id)
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-white/40'
                }`}>
                  {selectedPayments.includes(payment.picking_id) && (
                    <CheckCircle className="w-4 h-4 text-white" />
                  )}
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{payment.partner_name}</div>
                  <div className="text-sm text-white/60">{payment.picking_name} • {payment.date}</div>
                </div>
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {formatCurrency(payment.amount)}
              </div>
            </div>
          </motion.button>
        ))}

        {pendingPayments.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">Nessun incasso da versare</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-white/40 animate-spin mx-auto" />
          </div>
        )}
      </div>

      {/* Selected Total */}
      {selectedPayments.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6">
          <div className="max-w-3xl mx-auto p-4 bg-slate-800/90 backdrop-blur-lg rounded-2xl border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/60 text-sm">Totale selezionato</div>
                <div className="text-2xl font-bold text-white">{formatCurrency(calculateExpectedTotal())}</div>
              </div>
              <div className="text-white/60">
                {selectedPayments.length} incass{selectedPayments.length === 1 ? 'o' : 'i'}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );

  // Extra Input Screen
  const renderExtraInputScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setStep('select_type')}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Versamento Extra</h1>
          <p className="text-white/60">Inserisci i dettagli</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto mt-12">
        <div className="mb-8">
          <label className="block text-white/80 mb-3 text-lg">Nome Cliente</label>
          <input
            type="text"
            value={extraCustomerName}
            onChange={(e) => setExtraCustomerName(e.target.value)}
            placeholder="Es. Mario Rossi"
            className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-xl placeholder-white/40 focus:outline-none focus:border-white/40"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleProceedToCounting}
          disabled={!extraCustomerName.trim() || isLoading}
          className="w-full py-5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl text-white text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Caricamento...
            </>
          ) : (
            'Continua al Conteggio'
          )}
        </motion.button>
      </div>
    </motion.div>
  );

  // Counting Screen
  const renderCountingScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6 pb-40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep(depositType === 'extra' ? 'extra_input' : 'select_pickings')}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Conteggio Denaro</h1>
            <p className="text-white/60">
              {depositType === 'extra' ? extraCustomerName : `${selectedPayments.length} incassi selezionati`}
            </p>
          </div>
        </div>

        {/* Video Recording Indicator */}
        {videoSessionId && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 rounded-full">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-medium">REC</span>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banknotes */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Banknote className="w-7 h-7 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Banconote</h2>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenBanknoteScanner}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl text-emerald-400 font-medium flex items-center gap-2 transition-colors"
            >
              <ScanLine className="w-5 h-5" />
              Scanner
            </motion.button>
          </div>

          <div className="space-y-3">
            {banknotes.map((b) => (
              <div key={b.denomination} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-5 rounded bg-gradient-to-r ${BANKNOTE_COLORS[b.denomination]}`} />
                  <span className="text-lg text-white font-medium">{b.denomination} CHF</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-center text-2xl font-bold text-white">{b.count}</span>
                  <span className="w-24 text-right text-white/60">
                    {formatCurrency(b.denomination * b.count)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
            <span className="text-white/60">Subtotale Banconote</span>
            <span className="text-xl font-bold text-emerald-400">{formatCurrency(calculateBanknotesTotal())}</span>
          </div>
        </div>

        {/* Coins */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <Coins className="w-7 h-7 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Monete</h2>
          </div>

          <div className="space-y-3">
            {coins.map((c) => (
              <div key={c.denomination} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg text-white font-medium">
                  {c.denomination >= 1 ? `${c.denomination} CHF` : `${c.denomination * 100} ct`}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateCoinCount(c.denomination, -1)}
                    className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-5 h-5 text-red-400" />
                  </button>
                  <span className="w-12 text-center text-2xl font-bold text-white">{c.count}</span>
                  <button
                    onClick={() => updateCoinCount(c.denomination, 1)}
                    className="w-10 h-10 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-5 h-5 text-emerald-400" />
                  </button>
                  <span className="w-24 text-right text-white/60">
                    {formatCurrency(c.denomination * c.count)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
            <span className="text-white/60">Subtotale Monete</span>
            <span className="text-xl font-bold text-yellow-400">{formatCurrency(calculateCoinsTotal())}</span>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-900/95 backdrop-blur-lg border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-white/60 text-sm">Totale da versare</div>
              <div className="text-4xl font-bold text-white">{formatCurrency(calculateTotal())}</div>
            </div>
            {depositType === 'from_delivery' && selectedPayments.length > 0 && (
              <div className="text-right">
                <div className="text-white/60 text-sm">Importo atteso</div>
                <div className="text-2xl font-semibold text-white/80">{formatCurrency(calculateExpectedTotal())}</div>
                {calculateTotal() !== calculateExpectedTotal() && (
                  <div className={`text-sm font-medium ${calculateTotal() > calculateExpectedTotal() ? 'text-emerald-400' : 'text-amber-400'}`}>
                    Differenza: {calculateTotal() > calculateExpectedTotal() ? '+' : ''}{formatCurrency(calculateTotal() - calculateExpectedTotal())}
                  </div>
                )}
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirm}
            disabled={calculateTotal() === 0}
            className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Conferma Versamento
          </motion.button>
        </div>
      </div>
    </motion.div>
  );

  // Confirm Screen
  const renderConfirmScreen = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen p-6 flex items-center justify-center"
    >
      <div className="max-w-lg w-full bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Conferma Versamento</h2>
          <p className="text-white/60">Stai per registrare questo versamento</p>
        </div>

        {/* Summary */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between py-3 border-b border-white/10">
            <span className="text-white/60">Dipendente</span>
            <span className="text-white font-medium">{currentEmployee?.name}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-white/10">
            <span className="text-white/60">Tipo</span>
            <span className="text-white font-medium">
              {depositType === 'from_delivery' ? 'Da consegne' : 'Extra'}
            </span>
          </div>
          {depositType === 'extra' && (
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-white/60">Cliente</span>
              <span className="text-white font-medium">{extraCustomerName}</span>
            </div>
          )}
          {depositType === 'from_delivery' && (
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-white/60">Incassi</span>
              <span className="text-white font-medium">{selectedPayments.length} selezionati</span>
            </div>
          )}
          <div className="flex justify-between py-3">
            <span className="text-white/60">Importo</span>
            <span className="text-3xl font-bold text-emerald-400">{formatCurrency(calculateTotal())}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => setStep('counting')}
            className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={confirmDeposit}
            disabled={isLoading}
            className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Conferma
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );

  // Success Screen
  const renderSuccessScreen = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen p-6 flex items-center justify-center"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle className="w-16 h-16 text-emerald-400" />
        </motion.div>

        <h1 className="text-4xl font-bold text-white mb-4">Versamento Completato!</h1>
        <p className="text-xl text-white/60 mb-2">{currentEmployee?.name}</p>
        <p className="text-5xl font-bold text-emerald-400 mb-8">{formatCurrency(calculateTotal())}</p>

        <p className="text-white/40 mb-8">Ritorno automatico tra 10 secondi...</p>

        <button
          onClick={resetSession}
          className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
        >
          Nuovo Versamento
        </button>
      </div>
    </motion.div>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AnimatePresence mode="wait">
        {step === 'idle' && renderIdleScreen()}
        {step === 'enrollment' && renderEnrollmentScreen()}
        {step === 'face_enroll' && renderFaceEnrollScreen()}
        {step === 'select_type' && renderSelectTypeScreen()}
        {step === 'select_pickings' && renderSelectPickingsScreen()}
        {step === 'extra_input' && renderExtraInputScreen()}
        {step === 'counting' && renderCountingScreen()}
        {step === 'confirm' && renderConfirmScreen()}
        {step === 'success' && renderSuccessScreen()}
      </AnimatePresence>

      {/* Face Scanner Overlay */}
      {showFaceScanner && (
        <div className="fixed inset-0 z-50">
          <CameraScanner
            mode="face"
            onCapture={recognizeFace}
            onClose={handleSkipFaceRecognition}
            isProcessing={isScanningFace}
            lastResult={lastScanResult}
          />
          {/* Skip button */}
          <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10">
            <button
              onClick={handleSkipFaceRecognition}
              className="px-6 py-3 bg-white/20 backdrop-blur rounded-xl text-white font-medium"
            >
              Salta e seleziona manualmente
            </button>
          </div>
        </div>
      )}

      {/* Banknote Scanner Overlay */}
      {showBanknoteScanner && (
        <CameraScanner
          mode="banknote"
          onCapture={recognizeBanknote}
          onClose={() => {
            setShowBanknoteScanner(false);
            setLastScanResult(undefined);
          }}
          onFinish={() => {
            setShowBanknoteScanner(false);
            setLastScanResult(undefined);
            setShowConfirmDialog(true);
          }}
          isProcessing={isScanningBanknote}
          lastResult={lastScanResult}
          currentTotal={calculateTotal()}
          expectedTotal={depositType === 'from_delivery' ? calculateExpectedTotal() : undefined}
        />
      )}

      {/* Face Enrollment Scanner Overlay */}
      {showEnrollScanner && (
        <div className="fixed inset-0 z-50">
          <CameraScanner
            mode="face"
            onCapture={enrollFace}
            onClose={() => {
              setShowEnrollScanner(false);
              setEnrollmentImages([]);
              setLastScanResult(undefined);
            }}
            isProcessing={isEnrolling}
            lastResult={lastScanResult || `Foto ${enrollmentImages.length}/3`}
          />
          {/* Progress indicator */}
          <div className="absolute top-20 left-0 right-0 flex justify-center z-10">
            <div className="px-6 py-3 bg-black/70 backdrop-blur rounded-xl">
              <div className="flex items-center gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full ${
                      i < enrollmentImages.length
                        ? 'bg-emerald-500'
                        : 'bg-white/30'
                    }`}
                  />
                ))}
                <span className="text-white ml-2">
                  {enrollmentImages.length}/3 foto
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* First Confirmation Dialog - Responsibility */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-800 rounded-3xl p-8 max-w-lg w-full border border-white/20"
          >
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Conferma Responsabilità</h2>
              <p className="text-white/70">
                Stai per confermare il versamento di:
              </p>
              <p className="text-4xl font-bold text-emerald-400 my-4">
                {formatCurrency(calculateTotal())}
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6">
              <p className="text-amber-300 text-sm leading-relaxed">
                <strong>DICHIARAZIONE DI RESPONSABILITÀ:</strong><br />
                Confermo di aver inserito personalmente i soldi nella cassaforte e mi assumo
                la piena responsabilità della correttezza dell'importo dichiarato.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setShowFinalConfirmDialog(true);
                }}
                className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                Accetto e Confermo
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Second Confirmation Dialog - Final Check */}
      {showFinalConfirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-800 rounded-3xl p-8 max-w-lg w-full border border-white/20"
          >
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Sei Sicuro?</h2>
              <p className="text-white/70 text-lg">
                Hai davvero messo <span className="text-emerald-400 font-bold">{formatCurrency(calculateTotal())}</span> nella cassaforte?
              </p>
            </div>

            <div className="bg-slate-700/50 rounded-2xl p-4 mb-6">
              <div className="text-white/60 text-sm mb-2">Riepilogo banconote:</div>
              <div className="space-y-1">
                {banknotes.filter(b => b.count > 0).map(b => (
                  <div key={b.denomination} className="flex justify-between text-white">
                    <span>{b.count}x {b.denomination} CHF</span>
                    <span className="text-white/60">{formatCurrency(b.count * b.denomination)}</span>
                  </div>
                ))}
                {coins.filter(c => c.count > 0).map(c => (
                  <div key={c.denomination} className="flex justify-between text-white">
                    <span>{c.count}x {c.denomination} CHF</span>
                    <span className="text-white/60">{formatCurrency(c.count * c.denomination)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowFinalConfirmDialog(false);
                  setShowConfirmDialog(true);
                }}
                className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
              >
                Indietro
              </button>
              <button
                onClick={() => {
                  setShowFinalConfirmDialog(false);
                  // Proceed to confirm step
                  setStep('confirm');
                }}
                className="flex-1 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
              >
                SÌ, CONFERMO
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
