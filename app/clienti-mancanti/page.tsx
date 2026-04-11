'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, RefreshCw, Package, TrendingUp, MessageSquare,
  ExternalLink, Phone, X, Check, Minus, Loader2, Users, AlertTriangle, DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ODOO = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const fmt = (n: number) => n.toLocaleString('de-CH').replace(/'/g, "'");
const fmtCHF = (n: number) => `CHF ${fmt(Math.round(n))}`;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];

interface DayOrder { orderId: number; orderName: string; amount: number; }
interface Client {
  id: number; name: string; phone: string; fatturato3m: number; ordini3m: number;
  mediaOrdine: number; category: 'hot' | 'warm' | 'cold'; recovered: boolean;
  feedback: string; dailyStatus: Record<string, DayOrder | null>;
}
interface WeeklyData {
  weekStart: string; weekEnd: string; totalLastWeek: number; totalThisWeek: number;
  clients: Client[];
}
interface Product { name: string; qty: number; times: number; avgPrice: number; }
interface OrderTrend { week: string; amount: number; orders: number; }

const borderColor = { hot: 'border-red-500', warm: 'border-yellow-500', cold: 'border-gray-600' };
const bgRow = { hot: 'bg-red-500/5', warm: 'bg-yellow-500/5', cold: 'bg-slate-800/30' };

