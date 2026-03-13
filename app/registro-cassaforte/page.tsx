'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  loadModels,
  getFaceEmbeddingFromBase64,
  findBestMatch,
  serializeEmbedding,
} from '@/lib/face-recognition';
import { calculateTotal, isSerialNumberDuplicate, isValidSerialNumber } from '@/lib/registro-cassaforte/helpers';
import { BANKNOTE_DENOMINATIONS, COIN_DENOMINATIONS, ADMIN_EMAIL, SUCCESS_TIMEOUT_MS } from '@/lib/registro-cassaforte/constants';
import type { Employee, PendingPayment, BanknoteCount, CoinCount, EnrolledFace, AppStep } from '@/lib/registro-cassaforte/types';

// Components
import CameraScanner from './components/CameraScanner';
import IdleScreen from './components/IdleScreen';
import EnrollmentScreen from './components/EnrollmentScreen';
import FaceEnrollScreen from './components/FaceEnrollScreen';
import SelectTypeScreen from './components/SelectTypeScreen';
import SelectPickingsScreen from './components/SelectPickingsScreen';
import ExtraInputScreen from './components/ExtraInputScreen';
import CountingScreen from './components/CountingScreen';
import ConfirmScreen from './components/ConfirmScreen';
import SuccessScreen from './components/SuccessScreen';
import { ResponsibilityDialog, FinalConfirmDialog } from './components/ConfirmDialogs';

// API key for authenticated requests (set via env)
const API_KEY = process.env.NEXT_PUBLIC_CASSAFORTE_API_KEY || '';

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (API_KEY) headers['x-cassaforte-key'] = API_KEY;
  return headers;
}

function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = { ...getApiHeaders(), ...(options?.headers || {}) };
  return fetch(url, { ...options, headers });
}

