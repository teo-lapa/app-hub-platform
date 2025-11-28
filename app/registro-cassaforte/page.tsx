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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

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

// ==================== MAIN COMPONENT ====================
export default function RegistroCassafortePage() {
  const router = useRouter();

  // App State
  const [step, setStep] = useState<
    'idle' | 'face_scan' | 'enrollment' | 'welcome' | 'select_type' | 'select_pickings' | 'extra_input' | 'counting' | 'confirm' | 'success'
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
    BANKNOTE_DENOMINATIONS.map(d => ({ denomination: d, count: 0 }))
  );
  const [coins, setCoins] = useState<CoinCount[]>(
    COIN_DENOMINATIONS.map(d => ({ denomination: d, count: 0 }))
  );

  // UI State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [depositType, setDepositType] = useState<'from_delivery' | 'extra'>('from_delivery');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ==================== EFFECTS ====================

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
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
    setBanknotes(BANKNOTE_DENOMINATIONS.map(d => ({ denomination: d, count: 0 })));
    setCoins(COIN_DENOMINATIONS.map(d => ({ denomination: d, count: 0 })));
    setDepositType('from_delivery');
    setError(null);
  };

  const updateBanknoteCount = (denomination: number, delta: number) => {
    setBanknotes(prev => prev.map(b =>
      b.denomination === denomination
        ? { ...b, count: Math.max(0, b.count + delta) }
        : b
    ));
  };

  const updateCoinCount = (denomination: number, delta: number) => {
    setCoins(prev => prev.map(c =>
      c.denomination === denomination
        ? { ...c, count: Math.max(0, c.count + delta) }
        : c
    ));
  };

  const handleStartDeposit = () => {
    // For MVP, skip face recognition and go directly to employee selection
    setStep('enrollment');
  };

  const handleSelectEmployee = async (employee: Employee) => {
    setCurrentEmployee(employee);
    setSelectedEmployeeId(employee.id);
    await loadPendingPayments(employee.id);
    setStep('select_type');
  };

  const handleSelectType = (type: 'from_delivery' | 'extra') => {
    setDepositType(type);
    if (type === 'from_delivery') {
      setStep('select_pickings');
    } else {
      setStep('extra_input');
    }
  };

  const handleProceedToCounting = () => {
    if (depositType === 'extra' && !extraCustomerName.trim()) {
      toast.error('Inserisci il nome del cliente');
      return;
    }
    setStep('counting');
    // TODO: Start video recording
  };

  const handleConfirm = () => {
    setStep('confirm');
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
          {formatTime(currentTime)}
        </div>
        <div className="text-xl text-white/60">
          {currentTime.toLocaleDateString('it-CH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </div>
      </div>

      {/* Start Button */}
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
    </motion.div>
  );

  // Employee Selection (Enrollment)
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

      {/* Employee List */}
      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        {employees.map((employee) => (
          <motion.button
            key={employee.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelectEmployee(employee)}
            className="p-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 hover:bg-white/20 transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="text-xl font-semibold text-white">{employee.name}</div>
                <div className="text-sm text-white/60">{employee.department_id?.[1] || 'Dipendente'}</div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {employees.length === 0 && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-white/40 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Caricamento dipendenti...</p>
        </div>
      )}
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
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white font-semibold flex items-center gap-2 transition-colors"
          >
            Continua
            <ChevronRight className="w-5 h-5" />
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
          disabled={!extraCustomerName.trim()}
          className="w-full py-5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl text-white text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continua al Conteggio
        </motion.button>
      </div>
    </motion.div>
  );

  // Counting Screen
  const renderCountingScreen = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6 pb-32"
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
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 rounded-full">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-sm font-medium">REC</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banknotes */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <Banknote className="w-7 h-7 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Banconote</h2>
          </div>

          <div className="space-y-3">
            {banknotes.map((b) => (
              <div key={b.denomination} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg text-white font-medium">{b.denomination} CHF</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateBanknoteCount(b.denomination, -1)}
                    className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-5 h-5 text-red-400" />
                  </button>
                  <span className="w-12 text-center text-2xl font-bold text-white">{b.count}</span>
                  <button
                    onClick={() => updateBanknoteCount(b.denomination, 1)}
                    className="w-10 h-10 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-5 h-5 text-emerald-400" />
                  </button>
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
        {step === 'select_type' && renderSelectTypeScreen()}
        {step === 'select_pickings' && renderSelectPickingsScreen()}
        {step === 'extra_input' && renderExtraInputScreen()}
        {step === 'counting' && renderCountingScreen()}
        {step === 'confirm' && renderConfirmScreen()}
        {step === 'success' && renderSuccessScreen()}
      </AnimatePresence>
    </div>
  );
}
