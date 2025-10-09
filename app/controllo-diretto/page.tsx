'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, CheckCircle2, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { ZONES, Zone, Batch } from '@/lib/types/picking';
import { getPickingClient } from '@/lib/odoo/pickingClient';
import toast from 'react-hot-toast';

interface ProductGroup {
  productId: number;
  productName: string;
  totalQtyRequested: number;
  totalQtyPicked: number;
  clientCount: number;
  image: string | null;
  lines: ProductLine[];
}

interface ProductLine {
  id: number;
  locationName: string;
  pickingId: number;
  pickingName: string;
  customerName: string;
  quantity: number;
  qty_done: number;
  uom: string;
}

export default function ControlloDirettoPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Stati principali
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);

  // Liste dati
  const [batches, setBatches] = useState<Batch[]>([]);
  const [zoneCounts, setZoneCounts] = useState<{ [key: string]: number }>({
    'secco': 0,
    'secco_sopra': 0,
    'pingu': 0,
    'frigo': 0
  });

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [showBatchSelector, setShowBatchSelector] = useState(true);
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Client Odoo
  const pickingClient = getPickingClient();

  // Carica batch all'avvio
  useEffect(() => {
    loadBatches();
  }, []);

  async function loadBatches() {
    setIsLoading(true);
    try {
      const batchesData = await pickingClient.getBatches();
      setBatches(batchesData);
      console.log('✅ Batch caricati:', batchesData.length);
    } catch (error: any) {
      console.error('❌ Errore caricamento batch:', error);
      toast.error('Errore caricamento batch');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectBatch(batch: Batch) {
    setCurrentBatch(batch);
    setShowBatchSelector(false);
    setIsLoading(true);

    try {
      const counts = await pickingClient.getBatchZoneCounts(batch.id);
      setZoneCounts(counts);
      setShowZoneSelector(true);
      console.log('✅ Conteggi zone:', counts);
    } catch (error: any) {
      console.error('❌ Errore caricamento conteggi zone:', error);
      toast.error('Errore caricamento zone');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectZone(zone: Zone) {
    if (!currentBatch) return;

    setCurrentZone(zone);
    setShowZoneSelector(false);
    setIsLoading(true);

    try {
      const products = await pickingClient.getProductGroupedOperations(currentBatch.id, zone.id);
      setProductGroups(products);
      setShowProductList(true);
      console.log('✅ Prodotti raggruppati:', products);
    } catch (error: any) {
      console.error('❌ Errore caricamento prodotti:', error);
      toast.error('Errore caricamento prodotti');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleProductExpand(productId: number) {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  }

  function startEditLine(line: ProductLine) {
    setEditingLine(line.id);
    setEditValue(line.qty_done.toString());
  }

  async function saveEditLine(lineId: number) {
    const newQty = parseFloat(editValue);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Quantità non valida');
      return;
    }

    setIsLoading(true);
    try {
      await pickingClient.updateOperationQuantity(lineId, newQty);

      // Aggiorna i dati localmente
      setProductGroups(prev => prev.map(product => ({
        ...product,
        lines: product.lines.map(line =>
          line.id === lineId ? { ...line, qty_done: newQty } : line
        ),
        totalQtyPicked: product.lines.reduce((sum, line) =>
          sum + (line.id === lineId ? newQty : line.qty_done), 0
        )
      })));

      setEditingLine(null);
      toast.success('Quantità aggiornata');
    } catch (error: any) {
      console.error('❌ Errore aggiornamento quantità:', error);
      toast.error('Errore aggiornamento');
    } finally {
      setIsLoading(false);
    }
  }

  function resetSelection() {
    setCurrentBatch(null);
    setCurrentZone(null);
    setProductGroups([]);
    setShowBatchSelector(true);
    setShowZoneSelector(false);
    setShowProductList(false);
    setExpandedProducts(new Set());
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="✅ Controllo Diretto"
        showBackButton={!showBatchSelector}
        onBack={() => {
          if (showProductList) {
            setShowProductList(false);
            setShowZoneSelector(true);
            setCurrentZone(null);
          } else if (showZoneSelector) {
            setShowZoneSelector(false);
            setShowBatchSelector(true);
            setCurrentBatch(null);
          }
        }}
      />

      <div className="max-w-6xl mx-auto p-4">
        {/* Info Bar */}
        {(currentBatch || currentZone) && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentBatch && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Batch</span>
                  <span className="font-semibold text-gray-900">{currentBatch.name}</span>
                </div>
              )}
              {currentZone && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Zona</span>
                  <span className="font-semibold" style={{ color: currentZone.color }}>
                    {currentZone.icon} {currentZone.name}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={resetSelection}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        )}

        {/* Selezione Batch */}
        <AnimatePresence>
          {showBatchSelector && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Seleziona Batch</h2>
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
                  <p className="mt-4 text-gray-600">Caricamento...</p>
                </div>
              ) : batches.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nessun batch disponibile</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {batches.map(batch => (
                    <motion.button
                      key={batch.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => selectBatch(batch)}
                      className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-500"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{batch.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {batch.x_studio_autista_del_giro && (
                              <span>👤 {batch.x_studio_autista_del_giro[1]}</span>
                            )}
                            {batch.x_studio_auto_del_giro && (
                              <span>🚚 {batch.x_studio_auto_del_giro[1]}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {batch.picking_count !== undefined && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                              {batch.picking_count} picking
                            </span>
                          )}
                          {batch.product_count !== undefined && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                              {batch.product_count} prodotti
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selezione Zona */}
        <AnimatePresence>
          {showZoneSelector && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Seleziona Zona</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ZONES.map(zone => {
                  const count = zoneCounts[zone.id] || 0;
                  return (
                    <motion.button
                      key={zone.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => count > 0 && selectZone(zone)}
                      disabled={count === 0}
                      className="relative bg-white rounded-xl shadow-sm p-6 text-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all border-2 border-transparent hover:border-current"
                      style={{ color: zone.color }}
                    >
                      <div className="text-4xl mb-2">{zone.icon}</div>
                      <div className="font-bold text-gray-900">{zone.name}</div>
                      <div className="text-sm mt-1" style={{ color: zone.color }}>
                        {count} operazioni
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista Prodotti Raggruppati */}
        <AnimatePresence>
          {showProductList && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Prodotti da Controllare</h2>
                <div className="text-sm text-gray-600">
                  {productGroups.length} prodotti • {productGroups.reduce((sum, p) => sum + p.clientCount, 0)} righe
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
                </div>
              ) : productGroups.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nessun prodotto trovato</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productGroups.map(product => {
                    const isExpanded = expandedProducts.has(product.productId);
                    const isComplete = product.totalQtyPicked >= product.totalQtyRequested;

                    return (
                      <div key={product.productId} className="bg-white rounded-xl shadow-sm overflow-hidden">
                        {/* Header Prodotto */}
                        <button
                          onClick={() => toggleProductExpand(product.productId)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            {/* Immagine prodotto */}
                            {product.image ? (
                              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={product.image}
                                  alt={product.productName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center ${
                                isComplete ? 'bg-green-100' : 'bg-blue-100'
                              }`}>
                                {isComplete ? (
                                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                                ) : (
                                  <Package className="w-8 h-8 text-blue-600" />
                                )}
                              </div>
                            )}

                            <div className="flex-1 text-left">
                              <h3 className="font-semibold text-gray-900">{product.productName}</h3>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                <span>Richiesto: <strong>{product.totalQtyRequested}</strong></span>
                                <span>Prelevato: <strong className={isComplete ? 'text-green-600' : 'text-blue-600'}>
                                  {product.totalQtyPicked}
                                </strong></span>
                                <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                                  {product.clientCount} {product.clientCount === 1 ? 'cliente' : 'clienti'}
                                </span>
                              </div>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {/* Dettagli Espansi */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-gray-200"
                            >
                              <div className="p-4 bg-gray-50 space-y-2">
                                {product.lines.map(line => (
                                  <div key={line.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{line.customerName}</div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {line.locationName} • {line.pickingName}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {editingLine === line.id ? (
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => saveEditLine(line.id)}
                                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                          >
                                            Salva
                                          </button>
                                          <button
                                            onClick={() => setEditingLine(null)}
                                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                                          >
                                            Annulla
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-sm text-gray-600">
                                            {line.qty_done} / {line.quantity} {line.uom}
                                          </span>
                                          <button
                                            onClick={() => startEditLine(line)}
                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                          >
                                            <Edit2 className="w-4 h-4 text-gray-600" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MobileHomeButton />
    </div>
  );
}
