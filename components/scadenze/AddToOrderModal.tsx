'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ShoppingCart, User, MapPin, Check } from 'lucide-react';
import { ExpiryProduct } from '@/lib/types/expiry';
import toast from 'react-hot-toast';

interface Customer {
  id: number;
  name: string;
  city?: string;
  phone?: string;
  street?: string;
}

interface AddToOrderModalProps {
  isOpen: boolean;
  product: ExpiryProduct;
  onClose: () => void;
  onDone: (orderName: string) => void;
}

/**
 * Inserisce il prodotto in scadenza in un ordine cliente (sale.order bozza).
 * Scrive UBICAZIONE + LOTTO + SCADENZA nelle note interne dell'ordine,
 * cosi' in magazzino prelevano ESATTAMENTE quel pezzo (tracciamento).
 */
export function AddToOrderModal({ isOpen, product, onClose, onDone }: AddToOrderModalProps) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [qty, setQty] = useState<number>(product.quantity);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (query.trim().length < 2) {
      setCustomers([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/scadenze/search-customers?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        const d = await r.json();
        if (d.success) setCustomers(d.customers || []);
      } catch {
        // silenzioso
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selected) {
      toast.error('Seleziona un cliente');
      return;
    }
    if (!qty || qty <= 0) {
      toast.error('Quantità non valida');
      return;
    }
    setSubmitting(true);
    try {
      const scad = product.expirationDate ? new Date(product.expirationDate).toLocaleDateString('it-IT') : 'n/d';
      const tracciamento =
        `⏰ PRODOTTO IN SCADENZA — PRELEVARE QUESTO PEZZO PRECISO:\n` +
        `• Ubicazione: ${product.locationName}${product.locationCompleteName ? ` (${product.locationCompleteName})` : ''}\n` +
        `• Lotto: ${product.lotName || 'n/d'}\n` +
        `• Scadenza: ${scad}\n` +
        `• Quantità: ${qty} ${product.uom}`;

      const res = await fetch('/api/catalogo-venditori/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: selected.id,
          deliveryAddressId: null,
          orderLines: [{
            product_id: product.id,
            quantity: qty,
            product_name: product.name,
            source: 'urgent',
          }],
          warehouseNotes: tracciamento,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Ordine ${data.orderName} creato per ${selected.name}`);
        onDone(data.orderName);
      } else {
        toast.error(data.error || 'Errore creazione ordine');
      }
    } catch (e: any) {
      toast.error('Errore: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-strong rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto overscroll-contain"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Inserisci in Ordine</h2>
          <p className="text-slate-400 text-sm truncate">{product.name}</p>
        </div>

        {/* Tracciamento pezzo */}
        <div className="glass p-3 rounded-lg mb-4 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-blue-400" /> {product.locationName}</div>
          {product.lotName && <div>📦 Lotto {product.lotName}</div>}
          {product.expirationDate && <div>📅 Scade {new Date(product.expirationDate).toLocaleDateString('it-IT')}</div>}
        </div>

        {/* Quantità */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Quantità da inserire ({product.uom})</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={qty}
            onChange={(e) => setQty(parseFloat(e.target.value))}
            className="w-full glass p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">Disponibile: {product.quantity} {product.uom}</p>
        </div>

        {/* Cliente selezionato o ricerca */}
        {selected ? (
          <div className="glass p-4 rounded-lg mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold">{selected.name}</div>
                {selected.city && <div className="text-xs text-slate-400">{selected.city}</div>}
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-blue-400 underline">Cambia</button>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Cliente *</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca cliente (nome, città, telefono)..."
                className="w-full pl-10 pr-3 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {searching && <p className="text-sm text-slate-400 px-2 py-1">Ricerca...</p>}
              {!searching && query.length >= 2 && customers.length === 0 && (
                <p className="text-sm text-slate-400 px-2 py-1">Nessun cliente trovato</p>
              )}
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="w-full text-left glass p-3 rounded-lg hover:bg-blue-500/15 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-slate-400">{[c.city, c.phone].filter(Boolean).join(' · ')}</div>
                  </div>
                  <Check className="w-4 h-4 text-blue-400 opacity-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 glass-strong p-3 min-h-[48px] rounded-lg hover:bg-white/5">
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selected}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 p-3 min-h-[48px] rounded-lg font-semibold"
          >
            {submitting ? 'Creazione...' : 'Crea Ordine'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
