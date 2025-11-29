'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  Shield,
  Lock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// Admin key for access
const ADMIN_KEY = 'lapa2025';

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

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [enrolledFaces, setEnrolledFaces] = useState<FaceEmbedding[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Check authorization via URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adminKey = params.get('admin');

    if (adminKey !== ADMIN_KEY) {
      toast.error('Non sei autorizzato ad accedere a questa pagina');
      router.push('/registro-cassaforte');
      return;
    }

    setIsAuthorized(true);
    loadData();
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load employees
      const empResponse = await fetch('/api/registro-cassaforte/employees');
      if (empResponse.ok) {
        const empData = await empResponse.json();
        setEmployees(empData.employees || []);
      }

      // Load enrolled faces
      const facesResponse = await fetch('/api/registro-cassaforte/face-embeddings');
      if (facesResponse.ok) {
        const facesData = await facesResponse.json();
        setEnrolledFaces(facesData.embeddings || []);
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
        // Refresh data
        await loadData();
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
    return enrolledFaces.some(f => f.employee_id === employeeId);
  };

  const getEnrollmentDate = (employeeId: number) => {
    const face = enrolledFaces.find(f => f.employee_id === employeeId);
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

  // Show loading while checking auth
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

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
          <div className="text-3xl font-bold text-emerald-400">{enrolledFaces.length}</div>
          <div className="text-emerald-300/60 text-sm">Volti registrati</div>
        </div>
        <div className="p-4 bg-amber-500/20 backdrop-blur-lg rounded-2xl border border-amber-400/30">
          <div className="text-3xl font-bold text-amber-400">{employees.length - enrolledFaces.length}</div>
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
