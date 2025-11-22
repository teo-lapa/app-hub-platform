'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  MapPin,
  User,
  Calendar,
  LogIn,
  LogOut,
  Coffee,
  Play,
  CheckCircle,
  AlertCircle,
  QrCode,
  Scan,
  Users,
  BarChart3,
  X,
  Camera,
  Navigation,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Shield,
  FileText,
  Download,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';

// ==================== TYPES ====================
interface OdooContact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  function?: string; // Posizione lavorativa
  title?: { id: number; name: string }; // Titolo (Sig., Sig.ra, etc.)
  parent_id?: [number, string]; // Azienda padre
  child_ids?: number[]; // Contatti figli (se è azienda)
  is_company: boolean;
  image_128?: string; // Avatar base64
  street?: string;
  city?: string;
  country_id?: [number, string];
  // Campo custom per genere (se esiste)
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
  last_entry: TimeEntry | null;
  today_entries: TimeEntry[];
  hours_worked_today: number;
  first_clock_in_today: string | null;
}

// ==================== THEME COLORS ====================
const getThemeColors = (gender?: string) => {
  if (gender === 'female') {
    return {
      primary: 'from-pink-500 to-purple-600',
      primarySolid: 'bg-pink-500',
      primaryHover: 'hover:bg-pink-600',
      secondary: 'bg-pink-100 dark:bg-pink-900/30',
      secondaryText: 'text-pink-700 dark:text-pink-400',
      accent: 'bg-purple-500',
      gradient: 'bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500',
      ring: 'ring-pink-500',
      border: 'border-pink-500',
    };
  }
  // Default: male / other
  return {
    primary: 'from-blue-500 to-cyan-600',
    primarySolid: 'bg-blue-500',
    primaryHover: 'hover:bg-blue-600',
    secondary: 'bg-blue-100 dark:bg-blue-900/30',
    secondaryText: 'text-blue-700 dark:text-blue-400',
    accent: 'bg-cyan-500',
    gradient: 'bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-500',
    ring: 'ring-blue-500',
    border: 'border-blue-500',
  };
};

