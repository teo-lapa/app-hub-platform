'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Search, Package, MapPin, Calculator, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/inventario/QRScanner';
import { Calculator as CalculatorComponent } from '@/components/inventario/Calculator';
import { ProductSearch } from '@/components/inventario/ProductSearch';
import { BufferTransfer } from '@/components/inventario/BufferTransfer';
import { LotManager } from '@/components/inventario/LotManager';
import { ProductList } from '@/components/inventario/ProductList';
import { ConnectionStatus } from '@/components/inventario/ConnectionStatus';
import { getInventoryClient } from '@/lib/odoo/inventoryClient';
import { Location, Product, BasicProduct, AppState, InventoryConfig } from '@/lib/types/inventory';
import toast from 'react-hot-toast';

// Configurazione app inventario
const CONFIG: InventoryConfig = {
  bufferLocation: {
    id: 8,
    name: 'WH/Stock/Buffer'
  },
  refreshInterval: 30000,
  defaultUOM: 'PZ'
};

export default function InventarioPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [appState, setAppState] = useState<AppState>({
    currentLocation: null,
    products: [],
    selectedProduct: null,
    selectedLot: null,
    scannerActive: false,
    scannerMode: 'location',
    searchMode: 'location',
    transferProduct: null,
    currentUser: null
  });

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showTransferSection, setShowTransferSection] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showBufferTransfer, setShowBufferTransfer] = useState(false);
  const [showLotManager, setShowLotManager] = useState(false);
  const [selectedProductForLot, setSelectedProductForLot] = useState<any>(null);
  const [locationProducts, setLocationProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  // Form fields
  const [locationCode, setLocationCode] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [countedQuantity, setCountedQuantity] = useState('');
  const [transferLot, setTransferLot] = useState('');
  const [transferExpiry, setTransferExpiry] = useState('');
  const [transferQty, setTransferQty] = useState('');

  const locationScannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAppState(prev => ({ ...prev, currentUser: user }));
    checkConnection();
  }, [user]);

  // Funzioni di utilità
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const checkConnection = async () => {
    try {
      // Simulazione controllo connessione Odoo
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  // Client Odoo per inventario
  const inventoryClient = getInventoryClient();

  // Gestione scanner ubicazione
  const scanLocation = async (locationCode: string) => {
    if (!locationCode) {
      showNotification('Inserisci un codice ubicazione', 'error');
      return;
    }

    try {
      setLoading(true);

      const location = await inventoryClient.findLocation(locationCode);

      if (!location) {
        throw new Error('Ubicazione non trovata: ' + locationCode);
      }

      setAppState(prev => ({ ...prev, currentLocation: location }));

      await loadLocationProducts(location.id);
      setLocationCode('');
      showNotification(`✅ Ubicazione: ${location.name}`, 'success');

    } catch (error: any) {
      console.error('Errore scan ubicazione:', error);

      if (error.message === 'Odoo Session Expired') {
        showNotification('🔐 Sessione scaduta. Reindirizzamento al login...', 'error');
        // Il redirect viene gestito automaticamente dal client
        return;
      }

      showNotification('Errore: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Carica prodotti dell'ubicazione
  const loadLocationProducts = async (locationId: number) => {
    try {
      const quants = await inventoryClient.getLocationQuants(locationId);
      const productMap = new Map();

      for (const quant of quants) {
        const productId = quant.product_id[0];

        if (!productMap.has(productId)) {
          const product = await inventoryClient.getProduct(productId);

          if (product) {
            productMap.set(productId, {
              id: productId,
              name: product.name,
              code: product.default_code || product.barcode || '',
              image: product.image_128 ? `data:image/png;base64,${product.image_128}` : null,
              uom: product.uom_id ? product.uom_id[1] : CONFIG.defaultUOM,
              uom_id: product.uom_id ? product.uom_id[0] : null,
              totalQty: 0,
              lots: [],
              lastCountDate: null,
              lastCountUser: null,
              inventoryQuantity: null,
              inventoryDiff: null,
              isCounted: false,
              isCountedRecent: false
            });
          }
        }

        const productData = productMap.get(productId);
        if (productData) {
          productData.totalQty += quant.quantity;

          if (quant.lot_id) {
            productData.lots.push({
              id: quant.lot_id[0],
              name: quant.lot_id[1],
              quantity: quant.quantity,
              inventoryQuantity: quant.inventory_quantity,
              inventoryDiff: quant.inventory_diff_quantity
            });
          }

          if (quant.inventory_date) {
            productData.lastCountDate = quant.inventory_date;
            productData.lastCountUser = quant.user_id ? quant.user_id[1] : null;
            productData.isCounted = true;

            const countDate = new Date(quant.inventory_date);
            const now = new Date();
            const diffHours = (now.getTime() - countDate.getTime()) / (1000 * 60 * 60);
            productData.isCountedRecent = diffHours < 24;
          }
        }
      }

      const productsArray = Array.from(productMap.values());
      setAppState(prev => ({ ...prev, products: productsArray }));

      // Popola anche locationProducts per il nuovo componente ProductList
      setLocationProducts(productsArray.map(p => ({
        ...p,
        stockQuantity: p.totalQty,
        countedQuantity: p.inventoryQuantity || p.totalQty,
        difference: p.inventoryDiff || 0
      })));

    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
      showNotification('Errore nel caricamento dei prodotti', 'error');
    }
  };

  const selectProduct = (product: Product) => {
    setAppState(prev => ({ ...prev, selectedProduct: product }));
    setShowBottomPanel(true);

    // Reset form
    setLotNumber('');
    setExpiryDate('');
    setCountedQuantity('');
  };

  const closeBottomPanel = () => {
    setShowBottomPanel(false);
    setAppState(prev => ({ ...prev, selectedProduct: null }));
  };

  const handleLocationScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      scanLocation(locationCode);
    }
  };

  const handleQRScan = (result: string) => {
    setLocationCode(result);
    scanLocation(result);
  };

  const handleCalculatorConfirm = (value: string) => {
    setCountedQuantity(value);
  };

  const handleProductSelect = (product: BasicProduct) => {
    // Implementa logica per aggiungere prodotto all'ubicazione
    showNotification(`Prodotto ${product.name} selezionato per l'ubicazione`, 'info');
  };

  const openQRScanner = () => {
    setShowQRScanner(true);
  };

  const openCalculator = () => {
    setShowCalculator(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <AppHeader
        title="Gestione Inventario"
        subtitle="Scanner → Prodotti → Modifica"
        icon={<Package className="h-8 w-8 text-white" />}
        showHomeButton={true}
        showBackButton={false}
        rightElement={
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            connectionStatus === 'connected'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className="text-sm font-medium">
              {connectionStatus === 'connected' ? 'Connesso' : 'Non connesso'}
            </span>
          </div>
        }
      />

      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-500/90 text-white' :
            notification.type === 'error' ? 'bg-red-500/90 text-white' :
            'bg-blue-500/90 text-white'
          }`}
        >
          {notification.message}
        </motion.div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-strong p-6 rounded-xl">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-center">Caricamento...</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Scanner Section */}
        <div className="glass-strong rounded-xl p-6 mb-6">
          <div className="text-center mb-6">
            <Package className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Scanner Ubicazione</h2>
            <p className="text-muted-foreground">
              📱 Usa pistola scanner o fotocamera per leggere il barcode dell'ubicazione
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              ref={locationScannerRef}
              type="text"
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
              onKeyDown={handleLocationScan}
              placeholder="Scansiona o inserisci codice ubicazione"
              className="flex-1 min-w-0 glass px-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={openQRScanner}
              className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Camera</span>
            </button>
            <button
              onClick={() => setShowSearchPanel(true)}
              className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Aggiungi</span>
            </button>
            <button
              onClick={() => setShowBufferTransfer(true)}
              className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2 bg-blue-600/20 border border-blue-500/30"
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Buffer</span>
            </button>
          </div>
        </div>

        {/* Location Info */}
        {appState.currentLocation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-xl p-6 mb-6 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-lg mb-2">
              {appState.currentLocation.complete_name || appState.currentLocation.name}
            </h3>
            <p className="text-muted-foreground">
              Codice: {appState.currentLocation.barcode || appState.currentLocation.name}
            </p>
          </motion.div>
        )}

        {/* Products List */}
        {locationProducts.length > 0 ? (
          <ProductList
            products={locationProducts}
            onSelectProduct={(product) => {
              setSelectedProductForLot(product);
              setShowLotManager(true);
            }}
            onUpdateQuantity={(productId, quantity) => {
              setLocationProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, countedQuantity: quantity } : p
              ));
              toast.success('Quantità aggiornata');
            }}
            onOpenCalculator={(productId, currentQuantity) => {
              setAppState(prev => ({
                ...prev,
                selectedProduct: locationProducts.find(p => p.id === productId)
              }));
              setCountedQuantity(currentQuantity.toString());
              setShowCalculator(true);
            }}
          />
        ) : appState.currentLocation ? (
          <div className="glass-strong rounded-xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nessun prodotto trovato</h3>
            <p className="text-muted-foreground">
              Nessun prodotto trovato in: {appState.currentLocation.name}
            </p>
          </div>
        ) : (
          <div className="glass-strong rounded-xl p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nessun prodotto trovato</h3>
            <p className="text-muted-foreground">
              Scansiona un'ubicazione per vedere i prodotti contenuti
            </p>
          </div>
        )}
      </div>

      {/* Bottom Panel - Product Details */}
      {showBottomPanel && appState.selectedProduct && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="fixed inset-x-0 bottom-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-white/20 max-h-[80vh] overflow-y-auto"
        >
          <div className="max-w-2xl mx-auto p-6">
            {/* Product Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                {appState.selectedProduct.image ? (
                  <img
                    src={appState.selectedProduct.image}
                    alt={appState.selectedProduct.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{appState.selectedProduct.name}</h3>
                <p className="text-muted-foreground">{appState.selectedProduct.code}</p>
                <div className="mt-2 glass px-3 py-2 rounded-lg">
                  <span className="text-sm text-muted-foreground">Giacenza sistema: </span>
                  <span className="text-lg font-bold text-blue-400">
                    {appState.selectedProduct.totalQty} {appState.selectedProduct.uom}
                  </span>
                </div>
              </div>
              <button
                onClick={closeBottomPanel}
                className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  LOTTO/SERIE *
                </label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="Inserisci numero lotto (obbligatorio)"
                  className="w-full glass px-4 py-3 rounded-xl border-2 border-yellow-500/50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  SCADENZA (opzionale)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  QUANTITÀ CONTATA
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={countedQuantity}
                    onChange={(e) => setCountedQuantity(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="Inserisci quantità fisica (anche 0)"
                    className="flex-1 glass px-4 py-3 rounded-xl border-2 border-blue-500/50 focus:border-blue-500 focus:outline-none font-semibold"
                    readOnly
                  />
                  <button
                    onClick={openCalculator}
                    className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <Calculator className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors">
                Conferma Conteggio
              </button>
              <button
                onClick={closeBottomPanel}
                className="glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* QR Scanner */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
        title="Scanner Ubicazione"
      />

      {/* Calculator */}
      <CalculatorComponent
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onConfirm={handleCalculatorConfirm}
        title="Inserisci Quantità"
        initialValue={countedQuantity || "0"}
      />

      {/* Product Search */}
      <ProductSearch
        isOpen={showSearchPanel}
        onClose={() => setShowSearchPanel(false)}
        onSelectProduct={handleProductSelect}
        currentLocationName={appState.currentLocation?.name}
      />

      {/* Buffer Transfer */}
      <BufferTransfer
        isOpen={showBufferTransfer}
        onClose={() => setShowBufferTransfer(false)}
        currentLocation={appState.currentLocation}
        onTransferComplete={() => {
          // Ricarica i prodotti dell'ubicazione dopo il trasferimento
          if (appState.currentLocation) {
            loadLocationProducts(appState.currentLocation.id);
          }
        }}
      />

      {/* Lot Manager */}
      <LotManager
        isOpen={showLotManager}
        onClose={() => setShowLotManager(false)}
        productId={selectedProductForLot?.id || 0}
        productName={selectedProductForLot?.name || ''}
        onSelectLot={(lot) => {
          setAppState(prev => ({ ...prev, selectedLot: lot }));
          setShowLotManager(false);
          toast.success(`Lotto ${lot.name} selezionato`);
        }}
        currentLocationId={appState.currentLocation?.id}
      />

      {/* Connection Status */}
      <ConnectionStatus />

      {/* Mobile Home Button */}
      <MobileHomeButton />
    </div>
  );
}