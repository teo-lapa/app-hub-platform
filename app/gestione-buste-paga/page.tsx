'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  FileText,
  DollarSign,
  Plus,
  Loader,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Building,
  Award,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Employee {
  id: number;
  name: string;
  user_id: [number, string] | false;
  department_id: [number, string] | false;
  job_title: string | false;
  work_email: string | false;
}

interface Payslip {
  id: number;
  name: string;
  employee_id: [number, string];
  date_from: string;
  date_to: string;
  state: string;
  net_wage: number;
}

interface PayslipLine {
  id: number;
  name: string;
  code: string;
  amount: number;
  category_id: [number, string];
}

interface SalaryRule {
  id: number;
  name: string;
  code: string;
  category_id: [number, string];
  active: boolean;
}

export default function GestioneBustePagaPage() {
  const router = useRouter();

  // Stati principali
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [salaryRules, setSalaryRules] = useState<SalaryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selezione
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [payslipLines, setPayslipLines] = useState<PayslipLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  // Form bonus
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('');
  const [savingBonus, setSavingBonus] = useState(false);

  // Filtro mese
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Carica dati iniziali
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Carica dipendenti e regole salariali in parallelo
      const [employeesRes, rulesRes] = await Promise.all([
        fetch('/api/hr-payslip?action=employees', { credentials: 'include' }),
        fetch('/api/hr-payslip?action=salary-rules', { credentials: 'include' })
      ]);

      const employeesData = await employeesRes.json();
      const rulesData = await rulesRes.json();

      if (!employeesRes.ok) throw new Error(employeesData.error || 'Errore caricamento dipendenti');
      if (!rulesRes.ok) throw new Error(rulesData.error || 'Errore caricamento regole');

      setEmployees(employeesData.employees || []);
      setSalaryRules(rulesData.rules || []);

      console.log('Dipendenti:', employeesData.employees?.length);
      console.log('Regole salariali:', rulesData.rules?.length);

    } catch (err: any) {
      console.error('Errore:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carica buste paga
  const loadPayslips = useCallback(async (employeeId?: number) => {
    try {
      let url = `/api/hr-payslip?action=payslips&month=${selectedMonth}`;
      if (employeeId) {
        url += `&employeeId=${employeeId}`;
      }

      const response = await fetch(url, { credentials: 'include' });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Errore caricamento buste paga');

      setPayslips(data.payslips || []);

    } catch (err: any) {
      console.error('Errore caricamento payslips:', err);
      setError(err.message);
    }
  }, [selectedMonth]);

  // Carica linee busta paga
  const loadPayslipLines = useCallback(async (payslipId: number) => {
    setLoadingLines(true);
    try {
      const response = await fetch(`/api/hr-payslip?action=payslip-lines&payslipId=${payslipId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Errore caricamento linee');

      setPayslipLines(data.lines || []);

    } catch (err: any) {
      console.error('Errore:', err);
      setError(err.message);
    } finally {
      setLoadingLines(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedEmployee) {
      loadPayslips(selectedEmployee.id);
    } else {
      loadPayslips();
    }
  }, [selectedEmployee, selectedMonth, loadPayslips]);

  useEffect(() => {
    if (selectedPayslip) {
      loadPayslipLines(selectedPayslip.id);
    }
  }, [selectedPayslip, loadPayslipLines]);

  // Crea regola Bonus Vendite se non esiste
  const createBonusRule = async () => {
    setError(null);
    try {
      const response = await fetch('/api/hr-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-salary-rule',
          name: 'Bonus Vendite',
          code: 'BONUS_VENDITE',
          categoryId: 2 // Allowance
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Errore creazione regola');

      setSuccess(data.message || 'Regola Bonus Vendite creata!');
      loadInitialData(); // Ricarica le regole

      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setError(err.message);
    }
  };

  // Aggiungi bonus a busta paga
  const addBonusToPayslip = async () => {
    if (!selectedPayslip || !bonusAmount) return;

    setSavingBonus(true);
    setError(null);

    try {
      const response = await fetch('/api/hr-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add-bonus-line',
          payslipId: selectedPayslip.id,
          amount: parseFloat(bonusAmount),
          name: 'Bonus Vendite'
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Errore aggiunta bonus');

      setSuccess('Bonus aggiunto alla busta paga!');
      setBonusAmount('');
      setShowBonusForm(false);
      loadPayslipLines(selectedPayslip.id); // Ricarica linee

      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingBonus(false);
    }
  };

  // Verifica se esiste la regola Bonus Vendite
  const hasBonusRule = salaryRules.some(r => r.code === 'BONUS_VENDITE');

  // Formatta stato busta paga
  const formatState = (state: string) => {
    const states: Record<string, { label: string; color: string }> = {
      draft: { label: 'Bozza', color: 'bg-gray-500' },
      verify: { label: 'Da verificare', color: 'bg-yellow-500' },
      done: { label: 'Completata', color: 'bg-green-500' },
      cancel: { label: 'Annullata', color: 'bg-red-500' }
    };
    return states[state] || { label: state, color: 'bg-gray-500' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-gray-400">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <FileText className="w-7 h-7 text-green-400" />
                Gestione Buste Paga
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Gestisci buste paga e bonus vendite dei dipendenti
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Selettore mese */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white border-none outline-none"
              />
            </div>

            <button
              onClick={loadInitialData}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Ricarica"
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Messaggi */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto mb-4"
          >
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-200">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto mb-4"
          >
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-green-200">{success}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avviso se manca regola Bonus Vendite */}
      {!hasBonusRule && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <p className="text-yellow-200">
                La regola &quot;Bonus Vendite&quot; non esiste ancora in Odoo.
              </p>
            </div>
            <button
              onClick={createBonusRule}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Crea Regola
            </button>
          </div>
        </div>
      )}

      {/* Layout principale */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna 1: Dipendenti */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Dipendenti ({employees.length})
            </h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedEmployee(emp);
                  setSelectedPayslip(null);
                }}
                className={`w-full p-4 border-b border-gray-700/50 text-left hover:bg-gray-700/30 transition-colors ${
                  selectedEmployee?.id === emp.id ? 'bg-blue-500/20 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <p className="font-medium text-white">{emp.name}</p>
                {emp.job_title && (
                  <p className="text-sm text-gray-400">{emp.job_title}</p>
                )}
                {emp.department_id && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Building className="w-3 h-3" />
                    {emp.department_id[1]}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Colonna 2: Buste Paga */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-400" />
              Buste Paga
              {selectedEmployee && (
                <span className="text-sm font-normal text-gray-400">
                  - {selectedEmployee.name}
                </span>
              )}
            </h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {payslips.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nessuna busta paga trovata</p>
                <p className="text-sm mt-1">per {selectedMonth}</p>
              </div>
            ) : (
              payslips.map((slip) => {
                const state = formatState(slip.state);
                return (
                  <button
                    key={slip.id}
                    onClick={() => setSelectedPayslip(slip)}
                    className={`w-full p-4 border-b border-gray-700/50 text-left hover:bg-gray-700/30 transition-colors ${
                      selectedPayslip?.id === slip.id ? 'bg-green-500/20 border-l-4 border-l-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-white">{slip.name}</p>
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${state.color}`}>
                        {state.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {slip.employee_id[1]}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {slip.date_from} - {slip.date_to}
                    </p>
                    {slip.net_wage > 0 && (
                      <p className="text-sm text-green-400 font-medium mt-2">
                        CHF {slip.net_wage.toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Colonna 3: Dettaglio Busta Paga */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              Dettaglio
            </h2>
            {selectedPayslip && hasBonusRule && (
              <button
                onClick={() => setShowBonusForm(true)}
                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Bonus
              </button>
            )}
          </div>

          {!selectedPayslip ? (
            <div className="p-8 text-center text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Seleziona una busta paga</p>
              <p className="text-sm mt-1">per vedere i dettagli</p>
            </div>
          ) : (
            <div className="p-4">
              {/* Info busta paga */}
              <div className="bg-gray-700/30 rounded-lg p-4 mb-4">
                <p className="font-medium text-white">{selectedPayslip.name}</p>
                <p className="text-sm text-gray-400">{selectedPayslip.employee_id[1]}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Periodo: {selectedPayslip.date_from} - {selectedPayslip.date_to}
                </p>
              </div>

              {/* Form aggiunta bonus */}
              <AnimatePresence>
                {showBonusForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="w-5 h-5 text-green-400" />
                      <p className="font-medium text-white">Aggiungi Bonus Vendite</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">CHF</span>
                        <input
                          type="number"
                          value={bonusAmount}
                          onChange={(e) => setBonusAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-12 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <button
                        onClick={addBonusToPayslip}
                        disabled={!bonusAmount || savingBonus}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        {savingBonus ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Salva
                      </button>
                      <button
                        onClick={() => {
                          setShowBonusForm(false);
                          setBonusAmount('');
                        }}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Linee busta paga */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400 mb-3">Voci stipendio:</p>

                {loadingLines ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : payslipLines.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nessuna voce presente
                  </p>
                ) : (
                  payslipLines.map((line) => (
                    <div
                      key={line.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        line.code === 'BONUS_VENDITE'
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-gray-700/30'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${
                          line.code === 'BONUS_VENDITE' ? 'text-green-400' : 'text-white'
                        }`}>
                          {line.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {line.code} - {line.category_id[1]}
                        </p>
                      </div>
                      <p className={`font-bold ${
                        line.code === 'BONUS_VENDITE' ? 'text-green-400' : 'text-white'
                      }`}>
                        CHF {line.amount.toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))
                )}

                {/* Totale */}
                {payslipLines.length > 0 && (
                  <div className="border-t border-gray-700 pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-400">Totale Netto</p>
                      <p className="text-xl font-bold text-white">
                        CHF {payslipLines
                          .filter(l => l.category_id[1] === 'Net' || l.category_id[0] === 5)
                          .reduce((sum, l) => sum + l.amount, 0)
                          .toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {/* Bonus totale */}
                    {payslipLines.some(l => l.code === 'BONUS_VENDITE') && (
                      <div className="flex items-center justify-between mt-2">
                        <p className="font-medium text-green-400">di cui Bonus Vendite</p>
                        <p className="font-bold text-green-400">
                          CHF {payslipLines
                            .filter(l => l.code === 'BONUS_VENDITE')
                            .reduce((sum, l) => sum + l.amount, 0)
                            .toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
