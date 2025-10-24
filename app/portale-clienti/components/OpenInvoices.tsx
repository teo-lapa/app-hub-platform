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
  isLoading?: boolean;
}

export function OpenInvoices({ invoices, isLoading }: OpenInvoicesProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-purple-600" />
            Fatture Aperte
          </h2>
        </div>
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Ottimo!</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">Nessuna fattura da pagare</p>
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
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-purple-600" />
          Fatture Aperte
        </h2>
        <Link
          href="/portale-clienti/fatture"
          className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
        >
          Vedi tutte
        </Link>
      </div>

      {/* Alert for overdue invoices */}
      {overdueInvoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">
                Attenzione: Fatture scadute
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400">
                Hai <span className="font-bold">{overdueInvoices.length}</span> fattura/e scaduta/e per un totale di{' '}
                <span className="font-bold">{formatCurrency(totalOverdue)}</span>
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Invoices List */}
      <div className="space-y-3">
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
                border rounded-lg p-4
                ${invoice.is_overdue
                  ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                }
                hover:shadow-md transition-all cursor-pointer
              `}
            >
              {/* Invoice header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {invoice.name}
                    {invoice.is_overdue && (
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Emessa: {formatDate(invoice.invoice_date)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-through">
                    {formatCurrency(invoice.amount_total)}
                  </p>
                  <p className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-1 justify-end">
                    <Euro className="h-4 w-4" />
                    {formatCurrency(invoice.amount_residual)}
                  </p>
                </div>
              </div>

              {/* Due date and status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className={invoice.is_overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                    Scadenza: {formatDate(invoice.invoice_date_due)}
                  </span>
                  {daysUntilDue !== null && !invoice.is_overdue && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      ({daysUntilDue > 0 ? `${daysUntilDue}gg` : 'Oggi'})
                    </span>
                  )}
                </div>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${paymentStateColor}`}>
                  {invoice.is_overdue ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-current" />
                  )}
                  {paymentStateLabel}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Totale da pagare:</span>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(invoices.reduce((sum, inv) => sum + inv.amount_residual, 0))}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
