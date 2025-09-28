'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, Search, MapPin, Home, RefreshCw, Camera, AlertCircle, Plus, X, Barcode, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

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
  lots: any[];
  isCounted?: boolean;
  isCountedRecent?: boolean;
  lastCountDate?: string;
  lastCountUser?: string;
  inventoryDiff?: number;
}

// Scanner component - caricato dinamicamente per evitare SSR issues
const QrScanner = dynamic(
  () => import('../../../../components/qr-scanner').then(mod => mod.QrScanner),
  { ssr: false }
);

export default function InventarioPage() {
  // Stati base
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [countedQty, setCountedQty] = useState('');
  const [notification, setNotification] = useState<{message: string; type: string} | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState<'location' | 'product'>('location');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Test connessione all'avvio
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/inventory/test-connection');
      const data = await response.json();
      setConnected(data.success);
      console.log('Connessione:', data.success ? 'OK' : 'FALLITA');
    } catch (error) {
      setConnected(false);
      console.error('Errore connessione:', error);
    }
  };

  const showNotification = (message: string, type: string = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // RICERCA UBICAZIONE
  const searchLocation = async () => {
    if (!searchQuery.trim()) {
      showNotification('Inserisci un codice ubicazione', 'warning');
      return;
    }

    setLoading(true);
    console.log('Cerco ubicazione:', searchQuery);

    try {
      const response = await fetch('/api/inventory/search-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: searchQuery.trim() })
      });

      const data = await response.json();
      console.log('Risposta API:', data);

      if (data.success && data.location) {
        setCurrentLocation(data.location);
        showNotification(`Ubicazione trovata: ${data.location.display_name}`, 'success');
        setSearchQuery('');
        // Carica prodotti
        await loadProducts(data.location.id);
      } else {
        showNotification('Ubicazione non trovata', 'error');
      }
    } catch (error) {
      console.error('Errore ricerca:', error);
      showNotification('Errore nella ricerca', 'error');
    } finally {
      setLoading(false);
    }
  };

  // CARICA PRODOTTI
  const loadProducts = async (locationId: number) => {
    console.log('Carico prodotti per ubicazione:', locationId);

    try {
      const response = await fetch('/api/inventory/products-by-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId })
      });

      const data = await response.json();
      console.log('Prodotti caricati:', data.products?.length || 0);

      if (data.success && data.products) {
        setProducts(data.products);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
      showNotification('Errore caricamento prodotti', 'error');
    }
  };

  // AGGIORNA GIACENZA
  const updateInventory = async () => {
    if (!selectedProduct || !countedQty || !currentLocation) {
      showNotification('Completa tutti i campi', 'warning');
      return;
    }

    const qty = parseFloat(countedQty);
    if (isNaN(qty) || qty < 0) {
      showNotification('Quantità non valida', 'error');
      return;
    }

    setLoading(true);
    console.log('Aggiorno giacenza:', selectedProduct.id, qty);

    try {
      const response = await fetch('/api/inventory/update-quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          locationId: currentLocation.id,
          quantity: qty
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Giacenza aggiornata!', 'success');
        // Ricarica prodotti
        await loadProducts(currentLocation.id);
        // Reset
        setSelectedProduct(null);
        setCountedQty('');
      } else {
        showNotification(data.error || 'Errore aggiornamento', 'error');
      }
    } catch (error) {
      console.error('Errore aggiornamento:', error);
      showNotification('Errore aggiornamento', 'error');
    } finally {
      setLoading(false);
    }
  };

  // APRI SCANNER CAMERA (placeholder)
  const openScanner = (mode: 'location' | 'product' = 'location') => {
    setScanMode(mode);
    setShowScanner(true);
  };

  const handleScanResult = (result: string) => {
    setShowScanner(false);
    if (scanMode === 'location') {
      setSearchQuery(result);
      setTimeout(() => searchLocation(), 100);
    } else {
      // Per prodotti futuri
      showNotification(`Prodotto scansionato: ${result}`, 'info');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-gray-900 border-b border-gray-700 flex items-center px-6 z-40">
        <Link href="/" className="p-2 hover:bg-gray-800 rounded-lg">
          <Home className="w-6 h-6 text-gray-400" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold text-white flex items-center gap-3 ml-4">
          <Package className="w-6 h-6 text-emerald-500" />
          Gestione Inventario
        </h1>
        <button
          onClick={() => currentLocation && loadProducts(currentLocation.id)}
          className="p-2 hover:bg-gray-800 rounded-lg mr-4"
          disabled={!currentLocation}
        >
          <RefreshCw className="w-5 h-5 text-gray-400" />
        </button>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
        }`}>
          {connected ? 'Connesso' : 'Disconnesso'}
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto">

        {/* Sezione Ricerca Ubicazione */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ricerca Ubicazione</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Inserisci codice ubicazione..."
              className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              value={searchQuery}
              onChange={(e) => {
                console.log('Input cambiato:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  searchLocation();
                }
              }}
              ref={searchInputRef}
            />
            <button
              onClick={searchLocation}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              disabled={loading}
            >
              <Search className="w-5 h-5" />
              Cerca
            </button>
            <button
              onClick={() => openScanner('location')}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Barcode className="w-5 h-5" />
              Scansiona
            </button>
          </div>
        </div>

        {/* Info Ubicazione Corrente */}
        {currentLocation && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="text-2xl font-semibold text-emerald-500 flex items-center gap-3">
              <MapPin className="w-6 h-6" />
              {currentLocation.display_name || currentLocation.name}
            </div>
            <div className="text-gray-400 mt-2">
              {products.length} prodotti trovati
            </div>
          </div>
        )}

        {/* Lista Prodotti */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className={`bg-gray-800 rounded-xl p-6 cursor-pointer hover:border-emerald-500 border-2 transition-all ${
                  selectedProduct?.id === product.id ? 'border-emerald-500' : 'border-gray-700'
                }`}
                onClick={() => {
                  console.log('Prodotto selezionato:', product);
                  setSelectedProduct(product);
                }}
              >
                <div className="text-4xl mb-4">📦</div>
                <h3 className="text-lg font-medium text-white mb-2">{product.name}</h3>
                {product.code && (
                  <p className="text-sm text-gray-400 mb-2">Codice: {product.code}</p>
                )}
                <p className="text-xl font-semibold text-emerald-500">
                  {product.totalQty} {product.uom}
                </p>
                {product.isCountedRecent && (
                  <div className="mt-3 text-xs text-emerald-500">✓ Contato di recente</div>
                )}
                {product.isCounted && !product.isCountedRecent && (
                  <div className="mt-3 text-xs text-yellow-500">⚠ Conteggio vecchio</div>
                )}
                {!product.isCounted && (
                  <div className="mt-3 text-xs text-gray-500">⏳ Da contare</div>
                )}
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
            <h3 className="text-2xl font-semibold text-white mb-2">Inizia la ricerca</h3>
            <p className="text-gray-400">Cerca un'ubicazione per vedere i prodotti</p>
          </div>
        )}

        {/* Pannello Conteggio (sempre visibile se prodotto selezionato) */}
        {selectedProduct && (
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-white mb-1">{selectedProduct.name}</h3>
                  <p className="text-sm text-gray-400">
                    Quantità sistema: {selectedProduct.totalQty} {selectedProduct.uom}
                  </p>
                </div>
                <input
                  type="number"
                  placeholder="Quantità contata"
                  className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white w-48"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  step="0.01"
                />
                <button
                  onClick={updateInventory}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium"
                  disabled={loading || !countedQty}
                >
                  Aggiorna
                </button>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setCountedQty('');
                  }}
                  className="p-3 hover:bg-gray-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              {countedQty && (
                <div className={`mt-3 text-sm ${
                  parseFloat(countedQty) === selectedProduct.totalQty ? 'text-emerald-500' :
                  parseFloat(countedQty) > selectedProduct.totalQty ? 'text-green-500' :
                  'text-red-500'
                }`}>
                  Differenza: {(parseFloat(countedQty) - selectedProduct.totalQty).toFixed(2)} {selectedProduct.uom}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notifiche */}
      {notification && (
        <div className={`fixed top-24 right-6 px-6 py-3 rounded-lg text-white font-medium shadow-lg ${
          notification.type === 'success' ? 'bg-emerald-500' :
          notification.type === 'error' ? 'bg-red-500' :
          notification.type === 'warning' ? 'bg-orange-500' :
          'bg-blue-500'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="fixed bottom-6 left-6 bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-white text-sm">Caricamento...</span>
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-lg p-4">
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Scansiona {scanMode === 'location' ? 'Ubicazione' : 'Prodotto'}
              </h3>
              <QrScanner
                onResult={handleScanResult}
                onError={(error) => {
                  showNotification(`Errore scanner: ${error}`, 'error');
                  setShowScanner(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}