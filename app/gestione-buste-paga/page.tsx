'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Upload,
  X,
  Save,
  Eye,
  Trash2,
  FileUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Employee {
  id: number;
  name: string;
  user_id: [number, string] | false;
  department_id: [number, string] | false;
  job_title: string | false;
  work_email: string | false;
  company_id: [number, string] | false;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Form nuova busta paga
  const [showNewPayslipForm, setShowNewPayslipForm] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [extractedNet, setExtractedNet] = useState<string>('');
  const [bonusAmount, setBonusAmount] = useState<string>('');
  const [bonusAvailable, setBonusAvailable] = useState<number>(0);
  const [bonusInfo, setBonusInfo] = useState<{
    team?: string;
    periodFrom?: string;
    periodTo?: string;
    totalReal?: number;    // Totale bonus maturati
    withdrawn?: number;    // Già ritirato
    monthsDetail?: Array<{ month: string; bonus_real: number; payment_percentage: number }>;
  } | null>(null);
  const [paidDate, setPaidDate] = useState<string>('');
  const [closingDate, setClosingDate] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingBonus, setIsLoadingBonus] = useState(false);

  // Filtro mese
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Filtro azienda
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  // Carica dati iniziali
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
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
    } finally {
      setLoadingLines(false);
    }
  }, []);

  // Crea regola Bonus Vendite automaticamente se non esiste
  const ensureBonusRuleExists = useCallback(async () => {
    try {
      const response = await fetch('/api/hr-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-salary-rule',
          name: 'Bonus Vendite',
          code: 'BONUS_VENDITE',
          categoryId: 2
        })
      });

      const data = await response.json();
      if (response.ok) {
        console.log('Regola Bonus Vendite:', data.message);
      }
    } catch (err: any) {
      console.error('Errore creazione regola bonus:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    ensureBonusRuleExists(); // Crea automaticamente la regola se non esiste
  }, [loadInitialData, ensureBonusRuleExists]);

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

  // Carica bonus disponibile quando cambia dipendente o mese
  const loadEmployeeBonus = useCallback(async (employeeId: number, month: string) => {
    setIsLoadingBonus(true);
    setBonusAvailable(0);
    setBonusInfo(null);

    try {
      const response = await fetch(
        `/api/hr-payslip?action=employee-bonus&employeeId=${employeeId}&month=${month}`,
        { credentials: 'include' }
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setBonusAvailable(data.bonus_available || 0);
        setBonusInfo({
          team: data.team?.name,
          periodFrom: data.period?.from,
          periodTo: data.period?.to,
          totalReal: data.bonus_total_real || 0,
          withdrawn: data.bonus_withdrawn || 0,
          monthsDetail: data.months_detail || [],
        });

        // Pre-compila il campo bonus se c'è bonus disponibile
        if (data.bonus_available > 0) {
          setBonusAmount(data.bonus_available.toString());
        }
      }
    } catch (err: any) {
      console.error('Errore caricamento bonus:', err);
    } finally {
      setIsLoadingBonus(false);
    }
  }, []);

  // Quando si apre il form nuova busta paga, carica il bonus
  useEffect(() => {
    if (showNewPayslipForm && selectedEmployee && selectedMonth) {
      loadEmployeeBonus(selectedEmployee.id, selectedMonth);
    }
  }, [showNewPayslipForm, selectedEmployee, selectedMonth, loadEmployeeBonus]);

  // Gestione upload PDF
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFile(file);

    // Crea preview URL
    const url = URL.createObjectURL(file);
    setPdfPreview(url);

    // Estrai il netto dal PDF usando AI
    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/hr-payslip/extract-pdf', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.netAmount) {
        setExtractedNet(data.netAmount.toString());
        setSuccess(`Netto estratto: CHF ${data.netAmount.toLocaleString('it-CH', { minimumFractionDigits: 2 })}`);
        setTimeout(() => setSuccess(null), 3000);
      }

    } catch (err: any) {
      console.error('Errore estrazione PDF:', err);
      // Non bloccare - l'utente può inserire manualmente
    } finally {
      setIsExtracting(false);
    }
  };

  // Crea nuova busta paga
  const createPayslip = async () => {
    if (!selectedEmployee || !extractedNet) {
      setError('Seleziona un dipendente e inserisci il netto');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Converti PDF in base64 se presente
      let pdfBase64 = null;
      if (pdfFile) {
        const buffer = await pdfFile.arrayBuffer();
        pdfBase64 = Buffer.from(buffer).toString('base64');
      }

      const response = await fetch('/api/hr-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-payslip',
          employeeId: selectedEmployee.id,
          month: selectedMonth,
          netAmount: parseFloat(extractedNet),
          bonusAmount: bonusAmount ? parseFloat(bonusAmount) : 0,
          paidDate: paidDate || null,
          closingDate: closingDate || null,
          pdfBase64: pdfBase64,
          pdfFilename: pdfFile?.name
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Errore creazione busta paga');

      setSuccess('Busta paga creata con successo!');

      // Reset form
      setShowNewPayslipForm(false);
      setPdfFile(null);
      setPdfPreview(null);
      setExtractedNet('');
      setBonusAmount('');
      setPaidDate('');
      setClosingDate('');

      // Ricarica buste paga
      loadPayslips(selectedEmployee.id);

      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Filtra dipendenti per azienda
  const filteredEmployees = employees.filter(emp => {
    if (companyFilter === 'all') return true;
    if (!emp.company_id) return companyFilter === 'none';
    return emp.company_id[1].toLowerCase().includes(companyFilter.toLowerCase());
  });

  // Estrai aziende uniche
  const companies = Array.from(new Set(
    employees
      .filter((e): e is Employee & { company_id: [number, string] } => e.company_id !== false)
      .map(e => e.company_id[1])
  ));

  // Formatta stato busta paga
  const formatState = (state: string) => {
    const states: Record<string, { label: string; color: string }> = {
      draft: { label: 'Bozza', color: 'bg-yellow-500' },
      verify: { label: 'Da verificare', color: 'bg-orange-500' },
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
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
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
                Carica PDF, estrai netto, aggiungi bonus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filtro azienda */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">Tutte le aziende</option>
              {companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Selettore mese */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white border-none outline-none text-sm"
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
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
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

      
      {/* Layout principale */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna 1: Dipendenti */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Dipendenti ({filteredEmployees.length})
            </h2>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {filteredEmployees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedEmployee(emp);
                  setSelectedPayslip(null);
                  setShowNewPayslipForm(false);
                }}
                className={`w-full p-4 border-b border-gray-700/50 text-left hover:bg-gray-700/30 transition-colors ${
                  selectedEmployee?.id === emp.id ? 'bg-blue-500/20 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{emp.name}</p>
                    {emp.job_title && (
                      <p className="text-sm text-gray-400">{emp.job_title}</p>
                    )}
                  </div>
                  {emp.company_id && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      emp.company_id[1].toLowerCase().includes('time')
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {emp.company_id[1].split(' ')[0]}
                    </span>
                  )}
                </div>
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

        {/* Colonna 2: Form Nuova Busta Paga / Lista Buste Paga */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {showNewPayslipForm ? (
                <>
                  <FileUp className="w-5 h-5 text-green-400" />
                  Nuova Busta Paga
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 text-green-400" />
                  Buste Paga
                </>
              )}
            </h2>
            {selectedEmployee && !showNewPayslipForm && (
              <button
                onClick={() => setShowNewPayslipForm(true)}
                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Nuova
              </button>
            )}
            {showNewPayslipForm && (
              <button
                onClick={() => {
                  setShowNewPayslipForm(false);
                  setPdfFile(null);
                  setPdfPreview(null);
                  setExtractedNet('');
                  setBonusAmount('');
                }}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {showNewPayslipForm && selectedEmployee ? (
            // Form nuova busta paga
            <div className="p-4 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-300 font-medium">{selectedEmployee.name}</p>
                <p className="text-blue-400/70 text-sm">
                  {selectedMonth} - {selectedEmployee.company_id ? selectedEmployee.company_id[1] : 'N/D'}
                </p>
              </div>

              {/* Upload PDF */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Carica PDF Busta Paga
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {!pdfFile ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-green-500 hover:bg-green-500/5 transition-all"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400">Clicca per caricare il PDF</p>
                    <p className="text-gray-500 text-sm mt-1">oppure trascina qui</p>
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-red-400" />
                      <div>
                        <p className="text-white font-medium">{pdfFile.name}</p>
                        <p className="text-gray-400 text-sm">
                          {(pdfFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPdfFile(null);
                        setPdfPreview(null);
                        setExtractedNet('');
                      }}
                      className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                )}
              </div>

              {isExtracting && (
                <div className="flex items-center gap-2 text-blue-400">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Estrazione netto in corso...</span>
                </div>
              )}

              {/* Netto */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Netto (CHF) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">CHF</span>
                  <input
                    type="number"
                    value={extractedNet}
                    onChange={(e) => setExtractedNet(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-green-500 text-lg"
                  />
                </div>
              </div>

              {/* Bonus */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Award className="w-4 h-4 inline mr-1 text-yellow-400" />
                  Bonus Vendite (CHF)
                </label>

                {/* Info bonus disponibile */}
                {isLoadingBonus ? (
                  <div className="flex items-center gap-2 text-yellow-400 mb-2 p-3 bg-yellow-500/10 rounded-lg">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Calcolo bonus cumulativo in corso...</span>
                  </div>
                ) : bonusInfo ? (
                  <div className="mb-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-2">
                    {/* Header con team e periodo */}
                    <div className="flex items-center justify-between">
                      <span className="text-yellow-400/70 text-xs">
                        Team: {bonusInfo.team || 'N/D'} | Periodo: {bonusInfo.periodFrom} → {bonusInfo.periodTo}
                      </span>
                    </div>

                    {/* Riepilogo bonus */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-800/50 rounded p-2">
                        <p className="text-xs text-gray-400">Maturato</p>
                        <p className="text-sm font-bold text-white">
                          CHF {(bonusInfo.totalReal || 0).toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2">
                        <p className="text-xs text-gray-400">Ritirato</p>
                        <p className="text-sm font-bold text-red-400">
                          CHF {(bonusInfo.withdrawn || 0).toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-yellow-500/20 rounded p-2">
                        <p className="text-xs text-yellow-400">Disponibile</p>
                        <p className="text-sm font-bold text-yellow-400">
                          CHF {bonusAvailable.toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Dettaglio mesi (collapsible) */}
                    {bonusInfo.monthsDetail && bonusInfo.monthsDetail.length > 0 && (
                      <details className="text-xs">
                        <summary className="text-yellow-400/70 cursor-pointer hover:text-yellow-400">
                          Dettaglio per mese ({bonusInfo.monthsDetail.length} mesi con bonus)
                        </summary>
                        <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                          {bonusInfo.monthsDetail.map((m, i) => (
                            <div key={i} className="flex justify-between text-gray-400">
                              <span>{m.month}</span>
                              <span>CHF {m.bonus_real.toLocaleString('it-CH', { minimumFractionDigits: 2 })} ({m.payment_percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : null}

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">CHF</span>
                  <input
                    type="number"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
                  />
                </div>
                {bonusAvailable > 0 && bonusAmount !== bonusAvailable.toString() && (
                  <p className="text-xs text-yellow-400/70 mt-1">
                    Bonus pre-compilato da mese precedente. Modifica se necessario.
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="grid grid-cols-2 gap-4">
                {/* Data Chiusura (paid_date in Odoo) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1 text-blue-400" />
                    Data Chiusura
                  </label>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Data Conto (date in Odoo) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1 text-purple-400" />
                    Data Conto
                  </label>
                  <input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Pulsante crea */}
              <button
                onClick={createPayslip}
                disabled={!extractedNet || isCreating}
                className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Creazione in corso...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Crea Busta Paga
                  </>
                )}
              </button>
            </div>
          ) : (
            // Lista buste paga
            <div className="max-h-[500px] overflow-y-auto">
              {!selectedEmployee ? (
                <div className="p-8 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Seleziona un dipendente</p>
                </div>
              ) : payslips.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nessuna busta paga per {selectedMonth}</p>
                  <button
                    onClick={() => setShowNewPayslipForm(true)}
                    className="mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Crea prima busta paga
                  </button>
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
                      <p className="text-xs text-gray-500">
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
          )}
        </div>

        {/* Colonna 3: Dettaglio Busta Paga */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              Dettaglio
            </h2>
          </div>

          {!selectedPayslip ? (
            <div className="p-8 text-center text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Seleziona una busta paga</p>
            </div>
          ) : (
            <div className="p-4">
              {/* Info */}
              <div className="bg-gray-700/30 rounded-lg p-4 mb-4">
                <p className="font-medium text-white">{selectedPayslip.name}</p>
                <p className="text-sm text-gray-400">{selectedPayslip.employee_id[1]}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {selectedPayslip.date_from} - {selectedPayslip.date_to}
                </p>
              </div>

              {/* Linee */}
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
                          ? 'bg-yellow-500/20 border border-yellow-500/30'
                          : line.code === 'NET'
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-gray-700/30'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${
                          line.code === 'BONUS_VENDITE' ? 'text-yellow-400' :
                          line.code === 'NET' ? 'text-green-400' : 'text-white'
                        }`}>
                          {line.name}
                        </p>
                        <p className="text-xs text-gray-500">{line.code}</p>
                      </div>
                      <p className={`font-bold ${
                        line.code === 'BONUS_VENDITE' ? 'text-yellow-400' :
                        line.code === 'NET' ? 'text-green-400' : 'text-white'
                      }`}>
                        CHF {line.amount.toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))
                )}

                {/* Totale */}
                {payslipLines.length > 0 && (
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-medium text-white">Totale</p>
                      <p className="text-2xl font-bold text-green-400">
                        CHF {payslipLines
                          .reduce((sum, l) => sum + l.amount, 0)
                          .toLocaleString('it-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
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
