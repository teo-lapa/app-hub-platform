'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

interface InvoiceLine {
  id: number;
  description: string;
  productName: string | null;
  quantity: number;
  priceUnit: number;
  priceSubtotal: number;
  priceTotal: number;
  discount: number;
  taxes: number;
}

interface Customer {
  id: number;
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  vat: string;
  phone: string;
  email: string;
}

interface Invoice {
  id: number;
  name: string;
  invoiceDate: string;
  invoiceDateDue: string | null;
  amountTotal: number;
  amountUntaxed: number;
  amountTax: number;
  amountResidual: number;
  state: string;
  paymentState: string;
  paymentStateLabel: string;
  isOverdue: boolean;
  paymentTerm: string;
  currency: string;
  origin: string | null;
  notes: string | null;
  paymentReference: string | null;
  fiscalPosition: string | null;
  customer: Customer;
  lines: InvoiceLine[];
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const fetchInvoiceDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/portale-clienti/invoices/${invoiceId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel caricamento della fattura');
      }

      setInvoice(data.invoice);
    } catch (err: any) {
      console.error('Errore fetch fattura:', err);
      setError(err.message || 'Errore nel caricamento della fattura');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getPaymentStateColor = (invoice: Invoice) => {
    if (invoice.isOverdue) {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    switch (invoice.paymentState) {
      case 'paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'not_paid':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'partial':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'in_payment':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPaymentStateIcon = (invoice: Invoice) => {
    if (invoice.isOverdue) {
      return <ExclamationCircleIcon className="w-5 h-5" />;
    }

    switch (invoice.paymentState) {
      case 'paid':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'not_paid':
      case 'partial':
      case 'in_payment':
        return <ClockIcon className="w-5 h-5" />;
      default:
        return <DocumentTextIcon className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento fattura...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full text-center">
          <ExclamationCircleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 font-medium mb-4">{error || 'Fattura non trovata'}</p>
          <button
            onClick={() => router.push('/portale-clienti/fatture')}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Torna alle Fatture
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">

        {/* Back Button */}
        <button
          onClick={() => router.push('/portale-clienti/fatture')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 text-sm sm:text-base"
        >
          <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          Torna alle Fatture
        </button>

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <DocumentTextIcon className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                  {invoice.name}
                </h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                {invoice.origin && `Da ordine: ${invoice.origin}`}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getPaymentStateColor(invoice)}`}>
                {getPaymentStateIcon(invoice)}
                {invoice.paymentStateLabel}
              </span>

              <button
                onClick={() => alert('Funzionalità download PDF in arrivo')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Scarica PDF
              </button>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Date e Importi */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Date e Importi
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Data Emissione:</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(invoice.invoiceDate)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Data Scadenza:</span>
                <span className={`text-sm font-medium ${invoice.isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDate(invoice.invoiceDateDue)}
                  {invoice.isOverdue && <span className="ml-1">(Scaduta)</span>}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Termini Pagamento:</span>
                <span className="text-sm font-medium text-gray-900">{invoice.paymentTerm}</span>
              </div>

              {invoice.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Rif. Pagamento:</span>
                  <span className="text-sm font-mono font-medium text-gray-900">{invoice.paymentReference}</span>
                </div>
              )}

              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Imponibile:</span>
                  <span className="text-sm font-medium text-gray-900">{formatAmount(invoice.amountUntaxed)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">IVA:</span>
                  <span className="text-sm font-medium text-gray-900">{formatAmount(invoice.amountTax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-base font-semibold text-gray-900">Totale:</span>
                  <span className="text-base font-bold text-gray-900">{formatAmount(invoice.amountTotal)}</span>
                </div>

                {invoice.amountResidual > 0 && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                    <span className="text-sm text-red-600">Da Pagare:</span>
                    <span className="text-sm font-bold text-red-600">{formatAmount(invoice.amountResidual)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dati Cliente */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BuildingOfficeIcon className="w-5 h-5" />
              Dati Cliente
            </h2>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-gray-900">{invoice.customer.name}</span>
              </div>

              {invoice.customer.street && (
                <div className="text-gray-600">{invoice.customer.street}</div>
              )}

              {(invoice.customer.zip || invoice.customer.city) && (
                <div className="text-gray-600">
                  {invoice.customer.zip} {invoice.customer.city}
                </div>
              )}

              {invoice.customer.country && (
                <div className="text-gray-600">{invoice.customer.country}</div>
              )}

              {invoice.customer.vat && (
                <div className="pt-2 mt-2 border-t border-gray-200">
                  <span className="text-gray-600">P.IVA: </span>
                  <span className="font-medium text-gray-900">{invoice.customer.vat}</span>
                </div>
              )}

              {invoice.customer.phone && (
                <div>
                  <span className="text-gray-600">Tel: </span>
                  <span className="font-medium text-gray-900">{invoice.customer.phone}</span>
                </div>
              )}

              {invoice.customer.email && (
                <div>
                  <span className="text-gray-600">Email: </span>
                  <span className="font-medium text-gray-900">{invoice.customer.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Righe Fattura */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
            Dettaglio Righe ({invoice.lines.length})
          </h2>

          {/* Tabella Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Descrizione
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Quantità
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Prezzo Unit.
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Sconto %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Subtotale
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        {line.productName && (
                          <div className="font-medium">{line.productName}</div>
                        )}
                        <div className={line.productName ? 'text-gray-600 text-xs' : ''}>
                          {line.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                      {line.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatAmount(line.priceUnit)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                      {line.discount > 0 ? `${line.discount}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatAmount(line.priceSubtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile */}
          <div className="md:hidden space-y-3">
            {invoice.lines.map((line) => (
              <div key={line.id} className="border border-gray-200 rounded-lg p-3">
                <div className="mb-2">
                  {line.productName && (
                    <div className="font-medium text-gray-900 text-sm">{line.productName}</div>
                  )}
                  <div className="text-xs text-gray-600">{line.description}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Quantità:</span>
                    <span className="ml-1 font-medium text-gray-900">{line.quantity}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-600">Prezzo:</span>
                    <span className="ml-1 font-medium text-gray-900">{formatAmount(line.priceUnit)}</span>
                  </div>
                  {line.discount > 0 && (
                    <div>
                      <span className="text-gray-600">Sconto:</span>
                      <span className="ml-1 font-medium text-orange-600">{line.discount}%</span>
                    </div>
                  )}
                  <div className="text-right col-span-2 pt-2 border-t border-gray-100">
                    <span className="text-gray-600">Subtotale:</span>
                    <span className="ml-1 font-bold text-gray-900">{formatAmount(line.priceSubtotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note (se presenti) */}
        {invoice.notes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Note:</h3>
            <p className="text-sm text-blue-800 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

      </div>
    </div>
  );
}
