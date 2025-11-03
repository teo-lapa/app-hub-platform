'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  Calendar,
  AlertCircle,
  Download,
  BarChart3,
  PieChart,
} from 'lucide-react';
import jsPDF from 'jspdf';

interface ProductAnalysisData {
  product: {
    id: number;
    name: string;
    current_stock: number;
    uom: string;
    avg_price: number;
    supplier_name: string;
  };
  period: {
    dateFrom: string;
    dateTo: string;
    days: number;
  };
  sales: {
    totalQuantity: number;
    totalRevenue: number;
    avgDailyQuantity: number;
    avgDailyRevenue: number;
    trend: number; // percentage change vs previous period
  };
  customers: {
    totalCustomers: number;
    topCustomers: Array<{
      id: number;
      name: string;
      quantity: number;
      revenue: number;
      orders: number;
    }>;
  };
  timeline: Array<{
    date: string;
    quantity: number;
    revenue: number;
    orders: number;
  }>;
  stockAnalysis: {
    daysOfStock: number;
    reorderPoint: number;
    suggestedOrderQty: number;
    stockStatus: 'critical' | 'low' | 'adequate' | 'high';
  };
}

interface ProductAnalysisDashboardProps {
  data: ProductAnalysisData;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

export function ProductAnalysisDashboard({
  data,
  onExportPDF,
  onExportExcel,
}: ProductAnalysisDashboardProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'customers' | 'timeline'>('overview');

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'from-red-500 to-red-600';
      case 'low':
        return 'from-orange-500 to-orange-600';
      case 'adequate':
        return 'from-green-500 to-green-600';
      case 'high':
        return 'from-blue-500 to-blue-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-5 h-5 text-green-400" />;
    if (trend < 0) return <TrendingDown className="w-5 h-5 text-red-400" />;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header with Product Info */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-2">{data.product.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-blue-200">
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                Stock: {data.product.current_stock.toFixed(1)} {data.product.uom}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                CHF {data.product.avg_price.toFixed(2)} / {data.product.uom}
              </span>
              <span>•</span>
              <span>Fornitore: {data.product.supplier_name}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onExportPDF}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg transition-all flex items-center gap-2 font-semibold"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={onExportExcel}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all flex items-center gap-2 font-semibold"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-blue-300">
          <Calendar className="w-4 h-4" />
          Periodo: {new Date(data.period.dateFrom).toLocaleDateString('it-IT')} -{' '}
          {new Date(data.period.dateTo).toLocaleDateString('it-IT')} ({data.period.days} giorni)
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Quantità Venduta"
          value={`${data.sales.totalQuantity.toFixed(1)} ${data.product.uom}`}
          subtitle={`Media: ${data.sales.avgDailyQuantity.toFixed(1)} ${data.product.uom}/giorno`}
          icon={ShoppingCart}
          color="blue"
          trend={data.sales.trend}
        />
        <MetricCard
          title="Revenue Totale"
          value={`CHF ${data.sales.totalRevenue.toFixed(2)}`}
          subtitle={`Media: CHF ${data.sales.avgDailyRevenue.toFixed(2)}/giorno`}
          icon={DollarSign}
          color="green"
          trend={data.sales.trend}
        />
        <MetricCard
          title="Clienti Serviti"
          value={data.customers.totalCustomers}
          subtitle={`Top cliente: ${data.customers.topCustomers[0]?.name || 'N/A'}`}
          icon={Users}
          color="purple"
        />
        <MetricCard
          title="Giorni di Stock"
          value={data.stockAnalysis.daysOfStock.toFixed(1)}
          subtitle={`Status: ${data.stockAnalysis.stockStatus.toUpperCase()}`}
          icon={AlertCircle}
          color={data.stockAnalysis.stockStatus === 'critical' ? 'red' : 'orange'}
        />
      </div>

