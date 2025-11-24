'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, Users, Mic, FileText, MapPin, Clock, User, ExternalLink,
  ArrowLeft, Filter, Calendar, TrendingUp, RefreshCw, ChevronDown,
  Search, X, Activity, Target, Eye
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { SalesRadarActivityData, SalesRadarActivity, SalesRadarVendorStats } from '@/lib/super-dashboard/types';

// Lazy load map component to avoid SSR issues
const ActivityMap = dynamic(() => import('./ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-slate-800/50 rounded-xl flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
});

type ViewMode = 'timeline' | 'vendors' | 'map';
type ActivityType = 'all' | 'lead_created' | 'voice_note' | 'written_note' | 'stage_change' |
                    'lead_archived' | 'lead_reactivated' | 'tag_added' | 'note_added';

export default function SalesRadarActivityPage() {
  const [data, setData] = useState<SalesRadarActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [viewMode, setViewMode] = useState<ViewMode>('vendors');
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<SalesRadarActivity | null>(null);
  const [activityDetails, setActivityDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, [period]);

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

  // Filter activities based on selected filters
  const filteredActivities = useMemo(() => {
    if (!data) return [];

    let activities = [...data.activities];

    // Filter out activities with "Utente" (automatic imports from Google, etc.)
    activities = activities.filter(a => a.userName !== 'Utente');

    // Filter by vendor
    if (selectedVendor !== null) {
      activities = activities.filter(a => a.userId === selectedVendor);
    }

    // Filter by activity type
    if (selectedActivityType !== 'all') {
      activities = activities.filter(a => a.type === selectedActivityType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      activities = activities.filter(a =>
        a.targetName.toLowerCase().includes(query) ||
        a.userName.toLowerCase().includes(query) ||
        (a.preview && a.preview.toLowerCase().includes(query))
      );
    }

    return activities;
  }, [data, selectedVendor, selectedActivityType, searchQuery]);

  // Activities with location for map
  const activitiesWithLocation = useMemo(() => {
    return filteredActivities.filter(a => a.location);
  }, [filteredActivities]);

  const periodLabels = {
    today: 'Oggi',
    week: 'Questa settimana',
    month: 'Questo mese'
  };

  // Fetch activity details when an activity is selected
  const handleActivityClick = async (activity: SalesRadarActivity) => {
    setSelectedActivity(activity);
    setLoadingDetails(true);
    setActivityDetails(null);

    try {
      // Fetch the chatter messages for this lead/partner
      const response = await fetch(`/api/sales-radar/get-chatter?model=${activity.targetType === 'lead' ? 'crm.lead' : 'res.partner'}&id=${activity.targetId}`);
      const result = await response.json();
      if (result.success) {
        setActivityDetails(result.data);
      }
    } catch (err) {
      console.error('Error fetching activity details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

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
      case 'note_added':
        return 'ha aggiunto nota a';
      case 'field_updated':
        return 'ha modificato';
      default:
        return 'ha interagito con';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    // Odoo returns dates in UTC, need to handle timezone properly
    // Add 'Z' suffix if not present to ensure UTC parsing
    const utcTimestamp = timestamp.endsWith('Z') ? timestamp : timestamp.replace(' ', 'T') + 'Z';
    const date = new Date(utcTimestamp);
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

  const clearFilters = () => {
    setSelectedVendor(null);
    setSelectedActivityType('all');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedVendor !== null || selectedActivityType !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/super-dashboard"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg">
                  <Radar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Sales Radar Activity</h1>
                  <p className="text-sm text-slate-400">Monitora le attività dei venditori</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'today' | 'week' | 'month')}
                className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="today">Oggi</option>
                <option value="week">Questa settimana</option>
                <option value="month">Questo mese</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="text-red-400 mb-4">{error}</div>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        ) : data ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <span className="text-indigo-200 text-sm font-medium">Interazioni Totali</span>
                </div>
                <div className="text-4xl font-bold text-white">{data.summary.totalInteractions}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-orange-400" />
                  <span className="text-orange-200 text-sm font-medium">Lead Creati</span>
                </div>
                <div className="text-4xl font-bold text-white">{data.summary.leadsCreated}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-purple-200 text-sm font-medium">Note Aggiunte</span>
                </div>
                <div className="text-4xl font-bold text-white">{data.summary.voiceNotes + data.summary.writtenNotes}</div>
                <div className="text-xs text-purple-300 mt-1">
                  {data.summary.voiceNotes} vocali, {data.summary.writtenNotes} scritte
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-green-200 text-sm font-medium">Cambi Stato</span>
                </div>
                <div className="text-4xl font-bold text-white">{data.summary.stageChanges}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <X className="w-5 h-5 text-red-400" />
                  <span className="text-red-200 text-sm font-medium">Archiviati</span>
                </div>
                <div className="text-4xl font-bold text-white">{data.summary.leadsArchived}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-yellow-400" />
                  <span className="text-yellow-200 text-sm font-medium">Tag Modificati</span>
                </div>
                <div className="text-4xl font-bold text-white">{data.summary.tagsAdded}</div>
                <div className="text-xs text-yellow-300 mt-1">
                  Non interessato, Non target, ecc.
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span className="text-cyan-200 text-sm font-medium">Venditori Attivi</span>
                </div>
                <div className="text-4xl font-bold text-white">{data.summary.activeVendors}</div>
              </motion.div>
            </div>

            {/* Filters & View Toggles */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              {/* View Mode Tabs */}
              <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'timeline'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Timeline
                </button>
                <button
                  onClick={() => setViewMode('vendors')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'vendors'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Per Venditore
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'map'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  Mappa
                </button>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                  />
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                    showFilters || hasActiveFilters
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  {hasActiveFilters && (
                    <span className="w-2 h-2 bg-orange-400 rounded-full" />
                  )}
                </button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="Rimuovi filtri"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-4">
                    {/* Vendor Filter */}
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-slate-400 mb-2">Venditore</label>
                      <select
                        value={selectedVendor ?? ''}
                        onChange={(e) => setSelectedVendor(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Tutti i venditori</option>
                        {data.vendorStats.filter(v => v.userName !== 'Utente').map(vendor => (
                          <option key={vendor.userId} value={vendor.userId}>
                            {vendor.userName} ({vendor.totalInteractions})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Activity Type Filter */}
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-slate-400 mb-2">Tipo Attività</label>
                      <select
                        value={selectedActivityType}
                        onChange={(e) => setSelectedActivityType(e.target.value as ActivityType)}
                        className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">Tutte le attività</option>
                        <option value="lead_created">Lead creati</option>
                        <option value="voice_note">Note vocali</option>
                        <option value="written_note">Note scritte</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results Count */}
            {hasActiveFilters && (
              <div className="text-sm text-slate-400 mb-4">
                {filteredActivities.length} risultati trovati
              </div>
            )}

            {/* Content Views */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              {viewMode === 'timeline' && (
                <TimelineView
                  activities={filteredActivities}
                  formatTimestamp={formatTimestamp}
                  getActivityIcon={getActivityIcon}
                  getActivityLabel={getActivityLabel}
                  onActivityClick={handleActivityClick}
                />
              )}

              {viewMode === 'vendors' && (
                <VendorsView
                  vendorStats={data.vendorStats.filter(v => v.userName !== 'Utente')}
                  onSelectVendor={(id) => {
                    setSelectedVendor(id);
                    setViewMode('timeline');
                  }}
                />
              )}

              {viewMode === 'map' && (
                <div className="p-4">
                  <ActivityMap activities={activitiesWithLocation} />
                  {activitiesWithLocation.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nessuna attività con posizione GPS</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Activity Detail Drawer */}
        <AnimatePresence>
          {selectedActivity && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setSelectedActivity(null)}
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 h-full w-full max-w-lg bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-violet-600 p-4 z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white truncate">
                        {selectedActivity.targetName}
                      </h3>
                      <p className="text-indigo-200 text-sm">
                        {selectedActivity.targetType === 'lead' ? 'Lead' : 'Cliente'} - {selectedActivity.userName}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedActivity(null)}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Drawer Content */}
                <div className="p-4">
                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : activityDetails ? (
                    <div className="space-y-3">
                      {/* Note - clicca per aprire in Odoo */}
                      <p className="text-slate-400 text-xs mb-2">Clicca su una nota per aprirla in Odoo</p>

                      {activityDetails.messages.filter((m: any) => m.isSalesRadar).map((msg: any) => (
                        <SalesRadarMessage
                          key={msg.id}
                          msg={msg}
                          odooUrl={`${process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com'}/web#id=${selectedActivity.targetId}&model=${selectedActivity.targetType === 'lead' ? 'crm.lead' : 'res.partner'}&view_type=form`}
                        />
                      ))}

                      {activityDetails.messages.filter((m: any) => m.isSalesRadar).length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">
                          Nessuna nota Sales Radar trovata
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <p>Clicca su un&apos;attività per vedere i dettagli</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Timeline View Component
function TimelineView({
  activities,
  formatTimestamp,
  getActivityIcon,
  getActivityLabel,
  onActivityClick
}: {
  activities: SalesRadarActivity[];
  formatTimestamp: (ts: string) => string;
  getActivityIcon: (type: SalesRadarActivity['type']) => React.ReactNode;
  getActivityLabel: (type: SalesRadarActivity['type']) => string;
  onActivityClick: (activity: SalesRadarActivity) => void;
}) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Radar className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Nessuna attività trovata</p>
        <p className="text-sm mt-2">Prova a modificare i filtri o il periodo</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-700/50">
      {activities.map((activity, index) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.02 }}
          className="p-4 hover:bg-slate-700/20 transition-colors cursor-pointer"
          onClick={() => onActivityClick(activity)}
        >
          <div className="flex items-start gap-4">
            {/* Activity Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              {getActivityIcon(activity.type)}
            </div>

            {/* Activity Content */}
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white">{activity.userName}</span>
                <span className="text-slate-400 text-sm">{getActivityLabel(activity.type)}</span>
                <span className="font-medium text-indigo-300 truncate max-w-[300px]">{activity.targetName}</span>
              </div>

              {activity.preview && (
                <p className="text-slate-400 text-sm mt-1 line-clamp-2 italic">
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

            {/* View Details Button */}
            <div className="flex items-center gap-2">
              <button
                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors"
                title="Vedi dettagli"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Vendors View Component
function VendorsView({
  vendorStats,
  onSelectVendor
}: {
  vendorStats: SalesRadarVendorStats[];
  onSelectVendor: (id: number) => void;
}) {
  if (vendorStats.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Nessun venditore attivo</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-700/50">
      {vendorStats.map((vendor, index) => (
        <motion.div
          key={vendor.userId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="p-4 hover:bg-slate-700/20 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Rank Badge */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${
                index === 0 ? 'bg-gradient-to-br from-yellow-500 to-amber-600' :
                index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                index === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-800' :
                'bg-slate-700'
              }`}>
                {index + 1}
              </div>

              {/* Vendor Info */}
              <div>
                <div className="font-semibold text-white text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-400" />
                  {vendor.userName}
                </div>
                <div className="text-sm text-slate-400">
                  {vendor.totalInteractions} interazioni totali
                </div>
              </div>
            </div>

            {/* Stats & Action */}
            <div className="flex items-center gap-8">
              <div className="hidden md:flex items-center gap-4 flex-wrap">
                <div className="text-center">
                  <div className="text-orange-400 font-bold text-lg">{vendor.leadsCreated}</div>
                  <div className="text-xs text-slate-500">Lead</div>
                </div>
                <div className="text-center">
                  <div className="text-purple-400 font-bold text-lg">{vendor.voiceNotes}</div>
                  <div className="text-xs text-slate-500">Vocali</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-bold text-lg">{vendor.writtenNotes}</div>
                  <div className="text-xs text-slate-500">Scritte</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-bold text-lg">{vendor.stageChanges}</div>
                  <div className="text-xs text-slate-500">Stati</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold text-lg">{vendor.leadsArchived}</div>
                  <div className="text-xs text-slate-500">Archiviati</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-bold text-lg">{vendor.tagsAdded}</div>
                  <div className="text-xs text-slate-500">Tag</div>
                </div>
              </div>

              <button
                onClick={() => onSelectVendor(vendor.userId)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Vedi attività
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
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
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(vendor.stageChanges / vendor.totalInteractions) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(vendor.leadsArchived / vendor.totalInteractions) * 100}%` }}
              />
              <div
                className="bg-yellow-500 transition-all"
                style={{ width: `${(vendor.tagsAdded / vendor.totalInteractions) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full" /> Lead
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full" /> Vocali
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full" /> Scritte
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" /> Stati
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full" /> Archiviati
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-500 rounded-full" /> Tag
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Sales Radar Message Component - clickable to open in Odoo
function SalesRadarMessage({ msg, odooUrl }: { msg: any; odooUrl?: string }) {
  // Parse Sales Radar message to extract meaningful content
  const parseSalesRadarMessage = (body: string) => {
    const isVoice = body.includes('🎙️') || body.toLowerCase().includes('vocale');

    // Extract ALL text content from the HTML
    // Remove all HTML tags and decode entities
    let fullText = body
      .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
      .replace(/<\/p>/gi, '\n')        // Convert </p> to newlines
      .replace(/<\/td>/gi, ' | ')      // Convert table cells
      .replace(/<\/tr>/gi, '\n')       // Convert table rows
      .replace(/<[^>]*>/g, '')         // Remove all other HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')      // Max 2 newlines
      .trim();

    // Try to extract just the note part (after "Nota:")
    const notaIndex = fullText.indexOf('Nota:');
    if (notaIndex !== -1) {
      // Get everything after "Nota:"
      let noteContent = fullText.substring(notaIndex + 5).trim();
      // Remove "Inserita tramite Sales Radar App" and similar footers
      noteContent = noteContent.replace(/Inserita tramite Sales Radar.*/i, '').trim();
      return { isVoice, noteContent };
    }

    // Fallback: remove header parts and show the rest
    fullText = fullText
      .replace(/📍\s*FEEDBACK SALES RADAR/g, '')
      .replace(/🎙️[^|]*\|/g, '')
      .replace(/✍️[^|]*\|/g, '')
      .replace(/📅[^📝]*/g, '')
      .replace(/Inserita tramite Sales Radar.*/i, '')
      .trim();

    return { isVoice, noteContent: fullText || msg.textPreview || '' };
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const parsed = parseSalesRadarMessage(msg.body);

  // Clickable card that opens Odoo
  return (
    <a
      href={odooUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl p-4 hover:from-indigo-500/30 hover:to-purple-500/30 hover:border-indigo-400/50 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {parsed.isVoice ? (
            <span className="flex items-center gap-1 text-purple-300 text-xs font-medium">
              <Mic className="w-3.5 h-3.5" />
              Vocale
            </span>
          ) : (
            <span className="flex items-center gap-1 text-blue-300 text-xs font-medium">
              <FileText className="w-3.5 h-3.5" />
              Scritta
            </span>
          )}
          <span className="text-slate-400 text-xs">•</span>
          <span className="text-slate-300 text-xs">{msg.authorName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{formatDate(msg.date)}</span>
          <ExternalLink className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Note Content */}
      <p className="text-white text-sm leading-relaxed">
        {parsed.noteContent}
      </p>
    </a>
  );
}
