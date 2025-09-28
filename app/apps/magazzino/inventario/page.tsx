'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Search, MapPin, Home, RefreshCw, Camera, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Location {
  id: number;
  name: string;
  barcode?: string;
  display_name?: string;
}

interface Product {
  id: number;
  name: string;
  code?: string;
  barcode?: string;
  image?: string;
  totalQty: number;
  uom: string;
  lots: Lot[];
  isCounted?: boolean;
  isCountedRecent?: boolean;
  lastCountDate?: string;
  lastCountUser?: string;
  inventoryQuantity?: number;
  inventoryDiff?: number;
}

interface Lot {
  id?: number | null;
  name: string;
  qty: number;
  expiry_date?: string;
  inventoryQuantity?: number;
  lastCountDate?: string;
  lastCountUser?: string;
  inventoryDiff?: number;
  isCountedRecent?: boolean;
}

interface Quant {
  id: number;
  product_id: [number, string];
  location_id: [number, string];
  lot_id?: [number, string];
  quantity: number;
  inventory_quantity?: number | null;
  inventory_date?: string;
  inventory_diff_quantity?: number;
  user_id?: [number, string];
}

export default function InventarioPage() {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [countedQty, setCountedQty] = useState('');
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error' | 'info'} | null>(null);

  // Verifica connessione Odoo
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/inventory/test-connection');
      const data = await response.json();
      setConnected(data.success);
    } catch (error) {
      setConnected(false);
    }
  };

  // Mostra notifica
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Cerca ubicazione
  const searchLocation = async (barcode: string) => {
    if (!barcode.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/inventory/search-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: barcode.trim() })
      });

      const data = await response.json();

      if (data.success && data.location) {
        setCurrentLocation(data.location);
        await loadProducts(data.location.id);
        showNotification(`Ubicazione: ${data.location.display_name}`, 'success');
      } else {
        showNotification('Ubicazione non trovata', 'error');
        setCurrentLocation(null);
        setProducts([]);
      }
    } catch (error) {
      console.error('Errore ricerca ubicazione:', error);
      showNotification('Errore nella ricerca', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Carica prodotti nell'ubicazione
  const loadProducts = async (locationId: number) => {
    try {
      const response = await fetch('/api/inventory/products-by-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId })
      });

      const data = await response.json();

      if (data.success && data.products) {
        // Ordina: non contati prima, poi contati recenti in fondo
        const sortedProducts = data.products.sort((a: Product, b: Product) => {
          if (!a.isCounted && b.isCounted) return -1;
          if (a.isCounted && !b.isCounted) return 1;

          if (a.isCounted && b.isCounted) {
            if (a.isCountedRecent && !b.isCountedRecent) return 1;
            if (!a.isCountedRecent && b.isCountedRecent) return -1;
          }

          return 0;
        });

        setProducts(sortedProducts);
      }
    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
      showNotification('Errore nel caricamento prodotti', 'error');
    }
  };

  // Aggiorna giacenza prodotto
  const updateInventory = async () => {
    if (!selectedProduct || !countedQty || !currentLocation) return;

    const qty = parseFloat(countedQty);
    if (isNaN(qty) || qty < 0) {
      showNotification('Inserisci una quantità valida', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/inventory/update-quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          locationId: currentLocation.id,
          quantity: qty,
          lotId: selectedLot?.id
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Giacenza aggiornata con successo', 'success');
        // Ricarica prodotti
        await loadProducts(currentLocation.id);
        // Reset selezione
        setSelectedProduct(null);
        setSelectedLot(null);
        setCountedQty('');
      } else {
        showNotification(data.error || 'Errore aggiornamento', 'error');
      }
    } catch (error) {
      console.error('Errore aggiornamento:', error);
      showNotification('Errore nell\'aggiornamento', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calcola differenza inventario
  const calculateDifference = () => {
    if (!selectedProduct || !countedQty) return null;

    const qty = parseFloat(countedQty);
    if (isNaN(qty)) return null;

    const systemQty = selectedLot ? selectedLot.qty : selectedProduct.totalQty;
    return qty - systemQty;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-gray-900 border-b border-gray-700 flex items-center px-6 z-50">
        <Link
          href="/"
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Home className="w-6 h-6 text-gray-400 hover:text-white" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold text-white flex items-center gap-3 ml-4">
          <Package className="w-6 h-6 text-emerald-500" />
          Gestione Inventario
        </h1>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          connected ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {connected ? 'Connesso' : 'Disconnesso'}
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
        {/* Scanner Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder="Scansiona o digita ubicazione..."
              className="flex-1 px-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchLocation(searchQuery)}
            />
            <button
              onClick={() => searchLocation(searchQuery)}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Cerca
            </button>
          </div>
        </div>

        {/* Location Info */}
        {currentLocation && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
            <div className="text-2xl font-semibold text-emerald-500 mb-2 flex items-center gap-3">
              <MapPin className="w-6 h-6" />
              {currentLocation.display_name || currentLocation.name}
            </div>
            <div className="text-gray-400">
              {products.length} prodotti trovati
            </div>
          </div>
        )}

        {/* Products Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={`bg-gray-800 border ${
                  product.isCountedRecent ? 'border-emerald-500/30' : 'border-gray-700'
                } rounded-xl p-6 cursor-pointer hover:border-emerald-500 transition-all ${
                  selectedProduct?.id === product.id ? 'ring-2 ring-emerald-500' : ''
                }`}
              >
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-32 object-contain mb-4" />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center text-4xl mb-4">📦</div>
                )}
                <h3 className="text-lg font-medium text-white mb-2">{product.name}</h3>
                {product.code && <p className="text-sm text-gray-400 mb-2">{product.code}</p>}
                <p className="text-xl font-semibold text-emerald-500">{product.totalQty} {product.uom}</p>

                {product.lots.length > 0 && (
                  <div className="mt-3 text-sm text-gray-400">
                    {product.lots.map(lot => `${lot.name}: ${lot.qty}`).join(', ')}
                  </div>
                )}

                <div className="mt-3 text-xs">
                  {product.isCountedRecent ? (
                    <span className="text-emerald-500">✓ Contato recentemente</span>
                  ) : product.isCounted ? (
                    <span className="text-yellow-500">⚠ Conteggio vecchio</span>
                  ) : (
                    <span className="text-gray-500">⏳ Da contare</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : currentLocation ? (
          <div className="text-center py-20">
            <Package className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">Nessun prodotto</h3>
            <p className="text-gray-400">Non ci sono prodotti in questa ubicazione</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <Search className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">Scansiona un'ubicazione</h3>
            <p className="text-gray-400">Inizia scansionando il codice a barre di un'ubicazione</p>
          </div>
        )}
      </div>

      {/* Product Panel Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-semibold text-white mb-4">{selectedProduct.name}</h3>

            {/* Lot Selection */}
            {selectedProduct.lots.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Seleziona Lotto</label>
                <select
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  onChange={(e) => {
                    const lot = selectedProduct.lots.find(l => l.name === e.target.value);
                    setSelectedLot(lot || null);
                  }}
                >
                  <option value="">Tutti i lotti</option>
                  {selectedProduct.lots.map((lot, idx) => (
                    <option key={idx} value={lot.name}>
                      {lot.name} - {lot.qty} {selectedProduct.uom}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Quantità di sistema</label>
              <div className="text-2xl font-semibold text-emerald-500">
                {selectedLot ? selectedLot.qty : selectedProduct.totalQty} {selectedProduct.uom}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Quantità contata</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-emerald-500"
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                autoFocus
              />
            </div>

            {/* Difference Indicator */}
            {calculateDifference() !== null && (
              <div className={`mb-4 p-3 rounded-lg ${
                Math.abs(calculateDifference()!) < 0.001 ? 'bg-emerald-500/10 text-emerald-500' :
                calculateDifference()! > 0 ? 'bg-green-500/10 text-green-500' :
                'bg-red-500/10 text-red-500'
              }`}>
                Differenza: {calculateDifference()! > 0 ? '+' : ''}{calculateDifference()!.toFixed(2)} {selectedProduct.uom}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={updateInventory}
                disabled={loading || !countedQty}
                className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {loading ? 'Aggiornamento...' : 'Aggiorna Giacenza'}
              </button>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setSelectedLot(null);
                  setCountedQty('');
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg text-white font-medium shadow-lg z-50 ${
          notification.type === 'success' ? 'bg-emerald-500' :
          notification.type === 'error' ? 'bg-red-500' :
          'bg-blue-500'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-12 h-12 border-4 border-gray-600 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}