export default function RegistroCassafortePage() {
  // App state
  const [step, setStep] = useState<AppStep>('idle');
  const [isAdmin, setIsAdmin] = useState(false);

  // Employee state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  // Payments state
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);
  const [extraCustomerName, setExtraCustomerName] = useState('');
  const [depositType, setDepositType] = useState<'from_delivery' | 'extra'>('from_delivery');

  // Counting state
  const [banknotes, setBanknotes] = useState<BanknoteCount[]>(
    BANKNOTE_DENOMINATIONS.map(d => ({ denomination: d, count: 0, serial_numbers: [] }))
  );
  const [coins, setCoins] = useState<CoinCount[]>(
    COIN_DENOMINATIONS.map(d => ({ denomination: d, count: 0 }))
  );

  // Photo confirmation
  const [confirmationPhoto, setConfirmationPhoto] = useState<string | null>(null);
  const [showPhotoCamera, setShowPhotoCamera] = useState(false);

  // UI state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Camera/scanner state
  const [showFaceScanner, setShowFaceScanner] = useState(false);
  const [showBanknoteScanner, setShowBanknoteScanner] = useState(false);
  const [showEnrollScanner, setShowEnrollScanner] = useState(false);
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [isScanningBanknote, setIsScanningBanknote] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | undefined>();
  const [enrollmentImages, setEnrollmentImages] = useState<string[]>([]);

  // Confirmation dialogs
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showFinalConfirmDialog, setShowFinalConfirmDialog] = useState(false);

  // Face recognition
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [enrolledFaces, setEnrolledFaces] = useState<EnrolledFace[]>([]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Screen orientation - allow rotation on tablet
  useEffect(() => {
    const unlockOrientation = async () => {
      try {
        // @ts-ignore
        if (screen.orientation?.unlock) await screen.orientation.unlock();
      } catch { /* not supported */ }
    };
    unlockOrientation();
    return () => {
      try {
        // @ts-ignore
        screen.orientation?.lock?.('portrait-primary')?.catch?.(() => {});
      } catch { /* ignore */ }
    };
  }, []);

  // Auto-return to idle after success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(resetSession, SUCCESS_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  // Load employees on mount
  useEffect(() => { loadEmployees(); }, []);

  // Load face models and enrolled faces
  useEffect(() => {
    const init = async () => {
      try {
        const loaded = await loadModels();
        setFaceModelsLoaded(loaded);
        const response = await apiFetch('/api/registro-cassaforte/face-embeddings');
        if (response.ok) {
          const data = await response.json();
          setEnrolledFaces(data.embeddings || []);
        }
      } catch (error) {
        console.error('Error initializing face recognition:', error);
      }
    };
    init();
  }, []);

  // ==================== API CALLS ====================

  const loadEmployees = async () => {
    try {
      const response = await apiFetch('/api/registro-cassaforte/employees');
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
      const response = await apiFetch(`/api/registro-cassaforte/pending-pickings?employee_id=${employeeId}`);
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

  // ==================== FACE RECOGNITION ====================

  const recognizeFace = async (imageBase64: string) => {
    setIsScanningFace(true);
    try {
      if (!faceModelsLoaded) {
        toast.error('Modelli di riconoscimento non ancora caricati. Riprova.');
        return;
      }

      const embedding = await getFaceEmbeddingFromBase64(imageBase64);
      if (!embedding) {
        setLastScanResult('Nessun volto rilevato');
        toast.error('Nessun volto rilevato. Posiziona meglio il viso.');
        return;
      }

      if (enrolledFaces.length === 0) {
        setLastScanResult('Nessun volto registrato nel sistema');
        toast.error('Nessun volto registrato. Effettua la registrazione.');
        return;
      }

      const match = findBestMatch(embedding, enrolledFaces, 0.5);
      if (match) {
        const employee = employees.find(e => e.id === match.employee_id);
        if (employee) {
          setCurrentEmployee(employee);
          setShowFaceScanner(false);

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

  // ==================== BANKNOTE RECOGNITION ====================

  const recognizeBanknote = async (imageBase64: string) => {
    setIsScanningBanknote(true);
    setLastScanResult('Analisi in corso...');
    try {
      const blob = await fetch(`data:image/jpeg;base64,${imageBase64}`).then(r => r.blob());
      const formData = new FormData();
      formData.append('image', blob, 'banknote.jpg');

      const response = await fetch('/api/registro-cassaforte/recognize-banknote', {
        method: 'POST',
        headers: getApiHeaders(),
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.denomination > 0) {
          const { denomination, serial_number: serialNumber } = data;

          if (!serialNumber || !isValidSerialNumber(serialNumber)) {
            const len = serialNumber ? serialNumber.replace(/[^A-Za-z0-9]/g, '').length : 0;
            setLastScanResult(`⚠️ Numero di serie incompleto (${len}/10). Riprova!`);
            toast.error('Inquadra meglio - numero di serie non completo');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            return;
          }

          if (isSerialNumberDuplicate(serialNumber, banknotes)) {
            setLastScanResult(`⚠️ DUPLICATO! S/N: ${serialNumber} già registrato`);
            toast.error('Questa banconota è già stata scansionata!');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
            return;
          }

          setBanknotes(prev => prev.map(b =>
            b.denomination === denomination
              ? { ...b, count: b.count + 1, serial_numbers: [...b.serial_numbers, serialNumber] }
              : b
          ));
          setLastScanResult(`✓ ${denomination} CHF - S/N: ${serialNumber}`);
          if (navigator.vibrate) navigator.vibrate(200);
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

  // ==================== ENROLLMENT (average of 3 embeddings) ====================

  const enrollFace = async (imageBase64: string) => {
    const newImages = [...enrollmentImages, imageBase64];
    setEnrollmentImages(newImages);

    if (newImages.length < 3) {
      setLastScanResult(`Foto ${newImages.length}/3 - Continua...`);
      toast.success(`Foto ${newImages.length} salvata. Scatta altre ${3 - newImages.length}`);
      return;
    }

    setIsEnrolling(true);
    setLastScanResult('Analisi in corso...');

    try {
      if (!currentEmployee) throw new Error('Dipendente non selezionato');
      if (!faceModelsLoaded) throw new Error('Modelli di riconoscimento non caricati');

      const validEmbeddings: Float32Array[] = [];
      for (const img of newImages) {
        const emb = await getFaceEmbeddingFromBase64(img);
        if (emb) validEmbeddings.push(emb);
      }

      if (validEmbeddings.length === 0) {
        throw new Error('Nessun volto rilevato nelle foto. Riprova.');
      }

      // Average embeddings for more robust recognition
      let averageEmbedding: Float32Array;
      if (validEmbeddings.length === 1) {
        averageEmbedding = validEmbeddings[0];
      } else {
        averageEmbedding = new Float32Array(128);
        for (const emb of validEmbeddings) {
          for (let i = 0; i < 128; i++) averageEmbedding[i] += emb[i];
        }
        for (let i = 0; i < 128; i++) averageEmbedding[i] /= validEmbeddings.length;
      }

      const response = await apiFetch('/api/registro-cassaforte/face-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
        body: JSON.stringify({
          employee_id: currentEmployee.id,
          employee_name: currentEmployee.name,
          embedding: serializeEmbedding(averageEmbedding),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setEnrolledFaces(prev => [
          ...prev.filter(f => f.employee_id !== currentEmployee.id),
          {
            employee_id: currentEmployee.id,
            employee_name: currentEmployee.name,
            embedding: serializeEmbedding(averageEmbedding),
          },
        ]);
        toast.success('Volto registrato con successo!');
        setShowEnrollScanner(false);
        setEnrollmentImages([]);
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

  // ==================== DEPOSIT CONFIRMATION ====================

  const confirmDeposit = async () => {
    if (!currentEmployee) {
      toast.error('Sessione scaduta - riprova');
      resetSession();
      return;
    }

    setIsLoading(true);
    try {
      const tot = calculateTotal(banknotes, coins);
      if (tot <= 0) {
        toast.error('Importo non valido - inserisci almeno una banconota o moneta');
        setIsLoading(false);
        return;
      }

      const expectedAmount = selectedPayments.length > 0
        ? pendingPayments
            .filter(p => selectedPayments.includes(p.picking_id))
            .reduce((sum, p) => sum + p.amount, 0)
        : undefined;

      const response = await apiFetch('/api/registro-cassaforte/confirm-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
        body: JSON.stringify({
          employee_id: currentEmployee.id,
          employee_name: currentEmployee.name,
          type: depositType,
          picking_ids: selectedPayments.length > 0 ? selectedPayments : undefined,
          customer_name: depositType === 'extra' ? extraCustomerName : undefined,
          expected_amount: expectedAmount,
          amount: tot,
          banknotes: banknotes.filter(b => b.count > 0),
          coins: coins.filter(c => c.count > 0),
          photo_base64: confirmationPhoto || undefined,
        }),
      });

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

  // ==================== COMPUTED VALUES ====================

  const total = calculateTotal(banknotes, coins);

  const expectedTotal = pendingPayments
    .filter(p => selectedPayments.includes(p.picking_id))
    .reduce((sum, p) => sum + p.amount, 0);

  // ==================== HELPERS ====================

  const resetSession = () => {
    setStep('idle');
    setCurrentEmployee(null);
    setPendingPayments([]);
    setSelectedPayments([]);
    setExtraCustomerName('');
    setBanknotes(BANKNOTE_DENOMINATIONS.map(d => ({ denomination: d, count: 0, serial_numbers: [] })));
    setCoins(COIN_DENOMINATIONS.map(d => ({ denomination: d, count: 0 })));
    setDepositType('from_delivery');
    setLastScanResult(undefined);
    setConfirmationPhoto(null);
    setShowPhotoCamera(false);
    setIsAdmin(false);
  };

  const updateCoinCount = (denomination: number, delta: number) => {
    setCoins(prev => prev.map(c =>
      c.denomination === denomination ? { ...c, count: Math.max(0, c.count + delta) } : c
    ));
  };

  // ==================== HANDLERS ====================

  const handleStartDeposit = () => setShowFaceScanner(true);

  const handleSkipFaceRecognition = () => {
    setShowFaceScanner(false);
    toast.error('Per versare soldi devi prima registrarti con il riconoscimento facciale');
    setStep('idle');
  };

  const handleSelectEmployee = (employee: Employee) => {
    setCurrentEmployee(employee);
    setStep('face_enroll');
  };

  const handleStartEnrollment = () => {
    setEnrollmentImages([]);
    setLastScanResult(undefined);
    setShowEnrollScanner(true);
  };

  const handleSelectType = (type: 'from_delivery' | 'extra') => {
    setDepositType(type);
    setStep(type === 'from_delivery' ? 'select_pickings' : 'extra_input');
  };

  const handleProceedToCounting = () => {
    if (depositType === 'extra' && !extraCustomerName.trim()) {
      toast.error('Inserisci il nome del cliente');
      return;
    }
    setStep('counting');
  };

  const handleConfirm = () => {
    setConfirmationPhoto(null);
    setShowPhotoCamera(true);
  };

  const handlePhotoCaptured = (photoBase64: string) => {
    setConfirmationPhoto(photoBase64);
    setShowPhotoCamera(false);
    setStep('confirm');
  };

  const handleSkipPhoto = () => {
    setShowPhotoCamera(false);
    setStep('confirm');
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AnimatePresence mode="wait">
        {step === 'idle' && (
          <IdleScreen
            currentTime={currentTime}
            onDeposit={handleStartDeposit}
            onRegister={() => setStep('enrollment')}
          />
        )}
        {step === 'enrollment' && (
          <EnrollmentScreen
            employees={employees}
            enrolledFaces={enrolledFaces}
            isAdmin={isAdmin}
            onSelectEmployee={handleSelectEmployee}
            onBack={resetSession}
          />
        )}
        {step === 'face_enroll' && (
          <FaceEnrollScreen
            employee={currentEmployee}
            onStartEnrollment={handleStartEnrollment}
            onBack={() => setStep('enrollment')}
          />
        )}
        {step === 'select_type' && (
          <SelectTypeScreen
            employee={currentEmployee}
            pendingPayments={pendingPayments}
            isAdmin={isAdmin}
            onSelectType={handleSelectType}
            onBack={() => setStep('enrollment')}
          />
        )}
        {step === 'select_pickings' && (
          <SelectPickingsScreen
            pendingPayments={pendingPayments}
            selectedPayments={selectedPayments}
            isLoading={isLoading}
            expectedTotal={expectedTotal}
            onTogglePayment={(id) => setSelectedPayments(prev =>
              prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            )}
            onProceed={handleProceedToCounting}
            onBack={() => setStep('select_type')}
          />
        )}
        {step === 'extra_input' && (
          <ExtraInputScreen
            customerName={extraCustomerName}
            isLoading={isLoading}
            onCustomerNameChange={setExtraCustomerName}
            onProceed={handleProceedToCounting}
            onBack={() => setStep('select_type')}
          />
        )}
        {step === 'counting' && (
          <CountingScreen
            depositType={depositType}
            extraCustomerName={extraCustomerName}
            selectedPaymentsCount={selectedPayments.length}
            expectedTotal={expectedTotal}
            banknotes={banknotes}
            coins={coins}
            onOpenScanner={() => { setShowBanknoteScanner(true); setLastScanResult(undefined); }}
            onUpdateCoinCount={updateCoinCount}
            onConfirm={handleConfirm}
            onBack={() => setStep(depositType === 'extra' ? 'extra_input' : 'select_pickings')}
          />
        )}
        {step === 'confirm' && (
          <ConfirmScreen
            employee={currentEmployee}
            depositType={depositType}
            extraCustomerName={extraCustomerName}
            selectedPaymentsCount={selectedPayments.length}
            total={total}
            isLoading={isLoading}
            onConfirm={confirmDeposit}
            onBack={() => setStep('counting')}
          />
        )}
        {step === 'success' && (
          <SuccessScreen
            employee={currentEmployee}
            total={total}
            onNewDeposit={resetSession}
          />
        )}
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
          onClose={() => { setShowBanknoteScanner(false); setLastScanResult(undefined); }}
          onFinish={() => {
            setShowBanknoteScanner(false);
            setLastScanResult(undefined);
            setShowConfirmDialog(true);
          }}
          isProcessing={isScanningBanknote}
          lastResult={lastScanResult}
          currentTotal={total}
          expectedTotal={depositType === 'from_delivery' ? expectedTotal : undefined}
        />
      )}

      {/* Face Enrollment Scanner */}
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
          <div className="absolute top-20 left-0 right-0 flex justify-center z-10">
            <div className="px-6 py-3 bg-black/70 backdrop-blur rounded-xl">
              <div className="flex items-center gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full ${
                      i < enrollmentImages.length ? 'bg-emerald-500' : 'bg-white/30'
                    }`}
                  />
                ))}
                <span className="text-white ml-2">{enrollmentImages.length}/3 foto</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Capture for Confirmation */}
      {showPhotoCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          <CameraScanner
            mode="face"
            onCapture={handlePhotoCaptured}
            onClose={handleSkipPhoto}
            isProcessing={false}
            lastResult="Scatta una foto di conferma"
          />
          <div className="absolute top-8 left-0 right-0 flex flex-col items-center z-10">
            <div className="px-6 py-3 bg-black/70 backdrop-blur rounded-xl text-center">
              <Camera className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-white font-semibold">Foto di Conferma</p>
              <p className="text-white/70 text-sm">Scatta un selfie per confermare il versamento</p>
            </div>
          </div>
          <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10">
            <button onClick={handleSkipPhoto} className="px-6 py-3 bg-white/20 backdrop-blur rounded-xl text-white font-medium">
              Salta foto
            </button>
          </div>
        </div>
      )}

      {/* Responsibility Confirmation Dialog */}
      {showConfirmDialog && (
        <ResponsibilityDialog
          total={total}
          onCancel={() => setShowConfirmDialog(false)}
          onAccept={() => { setShowConfirmDialog(false); setShowFinalConfirmDialog(true); }}
        />
      )}

      {/* Final Confirmation Dialog */}
      {showFinalConfirmDialog && (
        <FinalConfirmDialog
          total={total}
          banknotes={banknotes}
          coins={coins}
          onBack={() => { setShowFinalConfirmDialog(false); setShowConfirmDialog(true); }}
          onConfirm={() => { setShowFinalConfirmDialog(false); setStep('confirm'); }}
        />
      )}
    </div>
  );
}
