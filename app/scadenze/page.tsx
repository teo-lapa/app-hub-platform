'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ArrowLeft, AlertTriangle, MapPin, Package, Clock, CheckCircle, Trash2, Bell, Search, X, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { ExpiryProductCard } from '@/components/scadenze/ExpiryProductCard';
import { UrgencyFilterBar } from '@/components/scadenze/UrgencyFilterBar';
import { WasteTransferModal } from '@/components/inventario/WasteTransferModal';
import { ProductManagementModal } from '@/components/maestro/ProductManagementModal';
import { VerificationRequestsModal } from '@/components/scadenze/VerificationRequestsModal';
import { ExpiryProduct } from '@/lib/types/expiry';
import toast from 'react-hot-toast';

// Configurazione warehouse disponibili
const WAREHOUSES = [
  { id: 1, name: 'EMBRACH', icon: '🏭' },
  { id: 2, name: 'PINGU', icon: '🐧' },
];

// Configurazione zone magazzino (da Gestione Ubicazioni)
const ZONES = [
  {
    id: 'frigo',
    name: 'FRIGO',
    icon: '❄️',
    bufferId: 28,
    gradient: 'from-cyan-400 to-cyan-600',
  },
  {
    id: 'secco',
    name: 'SECCO',
    icon: '📦',
    bufferId: 29,
    gradient: 'from-cyan-500 to-cyan-700',
  },
  {
    id: 'secco-sopra',
    name: 'SECCO SOPRA',
    icon: '📋',
    bufferId: 30,
    gradient: 'from-purple-500 to-purple-700',
  },
  {
    id: 'pingu',
    name: 'PINGU',
    icon: '🐧',
    bufferId: 31,
    gradient: 'from-orange-500 to-orange-700',
  },
];

