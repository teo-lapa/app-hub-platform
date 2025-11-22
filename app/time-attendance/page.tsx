'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, MapPin, User, Calendar, LogIn, LogOut, Coffee, Play,
  CheckCircle, AlertCircle, QrCode, Users, X, Camera, Navigation,
  Building2, Briefcase, Phone, Mail, Shield, FileText, Home, Loader2, Settings,
  UtensilsCrossed, AlertTriangle, Timer, TrendingUp, RefreshCw,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

// Dynamic import per QRScanner
const QRScanner = dynamic(() => import('@/components/time-attendance/QRScanner'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-800 rounded-3xl h-96" />,
});

// ==================== TYPES ====================
interface OdooContact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  function?: string;
  title?: { id: number; name: string };
  parent_id?: [number, string];
  child_ids?: number[];
  is_company: boolean;
  image_128?: string;
  street?: string;
  city?: string;
  country_id?: [number, string];
  x_gender?: 'male' | 'female' | 'other';
}

interface TimeEntry {
  id: string;
  contact_id: number;
  company_id: number;
  entry_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  qr_code_verified: boolean;
  location_name?: string;
}

interface ActiveBreakInfo {
  type: 'coffee_break' | 'lunch_break';
  name: string;
  started_at: string;
  max_minutes: number;
  elapsed_minutes: number;
  is_exceeded: boolean;
  exceeded_by_minutes: number;
}

interface ClockStatus {
  is_on_duty: boolean;
  is_on_break: boolean;
  last_entry: TimeEntry | null;
  entries_today: TimeEntry[];
  hours_worked_today: number;
  active_break?: ActiveBreakInfo | null;
}

// Company Dashboard Types
interface CompanyEmployee {
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
  hours_worked_yesterday: number;
  hours_worked_week: number;
  entries_today: number;
}

interface CompanyDashboardData {
  date: string;
  week_start: string;
  stats: {
    total_employees: number;
    on_duty: number;
    on_break: number;
    off_duty: number;
    total_hours_today: number;
    total_hours_yesterday: number;
    total_hours_week: number;
  };
  employees: CompanyEmployee[];
}

// Configurazione pause
const BREAK_CONFIG = {
  coffee_break: { maxMinutes: 20, name: 'Pausa Caffè', icon: Coffee },
  lunch_break: { maxMinutes: 60, name: 'Pausa Pranzo', icon: UtensilsCrossed },
} as const;

// ==================== THEME ====================
const getThemeColors = (gender?: string) => {
  if (gender === 'female') {
    return {
      primary: 'from-pink-500 to-purple-600',
      gradient: 'bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500',
    };
  }
  return {
    primary: 'from-blue-500 to-cyan-600',
    gradient: 'bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-500',
  };
};

