'use client';

import { motion } from 'framer-motion';
import { FileText, Calendar, AlertTriangle, CheckCircle, Euro } from 'lucide-react';
import Link from 'next/link';

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

interface OpenInvoicesProps {
  invoices: OpenInvoice[];
  currency?: string;
  isLoading?: boolean;
}

export function OpenInvoices({ invoices, currency = 'CHF', isLoading }: OpenInvoicesProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'code' // Show "CHF" instead of symbol
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const getDaysUntilDue = (dueDateString: string) => {
    if (!dueDateString) return null;
    const dueDate = new Date(dueDateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPaymentStateColor = (invoice: OpenInvoice) => {
    if (invoice.is_overdue) {
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
    }
    if (invoice.payment_state === 'partial') {
      return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
    }
    return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
  };

  const getPaymentStateLabel = (invoice: OpenInvoice) => {
    if (invoice.is_overdue) {
      const daysOverdue = Math.abs(getDaysUntilDue(invoice.invoice_date_due) || 0);
      return `Scaduta (${daysOverdue}gg)`;
    }
    if (invoice.payment_state === 'partial') {
      return 'Parzialmente pagata';
    }
    return 'Da pagare';
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="h-5 sm:h-6 w-32 sm:w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 sm:h-9 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 sm:p-3 md:p-4 animate-pulse">
              <div className="h-4 sm:h-5 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2 sm:mb-3" />
              <div className="h-3 sm:h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-1.5 sm:mb-2" />
              <div className="h-3 sm:h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            <span className="hidden sm:inline">Fatture Aperte</span>
            <span className="sm:hidden">Fatture</span>
          </h2>
        </div>
        <div className="text-center py-8 sm:py-12">
          <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-medium">Ottimo!</p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">Nessuna fattura da pagare</p>
        </div>
      </div>
    );
  }

  const overdueInvoices = invoices.filter(inv => inv.is_overdue);
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amount_residual, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
          <span className="hidden sm:inline">Fatture Aperte</span>
          <span className="sm:hidden">Fatture</span>
        </h2>
        <Link
          href="/portale-clienti/fatture"
          className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
        >
          <span className="hidden sm:inline">Vedi tutte</span>
          <span className="sm:hidden">Tutte</span>
        </Link>
      </div>

      {/* Alert for overdue invoices */}
      {overdueInvoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-3 sm:mb-4 p-2 sm:p-3 md:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div className="flex items-start gap-2 sm:gap-3">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm md:text-base font-semibold text-red-900 dark:text-red-300 mb-1">
                <span className="hidden sm:inline">Attenzione: Fatture scadute</span>
                <span className="sm:hidden">Fatture scadute</span>
              </h3>
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">
                <span className="font-bold">{overdueInvoices.length}</span> fattura/e per{' '}
                <span className="font-bold">{formatCurrency(totalOverdue)}</span>
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Invoices List */}
      <div className="space-y-2 sm:space-y-3">
        {invoices.map((invoice, index) => {
          const paymentStateColor = getPaymentStateColor(invoice);
          const paymentStateLabel = getPaymentStateLabel(invoice);
          const daysUntilDue = getDaysUntilDue(invoice.invoice_date_due);

          return (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
              className={`
                border rounded-lg p-2 sm:p-3 md:p-4
                ${invoice.is_overdue
                  ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                }
                hover:shadow-md transition-all cursor-pointer
              `}
            >
              {/* Invoice header */}
              <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
                    <span className="truncate">{invoice.name}</span>
                    {invoice.is_overdue && (
                      <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                    <span className="truncate">
                      <span className="hidden sm:inline">Emessa: </span>
                      {formatDate(invoice.invoice_date)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-through">
                    {formatCurrency(invoice.amount_total)}
                  </p>
                  <p className="font-bold text-base sm:text-lg text-gray-900 dark:text-white flex items-center gap-0.5 sm:gap-1 justify-end">
                    <Euro className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>{formatCurrency(invoice.amount_residual)}</span>
                  </p>
                </div>
              </div>

              {/* Due date and status */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                  <span className={`truncate ${invoice.is_overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                    <span className="hidden sm:inline">Scadenza: </span>
                    {formatDate(invoice.invoice_date_due)}
                  </span>
                  {daysUntilDue !== null && !invoice.is_overdue && (
                    <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">
                      ({daysUntilDue > 0 ? `${daysUntilDue}gg` : 'Oggi'})
                    </span>
                  )}
                </div>

                <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 rounded-full text-xs font-medium ${paymentStateColor} w-fit`}>
                  {invoice.is_overdue ? (
                    <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current flex-shrink-0" />
                  )}
                  <span className="truncate">{paymentStateLabel}</span>
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <span className="hidden sm:inline">Totale da pagare:</span>
            <span className="sm:hidden">Totale:</span>
          </span>
          <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(invoices.reduce((sum, inv) => sum + inv.amount_residual, 0))}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
