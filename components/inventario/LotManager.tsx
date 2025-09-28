'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Calendar, AlertTriangle, X, Plus } from 'lucide-react';
import { getInventoryClient } from '@/lib/odoo/inventoryClient';

interface Lot {
  id: number;
  name: string;
  product_id: [number, string];
  expiration_date?: string;
  quantity?: number;
}

interface LotManagerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
  onSelectLot: (lot: Lot) => void;
  currentLocationId?: number;
}

export function LotManager({ isOpen, onClose, productId, productName, onSelectLot, currentLocationId }: LotManagerProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLotName, setNewLotName] = useState('');
  const [newLotExpiry, setNewLotExpiry] = useState('');
  const [creating, setCreating] = useState(false);

  const inventoryClient = getInventoryClient();

  useEffect(() => {
    if (isOpen && productId) {
      loadLots();
    }
  }, [isOpen, productId]);

  const loadLots = async () => {
    setLoading(true);
    try {
      const result = await inventoryClient.searchRead(
        'stock.lot',
        [['product_id', '=', productId]],
        ['id', 'name', 'expiration_date']
      );

      setLots(result);
    } catch (error) {
      console.error('Errore caricamento lotti:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLot = async () => {
    if (!newLotName.trim()) return;

    setCreating(true);
    try {
      const lotData: any = {
        product_id: productId,
        name: newLotName,
        company_id: 1
      };

      if (newLotExpiry) {
        lotData.expiration_date = newLotExpiry;
      }

      // Creiamo il lotto tramite API
      const response = await fetch('/api/inventory/lot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lotData)
      });

      if (!response.ok) {
        throw new Error('Errore creazione lotto');
      }

      const { id: newLotId } = await response.json();

      const newLot: Lot = {
        id: newLotId,
        name: newLotName,
        product_id: [productId, productName],
        expiration_date: newLotExpiry
      };

      setLots([...lots, newLot]);
      setShowCreateForm(false);
      setNewLotName('');
      setNewLotExpiry('');

      onSelectLot(newLot);
    } catch (error) {
      console.error('Errore creazione lotto:', error);
    } finally {
      setCreating(false);
    }
  };

  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (date: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          className="glass-strong w-full sm:max-w-2xl mx-4 rounded-t-xl sm:rounded-xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                Seleziona Lotto
              </h3>
              <p className="text-sm text-gray-400 mt-1">{productName}</p>
            </div>
            <button
              onClick={onClose}
              className="glass p-2 rounded-lg hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <>
                {/* Pulsante Nuovo Lotto */}
                {!showCreateForm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full glass-strong p-4 rounded-xl mb-4 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-green-400" />
                    <span>Crea Nuovo Lotto</span>
                  </button>
                )}

                {/* Form Creazione Lotto */}
                {showCreateForm && (
                  <div className="glass-strong p-4 rounded-xl mb-4">
                    <h4 className="font-semibold mb-3">Nuovo Lotto</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newLotName}
                        onChange={(e) => setNewLotName(e.target.value)}
                        placeholder="Nome/Codice Lotto"
                        className="w-full glass px-4 py-2 rounded-lg"
                        autoFocus
                      />
                      <input
                        type="date"
                        value={newLotExpiry}
                        onChange={(e) => setNewLotExpiry(e.target.value)}
                        className="w-full glass px-4 py-2 rounded-lg"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={createLot}
                          disabled={!newLotName.trim() || creating}
                          className="flex-1 btn-primary py-2 px-4 rounded-lg disabled:opacity-50"
                        >
                          {creating ? 'Creazione...' : 'Crea'}
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewLotName('');
                            setNewLotExpiry('');
                          }}
                          className="flex-1 glass px-4 py-2 rounded-lg hover:bg-white/10"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista Lotti */}
                <div className="space-y-2">
                  {lots.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">Nessun lotto disponibile</p>
                    </div>
                  ) : (
                    lots.map((lot) => (
                      <motion.div
                        key={lot.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => onSelectLot(lot)}
                        className="glass rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{lot.name}</h4>
                            {lot.expiration_date && (
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className={`text-sm ${
                                  isExpired(lot.expiration_date) ? 'text-red-500' :
                                  isExpiringSoon(lot.expiration_date) ? 'text-yellow-500' :
                                  'text-gray-400'
                                }`}>
                                  Scadenza: {new Date(lot.expiration_date).toLocaleDateString('it-IT')}
                                </span>
                                {isExpired(lot.expiration_date) && (
                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                          {lot.quantity !== undefined && (
                            <span className="text-lg font-bold">{lot.quantity} PZ</span>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}