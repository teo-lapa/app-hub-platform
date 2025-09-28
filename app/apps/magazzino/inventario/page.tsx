'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Package, Search, MapPin, Home, RefreshCw, Camera, AlertCircle, Plus, X, Calendar, Hash, Truck } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Scanner QR verrà caricato solo client-side

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
  tracking?: string;
  lots: Lot[];
  isCounted?: boolean;
  isCountedRecent?: boolean;
  lastCountDate?: string;
  lastCountUser?: string;
  inventoryQuantity?: number;
  inventoryDiff?: number;
  isNewProduct?: boolean;
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

interface TransferProduct extends Product {
  availableQty: number;
  sourceQuants: any[];
}

export default function InventarioPage() {
  // Stati principali
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');

  // Stati per ricerca avanzata
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchTab, setSearchTab] = useState<'product' | 'location'>('product');
  const [locationResults, setLocationResults] = useState<Location[]>([]);

  // Stati per gestione prodotto selezionato
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [countedQty, setCountedQty] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Stati per trasferimento
  const [transferProduct, setTransferProduct] = useState<TransferProduct | null>(null);
  const [transferQty, setTransferQty] = useState('');
  const [transferLotNumber, setTransferLotNumber] = useState('');
  const [transferExpiryDate, setTransferExpiryDate] = useState('');

  // Stati per scanner camera
  const [showScanner, setShowScanner] = useState(false);
  const [scannerType, setScannerType] = useState<'location' | 'product'>('location');
  const scannerRef = useRef<any>(null);

  // Notifiche
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error' | 'warning' | 'info'} | null>(null);

  // Verifica connessione all'avvio
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

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // SCANNER CAMERA
  const startCameraScanner = (type: 'location' | 'product') => {
    setScannerType(type);
    setShowScanner(true);
  };

  const onScanSuccess = (decodedText: string) => {
    if (scannerType === 'location') {
      setLocationSearchQuery(decodedText);
      searchLocation(decodedText);
    } else {
      setProductSearchQuery(decodedText);
      searchProductByCode(decodedText);
    }
    stopScanner();
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setShowScanner(false);
  };

  // RICERCA UBICAZIONE
  const searchLocation = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/inventory/search-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: query.trim() })
      });

      const data = await response.json();

      if (data.success && data.location) {
        setCurrentLocation(data.location);
        await loadProducts(data.location.id);
        showNotification(`📍 ${data.location.display_name}`, 'success');
        setLocationSearchQuery('');
      } else {
        showNotification('Ubicazione non trovata', 'error');
      }
    } catch (error) {
      console.error('Errore ricerca ubicazione:', error);
      showNotification('Errore nella ricerca', 'error');
    } finally {
      setLoading(false);
    }
  };

  // RICERCA AVANZATA UBICAZIONI
  const searchLocations = async () => {
    if (!productSearchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/inventory/search-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: productSearchQuery })
      });

      const data = await response.json();
      if (data.success) {
        setLocationResults(data.locations || []);
      }
    } catch (error) {
      showNotification('Errore ricerca ubicazioni', 'error');
    } finally {
      setLoading(false);
    }
  };

  // CARICA PRODOTTI UBICAZIONE
  const loadProducts = async (locationId: number) => {
    try {
      const response = await fetch('/api/inventory/products-by-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId })
      });

      const data = await response.json();

      if (data.success && data.products) {
        // Ordina: non contati prima, contati recenti per ultimi
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

  // RICERCA PRODOTTI
  const searchProducts = async () => {
    if (!productSearchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/inventory/search-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: productSearchQuery })
      });

      const data = await response.json();
      if (data.success) {
        setSearchResults(data.products || []);
      }
    } catch (error) {
      showNotification('Errore ricerca prodotti', 'error');
    } finally {
      setLoading(false);
    }
  };

  const searchProductByCode = async (code: string) => {
    setProductSearchQuery(code);
    await searchProducts();
  };

  // SELEZIONA PRODOTTO DA RICERCA
  const selectSearchResult = async (product: Product) => {
    if (!currentLocation) {
      showNotification('Seleziona prima un\'ubicazione', 'warning');
      return;
    }

    // Verifica disponibilità in altre ubicazioni
    try {
      setLoading(true);
      const response = await fetch('/api/inventory/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          excludeLocationId: currentLocation.id
        })
      });

      const data = await response.json();

      if (data.success && data.totalQty > 0) {
        // Mostra pannello trasferimento
        setTransferProduct({
          ...product,
          availableQty: data.totalQty,
          sourceQuants: data.quants
        });
        setShowProductSearch(false);
        showNotification(`✅ ${data.totalQty} ${product.uom} disponibili per trasferimento`, 'success');
      } else {
        // Aggiungi prodotto con giacenza 0
        addProductWithZeroStock(product);
      }
    } catch (error) {
      showNotification('Errore verifica disponibilità', 'error');
    } finally {
      setLoading(false);
    }
  };

  // AGGIUNGI PRODOTTO CON GIACENZA 0
  const addProductWithZeroStock = (product: Product) => {
    const newProduct: Product = {
      ...product,
      totalQty: 0,
      lots: [],
      isNewProduct: true
    };

    // Verifica se già presente
    if (products.find(p => p.id === product.id)) {
      showNotification('Prodotto già presente', 'info');
      return;
    }

    setProducts([...products, newProduct]);
    setShowProductSearch(false);
    showNotification(`✅ ${product.name} aggiunto per conteggio`, 'success');

    // Auto-seleziona per conteggio immediato
    setSelectedProduct(newProduct);
    setCountedQty('0');
  };

  // TRASFERIMENTO DA BUFFER
  const executeTransfer = async () => {
    if (!transferProduct || !currentLocation) return;

    const qty = parseFloat(transferQty);
    if (isNaN(qty) || qty < 0) {
      showNotification('Quantità non valida', 'error');
      return;
    }

    if (!transferLotNumber.trim()) {
      showNotification('Inserisci numero lotto', 'error');
      return;
    }

    if (!transferExpiryDate) {
      showNotification('Inserisci data scadenza', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/inventory/transfer-from-buffer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: transferProduct.id,
          quantity: qty,
          destLocationId: currentLocation.id,
          lotNumber: transferLotNumber,
          expiryDate: transferExpiryDate
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification(`✅ Trasferiti ${qty} ${transferProduct.uom} (Lotto: ${transferLotNumber})`, 'success');

        // Reset e ricarica
        setTransferProduct(null);
        setTransferQty('');
        setTransferLotNumber('');
        setTransferExpiryDate('');
        await loadProducts(currentLocation.id);
      } else {
        throw new Error(data.error || 'Errore trasferimento');
      }
    } catch (error) {
      console.error('Errore trasferimento:', error);
      showNotification('Errore nel trasferimento', 'error');
    } finally {
      setLoading(false);
    }
  };

  // AGGIORNA GIACENZA
  const updateInventory = async () => {
    if (!selectedProduct || !countedQty || !currentLocation) return;

    const qty = parseFloat(countedQty);
    if (isNaN(qty) || qty < 0) {
      showNotification('Inserisci una quantità valida', 'error');
      return;
    }

    // Se tracking lotto e nuovo conteggio, richiedi lotto
    if (selectedProduct.tracking === 'lot' && !selectedLot && qty > 0 && !lotNumber) {
      showNotification('Inserisci numero lotto', 'error');
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
          lotId: selectedLot?.id,
          lotNumber: lotNumber || undefined,
          expiryDate: expiryDate || undefined,
          isNewProduct: selectedProduct.isNewProduct
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('✅ Giacenza aggiornata', 'success');

        // Ricarica prodotti
        await loadProducts(currentLocation.id);

        // Reset selezione
        setSelectedProduct(null);
        setSelectedLot(null);
        setCountedQty('');
        setLotNumber('');
        setExpiryDate('');
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

  // CALCOLA DIFFERENZA
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
        <button
          onClick={() => currentLocation && loadProducts(currentLocation.id)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors mr-4"
          title="Ricarica prodotti"
        >
          <RefreshCw className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          connected ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {connected ? 'Connesso' : 'Disconnesso'}
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
        {/* Scanner Ubicazione */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex gap-4 items-center">
            <input
              id="locationScanner"
              type="text"
              placeholder="Scansiona o digita ubicazione..."
              className="flex-1 px-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-emerald-500"
              value={locationSearchQuery}
              onChange={(e) => setLocationSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchLocation(locationSearchQuery);
                }
              }}
            />
            <button
              onClick={() => searchLocation(locationSearchQuery)}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Cerca
            </button>
            <button
              onClick={() => startCameraScanner('location')}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Scansiona
            </button>
          </div>

          {/* Bottone ricerca avanzata */}
          {currentLocation && (
            <button
              onClick={() => setShowProductSearch(!showProductSearch)}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Aggiungi prodotto all'ubicazione
            </button>
          )}
        </div>

        {/* Info Ubicazione */}
        {currentLocation && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
            <div className="text-2xl font-semibold text-emerald-500 mb-2 flex items-center gap-3">
              <MapPin className="w-6 h-6" />
              {currentLocation.display_name || currentLocation.name}
            </div>
            <div className="text-gray-400">
              {products.length} prodotti • {products.filter(p => !p.isCounted).length} da contare
            </div>
          </div>
        )}

        {/* Pannello Ricerca Avanzata */}
        {showProductSearch && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Ricerca Avanzata</h3>
              <button
                onClick={() => setShowProductSearch(false)}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSearchTab('product')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  searchTab === 'product' ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'
                }`}
              >
                Prodotti
              </button>
              <button
                onClick={() => setSearchTab('location')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  searchTab === 'location' ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'
                }`}
              >
                Ubicazioni
              </button>
            </div>

            {/* Search Input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder={searchTab === 'product' ? "Cerca prodotto..." : "Cerca ubicazione..."}
                className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    searchTab === 'product' ? searchProducts() : searchLocations();
                  }
                }}
              />
              <button
                onClick={() => searchTab === 'product' ? searchProducts() : searchLocations()}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium"
              >
                Cerca
              </button>
              <button
                onClick={() => startCameraScanner('product')}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {/* Risultati */}
            <div className="max-h-80 overflow-y-auto">
              {searchTab === 'product' ? (
                searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => selectSearchResult(product)}
                    className="p-4 mb-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="font-medium text-white">{product.name}</div>
                    {product.code && <div className="text-sm text-gray-400">{product.code}</div>}
                  </div>
                ))
              ) : (
                locationResults.map((location) => (
                  <div
                    key={location.id}
                    onClick={() => {
                      setCurrentLocation(location);
                      loadProducts(location.id);
                      setShowProductSearch(false);
                    }}
                    className="p-4 mb-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="font-medium text-white">{location.display_name}</div>
                    {location.barcode && <div className="text-sm text-gray-400">{location.barcode}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Pannello Trasferimento */}
        {transferProduct && (
          <div className="bg-gray-800 border border-orange-500/30 rounded-xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-orange-500 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Trasferimento da Buffer
              </h3>
              <button
                onClick={() => {
                  setTransferProduct(null);
                  setTransferQty('');
                  setTransferLotNumber('');
                  setTransferExpiryDate('');
                }}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mb-4">
              <div className="text-white font-medium mb-2">{transferProduct.name}</div>
              <div className="text-emerald-500">
                {transferProduct.availableQty} {transferProduct.uom} disponibili
              </div>
              <div className="text-gray-400 text-sm mt-1">
                Destinazione: {currentLocation?.display_name}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Quantità</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Numero Lotto</label>
                <input
                  type="text"
                  placeholder="Inserisci lotto..."
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  value={transferLotNumber}
                  onChange={(e) => setTransferLotNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Data Scadenza</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  value={transferExpiryDate}
                  onChange={(e) => setTransferExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={executeTransfer}
              disabled={loading}
              className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Trasferimento...' : 'Esegui Trasferimento'}
            </button>
          </div>
        )}

        {/* Griglia Prodotti */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const statusColor = product.isCountedRecent ? 'border-emerald-500/30' :
                                 product.isCounted ? 'border-yellow-500/30' :
                                 product.isNewProduct ? 'border-blue-500/30' : 'border-gray-700';

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={`bg-gray-800 border ${statusColor} rounded-xl p-6 cursor-pointer hover:border-emerald-500 transition-all ${
                    selectedProduct?.id === product.id ? 'ring-2 ring-emerald-500' : ''
                  }`}
                >
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-32 object-contain mb-4 rounded" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center text-4xl mb-4 bg-gray-700/30 rounded">
                      📦
                    </div>
                  )}
                  <h3 className="text-lg font-medium text-white mb-2 truncate" title={product.name}>
                    {product.name}
                  </h3>
                  {product.code && <p className="text-sm text-gray-400 mb-2">{product.code}</p>}
                  <p className="text-xl font-semibold text-emerald-500">
                    {product.totalQty} {product.uom}
                  </p>

                  {product.lots.length > 0 && (
                    <div className="mt-3 text-sm text-gray-400 max-h-12 overflow-y-auto">
                      {product.lots.map(lot => `${lot.name}: ${lot.qty}`).join(', ')}
                    </div>
                  )}

                  <div className="mt-3 text-xs">
                    {product.isNewProduct ? (
                      <span className="text-blue-500">🆕 Nuovo prodotto</span>
                    ) : product.isCountedRecent ? (
                      <span className="text-emerald-500">✓ Contato recentemente</span>
                    ) : product.isCounted ? (
                      <span className="text-yellow-500">⚠ Conteggio vecchio</span>
                    ) : (
                      <span className="text-gray-500">⏳ Da contare</span>
                    )}
                  </div>

                  {product.lastCountDate && (
                    <div className="mt-2 text-xs text-gray-500">
                      📅 {new Date(product.lastCountDate).toLocaleDateString('it-IT')}
                    </div>
                  )}

                  {product.inventoryDiff !== undefined && product.inventoryDiff !== null && product.isCounted && (
                    <div className={`mt-2 text-xs font-medium ${
                      product.inventoryDiff === 0 ? 'text-emerald-500' :
                      product.inventoryDiff > 0 ? 'text-green-500' :
                      'text-red-500'
                    }`}>
                      Diff: {product.inventoryDiff > 0 ? '+' : ''}{product.inventoryDiff}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : currentLocation ? (
          <div className="text-center py-20">
            <Package className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">Nessun prodotto</h3>
            <p className="text-gray-400 mb-4">Non ci sono prodotti in questa ubicazione</p>
            <button
              onClick={() => setShowProductSearch(true)}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Aggiungi prodotto
            </button>
          </div>
        ) : (
          <div className="text-center py-20">
            <Search className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">Scansiona un'ubicazione</h3>
            <p className="text-gray-400">Inizia scansionando il codice a barre di un'ubicazione</p>
          </div>
        )}
      </div>

      {/* Modal Conteggio Prodotto */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">{selectedProduct.name}</h3>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setSelectedLot(null);
                  setCountedQty('');
                  setLotNumber('');
                  setExpiryDate('');
                }}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Selezione Lotto se multipli */}
            {selectedProduct.lots.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Seleziona Lotto</label>
                <select
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  onChange={(e) => {
                    const lot = selectedProduct.lots.find(l => l.name === e.target.value);
                    setSelectedLot(lot || null);
                    if (lot?.expiry_date) {
                      setExpiryDate(new Date(lot.expiry_date).toISOString().split('T')[0]);
                    }
                  }}
                  value={selectedLot?.name || ''}
                >
                  <option value="">-- Seleziona lotto --</option>
                  {selectedProduct.lots.map((lot, idx) => (
                    <option key={idx} value={lot.name}>
                      {lot.name} - {lot.qty} {selectedProduct.uom}
                      {lot.expiry_date && ` (Scad: ${new Date(lot.expiry_date).toLocaleDateString('it-IT')})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantità di Sistema */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Quantità di sistema</label>
              <div className="text-2xl font-semibold text-emerald-500">
                {selectedLot ? selectedLot.qty : selectedProduct.totalQty} {selectedProduct.uom}
              </div>
              {selectedProduct.lastCountDate && (
                <div className="text-sm text-gray-500 mt-1">
                  Ultimo conteggio: {new Date(selectedProduct.lastCountDate).toLocaleDateString('it-IT')}
                  {selectedProduct.lastCountUser && ` da ${selectedProduct.lastCountUser}`}
                </div>
              )}
            </div>

            {/* Input Quantità Contata */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Quantità contata</label>
              <input
                id="countedInput"
                type="number"
                step="0.01"
                className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-emerald-500"
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Input Lotto (se tracking lot e nuovo conteggio) */}
            {selectedProduct.tracking === 'lot' && !selectedLot && parseFloat(countedQty) > 0 && (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Numero Lotto
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Inserisci numero lotto..."
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Data Scadenza
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Indicatore Differenza */}
            {calculateDifference() !== null && (
              <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
                Math.abs(calculateDifference()!) < 0.001 ? 'bg-emerald-500/10 text-emerald-500' :
                calculateDifference()! > 0 ? 'bg-green-500/10 text-green-500' :
                'bg-red-500/10 text-red-500'
              }`}>
                <span>Differenza:</span>
                <span className="font-semibold">
                  {calculateDifference()! > 0 ? '+' : ''}{calculateDifference()!.toFixed(2)} {selectedProduct.uom}
                  {Math.abs(calculateDifference()!) < 0.001 ? ' (Conforme)' :
                   calculateDifference()! > 0 ? ' (Eccedenza)' : ' (Mancanza)'}
                </span>
              </div>
            )}

            {/* Bottoni Azione */}
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
                  setLotNumber('');
                  setExpiryDate('');
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner Camera */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                Scansiona {scannerType === 'location' ? 'Ubicazione' : 'Prodotto'}
              </h3>
              <button
                onClick={stopScanner}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
              >
                Chiudi
              </button>
            </div>
            <div id="qr-reader" className="w-full" />
            <div className="mt-4">
              <input
                type="text"
                placeholder="O digita manualmente..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    onScanSuccess(e.currentTarget.value);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Notifiche */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg text-white font-medium shadow-lg z-50 flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-emerald-500' :
          notification.type === 'error' ? 'bg-red-500' :
          notification.type === 'warning' ? 'bg-orange-500' :
          'bg-blue-500'
        }`}>
          {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Loading Indicator (non-blocking) */}
      {loading && (
        <div className="fixed bottom-6 left-6 bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg z-50">
          <div className="w-6 h-6 border-3 border-gray-600 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-white text-sm font-medium">Caricamento...</span>
        </div>
      )}
    </div>
  );
}