      {/* View Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedView('overview')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            selectedView === 'overview'
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-blue-200 hover:bg-white/20'
          }`}
        >
          Panoramica
        </button>
        <button
          onClick={() => setSelectedView('customers')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            selectedView === 'customers'
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-blue-200 hover:bg-white/20'
          }`}
        >
          Clienti
        </button>
        <button
          onClick={() => setSelectedView('timeline')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            selectedView === 'timeline'
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-blue-200 hover:bg-white/20'
          }`}
        >
          Timeline Vendite
        </button>
      </div>

      {/* Content Based on Selected View */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stock Analysis */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Analisi Stock
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-blue-200">Stock Corrente:</span>
                <span className="text-white font-bold text-lg">
                  {data.product.current_stock.toFixed(1)} {data.product.uom}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-200">Giorni di Copertura:</span>
                <span className="text-white font-bold text-lg">
                  {data.stockAnalysis.daysOfStock.toFixed(1)} giorni
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-200">Punto Riordino:</span>
                <span className="text-orange-400 font-bold text-lg">
                  {data.stockAnalysis.reorderPoint.toFixed(1)} {data.product.uom}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-200">Qtà Suggerita Ordine:</span>
                <span className="text-green-400 font-bold text-lg">
                  {data.stockAnalysis.suggestedOrderQty.toFixed(0)} {data.product.uom}
                </span>
              </div>
              <div className="mt-4">
                <div
                  className={`bg-gradient-to-r ${getStockStatusColor(
                    data.stockAnalysis.stockStatus
                  )} text-white px-4 py-2 rounded-lg text-center font-bold`}
                >
                  Status: {data.stockAnalysis.stockStatus.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Sales Performance */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-green-400" />
              Performance Vendite
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-200">Vendite Totali</span>
                  <span className="text-white font-bold">
                    {data.sales.totalQuantity.toFixed(1)} {data.product.uom}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-full" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-200">Media Giornaliera</span>
                  <span className="text-white font-bold">
                    {data.sales.avgDailyQuantity.toFixed(1)} {data.product.uom}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-200">Revenue Media</span>
                  <span className="text-green-400 font-bold">
                    CHF {data.sales.avgDailyRevenue.toFixed(2)}/giorno
                  </span>
                </div>
              </div>
              {data.sales.trend !== 0 && (
                <div className="mt-4 bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(data.sales.trend)}
                    <span className="text-white font-semibold">
                      Trend: {data.sales.trend > 0 ? '+' : ''}
                      {data.sales.trend.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm text-blue-300 mt-1">
                    vs. periodo precedente
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedView === 'customers' && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Top Clienti ({data.customers.topCustomers.length})
          </h3>
          <div className="space-y-3">
            {data.customers.topCustomers.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{customer.name}</div>
                      <div className="text-blue-300 text-sm">{customer.orders} ordini</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">
                      {customer.quantity.toFixed(1)} {data.product.uom}
                    </div>
                    <div className="text-green-400 text-sm">CHF {customer.revenue.toFixed(2)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {selectedView === 'timeline' && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-400" />
            Timeline Vendite Giornaliere
          </h3>
          <div className="space-y-2">
            {data.timeline.map((day, index) => {
              const maxQty = Math.max(...data.timeline.map((d) => d.quantity));
              const widthPercent = (day.quantity / maxQty) * 100;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="text-blue-300 text-sm w-28">
                    {new Date(day.date).toLocaleDateString('it-IT')}
                  </div>
                  <div className="flex-1">
                    <div className="bg-blue-500/20 rounded-full h-8 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPercent}%` }}
                        transition={{ duration: 0.5, delay: index * 0.02 }}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full flex items-center justify-end px-3 text-white text-sm font-semibold"
                      >
                        {day.quantity > 0 && `${day.quantity.toFixed(1)} ${data.product.uom}`}
                      </motion.div>
                    </div>
                  </div>
                  <div className="text-green-300 text-sm font-semibold w-32 text-right">
                    CHF {day.revenue.toFixed(2)}
                  </div>
                  <div className="text-blue-200 text-xs w-20 text-right">{day.orders} ordini</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  color: string;
  trend?: number;
}) {
  const colorClasses: Record<string, string> = {
    green: 'from-green-500 to-green-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colorClasses[color]} text-white rounded-xl p-6 shadow-lg`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-6 h-6" />
        {trend !== undefined && trend !== 0 && (
          <div className="flex items-center gap-1 text-sm">
            {trend > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-xs opacity-75 mt-1">{subtitle}</p>
    </motion.div>
  );
}
