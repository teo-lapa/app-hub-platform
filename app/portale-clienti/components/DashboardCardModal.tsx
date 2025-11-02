'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';

export type CardType = 'orders' | 'revenue' | 'avg' | 'credit' | 'overdue';

interface DashboardCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: CardType;
  kpis: {
    orders_count: number;
    revenue_ytd: number;
    avg_order: number;
    credit_available: number;
    credit_limit: number;
    overdue_invoices: number;
    overdue_amount: number;
  };
  currency?: string;
}

interface DetailedOrder {
  id: number;
  name: string;
  date_order: string;
  amount_total: number;
  state: string;
  state_label: string;
}

interface MonthlyRevenue {
  month: string;
  month_name: string;
  revenue: number;
}

interface DetailedInvoice {
  id: number;
  name: string;
  invoice_date: string;
  invoice_date_due: string;
  amount_total: number;
  amount_residual: number;
  is_overdue: boolean;
  days_overdue: number;
}

interface DetailedData {
  orders?: DetailedOrder[];
  monthly_revenue?: MonthlyRevenue[];
  previous_year_total?: number;
  avg_comparison?: {
    current_avg: number;
    historical_avg: number;
    percentage_diff: number;
  };
  recent_orders_for_avg?: DetailedOrder[];
  credit_info?: {
    total_limit: number;
    used_credit: number;
    available_credit: number;
    usage_percentage: number;
  };
  invoices?: DetailedInvoice[];
  all_recent_invoices?: DetailedInvoice[];
}

