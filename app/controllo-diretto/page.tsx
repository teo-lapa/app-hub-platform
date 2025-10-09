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

interface MoveLine {
  id: number;
  locationName: string;
  quantity: number;
  qty_done: number;
  uom: string;
}

interface ProductLine {
  pickingId: number;
  pickingName: string;
  customerName: string;
  quantityRequested: number;
  quantityPicked: number;
  moveLines: MoveLine[];
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
  const [checkedProducts, setCheckedProducts] = useState<Set<number>>(new Set());
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

  function toggleProductCheck(productId: number) {
    const newChecked = new Set(checkedProducts);
    if (newChecked.has(productId)) {
      newChecked.delete(productId);
      toast.success('Prodotto non controllato');
    } else {
      newChecked.add(productId);
      toast.success('✓ Prodotto controllato');
    }
    setCheckedProducts(newChecked);
  }

  function startEditLine(moveLineId: number) {
    setEditingLine(moveLineId);
    // Trova la qty_done della moveLine specifica
    for (const product of productGroups) {
      for (const clientLine of product.lines) {
        const moveLine = clientLine.moveLines.find(ml => ml.id === moveLineId);
        if (moveLine) {
          setEditValue(moveLine.qty_done.toString());
          return;
        }
      }
    }
  }

  async function saveEditLine(moveLineId: number) {
    const newQty = parseFloat(editValue);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Quantità non valida');
      return;
    }

    setIsLoading(true);
    try {
      await pickingClient.updateOperationQuantity(moveLineId, newQty);

      // Aggiorna i dati localmente
      setProductGroups(prev => prev.map(product => {
        const updatedLines = product.lines.map(clientLine => {
          const updatedMoveLines = clientLine.moveLines.map(ml =>
            ml.id === moveLineId ? { ...ml, qty_done: newQty } : ml
          );
          const totalPicked = updatedMoveLines.reduce((sum, ml) => sum + ml.qty_done, 0);
          return {
            ...clientLine,
            moveLines: updatedMoveLines,
            quantityPicked: totalPicked
          };
        });

        const totalQtyPicked = updatedLines.reduce((sum, cl) => sum + cl.quantityPicked, 0);

        return {
          ...product,
          lines: updatedLines,
          totalQtyPicked
        };
      }));

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
                    const isChecked = checkedProducts.has(product.productId);

                    return (
                      <div key={product.productId} className={`rounded-xl shadow-sm overflow-hidden transition-all ${
                        isChecked ? 'bg-green-50 border-2 border-green-500' : 'bg-white'
                      }`}>
                        {/* Header Prodotto */}
                        <div className="p-4">
                          {/* Riga principale con immagine e info */}
                          <div className="flex items-center gap-4 mb-3">
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

                            <div className="flex-1">
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

                          {/* Riga pulsanti */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleProductCheck(product.productId)}
                              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                                isChecked
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {isChecked ? '✓ Controllato' : 'Controlla'}
                            </button>
                            <button
                              onClick={() => toggleProductExpand(product.productId)}
                              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                            >
                              {isExpanded ? (
                                <>Chiudi <ChevronUp className="w-4 h-4" /></>
                              ) : (
                                <>Dettagli <ChevronDown className="w-4 h-4" /></>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Dettagli Espansi */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-gray-200"
                            >
                              <div className="p-4 bg-gray-50 space-y-3">
                                {product.lines.map((clientLine, clientIdx) => (
                                  <div key={clientIdx} className="bg-white rounded-lg p-3">
                                    {/* Header Cliente */}
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b">
                                      <div>
                                        <div className="font-semibold text-gray-900">{clientLine.customerName}</div>
                                        <div className="text-xs text-gray-500">{clientLine.pickingName}</div>
                                      </div>
                                      <div className="text-sm">
                                        <span className="text-gray-600">Richiesto: </span>
                                        <strong>{clientLine.quantityRequested}</strong>
                                        <span className="mx-2">•</span>
                                        <span className="text-gray-600">Prelevato: </span>
                                        <strong className={clientLine.quantityPicked >= clientLine.quantityRequested ? 'text-green-600' : 'text-blue-600'}>
                                          {clientLine.quantityPicked}
                                        </strong>
                                      </div>
                                    </div>

                                    {/* Move Lines (Ubicazioni) */}
                                    <div className="space-y-1">
                                      {clientLine.moveLines.map((moveLine) => (
                                        <div key={moveLine.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                                          <div className="flex-1 text-sm text-gray-600">
                                            📍 {moveLine.locationName}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {editingLine === moveLine.id ? (
                                              <>
                                                <input
                                                  type="number"
                                                  value={editValue}
                                                  onChange={(e) => setEditValue(e.target.value)}
                                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                                  autoFocus
                                                />
                                                <button
                                                  onClick={() => saveEditLine(moveLine.id)}
                                                  className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  onClick={() => setEditingLine(null)}
                                                  className="px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-xs"
                                                >
                                                  ✕
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <span className="text-sm text-gray-900">
                                                  {moveLine.qty_done} {moveLine.uom}
                                                </span>
                                                <button
                                                  onClick={() => startEditLine(moveLine.id)}
                                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                >
                                                  <Edit2 className="w-3 h-3 text-gray-500" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      ))}
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
