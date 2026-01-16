'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Calendar,
  Palmtree,
  ClipboardList,
  User,
  Loader2,
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  Users,
  MessageSquare,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  PackageX
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';

// URL Odoo per costruire link ai documenti
const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

// Funzione per costruire il link al documento Odoo
const buildOdooDocumentLink = (model: string | null, resId: number | null): string | null => {
  if (!model || !resId) return null;
  return `${ODOO_URL}/web#model=${model}&id=${resId}&view_type=form`;
};

// Tab types
type TabType = 'notifiche' | 'calendario' | 'ferie' | 'attivita' | 'profilo';

// Interfaces
interface Notification {
  id: number;
  subject: string;
  body: string;
  date: string;
  author: string;
  isRead: boolean;
  type: 'notification' | 'message' | 'activity';
  // Campi per link al documento sorgente in Odoo
  model: string | null;
  resId: number | null;
  recordName: string | null;
}

interface CalendarEvent {
  id: number;
  name: string;
  start: string;
  stop: string;
  location?: string;
  attendees: string[];
  status: 'needsAction' | 'accepted' | 'declined' | 'tentative';
}

interface LeaveRequest {
  id: number;
  name: string;
  dateFrom: string;
  dateTo: string;
  days: number;
  state: 'draft' | 'confirm' | 'validate' | 'refuse';
  type: string;
}

interface Activity {
  id: number;
  summary: string;
  note?: string;
  deadline: string;
  state: 'overdue' | 'today' | 'planned';
  activityType: string;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  remainingLeaves: number;
}

interface AbsentToday {
  id: number;
  name: string;
  leaveType: string;
}