// ==================== MAIN COMPONENT ====================
export default function TimeAttendancePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

  // State
  const [contact, setContact] = useState<OdooContact | null>(null);
  const [company, setCompany] = useState<OdooContact | null>(null);
  const [employees, setEmployees] = useState<OdooContact[]>([]);
  const [loadingContact, setLoadingContact] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [isClocking, setIsClocking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [view, setView] = useState<'clock' | 'history' | 'team'>('clock');

  // Company Dashboard state
  const [companyDashboard, setCompanyDashboard] = useState<CompanyDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // QR + GPS state
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [pendingClockType, setPendingClockType] = useState<'clock_in' | 'clock_out' | null>(null);
  const [scannedQRSecret, setScannedQRSecret] = useState<string | null>(null);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // GDPR state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentsGranted, setConsentsGranted] = useState({
    gps_tracking: false,
    data_processing: false,
    privacy_policy: false,
  });

  // Ref to prevent duplicate API calls
  const hasLoadedContactRef = useRef(false);
  const hasCheckedConsentsRef = useRef(false);
  const [allConsentsGranted, setAllConsentsGranted] = useState(false);

  // Break timer state
  const [breakTimer, setBreakTimer] = useState<{ elapsed: number; max: number; exceeded: boolean } | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasNotifiedExceededRef = useRef(false);

  const theme = getThemeColors(contact?.x_gender || (contact?.title?.name?.includes('Sig.ra') ? 'female' : 'male'));

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Break timer effect
  useEffect(() => {
    // Clear any existing timer first
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }

    if (clockStatus?.is_on_break && clockStatus?.active_break) {
      const activeBreak = clockStatus.active_break;
      const startTime = new Date(activeBreak.started_at).getTime();
      const maxMs = activeBreak.max_minutes * 60 * 1000;

      // Start timer
      breakTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const elapsedMinutes = Math.floor(elapsed / 60000);
        const exceeded = elapsed >= maxMs;

        // Se siamo al limite, blocca il conteggio
        const effectiveElapsed = exceeded ? activeBreak.max_minutes : elapsedMinutes;

        setBreakTimer({
          elapsed: effectiveElapsed,
          max: activeBreak.max_minutes,
          exceeded,
        });

        // Notifica quando supera il limite (una sola volta)
        if (exceeded && !hasNotifiedExceededRef.current) {
          hasNotifiedExceededRef.current = true;
          toast.error(`${activeBreak.name} terminata! Tempo scaduto. Torna al lavoro!`, {
            duration: 10000,
            icon: '⚠️',
          });
        }
      }, 1000);

      // Initial calculation
      const initialElapsed = Date.now() - startTime;
      const initialMinutes = Math.floor(initialElapsed / 60000);
      const initialExceeded = initialElapsed >= maxMs;
      setBreakTimer({
        elapsed: initialExceeded ? activeBreak.max_minutes : initialMinutes,
        max: activeBreak.max_minutes,
        exceeded: initialExceeded,
      });
    } else {
      // Clear timer when not on break
      setBreakTimer(null);
      hasNotifiedExceededRef.current = false;
    }

    // Cleanup function
    return () => {
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }
    };
  }, [clockStatus?.is_on_break, clockStatus?.active_break]);

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load contact from Odoo (with duplicate prevention)
  useEffect(() => {
    if (user?.email && !hasLoadedContactRef.current) {
      hasLoadedContactRef.current = true;
      loadContactFromOdoo(user.email);
    }
  }, [user?.email]);

  // Check consents (with duplicate prevention)
  useEffect(() => {
    if (contact?.id && !hasCheckedConsentsRef.current) {
      hasCheckedConsentsRef.current = true;
      checkConsents(contact.id);
    }
  }, [contact?.id]);

  // Request GPS on mount
  useEffect(() => {
    requestGPS();
  }, []);

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS non supportato');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(`GPS: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const loadContactFromOdoo = async (email: string) => {
    setLoadingContact(true);
    setContactError(null);
    try {
      const res = await fetch(`/api/time-attendance/contact?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.success && data.data) {
        setContact(data.data.contact);
        setCompany(data.data.company);
        setEmployees(data.data.employees || []);
        // Toast con ID univoco per evitare duplicati
        toast.success(`Benvenuto, ${data.data.contact.name}!`, { id: 'welcome-toast' });
        if (data.data.contact?.id) {
          loadClockStatus(data.data.contact.id);
        }
      } else {
        setContactError(data.error || 'Contatto non trovato');
        toast.error(data.error || 'Contatto non trovato');
      }
    } catch {
      setContactError('Errore di rete');
      toast.error('Errore di rete');
    } finally {
      setLoadingContact(false);
    }
  };

  const loadClockStatus = async (contactId: number) => {
    try {
      const res = await fetch(`/api/time-attendance/clock?contact_id=${contactId}`);
      const data = await res.json();
      if (data.success) {
        setClockStatus(data.data);
      }
    } catch (error) {
      console.error('Error loading clock status:', error);
    }
  };

  // Load company dashboard data
  const loadCompanyDashboard = useCallback(async (companyId: number) => {
    setLoadingDashboard(true);
    try {
      const res = await fetch(`/api/time-attendance/dashboard?company_id=${companyId}`);
      const data = await res.json();
      if (data.success) {
        setCompanyDashboard(data.data);
      }
    } catch (error) {
      console.error('Error loading company dashboard:', error);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  // Auto-load company dashboard if user is a company
  useEffect(() => {
    if (contact?.is_company && contact.id) {
      loadCompanyDashboard(contact.id);
      // Refresh ogni 30 secondi
      const interval = setInterval(() => loadCompanyDashboard(contact.id), 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [contact?.is_company, contact?.id, loadCompanyDashboard]);

  const checkConsents = async (contactId: number) => {
    try {
      const res = await fetch(`/api/time-attendance/consent?contact_id=${contactId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setConsentsGranted({
          gps_tracking: data.data.consents.gps_tracking?.granted || false,
          data_processing: data.data.consents.data_processing?.granted || false,
          privacy_policy: data.data.consents.privacy_policy?.granted || false,
        });
        setAllConsentsGranted(data.data.all_granted);
        if (!data.data.all_granted) {
          setShowConsentModal(true);
        }
      }
    } catch {
      setShowConsentModal(true);
    }
  };

  const handleSubmitConsents = async () => {
    if (!contact?.id) return;
    setConsentLoading(true);
    try {
      const res = await fetch('/api/time-attendance/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id, consents: consentsGranted }),
      });
      const data = await res.json();
      if (data.success) {
        setAllConsentsGranted(data.data.all_granted);
        if (data.data.all_granted) {
          setShowConsentModal(false);
          toast.success('Consensi registrati!');
        } else {
          toast.error('Devi accettare tutti i consensi');
        }
      }
    } catch {
      toast.error('Errore nel salvataggio');
    } finally {
      setConsentLoading(false);
    }
  };

  // ==================== CLOCK HANDLERS ====================
  const handleClockButton = (type: 'clock_in' | 'clock_out') => {
    if (!contact) {
      toast.error('Dati contatto non caricati');
      return;
    }

    // Per clock_in/out, serve QR + GPS
    if (!gpsPosition) {
      toast.error('Attiva il GPS per timbrare');
      requestGPS();
      return;
    }

    setPendingClockType(type);
    setShowQRScanner(true);
    toast('Scansiona il QR Code della sede', { icon: '📱' });
  };

  const handleQRScanSuccess = async (qrSecret: string, locationData: { location_name: string; distance_meters: number }) => {
    setShowQRScanner(false);
    setScannedQRSecret(qrSecret);

    if (!pendingClockType || !contact || !gpsPosition) return;

    setIsClocking(true);

    try {
      const res = await fetch('/api/time-attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          company_id: company?.id,
          entry_type: pendingClockType,
          latitude: gpsPosition.lat,
          longitude: gpsPosition.lng,
          qr_secret: qrSecret,
        }),
      });

      const data = await res.json();

      if (data.success) {
        loadClockStatus(contact.id);
        const messages = {
          clock_in: `Entrata registrata! Sede: ${locationData.location_name}`,
          clock_out: `Uscita registrata! Sede: ${locationData.location_name}`,
        };
        toast.success(messages[pendingClockType]);
      } else {
        toast.error(data.error || 'Errore timbratura');
      }
    } catch {
      toast.error('Errore di connessione');
    } finally {
      setIsClocking(false);
      setPendingClockType(null);
      setScannedQRSecret(null);
    }
  };

  const handleBreak = async (type: 'break_start' | 'break_end', breakType?: 'coffee_break' | 'lunch_break') => {
    if (!contact) {
      toast.error('Dati contatto non caricati');
      return;
    }

    // Per break_start serve il break_type
    if (type === 'break_start' && !breakType) {
      toast.error('Seleziona il tipo di pausa');
      return;
    }

    setIsClocking(true);
    try {
      const res = await fetch('/api/time-attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          company_id: company?.id,
          entry_type: type,
          break_type: breakType,
          // GPS opzionale per le pause
          latitude: gpsPosition?.lat,
          longitude: gpsPosition?.lng,
        }),
      });

      const data = await res.json();
      if (data.success) {
        loadClockStatus(contact.id);
        if (type === 'break_start' && breakType) {
          const config = BREAK_CONFIG[breakType];
          toast.success(`${config.name} iniziata! Max ${config.maxMinutes} minuti.`, { icon: '☕' });
        } else {
          toast.success('Pausa terminata. Buon lavoro!', { icon: '💪' });
        }
      } else {
        toast.error(data.error || 'Errore');
      }
    } catch {
      toast.error('Errore di connessione');
    } finally {
      setIsClocking(false);
    }
  };

  // ==================== RENDER HELPERS ====================
  const formatTime = (date: Date) => date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const formatHours = (hours: number) => { const h = Math.floor(hours); const m = Math.round((hours - h) * 60); return `${h}h ${m}m`; };

  // ==================== LOADING STATE ====================
  if (authLoading || loadingContact) {
    return (
      <div className={`min-h-screen ${theme.gradient} flex items-center justify-center`}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  // ==================== CONTACT NOT FOUND ====================
  if (!contact && !loadingContact) {
    return (
      <div className={`min-h-screen ${theme.gradient} flex flex-col items-center justify-center p-4`}>
        <Toaster position="top-center" />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md p-8 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/20 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Contatto non trovato</h2>
          <p className="text-white/70 mb-4">{contactError || 'Non trovato in Odoo'}</p>
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <p className="text-white/50 text-sm">Email cercata:</p>
            <p className="text-white font-mono">{user?.email}</p>
          </div>
          <button onClick={() => user?.email && loadContactFromOdoo(user.email)}
            className="w-full py-3 px-6 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium">Riprova</button>
          <button onClick={() => router.push('/dashboard')}
            className="w-full mt-3 py-3 px-6 bg-white/10 hover:bg-white/20 text-white/70 rounded-xl">Torna alla Dashboard</button>
        </motion.div>
      </div>
    );
  }

  const isOnDuty = clockStatus?.is_on_duty || false;
  const isOnBreak = clockStatus?.is_on_break || false;

  // ==================== MAIN RENDER ====================
  return (
    <div className={`min-h-screen ${theme.gradient}`}>
      <Toaster position="top-center" />

      <main className="pb-24 px-4">
        {/* Company Dashboard - Solo per aziende */}
        {contact?.is_company && (
          <div className="max-w-6xl mx-auto pt-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${theme.gradient} flex items-center justify-center shadow-lg`}>
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{contact?.name}</h1>
                  <p className="text-white/60 text-sm">Dashboard Presenze</p>
                </div>
              </div>
              <button
                onClick={() => contact.id && loadCompanyDashboard(contact.id)}
                disabled={loadingDashboard}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${loadingDashboard ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Stats Cards */}
            {companyDashboard && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-green-600/20 border border-emerald-400/40 shadow-lg shadow-emerald-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/30">
                      <CheckCircle className="w-5 h-5 text-emerald-300" />
                    </div>
                    <span className="text-emerald-200 text-sm font-medium">In Servizio</span>
                  </div>
                  <div className="text-4xl font-bold text-white">{companyDashboard.stats.on_duty}</div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-600/20 border border-amber-400/40 shadow-lg shadow-amber-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/30">
                      <Coffee className="w-5 h-5 text-amber-300" />
                    </div>
                    <span className="text-amber-200 text-sm font-medium">In Pausa</span>
                  </div>
                  <div className="text-4xl font-bold text-white">{companyDashboard.stats.on_break}</div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-slate-500/30 to-gray-600/20 border border-slate-400/40 shadow-lg shadow-slate-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-slate-500/30">
                      <Users className="w-5 h-5 text-slate-300" />
                    </div>
                    <span className="text-slate-200 text-sm font-medium">Fuori</span>
                  </div>
                  <div className="text-4xl font-bold text-white">{companyDashboard.stats.off_duty}</div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/20 border border-cyan-400/40 shadow-lg shadow-cyan-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/30">
                      <TrendingUp className="w-5 h-5 text-cyan-300" />
                    </div>
                    <span className="text-cyan-200 text-sm font-medium">Ore Oggi</span>
                  </div>
                  <div className="text-4xl font-bold text-white">{companyDashboard.stats.total_hours_today.toFixed(1)}h</div>
                </motion.div>
              </div>
            )}

            {/* Hours Summary */}
            {companyDashboard && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-center">
                  <div className="text-purple-300 text-xs mb-1">Ieri</div>
                  <div className="text-xl font-bold text-white">{companyDashboard.stats.total_hours_yesterday.toFixed(1)}h</div>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-center">
                  <div className="text-cyan-300 text-xs mb-1">Oggi</div>
                  <div className="text-2xl font-bold text-white">{companyDashboard.stats.total_hours_today.toFixed(1)}h</div>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-center">
                  <div className="text-amber-300 text-xs mb-1">Settimana</div>
                  <div className="text-xl font-bold text-white">{companyDashboard.stats.total_hours_week.toFixed(1)}h</div>
                </div>
              </div>
            )}

            {/* Charts Section */}
            {companyDashboard && companyDashboard.employees.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Pie Chart - Status Distribution */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    Stato Dipendenti
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'In Servizio', value: companyDashboard.stats.on_duty - companyDashboard.stats.on_break, fill: '#22c55e' },
                            { name: 'In Pausa', value: companyDashboard.stats.on_break, fill: '#f97316' },
                            { name: 'Fuori', value: companyDashboard.stats.off_duty, fill: '#6b7280' },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                        >
                          {[
                            { name: 'In Servizio', value: companyDashboard.stats.on_duty - companyDashboard.stats.on_break, fill: '#22c55e' },
                            { name: 'In Pausa', value: companyDashboard.stats.on_break, fill: '#f97316' },
                            { name: 'Fuori', value: companyDashboard.stats.off_duty, fill: '#6b7280' },
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          labelStyle={{ color: 'white' }}
                        />
                        <Legend
                          wrapperStyle={{ color: 'white' }}
                          formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.8)' }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Bar Chart - Hours by Employee */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Ore Lavorate Oggi
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={companyDashboard.employees
                          .slice(0, 8) // Max 8 dipendenti per leggibilità
                          .map(emp => ({
                            name: emp.contact_name.split(' ')[0], // Solo nome
                            ore: emp.hours_worked_today,
                            full_name: emp.contact_name,
                          }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          domain={[0, 'auto']}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 12 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          width={55}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px' }}
                          labelStyle={{ color: 'white', fontWeight: 'bold' }}
                          formatter={(value: number) => [`${value.toFixed(1)}h`, 'Ore']}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.full_name || label}
                        />
                        <Bar dataKey="ore" radius={[0, 8, 8, 0]}>
                          {companyDashboard.employees.slice(0, 8).map((emp, index) => {
                            // Colori gradient per ogni barra
                            const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#84cc16'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Employee Cards */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Dipendenti ({companyDashboard?.stats.total_employees || 0})</h2>
            </div>

            {loadingDashboard && !companyDashboard ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            ) : companyDashboard?.employees.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nessun dipendente registrato</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companyDashboard?.employees.map((emp, i) => (
                  <motion.div
                    key={emp.contact_id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-4 rounded-2xl backdrop-blur-lg border ${
                      emp.is_on_duty
                        ? emp.is_on_break
                          ? 'bg-orange-500/10 border-orange-500/30'
                          : 'bg-green-500/10 border-green-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center ${
                        emp.is_on_duty ? (emp.is_on_break ? 'bg-orange-500/30' : 'bg-green-500/30') : 'bg-white/10'
                      }`}>
                        {emp.contact_image ? (
                          <img src={`data:image/png;base64,${emp.contact_image}`} alt="" className="w-full h-full rounded-xl object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-white/70" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white truncate">{emp.contact_name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            emp.is_on_duty
                              ? emp.is_on_break
                                ? 'bg-orange-500/30 text-orange-300'
                                : 'bg-green-500/30 text-green-300'
                              : 'bg-white/10 text-white/50'
                          }`}>
                            {emp.is_on_duty
                              ? emp.is_on_break
                                ? (emp.last_entry?.break_type === 'coffee_break' ? 'Pausa Caffè' :
                                   emp.last_entry?.break_type === 'lunch_break' ? 'Pausa Pranzo' : 'Pausa')
                                : 'In Servizio'
                              : 'Fuori'}
                          </span>
                        </div>
                        {emp.contact_function && (
                          <div className="text-xs text-white/50 truncate">{emp.contact_function}</div>
                        )}

                        {/* Hours Row */}
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-white/40" />
                            <span className="text-white/60">Oggi:</span>
                            <span className="text-white font-medium">{emp.hours_worked_today.toFixed(1)}h</span>
                          </div>
                          <div className="text-white/30">|</div>
                          <div>
                            <span className="text-white/40">Ieri:</span>
                            <span className="text-white/60 ml-1">{emp.hours_worked_yesterday.toFixed(1)}h</span>
                          </div>
                          <div className="text-white/30">|</div>
                          <div>
                            <span className="text-white/40">Sett:</span>
                            <span className="text-white/60 ml-1">{emp.hours_worked_week.toFixed(1)}h</span>
                          </div>
                        </div>

                        {/* Last Activity */}
                        {emp.last_entry && (
                          <div className="mt-2 text-xs text-white/40">
                            {emp.last_entry.entry_type === 'clock_in' ? 'Entrata' :
                             emp.last_entry.entry_type === 'clock_out' ? 'Uscita' :
                             emp.last_entry.entry_type === 'break_start' ? 'Pausa' : 'Ripresa'}{' '}
                            {new Date(emp.last_entry.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            {emp.last_entry.location_name && (
                              <span className="ml-1 text-blue-400">@ {emp.last_entry.location_name}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Admin Link */}
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/time-attendance/admin')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
              >
                <Settings className="w-5 h-5" />
                Gestione Sedi e QR Code
              </button>
            </div>
          </div>
        )}

        {/* Clock View - Solo per dipendenti (non aziende) */}
        {!contact?.is_company && view === 'clock' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] pt-8">
            {/* Profile Card */}
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-sm mb-8 p-6 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl ${theme.gradient} flex items-center justify-center shadow-lg`}>
                  {contact?.image_128 ? (
                    <img src={`data:image/png;base64,${contact.image_128}`} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">{contact?.name}</h2>
                  {contact?.function && <div className="flex items-center gap-1 text-white/70 text-sm"><Briefcase className="w-3 h-3" />{contact.function}</div>}
                  {company && <div className="flex items-center gap-1 text-white/60 text-xs mt-1"><Building2 className="w-3 h-3" />{company.name}</div>}
                </div>
              </div>
            </motion.div>

            {/* Clock Display */}
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-6">
              <div className="text-7xl md:text-8xl font-bold text-white font-mono tracking-tight drop-shadow-lg">
                {formatTime(currentTime)}
              </div>
              <div className="text-lg text-white/70 mt-2 capitalize">{formatDate(currentTime)}</div>
            </motion.div>

            {/* Status Badge */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className={`flex items-center gap-2 px-6 py-3 rounded-full mb-6 ${
                isOnDuty ? (isOnBreak ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-green-500/20 border border-green-500/50')
                : 'bg-white/10 border border-white/20'
              }`}>
              <div className={`w-3 h-3 rounded-full ${isOnDuty ? (isOnBreak ? 'bg-orange-400' : 'bg-green-400 animate-pulse') : 'bg-white/40'}`} />
              <span className="text-white font-medium">
                {isOnDuty ? (isOnBreak ? 'In Pausa' : 'In Servizio') : 'Fuori Servizio'}
              </span>
            </motion.div>

            {/* Hours Worked */}
            {clockStatus && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-8">
                <div className="text-sm text-white/60">Ore lavorate oggi</div>
                <div className="text-4xl font-bold text-white">{formatHours(clockStatus.hours_worked_today)}</div>
              </motion.div>
            )}

            {/* Main Clock Button */}
            <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => handleClockButton(isOnDuty ? 'clock_out' : 'clock_in')}
              disabled={isClocking}
              className={`w-44 h-44 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all ${
                isClocking ? 'bg-white/20' : isOnDuty
                ? 'bg-gradient-to-br from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700'
                : `${theme.gradient}`
              }`}>
              {isClocking ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : isOnDuty ? (
                <>
                  <LogOut className="w-14 h-14 text-white mb-2" />
                  <span className="font-bold text-xl text-white">USCITA</span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <QrCode className="w-8 h-8 text-white" />
                    <span className="text-white/70">+</span>
                    <Navigation className="w-8 h-8 text-white" />
                  </div>
                  <LogIn className="w-10 h-10 text-white mb-1" />
                  <span className="font-bold text-lg text-white">ENTRATA</span>
                </>
              )}
            </motion.button>

            {/* Break Buttons - Due tipi di pausa */}
            {isOnDuty && !isOnBreak && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center gap-4 mt-8">
                <p className="text-white/60 text-sm">Scegli tipo di pausa:</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleBreak('break_start', 'coffee_break')}
                    disabled={isClocking}
                    className="flex flex-col items-center gap-2 px-6 py-4 bg-amber-500/20 hover:bg-amber-500/30 text-white rounded-2xl border border-amber-500/50 transition-all"
                  >
                    <Coffee className="w-6 h-6 text-amber-400" />
                    <span className="font-medium">Pausa Caffè</span>
                    <span className="text-xs text-white/50">max 20 min</span>
                  </button>
                  <button
                    onClick={() => handleBreak('break_start', 'lunch_break')}
                    disabled={isClocking}
                    className="flex flex-col items-center gap-2 px-6 py-4 bg-orange-500/20 hover:bg-orange-500/30 text-white rounded-2xl border border-orange-500/50 transition-all"
                  >
                    <UtensilsCrossed className="w-6 h-6 text-orange-400" />
                    <span className="font-medium">Pausa Pranzo</span>
                    <span className="text-xs text-white/50">max 1 ora</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Break Timer Display */}
            {isOnBreak && breakTimer && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`mt-8 p-6 rounded-3xl ${breakTimer.exceeded ? 'bg-red-500/20 border border-red-500/50' : 'bg-orange-500/20 border border-orange-500/50'}`}
              >
                <div className="flex flex-col items-center gap-4">
                  {/* Break type icon and name */}
                  <div className="flex items-center gap-2">
                    {clockStatus?.active_break?.type === 'coffee_break' ? (
                      <Coffee className={`w-6 h-6 ${breakTimer.exceeded ? 'text-red-400' : 'text-amber-400'}`} />
                    ) : (
                      <UtensilsCrossed className={`w-6 h-6 ${breakTimer.exceeded ? 'text-red-400' : 'text-orange-400'}`} />
                    )}
                    <span className={`font-semibold ${breakTimer.exceeded ? 'text-red-400' : 'text-white'}`}>
                      {clockStatus?.active_break?.name || 'In Pausa'}
                    </span>
                  </div>

                  {/* Timer display */}
                  <div className="text-center">
                    <div className={`text-4xl font-mono font-bold ${breakTimer.exceeded ? 'text-red-400' : 'text-white'}`}>
                      {breakTimer.elapsed} / {breakTimer.max} min
                    </div>
                    {breakTimer.exceeded && (
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="flex items-center justify-center gap-2 mt-2 text-red-400"
                      >
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold">TEMPO SCADUTO!</span>
                        <AlertTriangle className="w-5 h-5" />
                      </motion.div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (breakTimer.elapsed / breakTimer.max) * 100)}%` }}
                      className={`h-full rounded-full ${breakTimer.exceeded ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                    />
                  </div>

                  {/* End break button */}
                  <button
                    onClick={() => handleBreak('break_end')}
                    disabled={isClocking}
                    className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-medium transition-all ${
                      breakTimer.exceeded
                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                        : 'bg-green-500/20 hover:bg-green-500/30 text-white border border-green-500/50'
                    }`}
                  >
                    <Play className="w-5 h-5" />
                    {breakTimer.exceeded ? 'TORNA AL LAVORO!' : 'Fine Pausa'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* GPS Status */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex items-center gap-2 text-sm text-white/50">
              {gpsLoading ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Rilevamento GPS...</>
              ) : gpsPosition ? (
                <><MapPin className="w-4 h-4 text-green-400" />GPS attivo (precisione: {Math.round(gpsPosition.accuracy)}m)</>
              ) : gpsError ? (
                <><AlertCircle className="w-4 h-4 text-red-400" />{gpsError}</>
              ) : (
                <><MapPin className="w-4 h-4" />GPS pronto</>
              )}
            </motion.div>
          </div>
        )}

        {/* History View - Solo per dipendenti */}
        {!contact?.is_company && view === 'history' && (
          <div className="py-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Storico Oggi</h2>
            {(!clockStatus?.entries_today || clockStatus.entries_today.length === 0) ? (
              <div className="text-center py-12 text-white/50">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nessuna timbratura oggi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clockStatus.entries_today.map((entry: TimeEntry & { break_type?: string }, i) => (
                  <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur rounded-2xl border border-white/10">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      entry.entry_type === 'clock_in' ? 'bg-green-500/30' :
                      entry.entry_type === 'clock_out' ? 'bg-red-500/30' :
                      entry.break_type === 'coffee_break' ? 'bg-amber-500/30' : 'bg-orange-500/30'
                    }`}>
                      {entry.entry_type === 'clock_in' ? <LogIn className="w-6 h-6 text-green-400" /> :
                       entry.entry_type === 'clock_out' ? <LogOut className="w-6 h-6 text-red-400" /> :
                       entry.entry_type === 'break_start' ? (
                         entry.break_type === 'coffee_break' ? <Coffee className="w-6 h-6 text-amber-400" /> :
                         <UtensilsCrossed className="w-6 h-6 text-orange-400" />
                       ) : <Play className="w-6 h-6 text-blue-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">
                        {entry.entry_type === 'clock_in' ? 'Entrata' :
                         entry.entry_type === 'clock_out' ? 'Uscita' :
                         entry.entry_type === 'break_start' ? (
                           entry.break_type === 'coffee_break' ? 'Pausa Caffè' : 'Pausa Pranzo'
                         ) : 'Fine Pausa'}
                      </div>
                      <div className="text-sm text-white/60">
                        {new Date(entry.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        {entry.location_name && <span className="ml-2 text-blue-400"> {entry.location_name}</span>}
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Team View - Solo per dipendenti */}
        {!contact?.is_company && view === 'team' && (
          <div className="py-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Team ({employees.length})</h2>
            {employees.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nessun dipendente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employees.map((emp, i) => (
                  <motion.div key={emp.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur rounded-2xl border border-white/10">
                    <div className={`w-12 h-12 rounded-xl ${theme.gradient} flex items-center justify-center`}>
                      {emp.image_128 ? (
                        <img src={`data:image/png;base64,${emp.image_128}`} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">{emp.name}</div>
                      {emp.function && <div className="text-sm text-white/60">{emp.function}</div>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation - Versione diversa per aziende vs dipendenti */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-lg border-t border-white/10 px-4 py-3 z-40">
        <div className="flex justify-around max-w-lg mx-auto">
          <button onClick={() => router.push('/dashboard')} className="flex flex-col items-center py-2 px-4 rounded-xl hover:bg-white/10">
            <Home className="w-6 h-6 text-white/50" /><span className="text-xs mt-1 text-white/50">Home</span>
          </button>

          {/* Per aziende: solo Dashboard e Admin */}
          {contact?.is_company ? (
            <>
              <button className="flex flex-col items-center py-2 px-4 rounded-xl bg-white/20">
                <Users className="w-6 h-6 text-white" />
                <span className="text-xs mt-1 text-white">Dashboard</span>
              </button>
              <button onClick={() => router.push('/time-attendance/admin')} className="flex flex-col items-center py-2 px-4 rounded-xl hover:bg-white/10">
                <Settings className="w-6 h-6 text-white/50" />
                <span className="text-xs mt-1 text-white/50">Admin</span>
              </button>
            </>
          ) : (
            <>
              {/* Per dipendenti: Timbra, Storico, Team */}
              <button onClick={() => setView('clock')} className={`flex flex-col items-center py-2 px-4 rounded-xl ${view === 'clock' ? 'bg-white/20' : ''}`}>
                <Clock className={`w-6 h-6 ${view === 'clock' ? 'text-white' : 'text-white/50'}`} />
                <span className={`text-xs mt-1 ${view === 'clock' ? 'text-white' : 'text-white/50'}`}>Timbra</span>
              </button>
              <button onClick={() => setView('history')} className={`flex flex-col items-center py-2 px-4 rounded-xl ${view === 'history' ? 'bg-white/20' : ''}`}>
                <Calendar className={`w-6 h-6 ${view === 'history' ? 'text-white' : 'text-white/50'}`} />
                <span className={`text-xs mt-1 ${view === 'history' ? 'text-white' : 'text-white/50'}`}>Storico</span>
              </button>
              {/* Team button - visibile a dipendenti con parent company */}
              {company && (
                <button onClick={() => setView('team')} className={`flex flex-col items-center py-2 px-4 rounded-xl ${view === 'team' ? 'bg-white/20' : ''}`}>
                  <Users className={`w-6 h-6 ${view === 'team' ? 'text-white' : 'text-white/50'}`} />
                  <span className={`text-xs mt-1 ${view === 'team' ? 'text-white' : 'text-white/50'}`}>Team</span>
                </button>
              )}
            </>
          )}
        </div>
      </nav>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => { setShowQRScanner(false); setPendingClockType(null); }}
        onScanSuccess={handleQRScanSuccess}
        gpsPosition={gpsPosition}
      />

      {/* GDPR Consent Modal */}
      <AnimatePresence>
        {showConsentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl ${theme.gradient}`}><Shield className="w-8 h-8 text-white" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Privacy & Consensi</h2>
                  <p className="text-sm text-gray-500">Per usare l&apos;app devi accettare</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer">
                  <input type="checkbox" checked={consentsGranted.gps_tracking}
                    onChange={(e) => setConsentsGranted(prev => ({ ...prev, gps_tracking: e.target.checked }))}
                    className="w-5 h-5 mt-0.5 rounded" />
                  <div>
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">Tracciamento GPS</span></div>
                    <p className="text-sm text-gray-500 mt-1">Acconsento all&apos;utilizzo della mia posizione GPS per verificare la presenza.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer">
                  <input type="checkbox" checked={consentsGranted.data_processing}
                    onChange={(e) => setConsentsGranted(prev => ({ ...prev, data_processing: e.target.checked }))}
                    className="w-5 h-5 mt-0.5 rounded" />
                  <div>
                    <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">Trattamento Dati</span></div>
                    <p className="text-sm text-gray-500 mt-1">Acconsento al trattamento dei miei dati personali.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer">
                  <input type="checkbox" checked={consentsGranted.privacy_policy}
                    onChange={(e) => setConsentsGranted(prev => ({ ...prev, privacy_policy: e.target.checked }))}
                    className="w-5 h-5 mt-0.5 rounded" />
                  <div>
                    <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-purple-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">Privacy Policy</span></div>
                    <p className="text-sm text-gray-500 mt-1">Ho letto e accetto l&apos;informativa sulla privacy.</p>
                  </div>
                </label>
              </div>

              <button onClick={handleSubmitConsents}
                disabled={consentLoading || !Object.values(consentsGranted).every(Boolean)}
                className={`w-full mt-6 py-4 px-6 rounded-2xl text-white font-semibold transition-all ${
                  Object.values(consentsGranted).every(Boolean)
                    ? `bg-gradient-to-r ${theme.primary} hover:shadow-lg`
                    : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                }`}>
                {consentLoading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Salvando...</span>
                  : 'Accetta e Continua'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
