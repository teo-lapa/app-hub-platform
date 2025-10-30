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
import { ProductEditModal } from '@/components/inventario/ProductEditModal';
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
  const [selectedNewProduct, setSelectedNewProduct] = useState<BasicProduct | null>(null);
  const [locationProducts, setLocationProducts] = useState<any[]>([]);
  const [showProductEditModal, setShowProductEditModal] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<any>(null);
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

      console.log('🔍 [React] Cercando ubicazione:', locationCode);

      const result = await inventoryClient.findLocation(locationCode);

      console.log('📦 [React] Risultato ricevuto:', result);

      if (!result) {
        console.error('❌ [React] Nessun risultato per:', locationCode);
        showNotification(`⚠️ Ubicazione "${locationCode}" non trovata`, 'error');
        setLoading(false);
        return;
      }

      const { location, inventory } = result;

      // L'API ora restituisce righe separate per ogni lotto (quant)
      // Ogni item è già un prodotto+lotto specifico
      const products: Product[] = inventory.map((item: any) => {
        const product = {
          id: item.product_id,
          quant_id: item.quant_id,
          name: item.product_name,
          code: item.default_code || '',
          barcode: item.barcode || '',
          default_code: item.default_code || '',
          image: item.image_128 ? `data:image/png;base64,${item.image_128}` : null,
          quantity: item.quantity || 0,
          reserved: item.reserved_quantity || 0,
          uom: item.uom_id ? item.uom_id[1] : 'PZ',
          totalQty: item.quantity || 0,

          // Dati lotto
          lot_id: item.lot_id,
          lot_name: item.lot_name,
          lot_expiration_date: item.lot_expiration_date,

          // Stato conteggio
          inventory_quantity: item.inventory_quantity,
          inventory_diff_quantity: item.inventory_diff_quantity,
          inventory_date: item.inventory_date,
          write_date: item.write_date,
          isCounted: item.inventory_quantity !== null && item.inventory_quantity !== undefined,
          isCountedRecent: false
        };

        // Log di debug per verificare quant_id
        console.log(`🔑 [scanLocation] Prodotto: ${product.name}, quant_id: ${product.quant_id}, lot: ${product.lot_name}`);

        return product;
      })
      // Ordina alfabeticamente per nome prodotto
      .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

      console.log('📦 [React] Quants caricati (prodotto+lotto):', products.length, products);

      setAppState(prev => ({
        ...prev,
        currentLocation: location,
        products: products
      }));

      // IMPORTANTE: Popola anche locationProducts per il componente ProductList
      const locationProductsData = products.map(p => {
        const locationProduct = {
          ...p,
          quant_id: p.quant_id, // IMPORTANTE: Mantieni quant_id per chiave univoca
          image: p.image,
          stockQuantity: p.totalQty || 0,
          countedQuantity: p.totalQty || 0,
          difference: 0,
          // Aggiungi dati lotto in formato corretto per ProductEditModal
          lot: p.lot_id ? {
            id: p.lot_id,
            name: p.lot_name || '',
            expiration_date: p.lot_expiration_date || undefined
          } : undefined
        };

        console.log(`📍 [locationProducts] Prodotto: ${locationProduct.name}, quant_id: ${locationProduct.quant_id}`);

        return locationProduct;
      })
      // Ordina alfabeticamente per nome prodotto (già ordinato in products, ma per sicurezza)
      .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

      console.log('🏪 [React] Setting locationProducts:', locationProductsData.length);
      setLocationProducts(locationProductsData);

      console.log('📦 [React] Stato aggiornato. Prodotti nello stato:', appState.products.length);

      setLocationCode('');
      showNotification(`✅ Ubicazione: ${location.name} (${inventory.length} prodotti)`, 'success');

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

      const productsArray = Array.from(productMap.values())
        // Ordina alfabeticamente per nome prodotto
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

      console.log('📦 [React] ProductsArray creato:', productsArray.length);
      console.log('🔍 [React] Primo prodotto:', productsArray[0]);

      setAppState(prev => ({ ...prev, products: productsArray }));

      // Popola anche locationProducts per il nuovo componente ProductList
      const locationProductsData = productsArray.map(p => ({
        ...p,
        stockQuantity: p.totalQty || 0,
        countedQuantity: p.inventoryQuantity || p.totalQty || 0,
        difference: p.inventoryDiff || 0
      }))
      // Ordina alfabeticamente per nome prodotto
      .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

      console.log('🏪 [React] LocationProducts mappati:', locationProductsData.length);
      console.log('📋 [React] Primo locationProduct:', locationProductsData[0]);

      setLocationProducts(locationProductsData);

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

  const handleCalculatorConfirm = async (value: string) => {
    setCountedQuantity(value);
    const quantity = parseFloat(value) || 0;

    // Se stiamo aggiungendo un nuovo prodotto dalla ricerca
    if (selectedNewProduct) {
      console.log('➕ Aggiungendo nuovo prodotto con quantità:', quantity);

      // Salva su Odoo
      if (appState.currentLocation) {
        try {
          const saveResponse = await fetch('/api/inventory/update-quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              productId: selectedNewProduct.id,
              locationId: appState.currentLocation.id,
              quantity: quantity
            })
          });

          const saveData = await saveResponse.json();
          if (!saveData.success) {
            throw new Error(saveData.error || 'Errore salvataggio');
          }

          console.log('✅ Quantità salvata su Odoo:', saveData);
        } catch (error: any) {
          console.error('❌ Errore salvataggio su Odoo:', error);
          toast.error('Errore salvataggio: ' + error.message);
          return;
        }
      }

      // Crea un nuovo oggetto Product dal BasicProduct
      const newProduct: Product = {
        id: selectedNewProduct.id,
        name: selectedNewProduct.name,
        code: selectedNewProduct.code || '',
        barcode: selectedNewProduct.barcode || '',
        image: selectedNewProduct.image,
        uom: selectedNewProduct.uom || 'PZ',
        quantity: 0, // Nuovo prodotto in inventario
        reserved: 0,
        totalQty: quantity,
        lots: [],
        isCounted: true,
        isCountedRecent: true
      };

      // Aggiungi alla lista dei prodotti dell'ubicazione
      setLocationProducts(prev => [...prev, {
        ...newProduct,
        stockQuantity: 0, // Nuovo prodotto, quindi stock iniziale 0
        countedQuantity: quantity,
        difference: quantity // Differenza positiva perché stiamo aggiungendo
      }]);

      // Aggiungi anche ad appState.products
      setAppState(prev => ({
        ...prev,
        products: [...prev.products, newProduct]
      }));

      toast.success(`✅ ${selectedNewProduct.name} aggiunto con quantità: ${quantity}`);

      // Reset
      setSelectedNewProduct(null);

    } else if (appState.selectedProduct) {
      // Salva su Odoo la quantità contata
      if (appState.currentLocation) {
        try {
          const saveResponse = await fetch('/api/inventory/update-quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              productId: appState.selectedProduct.id,
              locationId: appState.currentLocation.id,
              quantity: quantity
            })
          });

          const saveData = await saveResponse.json();
          if (!saveData.success) {
            throw new Error(saveData.error || 'Errore salvataggio');
          }

          console.log('✅ Quantità salvata su Odoo:', saveData);
        } catch (error: any) {
          console.error('❌ Errore salvataggio su Odoo:', error);
          toast.error('Errore salvataggio: ' + error.message);
          return;
        }
      }

      // Aggiorna locationProducts se stiamo modificando un prodotto esistente
      setLocationProducts(prev => prev.map(p =>
        p.id === appState.selectedProduct?.id
          ? { ...p, countedQuantity: quantity, difference: quantity - p.stockQuantity }
          : p
      ));
      toast.success(`✅ Quantità salvata: ${quantity}`);
    }
  };

  const handleProductSelect = (product: BasicProduct) => {
    console.log('🆕 Prodotto selezionato dalla ricerca:', product);

    // Crea un oggetto compatibile con ProductEditModal
    const productForEdit = {
      id: product.id,
      name: product.name,
      code: product.code || '',
      barcode: product.barcode || '',
      image: product.image,
      uom: product.uom || 'PZ',
      stockQuantity: 0, // Nuovo prodotto, quindi stock 0
      countedQuantity: 0,
      difference: 0,
      lot: undefined
    };

    // Apri il popup di modifica prodotto
    setSelectedProductForEdit(productForEdit);
    setCountedQuantity('0'); // Inizializza la quantità per il modal
    setShowProductEditModal(true);
    setShowSearchPanel(false); // Chiudi il pannello di ricerca

    showNotification(`📦 Configura: ${product.name}`, 'info');
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
              setSelectedProductForEdit(product);
              setShowProductEditModal(true);
            }}
            onUpdateQuantity={(productId, quantity) => {
              setLocationProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, countedQuantity: quantity } : p
              ));
              toast.success('Quantità aggiornata');
            }}
          />
        ) : appState.currentLocation && appState.products.length > 0 ? (
          <ProductList
            products={appState.products.map(p => ({
              id: p.id,
              quant_id: p.quant_id,
              name: p.name,
              code: p.code,
              image: p.image || undefined,
              uom: p.uom,
              stockQuantity: p.totalQty || 0,
              countedQuantity: p.inventory_quantity ?? (p.totalQty || 0),
              difference: p.inventory_diff_quantity ?? 0,
              lot: p.lot_id ? {
                id: p.lot_id,
                name: p.lot_name || '',
                expiration_date: p.lot_expiration_date || undefined
              } : undefined,
              inventory_date: p.inventory_date || undefined,
              write_date: p.write_date || undefined
            }))}
            onSelectProduct={(product) => {
              setSelectedProductForEdit(product);
              setShowProductEditModal(true);
            }}
            onUpdateQuantity={(productId, quantity) => {
              console.log('Update quantity:', productId, quantity);
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
        onConfirm={(value) => {
          setCountedQuantity(value);
          setShowCalculator(false);

          // Se non stiamo usando il ProductEditModal, usa la vecchia logica
          if (!showProductEditModal) {
            handleCalculatorConfirm(value);
          }
        }}
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
          setAppState(prev => ({
            ...prev,
            selectedLot: {
              ...lot,
              quantity: lot.quantity || 0
            }
          }));
          setShowLotManager(false);
          toast.success(`Lotto ${lot.name} selezionato`);
        }}
        currentLocationId={appState.currentLocation?.id}
      />

      {/* Product Edit Modal */}
      <ProductEditModal
        isOpen={showProductEditModal}
        onClose={() => setShowProductEditModal(false)}
        product={selectedProductForEdit}
        onConfirm={async (data) => {
          if (!selectedProductForEdit || !appState.currentLocation) return;

          try {
            // Salva su Odoo la quantità, lotto e scadenza
            const saveResponse = await fetch('/api/inventory/update-quantity', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                productId: selectedProductForEdit.id,
                locationId: appState.currentLocation.id,
                quantId: selectedProductForEdit.quant_id, // ID della riga specifica
                quantity: data.quantity,
                lotName: data.lotName,
                expiryDate: data.expiryDate
              })
            });

            const saveData = await saveResponse.json();
            console.log('📡 [onConfirm] Response from API:', saveData);
            if (!saveData.success) {
              console.error('❌ [onConfirm] API returned error:', saveData.error);
              throw new Error(saveData.error || 'Errore salvataggio');
            }

            // Se è un nuovo prodotto (stockQuantity === 0), aggiungilo alla lista
            if (selectedProductForEdit.stockQuantity === 0) {
              const newProduct = {
                ...selectedProductForEdit,
                countedQuantity: data.quantity,
                difference: data.quantity,
                lot: data.lotName ? {
                  id: 0,
                  name: data.lotName,
                  expiration_date: data.expiryDate
                } : undefined
              };
              setLocationProducts(prev => [...prev, newProduct]);
            } else {
              // Aggiorna prodotto esistente
              setLocationProducts(prev => prev.map(p =>
                p.id === selectedProductForEdit.id
                  ? {
                      ...p,
                      countedQuantity: data.quantity,
                      difference: data.quantity - p.stockQuantity,
                      lot: data.lotName ? {
                        id: p.lot?.id || 0,
                        name: data.lotName,
                        expiration_date: data.expiryDate
                      } : p.lot
                    }
                  : p
              ));
            }

            toast.success(`✅ ${selectedProductForEdit.name} ${selectedProductForEdit.stockQuantity === 0 ? 'aggiunto' : 'aggiornato'}!`);
            setShowProductEditModal(false);
          } catch (error: any) {
            console.error('❌ Errore salvataggio:', error);
            toast.error('Errore salvataggio: ' + error.message);
          }
        }}
        onOpenCalculator={(currentValue) => {
          setCountedQuantity(currentValue);
          setShowCalculator(true);
        }}
        calculatorValue={countedQuantity}
      />

      {/* Connection Status */}
      <ConnectionStatus />

      {/* Mobile Home Button */}
      <MobileHomeButton />
    </div>
  );
} 