export default function IlMioHubPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('notifiche');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [absentToday, setAbsentToday] = useState<AbsentToday[]>([]);

  // Counts for badges
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingActivities, setPendingActivities] = useState(0);
  const [pendingEvents, setPendingEvents] = useState(0);

  // Load all data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/il-mio-hub', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento dei dati');
      }

      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications || []);
        setEvents(data.events || []);
        setLeaveRequests(data.leaveRequests || []);
        setActivities(data.activities || []);
        setProfile(data.profile || null);
        setAbsentToday(data.absentToday || []);

        // Calculate counts
        setUnreadCount(data.notifications?.filter((n: Notification) => !n.isRead).length || 0);
        setPendingActivities(data.activities?.filter((a: Activity) => a.state === 'overdue' || a.state === 'today').length || 0);
        setPendingEvents(data.events?.filter((e: CalendarEvent) => e.status === 'needsAction').length || 0);
      } else {
        throw new Error(data.message || 'Errore nel caricamento');
      }
    } catch (err) {
      console.error('Errore caricamento dati:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh ogni 2 minuti
    const interval = setInterval(loadData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Tabs configuration
  const tabs = [
    { id: 'notifiche' as TabType, label: 'Notifiche', icon: Bell, badge: unreadCount },
    { id: 'calendario' as TabType, label: 'Calendario', icon: Calendar, badge: pendingEvents },
    { id: 'ferie' as TabType, label: 'Ferie', icon: Palmtree, badge: 0 },
    { id: 'attivita' as TabType, label: 'Attività', icon: ClipboardList, badge: pendingActivities },
    { id: 'profilo' as TabType, label: 'Profilo', icon: User, badge: 0 },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Caricamento Il Mio Hub...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center bg-red-500/10 border border-red-500/20 rounded-lg p-8 max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Errore nel caricamento</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Il Mio Hub</h1>
              <p className="text-sm text-slate-400">
                Ciao, {profile?.name || user?.name || 'Utente'}!
              </p>
            </div>
            <button
              onClick={loadData}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Quick Actions - Prodotti Mancanti */}
          <Link
            href="/prodotti-mancanti"
            className="flex items-center gap-3 p-3 mb-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg hover:border-red-500/50 transition-all group"
          >
            <div className="p-2 bg-red-500/30 rounded-lg">
              <PackageX className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-white group-hover:text-red-300 transition-colors">
                Prodotti Mancanti
              </h3>
              <p className="text-xs text-slate-400">
                Verifica i prodotti non disponibili per le consegne di oggi
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-red-400 transition-colors" />
          </Link>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600'
                      : 'bg-red-500 text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab: Notifiche */}
        {activeTab === 'notifiche' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-500" />
                Notifiche
                {unreadCount > 0 && (
                  <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full">
                    {unreadCount} nuove
                  </span>
                )}
              </h2>
            </div>

            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const documentLink = buildOdooDocumentLink(notification.model, notification.resId);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border transition-all ${
                        notification.isRead
                          ? 'bg-slate-800/50 border-slate-700'
                          : 'bg-blue-500/10 border-blue-500/30'
                      } ${documentLink ? 'cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/70' : ''}`}
                      onClick={() => {
                        if (documentLink) {
                          window.open(documentLink, '_blank');
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          notification.type === 'activity'
                            ? 'bg-orange-500/20 text-orange-400'
                            : notification.type === 'message'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {notification.type === 'activity' ? (
                            <ClipboardList className="h-4 w-4" />
                          ) : notification.type === 'message' ? (
                            <MessageSquare className="h-4 w-4" />
                          ) : (
                            <Bell className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`text-sm font-medium ${
                              notification.isRead ? 'text-slate-300' : 'text-white'
                            }`}>
                              {notification.subject || 'Notifica'}
                            </h3>
                            {documentLink && (
                              <ExternalLink className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            )}
                          </div>
                          {notification.recordName && notification.recordName !== notification.subject && (
                            <p className="text-xs text-blue-400 mt-0.5">
                              {notification.recordName}
                            </p>
                          )}
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2"
                             dangerouslySetInnerHTML={{ __html: notification.body }}
                          />
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            <span>{notification.author}</span>
                            <span>•</span>
                            <span>{new Date(notification.date).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                            {notification.model && (
                              <>
                                <span>•</span>
                                <span className="text-blue-400/70">{notification.model.replace('.', ' ').replace(/_/g, ' ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {!notification.isRead && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                <Bell className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nessuna notifica</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Calendario */}
        {activeTab === 'calendario' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-green-500" />
              I Miei Eventi
            </h2>

            {events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`p-4 rounded-lg border ${
                      event.status === 'needsAction'
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : event.status === 'accepted'
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-white">{event.name}</h3>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(event.start).toLocaleDateString('it-IT', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short'
                            })}
                            {' '}
                            {new Date(event.start).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {event.location && (
                          <p className="text-xs text-slate-500 mt-1">{event.location}</p>
                        )}
                        {event.attendees.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <Users className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              {event.attendees.length} partecipanti
                            </span>
                          </div>
                        )}
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        event.status === 'needsAction'
                          ? 'bg-orange-500/20 text-orange-400'
                          : event.status === 'accepted'
                          ? 'bg-green-500/20 text-green-400'
                          : event.status === 'declined'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-slate-600/20 text-slate-400'
                      }`}>
                        {event.status === 'needsAction' ? 'Da confermare' :
                         event.status === 'accepted' ? 'Confermato' :
                         event.status === 'declined' ? 'Rifiutato' : 'Forse'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nessun evento in programma</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Ferie */}
        {activeTab === 'ferie' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Palmtree className="h-5 w-5 text-emerald-500" />
              Ferie & Permessi
            </h2>

            {/* Saldo ferie */}
            {profile && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-400">Ferie disponibili</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {profile.remainingLeaves} <span className="text-lg text-slate-400">giorni</span>
                    </p>
                  </div>
                  <Palmtree className="h-10 w-10 text-emerald-500/50" />
                </div>
              </div>
            )}

            {/* Assenti oggi */}
            {absentToday.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Chi è assente oggi</h3>
                <div className="flex flex-wrap gap-2">
                  {absentToday.map((person) => (
                    <div
                      key={person.id}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-sm"
                    >
                      <span className="text-white">{person.name}</span>
                      <span className="text-slate-500 ml-1">• {person.leaveType}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Le mie richieste */}
            <h3 className="text-sm font-medium text-slate-400 mb-3">Le mie richieste</h3>
            {leaveRequests.length > 0 ? (
              <div className="space-y-3">
                {leaveRequests.map((leave) => (
                  <div
                    key={leave.id}
                    className={`p-4 rounded-lg border ${
                      leave.state === 'validate'
                        ? 'bg-green-500/10 border-green-500/30'
                        : leave.state === 'refuse'
                        ? 'bg-red-500/10 border-red-500/30'
                        : leave.state === 'confirm'
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-white">{leave.type}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(leave.dateFrom).toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'short'
                          })}
                          {' - '}
                          {new Date(leave.dateTo).toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{leave.days} giorni</p>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        leave.state === 'validate'
                          ? 'bg-green-500/20 text-green-400'
                          : leave.state === 'refuse'
                          ? 'bg-red-500/20 text-red-400'
                          : leave.state === 'confirm'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-slate-600/20 text-slate-400'
                      }`}>
                        {leave.state === 'validate' ? 'Approvato' :
                         leave.state === 'refuse' ? 'Rifiutato' :
                         leave.state === 'confirm' ? 'In attesa' : 'Bozza'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                <Palmtree className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nessuna richiesta di ferie</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Attività */}
        {activeTab === 'attivita' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-orange-500" />
              Le Mie Attività
            </h2>

            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-4 rounded-lg border ${
                      activity.state === 'overdue'
                        ? 'bg-red-500/10 border-red-500/30'
                        : activity.state === 'today'
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        activity.state === 'overdue'
                          ? 'bg-red-500/20 text-red-400'
                          : activity.state === 'today'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {activity.state === 'overdue' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : activity.state === 'today' ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-white">{activity.summary}</h3>
                        {activity.note && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2"
                             dangerouslySetInnerHTML={{ __html: activity.note }}
                          />
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`text-xs font-medium ${
                            activity.state === 'overdue'
                              ? 'text-red-400'
                              : activity.state === 'today'
                              ? 'text-orange-400'
                              : 'text-slate-400'
                          }`}>
                            {activity.state === 'overdue' ? 'Scaduta' :
                             activity.state === 'today' ? 'Oggi' : 'Pianificata'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(activity.deadline).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                          <span className="text-xs text-slate-600">{activity.activityType}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                <CheckCircle2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nessuna attività in sospeso</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Profilo */}
        {activeTab === 'profilo' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-purple-500" />
              Il Mio Profilo
            </h2>

            {profile ? (
              <div className="space-y-4">
                {/* Card profilo principale */}
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                      {profile.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{profile.name}</h3>
                      <p className="text-sm text-slate-400">{profile.email}</p>
                    </div>
                  </div>
                </div>

                {/* Info dettagliate */}
                <div className="space-y-3">
                  {profile.jobTitle && (
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-slate-400">Ruolo</span>
                      <span className="text-sm text-white font-medium">{profile.jobTitle}</span>
                    </div>
                  )}
                  {profile.department && (
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-slate-400">Dipartimento</span>
                      <span className="text-sm text-white font-medium">{profile.department}</span>
                    </div>
                  )}
                  {profile.phone && (
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-slate-400">Telefono</span>
                      <span className="text-sm text-white font-medium">{profile.phone}</span>
                    </div>
                  )}
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-emerald-400">Ferie disponibili</span>
                    <span className="text-sm text-white font-bold">{profile.remainingLeaves} giorni</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                <User className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Dati profilo non disponibili</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
