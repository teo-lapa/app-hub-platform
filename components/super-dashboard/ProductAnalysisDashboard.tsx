'use client';

import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  MapPin,
  TruckIcon,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Box,
  Layers,
  Clock,
  Target,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Types
interface ProductData {
  product: {
    id: string;
    name: string;
    code: string;
    category: string;
  };
  period: {
    start: string;
    end: string;
    label: string;
  };
  kpis: {
    totalRevenue: number;
    totalCosts: number;
    netProfit: number;
    marginPercent: number;
    quantitySold: number;
    currentStock: number;
  };
  trends: {
    revenueChange: number;
    profitChange: number;
    marginChange: number;
  };
  salesVsPurchases: Array<{
    date: string;
    sales: number;
    purchases: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  customerDistribution: Array<{
    customer: string;
    value: number;
    percentage: number;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    price: number;
    leadTime: number;
    isPreferred: boolean;
  }>;
  inventory: {
    currentStock: number;
    locations: Array<{
      location: string;
      quantity: number;
    }>;
    incoming: number;
    outgoing: number;
    reorderPoint: number;
    safetyStock: number;
  };
  recommendations: {
    reorderNeeded: boolean;
    action: string;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface ProductAnalysisDashboardProps {
  data: ProductData | null;
  isLoading: boolean;
  error: string | null;
}

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  icon: React.ReactNode;
  gradient: string;
  index: number;
}

function KPICard({ title, value, subtitle, change, icon, gradient, index }: KPICardProps) {
  const hasChange = change !== undefined;
  const isPositive = change && change > 0;
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative group"
    >
      <div className={`bg-gradient-to-br ${gradient} rounded-xl p-6 shadow-2xl border border-white/10 overflow-hidden`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
              {icon}
            </div>
            {hasChange && (
              <div className={`flex items-center gap-1 ${changeColor} text-sm font-semibold`}>
                <ChangeIcon className="w-4 h-4" />
                {change > 0 ? '+' : ''}{change}%
              </div>
            )}
          </div>

          <h3 className="text-white/80 text-sm font-medium mb-1">
            {title}
          </h3>

          <div className="text-3xl font-bold text-white mb-1">
            {value}
          </div>

          {subtitle && (
            <p className="text-white/60 text-xs">
              {subtitle}
            </p>
          )}
        </div>

        {/* Decorative element */}
        <div className="absolute bottom-0 right-0 w-24 h-12 opacity-20">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            <polyline
              points="0,40 20,35 40,38 60,20 80,25 100,15"
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// Main Component
export function ProductAnalysisDashboard({ data, isLoading, error }: ProductAnalysisDashboardProps) {
  // Loading State
  if (isLoading) {
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
            className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-white mb-2">
            Caricamento Analisi Prodotto...
          </h2>
          <p className="text-slate-300">
            Elaborazione dati in corso
          </p>
        </motion.div>
      </div>
    );
  }

  // Error State
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 max-w-md"
        >
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertTriangle className="w-8 h-8" />
            <h3 className="text-2xl font-bold">Errore</h3>
          </div>
          <p className="text-red-300 mb-4">
            {error || 'Impossibile caricare i dati del prodotto'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
          >
            Riprova
          </button>
        </motion.div>
      </div>
    );
  }

  // Chart colors
  const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

  // Custom Tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
          <p className="text-white font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: CHF {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-[1800px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <Package className="w-10 h-10 text-purple-400" />
                Analisi Prodotto
              </h1>
              <p className="text-slate-300 text-lg mt-2">
                {data.product.name} <span className="text-slate-500">({data.product.code})</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-sm">Periodo</div>
              <div className="text-white font-semibold">{data.period.label}</div>
              <div className="text-slate-500 text-xs">
                {data.period.start} - {data.period.end}
              </div>
            </div>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            title="Fatturato Totale"
            value={`CHF ${(data.kpis.totalRevenue / 1000).toFixed(1)}K`}
            subtitle="Revenue generato"
            change={data.trends.revenueChange}
            icon={<DollarSign className="w-6 h-6 text-white" />}
            gradient="from-emerald-500 to-teal-600"
            index={0}
          />
          <KPICard
            title="Costi Totali"
            value={`CHF ${(data.kpis.totalCosts / 1000).toFixed(1)}K`}
            subtitle="Costo acquisto"
            icon={<ShoppingCart className="w-6 h-6 text-white" />}
            gradient="from-orange-500 to-red-600"
            index={1}
          />
          <KPICard
            title="Profitto Netto"
            value={`CHF ${(data.kpis.netProfit / 1000).toFixed(1)}K`}
            subtitle="Margine realizzato"
            change={data.trends.profitChange}
            icon={<TrendingUp className="w-6 h-6 text-white" />}
            gradient="from-purple-500 to-pink-600"
            index={2}
          />
          <KPICard
            title="Margine %"
            value={`${data.kpis.marginPercent.toFixed(1)}%`}
            subtitle="Percentuale margine"
            change={data.trends.marginChange}
            icon={<Target className="w-6 h-6 text-white" />}
            gradient="from-blue-500 to-cyan-600"
            index={3}
          />
          <KPICard
            title="Quantità Venduta"
            value={data.kpis.quantitySold.toLocaleString()}
            subtitle="Unità totali"
            icon={<Box className="w-6 h-6 text-white" />}
            gradient="from-violet-500 to-purple-600"
            index={4}
          />
          <KPICard
            title="Giacenza Attuale"
            value={data.kpis.currentStock.toLocaleString()}
            subtitle="Pezzi in stock"
            icon={<Layers className="w-6 h-6 text-white" />}
            gradient="from-amber-500 to-orange-600"
            index={5}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Sales vs Purchases Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
              Vendite vs Acquisti nel Tempo
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.salesVsPurchases}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Vendite"
                  dot={{ fill: '#10b981', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="purchases"
                  stroke="#ef4444"
                  strokeWidth={3}
                  name="Acquisti"
                  dot={{ fill: '#ef4444', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top 5 Customers Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-400" />
              Top 5 Clienti per Fatturato
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topCustomers.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Fatturato" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Pie Chart and Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Customer Distribution Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-pink-400" />
              Distribuzione Vendite
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.customerDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ customer, percentage }) => `${customer} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.customerDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top 10 Customers Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-400" />
              Top 10 Clienti
            </h3>
            <div className="overflow-auto max-h-[300px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/80 backdrop-blur-sm">
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 font-semibold">Cliente</th>
                    <th className="pb-2 font-semibold text-right">Qty</th>
                    <th className="pb-2 font-semibold text-right">Fatturato</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCustomers.slice(0, 10).map((customer, index) => (
                    <tr key={customer.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 text-white">{customer.name}</td>
                      <td className="py-3 text-right text-slate-300">{customer.quantity}</td>
                      <td className="py-3 text-right text-emerald-400 font-semibold">
                        CHF {(customer.revenue / 1000).toFixed(1)}K
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Suppliers Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TruckIcon className="w-6 h-6 text-orange-400" />
              Fornitori Configurati
            </h3>
            <div className="overflow-auto max-h-[300px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/80 backdrop-blur-sm">
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 font-semibold">Fornitore</th>
                    <th className="pb-2 font-semibold text-right">Prezzo</th>
                    <th className="pb-2 font-semibold text-right">Lead Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suppliers.map((supplier, index) => (
                    <tr
                      key={supplier.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                        supplier.isPreferred ? 'bg-purple-900/20' : ''
                      }`}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{supplier.name}</span>
                          {supplier.isPreferred && (
                            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded">Preferito</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right text-emerald-400 font-semibold">
                        CHF {supplier.price.toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-slate-300">{supplier.leadTime} gg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Inventory and Recommendations */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Inventory Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Package className="w-6 h-6 text-cyan-400" />
              Informazioni Magazzino
            </h3>

            <div className="space-y-4">
              {/* Stock Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="text-slate-400 text-sm mb-1">Giacenza Attuale</div>
                  <div className="text-white text-2xl font-bold">{data.inventory.currentStock}</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="text-slate-400 text-sm mb-1">Valore Stock</div>
                  <div className="text-emerald-400 text-2xl font-bold">
                    CHF {((data.inventory.currentStock * data.kpis.totalCosts) / data.kpis.quantitySold / 1000).toFixed(1)}K
                  </div>
                </div>
              </div>

              {/* Locations */}
              <div>
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  Ubicazioni
                </h4>
                <div className="space-y-2">
                  {data.inventory.locations.map((loc, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                      <span className="text-slate-300">{loc.location}</span>
                      <span className="text-white font-semibold">{loc.quantity} pz</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* In/Out Movement */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <ArrowDownRight className="w-4 h-4" />
                    <span className="text-sm font-medium">In Arrivo</span>
                  </div>
                  <div className="text-white text-xl font-bold">{data.inventory.incoming} pz</div>
                </div>
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-sm font-medium">In Uscita</span>
                  </div>
                  <div className="text-white text-xl font-bold">{data.inventory.outgoing} pz</div>
                </div>
              </div>

              {/* Safety Levels */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-sm">Punto di Riordino</span>
                  <span className="text-yellow-400 font-semibold">{data.inventory.reorderPoint} pz</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Scorta di Sicurezza</span>
                  <span className="text-blue-400 font-semibold">{data.inventory.safetyStock} pz</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              Suggerimenti e Azioni
            </h3>

            <div className="space-y-4">
              {/* Priority Alert */}
              <div
                className={`rounded-lg p-4 border-2 ${
                  data.recommendations.priority === 'critical'
                    ? 'bg-red-900/30 border-red-500'
                    : data.recommendations.priority === 'high'
                    ? 'bg-orange-900/30 border-orange-500'
                    : data.recommendations.priority === 'medium'
                    ? 'bg-yellow-900/30 border-yellow-500'
                    : 'bg-green-900/30 border-green-500'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  {data.recommendations.priority === 'critical' && (
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  )}
                  {data.recommendations.priority === 'high' && (
                    <AlertTriangle className="w-8 h-8 text-orange-400" />
                  )}
                  {data.recommendations.priority === 'medium' && (
                    <Clock className="w-8 h-8 text-yellow-400" />
                  )}
                  {data.recommendations.priority === 'low' && (
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  )}
                  <div>
                    <div className="text-white font-bold text-lg">
                      {data.recommendations.priority === 'critical' && 'Azione Urgente Richiesta'}
                      {data.recommendations.priority === 'high' && 'Attenzione Necessaria'}
                      {data.recommendations.priority === 'medium' && 'Monitoraggio Consigliato'}
                      {data.recommendations.priority === 'low' && 'Situazione Ottimale'}
                    </div>
                    <div className="text-sm text-slate-300">Priorità: {data.recommendations.priority.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* Action Recommendation */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Azione Consigliata</h4>
                <p className="text-slate-300 mb-3">{data.recommendations.action}</p>
                <div className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="font-medium">Motivo:</span>
                  <span>{data.recommendations.reason}</span>
                </div>
              </div>

              {/* Reorder Status */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Riordino Necessario</span>
                  {data.recommendations.reorderNeeded ? (
                    <span className="flex items-center gap-2 text-red-400 font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      SÌ
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-green-400 font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      NO
                    </span>
                  )}
                </div>
              </div>

              {/* Stock Level Indicator */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Livello Scorta</h4>
                <div className="relative">
                  <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        data.inventory.currentStock < data.inventory.reorderPoint
                          ? 'bg-red-500'
                          : data.inventory.currentStock < data.inventory.safetyStock * 1.5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (data.inventory.currentStock / (data.inventory.safetyStock * 2)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                    <span>0</span>
                    <span>Punto Riordino: {data.inventory.reorderPoint}</span>
                    <span>Ottimale: {data.inventory.safetyStock * 2}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Ordina Ora
                </button>
                <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2">
                  <Package className="w-4 h-4" />
                  Dettagli
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
