'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Home, Phone, FileText, ChevronDown, ChevronUp, TrendingDown, Package, Users, AlertTriangle, Info, X, Send, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Types
interface LostProduct {
  productId: number;
  productName: string;
  avgQtyPerWeek: number;
  lastWeekBought: number;
  estimatedLoss: number;
}

interface CustomerAlert {
  customerId: number;
  customerName: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  salesPersonName: string | null;
  status: 'critical' | 'warning' | 'ok';
  variationPercent: number;
  wasWeeklyRevenue: number;
  nowWeeklyRevenue: number;
  daysSinceLastOrder: number;
  lostProducts: LostProduct[];
  totalLoss: number;
  historicalRevenue?: number;
  recentRevenue?: number;
}

interface ProductAlert {
  productId: number;
  productName: string;
  status: 'critical' | 'warning' | 'ok';
  variationPercent: number;
  weekOldQty: number;
  weekOldLabel: string;
  weekNewQty: number;
  weekNewLabel: string;
  customersLostCount: number;
  revenueLost: number;
}

interface SalesAlertData {
  summary: {
    critical: { count: number; revenueLost: number };
    warning: { count: number; revenueLost: number };
    ok: { count: number };
  };
  customers: CustomerAlert[];
  products: ProductAlert[];
}

// Mock data for development (will be replaced by API call)
const mockData: SalesAlertData = {
  summary: {
    critical: { count: 5, revenueLost: 12500 },
    warning: { count: 12, revenueLost: 8300 },
    ok: { count: 89 }
  },
  customers: [
    {
      customerId: 1,
      customerName: 'Ristorante Da Mario',
      status: 'critical',
      variationPercent: -68,
      wasWeeklyRevenue: 1250,
      nowWeeklyRevenue: 400,
      daysSinceLastOrder: 21,
      totalLoss: 3400,
      lostProducts: [
        { productId: 101, productName: 'Mozzarella di Bufala DOP', avgQtyPerWeek: 12, lastWeekBought: 44, estimatedLoss: 1200 },
        { productId: 102, productName: 'Prosciutto di Parma 24 mesi', avgQtyPerWeek: 8, lastWeekBought: 45, estimatedLoss: 1600 },
        { productId: 103, productName: 'Parmigiano Reggiano 36 mesi', avgQtyPerWeek: 5, lastWeekBought: 46, estimatedLoss: 600 }
      ]
    },
    {
      customerId: 2,
      customerName: 'Hotel Bellavista',
      status: 'critical',
      variationPercent: -52,
      wasWeeklyRevenue: 2100,
      nowWeeklyRevenue: 1008,
      daysSinceLastOrder: 14,
      totalLoss: 4368,
      lostProducts: [
        { productId: 104, productName: 'Burrata Pugliese', avgQtyPerWeek: 20, lastWeekBought: 43, estimatedLoss: 1800 },
        { productId: 105, productName: 'Olio EVO Toscano', avgQtyPerWeek: 6, lastWeekBought: 44, estimatedLoss: 900 }
      ]
    },
    {
      customerId: 3,
      customerName: 'Pizzeria Napoli',
      status: 'warning',
      variationPercent: -35,
      wasWeeklyRevenue: 890,
      nowWeeklyRevenue: 578,
      daysSinceLastOrder: 7,
      totalLoss: 1248,
      lostProducts: [
        { productId: 106, productName: 'Pomodoro San Marzano DOP', avgQtyPerWeek: 15, lastWeekBought: 46, estimatedLoss: 450 }
      ]
    },
    {
      customerId: 4,
      customerName: 'Trattoria Toscana',
      status: 'warning',
      variationPercent: -28,
      wasWeeklyRevenue: 650,
      nowWeeklyRevenue: 468,
      daysSinceLastOrder: 5,
      totalLoss: 728,
      lostProducts: [
        { productId: 107, productName: 'Pecorino Romano DOP', avgQtyPerWeek: 4, lastWeekBought: 47, estimatedLoss: 320 }
      ]
    },
    {
      customerId: 5,
      customerName: 'Caffe Milano',
      status: 'ok',
      variationPercent: 12,
      wasWeeklyRevenue: 420,
      nowWeeklyRevenue: 470,
      daysSinceLastOrder: 2,
      totalLoss: 0,
      lostProducts: []
    }
  ],
  products: [
    {
      productId: 101,
      productName: 'Mozzarella di Bufala DOP',
      status: 'critical',
      variationPercent: -45,
      weekOldQty: 180,
      weekOldLabel: 'W44',
      weekNewQty: 99,
      weekNewLabel: 'W48',
      customersLostCount: 8,
      revenueLost: 4860
    },
    {
      productId: 102,
      productName: 'Prosciutto di Parma 24 mesi',
      status: 'critical',
      variationPercent: -38,
      weekOldQty: 95,
      weekOldLabel: 'W44',
      weekNewQty: 59,
      weekNewLabel: 'W48',
      customersLostCount: 5,
      revenueLost: 7200
    },
    {
      productId: 104,
      productName: 'Burrata Pugliese',
      status: 'warning',
      variationPercent: -25,
      weekOldQty: 120,
      weekOldLabel: 'W44',
      weekNewQty: 90,
      weekNewLabel: 'W48',
      customersLostCount: 3,
      revenueLost: 2700
    },
    {
      productId: 105,
      productName: 'Olio EVO Toscano',
      status: 'warning',
      variationPercent: -18,
      weekOldQty: 45,
      weekOldLabel: 'W44',
      weekNewQty: 37,
      weekNewLabel: 'W48',
      customersLostCount: 2,
      revenueLost: 1200
    },
    {
      productId: 108,
      productName: 'Gorgonzola Dolce DOP',
      status: 'ok',
      variationPercent: 8,
      weekOldQty: 50,
      weekOldLabel: 'W44',
      weekNewQty: 54,
      weekNewLabel: 'W48',
      customersLostCount: 0,
      revenueLost: 0
    }
  ]
};

