'use client';

import { useEffect, useState } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';

interface Invoice {
  id: number;
  name: string;
  invoiceDate?: string;
  invoiceDateDue?: string;
  amountTotal?: number;
  amountResidual?: number;
  state?: string;
  paymentState?: string;
  paymentStateLabel?: string;
  isOverdue?: boolean;
  currency?: string;
}

const money = (n?: number, cur = 'CHF') =>
  n == null ? '—' : `${cur} ` + n.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(s?: string) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('it-CH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function payColor(ps?: string) {
  if (ps === 'paid' || ps === 'in_payment' || ps === 'reversed') return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400';
  if (ps === 'partial') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
  return 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400';
}

export default function FattureView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/portale-clienti/invoices');
        const d = await r.json();
        if (alive) setInvoices(Array.isArray(d.invoices) ? d.invoices : []);
      } catch {
        if (alive) setErr('Impossibile caricare le fatture in questo momento.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totOpen = invoices.reduce((s, i) => s + (i.amountResidual || 0), 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-black/5 dark:border-white/5 px-4 py-4 md:px-8">
        <h1 className="text-2xl font-semibold">Le mie fatture</h1>
        {!loading && !err && invoices.length > 0 && totOpen > 0 && (
          <p className="mt-1 text-sm text-zinc-500">Totale da pagare: <span className="font-semibold text-[#dc2626]">{money(totOpen)}</span></p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/5" />
              ))}
            </div>
          ) : err ? (
            <p className="text-zinc-500">{err}</p>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <FileText className="mb-3 h-10 w-10" />
              <p>Nessuna fattura trovata.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#222236] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{inv.name}</span>
                        {inv.paymentStateLabel && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${payColor(inv.paymentState)}`}>{inv.paymentStateLabel}</span>
                        )}
                        {inv.isOverdue && (
                          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-500/15 dark:text-red-400">
                            <AlertTriangle className="h-3 w-3" /> Scaduta
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-zinc-500">
                        {fmtDate(inv.invoiceDate)}{inv.invoiceDateDue ? ` · scad. ${fmtDate(inv.invoiceDateDue)}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{money(inv.amountTotal, inv.currency || 'CHF')}</div>
                      {inv.amountResidual != null && inv.amountResidual > 0 && (
                        <div className="text-xs text-[#dc2626]">da pagare {money(inv.amountResidual, inv.currency || 'CHF')}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
