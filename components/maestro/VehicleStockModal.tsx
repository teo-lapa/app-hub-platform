'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Truck,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductCard } from './ProductCard';
import { ProductSearch } from '@/components/inventario/ProductSearch';
import { Calculator } from '@/components/inventario/Calculator';
import { cn } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image_url?: string;
  quantity: number;
  uom?: string;
}

interface SelectedProductForTransfer extends Product {
  transferQuantity: number;
}

interface VehicleStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName?: string;
  vendorId?: number;
}

export function VehicleStockModal({
  isOpen,
  onClose,
  vendorName = 'Venditore',
  vendorId
}: VehicleStockModalProps) {
  const [currentStock, setCurrentStock] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProductForTransfer[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReloadSectionOpen, setIsReloadSectionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Fetch current vehicle stock when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchVehicleStock();
    } else {
      // Reset state when modal closes
      setSelectedProducts([]);
      setIsReloadSectionOpen(false);
      setError(null);
    }
  }, [isOpen, vendorId]);

  const fetchVehicleStock = async () => {
    setIsLoadingStock(true);
    setError(null);

    try {
      // Cookie-based auth: pass vendor_id as query param for admin
      // CRITICAL FIX: Ensure vendorId is always a clean integer number
      // vendorId might come as [14, "Name"] from Odoo or as string "14"
      let numericVendorId: number | undefined;
      if (vendorId) {
        if (Array.isArray(vendorId)) {
          numericVendorId = Number(vendorId[0]); // Extract first element from Odoo array
        } else if (typeof vendorId === 'string') {
          numericVendorId = parseInt(vendorId, 10); // Parse string to int
        } else {
          numericVendorId = Number(vendorId); // Convert to number
        }
      }

      console.log('🚗 [VehicleStock] Fetching with vendorId:', { vendorId, numericVendorId });

      const url = numericVendorId
        ? `/api/maestro/vehicle-stock?salesperson_id=${numericVendorId}`
        : '/api/maestro/vehicle-stock';

      const response = await fetch(url, { credentials: 'include' });
      const data = await response.json();

      if (data.success) {
        // Check if admin without own vehicle
        if (data.data.isAdmin && !data.data.hasOwnVehicle) {
          setCurrentStock([]);
          setError('Sei un amministratore. Seleziona un venditore per visualizzare il suo veicolo.');
          toast('Seleziona un venditore per visualizzare il suo veicolo', {
            icon: 'ℹ️',
            duration: 5000
          });
        } else {
          setCurrentStock(data.data.products || []);
        }
      } else {
        setError(data.error?.message || 'Errore nel caricamento dello stock');
        toast.error(data.error?.message || 'Errore nel caricamento dello stock veicolo');
      }
    } catch (err) {
      console.error('Error fetching vehicle stock:', err);
      setError('Errore di connessione');
      toast.error('Errore nel caricamento dello stock veicolo');
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleProductSelect = (product: any) => {
    // Check if product is already selected
    const existingIndex = selectedProducts.findIndex((p) => p.id === product.id);

    if (existingIndex >= 0) {
      // Product already selected, just show a toast
      toast.error('Prodotto già selezionato');
      return;
    }

    // Add product with default transfer quantity of 1
    // Handle both BasicProduct (from ProductSearch) and SearchProduct formats
    setSelectedProducts([
      ...selectedProducts,
      {
        id: product.id,
        name: product.name,
        code: product.code || product.barcode || '',
        barcode: product.barcode,
        image_url: product.image || product.image_url, // ProductSearch uses 'image', not 'image_url'
        quantity: 0, // Current quantity in vehicle (new product)
        uom: product.uom || 'pz',
        transferQuantity: 1
      }
    ]);

    toast.success(`${product.name} aggiunto`);
    setShowProductSearch(false); // Close search modal after selection
  };

  const handleOpenCalculator = (productId: number) => {
    setEditingProductId(productId);
    setShowCalculator(true);
  };

  const handleCalculatorConfirm = (value: string) => {
    const quantity = parseFloat(value);
    if (editingProductId && !isNaN(quantity) && quantity > 0) {
      setSelectedProducts((prev) =>
        prev.map((p) =>
          p.id === editingProductId
            ? { ...p, transferQuantity: quantity }
            : p
        )
      );
    }
    setShowCalculator(false);
    setEditingProductId(null);
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleSubmitTransfer = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Seleziona almeno un prodotto');
      return;
    }

    setIsSubmitting(true);

    try {
      // Cookie-based auth: pass vendor_id as query param for admin
      // CRITICAL FIX: Ensure vendorId is always a clean integer number
      let numericVendorId: number | undefined;
      if (vendorId) {
        if (Array.isArray(vendorId)) {
          numericVendorId = Number(vendorId[0]);
        } else if (typeof vendorId === 'string') {
          numericVendorId = parseInt(vendorId, 10);
        } else {
          numericVendorId = Number(vendorId);
        }
      }

      console.log('🚚 [VehicleStock] Creating transfer with vendorId:', { vendorId, numericVendorId });

      const transferUrl = numericVendorId
        ? `/api/maestro/vehicle-stock/transfer?salesperson_id=${numericVendorId}`
        : '/api/maestro/vehicle-stock/transfer';

      const response = await fetch(transferUrl, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reload',  // Transfer from warehouse to vehicle
          products: selectedProducts.map((p) => ({
            product_id: p.id,
            quantity: p.transferQuantity,
            lot_id: undefined  // Optional: can add lot tracking later
          })),
          notes: `Ricarica veicolo - ${selectedProducts.length} prodotti`
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Trasferimento registrato con successo!', {
          icon: '🚚',
          duration: 4000
        });

        // Refresh stock and reset
        await fetchVehicleStock();
        setSelectedProducts([]);
        setIsReloadSectionOpen(false);
      } else {
        toast.error(data.error?.message || 'Errore nel trasferimento');
      }
    } catch (err) {
      console.error('Transfer error:', err);
      toast.error('Errore durante il trasferimento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItemsToTransfer = selectedProducts.reduce(
    (sum, p) => sum + p.transferQuantity,
    0
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal - Full Screen on Mobile */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-slate-900 border-0 sm:border sm:border-slate-700 sm:rounded-xl shadow-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700 bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-white">
                      Prodotti in Macchina
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                      {vendorName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              {/* Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Current Stock Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-green-500" />
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      Stock Corrente
                    </h3>
                    {currentStock.length > 0 && (
                      <span className="ml-auto px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400 font-medium">
                        {currentStock.length} prodotti
                      </span>
                    )}
                  </div>

                  {isLoadingStock ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    </div>
                  ) : error ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  ) : currentStock.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                      <Package className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                      <p className="text-slate-400">Nessun prodotto in macchina</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Usa la sezione sottostante per caricare prodotti
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentStock.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          showQuantity
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Reload Vehicle Section - Collapsible */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  {/* Section Header - Clickable */}
                  <button
                    onClick={() => setIsReloadSectionOpen(!isReloadSectionOpen)}
                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-5 w-5 text-blue-500" />
                      <h3 className="text-base sm:text-lg font-semibold text-white">
                        Ricarica Macchina
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedProducts.length > 0 && (
                        <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400 font-medium">
                          {selectedProducts.length} selezionati
                        </span>
                      )}
                      {isReloadSectionOpen ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Section Content - Collapsible */}
                  <AnimatePresence>
                    {isReloadSectionOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-visible"
                      >
                        <div className="p-4 space-y-4 border-t border-slate-700">
                          {/* Product Search Button */}
                          <button
                            onClick={() => setShowProductSearch(true)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="h-5 w-5" />
                            Cerca Prodotto da Aggiungere
                          </button>

                          {/* Selected Products List */}
                          {selectedProducts.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-slate-300">
                                  Prodotti da Caricare
                                </h4>
                                <span className="text-xs text-slate-500">
                                  Totale: {totalItemsToTransfer} pz
                                </span>
                              </div>

                              <div className="space-y-2">
                                {selectedProducts.map((product) => (
                                  <div
                                    key={product.id}
                                    className="bg-slate-800 border border-slate-700 rounded-lg p-3"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                          {product.name}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                          {product.code}
                                        </p>
                                      </div>

                                      {/* Quantity Controls */}
                                      <div className="flex items-center gap-2">
                                        {/* Clickable quantity - opens calculator */}
                                        <button
                                          onClick={() => handleOpenCalculator(product.id)}
                                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-mono text-lg font-bold text-white min-w-[60px] text-center"
                                        >
                                          {product.transferQuantity}
                                        </button>

                                        {/* Delete button with trash icon */}
                                        <button
                                          onClick={() => handleRemoveProduct(product.id)}
                                          className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-red-400 rounded-lg transition-colors"
                                          title="Rimuovi prodotto"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Submit Button */}
                          {selectedProducts.length > 0 && (
                            <button
                              onClick={handleSubmitTransfer}
                              disabled={isSubmitting}
                              className={cn(
                                'w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2',
                                'bg-blue-600 hover:bg-blue-700 text-white',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                              )}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  Elaborazione...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-5 w-5" />
                                  Convalida Trasferimento ({totalItemsToTransfer} pz)
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* Product Search Modal */}
      <ProductSearch
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelectProduct={handleProductSelect}
        currentLocationName={`Veicolo ${vendorName}`}
      />

      {/* Calculator Modal */}
      <Calculator
        isOpen={showCalculator}
        onClose={() => {
          setShowCalculator(false);
          setEditingProductId(null);
        }}
        onConfirm={handleCalculatorConfirm}
        title="Quantità"
        initialValue={
          editingProductId
            ? selectedProducts.find((p) => p.id === editingProductId)?.transferQuantity.toString() || '1'
            : '1'
        }
      />
    </AnimatePresence>
  );
}
