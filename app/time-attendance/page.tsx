'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, MapPin, User, Calendar, LogIn, LogOut, Coffee, Play,
  CheckCircle, AlertCircle, QrCode, Users, X, Camera, Navigation,
  Building2, Briefcase, Phone, Mail, Shield, FileText, Home, Loader2, Settings,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

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

interface ClockStatus {
  is_on_duty: boolean;
  is_on_break: boolean;
  last_entry: TimeEntry | null;
  entries_today: TimeEntry[];
  hours_worked_today: number;
}

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

  const theme = getThemeColors(contact?.x_gender || (contact?.title?.name?.includes('Sig.ra') ? 'female' : 'male'));

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        toast.success(`Benvenuto, ${data.data.contact.name}!`);
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

  const handleBreak = async (type: 'break_start' | 'break_end') => {
    if (!contact || !gpsPosition || !scannedQRSecret) {
      toast.error('Scansiona prima il QR della sede');
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
          latitude: gpsPosition.lat,
          longitude: gpsPosition.lng,
          qr_secret: scannedQRSecret,
        }),
      });

      const data = await res.json();
      if (data.success) {
        loadClockStatus(contact.id);
        toast.success(type === 'break_start' ? 'Inizio pausa!' : 'Fine pausa!');
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
        {/* Clock View */}
        {view === 'clock' && (
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

            {/* Break Buttons */}
            {isOnDuty && !isOnBreak && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-4 mt-8">
                <button onClick={() => handleBreak('break_start')} disabled={isClocking}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/20">
                  <Coffee className="w-5 h-5" />Pausa
                </button>
              </motion.div>
            )}

            {isOnBreak && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-8">
                <button onClick={() => handleBreak('break_end')} disabled={isClocking}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-white rounded-2xl border border-green-500/50">
                  <Play className="w-5 h-5" />Riprendi Lavoro
                </button>
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

        {/* History View */}
        {view === 'history' && (
          <div className="py-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Storico Oggi</h2>
            {(!clockStatus?.entries_today || clockStatus.entries_today.length === 0) ? (
              <div className="text-center py-12 text-white/50">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nessuna timbratura oggi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clockStatus.entries_today.map((entry, i) => (
                  <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur rounded-2xl border border-white/10">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      entry.entry_type === 'clock_in' ? 'bg-green-500/30' :
                      entry.entry_type === 'clock_out' ? 'bg-red-500/30' : 'bg-orange-500/30'
                    }`}>
                      {entry.entry_type === 'clock_in' ? <LogIn className="w-6 h-6 text-green-400" /> :
                       entry.entry_type === 'clock_out' ? <LogOut className="w-6 h-6 text-red-400" /> :
                       entry.entry_type === 'break_start' ? <Coffee className="w-6 h-6 text-orange-400" /> :
                       <Play className="w-6 h-6 text-blue-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">
                        {entry.entry_type === 'clock_in' ? 'Entrata' :
                         entry.entry_type === 'clock_out' ? 'Uscita' :
                         entry.entry_type === 'break_start' ? 'Inizio Pausa' : 'Fine Pausa'}
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

        {/* Team View */}
        {view === 'team' && (
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-lg border-t border-white/10 px-4 py-3 z-40">
        <div className="flex justify-around max-w-lg mx-auto">
          <button onClick={() => router.push('/dashboard')} className="flex flex-col items-center py-2 px-4 rounded-xl hover:bg-white/10">
            <Home className="w-6 h-6 text-white/50" /><span className="text-xs mt-1 text-white/50">Home</span>
          </button>
          <button onClick={() => setView('clock')} className={`flex flex-col items-center py-2 px-4 rounded-xl ${view === 'clock' ? 'bg-white/20' : ''}`}>
            <Clock className={`w-6 h-6 ${view === 'clock' ? 'text-white' : 'text-white/50'}`} />
            <span className={`text-xs mt-1 ${view === 'clock' ? 'text-white' : 'text-white/50'}`}>Timbra</span>
          </button>
          <button onClick={() => setView('history')} className={`flex flex-col items-center py-2 px-4 rounded-xl ${view === 'history' ? 'bg-white/20' : ''}`}>
            <Calendar className={`w-6 h-6 ${view === 'history' ? 'text-white' : 'text-white/50'}`} />
            <span className={`text-xs mt-1 ${view === 'history' ? 'text-white' : 'text-white/50'}`}>Storico</span>
          </button>
          {(contact?.is_company || company) && (
            <>
              <button onClick={() => setView('team')} className={`flex flex-col items-center py-2 px-4 rounded-xl ${view === 'team' ? 'bg-white/20' : ''}`}>
                <Users className={`w-6 h-6 ${view === 'team' ? 'text-white' : 'text-white/50'}`} />
                <span className={`text-xs mt-1 ${view === 'team' ? 'text-white' : 'text-white/50'}`}>Team</span>
              </button>
              <button onClick={() => router.push('/time-attendance/admin')} className="flex flex-col items-center py-2 px-4 rounded-xl hover:bg-white/10">
                <Settings className="w-6 h-6 text-white/50" />
                <span className="text-xs mt-1 text-white/50">Admin</span>
              </button>
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
