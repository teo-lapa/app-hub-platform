'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Radar, Users, Mic, FileText, MapPin, Clock, TrendingUp, User, ExternalLink, RefreshCw, Target, Activity } from 'lucide-react';
import type { SalesRadarActivityData, SalesRadarActivity, SalesRadarVendorStats } from '@/lib/super-dashboard/types';

interface SalesRadarActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'timeline' | 'vendors';

export function SalesRadarActivityModal({ isOpen, onClose }: SalesRadarActivityModalProps) {
  const [data, setData] = useState<SalesRadarActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, period]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/super-dashboard/sales-radar-activity?period=${period}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Errore nel caricamento');
      }
    } catch (err) {
      console.error('Error fetching sales radar activity:', err);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getActivityIcon = (type: SalesRadarActivity['type']) => {
    switch (type) {
      case 'lead_created':
        return <MapPin className="w-4 h-4 text-orange-400" />;
      case 'voice_note':
        return <Mic className="w-4 h-4 text-purple-400" />;
      case 'written_note':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'stage_change':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'lead_archived':
        return <X className="w-4 h-4 text-red-400" />;
      case 'lead_reactivated':
        return <RefreshCw className="w-4 h-4 text-emerald-400" />;
      case 'tag_added':
        return <Target className="w-4 h-4 text-yellow-400" />;
      case 'tag_removed':
        return <Target className="w-4 h-4 text-yellow-400" />;
      case 'note_added':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'field_updated':
        return <Activity className="w-4 h-4 text-gray-400" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityLabel = (type: SalesRadarActivity['type']) => {
    switch (type) {
      case 'lead_created':
        return 'ha creato lead';
      case 'voice_note':
        return 'ha registrato nota vocale su';
      case 'written_note':
        return 'ha scritto nota su';
      case 'stage_change':
        return 'ha cambiato stato di';
      case 'lead_archived':
        return 'ha archiviato';
      case 'lead_reactivated':
        return 'ha riattivato';
      case 'tag_added':
        return 'ha modificato tag di';
      case 'tag_removed':
        return 'ha rimosso tag da';
      case 'note_added':
        return 'ha aggiunto nota a';
      case 'field_updated':
        return 'ha modificato';
      default:
        return 'ha interagito con';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'ora';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;

    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const periodLabels = {
    today: 'Oggi',
    week: 'Questa settimana',
    month: 'Questo mese'
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-indigo-500/30"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Radar className="w-7 h-7" />
                  Sales Radar Activity
                </h2>
                <p className="text-indigo-100 mt-1">
                  Monitora le attività dei venditori sul Sales Radar
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Period Selector */}
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as 'today' | 'week' | 'month')}
                  className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="today" className="text-slate-900">Oggi</option>
                  <option value="week" className="text-slate-900">Questa settimana</option>
                  <option value="month" className="text-slate-900">Questo mese</option>
                </select>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                <p>{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Riprova
                </button>
              </div>
            ) : data ? (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-indigo-400">{data.summary.totalInteractions}</div>
                    <div className="text-indigo-200 text-sm">Interazioni Totali</div>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-orange-400">{data.summary.leadsCreated}</div>
                    <div className="text-orange-200 text-sm">Lead Creati</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">{data.summary.voiceNotes + data.summary.writtenNotes}</div>
                    <div className="text-purple-200 text-sm">Note Aggiunte</div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">{data.summary.activeVendors}</div>
                    <div className="text-green-200 text-sm">Venditori Attivi</div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2">
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      activeTab === 'timeline'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Timeline
                  </button>
                  <button
                    onClick={() => setActiveTab('vendors')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      activeTab === 'vendors'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Per Venditore
                  </button>
                </div>

                {/* Tab Content */}
                <div className="overflow-y-auto max-h-[calc(85vh-420px)]">
                  {activeTab === 'timeline' ? (
                    <TimelineView activities={data.activities} formatTimestamp={formatTimestamp} getActivityIcon={getActivityIcon} getActivityLabel={getActivityLabel} />
                  ) : (
                    <VendorsView vendorStats={data.vendorStats} />
                  )}
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Timeline View Component
function TimelineView({
  activities,
  formatTimestamp,
  getActivityIcon,
  getActivityLabel
}: {
  activities: SalesRadarActivity[];
  formatTimestamp: (ts: string) => string;
  getActivityIcon: (type: SalesRadarActivity['type']) => React.ReactNode;
  getActivityLabel: (type: SalesRadarActivity['type']) => string;
}) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Radar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nessuna attività trovata nel periodo selezionato</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Activity Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
              {getActivityIcon(activity.type)}
            </div>

            {/* Activity Content */}
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white">{activity.userName}</span>
                <span className="text-slate-400 text-sm">{getActivityLabel(activity.type)}</span>
                <span className="font-medium text-indigo-300 truncate">{activity.targetName}</span>
              </div>

              {activity.preview && (
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                  &ldquo;{activity.preview}&rdquo;
                </p>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(activity.timestamp)}
                </span>
                {activity.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {activity.location.lat.toFixed(4)}, {activity.location.lng.toFixed(4)}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activity.targetType === 'lead'
                    ? 'bg-orange-500/20 text-orange-300'
                    : 'bg-green-500/20 text-green-300'
                }`}>
                  {activity.targetType === 'lead' ? 'Lead' : 'Cliente'}
                </span>
              </div>
            </div>

            {/* Link to Odoo */}
            <a
              href={`${process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com'}/web#id=${activity.targetId}&model=${activity.targetType === 'lead' ? 'crm.lead' : 'res.partner'}&view_type=form`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors"
              title="Apri in Odoo"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Vendors View Component
function VendorsView({ vendorStats }: { vendorStats: SalesRadarVendorStats[] }) {
  if (vendorStats.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nessun venditore attivo nel periodo selezionato</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vendorStats.map((vendor, index) => (
        <motion.div
          key={vendor.userId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-white/5 rounded-xl p-4 border border-white/10"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Rank Badge */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                index === 0 ? 'bg-gradient-to-br from-yellow-500 to-amber-600' :
                index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                index === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-800' :
                'bg-slate-700'
              }`}>
                {index + 1}
              </div>

              {/* Vendor Info */}
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  {vendor.userName}
                </div>
                <div className="text-sm text-slate-400">
                  {vendor.totalInteractions} interazioni totali
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-orange-400 font-bold">{vendor.leadsCreated}</div>
                <div className="text-xs text-slate-500">Lead</div>
              </div>
              <div className="text-center">
                <div className="text-purple-400 font-bold">{vendor.voiceNotes}</div>
                <div className="text-xs text-slate-500">Vocali</div>
              </div>
              <div className="text-center">
                <div className="text-blue-400 font-bold">{vendor.writtenNotes}</div>
                <div className="text-xs text-slate-500">Scritte</div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-orange-500 transition-all"
                style={{ width: `${(vendor.leadsCreated / vendor.totalInteractions) * 100}%` }}
              />
              <div
                className="bg-purple-500 transition-all"
                style={{ width: `${(vendor.voiceNotes / vendor.totalInteractions) * 100}%` }}
              />
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${(vendor.writtenNotes / vendor.totalInteractions) * 100}%` }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
