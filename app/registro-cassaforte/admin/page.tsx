'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  UserCheck,
  Trash2,
  RefreshCw,
  Shield,
  Loader2,
  AlertTriangle,
  Camera,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  loadModels,
  getFaceEmbeddingFromBase64,
  findBestMatch,
} from '@/lib/face-recognition';

// Admin email - only this user can access admin
const ADMIN_EMAIL = 'paul@lapa.ch';

interface Employee {
  id: number;
  name: string;
  work_email: string;
  department_id?: [number, string];
}

interface FaceEmbedding {
  employee_id: number;
  employee_name: string;
  created_at: string;
}

export default function RegistroCassaforteAdminPage() {
  const router = useRouter();

  // Auth state
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showFaceScanner, setShowFaceScanner] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Face recognition state
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [enrolledFaces, setEnrolledFaces] = useState<Array<{ employee_id: number; employee_name: string; embedding: number[] }>>([]);

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [enrolledFacesData, setEnrolledFacesData] = useState<FaceEmbedding[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load face recognition models
  useEffect(() => {
    const initFaceRecognition = async () => {
      try {
        await loadModels();
        setFaceModelsLoaded(true);
        // Load enrolled faces for recognition
        await loadEnrolledFaces();
      } catch (error) {
        console.error('Failed to load face models:', error);
        toast.error('Errore nel caricamento dei modelli facciali');
      }
    };
    initFaceRecognition();
  }, []);

  const loadEnrolledFaces = async () => {
    try {
      const response = await fetch('/api/registro-cassaforte/face-embeddings');
      if (response.ok) {
        const data = await response.json();
        if (data.embeddings) {
          setEnrolledFaces(data.embeddings.map((e: any) => ({
            employee_id: e.employee_id,
            employee_name: e.employee_name,
            embedding: e.embedding,
          })));
        }
      }
    } catch (error) {
      console.error('Error loading enrolled faces:', error);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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
    if (showFaceScanner) {
      startCamera();
    } else {
      stopCamera();
    }
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
        // Find the employee
        const empResponse = await fetch('/api/registro-cassaforte/employees');
        if (empResponse.ok) {
          const empData = await empResponse.json();
          const employee = empData.employees?.find((e: Employee) => e.id === match.employee_id);

          if (employee && employee.work_email === ADMIN_EMAIL) {
            // Admin authenticated!
            setIsAuthorized(true);
            setShowFaceScanner(false);
            toast.success(`Benvenuto Admin, ${employee.name}!`);
            loadData();
          } else {
            setAuthError(`${match.employee_name} non è autorizzato come admin`);
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load employees
      const empResponse = await fetch('/api/registro-cassaforte/employees');
      if (empResponse.ok) {
        const empData = await empResponse.json();
        setEmployees(empData.employees || []);
      }

      // Load enrolled faces data
      const facesResponse = await fetch('/api/registro-cassaforte/face-embeddings');
      if (facesResponse.ok) {
        const facesData = await facesResponse.json();
        setEnrolledFacesData(facesData.embeddings || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFaceEnrollment = async (employeeId: number, employeeName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il riconoscimento facciale di ${employeeName}?`)) {
      return;
    }

    setDeletingId(employeeId);
    try {
      const response = await fetch(`/api/registro-cassaforte/face-embeddings?employee_id=${employeeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(`Riconoscimento facciale di ${employeeName} eliminato`);
        await loadData();
        await loadEnrolledFaces(); // Refresh enrolled faces for recognition
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Errore nella cancellazione');
      }
    } catch (error: any) {
      console.error('Error deleting face:', error);
      toast.error(error.message || 'Errore nella cancellazione');
    } finally {
      setDeletingId(null);
    }
  };

  const isEnrolled = (employeeId: number) => {
    return enrolledFacesData.some(f => f.employee_id === employeeId);
  };

  const getEnrollmentDate = (employeeId: number) => {
    const face = enrolledFacesData.find(f => f.employee_id === employeeId);
    if (face?.created_at) {
      return new Date(face.created_at).toLocaleDateString('it-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return null;
  };

  // Not authorized yet - show face scanner
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Accesso Admin</h1>
            <p className="text-white/60">
              Verifica la tua identità con il riconoscimento facciale
            </p>
          </div>

          {!showFaceScanner ? (
            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFaceScanner(true)}
                disabled={!faceModelsLoaded}
                className="w-full p-6 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl text-white text-xl font-bold shadow-xl disabled:opacity-50"
              >
                <div className="flex items-center justify-center gap-3">
                  {faceModelsLoaded ? (
                    <>
                      <Camera className="w-7 h-7" />
                      Verifica Identità
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      Caricamento modelli...
                    </>
                  )}
                </div>
              </motion.button>

              <button
                onClick={() => router.push('/registro-cassaforte')}
                className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-medium transition-colors"
              >
                <div className="flex items-center justify-center gap-2">
                  <ArrowLeft className="w-5 h-5" />
                  Torna Indietro
                </div>
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Camera view */}
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Close button */}
                <button
                  onClick={() => setShowFaceScanner(false)}
                  className="absolute top-3 right-3 p-2 bg-black/50 rounded-full"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* Face guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-amber-400/50 rounded-full" />
                </div>

                {/* Error message */}
                {authError && (
                  <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-500/90 rounded-xl">
                    <p className="text-white text-center font-medium">{authError}</p>
                  </div>
                )}
              </div>

              {/* Capture button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={captureAndRecognize}
                disabled={isAuthenticating}
                className="w-full mt-4 p-4 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white font-bold transition-colors disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifica in corso...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Camera className="w-5 h-5" />
                    Scatta e Verifica
                  </div>
                )}
              </motion.button>
            </div>
          )}

          <p className="text-center text-white/40 text-sm mt-6">
            Solo paul@lapa.ch può accedere a questa pagina
          </p>
        </div>
      </div>
    );
  }

  // Authorized - show admin panel
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/registro-cassaforte')}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-400" />
              <h1 className="text-2xl font-bold text-white">Admin - Gestione Volti</h1>
            </div>
            <p className="text-white/60">Gestisci i riconoscimenti facciali dei dipendenti</p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <RefreshCw className={`w-6 h-6 text-white ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
        <div className="p-4 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
          <div className="text-3xl font-bold text-white">{employees.length}</div>
          <div className="text-white/60 text-sm">Dipendenti totali</div>
        </div>
        <div className="p-4 bg-emerald-500/20 backdrop-blur-lg rounded-2xl border border-emerald-400/30">
          <div className="text-3xl font-bold text-emerald-400">{enrolledFacesData.length}</div>
          <div className="text-emerald-300/60 text-sm">Volti registrati</div>
        </div>
        <div className="p-4 bg-amber-500/20 backdrop-blur-lg rounded-2xl border border-amber-400/30">
          <div className="text-3xl font-bold text-amber-400">{employees.length - enrolledFacesData.length}</div>
          <div className="text-amber-300/60 text-sm">Da registrare</div>
        </div>
      </div>

      {/* Employee List */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Dipendenti</h2>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-white/40 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((employee) => {
              const enrolled = isEnrolled(employee.id);
              const enrollDate = getEnrollmentDate(employee.id);

              return (
                <motion.div
                  key={employee.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border transition-all ${
                    enrolled
                      ? 'bg-emerald-500/10 border-emerald-400/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        enrolled
                          ? 'bg-emerald-500/20'
                          : 'bg-white/10'
                      }`}>
                        {enrolled ? (
                          <UserCheck className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <User className="w-6 h-6 text-white/40" />
                        )}
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white">{employee.name}</div>
                        <div className="text-sm text-white/60">
                          {employee.department_id?.[1] || 'Dipendente'}
                          {enrollDate && (
                            <span className="ml-2 text-emerald-400/80">
                              • Registrato il {enrollDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {enrolled ? (
                        <>
                          <span className="px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium">
                            Volto registrato
                          </span>
                          <button
                            onClick={() => deleteFaceEnrollment(employee.id, employee.name)}
                            disabled={deletingId === employee.id}
                            className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                            title="Elimina riconoscimento facciale"
                          >
                            {deletingId === employee.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="px-3 py-1 bg-amber-500/20 rounded-full text-amber-400 text-sm font-medium">
                          Non registrato
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="max-w-4xl mx-auto mt-8 p-4 bg-blue-500/10 rounded-2xl border border-blue-400/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <div className="text-blue-300 font-medium">Informazioni Admin</div>
            <div className="text-blue-300/70 text-sm mt-1">
              Quando elimini un riconoscimento facciale, il dipendente dovrà registrarsi nuovamente
              dalla schermata principale. Solo tu (paul@lapa.ch) puoi accedere a questa pagina.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