// Status icon component
function StatusIcon({ status }: { status: 'critical' | 'warning' | 'ok' }) {
  const icons = {
    critical: <span className="text-2xl">🔴</span>,
    warning: <span className="text-2xl">🟠</span>,
    ok: <span className="text-2xl">🟢</span>
  };
  return icons[status];
}

// KPI Card component
function KPICard({
  icon,
  label,
  count,
  revenueLost,
  gradient,
  index,
  isActive,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  revenueLost?: number;
  gradient: string;
  index: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        "relative group cursor-pointer",
        isActive && "ring-4 ring-white/50 rounded-xl"
      )}
    >
      <div className={cn(
        "bg-gradient-to-br rounded-xl p-6 shadow-2xl border overflow-hidden transition-all",
        gradient,
        isActive ? "border-white/50" : "border-white/10"
      )}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-3xl">{icon}</div>
            {isActive && <span className="text-white text-xs bg-white/20 px-2 py-1 rounded">Filtro attivo</span>}
          </div>

          <h3 className="text-white/80 text-sm font-medium mb-1">{label}</h3>

          <div className="text-3xl font-bold text-white mb-1">
            {count} clienti
          </div>

          {revenueLost !== undefined && revenueLost > 0 && (
            <p className="text-white/70 text-sm">
              CHF {revenueLost.toLocaleString('de-CH')} persi
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Customer Card component
function CustomerCard({
  customer,
  index,
  onNote,
  onInfo
}: {
  customer: CustomerAlert;
  index: number;
  onNote: (customer: CustomerAlert) => void;
  onInfo: (customer: CustomerAlert) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    critical: 'border-red-500/50 bg-red-500/5',
    warning: 'border-orange-500/50 bg-orange-500/5',
    ok: 'border-green-500/50 bg-green-500/5'
  };

  const variationColor = customer.variationPercent < 0 ? 'text-red-400' : 'text-green-400';

  // Get phone number for WhatsApp (prefer mobile, then phone)
  const phoneNumber = customer.mobile || customer.phone;
  const whatsappUrl = phoneNumber
    ? `https://wa.me/${phoneNumber.replace(/[^0-9+]/g, '').replace('+', '')}?text=${encodeURIComponent(`Buongiorno, sono di LAPA. La contatto riguardo ai nostri ordini...`)}`
    : null;

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "bg-white/5 rounded-xl border overflow-hidden",
        statusColors[customer.status]
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon status={customer.status} />
            <div>
              <h3 className="text-white font-semibold text-lg">{customer.customerName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("font-bold", variationColor)}>
                  {customer.variationPercent > 0 ? '+' : ''}{customer.variationPercent}%
                  {customer.variationPercent < 0 ? ' ↓' : ' ↑'}
                </span>
                {customer.salesPersonName && (
                  <span className="text-slate-500 text-xs">• {customer.salesPersonName}</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-slate-400 text-sm">
              Era: CHF {customer.wasWeeklyRevenue.toLocaleString('de-CH')}/sett
            </div>
            <div className="text-white text-sm">
              Ora: CHF {customer.nowWeeklyRevenue.toLocaleString('de-CH')}/sett
            </div>
            <div className="text-slate-500 text-xs mt-1">
              {customer.daysSinceLastOrder} giorni dall'ultimo ordine
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {whatsappUrl ? (
            <motion.a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Phone className="w-4 h-4" />
              WhatsApp
            </motion.a>
          ) : (
            <motion.button
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed"
            >
              <Phone className="w-4 h-4" />
              No Tel.
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNote(customer)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            Note
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onInfo(customer)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Info className="w-4 h-4" />
            Analisi AI
          </motion.button>

          {customer.lostProducts.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Package className="w-4 h-4" />
              {customer.lostProducts.length} prodotti persi
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </motion.button>
          )}
        </div>
      </div>

      {/* Expanded products list */}
      <AnimatePresence>
        {expanded && customer.lostProducts.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10 bg-white/5"
          >
            <div className="p-4 space-y-2">
              {customer.lostProducts.map((product, pIndex) => (
                <div key={product.productId} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div>
                    <div className="text-white text-sm font-medium">{product.productName}</div>
                    <div className="text-slate-400 text-xs">
                      Media: {product.avgQtyPerWeek} pz/sett - Ultima W{product.lastWeekBought}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 text-sm font-medium">
                      -CHF {product.estimatedLoss.toLocaleString('de-CH')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Product Card component
function ProductCard({ product, index }: { product: ProductAlert; index: number }) {
  const statusColors = {
    critical: 'border-red-500/50 bg-red-500/5',
    warning: 'border-orange-500/50 bg-orange-500/5',
    ok: 'border-green-500/50 bg-green-500/5'
  };

  const variationColor = product.variationPercent < 0 ? 'text-red-400' : 'text-green-400';

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "bg-white/5 rounded-xl border p-4",
        statusColors[product.status]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon status={product.status} />
          <div>
            <h3 className="text-white font-semibold">{product.productName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("font-bold", variationColor)}>
                {product.variationPercent > 0 ? '+' : ''}{product.variationPercent}%
                {product.variationPercent < 0 ? ' ↓' : ' ↑'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-slate-300 text-sm">
            {product.weekOldLabel}: {product.weekOldQty}kg {' '}
            <span className="text-slate-500">→</span>
            {' '} {product.weekNewLabel}: {product.weekNewQty}kg
          </div>
          <div className="flex items-center justify-end gap-4 mt-2">
            <div className="flex items-center gap-1 text-slate-400 text-sm">
              <Users className="w-4 h-4" />
              {product.customersLostCount} clienti persi
            </div>
            {product.revenueLost > 0 && (
              <div className="text-red-400 text-sm font-medium">
                -CHF {product.revenueLost.toLocaleString('de-CH')}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Note Modal Component
function NoteModal({ customer, isOpen, onClose }: { customer: CustomerAlert | null; isOpen: boolean; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen || !customer) return null;

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sales-alert/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.customerId,
          note: note,
          noteType: 'Feedback Vendite'
        })
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          onClose();
          setNote('');
          setSaved(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
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
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-blue-500/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Nota per {customer.customerName}
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Scrivi qui la tua nota... (es: Cliente chiamato, chiuso per ferie fino al 5/12)"
              className="w-full h-32 bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Annulla
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving || !note.trim()}
                className={cn(
                  "px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all",
                  saved
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? '✓ Salvato!' : <><Send className="w-4 h-4" /> Salva in Odoo</>}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Info Modal Component with AI Analysis
function InfoModal({ customer, isOpen, onClose }: { customer: CustomerAlert | null; isOpen: boolean; onClose: () => void }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    if (isOpen && customer && !analysis) {
      fetchAnalysis();
    }
  }, [isOpen, customer]);

  const fetchAnalysis = async () => {
    if (!customer) return;
    setLoadingAI(true);
    try {
      const res = await fetch('/api/sales-alert/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer.customerName,
          variationPercent: customer.variationPercent,
          wasWeeklyRevenue: customer.wasWeeklyRevenue,
          nowWeeklyRevenue: customer.nowWeeklyRevenue,
          daysSinceLastOrder: customer.daysSinceLastOrder,
          lostProducts: customer.lostProducts,
          historicalRevenue: customer.historicalRevenue,
          recentRevenue: customer.recentRevenue
        })
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  if (!isOpen || !customer) return null;

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
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-purple-500/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Analisi AI - {customer.customerName}
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{customer.variationPercent}%</div>
                <div className="text-red-200 text-xs">Variazione</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-400">{customer.daysSinceLastOrder}g</div>
                <div className="text-orange-200 text-xs">Ultimo Ordine</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">{customer.lostProducts.length}</div>
                <div className="text-purple-200 text-xs">Prodotti Persi</div>
              </div>
            </div>

            {/* Revenue Comparison */}
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <h3 className="text-white font-semibold mb-3">📊 Confronto Fatturato</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-sm">Era (media sett.)</div>
                  <div className="text-white text-xl font-bold">CHF {customer.wasWeeklyRevenue.toLocaleString('de-CH')}</div>
                </div>
                <div className="text-3xl">→</div>
                <div className="text-right">
                  <div className="text-slate-400 text-sm">Ora (media sett.)</div>
                  <div className="text-red-400 text-xl font-bold">CHF {customer.nowWeeklyRevenue.toLocaleString('de-CH')}</div>
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Analisi AI
              </h3>
              {loadingAI ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <span className="ml-3 text-purple-300">Analisi in corso...</span>
                </div>
              ) : analysis ? (
                <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                  {analysis}
                </div>
              ) : (
                <div className="text-slate-400 text-center py-4">
                  Errore nel caricamento dell'analisi
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function SalesAlertPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesAlertData | null>(null);
  const [activeTab, setActiveTab] = useState<'clienti' | 'prodotti'>('clienti');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'ok'>('all');
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean; customer: CustomerAlert | null }>({ isOpen: false, customer: null });
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; customer: CustomerAlert | null }>({ isOpen: false, customer: null });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sales-alert');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Map API response to frontend format
          const apiData = result.data;
          const mappedData: SalesAlertData = {
            summary: {
              critical: {
                count: apiData.summary.customersAtRisk.critical,
                revenueLost: apiData.customers
                  .filter((c: any) => c.status === 'critical')
                  .reduce((sum: number, c: any) => sum + Math.abs(c.revenueChange || 0), 0)
              },
              warning: {
                count: apiData.summary.customersAtRisk.warning,
                revenueLost: apiData.customers
                  .filter((c: any) => c.status === 'warning')
                  .reduce((sum: number, c: any) => sum + Math.abs(c.revenueChange || 0), 0)
              },
              ok: { count: apiData.summary.customersAtRisk.ok }
            },
            customers: apiData.customers.map((c: any) => ({
              customerId: c.customerId,
              customerName: c.customerName,
              phone: c.phone || null,
              mobile: c.mobile || null,
              email: c.email || null,
              salesPersonName: c.salesPersonName || null,
              status: c.status,
              variationPercent: Math.round(c.revenueChangePercent || 0),
              wasWeeklyRevenue: Math.round((c.historicalRevenue || 0) / 4), // 4 historical weeks
              nowWeeklyRevenue: Math.round((c.recentRevenue || 0) / 3),    // 3 recent weeks
              daysSinceLastOrder: c.daysSinceLastOrder || 0,
              totalLoss: Math.abs(c.revenueChange || 0),
              historicalRevenue: c.historicalRevenue || 0,
              recentRevenue: c.recentRevenue || 0,
              lostProducts: (c.lostProducts || []).map((p: any) => ({
                productId: p.productId,
                productName: p.productName,
                avgQtyPerWeek: p.avgQtyPerWeek || 0,
                lastWeekBought: parseInt(p.lastPurchasedWeek?.split('W')[1] || '0'),
                estimatedLoss: (p.avgRevenuePerWeek || 0) * 3 // 3 weeks of lost revenue
              }))
            })),
            products: apiData.products.map((p: any) => ({
              productId: p.productId,
              productName: p.productName,
              status: p.status,
              variationPercent: Math.round(p.qtyChangePercent || 0),
              weekOldQty: Math.round(p.historicalQty || 0),
              weekOldLabel: apiData.summary.periods?.historical?.[0]?.split('-')[1] || 'W-6',
              weekNewQty: Math.round(p.recentQty || 0),
              weekNewLabel: apiData.summary.periods?.recent?.[0]?.split('-')[1] || 'W0',
              customersLostCount: p.customerLoss || 0,
              revenueLost: Math.max(0, (p.historicalRevenue || 0) - (p.recentRevenue || 0))
            }))
          };
          setData(mappedData);
        } else {
          // Fallback to mock data if API fails
          setData(mockData);
        }
      } else {
        // Fallback to mock data
        setData(mockData);
      }
    } catch (error) {
      console.error('Error fetching sales alert data:', error);
      // Fallback to mock data
      setData(mockData);
    } finally {
      setLoading(false);
      setLastSync(new Date());
    }
  };

  const handleRefresh = () => {
    fetchData();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-white mb-2">
            Caricamento Sales Alert...
          </h2>
          <p className="text-slate-300">
            Analisi vendite in corso
          </p>
        </motion.div>
      </div>
    );
  }

  // Sort customers and products by status severity
  const sortedCustomers = [...(data?.customers || [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2 };
    return order[a.status] - order[b.status];
  });

  const sortedProducts = [...(data?.products || [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-red-500/20"
      >
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Home Button */}
              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-semibold shadow-lg transition-all"
                >
                  <Home className="w-5 h-5" />
                  <span>Home</span>
                </motion.button>
              </Link>

              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <span className="text-4xl">🚨</span>
                  Sales Alert
                </h1>
                <p className="text-slate-300 text-sm mt-1">
                  Intelligenza vendite in tempo reale
                  <span className="text-red-400 ml-2">● Live</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Last Sync */}
              <div className="text-sm text-slate-400">
                Ultimo sync: {lastSync.toLocaleTimeString('it-IT')}
              </div>

              {/* Refresh Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Summary Cards */}
        <section>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              Riepilogo Situazione
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              icon="🔴"
              label="CRITICO"
              count={data?.summary.critical.count || 0}
              revenueLost={data?.summary.critical.revenueLost}
              gradient="from-red-600 to-red-800"
              index={0}
              isActive={statusFilter === 'critical'}
              onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
            />
            <KPICard
              icon="🟠"
              label="ATTENZIONE"
              count={data?.summary.warning.count || 0}
              revenueLost={data?.summary.warning.revenueLost}
              gradient="from-orange-500 to-orange-700"
              index={1}
              isActive={statusFilter === 'warning'}
              onClick={() => setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning')}
            />
            <KPICard
              icon="🟢"
              label="OK"
              count={data?.summary.ok.count || 0}
              gradient="from-green-600 to-green-800"
              index={2}
              isActive={statusFilter === 'ok'}
              onClick={() => setStatusFilter(statusFilter === 'ok' ? 'all' : 'ok')}
            />
          </div>
          {statusFilter !== 'all' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2"
            >
              <span className="text-slate-400 text-sm">Filtro attivo:</span>
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-medium",
                statusFilter === 'critical' && "bg-red-500/20 text-red-300",
                statusFilter === 'warning' && "bg-orange-500/20 text-orange-300",
                statusFilter === 'ok' && "bg-green-500/20 text-green-300"
              )}>
                {statusFilter === 'critical' ? 'Critici' : statusFilter === 'warning' ? 'Attenzione' : 'OK'}
              </span>
              <button
                onClick={() => setStatusFilter('all')}
                className="text-slate-400 hover:text-white text-sm underline"
              >
                Rimuovi filtro
              </button>
            </motion.div>
          )}
        </section>

        {/* Tabs */}
        <section>
          <div className="flex gap-2 mb-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('clienti')}
              className={cn(
                "px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2",
                activeTab === 'clienti'
                  ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              )}
            >
              <Users className="w-5 h-5" />
              Clienti
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('prodotti')}
              className={cn(
                "px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2",
                activeTab === 'prodotti'
                  ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              )}
            >
              <Package className="w-5 h-5" />
              Prodotti
            </motion.button>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'clienti' ? (
              <motion.div
                key="clienti"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {sortedCustomers
                  .filter(c => statusFilter === 'all' || c.status === statusFilter)
                  .map((customer, index) => (
                  <CustomerCard
                    key={customer.customerId}
                    customer={customer}
                    index={index}
                    onNote={(c) => setNoteModal({ isOpen: true, customer: c })}
                    onInfo={(c) => setInfoModal({ isOpen: true, customer: c })}
                  />
                ))}

                {sortedCustomers.filter(c => statusFilter === 'all' || c.status === statusFilter).length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun cliente trovato {statusFilter !== 'all' && 'con questo filtro'}</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="prodotti"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {sortedProducts.map((product, index) => (
                  <ProductCard key={product.productId} product={product} index={index} />
                ))}

                {sortedProducts.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun prodotto trovato</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-[1800px] mx-auto px-6 py-8 mt-12 text-center text-slate-400 text-sm"
      >
        <p>
          Sales Alert • LAPA Finest Italian Food •
          Powered by Claude AI & Odoo 17
        </p>
      </motion.div>

      {/* Modals */}
      <NoteModal
        isOpen={noteModal.isOpen}
        customer={noteModal.customer}
        onClose={() => setNoteModal({ isOpen: false, customer: null })}
      />
      <InfoModal
        isOpen={infoModal.isOpen}
        customer={infoModal.customer}
        onClose={() => setInfoModal({ isOpen: false, customer: null })}
      />
    </div>
  );
}
