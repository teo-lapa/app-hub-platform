'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Home, RefreshCw, Server, Cpu, HardDrive, MemoryStick, Thermometer,
  Wifi, WifiOff, Activity, Bot, Container, Clock, AlertTriangle,
  CheckCircle2, XCircle, MinusCircle, Monitor, Smartphone, Database,
  Radio, ChevronDown, ChevronUp, Settings, Zap, Globe, MessageSquare,
} from 'lucide-react';
import { WHATSAPP_AGENTS, type WhatsAppAgentConfig } from '@/lib/agents/whatsapp-agents';

// ─── Types ─────────────────────────────────────────────────────────

interface DiskInfo {
  name: string;
  totalGB: number;
  freeGB: number;
  usedPercent: number;
}

interface ServiceInfo {
  name: string;
  type: 'openclaw' | 'bot' | 'docker' | 'port' | 'task' | 'service';
  status: 'ok' | 'warning' | 'ko';
  details?: string;
  port?: number;
}

interface DeviceStatus {
  id: string;
  name: string;
  ip: string;
  type: 'nas' | 'windows' | 'linux' | 'local';
  processor?: string;
  online: boolean;
  uptime?: string;
  cpu?: { percent: number; temp?: number };
  ram?: { totalGB: number; freeGB: number; usedPercent: number };
  disks?: DiskInfo[];
  services?: ServiceInfo[];
  warnings?: string[];
  errors?: string[];
}

interface AgentInfo {
  name: string;
  type: 'openclaw' | 'python-bot';
  device: string;
  status: 'ok' | 'warning' | 'ko';
  port?: number;
  details?: string;
  emoji?: string;
}

interface OdooStatus {
  connected: boolean;
  ordersToday: number;
  details?: string;
}

interface InfraSummary {
  totalDevices: number;
  online: number;
  offline: number;
  totalServices: number;
  servicesOk: number;
  servicesWarning: number;
  servicesKo: number;
}

interface InfraData {
  timestamp: string;
  receivedAt?: string;
  devices: DeviceStatus[];
  agents: AgentInfo[];
  odoo: OdooStatus;
  summary: InfraSummary;
}

// ─── Status Badge ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'ko' | 'offline' }) {
  const config = {
    ok: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2, label: 'OK' },
    warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: AlertTriangle, label: 'WARN' },
    ko: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle, label: 'KO' },
    offline: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: MinusCircle, label: 'OFF' },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.text} border ${c.border}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

// ─── Metric Bar ────────────────────────────────────────────────────