export default function ScadenzePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Stati principali
  const [currentView, setCurrentView] = useState<'filter' | 'products' | 'zones'>('filter');
  const [selectedWarehouse, setSelectedWarehouse] = useState<number>(1); // Default: EMBRACH (ID 1)
  const [selectedUrgency, setSelectedUrgency] = useState<'expired' | 'expiring' | 'ok' | 'all' | 'no-movement-30' | 'no-movement-90' | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [products, setProducts] = useState<ExpiryProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ExpiryProduct | null>(null);

  // Conteggi
  const [urgencyCounts, setUrgencyCounts] = useState({
    expired: 0,
    expiring: 0,
    ok: 0,
    all: 0,
    'no-movement-30': 0,
    'no-movement-90': 0,
  });
  const [zoneCounts, setZoneCounts] = useState<Record<string, number>>({});

  // Stati UI
  const [loading, setLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showWasteTransferModal, setShowWasteTransferModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [urgentNoteInput, setUrgentNoteInput] = useState('');
  const [showUrgentNoteModal, setShowUrgentNoteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgentPriceInput, setUrgentPriceInput] = useState('');

  // Stati per prodotti in offerta
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerNoteInput, setOfferNoteInput] = useState('');
  const [offerPriceInput, setOfferPriceInput] = useState('');
  const [offerDiscountInput, setOfferDiscountInput] = useState('');

  // Stati per modal gestione
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [urgentProductsCount, setUrgentProductsCount] = useState(0);
  const [offerProductsCount, setOfferProductsCount] = useState(0);

  // Stati per richieste di verifica
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationRequestsCount, setVerificationRequestsCount] = useState(0);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);

  // Stati per prezzi dettagliati
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [productPrices, setProductPrices] = useState<{
    purchasePrice: number;
    listPrice: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    availableQuantity: number;
  } | null>(null);

  const checkConnection = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  // Carica conteggi per urgenza
  const loadCounts = async (warehouseId: number = selectedWarehouse) => {
    try {
      const response = await fetch(`/api/scadenze/counts?warehouseId=${warehouseId}`, {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setUrgencyCounts(data.counts.byUrgency);
        setZoneCounts(data.counts.byZone);
      }
    } catch (error) {
      console.error('Errore caricamento conteggi:', error);
      toast.error('Errore caricamento conteggi');
    }
  };

  // Carica conteggi prodotti urgenti e offerte
  const loadManagementCounts = async () => {
    try {
      const [urgentRes, offerRes, verificationRes] = await Promise.all([
        fetch('/api/urgent-products', { credentials: 'include' }),
        fetch('/api/offer-products', { credentials: 'include' }),
        fetch('/api/verification-requests', { credentials: 'include' })
      ]);

      const urgentData = await urgentRes.json();
      const offerData = await offerRes.json();
      const verificationData = await verificationRes.json();

      if (urgentData.success) {
        setUrgentProductsCount(urgentData.count || 0);
      }
      if (offerData.success) {
        setOfferProductsCount(offerData.count || 0);
      }
      if (verificationData.success) {
        setVerificationRequestsCount(verificationData.count || 0);
        setVerificationRequests(verificationData.requests || []);
      }
    } catch (error) {
      console.error('Errore caricamento conteggi gestione:', error);
    }
  };

  // Carica conteggi all'avvio
  useEffect(() => {
    checkConnection();
    loadCounts();
    loadManagementCounts();
  }, []);

  // Seleziona urgenza e mostra prodotti
  const handleSelectUrgency = async (urgency: 'expired' | 'expiring' | 'ok' | 'all' | 'no-movement-30' | 'no-movement-90') => {
    setSelectedUrgency(urgency);
    setCurrentView('products');
    setLoading(true);

    try {
      const response = await fetch(`/api/scadenze/products?urgency=${urgency}&days=7&warehouseId=${selectedWarehouse}`, {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setProducts(data.products || []);
        const urgencyLabels = {
          expired: 'SCADUTI',
          expiring: 'IN SCADENZA',
          ok: 'OK >7gg',
          all: 'TUTTI',
          'no-movement-30': 'FERMI 30GG',
          'no-movement-90': 'FERMI 3 MESI',
        };
        toast.success(`${urgencyLabels[urgency]}: ${data.products?.length || 0} prodotti`);
      } else {
        toast.error(data.error || 'Errore caricamento prodotti');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cambia warehouse e ricarica dati
  const handleWarehouseChange = async (warehouseId: number) => {
    setSelectedWarehouse(warehouseId);
    setSelectedZone(null); // Reset filtro zona
    await loadCounts(warehouseId);

    // Se siamo nella vista prodotti, ricarica anche i prodotti
    if (currentView === 'products' && selectedUrgency) {
      setLoading(true);
      try {
        const response = await fetch(`/api/scadenze/products?urgency=${selectedUrgency}&days=7&warehouseId=${warehouseId}`, {
          credentials: 'include',
        });
        const data = await response.json();
        if (data.success) {
          setProducts(data.products || []);
          toast.success(`Magazzino: ${WAREHOUSES.find(w => w.id === warehouseId)?.name}`);
        }
      } catch (error) {
        console.error('Errore cambio warehouse:', error);
      } finally {
        setLoading(false);
      }
    } else {
      toast.success(`Magazzino: ${WAREHOUSES.find(w => w.id === warehouseId)?.name}`);
    }
  };

  // Filtra prodotti per zona
  const handleFilterByZone = (zoneId: string | null) => {
    setSelectedZone(zoneId);
  };

  // Prodotti filtrati per zona e ricerca
  const filteredProducts = products
    .filter(p => !selectedZone || p.zoneId === selectedZone)
    .filter(p => {
      if (!searchQuery || searchQuery.length < 3) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.code?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.lotName?.toLowerCase().includes(query)
      );
    });

  // Click su card prodotto
  const handleProductClick = async (product: ExpiryProduct) => {
    setSelectedProduct(product);
    setShowProductModal(true);

    // Carica prezzi dettagliati
    await loadProductPrices(product.id);
  };

  // Carica prezzi dettagliati per un prodotto
  const loadProductPrices = async (productId: number) => {
    setLoadingPrices(true);
    setProductPrices(null);

    try {
      const response = await fetch(`/api/scadenze/product-prices?productId=${productId}`, {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success && data.prices) {
        setProductPrices(data.prices);
      } else {
        console.error('Errore caricamento prezzi:', data.error);
      }
    } catch (error) {
      console.error('Errore fetch prezzi:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  // Trasferisci a scarti
  const handleTransferToWaste = () => {
    setShowProductModal(false);
    setShowWasteTransferModal(true);
  };

  // Chiedi verifica
  const handleRequestVerification = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/verification-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          lotId: selectedProduct.lotId,
          lotName: selectedProduct.lotName,
          locationId: selectedProduct.locationId,
          locationName: selectedProduct.locationName,
          quantity: selectedProduct.quantity,
          expiryDate: selectedProduct.expirationDate,
          requestedBy: user?.email || 'unknown',
          note: `Richiesta verifica da scadenze - ${selectedProduct.name}`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('✅ Richiesta di verifica inviata');
        setShowProductModal(false);
      } else {
        toast.error(data.error || 'Errore durante richiesta');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Completa trasferimento scarti
  const handleWasteTransferComplete = () => {
    toast.success('✅ Prodotto trasferito a scarti');
    setShowWasteTransferModal(false);

    // Rimuovi da lista
    if (selectedProduct) {
      setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
    }

    // Ricarica conteggi
    loadCounts();
  };

  // Vendi Urgentemente - Mostra modal per nota
  const handleSellUrgently = () => {
    setShowProductModal(false);
    setUrgentNoteInput('');
    setShowUrgentNoteModal(true);
  };

  // Conferma aggiunta prodotto urgente
  const handleConfirmUrgent = async () => {
    if (!selectedProduct || !urgentNoteInput.trim()) {
      toast.error('La nota è obbligatoria');
      return;
    }

    try {
      const response = await fetch('/api/urgent-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productCode: selectedProduct.code,
          productBarcode: selectedProduct.barcode,
          image: selectedProduct.image,
          lotId: selectedProduct.lotId,
          lotName: selectedProduct.lotName,
          quantity: selectedProduct.quantity,
          uom: selectedProduct.uom,
          expirationDate: selectedProduct.expirationDate,
          daysUntilExpiry: selectedProduct.daysUntilExpiry,
          urgencyLevel: selectedProduct.urgencyLevel,
          locationId: selectedProduct.locationId,
          locationName: selectedProduct.locationName,
          zoneId: selectedProduct.zoneId,
          note: urgentNoteInput.trim(),
          addedBy: user?.email || 'unknown',
          estimatedValue: selectedProduct.estimatedValue,
          suggestedPrice: urgentPriceInput ? parseFloat(urgentPriceInput) : undefined
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('🔔 Prodotto aggiunto ai prodotti urgenti per i venditori!');
        setShowUrgentNoteModal(false);
        setUrgentNoteInput('');
        setUrgentPriceInput('');
      } else {
        toast.error(data.error || 'Errore durante aggiunta');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Metti in Offerta - Mostra modal per nota e prezzo
  const handlePutOnOffer = () => {
    setShowProductModal(false);
    setOfferNoteInput('');
    setOfferPriceInput('');
    setOfferDiscountInput('');
    setShowOfferModal(true);
  };

  // Conferma aggiunta prodotto in offerta
  const handleConfirmOffer = async () => {
    if (!selectedProduct || !offerNoteInput.trim()) {
      toast.error('La nota è obbligatoria');
      return;
    }

    try {
      const response = await fetch('/api/offer-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productCode: selectedProduct.code,
          productBarcode: selectedProduct.barcode,
          image: selectedProduct.image,
          lotId: selectedProduct.lotId,
          lotName: selectedProduct.lotName,
          quantity: selectedProduct.quantity,
          uom: selectedProduct.uom,
          locationId: selectedProduct.locationId,
          locationName: selectedProduct.locationName,
          zoneId: selectedProduct.zoneId,
          note: offerNoteInput.trim(),
          addedBy: user?.email || 'unknown',
          estimatedValue: selectedProduct.estimatedValue,
          offerPrice: offerPriceInput ? parseFloat(offerPriceInput) : undefined,
          discountPercentage: offerDiscountInput ? parseFloat(offerDiscountInput) : undefined
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('🏷️ Prodotto aggiunto alle offerte per i venditori!');
        setShowOfferModal(false);
        setOfferNoteInput('');
        setOfferPriceInput('');
        setOfferDiscountInput('');
      } else {
        toast.error(data.error || 'Errore durante aggiunta');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Torna indietro
  const handleBack = () => {
    if (currentView === 'products') {
      setCurrentView('filter');
      setSelectedUrgency(null);
      setSelectedZone(null);
      setProducts([]);
      loadCounts(); // Ricarica conteggi aggiornati
    } else {
      router.back();
    }
  };

  const getUrgencyLabel = () => {
    if (!selectedUrgency) return '';
    const labels = {
      expired: 'SCADUTI',
      expiring: 'IN SCADENZA (7gg)',
      ok: 'OK (>7gg)',
      all: 'TUTTI',
      'no-movement-30': 'FERMI 30 GIORNI',
      'no-movement-90': 'FERMI 3 MESI',
    };
    return labels[selectedUrgency];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AppHeader
        title="Controllo Scadenze"
        onBack={handleBack}
        showBackButton={currentView !== 'filter'}
      />

      <main className="container mx-auto p-4 max-w-7xl">
        {/* Vista: Selezione Urgenza */}
        {currentView === 'filter' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Selettore Warehouse */}
            <div className="flex justify-center gap-2 mb-4">
              {WAREHOUSES.map((warehouse) => (
                <button
                  key={warehouse.id}
                  onClick={() => handleWarehouseChange(warehouse.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
                    ${selectedWarehouse === warehouse.id
                      ? 'bg-blue-500 text-white'
                      : 'glass-strong text-slate-300 hover:bg-white/10'}`}
                >
                  <span>{warehouse.icon}</span>
                  <span>{warehouse.name}</span>
                </button>
              ))}
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                📅 Controllo Scadenze
              </h1>
              <p className="text-slate-400">
                Monitora i prodotti in scadenza nel magazzino {WAREHOUSES.find(w => w.id === selectedWarehouse)?.name}
              </p>
            </div>

            <UrgencyFilterBar
              counts={urgencyCounts}
              onSelect={handleSelectUrgency}
              onManagementClick={() => setShowManagementModal(true)}
              urgentCount={urgentProductsCount}
              offerCount={offerProductsCount}
              onVerificationClick={() => setShowVerificationModal(true)}
              verificationCount={verificationRequestsCount}
            />
          </motion.div>
        )}

        {/* Vista: Lista Prodotti */}
        {currentView === 'products' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Selettore Warehouse compatto */}
            <div className="flex gap-2 mb-4">
              {WAREHOUSES.map((warehouse) => (
                <button
                  key={warehouse.id}
                  onClick={() => handleWarehouseChange(warehouse.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1
                    ${selectedWarehouse === warehouse.id
                      ? 'bg-blue-500 text-white'
                      : 'glass-strong text-slate-300 hover:bg-white/10'}`}
                >
                  <span>{warehouse.icon}</span>
                  <span>{warehouse.name}</span>
                </button>
              ))}
            </div>

            {/* Header con filtri zona */}
            <div className="glass p-4 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{getUrgencyLabel()}</h2>
                  <p className="text-sm text-slate-400">
                    {filteredProducts.length} prodotti in {WAREHOUSES.find(w => w.id === selectedWarehouse)?.name}
                    {selectedZone && ` • ${ZONES.find(z => z.id === selectedZone)?.name}`}
                    {searchQuery.length >= 3 && ` • Ricerca: "${searchQuery}"`}
                  </p>
                </div>

                {/* Badge totale */}
                <div className="px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500">
                  <span className="font-bold text-blue-400">{filteredProducts.length}</span>
                </div>
              </div>

              {/* Barra di ricerca veloce */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca prodotto (min 3 caratteri)..."
                    className="w-full pl-10 pr-10 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 min-w-[48px] min-h-[48px] p-3 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {searchQuery.length > 0 && searchQuery.length < 3 && (
                  <p className="text-xs text-orange-400 mt-1 ml-1">
                    ⚠️ Inserisci almeno 3 caratteri per cercare
                  </p>
                )}
              </div>

              {/* Filtro zone */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => handleFilterByZone(null)}
                  className={`px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold whitespace-nowrap transition-all
                    ${!selectedZone
                      ? 'bg-blue-500 text-white'
                      : 'glass-strong text-slate-300 hover:bg-white/10'}`}
                >
                  🔍 Tutte
                </button>

                {ZONES.map((zone) => {
                  const zoneCount = products.filter(p => p.zoneId === zone.id).length;
                  if (zoneCount === 0) return null;

                  return (
                    <button
                      key={zone.id}
                      onClick={() => handleFilterByZone(zone.id)}
                      className={`px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold whitespace-nowrap transition-all
                        ${selectedZone === zone.id
                          ? `bg-gradient-to-br ${zone.gradient} text-white`
                          : 'glass-strong text-slate-300 hover:bg-white/10'}`}
                    >
                      {zone.icon} {zone.name} ({zoneCount})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Griglia prodotti */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="glass p-12 rounded-xl text-center">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-bold mb-2">Nessun prodotto trovato</h3>
                <p className="text-slate-400">
                  {selectedZone
                    ? 'Nessun prodotto in questa zona'
                    : 'Ottimo! Nessun prodotto in questa categoria'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {filteredProducts.map((product) => (
                  <ExpiryProductCard
                    key={`${product.id}-${product.lotId}-${product.locationId}`}
                    product={product}
                    onClick={() => handleProductClick(product)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Modal Dettaglio Prodotto */}
      <AnimatePresence>
        {showProductModal && selectedProduct && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowProductModal(false)}
                className="absolute top-4 right-4 min-w-[48px] min-h-[48px] rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
              >
                ✕
              </button>

              {/* Immagine prodotto */}
              <div className="w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-4 rounded-xl overflow-hidden">
                {selectedProduct.image ? (
                  <img
                    src={`data:image/png;base64,${selectedProduct.image}`}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-6xl">
                    📦
                  </div>
                )}
              </div>

              {/* Nome e codice */}
              <h2 className="text-2xl font-bold text-center mb-1">{selectedProduct.name}</h2>
              <p className="text-slate-400 text-center mb-6">COD: {selectedProduct.code}</p>

              {/* Info card */}
              <div className="glass p-4 rounded-lg space-y-3 mb-6">
                {/* Badge scadenza */}
                <div className={`px-4 py-2 rounded-lg text-center font-bold text-lg
                  ${selectedProduct.daysUntilExpiry < 0
                    ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                    : selectedProduct.daysUntilExpiry <= 7
                    ? 'bg-orange-500/20 text-orange-400 border-2 border-orange-500'
                    : 'bg-green-500/20 text-green-400 border-2 border-green-500'}`}>
                  {selectedProduct.daysUntilExpiry === 0
                    ? '🔴 SCADE OGGI'
                    : selectedProduct.daysUntilExpiry < 0
                    ? `🔴 SCADUTO ${Math.abs(selectedProduct.daysUntilExpiry)} giorni fa`
                    : `⏰ Scade tra ${selectedProduct.daysUntilExpiry} giorni`}
                </div>

                {/* Dettagli */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400">Data Scadenza:</span>
                    <span className="font-semibold">
                      {new Date(selectedProduct.expirationDate).toLocaleDateString('it-IT')}
                    </span>
                  </div>

                  {selectedProduct.lotName && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-orange-400" />
                      <span className="text-slate-400">Lotto:</span>
                      <span className="font-semibold text-orange-400">{selectedProduct.lotName}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-green-400" />
                    <span className="text-slate-400">Quantità:</span>
                    <span className="font-semibold text-green-400">
                      {selectedProduct.quantity} {selectedProduct.uom}
                    </span>
                  </div>

                  {selectedProduct.estimatedValue && selectedProduct.estimatedValue > 0 && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-yellow-400" />
                      <span className="text-slate-400">Valore Stimato:</span>
                      <span className="font-semibold text-yellow-400">
                        CHF {selectedProduct.estimatedValue.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div>
                      <span className="text-slate-400">Ubicazione:</span>
                      <p className="font-semibold">{selectedProduct.locationName}</p>
                      <p className="text-xs text-slate-500">{selectedProduct.locationCompleteName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Azioni */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg mb-3">Azioni Disponibili</h3>

                {/* Trasferisci a scarti */}
                <button
                  onClick={handleTransferToWaste}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-red-500/20 transition-all
                           flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Trasferisci a Scarti</div>
                      <div className="text-xs text-slate-400">Prodotto non più vendibile</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Chiedi Verifica */}
                <button
                  onClick={handleRequestVerification}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-purple-500/20 transition-all
                           flex items-center justify-between group border-2 border-purple-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-purple-400">Chiedi Verifica</div>
                      <div className="text-xs text-slate-400">Richiedi controllo fisico inventario</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-purple-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Vendi Urgentemente */}
                <button
                  onClick={handleSellUrgently}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-orange-500/20 transition-all
                           flex items-center justify-between group border-2 border-orange-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-orange-400">Vendi Urgentemente</div>
                      <div className="text-xs text-slate-400">Notifica ai venditori per vendita rapida</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-orange-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Metti in Offerta */}
                <button
                  onClick={handlePutOnOffer}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-blue-500/20 transition-all
                           flex items-center justify-between group border-2 border-blue-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-blue-400">Metti in Offerta</div>
                      <div className="text-xs text-slate-400">Promuovi prodotto con prezzo speciale</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Trasferimento Scarti */}
      {showWasteTransferModal && selectedProduct && (
        <WasteTransferModal
          isOpen={showWasteTransferModal}
          onClose={() => setShowWasteTransferModal(false)}
          onSuccess={handleWasteTransferComplete}
        />
      )}

      {/* Modal Nota Prodotto Urgente */}
      <AnimatePresence>
        {showUrgentNoteModal && selectedProduct && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUrgentNoteModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-8 h-8 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Vendi Urgentemente</h2>
                <p className="text-slate-400 text-sm">
                  Aggiungi una nota per i venditori su questo prodotto
                </p>
              </div>

              {/* Prodotto info */}
              <div className="glass p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  {selectedProduct.image ? (
                    <img
                      src={`data:image/png;base64,${selectedProduct.image}`}
                      alt={selectedProduct.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center text-2xl">
                      📦
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{selectedProduct.name}</h3>
                    <p className="text-xs text-slate-400">
                      {selectedProduct.quantity} {selectedProduct.uom} • Scade tra {selectedProduct.daysUntilExpiry}gg
                    </p>
                  </div>
                </div>
              </div>

              {/* Informazioni Prezzi */}
              {loadingPrices ? (
                <div className="glass p-4 rounded-lg mb-4">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
                    <span className="ml-2 text-sm text-slate-400">Caricamento prezzi...</span>
                  </div>
                </div>
              ) : productPrices ? (
                <div className="glass p-4 rounded-lg mb-4 space-y-2">
                  <h4 className="font-semibold text-sm mb-3 text-orange-400">📊 Informazioni Prezzi</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">💰 Prezzo d'acquisto:</span>
                      <p className="font-semibold text-yellow-400">CHF {productPrices.purchasePrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">📦 Quantità disponibile:</span>
                      <p className="font-semibold text-green-400">{productPrices.availableQuantity.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">⬇️ Prezzo minimo:</span>
                      <p className="font-semibold">CHF {productPrices.minPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">⬆️ Prezzo massimo:</span>
                      <p className="font-semibold">CHF {productPrices.maxPrice.toFixed(2)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">📊 Prezzo medio:</span>
                      <p className="font-semibold text-blue-400">CHF {productPrices.avgPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Textarea nota */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Nota per i venditori *
                </label>
                <textarea
                  value={urgentNoteInput}
                  onChange={(e) => setUrgentNoteInput(e.target.value)}
                  placeholder="Es: Scade tra 3 giorni, vendere con sconto 20%"
                  className="w-full glass p-3 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={4}
                  maxLength={200}
                />
                <div className="text-xs text-slate-500 mt-1 text-right">
                  {urgentNoteInput.length}/200
                </div>
              </div>

              {/* Prezzo suggerito vendita */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">
                  Prezzo Suggerito Vendita (CHF)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">CHF</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={urgentPriceInput}
                    onChange={(e) => setUrgentPriceInput(e.target.value)}
                    placeholder="Es: 15.90"
                    className="w-full pl-14 pr-3 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedProduct.estimatedValue && selectedProduct.estimatedValue > 0 && (
                    <span>Valore stimato: CHF {selectedProduct.estimatedValue.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUrgentNoteModal(false)}
                  className="flex-1 glass-strong p-3 min-h-[48px] rounded-lg hover:bg-white/5 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmUrgent}
                  disabled={!urgentNoteInput.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 disabled:text-slate-500 p-3 min-h-[48px] rounded-lg font-semibold transition-all"
                >
                  Conferma
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Gestione Urgenti/Offerte */}
      <ProductManagementModal
        isOpen={showManagementModal}
        onClose={() => {
          setShowManagementModal(false);
          // Ricarica conteggi quando si chiude il modal
          loadManagementCounts();
        }}
      />

      {/* Modal Richieste di Verifica */}
      <VerificationRequestsModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        requests={verificationRequests}
        onRefresh={loadManagementCounts}
      />

      {/* Modal Metti in Offerta */}
      <AnimatePresence>
        {showOfferModal && selectedProduct && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowOfferModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Tag className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Metti in Offerta</h2>
                <p className="text-slate-400 text-sm">
                  Aggiungi questo prodotto alle offerte per i venditori
                </p>
              </div>

              {/* Prodotto info */}
              <div className="glass p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  {selectedProduct.image ? (
                    <img
                      src={`data:image/png;base64,${selectedProduct.image}`}
                      alt={selectedProduct.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center text-2xl">
                      📦
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{selectedProduct.name}</h3>
                    <p className="text-xs text-slate-400">
                      {selectedProduct.quantity} {selectedProduct.uom}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informazioni Prezzi */}
              {loadingPrices ? (
                <div className="glass p-4 rounded-lg mb-4">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                    <span className="ml-2 text-sm text-slate-400">Caricamento prezzi...</span>
                  </div>
                </div>
              ) : productPrices ? (
                <div className="glass p-4 rounded-lg mb-4 space-y-2">
                  <h4 className="font-semibold text-sm mb-3 text-blue-400">📊 Informazioni Prezzi</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">💰 Prezzo d'acquisto:</span>
                      <p className="font-semibold text-yellow-400">CHF {productPrices.purchasePrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">📦 Quantità disponibile:</span>
                      <p className="font-semibold text-green-400">{productPrices.availableQuantity.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">⬇️ Prezzo minimo:</span>
                      <p className="font-semibold">CHF {productPrices.minPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">⬆️ Prezzo massimo:</span>
                      <p className="font-semibold">CHF {productPrices.maxPrice.toFixed(2)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">📊 Prezzo medio:</span>
                      <p className="font-semibold text-blue-400">CHF {productPrices.avgPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Textarea nota */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Descrizione Offerta *
                </label>
                <textarea
                  value={offerNoteInput}
                  onChange={(e) => setOfferNoteInput(e.target.value)}
                  placeholder="Es: Offerta speciale -20%, disponibilità limitata"
                  className="w-full glass p-3 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  maxLength={200}
                />
                <div className="text-xs text-slate-500 mt-1 text-right">
                  {offerNoteInput.length}/200
                </div>
              </div>

              {/* Prezzo offerta */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Prezzo Offerta (CHF)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">CHF</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={offerPriceInput}
                    onChange={(e) => setOfferPriceInput(e.target.value)}
                    placeholder="Es: 12.90"
                    className="w-full pl-14 pr-3 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedProduct.estimatedValue && selectedProduct.estimatedValue > 0 && (
                    <span>Valore stimato: CHF {selectedProduct.estimatedValue.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Percentuale sconto */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">
                  Sconto (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={offerDiscountInput}
                    onChange={(e) => setOfferDiscountInput(e.target.value)}
                    placeholder="Es: 20"
                    className="w-full pr-8 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 glass-strong p-3 min-h-[48px] rounded-lg hover:bg-white/5 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmOffer}
                  disabled={!offerNoteInput.trim()}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 p-3 min-h-[48px] rounded-lg font-semibold transition-all"
                >
                  Conferma
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
