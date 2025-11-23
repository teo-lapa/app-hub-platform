'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Clock, Coffee, LogIn, LogOut, Calendar, ArrowLeft,
  Download, RefreshCw, MapPin, Building2, TrendingUp, AlertCircle, Loader2,
  Plus, QrCode, Trash2, Edit2, Check, X, Navigation, Printer,
  FileSpreadsheet, FileText, File, User, CalendarDays, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

interface EmployeeStatus {
  contact_id: number;
  contact_name: string;
  contact_function?: string;
  contact_image?: string;
  is_on_duty: boolean;
  is_on_break: boolean;
  last_entry?: {
    entry_type: string;
    timestamp: string;
    location_name?: string;
    break_type?: 'coffee_break' | 'lunch_break';
  };
  hours_worked_today: number;
  entries_today: number;
}

interface DashboardStats {
  total_employees: number;
  on_duty: number;
  on_break: number;
  off_duty: number;
  total_hours_today: number;
}

interface Location {
  id: string;
  company_id: number;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  qr_secret: string;
  is_active: boolean;
  created_at: string;
}

export default function TimeAttendanceAdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'locations'>('dashboard');

  // Dashboard state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<EmployeeStatus[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    employeeMode: 'all' as 'all' | 'single',
    selectedEmployee: null as number | null,
    period: 'month' as 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom',
    customStart: '',
    customEnd: '',
    format: 'excel' as 'csv' | 'excel' | 'pdf',
    includeDetails: true,
    includeSummary: true,
    includeWeekly: false,
    includeOvertime: false,
  });
  const [exporting, setExporting] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius_meters: 100,
  });
  const [savingLocation, setSavingLocation] = useState(false);
  const [gettingGPS, setGettingGPS] = useState(false);
  const [selectedQR, setSelectedQR] = useState<Location | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load company info from contact API
  useEffect(() => {
    if (user?.email) {
      loadCompanyInfo();
    }
  }, [user?.email]);

  // Load dashboard when companyId changes
  useEffect(() => {
    if (companyId) {
      loadDashboard();
      loadLocations();
    }
  }, [companyId, selectedDate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!companyId) return;
    const interval = setInterval(() => loadDashboard(true), 30000);
    return () => clearInterval(interval);
  }, [companyId]);

  // Generate QR code image when location selected
  useEffect(() => {
    if (selectedQR) {
      generateQRImage(selectedQR);
    } else {
      setQrImageUrl(null);
    }
  }, [selectedQR]);

  const loadCompanyInfo = async () => {
    try {
      const res = await fetch(`/api/time-attendance/contact?email=${encodeURIComponent(user!.email)}`);
      const data = await res.json();

      if (data.success && data.data) {
        // SOLO le aziende possono accedere all'admin
        if (data.data.contact.is_company) {
          setCompanyId(data.data.contact.id);
          setCompanyName(data.data.contact.name);
        } else {
          // Dipendenti non hanno accesso all'admin
          toast.error('Accesso riservato alle aziende');
          router.push('/time-attendance');
          return;
        }
      } else {
        setError(data.error || 'Errore caricamento dati');
      }
    } catch {
      setError('Errore di connessione');
    }
  };

  const loadDashboard = async (silent = false) => {
    if (!companyId) return;

    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/time-attendance/dashboard?company_id=${companyId}&date=${selectedDate}`);
      const data = await res.json();

      if (data.success) {
        setStats(data.data.stats);
        setEmployees(data.data.employees);
        setError(null);
      } else {
        // Se è errore tabella non esiste, tenta migrazione
        if (data.details?.includes('does not exist') || data.details?.includes('ta_')) {
          console.log('Tentativo migrazione automatica...');
          await runMigration();
        } else {
          setError(data.error || 'Errore caricamento');
        }
      }
    } catch {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runMigration = async () => {
    try {
      const res = await fetch('/api/time-attendance/migrate?secret=lapa2024migrate', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Database inizializzato!');
        loadDashboard();
        loadLocations();
      } else {
        toast.error('Errore migrazione DB');
      }
    } catch (err) {
      console.error('Migration error:', err);
    }
  };

  const loadLocations = async () => {
    if (!companyId) return;
    setLoadingLocations(true);

    try {
      const res = await fetch(`/api/time-attendance/locations?company_id=${companyId}`);
      const data = await res.json();

      if (data.success) {
        setLocations(data.data || []);
      }
    } catch (err) {
      console.error('Error loading locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const getCurrentGPS = () => {
    if (!navigator.geolocation) {
      toast.error('GPS non supportato');
      return;
    }

    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewLocation(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(8),
          longitude: pos.coords.longitude.toFixed(8),
        }));
        setGettingGPS(false);
        toast.success('Coordinate GPS acquisite!');
      },
      (err) => {
        toast.error(`Errore GPS: ${err.message}`);
        setGettingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleCreateLocation = async () => {
    if (!companyId || !newLocation.name || !newLocation.latitude || !newLocation.longitude) {
      toast.error('Compila nome e coordinate');
      return;
    }

    setSavingLocation(true);

    try {
      const res = await fetch('/api/time-attendance/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name: newLocation.name,
          address: newLocation.address,
          latitude: parseFloat(newLocation.latitude),
          longitude: parseFloat(newLocation.longitude),
          radius_meters: newLocation.radius_meters,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Sede creata! QR Code generato.');
        setShowAddLocation(false);
        setNewLocation({ name: '', address: '', latitude: '', longitude: '', radius_meters: 100 });
        loadLocations();
      } else {
        toast.error(data.error || 'Errore creazione');
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      setSavingLocation(false);
    }
  };

  const generateQRImage = async (location: Location) => {
    try {
      // QR contiene il secret direttamente
      const qrData = JSON.stringify({
        secret: location.qr_secret,
        name: location.name,
        company: companyName,
      });

      const url = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });

      setQrImageUrl(url);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  const handlePrintQR = () => {
    if (!qrImageUrl || !selectedQR) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${selectedQR.name}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
              h1 { color: #333; margin-bottom: 10px; }
              h2 { color: #666; font-weight: normal; margin-bottom: 30px; }
              img { width: 300px; height: 300px; }
              p { color: #888; margin-top: 20px; font-size: 12px; }
            </style>
          </head>
          <body>
            <h1>${selectedQR.name}</h1>
            <h2>${companyName}</h2>
            <img src="${qrImageUrl}" alt="QR Code" />
            <p>Scansiona questo QR Code con l'app Time & Attendance per timbrare</p>
            <p>Raggio geofencing: ${selectedQR.radius_meters}m</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa sede?')) return;

    try {
      const res = await fetch(`/api/time-attendance/locations?id=${locationId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Sede eliminata');
        loadLocations();
      } else {
        toast.error(data.error || 'Errore eliminazione');
      }
    } catch {
      toast.error('Errore di rete');
    }
  };

  // Calcola date dal periodo selezionato
  const getExportDates = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (exportConfig.period) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        return { start: yStr, end: yStr };
      }
      case 'week': {
        const monday = new Date(today);
        const day = monday.getDay();
        const diff = day === 0 ? 6 : day - 1;
        monday.setDate(monday.getDate() - diff);
        return { start: monday.toISOString().split('T')[0], end: todayStr };
      }
      case 'month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: firstDay.toISOString().split('T')[0], end: todayStr };
      }
      case 'last_month': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: firstDayLastMonth.toISOString().split('T')[0],
          end: lastDayLastMonth.toISOString().split('T')[0]
        };
      }
      case 'custom':
        return { start: exportConfig.customStart, end: exportConfig.customEnd };
      default:
        return { start: todayStr, end: todayStr };
    }
  };

  const handleExportSubmit = async () => {
    if (!companyId) return;

    const dates = getExportDates();
    if (!dates.start || !dates.end) {
      toast.error('Seleziona le date');
      return;
    }

    setExporting(true);
    toast.loading('Generazione export...');

    try {
      let url = `/api/time-attendance/export?company_id=${companyId}&start_date=${dates.start}&end_date=${dates.end}&format=${exportConfig.format}`;

      // Aggiungi filtro dipendente se singolo
      if (exportConfig.employeeMode === 'single' && exportConfig.selectedEmployee) {
        url += `&contact_id=${exportConfig.selectedEmployee}`;
      }

      const res = await fetch(url);

      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;

        // Nome file descrittivo
        const periodNames: Record<string, string> = {
          today: 'oggi',
          yesterday: 'ieri',
          week: 'settimana',
          month: 'mese',
          last_month: 'mese_scorso',
          custom: `${dates.start}_${dates.end}`,
        };
        const empName = exportConfig.employeeMode === 'single'
          ? employees.find(e => e.contact_id === exportConfig.selectedEmployee)?.contact_name?.replace(/\s+/g, '_') || 'dipendente'
          : 'tutti';
        const ext = exportConfig.format === 'excel' ? 'xlsx' : exportConfig.format;
        a.download = `presenze_${empName}_${periodNames[exportConfig.period]}.${ext}`;

        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.dismiss();
        toast.success('Export completato!');
        setShowExportDialog(false);
      } else {
        toast.dismiss();
        toast.error('Errore export');
      }
    } catch {
      toast.dismiss();
      toast.error('Errore download');
    } finally {
      setExporting(false);
    }
  };

  // Funzione legacy per compatibilità
  const handleExport = async (format: 'csv' | 'excel') => {
    setExportConfig(prev => ({ ...prev, format, period: 'today' }));
    setShowExportDialog(true);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Loading state
  if (authLoading || (loading && !stats && !error)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error state (only if no data at all)
  if (error && !stats && !locations.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur rounded-3xl p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Errore</h2>
          <p className="text-white/70 mb-6">{error}</p>
          <button onClick={() => runMigration()}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl mb-3 w-full">
            Inizializza Database
          </button>
          <button onClick={() => router.push('/time-attendance')}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl w-full">
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/time-attendance')}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <h1 className="text-xl font-bold text-white">{companyName}</h1>
                </div>
                <p className="text-sm text-white/60">Admin Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeTab === 'dashboard' && (
                <>
                  <input type="date" value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={() => loadDashboard()} disabled={refreshing}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}>
              <Users className="w-4 h-4 inline mr-2" />Presenze
            </button>
            <button onClick={() => setActiveTab('locations')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'locations' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}>
              <MapPin className="w-4 h-4 inline mr-2" />Sedi & QR
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* ==================== DASHBOARD TAB ==================== */}
        {activeTab === 'dashboard' && (
          <>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                    <Users className="w-4 h-4" />Totale
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.total_employees}</div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                  className="bg-green-500/20 backdrop-blur rounded-2xl p-4 border border-green-500/30">
                  <div className="flex items-center gap-2 text-green-300 text-sm mb-1">
                    <LogIn className="w-4 h-4" />In Servizio
                  </div>
                  <div className="text-3xl font-bold text-green-400">{stats.on_duty}</div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="bg-orange-500/20 backdrop-blur rounded-2xl p-4 border border-orange-500/30">
                  <div className="flex items-center gap-2 text-orange-300 text-sm mb-1">
                    <Coffee className="w-4 h-4" />In Pausa
                  </div>
                  <div className="text-3xl font-bold text-orange-400">{stats.on_break}</div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                  className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                    <LogOut className="w-4 h-4" />Fuori
                  </div>
                  <div className="text-3xl font-bold text-white/70">{stats.off_duty}</div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  className="bg-blue-500/20 backdrop-blur rounded-2xl p-4 border border-blue-500/30">
                  <div className="flex items-center gap-2 text-blue-300 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />Ore Totali
                  </div>
                  <div className="text-3xl font-bold text-blue-400">{formatHours(stats.total_hours_today)}</div>
                </motion.div>
              </div>
            )}

            {/* Export Button */}
            <div className="flex gap-3 mb-6">
              <button onClick={() => setShowExportDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
                <Download className="w-4 h-4" />Export CSV
              </button>
              <button onClick={() => setShowExportDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
                <FileSpreadsheet className="w-4 h-4" />Export Excel
              </button>
            </div>

            {/* Employees List */}
            <div className="bg-white/5 backdrop-blur rounded-3xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Dipendenti ({employees.length})</h2>
              </div>

              <div className="divide-y divide-white/5">
                {employees.map((emp, i) => (
                  <motion.div key={emp.contact_id}
                    initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">

                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      emp.is_on_duty ? (emp.is_on_break ? 'bg-orange-500/30' : 'bg-green-500/30') : 'bg-white/10'
                    }`}>
                      {emp.contact_image ? (
                        <img src={`data:image/png;base64,${emp.contact_image}`} alt=""
                          className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <Users className={`w-6 h-6 ${
                          emp.is_on_duty ? (emp.is_on_break ? 'text-orange-400' : 'text-green-400') : 'text-white/40'
                        }`} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{emp.contact_name}</span>
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          emp.is_on_duty
                            ? (emp.is_on_break ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400')
                            : 'bg-white/10 text-white/50'
                        }`}>
                          {emp.is_on_duty
                            ? (emp.is_on_break
                                ? (emp.last_entry?.break_type === 'coffee_break' ? 'Pausa Caffè' :
                                   emp.last_entry?.break_type === 'lunch_break' ? 'Pausa Pranzo' : 'Pausa')
                                : 'In Servizio')
                            : 'Fuori'}
                        </span>
                      </div>
                      {emp.contact_function && (
                        <div className="text-sm text-white/50 truncate">{emp.contact_function}</div>
                      )}
                    </div>

                    {/* Last Entry */}
                    <div className="hidden md:block text-right">
                      {emp.last_entry ? (
                        <>
                          <div className="text-sm text-white/70">
                            {emp.last_entry.entry_type === 'clock_in' ? 'Entrata' :
                             emp.last_entry.entry_type === 'clock_out' ? 'Uscita' :
                             emp.last_entry.entry_type === 'break_start'
                               ? (emp.last_entry.break_type === 'coffee_break' ? 'Pausa Caffè' :
                                  emp.last_entry.break_type === 'lunch_break' ? 'Pausa Pranzo' : 'Pausa')
                               : 'Ripresa'}
                            {' '}{formatTime(emp.last_entry.timestamp)}
                          </div>
                          {emp.last_entry.location_name && (
                            <div className="text-xs text-white/40 flex items-center gap-1 justify-end">
                              <MapPin className="w-3 h-3" />{emp.last_entry.location_name}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-white/40">Nessuna timbratura</div>
                      )}
                    </div>

                    {/* Hours */}
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">{formatHours(emp.hours_worked_today)}</div>
                      <div className="text-xs text-white/40">{emp.entries_today} timbrature</div>
                    </div>
                  </motion.div>
                ))}

                {employees.length === 0 && (
                  <div className="p-12 text-center text-white/50">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Nessun dipendente con timbrature</p>
                    <p className="text-sm mt-2">Crea una sede nel tab &quot;Sedi & QR&quot; e fai timbrare i dipendenti</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ==================== LOCATIONS TAB ==================== */}
        {activeTab === 'locations' && (
          <>
            {/* Add Location Button */}
            <div className="mb-6">
              <button onClick={() => setShowAddLocation(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors">
                <Plus className="w-5 h-5" />Aggiungi Sede
              </button>
            </div>

            {/* Locations List */}
            {loadingLocations ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            ) : locations.length === 0 ? (
              <div className="bg-white/5 backdrop-blur rounded-3xl border border-white/10 p-12 text-center">
                <MapPin className="w-16 h-16 mx-auto mb-4 text-white/30" />
                <h3 className="text-xl font-bold text-white mb-2">Nessuna sede configurata</h3>
                <p className="text-white/60 mb-6">
                  Crea la tua prima sede per generare il QR Code che i dipendenti scannerizzeranno per timbrare.
                </p>
                <button onClick={() => setShowAddLocation(true)}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold">
                  <Plus className="w-5 h-5 inline mr-2" />Crea Sede
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {locations.map((loc) => (
                  <motion.div key={loc.id}
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">{loc.name}</h3>
                        {loc.address && <p className="text-sm text-white/60">{loc.address}</p>}
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${
                        loc.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {loc.is_active ? 'Attiva' : 'Disattivata'}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-white/70 mb-4">
                      <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4" />
                        <span>{loc.latitude}, {loc.longitude}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>Raggio: {loc.radius_meters}m</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setSelectedQR(loc)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
                        <QrCode className="w-4 h-4" />Mostra QR
                      </button>
                      <button onClick={() => handleDeleteLocation(loc.id)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ==================== ADD LOCATION MODAL ==================== */}
      <AnimatePresence>
        {showAddLocation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-3xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Nuova Sede</h3>
                <button onClick={() => setShowAddLocation(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Nome Sede *</label>
                  <input type="text" value={newLocation.name}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Es: Sede Principale"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1">Indirizzo</label>
                  <input type="text" value={newLocation.address}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Es: Via Roma 1, Milano"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-2">Coordinate GPS *</label>
                  <button onClick={getCurrentGPS} disabled={gettingGPS}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl transition-colors mb-3">
                    {gettingGPS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                    {gettingGPS ? 'Rilevamento...' : 'Usa GPS Attuale'}
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={newLocation.latitude}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, latitude: e.target.value }))}
                      placeholder="Latitudine"
                      className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input type="text" value={newLocation.longitude}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, longitude: e.target.value }))}
                      placeholder="Longitudine"
                      className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1">Raggio Geofence (metri)</label>
                  <input type="number" value={newLocation.radius_meters}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, radius_meters: parseInt(e.target.value) || 100 }))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-white/50 mt-1">Distanza massima dalla sede per timbrare</p>
                </div>
              </div>

              <button onClick={handleCreateLocation} disabled={savingLocation || !newLocation.name || !newLocation.latitude}
                className={`w-full mt-6 py-4 rounded-xl text-white font-semibold transition-all ${
                  savingLocation || !newLocation.name || !newLocation.latitude
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}>
                {savingLocation ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Creazione...</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><Check className="w-5 h-5" />Crea Sede e Genera QR</span>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== QR CODE MODAL ==================== */}
      <AnimatePresence>
        {selectedQR && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedQR.name}</h3>
              <p className="text-gray-500 mb-4">{companyName}</p>

              {qrImageUrl ? (
                <img src={qrImageUrl} alt="QR Code" className="w-64 h-64 mx-auto mb-4" />
              ) : (
                <div className="w-64 h-64 mx-auto mb-4 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              )}

              <p className="text-sm text-gray-500 mb-4">
                Raggio geofencing: {selectedQR.radius_meters}m
              </p>

              <div className="flex gap-3">
                <button onClick={handlePrintQR}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
                  <Printer className="w-5 h-5" />Stampa
                </button>
                <button onClick={() => setSelectedQR(null)}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors">
                  Chiudi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== EXPORT DIALOG ==================== */}
      <AnimatePresence>
        {showExportDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <Download className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-bold text-white">Export Timbrature</h3>
                </div>
                <button onClick={() => setShowExportDialog(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Dipendenti */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
                    <User className="w-4 h-4" />Dipendenti
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                      <input type="radio" name="employeeMode" value="all"
                        checked={exportConfig.employeeMode === 'all'}
                        onChange={() => setExportConfig(prev => ({ ...prev, employeeMode: 'all', selectedEmployee: null }))}
                        className="w-4 h-4 text-blue-500"
                      />
                      <span className="text-white">Tutti i dipendenti</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                      <input type="radio" name="employeeMode" value="single"
                        checked={exportConfig.employeeMode === 'single'}
                        onChange={() => setExportConfig(prev => ({ ...prev, employeeMode: 'single' }))}
                        className="w-4 h-4 text-blue-500"
                      />
                      <span className="text-white">Singolo dipendente</span>
                    </label>
                    {exportConfig.employeeMode === 'single' && (
                      <select value={exportConfig.selectedEmployee || ''}
                        onChange={(e) => setExportConfig(prev => ({ ...prev, selectedEmployee: parseInt(e.target.value) || null }))}
                        className="w-full mt-2 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="" className="bg-gray-900">Seleziona dipendente...</option>
                        {employees.map(emp => (
                          <option key={emp.contact_id} value={emp.contact_id} className="bg-gray-900">
                            {emp.contact_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Periodo */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
                    <CalendarDays className="w-4 h-4" />Periodo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'today', label: 'Oggi' },
                      { value: 'yesterday', label: 'Ieri' },
                      { value: 'week', label: 'Questa settimana' },
                      { value: 'month', label: 'Questo mese' },
                      { value: 'last_month', label: 'Mese scorso' },
                      { value: 'custom', label: 'Personalizzato' },
                    ].map(opt => (
                      <label key={opt.value}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl cursor-pointer transition-colors ${
                          exportConfig.period === opt.value
                            ? 'bg-blue-500/30 border-2 border-blue-500 text-blue-400'
                            : 'bg-white/5 border-2 border-transparent text-white hover:bg-white/10'
                        }`}>
                        <input type="radio" name="period" value={opt.value}
                          checked={exportConfig.period === opt.value}
                          onChange={() => setExportConfig(prev => ({ ...prev, period: opt.value as typeof prev.period }))}
                          className="sr-only"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {exportConfig.period === 'custom' && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Dal</label>
                        <input type="date" value={exportConfig.customStart}
                          onChange={(e) => setExportConfig(prev => ({ ...prev, customStart: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Al</label>
                        <input type="date" value={exportConfig.customEnd}
                          onChange={(e) => setExportConfig(prev => ({ ...prev, customEnd: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Formato */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
                    <File className="w-4 h-4" />Formato
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'excel', label: 'Excel', icon: FileSpreadsheet, desc: '.xlsx' },
                      { value: 'csv', label: 'CSV', icon: FileText, desc: '.csv' },
                      { value: 'pdf', label: 'PDF', icon: File, desc: '.pdf' },
                    ].map(opt => (
                      <label key={opt.value}
                        className={`flex flex-col items-center gap-1 p-4 rounded-xl cursor-pointer transition-colors ${
                          exportConfig.format === opt.value
                            ? 'bg-blue-500/30 border-2 border-blue-500'
                            : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                        }`}>
                        <input type="radio" name="format" value={opt.value}
                          checked={exportConfig.format === opt.value}
                          onChange={() => setExportConfig(prev => ({ ...prev, format: opt.value as typeof prev.format }))}
                          className="sr-only"
                        />
                        <opt.icon className={`w-6 h-6 ${exportConfig.format === opt.value ? 'text-blue-400' : 'text-white/60'}`} />
                        <span className={`text-sm font-medium ${exportConfig.format === opt.value ? 'text-blue-400' : 'text-white'}`}>
                          {opt.label}
                        </span>
                        <span className="text-xs text-white/40">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Contenuto (opzionale) */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
                    <Check className="w-4 h-4" />Contenuto
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: 'includeDetails', label: 'Dettaglio timbrature', desc: 'Ogni entrata/uscita/pausa' },
                      { key: 'includeSummary', label: 'Riepilogo ore giornaliere', desc: 'Totale ore per giorno' },
                      { key: 'includeWeekly', label: 'Riepilogo settimanale', desc: 'Totale ore per settimana' },
                      { key: 'includeOvertime', label: 'Straordinari (>8h)', desc: 'Evidenzia ore extra' },
                    ].map(opt => (
                      <label key={opt.key}
                        className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                        <input type="checkbox"
                          checked={exportConfig[opt.key as keyof typeof exportConfig] as boolean}
                          onChange={(e) => setExportConfig(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                          className="w-4 h-4 rounded text-blue-500"
                        />
                        <div>
                          <div className="text-white text-sm">{opt.label}</div>
                          <div className="text-white/40 text-xs">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowExportDialog(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
                  Annulla
                </button>
                <button onClick={handleExportSubmit}
                  disabled={exporting || (exportConfig.employeeMode === 'single' && !exportConfig.selectedEmployee)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors ${
                    exporting || (exportConfig.employeeMode === 'single' && !exportConfig.selectedEmployee)
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}>
                  {exporting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Generazione...</>
                  ) : (
                    <><Download className="w-5 h-5" />Scarica</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
