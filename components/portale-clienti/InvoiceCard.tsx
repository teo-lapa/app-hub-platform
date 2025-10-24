/**
 * INVOICE CARD COMPONENT
 *
 * Displays individual invoice with:
 * - Invoice number, date, due date
 * - Amount and payment status
 * - Overdue indicator (if applicable)
 * - Download PDF button
 * - Pay Online button (placeholder for future)
 */

'use client';

import React, { useState } from 'react';
import type { Invoice } from '@/types/invoice';

interface InvoiceCardProps {
  invoice: Invoice;
}

export function InvoiceCard({ invoice }: InvoiceCardProps) {
  const [downloading, setDownloading] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-CH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPaymentStatusBadge = () => {
    switch (invoice.paymentState) {
      case 'paid':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
            Pagata
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Parziale
          </span>
        );
      case 'in_payment':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            In pagamento
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
            Da pagare
          </span>
        );
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);

    try {
      const response = await fetch(
        `/api/portale-clienti/invoices/${invoice.id}/pdf`
      );

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      // Get filename from Content-Disposition header or use invoice name
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?(.+)"?/i);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `${invoice.name}.pdf`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Errore nel download del PDF. Riprova.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePayOnline = () => {
    // Placeholder for future online payment integration
    alert('Pagamento online in arrivo! Per ora contatta il nostro ufficio.');
  };

  return (
    <div
      className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow border-l-4 ${
        invoice.isOverdue
          ? 'border-red-500'
          : invoice.paymentState === 'paid'
          ? 'border-green-500'
          : 'border-blue-500'
      }`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {invoice.name}
            </h3>
            {invoice.origin && (
              <p className="text-sm text-gray-500 mt-1">
                Ordine: {invoice.origin}
              </p>
            )}
          </div>
          {getPaymentStatusBadge()}
        </div>

        {/* Overdue Alert */}
        {invoice.isOverdue && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <svg
              className="w-5 h-5 text-red-500 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">
                Fattura scaduta
              </p>
              <p className="text-xs text-red-600">
                Scaduta da {invoice.daysOverdue} giorni
              </p>
            </div>
          </div>
        )}

        {/* Invoice Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Data Fattura</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(invoice.invoiceDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Scadenza</p>
            <p
              className={`text-sm font-medium ${
                invoice.isOverdue ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Importo Totale</p>
            <p className="text-sm font-medium text-gray-900">
              {formatCurrency(invoice.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Da Pagare</p>
            <p
              className={`text-sm font-bold ${
                invoice.amountResidual > 0 ? 'text-blue-600' : 'text-green-600'
              }`}
            >
              {formatCurrency(invoice.amountResidual)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {downloading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Download...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Scarica PDF
              </>
            )}
          </button>

          {invoice.paymentState !== 'paid' && (
            <button
              onClick={handlePayOnline}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              Paga Online
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