function MetricBar({ label, value, max, unit, icon: Icon, thresholdWarn, thresholdKo }: {
  label: string; value: number; max: number; unit: string;
  icon: any; thresholdWarn?: number; thresholdKo?: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const usedPct = unit === '%' ? value : pct;
  let color = 'from-emerald-500 to-emerald-400';
  if (thresholdKo && usedPct >= thresholdKo) color = 'from-red-500 to-red-400';
  else if (thresholdWarn && usedPct >= thresholdWarn) color = 'from-amber-500 to-amber-400';

  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-slate-400 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(usedPct, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
      <span className="text-slate-300 w-16 text-right shrink-0">
        {unit === '%' ? `${value}%` : `${value.toFixed(1)}/${max.toFixed(0)} ${unit}`}
      </span>
    </div>
  );
}

// ─── Device Card ───────────────────────────────────────────────────

function DeviceCard({ device, isStale, ageMinutes }: { device: DeviceStatus; isStale?: boolean; ageMinutes?: number }) {
  const [expanded, setExpanded] = useState(false);

  const overallStatus = isStale ? 'offline'
    : !device.online ? 'offline'
    : device.errors && device.errors.length > 0 ? 'ko'
    : device.warnings && device.warnings.length > 0 ? 'warning'
    : 'ok';

  const typeIcons: Record<string, any> = {
    nas: Database,
    windows: Monitor,
    linux: Cpu,
    local: Smartphone,
  };
  const TypeIcon = typeIcons[device.type] || Server;

  const borderColor = {
    ok: 'border-emerald-500/20 hover:border-emerald-500/40',
    warning: 'border-amber-500/20 hover:border-amber-500/40',
    ko: 'border-red-500/20 hover:border-red-500/40',
    offline: 'border-slate-600/20 hover:border-slate-600/40',
  }[overallStatus];

  const glowColor = {
    ok: 'shadow-emerald-500/5',
    warning: 'shadow-amber-500/5',
    ko: 'shadow-red-500/10',
    offline: '',
  }[overallStatus];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border ${borderColor} shadow-lg ${glowColor} overflow-hidden cursor-pointer transition-all`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              device.online ? 'bg-slate-700/50' : 'bg-slate-800/50'
            }`}>
              <TypeIcon className={`w-5 h-5 ${device.online ? 'text-blue-400' : 'text-slate-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                {device.name}
                {isStale && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-600/40 text-slate-300 border border-slate-500/40">
                    STALE {ageMinutes}min
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">{device.ip}{device.processor ? ` \u2022 ${device.processor}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={overallStatus} />
            {device.online ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-slate-600" />
            )}
          </div>
        </div>

        {/* Quick Metrics */}
        {device.online && (
          <div className="space-y-1.5">
            {device.cpu && (
              <MetricBar label="CPU" value={device.cpu.percent} max={100} unit="%" icon={Cpu}
                thresholdWarn={70} thresholdKo={90} />
            )}
            {device.ram && (
              <MetricBar label="RAM" value={device.ram.totalGB - device.ram.freeGB} max={device.ram.totalGB} unit="GB" icon={MemoryStick}
                thresholdWarn={80} thresholdKo={90} />
            )}
            {device.disks && device.disks.length > 0 && device.disks.map((d, i) => (
              <MetricBar key={i} label={d.name} value={d.totalGB - d.freeGB} max={d.totalGB} unit="GB" icon={HardDrive}
                thresholdWarn={80} thresholdKo={90} />
            ))}
          </div>
        )}

        {/* Temperature */}
        {device.cpu?.temp && device.cpu.temp > 0 && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            <Thermometer className={`w-3.5 h-3.5 ${
              device.cpu.temp > 80 ? 'text-red-400' : device.cpu.temp > 65 ? 'text-amber-400' : 'text-blue-400'
            }`} />
            <span className="text-slate-400">Temp</span>
            <span className={`font-mono ${
              device.cpu.temp > 80 ? 'text-red-400' : device.cpu.temp > 65 ? 'text-amber-400' : 'text-emerald-400'
            }`}>{device.cpu.temp}°C</span>
          </div>
        )}

        {/* Services Summary */}
        {device.services && device.services.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {device.services.map((svc, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                svc.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : svc.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {svc.type === 'openclaw' ? <Bot className="w-3 h-3" /> :
                 svc.type === 'bot' ? <MessageSquare className="w-3 h-3" /> :
                 svc.type === 'docker' ? <Container className="w-3 h-3" /> :
                 <Radio className="w-3 h-3" />}
                {svc.name}
              </span>
            ))}
          </div>
        )}

        {/* Expand indicator */}
        <div className="flex justify-center mt-2">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-700/50"
          >
            <div className="p-4 space-y-3">
              {/* Uptime */}
              {device.uptime && (
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Uptime:</span>
                  <span className="text-slate-300">{device.uptime}</span>
                </div>
              )}

              {/* Services Detail */}
              {device.services && device.services.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Servizi</h4>
                  {device.services.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-slate-900/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        {svc.type === 'openclaw' ? <Bot className="w-3.5 h-3.5 text-blue-400" /> :
                         svc.type === 'bot' ? <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> :
                         svc.type === 'docker' ? <Container className="w-3.5 h-3.5 text-cyan-400" /> :
                         <Radio className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="text-slate-300 font-medium">{svc.name}</span>
                        {svc.port && <span className="text-slate-500">:{svc.port}</span>}
                      </div>
                      <StatusBadge status={svc.status} />
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {device.warnings && device.warnings.length > 0 && (
                <div className="space-y-1">
                  {device.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Errors */}
              {device.errors && device.errors.length > 0 && (
                <div className="space-y-1">
                  {device.errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-400 bg-red-500/5 rounded-lg px-3 py-2">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {device.services?.some(s => s.details) && (
                <div className="space-y-1">
                  {device.services.filter(s => s.details).map((s, i) => (
                    <p key={i} className="text-xs text-slate-500 italic">{s.name}: {s.details}</p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Live Agent Row ────────────────────────────────────────────────

interface LiveAgentState {
  slug: string;
  agent: WhatsAppAgentConfig;
  online: boolean | null;
  processRunning: boolean | null;
  sshReachable: boolean | null;
  pid: string | null;
  total24h: number;
  errors24h: number;
  lastMsgMinutesAgo: number | null;
}

function LiveAgentRow({ state }: { state: LiveAgentState }) {
  const { agent, slug } = state;
  const status: 'ok' | 'warning' | 'ko' | 'offline' =
    state.online === null ? 'offline'
    : state.errors24h > 0 ? 'warning'
    : state.online ? 'ok'
    : 'ko';

  const platformLabel = agent.platforms.join(' + ');
  const modelLabel = agent.model;

  return (
    <Link
      href={`/agenti-whatsapp/${slug}`}
      className="flex items-center justify-between py-3 px-4 bg-slate-800/30 hover:bg-slate-800/60 rounded-xl border border-slate-700/30 hover:border-cyan-500/40 transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl shrink-0">{agent.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
          <p className="text-xs text-slate-500 truncate">
            {agent.pc.ssh.toUpperCase()} · {platformLabel} · {modelLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">24h</div>
          <div className="text-xs text-slate-300 font-mono">
            {state.total24h}
            {state.errors24h > 0 && <span className="text-red-400"> · {state.errors24h} err</span>}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
    </Link>
  );
}

// ─── Summary Cards ─────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: any; color: string;
}) {
  return (
    <div className={`bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/30 p-4 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

// ─── Pulse Dot ─────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function InfraMonitorPage() {
  const [data, setData] = useState<InfraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ageMinutes, setAgeMinutes] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [liveAgents, setLiveAgents] = useState<LiveAgentState[]>([]);

  const fetchStatus = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch('/api/infra-monitor/status', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setAgeMinutes(json.meta?.ageMinutes || 0);
        setIsStale(json.meta?.isStale || false);
        setError(null);
      } else if (json.success && !json.data) {
        // No infra KV data yet — that's OK, we still show live agents
        setError(null);
      } else {
        setError(json.error || 'Errore nel caricamento');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di rete');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastRefresh(new Date());
    }
  }, []);

  const fetchLiveAgents = useCallback(async () => {
    const entries = Object.entries(WHATSAPP_AGENTS);
    const results = await Promise.allSettled(
      entries.map(async ([slug, agent]) => {
        const [statusRes, statsRes] = await Promise.allSettled([
          fetch(`/api/agenti-whatsapp/${slug}/status`).then(r => r.json()),
          fetch(`/api/agenti-whatsapp/${slug}/stats`).then(r => r.json()),
        ]);
        const st = statusRes.status === 'fulfilled' ? statusRes.value : {};
        const stats = statsRes.status === 'fulfilled' ? statsRes.value : {};
        return {
          slug,
          agent,
          online: st.online ?? null,
          processRunning: st.processRunning ?? null,
          sshReachable: st.sshReachable ?? null,
          pid: st.pid ?? null,
          total24h: stats.total24h || 0,
          errors24h: stats.errors24h || 0,
          lastMsgMinutesAgo: stats.lastMsgMinutesAgo ?? null,
        } as LiveAgentState;
      })
    );
    const list: LiveAgentState[] = [];
    for (const r of results) if (r.status === 'fulfilled') list.push(r.value);
    setLiveAgents(list);
  }, []);

  useEffect(() => {
    fetchStatus(true);
    fetchLiveAgents();
  }, [fetchStatus, fetchLiveAgents]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStatus(false);
      fetchLiveAgents();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus, fetchLiveAgents]);

  // ─── Loading State ────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-white mb-2">Infra Monitor</h2>
          <p className="text-slate-400">Caricamento stato infrastruttura...</p>
        </motion.div>
      </div>
    );
  }

  const summary = data?.summary;
  const devices = data?.devices || [];
  const odoo = data?.odoo;

  // Live agents summary
  const agentsOnlineCount = liveAgents.filter(a => a.online).length;
  const agentsTotalCount = liveAgents.length;
  const agentsWarningCount = liveAgents.filter(a => a.errors24h > 0).length;
  const agentsMsgTotal = liveAgents.reduce((acc, a) => acc + a.total24h, 0);
  const agentsErrorsTotal = liveAgents.reduce((acc, a) => acc + a.errors24h, 0);

  // ─── Main Render ──────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ─── Header ──────────────────────────────────────── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-cyan-500/20"
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold shadow-lg transition-all text-sm"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Home</span>
                </motion.button>
              </Link>
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-cyan-400" />
                <h1 className="text-lg sm:text-xl font-bold text-white">Infra Monitor</h1>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <PulseDot color={liveAgents.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'} />
                <span className="text-xs text-slate-400">
                  Agenti live · aggiornato {lastRefresh.toLocaleTimeString('it-CH')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  autoRefresh
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-700/30 text-slate-500 border border-slate-700/30'
                }`}
              >
                {autoRefresh ? 'Auto 30s' : 'Auto OFF'}
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fetchStatus(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Aggiorna</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Stale Data Banner ──────────────────────────── */}
      {isStale && (
        <div
          className={`w-full border-b-2 ${
            ageMinutes >= 1440
              ? 'bg-red-900/80 border-red-500 animate-pulse'
              : ageMinutes >= 30
              ? 'bg-red-900/60 border-red-500/70'
              : 'bg-amber-900/60 border-amber-500/70'
          }`}
        >
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
            <p className={`text-sm sm:text-base font-semibold ${
              ageMinutes >= 30 ? 'text-red-100' : 'text-amber-100'
            }`}>
              {ageMinutes < 30 && (
                <>⚠️ Dati in ritardo: ultima raccolta {ageMinutes} min fa. I valori potrebbero non essere aggiornati.</>
              )}
              {ageMinutes >= 30 && ageMinutes < 1440 && (
                <>🚨 Collector fermo da {ageMinutes} min. Dati DISPOSITIVI/SERVIZI/ODOO non affidabili.</>
              )}
              {ageMinutes >= 1440 && (
                <>🚨🚨 COLLECTOR MORTO da {Math.floor(ageMinutes / 1440)} giorni. I dati Dispositivi/Servizi/Odoo sotto sono FOTOGRAFIE OBSOLETE — NON RIFLETTONO LA REALTÀ. Riavvia LAPA-InfraCollector su PAUL.</>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ─── Summary Cards ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
        >
          <SummaryCard label="Agenti" value={`${agentsOnlineCount}/${agentsTotalCount}`} icon={Bot} color="bg-cyan-600" />
          <SummaryCard label="Msg 24h" value={agentsMsgTotal} icon={MessageSquare} color="bg-blue-600" />
          <SummaryCard label="Errori 24h" value={agentsErrorsTotal} icon={AlertTriangle} color={agentsErrorsTotal > 0 ? 'bg-red-600' : 'bg-slate-600'} />
          {summary ? (
            isStale ? (
              <>
                <SummaryCard label="Dispositivi · stale" value={'—'} icon={Server} color="bg-slate-700" />
                <SummaryCard label="Servizi · stale" value={'—'} icon={CheckCircle2} color="bg-slate-700" />
                <SummaryCard label="Warning/KO · stale" value={'—'} icon={XCircle} color="bg-slate-700" />
              </>
            ) : (
              <>
                <SummaryCard label="Dispositivi" value={`${summary.online}/${summary.totalDevices}`} icon={Server} color="bg-emerald-600" />
                <SummaryCard label="Servizi OK" value={summary.servicesOk} icon={CheckCircle2} color="bg-emerald-600" />
                <SummaryCard label="Warning/KO" value={summary.servicesWarning + summary.servicesKo} icon={XCircle} color={(summary.servicesKo > 0) ? 'bg-red-600' : summary.servicesWarning > 0 ? 'bg-amber-600' : 'bg-slate-600'} />
              </>
            )
          ) : (
            <>
              <SummaryCard label="Dispositivi" value={'—'} icon={Server} color="bg-slate-700" />
              <SummaryCard label="Servizi" value={'—'} icon={CheckCircle2} color="bg-slate-700" />
              <SummaryCard label="Collector" value={'OFF'} icon={XCircle} color="bg-red-600" />
            </>
          )}
        </motion.div>

        {/* ─── Odoo Status ───────────────────────────────── */}
        {odoo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`bg-slate-800/40 backdrop-blur-sm rounded-xl border p-4 ${
              isStale ? 'border-slate-600/50' : 'border-slate-700/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isStale ? 'bg-slate-600/20' : 'bg-purple-600/20'
                }`}>
                  <Globe className={`w-5 h-5 ${isStale ? 'text-slate-400' : 'text-purple-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Odoo Produzione</h3>
                  <p className="text-xs text-slate-500">
                    {isStale ? 'dato non aggiornato' : 'ERP LAPA'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-lg font-bold ${isStale ? 'text-slate-500' : 'text-white'}`}>
                    {isStale ? '—' : odoo.ordersToday}
                  </p>
                  <p className="text-xs text-slate-500">Ordini oggi</p>
                </div>
                <StatusBadge status={isStale ? 'offline' : odoo.connected ? 'ok' : 'ko'} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Agents Section (LIVE) ─────────────────────── */}
        {liveAgents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                Agenti AI & Bot
                <span className="text-xs text-slate-500 font-normal ml-2">
                  {agentsOnlineCount}/{agentsTotalCount} online · {agentsMsgTotal} msg 24h
                  {agentsErrorsTotal > 0 && <span className="text-red-400"> · {agentsErrorsTotal} err</span>}
                </span>
              </h2>
              <Link
                href="/agenti-whatsapp/alerts"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Centro alert
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {liveAgents
                .sort((a, b) => {
                  // errors first, then offline, then by name
                  if (a.errors24h !== b.errors24h) return b.errors24h - a.errors24h;
                  if (a.online !== b.online) return a.online ? 1 : -1;
                  return a.agent.name.localeCompare(b.agent.name);
                })
                .map(state => (
                  <LiveAgentRow key={state.slug} state={state} />
                ))}
            </div>
          </motion.div>
        )}

        {/* ─── Devices Grid ──────────────────────────────── */}
        {devices.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-cyan-400" />
              Dispositivi
              <span className="text-xs text-slate-500 font-normal ml-2">
                {devices.filter(d => d.online).length}/{devices.length} online
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {devices
                .sort((a, b) => {
                  if (a.online !== b.online) return a.online ? -1 : 1;
                  const aErr = (a.errors?.length || 0) + (a.services?.filter(s => s.status === 'ko').length || 0);
                  const bErr = (b.errors?.length || 0) + (b.services?.filter(s => s.status === 'ko').length || 0);
                  if (aErr !== bErr) return bErr - aErr;
                  return a.name.localeCompare(b.name);
                })
                .map((device) => (
                  <DeviceCard key={device.id} device={device} isStale={isStale} ageMinutes={ageMinutes} />
                ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 flex items-center gap-3"
          >
            <Monitor className="w-5 h-5 text-slate-500 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-300">Dispositivi · collector non attivo</div>
              <div className="text-xs text-slate-500">
                Il collector infra non sta pubblicando dati. Avvialo sul PC PAUL per vedere CPU/RAM/disco dei device.
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Footer ────────────────────────────────────── */}
        <div className="text-center py-4 text-xs text-slate-600">
          <p>LAPA Infra Monitor v1.0 &mdash; Auto-refresh ogni 30s</p>
          {data?.timestamp && (
            <p>Ultimo check collector: {new Date(data.timestamp).toLocaleString('it-CH')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