// ==================== MAIN COMPONENT ====================
export default function TimeAttendancePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

  // Contact data from Odoo
  const [contact, setContact] = useState<OdooContact | null>(null);
  const [company, setCompany] = useState<OdooContact | null>(null);
  const [employees, setEmployees] = useState<OdooContact[]>([]);
  const [loadingContact, setLoadingContact] = useState(true);

  // Clock state
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [isClocking, setIsClocking] = useState(false);

  // UI state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [view, setView] = useState<'clock' | 'history' | 'team'>('clock');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrVerified, setQrVerified] = useState(false);

  // GPS state
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // GDPR Consent state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentsGranted, setConsentsGranted] = useState({
    gps_tracking: false,
    data_processing: false,
    privacy_policy: false,
  });
  const [allConsentsGranted, setAllConsentsGranted] = useState(false);

  // Theme based on gender
  const theme = getThemeColors(contact?.x_gender || (contact?.title?.name?.includes('Sig.ra') ? 'female' : 'male'));

  // ==================== CLOCK UPDATE ====================
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== AUTH CHECK ====================
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/'); // Landing page con login
    }
  }, [authLoading, isAuthenticated, router]);

  // ==================== LOAD CONTACT FROM ODOO ====================
  useEffect(() => {
    if (user?.email) {
      loadContactFromOdoo(user.email);
    }
  }, [user?.email]);

  // ==================== CHECK CONSENTS ====================
  useEffect(() => {
    if (contact?.id) {
      checkConsents(contact.id);
    }
  }, [contact?.id]);

  const checkConsents = async (contactId: number) => {
    try {
      const res = await fetch(`/api/time-attendance/consent?contact_id=${contactId}`);
      const data = await res.json();

      if (data.success && data.data) {
        const { consents, all_granted } = data.data;
        setConsentsGranted({
          gps_tracking: consents.gps_tracking?.granted || false,
          data_processing: consents.data_processing?.granted || false,
          privacy_policy: consents.privacy_policy?.granted || false,
        });
        setAllConsentsGranted(all_granted);

        // Se non tutti i consensi sono dati, mostra il modal
        if (!all_granted) {
          setShowConsentModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking consents:', error);
      // In caso di errore, mostra comunque il modal per sicurezza
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
        body: JSON.stringify({
          contact_id: contact.id,
          consents: consentsGranted,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setAllConsentsGranted(data.data.all_granted);
        if (data.data.all_granted) {
          setShowConsentModal(false);
          toast.success('Consensi registrati!');
        } else {
          toast.error('Devi accettare tutti i consensi per usare l\'app');
        }
      }
    } catch (error) {
      toast.error('Errore nel salvataggio dei consensi');
    } finally {
      setConsentLoading(false);
    }
  };

  const loadContactFromOdoo = async (email: string) => {
    setLoadingContact(true);
    try {
      const res = await fetch(`/api/time-attendance/contact?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.success && data.data) {
        setContact(data.data.contact);
        setCompany(data.data.company);
        setEmployees(data.data.employees || []);

        // Load clock status
        if (data.data.contact?.id) {
          loadClockStatus(data.data.contact.id);
        }
      }
    } catch (error) {
      console.error('Error loading contact:', error);
      toast.error('Errore nel caricamento dati');
    } finally {
      setLoadingContact(false);
    }
  };

  // ==================== LOAD CLOCK STATUS ====================
  const loadClockStatus = async (contactId: number) => {
    try {
      const res = await fetch(`/api/time-attendance/status?contact_id=${contactId}`);
      const data = await res.json();
      if (data.success) {
        setClockStatus(data.data);
      }
    } catch (error) {
      console.error('Error loading clock status:', error);
    }
  };

  // ==================== GET GPS POSITION ====================
  const getGPSPosition = useCallback((): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      setGpsLoading(true);
      setGpsError(null);

      if (!navigator.geolocation) {
        setGpsError('GPS non supportato');
        setGpsLoading(false);
        reject(new Error('GPS non supportato'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setGpsPosition(pos);
          setGpsLoading(false);
          resolve(pos);
        },
        (error) => {
          setGpsError(`Errore GPS: ${error.message}`);
          setGpsLoading(false);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  // ==================== HANDLE CLOCK ====================
  const handleClock = async (entryType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    if (!contact || !company) {
      toast.error('Dati contatto non caricati');
      return;
    }

    // Per clock_in richiedi QR + GPS
    if (entryType === 'clock_in' && !qrVerified) {
      setShowQRScanner(true);
      toast('Scansiona il QR Code per timbrare', { icon: '📱' });
      return;
    }

    setIsClocking(true);

    try {
      // Ottieni posizione GPS
      let position = gpsPosition;
      try {
        position = await getGPSPosition();
      } catch {
        // GPS fallito ma continuiamo
        console.warn('GPS non disponibile');
      }

      const res = await fetch('/api/time-attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          company_id: company.id,
          entry_type: entryType,
          latitude: position?.lat,
          longitude: position?.lng,
          accuracy: position?.accuracy,
          qr_code_verified: qrVerified,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setClockStatus(data.data);
        setQrVerified(false); // Reset QR

        const messages = {
          clock_in: '🟢 Entrata registrata!',
          clock_out: '🔴 Uscita registrata!',
          break_start: '☕ Inizio pausa',
          break_end: '▶️ Fine pausa',
        };
        toast.success(messages[entryType]);
      } else {
        toast.error(data.error || 'Errore timbratura');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    } finally {
      setIsClocking(false);
    }
  };

  // ==================== QR CODE HANDLER ====================
  const handleQRScan = (qrData: string) => {
    // Verifica che il QR sia valido per questa azienda
    try {
      const qrInfo = JSON.parse(qrData);
      if (qrInfo.company_id === company?.id) {
        setQrVerified(true);
        setShowQRScanner(false);
        toast.success('QR Code verificato!');
        // Procedi con clock_in
        handleClock('clock_in');
      } else {
        toast.error('QR Code non valido per questa azienda');
      }
    } catch {
      toast.error('QR Code non riconosciuto');
    }
  };

  // ==================== FORMAT HELPERS ====================
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // ==================== LOADING STATE ====================
  if (authLoading || loadingContact) {
    return (
      <div className={`min-h-screen ${theme.gradient} flex items-center justify-center`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // ==================== RENDER CLOCK VIEW ====================
  const renderClockView = () => {
    const isOnDuty = clockStatus?.is_on_duty || false;

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        {/* Profile Card */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`w-full max-w-sm mb-8 p-6 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl`}
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className={`w-16 h-16 rounded-2xl ${theme.gradient} flex items-center justify-center shadow-lg`}>
              {contact?.image_128 ? (
                <img
                  src={`data:image/png;base64,${contact.image_128}`}
                  alt={contact.name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-white" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{contact?.name || user?.name}</h2>
              {contact?.function && (
                <div className="flex items-center gap-1 text-white/70 text-sm">
                  <Briefcase className="w-3 h-3" />
                  {contact.function}
                </div>
              )}
              {company && (
                <div className="flex items-center gap-1 text-white/60 text-xs mt-1">
                  <Building2 className="w-3 h-3" />
                  {company.name}
                </div>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
            {contact?.mobile && (
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <Phone className="w-3 h-3" />
                {contact.mobile}
              </div>
            )}
            {contact?.email && (
              <div className="flex items-center gap-2 text-white/60 text-xs truncate">
                <Mail className="w-3 h-3" />
                {contact.email}
              </div>
            )}
          </div>
        </motion.div>

        {/* Clock Display */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mb-6"
        >
          <div className="text-7xl md:text-8xl font-bold text-white font-mono tracking-tight drop-shadow-lg">
            {formatTime(currentTime)}
          </div>
          <div className="text-lg text-white/70 mt-2 capitalize">
            {formatDate(currentTime)}
          </div>
        </motion.div>

        {/* Status Badge */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`flex items-center gap-2 px-6 py-3 rounded-full mb-6 ${
            isOnDuty
              ? 'bg-green-500/20 border border-green-500/50'
              : 'bg-white/10 border border-white/20'
          }`}
        >
          <div className={`w-3 h-3 rounded-full ${isOnDuty ? 'bg-green-400 animate-pulse' : 'bg-white/40'}`} />
          <span className="text-white font-medium">
            {isOnDuty ? 'In Servizio' : 'Fuori Servizio'}
          </span>
        </motion.div>

        {/* Hours Worked Today */}
        {clockStatus && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <div className="text-sm text-white/60">Ore lavorate oggi</div>
            <div className="text-4xl font-bold text-white">
              {formatHours(clockStatus.hours_worked_today)}
            </div>
          </motion.div>
        )}

        {/* Main Clock Button */}
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleClock(isOnDuty ? 'clock_out' : 'clock_in')}
          disabled={isClocking}
          className={`w-44 h-44 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all ${
            isClocking
              ? 'bg-white/20'
              : isOnDuty
              ? 'bg-gradient-to-br from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700'
              : `${theme.gradient} hover:shadow-3xl`
          }`}
        >
          {isClocking ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 border-4 border-white border-t-transparent rounded-full"
            />
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
        {isOnDuty && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-4 mt-8"
          >
            <button
              onClick={() => handleClock('break_start')}
              disabled={isClocking}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all border border-white/20"
            >
              <Coffee className="w-5 h-5" />
              Pausa
            </button>
            <button
              onClick={() => handleClock('break_end')}
              disabled={isClocking}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all border border-white/20"
            >
              <Play className="w-5 h-5" />
              Riprendi
            </button>
          </motion.div>
        )}

        {/* GPS Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex items-center gap-2 text-sm text-white/50"
        >
          {gpsLoading ? (
            <>
              <div className="w-3 h-3 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
              Rilevamento GPS...
            </>
          ) : gpsPosition ? (
            <>
              <MapPin className="w-4 h-4 text-green-400" />
              GPS attivo (precisione: {Math.round(gpsPosition.accuracy)}m)
            </>
          ) : gpsError ? (
            <>
              <AlertCircle className="w-4 h-4 text-red-400" />
              {gpsError}
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              GPS pronto
            </>
          )}
        </motion.div>
      </div>
    );
  };

  // ==================== RENDER HISTORY VIEW ====================
  const renderHistoryView = () => {
    const entries = clockStatus?.today_entries || [];

    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Storico Oggi</h2>

        {entries.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Nessuna timbratura oggi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur rounded-2xl border border-white/10"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  entry.entry_type === 'clock_in' ? 'bg-green-500/30' :
                  entry.entry_type === 'clock_out' ? 'bg-red-500/30' :
                  'bg-orange-500/30'
                }`}>
                  {entry.entry_type === 'clock_in' ? (
                    <LogIn className="w-6 h-6 text-green-400" />
                  ) : entry.entry_type === 'clock_out' ? (
                    <LogOut className="w-6 h-6 text-red-400" />
                  ) : entry.entry_type === 'break_start' ? (
                    <Coffee className="w-6 h-6 text-orange-400" />
                  ) : (
                    <Play className="w-6 h-6 text-blue-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="font-medium text-white">
                    {entry.entry_type === 'clock_in' ? 'Entrata' :
                     entry.entry_type === 'clock_out' ? 'Uscita' :
                     entry.entry_type === 'break_start' ? 'Inizio Pausa' : 'Fine Pausa'}
                  </div>
                  <div className="text-sm text-white/60">
                    {new Date(entry.timestamp).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {entry.qr_code_verified && (
                      <span className="ml-2 text-green-400">
                        <QrCode className="w-3 h-3 inline" /> QR
                      </span>
                    )}
                    {entry.latitude && (
                      <span className="ml-2 text-blue-400">
                        <MapPin className="w-3 h-3 inline" /> GPS
                      </span>
                    )}
                  </div>
                </div>

                <CheckCircle className="w-5 h-5 text-green-400" />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER TEAM VIEW (FOR COMPANIES) ====================
  const renderTeamView = () => {
    if (!contact?.is_company && !company?.is_company) {
      return (
        <div className="px-4 py-12 text-center text-white/50">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Solo le aziende possono vedere il team</p>
        </div>
      );
    }

    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6">
          Team ({employees.length} dipendenti)
        </h2>

        <div className="space-y-3">
          {employees.map((emp, index) => (
            <motion.div
              key={emp.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur rounded-2xl border border-white/10"
            >
              <div className={`w-12 h-12 rounded-xl ${theme.gradient} flex items-center justify-center`}>
                {emp.image_128 ? (
                  <img
                    src={`data:image/png;base64,${emp.image_128}`}
                    alt={emp.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>

              <div className="flex-1">
                <div className="font-medium text-white">{emp.name}</div>
                {emp.function && (
                  <div className="text-sm text-white/60">{emp.function}</div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  // ==================== QR SCANNER MODAL ====================
  const renderQRScanner = () => (
    <AnimatePresence>
      {showQRScanner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Scansiona QR Code</h3>
              <button
                onClick={() => setShowQRScanner(false)}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="aspect-square bg-black rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden">
              <div className="absolute inset-4 border-2 border-white/30 rounded-2xl" />
              <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />

              <div className="text-center text-white/50">
                <Camera className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Inquadra il QR Code</p>
              </div>

              {/* Scan line animation */}
              <motion.div
                animate={{ y: [-100, 100] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
              />
            </div>

            <p className="text-center text-white/60 text-sm">
              Scansiona il QR Code esposto nel locale per confermare la tua presenza
            </p>

            {/* Demo button for testing */}
            <button
              onClick={() => handleQRScan(JSON.stringify({ company_id: company?.id }))}
              className={`w-full mt-4 py-3 ${theme.gradient} text-white font-semibold rounded-xl`}
            >
              Demo: Simula Scansione
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div className={`min-h-screen ${theme.gradient}`}>
      <Toaster position="top-center" />

      {/* Main Content */}
      <main className="pb-24">
        {view === 'clock' && renderClockView()}
        {view === 'history' && renderHistoryView()}
        {view === 'team' && renderTeamView()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-lg border-t border-white/10 px-4 py-3 z-40">
        <div className="flex justify-around max-w-lg mx-auto">
          <button
            onClick={() => setView('clock')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
              view === 'clock' ? 'bg-white/20' : ''
            }`}
          >
            <Clock className={`w-6 h-6 ${view === 'clock' ? 'text-white' : 'text-white/50'}`} />
            <span className={`text-xs mt-1 ${view === 'clock' ? 'text-white' : 'text-white/50'}`}>
              Timbra
            </span>
          </button>

          <button
            onClick={() => setView('history')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
              view === 'history' ? 'bg-white/20' : ''
            }`}
          >
            <Calendar className={`w-6 h-6 ${view === 'history' ? 'text-white' : 'text-white/50'}`} />
            <span className={`text-xs mt-1 ${view === 'history' ? 'text-white' : 'text-white/50'}`}>
              Storico
            </span>
          </button>

          {(contact?.is_company || company) && (
            <button
              onClick={() => setView('team')}
              className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
                view === 'team' ? 'bg-white/20' : ''
              }`}
            >
              <Users className={`w-6 h-6 ${view === 'team' ? 'text-white' : 'text-white/50'}`} />
              <span className={`text-xs mt-1 ${view === 'team' ? 'text-white' : 'text-white/50'}`}>
                Team
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* QR Scanner Modal */}
      {renderQRScanner()}

      {/* GDPR Consent Modal */}
      <AnimatePresence>
        {showConsentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl ${theme.gradient}`}>
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Privacy & Consensi
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Per usare l&apos;app devi accettare i seguenti consensi
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* GPS Tracking Consent */}
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <input
                    type="checkbox"
                    checked={consentsGranted.gps_tracking}
                    onChange={(e) => setConsentsGranted(prev => ({
                      ...prev,
                      gps_tracking: e.target.checked
                    }))}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Tracciamento GPS
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Acconsento all&apos;utilizzo della mia posizione GPS per verificare la mia presenza sul luogo di lavoro durante le timbrature.
                    </p>
                  </div>
                </label>

                {/* Data Processing Consent */}
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <input
                    type="checkbox"
                    checked={consentsGranted.data_processing}
                    onChange={(e) => setConsentsGranted(prev => ({
                      ...prev,
                      data_processing: e.target.checked
                    }))}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Trattamento Dati
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Acconsento al trattamento dei miei dati personali (nome, email, orari di lavoro) per la gestione delle presenze aziendali.
                    </p>
                  </div>
                </label>

                {/* Privacy Policy Consent */}
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <input
                    type="checkbox"
                    checked={consentsGranted.privacy_policy}
                    onChange={(e) => setConsentsGranted(prev => ({
                      ...prev,
                      privacy_policy: e.target.checked
                    }))}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Privacy Policy
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Ho letto e accetto l&apos;informativa sulla privacy e le condizioni d&apos;uso dell&apos;applicazione.
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-6 text-xs text-gray-400 dark:text-gray-500">
                <p>
                  I tuoi dati saranno trattati in conformità al GDPR (Reg. UE 2016/679).
                  Puoi revocare il consenso in qualsiasi momento contattando l&apos;amministratore.
                </p>
              </div>

              <button
                onClick={handleSubmitConsents}
                disabled={consentLoading || !Object.values(consentsGranted).every(Boolean)}
                className={`w-full mt-6 py-4 px-6 rounded-2xl text-white font-semibold transition-all
                  ${Object.values(consentsGranted).every(Boolean)
                    ? `bg-gradient-to-r ${theme.primary} hover:shadow-lg hover:scale-[1.02]`
                    : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                  }`}
              >
                {consentLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                    Salvando...
                  </span>
                ) : (
                  'Accetta e Continua'
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