export default function ClientiMancantiPage() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [prodModal, setProdModal] = useState<{ id: number; name: string; products: Product[] } | null>(null);
  const [trendModal, setTrendModal] = useState<{ id: number; name: string; data: OrderTrend[] } | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const [expandedFeedback, setExpandedFeedback] = useState<number | null>(null);
  const [dayPopup, setDayPopup] = useState<{ clientId: number; day: string; order: DayOrder } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/clienti-mancanti', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_weekly_data' })
    });
    const d = await res.json();
    setData(d);
    const fb: Record<number, string> = {};
    d.clients?.forEach((c: Client) => { fb[c.id] = c.feedback || ''; });
    setFeedbacks(fb);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openProducts = async (client: Client) => {
    setLoadingModal(true);
    setProdModal({ id: client.id, name: client.name, products: [] });
    const res = await fetch('/api/clienti-mancanti', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_client_products', partnerId: client.id })
    });
    const d = await res.json();
    setProdModal({ id: client.id, name: client.name, products: d.products || [] });
    setLoadingModal(false);
  };

  const openTrend = async (client: Client) => {
    setLoadingModal(true);
    setTrendModal({ id: client.id, name: client.name, data: [] });
    const res = await fetch('/api/clienti-mancanti', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_client_orders', partnerId: client.id })
    });
    const d = await res.json();
    setTrendModal({ id: client.id, name: client.name, data: d.trends || [] });
    setLoadingModal(false);
  };

  const saveFeedback = async (partnerId: number, text: string) => {
    setFeedbacks(p => ({ ...p, [partnerId]: text }));
    await fetch('/api/clienti-mancanti', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_feedback', partnerId, weekStart: data?.weekStart, feedback: text })
    });
  };

  const missing = data ? data.totalLastWeek - data.totalThisWeek : 0;
  const fatRischio = data?.clients?.reduce((s, c) => s + c.mediaOrdine, 0) || 0;

  const todayIdx = Math.min(new Date().getDay() - 1, 4); // 0=mon..4=fri, cap at fri

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Clienti Mancanti</h1>
              {data && (
                <p className="text-sm text-gray-400">
                  Settimana {data.weekStart.slice(5).replace('-', '/')} - {data.weekEnd.slice(5).replace('-', '/')} vs settimana precedente
                </p>
              )}
            </div>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin mr-3" size={24} />
            <span className="text-gray-400">Caricamento dati...</span>
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Clienti sett. scorsa', value: data.totalLastWeek, icon: Users, color: 'text-blue-400' },
                { label: 'Clienti questa sett.', value: data.totalThisWeek, icon: Users, color: 'text-green-400' },
                { label: 'Mancanti', value: missing, icon: AlertTriangle, color: 'text-red-400', accent: true },
                { label: 'Fatturato a rischio', value: fmtCHF(fatRischio), icon: DollarSign, color: 'text-red-400', accent: true },
              ].map((kpi, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={`rounded-xl p-4 border ${kpi.accent ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <kpi.icon size={16} className={kpi.color} />
                    <span className="text-xs text-gray-400">{kpi.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${kpi.accent ? 'text-red-400' : 'text-white'}`}>
                    {typeof kpi.value === 'number' ? fmt(kpi.value) : kpi.value}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="rounded-xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 text-gray-400 text-xs uppercase">
                      <th className="text-left px-4 py-3">Cliente</th>
                      <th className="text-right px-3 py-3 hidden sm:table-cell">Valore 3M</th>
                      <th className="text-right px-3 py-3 hidden md:table-cell">Ordini 3M</th>
                      {DAY_LABELS.map((d, i) => (
                        <th key={d} className="text-center px-2 py-3 w-12">{d}</th>
                      ))}
                      <th className="text-center px-3 py-3">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map((client, idx) => (
                      <motion.tr key={client.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: 0.05 * Math.min(idx, 20) }}
                        className={`border-t border-white/5 ${bgRow[client.category]} border-l-4 ${borderColor[client.category]} hover:bg-white/5 transition-colors`}>
                        <td className="px-4 py-3">
                          <a href={`${ODOO}/web#id=${client.id}&model=res.partner&view_type=form`}
                            target="_blank" rel="noopener noreferrer"
                            className="font-medium text-blue-300 hover:text-blue-200 hover:underline flex items-center gap-1">
                            {client.name} <ExternalLink size={12} className="opacity-50" />
                          </a>
                          {client.phone && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone size={10} /> {client.phone}
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-3 hidden sm:table-cell font-mono text-gray-300">
                          {fmtCHF(client.fatturato3m)}
                        </td>
                        <td className="text-right px-3 py-3 hidden md:table-cell text-gray-400">
                          {client.ordini3m}
                        </td>
                        {DAYS.map((day, di) => {
                          const status = client.dailyStatus[day];
                          const isFuture = di > todayIdx;
                          return (
                            <td key={day} className="text-center px-2 py-3 relative">
                              {isFuture ? (
                                <Minus size={16} className="inline text-gray-600" />
                              ) : status ? (
                                <button onClick={() => setDayPopup({ clientId: client.id, day, order: status })}
                                  className="text-green-400 hover:text-green-300 transition-colors">
                                  <Check size={16} className="inline" />
                                </button>
                              ) : (
                                <X size={16} className="inline text-red-400" />
                              )}
                              {/* Day popup */}
                              {dayPopup?.clientId === client.id && dayPopup?.day === day && (
                                <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-slate-800 border border-white/20 rounded-lg p-3 shadow-xl min-w-[180px] text-left"
                                  onMouseLeave={() => setDayPopup(null)}>
                                  <a href={`${ODOO}/web#id=${dayPopup.order.orderId}&model=sale.order&view_type=form`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-blue-300 hover:underline font-medium flex items-center gap-1">
                                    {dayPopup.order.orderName} <ExternalLink size={12} />
                                  </a>
                                  <p className="text-gray-400 text-xs mt-1">{fmtCHF(dayPopup.order.amount)}</p>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openProducts(client)} title="Prodotti"
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-orange-400">
                              <Package size={15} />
                            </button>
                            <button onClick={() => openTrend(client)} title="Andamento"
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-blue-400">
                              <TrendingUp size={15} />
                            </button>
                            <button onClick={() => setExpandedFeedback(expandedFeedback === client.id ? null : client.id)}
                              title="Feedback"
                              className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${feedbacks[client.id] ? 'text-green-400' : 'text-gray-500'}`}>
                              <MessageSquare size={15} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Inline Feedback */}
            <AnimatePresence>
              {expandedFeedback && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-gray-400 mb-2">
                    Feedback per {data.clients.find(c => c.id === expandedFeedback)?.name}
                  </p>
                  <textarea
                    value={feedbacks[expandedFeedback] || ''}
                    onChange={e => setFeedbacks(p => ({ ...p, [expandedFeedback]: e.target.value }))}
                    onBlur={e => saveFeedback(expandedFeedback, e.target.value)}
                    placeholder="Scrivi note su questo cliente..."
                    className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                    rows={3}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : null}
      </div>

      {/* Products Modal */}
      <AnimatePresence>
        {prodModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setProdModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-white/10 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <h3 className="font-bold">Prodotti acquistati</h3>
                  <p className="text-sm text-gray-400">{prodModal.name}</p>
                </div>
                <button onClick={() => setProdModal(null)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[60vh] p-4">
                {loadingModal ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase border-b border-white/10">
                        <th className="text-left py-2">Prodotto</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Volte</th>
                        <th className="text-right py-2">Prezzo medio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prodModal.products.map((p, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="py-2 text-gray-200">{p.name}</td>
                          <td className="text-right py-2 text-gray-400">{fmt(p.qty)}</td>
                          <td className="text-right py-2 text-gray-400">{p.times}</td>
                          <td className="text-right py-2 font-mono text-gray-300">{fmtCHF(p.avgPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trend Modal */}
      <AnimatePresence>
        {trendModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setTrendModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-white/10 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <h3 className="font-bold">Andamento acquisti</h3>
                  <p className="text-sm text-gray-400">{trendModal.name}</p>
                </div>
                <button onClick={() => setTrendModal(null)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                {loadingModal ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                ) : trendModal.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trendModal.data}>
                      <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                        labelStyle={{ color: '#9ca3af' }} />
                      <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-gray-500 py-8">Nessun dato disponibile</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}