export function DashboardCardModal({
  isOpen,
  onClose,
  cardType,
  kpis,
  currency = 'CHF'
}: DashboardCardModalProps) {
  const [detailedData, setDetailedData] = useState<DetailedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDetailedData();
    }
  }, [isOpen, cardType]);

  const fetchDetailedData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/portale-clienti/dashboard/details?type=${cardType}`);

      if (!response.ok) {
        throw new Error('Failed to fetch detailed data');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load details');
      }

      setDetailedData(data.data);
    } catch (err: any) {
      console.error('Error fetching details:', err);
      setError(err.message || 'Errore nel caricamento dei dettagli');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    // Use Swiss locale for CHF, Italian for EUR
    const locale = currency === 'CHF' ? 'de-CH' : 'it-IT';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const getCardConfig = () => {
    switch (cardType) {
      case 'orders':
        return {
          title: 'Ordini di Questo Mese',
          icon: ShoppingCart,
          color: 'from-blue-500 to-blue-600',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          iconColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'revenue':
        return {
          title: 'Fatturato Year-To-Date',
          icon: TrendingUp,
          color: 'from-green-500 to-green-600',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'avg':
        return {
          title: 'Analisi Ordine Medio',
          icon: DollarSign,
          color: 'from-purple-500 to-purple-600',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          iconColor: 'text-purple-600 dark:text-purple-400'
        };
      case 'credit':
        return {
          title: 'Situazione Credito',
          icon: CreditCard,
          color: 'from-indigo-500 to-indigo-600',
          bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
          iconColor: 'text-indigo-600 dark:text-indigo-400'
        };
      case 'overdue':
        return {
          title: 'Fatture Scadute',
          icon: AlertTriangle,
          color: 'from-red-500 to-red-600',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          iconColor: 'text-red-600 dark:text-red-400'
        };
    }
  };

  const config = getCardConfig();
  const Icon = config.icon;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      );
    }

    if (!detailedData) {
      return null;
    }

    switch (cardType) {
      case 'orders':
        return renderOrdersContent();
      case 'revenue':
        return renderRevenueContent();
      case 'avg':
        return renderAvgContent();
      case 'credit':
        return renderCreditContent();
      case 'overdue':
        return renderOverdueContent();
    }
  };

  const renderOrdersContent = () => {
    const orders = detailedData?.orders || [];

    if (orders.length === 0) {
      return (
        <div className="text-center py-8">
          <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Nessun ordine questo mese</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {orders.map((order, index) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {order.name}
                </span>
                <span className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${order.state === 'sale' || order.state === 'done'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                  }
                `}>
                  {order.state_label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(order.date_order)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(order.amount_total)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderRevenueContent = () => {
    const monthlyRevenue = detailedData?.monthly_revenue || [];
    const previousYearTotal = detailedData?.previous_year_total || 0;
    const currentTotal = kpis.revenue_ytd;
    const yearOverYearChange = previousYearTotal > 0
      ? ((currentTotal - previousYearTotal) / previousYearTotal) * 100
      : 0;

    return (
      <div className="space-y-6">
        {/* YTD Total */}
        <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Totale YTD</p>
          <p className="text-4xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(currentTotal)}
          </p>
          {previousYearTotal > 0 && (
            <div className={`flex items-center justify-center gap-2 mt-3 text-sm ${
              yearOverYearChange >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {yearOverYearChange >= 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              <span className="font-semibold">
                {Math.abs(yearOverYearChange).toFixed(1)}% vs anno precedente
              </span>
            </div>
          )}
        </div>

        {/* Monthly Breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Breakdown Mensile
          </h3>
          <div className="space-y-2">
            {monthlyRevenue.map((month, index) => {
              const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue));
              const percentage = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;

              return (
                <motion.div
                  key={month.month}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{month.month_name}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(month.revenue)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-green-500 to-green-600"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAvgContent = () => {
    const comparison = detailedData?.avg_comparison;
    const recentOrders = detailedData?.recent_orders_for_avg || [];

    return (
      <div className="space-y-6">
        {/* Current Average */}
        <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ordine Medio Attuale</p>
          <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(kpis.avg_order)}
          </p>
          {comparison && (
            <div className={`flex items-center justify-center gap-2 mt-3 text-sm ${
              comparison.percentage_diff >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {comparison.percentage_diff >= 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              <span className="font-semibold">
                {Math.abs(comparison.percentage_diff).toFixed(1)}% {comparison.percentage_diff >= 0 ? 'sopra' : 'sotto'} la media storica
              </span>
            </div>
          )}
        </div>

        {/* Comparison */}
        {comparison && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Media Attuale</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(comparison.current_avg)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Media Storica</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(comparison.historical_avg)}
              </p>
            </div>
          </div>
        )}

        {/* Recent Orders */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Ultimi 10 Ordini
          </h3>
          <div className="space-y-2">
            {recentOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {order.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {formatDate(order.date_order)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(order.amount_total)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCreditContent = () => {
    const creditInfo = detailedData?.credit_info;

    if (!creditInfo) {
      return (
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Informazioni credito non disponibili</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Credit Available */}
        <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Credito Disponibile</p>
          <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(creditInfo.available_credit)}
          </p>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Utilizzo Credito</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {creditInfo.usage_percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(creditInfo.usage_percentage, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full ${
                creditInfo.usage_percentage > 90
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : creditInfo.usage_percentage > 70
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                  : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
              }`}
            />
          </div>
        </div>

        {/* Credit Details */}
        <div className="grid grid-cols-1 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Limite Totale</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(creditInfo.total_limit)}
              </span>
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Credito Utilizzato</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(creditInfo.used_credit)}
              </span>
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Credito Disponibile</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency(creditInfo.available_credit)}
              </span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Nota:</strong> Limite: {formatCurrency(creditInfo.total_limit)},
            Utilizzato: {formatCurrency(creditInfo.used_credit)},
            Disponibile: {formatCurrency(creditInfo.available_credit)}
          </p>
        </div>
      </div>
    );
  };

  const renderOverdueContent = () => {
    const overdueInvoices = detailedData?.invoices || [];
    const allRecentInvoices = detailedData?.all_recent_invoices || [];

    if (overdueInvoices.length === 0) {
      return (
        <div className="space-y-6">
          {/* Success Message */}
          <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <p className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
              Nessuna fattura scaduta!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ottimo lavoro! Tutti i pagamenti sono in regola.
            </p>
          </div>

          {/* Recent Invoices */}
          {allRecentInvoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Ultime 10 Fatture
              </h3>
              <div className="space-y-2">
                {allRecentInvoices.map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Scadenza: {formatDate(invoice.invoice_date_due)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(invoice.amount_residual)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {overdueInvoices.map((invoice, index) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {invoice.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    {invoice.days_overdue} giorni
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Scadenza: {formatDate(invoice.invoice_date_due)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(invoice.amount_residual)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Totale: {formatCurrency(invoice.amount_total)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mt-2">
              <Clock className="h-3 w-3" />
              <span>In ritardo di {invoice.days_overdue} giorni</span>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header */}
                <div className={`relative overflow-hidden ${config.bgColor} px-6 py-6 border-b border-gray-200 dark:border-gray-700`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${config.color} opacity-10`} />
                  <div className="relative flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`${config.bgColor} rounded-xl p-3`}>
                        <Icon className={`h-8 w-8 ${config.iconColor}`} />
                      </div>
                      <div>
                        <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white">
                          {config.title}
                        </Dialog.Title>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Dettagli completi e analisi
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
                  {renderContent()}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    Chiudi
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
