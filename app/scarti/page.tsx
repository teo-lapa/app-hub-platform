'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  ArrowLeft,
  Package,
  Euro,
  Calendar,
  FileText,
  Camera,
  TrendingDown,
  AlertCircle,
  Loader2,
  Download
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface WasteProduct {
  quantId: number;
  productId: number;
  productName: string;
  productCode: string;
  barcode: string;
  image: string | null;
  quantity: number;
  uom: string;
  lot: {
    id: number;
    name: string;
    expiration_date: string | null;
  } | null;
  standardPrice: number;
  totalValue: number;
  disposalInfo: {
    pickingId: number;
    pickingName: string;
    reason: string;
    notes: string;
    date: string;
    photos: Array<{
      id: number;
      name: string;
      data: string | null;
      created: string;
    }>;
  } | null;
  allDisposals: any[];
  createdDate: string;
}

interface DashboardData {
  products: WasteProduct[];
  statistics: {
    totalProducts: number;
    totalQuantity: number;
    totalValueLost: number;
    reasonBreakdown: Record<string, { count: number; value: number }>;
  };
}

export default function ScartiDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<WasteProduct | null>(null);
  const [generatingOrder, setGeneratingOrder] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/scarti/dashboard', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        setData(result);
        console.log('📊 Dashboard caricata:', result);
      } else {
        toast.error(result.error || 'Errore caricamento dashboard');
      }
    } catch (error: any) {
      console.error('Errore caricamento dashboard:', error);
      toast.error('Errore caricamento dashboard: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDischargeOrder = async () => {
    if (!data || data.products.length === 0) {
      toast.error('Nessun prodotto da scaricare');
      return;
    }

    setGeneratingOrder(true);

    try {
      const response = await fetch('/api/scarti/generate-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          products: data.products.map(p => ({
            productId: p.productId,
            quantity: p.quantity,
            lotId: p.lot?.id || null,
            price: p.standardPrice
          }))
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`✅ Ordine creato: ${result.orderName}`);
        // Reload dashboard to show updated data
        await loadDashboard();
      } else {
        toast.error(result.error || 'Errore creazione ordine');
      }
    } catch (error: any) {
      console.error('Errore generazione ordine:', error);
      toast.error('Errore generazione ordine: ' + error.message);
    } finally {
      setGeneratingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Caricamento dashboard scarti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/ubicazioni')}
            className="glass-strong px-4 py-2 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna Indietro
          </button>

          {data && data.products.length > 0 && (
            <button
              onClick={handleGenerateDischargeOrder}
              disabled={generatingOrder}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generazione...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Genera Ordine Scarico
                </>
              )}
            </button>
          )}
        </div>

        <div className="glass-strong rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Dashboard Scarti</h1>
              <p className="text-muted-foreground">Ubicazione: MERCE DETERIORATA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {data && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Products */}
            <div className="glass-strong rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-3xl font-bold text-blue-400">
                  {data.statistics.totalProducts}
                </span>
              </div>
              <h3 className="font-semibold mb-1">Prodotti Totali</h3>
              <p className="text-sm text-muted-foreground">
                {data.statistics.totalQuantity.toFixed(2)} unità totali
              </p>
            </div>

            {/* Total Value Lost */}
            <div className="glass-strong rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-3xl font-bold text-red-400">
                  {data.statistics.totalValueLost.toFixed(2)}€
                </span>
              </div>
              <h3 className="font-semibold mb-1">Valore Perso</h3>
              <p className="text-sm text-muted-foreground">
                Valorizzazione magazzino
              </p>
            </div>

            {/* Main Reason */}
            <div className="glass-strong rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                </div>
                <span className="text-lg font-bold text-orange-400">
                  {Object.keys(data.statistics.reasonBreakdown).length}
                </span>
              </div>
              <h3 className="font-semibold mb-1">Cause di Scarto</h3>
              <p className="text-sm text-muted-foreground">
                {Object.keys(data.statistics.reasonBreakdown)[0] || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reason Breakdown */}
      {data && Object.keys(data.statistics.reasonBreakdown).length > 0 && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="glass-strong rounded-xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Suddivisione per Motivo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(data.statistics.reasonBreakdown).map(([reason, stats]) => (
                <div key={reason} className="glass rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{reason}</span>
                    <span className="text-sm text-blue-400">{stats.count} prodotti</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Valore: <span className="text-red-400 font-semibold">{stats.value.toFixed(2)}€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products List */}
      {data && data.products.length > 0 ? (
        <div className="max-w-7xl mx-auto">
          <div className="glass-strong rounded-xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Prodotti in Scarto ({data.products.length})
            </h2>

            <div className="space-y-3">
              {data.products.map((product) => (
                <motion.div
                  key={product.quantId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all"
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="flex items-start gap-4">
                    {/* Product Image */}
                    <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.productName}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-gray-400" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-1">{product.productName}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                        <span>{product.productCode}</span>
                        {product.barcode && (
                          <>
                            <span>•</span>
                            <span>{product.barcode}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-400" />
                          <span className="text-sm">
                            <span className="font-semibold text-blue-400">{product.quantity}</span> {product.uom}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Euro className="w-4 h-4 text-green-400" />
                          <span className="text-sm">
                            <span className="font-semibold text-green-400">{product.totalValue.toFixed(2)}€</span>
                            <span className="text-muted-foreground ml-1">
                              ({product.standardPrice.toFixed(2)}€/{product.uom})
                            </span>
                          </span>
                        </div>

                        {product.lot && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                              Lotto: {product.lot.name}
                            </span>
                          </div>
                        )}

                        {product.disposalInfo && (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-400" />
                            <span className="text-sm text-orange-400">
                              {product.disposalInfo.reason}
                            </span>
                          </div>
                        )}

                        {product.disposalInfo?.photos && product.disposalInfo.photos.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Camera className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-blue-400">
                              {product.disposalInfo.photos.length} foto
                            </span>
                          </div>
                        )}
                      </div>

                      {product.disposalInfo?.date && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          Scartato: {new Date(product.disposalInfo.date).toLocaleString('it-IT')}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="glass-strong rounded-xl p-12 text-center">
            <Trash2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nessun Prodotto in Scarto</h3>
            <p className="text-muted-foreground">
              L'ubicazione MERCE DETERIORATA è vuota
            </p>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-strong rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    {selectedProduct.image ? (
                      <img
                        src={selectedProduct.image}
                        alt={selectedProduct.productName}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-1">{selectedProduct.productName}</h2>
                    <p className="text-sm text-muted-foreground">{selectedProduct.productCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Product Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Quantità</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {selectedProduct.quantity} {selectedProduct.uom}
                  </div>
                </div>
                <div className="glass rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Valore Totale</div>
                  <div className="text-2xl font-bold text-red-400">
                    {selectedProduct.totalValue.toFixed(2)}€
                  </div>
                </div>
              </div>

              {/* Disposal Info */}
              {selectedProduct.disposalInfo && (
                <div className="glass rounded-lg p-4 mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Dettagli Scarto
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Motivo:</span>
                      <span className="font-semibold text-orange-400">
                        {selectedProduct.disposalInfo.reason}
                      </span>
                    </div>
                    {selectedProduct.disposalInfo.notes && (
                      <div>
                        <span className="text-muted-foreground">Note:</span>
                        <p className="mt-1 text-white">{selectedProduct.disposalInfo.notes}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Data scarto:</span>
                      <span className="font-semibold">
                        {new Date(selectedProduct.disposalInfo.date).toLocaleString('it-IT')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Picking:</span>
                      <span className="font-semibold text-blue-400">
                        {selectedProduct.disposalInfo.pickingName}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Photos */}
              {selectedProduct.disposalInfo?.photos && selectedProduct.disposalInfo.photos.length > 0 && (
                <div className="glass rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-400" />
                    Foto ({selectedProduct.disposalInfo.photos.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedProduct.disposalInfo.photos.map((photo) => (
                      <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-800">
                        {photo.data ? (
                          <img
                            src={photo.data}
                            alt={photo.name}
                            className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => window.open(photo.data!, '_blank')}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
