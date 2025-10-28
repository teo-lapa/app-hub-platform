'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ArrowLeft, AlertTriangle, MapPin, Package, Clock, CheckCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { ExpiryProductCard } from '@/components/scadenze/ExpiryProductCard';
import { UrgencyFilterBar } from '@/components/scadenze/UrgencyFilterBar';
import { WasteTransferModal } from '@/components/inventario/WasteTransferModal';
import { ExpiryProduct } from '@/lib/types/expiry';
import toast from 'react-hot-toast';

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
  const [selectedUrgency, setSelectedUrgency] = useState<'expired' | 'expiring' | 'ok' | 'all' | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [products, setProducts] = useState<ExpiryProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ExpiryProduct | null>(null);

  // Conteggi
  const [urgencyCounts, setUrgencyCounts] = useState({
    expired: 0,
    expiring: 0,
    ok: 0,
    all: 0,
  });
  const [zoneCounts, setZoneCounts] = useState<Record<string, number>>({});

  // Stati UI
  const [loading, setLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showWasteTransferModal, setShowWasteTransferModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  // Carica conteggi all'avvio
  useEffect(() => {
    checkConnection();
    loadCounts();
  }, []);

  const checkConnection = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  // Carica conteggi per urgenza
  const loadCounts = async () => {
    try {
      const response = await fetch('/api/scadenze/counts', {
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

  // Seleziona urgenza e mostra prodotti
  const handleSelectUrgency = async (urgency: 'expired' | 'expiring' | 'ok' | 'all') => {
    setSelectedUrgency(urgency);
    setCurrentView('products');
    setLoading(true);

    try {
      const response = await fetch(`/api/scadenze/products?urgency=${urgency}&days=7`, {
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

  // Filtra prodotti per zona
  const handleFilterByZone = (zoneId: string | null) => {
    setSelectedZone(zoneId);
  };

  // Prodotti filtrati per zona
  const filteredProducts = selectedZone
    ? products.filter(p => p.zoneId === selectedZone)
    : products;

  // Click su card prodotto
  const handleProductClick = (product: ExpiryProduct) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  // Trasferisci a scarti
  const handleTransferToWaste = () => {
    setShowProductModal(false);
    setShowWasteTransferModal(true);
  };

  // Marca come verificato
  const handleMarkAsReviewed = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/scadenze/mark-reviewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          lotId: selectedProduct.lotId,
          locationId: selectedProduct.locationId,
          reviewedBy: user?.email || 'unknown',
          note: 'Verificato fisicamente',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('✅ Prodotto marcato come verificato');
        setShowProductModal(false);

        // Rimuovi da lista se necessario
        setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
      } else {
        toast.error(data.error || 'Errore durante verifica');
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
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                📅 Controllo Scadenze
              </h1>
              <p className="text-slate-400">
                Monitora i prodotti in scadenza nel magazzino
              </p>
            </div>

            <UrgencyFilterBar
              counts={urgencyCounts}
              onSelect={handleSelectUrgency}
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
            {/* Header con filtri zona */}
            <div className="glass p-4 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{getUrgencyLabel()}</h2>
                  <p className="text-sm text-slate-400">
                    {filteredProducts.length} prodotti
                    {selectedZone && ` in ${ZONES.find(z => z.id === selectedZone)?.name}`}
                  </p>
                </div>

                {/* Badge totale */}
                <div className="px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500">
                  <span className="font-bold text-blue-400">{filteredProducts.length}</span>
                </div>
              </div>

              {/* Filtro zone */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => handleFilterByZone(null)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all
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
                      className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all
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
              className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowProductModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
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

                {/* Marca come verificato */}
                <button
                  onClick={handleMarkAsReviewed}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-green-500/20 transition-all
                           flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Marca come Verificato</div>
                      <div className="text-xs text-slate-400">Controllo fisico completato</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-slate-400 group-hover:translate-x-1 transition-transform" />
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
    </div>
  );
}
