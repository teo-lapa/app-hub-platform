'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  ExternalLink,
  FileText,
  AlertTriangle,
  DollarSign,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  DraftInvoiceAnalysis,
  DraftInvoiceStats,
  DraftInvoiceResponse,
} from '@/lib/types/monthly-analysis';
import toast from 'react-hot-toast';

export default function FattureBozzaTab() {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<DraftInvoiceAnalysis[]>([]);
  const [stats, setStats] = useState<DraftInvoiceStats | null>(null);

  const odooBaseUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/controllo-prezzi/fatture-bozza', {
        credentials: 'include',
      });

      const data: DraftInvoiceResponse = await response.json();

      if (data.success) {
        setInvoices(data.invoices);
        setStats(data.stats);
        toast.success(`Caricate ${data.invoices.length} fatture in bozza`);
      } else {
        toast.error(data.error || 'Errore caricamento dati');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Export CSV
  const exportToCSV = () => {
    if (invoices.length === 0) {
      toast.error('Nessun dato da esportare');
      return;
    }

    const headers = [
      'Fattura',
      'Cliente',
      'Totale CHF',
      'Data',
      'Tipo',
      'Delta vs Precedente',
      'Anomalie',
    ];

    const rows = invoices.map(inv => [
      inv.invoiceName,
      inv.customerName,
      inv.totalAmount.toFixed(2),
      inv.invoiceDate,
      inv.growthType,
      inv.deltaVsPrevious.toFixed(2),
      inv.anomalyProducts.length,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fatture-bozza-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSV esportato!');
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <FileText className="w-7 h-7 text-purple-400" />
          Fatture in Bozza
          <span className="text-sm font-normal text-slate-400">
            (Non ancora convalidate)
          </span>
        </h3>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 glass rounded-lg hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 text-white transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-strong rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Fatture Totali</div>
            <div className="text-3xl font-bold text-white">{stats.totalInvoices}</div>
          </div>
          <div className="glass-strong rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Nuovi Clienti
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.newCustomers}</div>
          </div>
          <div className="glass-strong rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Prezzi Più Alti
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.higherPrices}</div>
          </div>
          <div className="glass-strong rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Prezzi Più Bassi
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.lowerPrices}</div>
          </div>
          <div className="glass-strong rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Anomalie Totali
            </div>
            <div className="text-3xl font-bold text-amber-400">{stats.totalAnomalies}</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-3" />
          <p className="text-slate-400">Caricamento fatture in bozza...</p>
        </div>
      )}

      {/* Invoice List */}
      {!loading && invoices.length === 0 && (
        <div className="text-center py-12 glass-strong rounded-xl">
          <FileText className="w-16 h-16 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-lg">Nessuna fattura in bozza trovata</p>
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="space-y-4">
          {invoices.map(invoice => {
            const invoiceLink = `${odooBaseUrl}/web#id=${invoice.invoiceId}&model=account.move&view_type=form`;
            const customerLink = `${odooBaseUrl}/web#id=${invoice.customerId}&model=res.partner&view_type=form`;

            return (
              <motion.div
                key={invoice.invoiceId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-strong rounded-xl overflow-hidden border border-purple-500/20"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-700/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <a
                          href={customerLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xl font-bold text-white hover:text-purple-400 transition-colors flex items-center gap-2"
                        >
                          <Users className="w-5 h-5" />
                          {invoice.customerName}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <span className="text-2xl">{invoice.growthEmoji}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <a
                          href={invoiceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-purple-400 transition-colors flex items-center gap-1"
                        >
                          {invoice.invoiceName}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <span>•</span>
                        <span>{invoice.invoiceDate}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">
                        CHF {invoice.totalAmount.toFixed(2)}
                      </div>
                      {invoice.previousInvoiceTotal !== null && (
                        <div className={`text-sm mt-1 ${
                          invoice.deltaVsPrevious > 0 ? 'text-green-400' :
                          invoice.deltaVsPrevious < 0 ? 'text-red-400' : 'text-slate-400'
                        }`}>
                          {invoice.deltaVsPrevious >= 0 ? '+' : ''}
                          {invoice.deltaVsPrevious.toFixed(2)} CHF
                          <span className="text-slate-500 ml-1">
                            (vs {invoice.previousInvoiceTotal.toFixed(2)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Anomaly Products */}
                {invoice.anomalyProducts.length > 0 && (
                  <div className="p-4">
                    <div className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Prodotti con Anomalie ({invoice.anomalyProducts.length})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-700/50">
                            <th className="p-2">Prodotto</th>
                            <th className="p-2 text-right">Prezzi Unitari</th>
                            <th className="p-2 text-center">Flags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice.anomalyProducts.map(product => (
                            <tr key={product.productId} className="border-b border-slate-800/30">
                              <td className="p-2 text-slate-300">{product.productName}</td>
                              <td className="p-2 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  {product.prices.map((price, idx) => (
                                    <div key={idx} className={`font-mono ${
                                      product.hasMultiplePrices && product.prices.length > 1
                                        ? 'text-red-400'
                                        : 'text-slate-300'
                                    }`}>
                                      CHF {price.priceUnit.toFixed(2)}
                                      {price.saleOrderName && (
                                        <span className="text-xs text-slate-500 ml-2">
                                          ({price.saleOrderName})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-2 text-lg">
                                  {product.hasZeroPrice && <span title="Prezzo zero">🤔</span>}
                                  {product.hasHighMargin && <span title="Margine ≥70%">😊</span>}
                                  {product.hasOfferTag && <span title="Offerta">🔥</span>}
                                  {product.hasMultiplePrices && <span title="Prezzi multipli diversi">⚠️</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="glass-strong rounded-xl p-4">
        <h4 className="font-semibold text-white mb-3">Legenda Emoji</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🆕</span>
            <span className="text-slate-300">Nuovo cliente</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📈</span>
            <span className="text-slate-300">Totale più alto del precedente</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📉</span>
            <span className="text-slate-300">Totale più basso del precedente</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <span className="text-slate-300">Prezzo in offerta</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🤔</span>
            <span className="text-slate-300">Prezzo pari a zero</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">😊</span>
            <span className="text-slate-300">Margine ≥ 70%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
