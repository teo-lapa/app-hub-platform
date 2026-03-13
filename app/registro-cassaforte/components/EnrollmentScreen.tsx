'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, UserCheck, RefreshCw, Loader2 } from 'lucide-react';
import type { Employee, EnrolledFace } from '@/lib/registro-cassaforte/types';

interface EnrollmentScreenProps {
  employees: Employee[];
  enrolledFaces: EnrolledFace[];
  isAdmin: boolean;
  onSelectEmployee: (employee: Employee) => void;
  onBack: () => void;
}

export default function EnrollmentScreen({
  employees,
  enrolledFaces,
  isAdmin,
  onSelectEmployee,
  onBack,
}: EnrollmentScreenProps) {
  const availableEmployees = employees.filter(emp => {
    const hasEnrolledFace = enrolledFaces.some(face => face.employee_id === emp.id);
    if (isAdmin) return true;
    return !hasEnrolledFace;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Chi sei?</h1>
          <p className="text-white/60">Seleziona il tuo nome dalla lista</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        {availableEmployees.map((employee) => {
          const hasEnrolledFace = enrolledFaces.some(face => face.employee_id === employee.id);
          const isReEnrolling = isAdmin && hasEnrolledFace;

          return (
            <motion.button
              key={employee.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectEmployee(employee)}
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
                    {isReEnrolling && <span className="ml-2 text-amber-400">• Ri-registra volto</span>}
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
}
