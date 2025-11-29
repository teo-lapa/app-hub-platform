'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Check,
  RefreshCw,
  Settings,
  ExternalLink,
  TrendingDown,
  DollarSign,
  Percent,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import type {
  Alert,
  AlertStats,
  AlertRule,
  AlertsResponse,
} from '@/lib/types/alert-rules';
import toast from 'react-hot-toast';

export default function AlertTab() {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const odooBaseUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/controllo-prezzi/alerts', {
        credentials: 'include',
      });

      const data: AlertsResponse = await response.json();

      if (data.success) {
        setAlerts(data.alerts);
        setStats(data.stats);
        setRules(data.rules);
        toast.success(`Generati ${data.alerts.length} alert`);
      } else {
        toast.error(data.error || 'Errore caricamento alert');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/controllo-prezzi/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'acknowledge', alertId }),
      });

      const data = await response.json();

      if (data.success) {
        setAlerts(alerts.map(a =>
          a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a
        ));
        toast.success('Alert riconosciuto');
      } else {
        toast.error('Errore');
      }
    } catch (error) {
      toast.error('Errore di rete');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/controllo-prezzi/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update_rule', ruleId, updates: { enabled } }),
      });

      const data = await response.json();

      if (data.success) {
        setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
        toast.success(enabled ? 'Regola attivata' : 'Regola disattivata');
      }
    } catch (error) {
      toast.error('Errore');
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (!showAcknowledged && alert.acknowledged) return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-blue-600';
      default: return 'bg-slate-600';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5" />;
      case 'high': return <AlertCircle className="w-5 h-5" />;
      case 'medium': return <AlertTriangle className="w-5 h-5" />;
      case 'low': return <Info className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
          Sistema Alert Intelligente
          {stats && stats.unacknowledgedCount > 0 && (
            <span className="px-3 py-1 bg-red-600 text-white text-sm rounded-full animate-pulse">
              {stats.unacknowledgedCount} nuovi
            </span>
          )}
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-4 py-2 glass rounded-lg transition-colors flex items-center gap-2 ${
              showSettings ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <Settings className="w-4 h-4" />
            Regole
          </button>
          <button
            onClick={loadAlerts}
            disabled={loading}
            className="px-4 py-2 glass rounded-lg hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-strong rounded-xl p-6">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurazione Regole Alert
              </h4>
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-3 glass rounded-lg">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleRule(rule.id, !rule.enabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          rule.enabled ? 'bg-green-600' : 'bg-slate-600'
                        }`}
                      >
                        <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-all ${
                          rule.enabled ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                      <div>
                        <div className="font-medium text-white">{rule.name}</div>
                        <div className="text-xs text-slate-400">
                          Soglia: {rule.threshold || 'N/A'} • Severity: {rule.severity}
                          {rule.emailNotify && ' • 📧 Email'}
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(rule.severity)} text-white`}>
                      {rule.severity.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="glass-strong rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Totale Alert</div>
            <div className="text-3xl font-bold text-white">{stats.totalAlerts}</div>
          </div>
          <div className="glass-strong rounded-xl p-4 border border-red-500/30">
            <div className="text-slate-400 text-sm mb-1">Critici</div>
            <div className="text-3xl font-bold text-red-400">{stats.criticalCount}</div>
          </div>
          <div className="glass-strong rounded-xl p-4 border border-orange-500/30">
            <div className="text-slate-400 text-sm mb-1">High</div>
            <div className="text-3xl font-bold text-orange-400">{stats.highCount}</div>
          </div>
          <div className="glass-strong rounded-xl p-4 border border-yellow-500/30">
            <div className="text-slate-400 text-sm mb-1">Medium</div>
            <div className="text-3xl font-bold text-yellow-400">{stats.mediumCount}</div>
          </div>
          <div className="glass-strong rounded-xl p-4 border border-blue-500/30">
            <div className="text-slate-400 text-sm mb-1">Low</div>
            <div className="text-3xl font-bold text-blue-400">{stats.lowCount}</div>
          </div>
          <div className="glass-strong rounded-xl p-4 border border-amber-500/30">
            <div className="text-slate-400 text-sm mb-1">Da Riconoscere</div>
            <div className="text-3xl font-bold text-amber-400">{stats.unacknowledgedCount}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 glass rounded-xl p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterSeverity('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterSeverity === 'all' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tutti
          </button>
          <button
            onClick={() => setFilterSeverity('critical')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterSeverity === 'critical' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Critici
          </button>
          <button
            onClick={() => setFilterSeverity('high')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterSeverity === 'high' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            High
          </button>
          <button
            onClick={() => setFilterSeverity('medium')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterSeverity === 'medium' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Medium
          </button>
        </div>

        <div className="h-8 w-px bg-slate-600" />

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={(e) => setShowAcknowledged(e.target.checked)}
            className="rounded border-slate-600"
          />
          Mostra riconosciuti
        </label>
      </div>

      {/* Alerts List */}
      {loading && (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-3" />
          <p className="text-slate-400">Generazione alert in corso...</p>
        </div>
      )}

      {!loading && filteredAlerts.length === 0 && (
        <div className="text-center py-12 glass-strong rounded-xl">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-400 mb-3" />
          <p className="text-slate-400 text-lg">Nessun alert attivo</p>
          <p className="text-slate-500 text-sm">Tutto sotto controllo!</p>
        </div>
      )}

      {!loading && filteredAlerts.length > 0 && (
        <div className="space-y-3">
          {filteredAlerts.map(alert => {
            const productLink = alert.productId
              ? `${odooBaseUrl}/web#id=${alert.productId}&model=product.product&view_type=form`
              : null;
            const customerLink = alert.customerId
              ? `${odooBaseUrl}/web#id=${alert.customerId}&model=res.partner&view_type=form`
              : null;
            const invoiceLink = alert.invoiceId
              ? `${odooBaseUrl}/web#id=${alert.invoiceId}&model=account.move&view_type=form`
              : null;

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`glass-strong rounded-xl p-4 border-l-4 ${
                  alert.severity === 'critical' ? 'border-red-500' :
                  alert.severity === 'high' ? 'border-orange-500' :
                  alert.severity === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                } ${alert.acknowledged ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}/20 text-${
                        alert.severity === 'critical' ? 'red' :
                        alert.severity === 'high' ? 'orange' :
                        alert.severity === 'medium' ? 'yellow' : 'blue'
                      }-400`}>
                        {getSeverityIcon(alert.severity)}
                      </span>
                      <div>
                        <h4 className="font-bold text-white">{alert.title}</h4>
                        <p className="text-sm text-slate-400">{alert.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-3">
                      {productLink && (
                        <a
                          href={productLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-400 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Prodotto
                        </a>
                      )}
                      {customerLink && (
                        <a
                          href={customerLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-400 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Cliente
                        </a>
                      )}
                      {invoiceLink && (
                        <a
                          href={invoiceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-400 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Fattura
                        </a>
                      )}
                      <span>•</span>
                      <span>{new Date(alert.createdAt).toLocaleString('it-IT')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm transition-colors flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        Riconosci
                      </button>
                    )}
                    {alert.acknowledged && (
                      <span className="px-3 py-1 bg-green-600/30 text-green-400 rounded-lg text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Riconosciuto
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
