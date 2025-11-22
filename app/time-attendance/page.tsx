'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  MapPin,
  User,
  Calendar,
  ChevronRight,
  LogIn,
  LogOut,
  Coffee,
  Play,
  CheckCircle,
  AlertCircle,
  Settings,
  BarChart3,
  Users,
  Building2,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// ==================== TYPES ====================
interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  avatar_url?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  geofencing_enabled: boolean;
}

interface TimeEntry {
  id: string;
  entry_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  is_within_geofence?: boolean;
  note?: string;
}

interface ClockStatus {
  is_on_duty: boolean;
  last_entry: TimeEntry | null;
  today_entries: TimeEntry[];
  hours_worked_today: number;
  first_clock_in_today: string | null;
}

interface GeofenceState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  isInsideGeofence: boolean | null;
  error: string | null;
}

// ==================== MAIN COMPONENT ====================
export default function TimeAttendancePage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);

  // Clock state
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [isClocking, setIsClocking] = useState(false);

  // UI state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [view, setView] = useState<'clock' | 'history' | 'admin'>('clock');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Login form
  const [loginForm, setLoginForm] = useState({
    org_slug: '',
    email: '',
    password: '',
  });
  const [loginError, setLoginError] = useState('');

  // Geofence state
  const [geofence, setGeofence] = useState<GeofenceState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    isInsideGeofence: null,
    error: null,
  });

  // ==================== CLOCK UPDATE ====================
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== AUTH CHECK ====================
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/time-attendance/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });

      const data = await res.json();
      if (data.success && data.data?.employee) {
        setEmployee(data.data.employee);
        setIsAuthenticated(true);
        fetchClockStatus(data.data.employee.id);
      } else {
        setShowLoginModal(true);
      }
    } catch {
      setShowLoginModal(true);
    }
  };

  // ==================== FETCH CLOCK STATUS ====================
  const fetchClockStatus = async (empId: string) => {
    try {
      const res = await fetch(`/api/time-attendance/clock?employee_id=${empId}`);
      const data = await res.json();
      if (data.success) {
        setClockStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching clock status:', error);
    }
  };

  // ==================== GEOLOCATION ====================
  const getLocation = useCallback((): Promise<GeofenceState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ...geofence, error: 'GPS non supportato' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const state: GeofenceState = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            isInsideGeofence: null, // TODO: Calcolare con le sedi
            error: null,
          };
          setGeofence(state);
          resolve(state);
        },
        (error) => {
          const state: GeofenceState = {
            latitude: null,
            longitude: null,
            accuracy: null,
            isInsideGeofence: null,
            error: `Errore GPS: ${error.message}`,
          };
          setGeofence(state);
          resolve(state);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, [geofence]);

  // ==================== LOGIN ====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch('/api/time-attendance/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          ...loginForm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEmployee(data.data.employee);
        setOrganization(data.data.organization);
        setIsAuthenticated(true);
        setShowLoginModal(false);
        fetchClockStatus(data.data.employee.id);
        toast.success(`Benvenuto, ${data.data.employee.name}!`);
      } else {
        setLoginError(data.error || 'Credenziali non valide');
      }
    } catch {
      setLoginError('Errore di connessione');
    }
  };

  // ==================== CLOCK IN/OUT ====================
  const handleClock = async (entryType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    if (!employee || !organization) return;

    setIsClocking(true);

    try {
      // Ottieni posizione GPS
      const location = await getLocation();

      const res = await fetch('/api/time-attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          org_id: organization.id,
          entry_type: entryType,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy_meters: location.accuracy,
          is_within_geofence: location.isInsideGeofence,
          clock_method: 'manual',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Aggiorna stato
        setClockStatus(prev => prev ? {
          ...prev,
          is_on_duty: data.data.is_on_duty,
          last_entry: data.data.entry,
          hours_worked_today: data.data.hours_worked_today,
          today_entries: [...(prev.today_entries || []), data.data.entry],
        } : null);

        toast.success(data.message);
      } else {
        toast.error(data.error || 'Errore durante la timbratura');
      }
    } catch {
      toast.error('Errore di connessione');
    } finally {
      setIsClocking(false);
    }
  };

  // ==================== LOGOUT ====================
  const handleLogout = async () => {
    await fetch('/api/time-attendance/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });

    setIsAuthenticated(false);
    setEmployee(null);
    setOrganization(null);
    setClockStatus(null);
    setShowLoginModal(true);
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
      year: 'numeric',
    });
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // ==================== RENDER LOGIN MODAL ====================
  const renderLoginModal = () => (
    <AnimatePresence>
      {showLoginModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Time & Attendance
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Accedi per timbrare
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Codice Azienda
                </label>
                <input
                  type="text"
                  value={loginForm.org_slug}
                  onChange={(e) => setLoginForm({ ...loginForm, org_slug: e.target.value })}
                  placeholder="es: mario-ristorante"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="tua@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="********"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {loginError && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                Accedi
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Non hai un account?{' '}
              <button className="text-blue-600 hover:underline">
                Registra la tua azienda
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ==================== RENDER CLOCK VIEW ====================
  const renderClockView = () => {
    const isOnDuty = clockStatus?.is_on_duty || false;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        {/* Orologio Grande */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mb-8"
        >
          <div className="text-6xl md:text-8xl font-bold text-gray-900 dark:text-white font-mono">
            {formatTime(currentTime)}
          </div>
          <div className="text-lg text-gray-500 dark:text-gray-400 mt-2 capitalize">
            {formatDate(currentTime)}
          </div>
        </motion.div>

        {/* Status Badge */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full mb-8 ${
            isOnDuty
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {isOnDuty ? 'In Servizio' : 'Fuori Servizio'}
        </motion.div>

        {/* Hours Worked Today */}
        {clockStatus && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center mb-8"
          >
            <div className="text-sm text-gray-500 dark:text-gray-400">Ore lavorate oggi</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatHours(clockStatus.hours_worked_today)}
            </div>
            {clockStatus.first_clock_in_today && (
              <div className="text-sm text-gray-400 mt-1">
                Primo ingresso: {new Date(clockStatus.first_clock_in_today).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </motion.div>
        )}

        {/* Main Clock Button */}
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleClock(isOnDuty ? 'clock_out' : 'clock_in')}
          disabled={isClocking}
          className={`w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-lg transition-all ${
            isClocking
              ? 'bg-gray-300 dark:bg-gray-700'
              : isOnDuty
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isClocking ? (
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
          ) : isOnDuty ? (
            <>
              <LogOut className="w-12 h-12 mb-2" />
              <span className="font-bold text-lg">USCITA</span>
            </>
          ) : (
            <>
              <LogIn className="w-12 h-12 mb-2" />
              <span className="font-bold text-lg">ENTRATA</span>
            </>
          )}
        </motion.button>

        {/* Break Buttons */}
        {isOnDuty && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex gap-4 mt-8"
          >
            <button
              onClick={() => handleClock('break_start')}
              disabled={isClocking}
              className="flex items-center gap-2 px-6 py-3 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
            >
              <Coffee className="w-5 h-5" />
              Inizio Pausa
            </button>
            <button
              onClick={() => handleClock('break_end')}
              disabled={isClocking}
              className="flex items-center gap-2 px-6 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Play className="w-5 h-5" />
              Fine Pausa
            </button>
          </motion.div>
        )}

        {/* GPS Status */}
        {geofence.latitude && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 mt-6 text-sm text-gray-500 dark:text-gray-400"
          >
            <MapPin className="w-4 h-4" />
            GPS attivo (precisione: {Math.round(geofence.accuracy || 0)}m)
          </motion.div>
        )}
      </div>
    );
  };

  // ==================== RENDER HISTORY VIEW ====================
  const renderHistoryView = () => {
    const entries = clockStatus?.today_entries || [];

    return (
      <div className="px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Storico Oggi
        </h2>

        {entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  entry.entry_type === 'clock_in' ? 'bg-green-100 dark:bg-green-900/30' :
                  entry.entry_type === 'clock_out' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-orange-100 dark:bg-orange-900/30'
                }`}>
                  {entry.entry_type === 'clock_in' ? (
                    <LogIn className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : entry.entry_type === 'clock_out' ? (
                    <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
                  ) : entry.entry_type === 'break_start' ? (
                    <Coffee className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {entry.entry_type === 'clock_in' ? 'Entrata' :
                     entry.entry_type === 'clock_out' ? 'Uscita' :
                     entry.entry_type === 'break_start' ? 'Inizio Pausa' : 'Fine Pausa'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(entry.timestamp).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {entry.is_within_geofence && (
                      <span className="ml-2 text-green-500">
                        <MapPin className="w-3 h-3 inline" /> In sede
                      </span>
                    )}
                  </div>
                </div>

                <CheckCircle className="w-5 h-5 text-green-500" />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Toaster position="top-center" />

      {/* Header */}
      {isAuthenticated && employee && (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-40">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {employee.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {organization?.name || 'Organizzazione'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-lg mx-auto pb-24">
        {isAuthenticated ? (
          view === 'clock' ? renderClockView() : renderHistoryView()
        ) : (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      {isAuthenticated && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 z-40">
          <div className="flex justify-around max-w-lg mx-auto">
            <button
              onClick={() => setView('clock')}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                view === 'clock'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Clock className="w-6 h-6" />
              <span className="text-xs mt-1">Timbra</span>
            </button>

            <button
              onClick={() => setView('history')}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                view === 'history'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Calendar className="w-6 h-6" />
              <span className="text-xs mt-1">Storico</span>
            </button>

            {employee?.role === 'admin' && (
              <button
                onClick={() => setView('admin')}
                className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                  view === 'admin'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <Users className="w-6 h-6" />
                <span className="text-xs mt-1">Admin</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Login Modal */}
      {renderLoginModal()}
    </div>
  );
}
