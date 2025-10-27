'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  TrendingUp,
  ShoppingCart,
  Calendar,
  MessageSquare,
  Package,
  Lightbulb,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { HealthScoreBadge } from '@/components/maestro/HealthScoreBadge';
import { InteractionModal } from '@/components/maestro/InteractionModal';
import { formatCurrency, formatNumber, getChurnRiskColor } from '@/lib/utils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

type Tab = 'overview' | 'orders' | 'interactions' | 'products' | 'insights';

// Fetch customer detail from API
async function fetchCustomerDetail(customerId: string) {
  const response = await fetch(`/api/maestro/customers/${customerId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch customer detail');
  }
  return response.json();
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch real data using React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-detail', params.id],
    queryFn: () => fetchCustomerDetail(params.id),
    retry: 2,
    staleTime: 0, // Always fresh
  });

  // Handler per chiusura modal con refresh
  const handleCloseInteractionModal = () => {
    console.log('🔄 [CUSTOMER-PAGE] handleCloseInteractionModal called');
    console.log('🔄 [CUSTOMER-PAGE] Invalidating query with key:', ['customer-detail', params.id]);

    setShowInteractionModal(false);

    // Invalida la cache per forzare il refresh
    queryClient.invalidateQueries({ queryKey: ['customer-detail', params.id] });

    console.log('✅ [CUSTOMER-PAGE] Query invalidated, React Query should refetch now');
  };

  // Debug logging
  if (data) {
    console.log('[CUSTOMER-DETAIL] Data received:', {
      customer_name: data.customer?.name,
      revenue_trend: data.revenue_trend,
      orders_count: data.orders?.length || 0,
      interactions_count: data.interactions?.length || 0,
      recommendations_count: data.recommendations?.length || 0,
      top_products_count: data.customer?.top_products?.length || 0,
      odoo_connection: data.metadata?.odoo_connection,
    });
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'orders', label: 'Ordini', icon: ShoppingCart },
    { id: 'interactions', label: 'Interazioni', icon: MessageSquare },
    { id: 'products', label: 'Prodotti', icon: Package },
    { id: 'insights', label: 'AI Insights', icon: Lightbulb }
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-slate-400">Caricamento dati cliente...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/maestro-ai/daily-plan"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al piano giornaliero
          </Link>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Errore nel caricamento</h3>
                <p className="text-slate-300">
                  {error ? (error as Error).message : 'Cliente non trovato'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { customer, recommendations, interactions, orders, revenue_trend, metadata } = data;

  // Calculate category spend for pie chart
  const categorySpend = Object.entries(customer.product_categories || {}).map(([name, stats]: [string, any], idx) => ({
    name,
    value: stats.total_revenue,
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]
  }));

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <Link
          href="/maestro-ai/daily-plan"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna al piano giornaliero
        </Link>

        {/* Odoo Connection Warning */}
        {metadata?.odoo_connection === 'error' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-200">
                  Impossibile recuperare ordini da Odoo. Visualizzando solo dati sincronizzati.
                </p>
                {metadata.odoo_error && (
                  <p className="text-xs text-yellow-300/70 mt-1">{metadata.odoo_error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Churn Alert Banner */}
        {customer.churn_risk_score >= 70 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-300 mb-1">
                  ⚠️ Cliente ad Alto Rischio Churn ({customer.churn_risk_score}%)
                </h3>
                <p className="text-sm text-red-200 mb-2">
                  Questo cliente necessita di attenzione urgente. Sono passati <strong>{customer.days_since_last_order} giorni</strong> dall'ultimo ordine.
                </p>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">
                    Pianifica Visita Urgente
                  </button>
                  <button className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-200 text-sm rounded-lg transition-colors">
                    Invia Proposta Speciale
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-6"
        >
          <div className="flex items-start justify-between gap-6">
            {/* Left: Company Info */}
            <div className="flex items-start gap-4 flex-1">
              <div className="flex-shrink-0 h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {customer.name}
                </h1>
                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                  {customer.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {customer.city}
                    </span>
                  )}
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      className="flex items-center gap-1 hover:text-blue-400"
                    >
                      <Phone className="h-4 w-4" />
                      {customer.phone}
                    </a>
                  )}
                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="flex items-center gap-1 hover:text-blue-400"
                    >
                      <Mail className="h-4 w-4" />
                      {customer.email}
                    </a>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Odoo ID: {customer.odoo_partner_id}
                  {customer.assigned_salesperson_name && (
                    <> • Venditore: <span className="text-slate-400">{customer.assigned_salesperson_name}</span></>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Health Score & Actions */}
            <div className="flex flex-col items-end gap-4">
              <HealthScoreBadge score={customer.health_score} size="lg" />
              <div className="flex gap-2">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    Chiama
                  </a>
                )}
                <button
                  onClick={() => setShowInteractionModal(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Registra visita
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700">
            <div>
              <p className="text-xs text-slate-400 mb-1">Churn Risk</p>
              <p className={`text-2xl font-bold ${getChurnRiskColor(customer.churn_risk_score)}`}>
                {Math.round(customer.churn_risk_score)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Revenue Totale</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(customer.total_revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Valore Medio Ordine</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(customer.avg_order_value)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Ultimo Ordine</p>
              <p className={`text-2xl font-bold ${customer.days_since_last_order > 60 ? 'text-red-400' : customer.days_since_last_order > 30 ? 'text-orange-400' : 'text-green-400'}`}>
                {customer.days_since_last_order} giorni fa
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as Tab)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {/* OVERVIEW Tab */}
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Revenue Trend */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Trend Revenue (Ultimi 6 Mesi)</h3>
                  {metadata?.odoo_connection === 'error' && revenue_trend && revenue_trend.length > 0 && (
                    <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
                      Dati stimati
                    </span>
                  )}
                </div>
                {revenue_trend && revenue_trend.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" className="h-[200px] sm:h-[250px] md:h-[280px] lg:h-[300px]">
                      <LineChart data={revenue_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          name="Revenue (CHF)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    {metadata?.odoo_connection === 'error' && (
                      <p className="text-xs text-slate-400 mt-2 text-center">
                        Trend stimato da dati sincronizzati (Odoo non disponibile)
                      </p>
                    )}
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    Nessun dato disponibile
                  </div>
                )}
              </div>

              {/* Category Spend */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Spesa per Categoria</h3>
                {categorySpend.length > 0 ? (
                  <ResponsiveContainer width="100%" className="h-[200px] sm:h-[250px] md:h-[280px] lg:h-[300px]">
                    <PieChart>
                      <Pie
                        data={categorySpend}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => `${entry.name} (${formatCurrency(entry.value)})`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categorySpend.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    Nessuna categoria prodotto disponibile
                  </div>
                )}
              </div>

              {/* Account Info */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Info Account</h3>
                <div className="space-y-3">
                  {customer.first_order_date && (
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">Cliente dal</span>
                      <span className="text-white font-medium">
                        {new Date(customer.first_order_date).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Totale ordini</span>
                    <span className="text-white font-medium">{customer.total_orders}</span>
                  </div>
                  {customer.order_frequency_days && (
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">Frequenza ordini media</span>
                      <span className="text-white font-medium">
                        Ogni {Math.round(customer.order_frequency_days)} giorni
                      </span>
                    </div>
                  )}
                  {customer.last_order_date && (
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Ultimo ordine</span>
                      <span className="text-white font-medium">
                        {new Date(customer.last_order_date).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Scores */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">AI Scores</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-400">Health Score</span>
                      <span className="text-sm font-medium text-white">{Math.round(customer.health_score)}/100</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${customer.health_score}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-400">Churn Risk</span>
                      <span className="text-sm font-medium text-white">{Math.round(customer.churn_risk_score)}/100</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${customer.churn_risk_score}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-400">Upsell Potential</span>
                      <span className="text-sm font-medium text-white">{Math.round(customer.upsell_potential_score)}/100</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${customer.upsell_potential_score}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-400">Engagement</span>
                      <span className="text-sm font-medium text-white">{Math.round(customer.engagement_score)}/100</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${customer.engagement_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ORDERS Tab */}
          {activeTab === 'orders' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Storico Ordini ({orders.length})
              </h3>
              {orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Numero</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Data</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Importo</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Articoli</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order: any) => (
                        <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3 px-4 text-white font-mono text-sm">{order.name}</td>
                          <td className="py-3 px-4 text-slate-300">
                            {new Date(order.date).toLocaleDateString('it-IT')}
                          </td>
                          <td className="py-3 px-4 text-white font-medium">
                            {formatCurrency(order.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-300">{order.items_count} articoli</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              order.state === 'done' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                              order.state === 'sale' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                              'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                            }`}>
                              {order.state === 'done' ? 'Consegnato' : order.state === 'sale' ? 'Confermato' : order.state}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  {metadata?.odoo_connection === 'error' ? (
                    <div className="space-y-4">
                      <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto" />
                      <div>
                        <h4 className="text-white font-medium mb-2">Connessione Odoo non disponibile</h4>
                        <p className="text-slate-400 text-sm mb-4">
                          Gli ordini sono recuperati in tempo reale da Odoo. Al momento non è possibile connettersi.
                        </p>
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 inline-block">
                          <p className="text-sm text-slate-300 mb-2">Metriche disponibili dai dati sincronizzati:</p>
                          <div className="grid grid-cols-2 gap-4 text-left">
                            <div>
                              <p className="text-xs text-slate-400">Totale Ordini</p>
                              <p className="text-lg font-bold text-white">{customer.total_orders}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Revenue Totale</p>
                              <p className="text-lg font-bold text-white">{formatCurrency(customer.total_revenue)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Ultimo Ordine</p>
                              <p className="text-sm font-medium text-white">
                                {customer.last_order_date
                                  ? new Date(customer.last_order_date).toLocaleDateString('it-IT')
                                  : 'N/D'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Valore Medio</p>
                              <p className="text-sm font-medium text-white">{formatCurrency(customer.avg_order_value)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <ShoppingCart className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-500">Nessun ordine confermato trovato per questo cliente</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* INTERACTIONS Tab */}
          {activeTab === 'interactions' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Timeline Interazioni ({interactions.length})
                </h3>
                <button
                  onClick={() => setShowInteractionModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  + Nuova Interazione
                </button>
              </div>
              {interactions.length > 0 ? (
                <div className="space-y-4">
                  {interactions.map((interaction: any) => (
                    <div key={interaction.id} className="flex gap-4">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                        interaction.interaction_type === 'call' ? 'bg-blue-500/10 border border-blue-500/20' :
                        interaction.interaction_type === 'visit' ? 'bg-green-500/10 border border-green-500/20' :
                        interaction.interaction_type === 'email' ? 'bg-purple-500/10 border border-purple-500/20' :
                        'bg-slate-500/10 border border-slate-500/20'
                      }`}>
                        {interaction.interaction_type === 'call' && <Phone className="h-5 w-5 text-blue-400" />}
                        {interaction.interaction_type === 'visit' && <Building2 className="h-5 w-5 text-green-400" />}
                        {interaction.interaction_type === 'email' && <Mail className="h-5 w-5 text-purple-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white capitalize">{interaction.interaction_type}</span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-sm text-slate-400">
                            {new Date(interaction.interaction_date).toLocaleDateString('it-IT')}
                          </span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-sm text-slate-400">{interaction.salesperson_name}</span>
                          <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                            interaction.outcome === 'successful' ? 'bg-green-500/10 text-green-400' :
                            interaction.outcome === 'unsuccessful' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {interaction.outcome}
                          </span>
                        </div>
                        {interaction.notes && (
                          <p className="text-sm text-slate-300 mb-2">{interaction.notes}</p>
                        )}
                        {interaction.order_placed && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                              Ordine generato: {formatCurrency(interaction.order_value || 0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Nessuna interazione registrata per questo cliente
                </div>
              )}
            </motion.div>
          )}

          {/* PRODUCTS Tab */}
          {activeTab === 'products' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Top Products */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Top Prodotti Acquistati</h3>
                {customer.top_products && customer.top_products.length > 0 ? (
                  <div className="space-y-3">
                    {customer.top_products.slice(0, 10).map((product: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-white">{product.product_name}</p>
                          <p className="text-sm text-slate-400">
                            {product.total_quantity} unità • {product.times_purchased} ordini • {formatCurrency(product.total_revenue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    Nessun dato prodotto disponibile
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* INSIGHTS Tab */}
          {activeTab === 'insights' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                AI Insights & Raccomandazioni ({recommendations.length})
              </h3>
              {recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec: any) => (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-lg border ${
                        rec.priority === 'urgent' ? 'bg-red-500/5 border-red-500/20' :
                        rec.priority === 'high' ? 'bg-orange-500/5 border-orange-500/20' :
                        rec.priority === 'medium' ? 'bg-yellow-500/5 border-yellow-500/20' :
                        'bg-blue-500/5 border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                          rec.priority === 'urgent' ? 'bg-red-500/10' :
                          rec.priority === 'high' ? 'bg-orange-500/10' :
                          rec.priority === 'medium' ? 'bg-yellow-500/10' :
                          'bg-blue-500/10'
                        }`}>
                          <Lightbulb className={`h-5 w-5 ${
                            rec.priority === 'urgent' ? 'text-red-400' :
                            rec.priority === 'high' ? 'text-orange-400' :
                            rec.priority === 'medium' ? 'text-yellow-400' :
                            'text-blue-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white">{rec.title}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs uppercase font-medium ${
                              rec.priority === 'urgent' ? 'bg-red-500/20 text-red-300' :
                              rec.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                              rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-blue-500/20 text-blue-300'
                            }`}>
                              {rec.priority}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 mb-2">{rec.description}</p>
                          {rec.reasoning && (
                            <p className="text-xs text-slate-400 mb-2 italic">{rec.reasoning}</p>
                          )}
                          {rec.suggested_actions && rec.suggested_actions.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-slate-400 mb-1">Azioni suggerite:</p>
                              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                                {rec.suggested_actions.map((action: string, i: number) => (
                                  <li key={i}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Nessuna raccomandazione AI attiva per questo cliente
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Interaction Modal */}
      <InteractionModal
        isOpen={showInteractionModal}
        onClose={handleCloseInteractionModal}
        customerId={customer.id}
        customerName={customer.name}
        odooPartnerId={customer.odoo_partner_id}
        salesPersonId={customer.assigned_salesperson_id}
      />
    </div>
  );
}
