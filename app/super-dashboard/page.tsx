'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KPISummarySection } from '@/components/super-dashboard/KPISummarySection';
import { CustomerHealthSection } from '@/components/super-dashboard/CustomerHealthSection';
import { OperationsSection } from '@/components/super-dashboard/OperationsSection';
import { DeliverySection } from '@/components/super-dashboard/DeliverySection';
import { FinanceSection } from '@/components/super-dashboard/FinanceSection';
import { TeamPerformanceSection } from '@/components/super-dashboard/TeamPerformanceSection';
import { ProductIntelligenceSection } from '@/components/super-dashboard/ProductIntelligenceSection';
import { AlertsSection } from '@/components/super-dashboard/AlertsSection';
import { AIInsightsSection } from '@/components/super-dashboard/AIInsightsSection';
import { QuickActionsSection } from '@/components/super-dashboard/QuickActionsSection';
import { SalesOrdersTimelineSection } from '@/components/super-dashboard/SalesOrdersTimelineSection';
import { RefreshCw, Settings, Download, Calendar, Home } from 'lucide-react';
import Link from 'next/link';

export default function SuperDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setLastSync(new Date());
    setTimeout(() => setLoading(false), 1000);
  };

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
            className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-white mb-2">
            Caricamento Super Dashboard...
          </h2>
          <p className="text-slate-300">
            Sincronizzazione dati in corso
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-purple-500/20"
      >
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Pulsante Home */}
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
                  <span className="text-4xl">⚡</span>
                  Super Dashboard
                </h1>
                <p className="text-slate-300 text-sm mt-1">
                  Controllo totale della tua azienda •
                  <span className="text-green-400 ml-2">● Live</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Period Selector */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-slate-800/50 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="today">Oggi</option>
                <option value="week">Questa Settimana</option>
                <option value="month">Questo Mese</option>
                <option value="quarter">Questo Trimestre</option>
                <option value="year">Quest'Anno</option>
              </select>

              {/* Last Sync */}
              <div className="text-sm text-slate-400">
                <Calendar className="w-4 h-4 inline mr-1" />
                Ultimo sync: {lastSync.toLocaleTimeString('it-IT')}
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleRefresh}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna
              </button>

              <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" />
                Export
              </button>

              <button className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition-all">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Summary Cards */}
        <KPISummarySection period={selectedPeriod} />

        {/* Sales Orders Timeline - NEW SECTION */}
        <SalesOrdersTimelineSection period={selectedPeriod} groupBy="week" />

        {/* Row 1: Customer Health + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CustomerHealthSection />
          </div>
          <div>
            <AlertsSection />
          </div>
        </div>

        {/* Row 2: Operations + Delivery */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <OperationsSection />
          <DeliverySection />
        </div>

        {/* Row 3: Finance + Team Performance */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <FinanceSection period={selectedPeriod} />
          <TeamPerformanceSection />
        </div>

        {/* Row 4: Product Intelligence */}
        <ProductIntelligenceSection />

        {/* Row 5: AI Insights + Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <AIInsightsSection />
          </div>
          <div>
            <QuickActionsSection />
          </div>
        </div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-[1800px] mx-auto px-6 py-8 mt-12 text-center text-slate-400 text-sm"
      >
        <p>
          Super Dashboard • LAPA Finest Italian Food •
          Powered by Claude AI & Odoo 17
        </p>
      </motion.div>
    </div>
  );
}
