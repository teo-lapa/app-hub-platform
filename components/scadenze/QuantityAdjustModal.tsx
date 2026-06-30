'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Package } from 'lucide-react';
import { ExpiryProduct } from '@/lib/types/expiry';
import toast from 'react-hot-toast';

interface QuantityAdjustModalProps {
  isOpen: boolean;
  product: ExpiryProduct;
  onClose: () => void;
  onSaved: (newQty: number) => void;
}

/**
 * Aggiorna la quantita' del prodotto usando lo stesso meccanismo
 * dell'app Inventario (stock.quant.inventory_quantity).
 */
export function QuantityAdjustModal({ isOpen, product, onClose, onSaved }: QuantityAdjustModalProps) {
  const [qty, setQty] = useState<number>(product.quantity);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const step = (delta: number) => setQty(prev => Math.max(0, Math.round((prev + delta) * 100) / 100));

  const handleSave = async () => {
    if (qty < 0 || Number.isNaN(qty)) {
      toast.error('Quantità non valida');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/update-quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: product.id,
          locationId: product.locationId,
          lotId: product.lotId,
          lotName: product.lotName,
          expiryDate: product.expirationDate,
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Quantità aggiornata: ${qty} ${product.uom}`);
        onSaved(qty);
      } else {
        toast.error(data.error || 'Errore aggiornamento quantità');
      }
    } catch (e: any) {
      toast.error('Errore: ' + e.message);
    } finally {
      setSaving(false);
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
        className="glass-strong rounded-2xl p-6 max-w-md w-full"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Package className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Aggiorna Quantità</h2>
          <p className="text-slate-400 text-sm truncate">{product.name}</p>
          <p className="text-xs text-slate-500 mt-1">📍 {product.locationName}{product.lotName ? ` · 📦 ${product.lotName}` : ''}</p>
        </div>

        <div className="glass p-4 rounded-lg mb-6">
          <p className="text-xs text-slate-400 text-center mb-3">
            Conteggio attuale a sistema: <span className="font-semibold text-slate-200">{product.quantity} {product.uom}</span>
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => step(-1)}
              className="w-14 h-14 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20 active:scale-95"
            >
              <Minus className="w-6 h-6" />
            </button>
            <input
              type="number"
              step="0.01"
              min="0"
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value))}
              className="w-28 text-center text-3xl font-extrabold glass rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={() => step(1)}
              className="w-14 h-14 rounded-full glass-strong flex items-center justify-center hover:bg-green-500/20 active:scale-95"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
          <p className="text-center text-sm text-slate-400 mt-2">{product.uom}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 glass-strong p-3 min-h-[48px] rounded-lg hover:bg-white/5"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-slate-700 p-3 min-h-[48px] rounded-lg font-semibold"
          >
            {saving ? 'Salvataggio...' : 'Conferma'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
