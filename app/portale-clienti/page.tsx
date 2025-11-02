'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { KPICards } from './components/KPICards';
import { RecentOrders } from './components/RecentOrders';
import { ActiveDeliveries } from './components/ActiveDeliveries';
import { OpenInvoices } from './components/OpenInvoices';
import { QuickActions } from './components/QuickActions';
import { StellaFloatingButton } from './components/StellaFloatingButton';

interface DashboardKPIs {
  orders_count: number;
  revenue_ytd: number;
  avg_order: number;
  credit_available: number;
  credit_limit: number;
  overdue_invoices: number;
  overdue_amount: number;
}

interface RecentOrder {
  id: number;
  name: string;
  date_order: string;
  amount_total: number;
  state: string;
  state_label: string;
}

interface ActiveDelivery {
  id: number;
  name: string;
  scheduled_date: string;
  origin: string;
  state: string;
  state_label: string;
  location_dest: string;
}

interface OpenInvoice {
  id: number;
  name: string;
  invoice_date: string;
  invoice_date_due: string;
  amount_total: number;
  amount_residual: number;
  state: string;
  payment_state: string;
  is_overdue: boolean;
}

interface DashboardData {
  kpis: DashboardKPIs;
  recent_orders: RecentOrder[];
  active_deliveries: ActiveDelivery[];
  open_invoices: OpenInvoice[];
  currency: string;
  last_sync: string;
}

export default function PortaleClientiPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [currency, setCurrency] = useState<string>('CHF'); // Default to CHF
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/portale-clienti/dashboard');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load dashboard');
      }

      setDashboardData(data.data);
      setCurrency(data.data.currency || 'CHF'); // Set currency from API
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchCustomerProfile = async () => {
    try {
      const response = await fetch('/api/portale-clienti/profile');

      if (!response.ok) {
        console.error('Failed to fetch profile');
        return;
      }

      const data = await response.json();

      if (data.success && data.profile) {
        // Extract first name from full name
        const fullName = data.profile.name || '';
        const firstName = fullName.split(' ')[0];
        setCustomerName(firstName || fullName);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      // Don't show error, just use default welcome message
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchCustomerProfile();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const formatLastSync = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">
                  Errore nel caricamento della dashboard
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                  {error}
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Riprova
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-3 sm:gap-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm font-medium">Dashboard</span>
              </button>
              <div className="hidden sm:block h-8 w-px bg-gray-300 dark:bg-gray-600" />
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                  Portale Clienti
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">
                  {customerName
                    ? `Benvenuto ${customerName}, nel tuo portale personalizzato LAPA`
                    : 'Benvenuto nel tuo portale personalizzato LAPA'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              {dashboardData && (
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <span className="hidden sm:inline">Aggiornato alle </span>
                  <span className="sm:hidden">Agg. </span>
                  {formatLastSync(dashboardData.last_sync)}
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`
                  flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-all
                  ${isRefreshing
                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }
                `}
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Aggiornamento...' : 'Aggiorna'}</span>
                <span className="sm:hidden">{isRefreshing ? '...' : 'Agg.'}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <KPICards
          kpis={dashboardData?.kpis || {
            orders_count: 0,
            revenue_ytd: 0,
            avg_order: 0,
            credit_available: 0,
            credit_limit: 0,
            overdue_invoices: 0,
            overdue_amount: 0
          }}
          currency={currency}
          isLoading={isLoading}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <RecentOrders
            orders={dashboardData?.recent_orders || []}
            currency={currency}
            isLoading={isLoading}
          />

          {/* Active Deliveries */}
          <ActiveDeliveries
            deliveries={dashboardData?.active_deliveries || []}
            isLoading={isLoading}
          />
        </div>

        {/* Open Invoices - Full width */}
        <OpenInvoices
          invoices={dashboardData?.open_invoices || []}
          currency={currency}
          isLoading={isLoading}
        />

        {/* Footer info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-sm text-gray-500 dark:text-gray-500 pb-6"
        >
          <p>
            Tutti i dati sono sincronizzati in tempo reale da Odoo.
          </p>
          <p className="mt-1">
            Per assistenza, contatta il tuo agente di riferimento o usa l'Assistente AI.
          </p>
        </motion.div>
      </div>

      {/* Stella Floating Button */}
      <StellaFloatingButton />
    </div>
  );
}
