'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  DollarSign,
  AlertCircle,
  Target
} from 'lucide-react';

interface AnalyticsProps {
  products: any[];
  predictions: Record<number, any>;
}

export function AnalyticsDashboard({ products, predictions }: AnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  // Calculate metrics
  const metrics = calculateMetrics(products, predictions);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {['week', 'month', 'quarter'].map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period as any)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedPeriod === period
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {period === 'week' && 'Settimana'}
            {period === 'month' && 'Mese'}
            {period === 'quarter' && 'Trimestre'}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Valore Ordini Suggeriti"
          value={`€${metrics.totalOrderValue.toLocaleString()}`}
          icon={DollarSign}
          color="green"
          trend={+15.3}
        />
        <MetricCard
          title="Prodotti Monitorati"
          value={metrics.totalProducts}
          icon={Package}
          color="blue"
        />
        <MetricCard
          title="Giorni Media Stock"
          value={metrics.avgDaysRemaining.toFixed(1)}
          icon={Calendar}
          color="purple"
          trend={metrics.avgDaysRemaining > 14 ? +5 : -5}
        />
        <MetricCard
          title="Tasso Accuratezza AI"
          value={`${metrics.avgConfidence.toFixed(0)}%`}
          icon={Target}
          color="orange"
          trend={+2.1}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stock Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Distribuzione Stock
          </h3>
          <StockDistributionChart data={metrics.stockDistribution} />
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Breakdown Categorie
          </h3>
          <CategoryBreakdownChart data={metrics.categoryBreakdown} />
        </div>
      </div>

      {/* Weekly Pattern */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          Pattern Settimanale Vendite
        </h3>
        <WeeklyPatternChart />
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  trend
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  trend?: number;
}) {
  const colorClasses = {
    green: 'from-green-500 to-green-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white rounded-xl p-6 shadow-lg`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-6 h-6" />
        {trend !== undefined && (
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
    </motion.div>
  );
}

// Stock Distribution Chart
function StockDistributionChart({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([level, count]: any) => {
        const colors: Record<string, string> = {
          CRITICAL: 'bg-red-500',
          HIGH: 'bg-orange-500',
          MEDIUM: 'bg-yellow-500',
          LOW: 'bg-green-500'
        };

        const percentage = (count / Object.values(data).reduce((a: any, b: any) => a + b, 0)) * 100;

        return (
          <div key={level} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{level}</span>
              <span className="text-gray-600">{count} prodotti</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`${colors[level]} h-3 rounded-full transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Category Breakdown Chart
function CategoryBreakdownChart({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      {Object.entries(data).slice(0, 5).map(([category, count]: any) => {
        const total = Object.values(data).reduce((a: any, b: any) => a + b, 0);
        const percentage = ((count / total) * 100).toFixed(1);

        return (
          <div key={category} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="font-medium capitalize">
              {category.replace(/_/g, ' ')}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{count} prod.</span>
              <span className="font-bold text-green-600">{percentage}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Weekly Pattern Chart
function WeeklyPatternChart() {
  const weeklyPattern = {
    Domenica: 0.05,
    Lunedì: 0.15,
    Martedì: 0.35,
    Mercoledì: 0.15,
    Giovedì: 0.15,
    Venerdì: 0.12,
    Sabato: 0.03
  };

  const maxValue = Math.max(...Object.values(weeklyPattern));

  return (
    <div className="flex items-end justify-between gap-2 h-64">
      {Object.entries(weeklyPattern).map(([day, value]) => {
        const height = (value / maxValue) * 100;
        const isHighVolume = value > 0.2;

        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-2">
            <div className="flex-1 w-full flex items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={`w-full rounded-t-lg ${
                  isHighVolume ? 'bg-gradient-to-t from-blue-500 to-blue-600' : 'bg-gradient-to-t from-gray-300 to-gray-400'
                }`}
                title={`${(value * 100).toFixed(1)}%`}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-gray-700">{day.slice(0, 3)}</p>
              <p className="text-xs text-gray-500">{(value * 100).toFixed(0)}%</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Calculate metrics helper
function calculateMetrics(products: any[], predictions: Record<number, any>) {
  let totalOrderValue = 0;
  let totalDaysRemaining = 0;
  let totalConfidence = 0;
  const stockDistribution: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };
  const categoryBreakdown: Record<string, number> = {};

  products.forEach((product) => {
    const prediction = predictions[product.productId];
    if (!prediction) return;

    // Stock distribution
    stockDistribution[prediction.urgencyLevel]++;

    // Category breakdown
    const category = product.category || 'other';
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

    // Totals
    if (prediction.urgencyLevel === 'CRITICAL' || prediction.urgencyLevel === 'HIGH') {
      totalOrderValue += prediction.recommendedQuantity * (product.unitPrice || 10);
    }

    totalDaysRemaining += prediction.daysRemaining;
    totalConfidence += prediction.confidenceScore;
  });

  return {
    totalProducts: products.length,
    totalOrderValue: Math.round(totalOrderValue),
    avgDaysRemaining: totalDaysRemaining / products.length,
    avgConfidence: totalConfidence / products.length,
    stockDistribution,
    categoryBreakdown
  };
}
