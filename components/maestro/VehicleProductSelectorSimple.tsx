'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Package, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface VehicleProduct {
  product_id: number;
  name: string;
  default_code: string;
  image_url?: string | null;
  uom: string;
  quantity: number;
}

interface SelectedProduct {
  id: number;
  name: string;
  code: string;
  image?: string;
  uom: string;
  quantity: number;
}

interface Props {
  salesPersonId?: number;
  onConfirm: (products: SelectedProduct[]) => void;
  onClose: () => void;
}

export function VehicleProductSelector({ salesPersonId, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<VehicleProduct[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [locationName, setLocationName] = useState('');

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      const url = salesPersonId
        ? `/api/maestro/vehicle-stock?salesperson_id=${salesPersonId}`
        : '/api/maestro/vehicle-stock';

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setProducts(data.data.products || []);
        setLocationName(data.data.location?.name || 'Furgone');
      } else {
        toast.error(data.error?.message || 'Errore caricamento');
      }
    } catch (e) {
      toast.error('Errore caricamento stock');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const confirm = () => {
    const result: SelectedProduct[] = [];
    selected.forEach(id => {
      const p = products.find(x => x.product_id === id);
      if (p) result.push({
        id: p.product_id,
        name: p.name,
        code: p.default_code,
        image: p.image_url || undefined,
        uom: p.uom,
        quantity: 1 // Always 1 for gift samples
      });
    });

    if (result.length === 0) {
      toast.error('Seleziona almeno un prodotto');
      return;
    }

    onConfirm(result);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-xl font-bold text-white">Campioni Omaggio dalla Macchina</h3>
                <p className="text-sm text-slate-400">{locationName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-400">Caricamento...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="w-16 h-16 text-slate-600 mb-4" />
                <h4 className="text-lg font-semibold text-white mb-2">Nessun prodotto</h4>
                <p className="text-slate-400">Il furgone è vuoto</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => {
                  const isSelected = selected.has(p.product_id);
                  return (
                    <div
                      key={p.product_id}
                      onClick={() => toggle(p.product_id)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-8 h-8 text-slate-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white text-sm line-clamp-2">{p.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">{p.default_code}</p>
                          <div className="mt-2">
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                              {p.quantity} {p.uom} disponibili
                            </span>
                          </div>
                        </div>

                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                        }`}>
                          {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700">
            {selected.size > 0 && (
              <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <span className="text-sm text-slate-300">
                  <strong className="text-blue-400">{selected.size}</strong> campioni selezionati (1 pz cad.)
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium">
                Annulla
              </button>
              <button
                onClick={confirm}
                disabled={selected.size === 0}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Conferma ({selected.size})
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
