'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, MapPin, ArrowRight, Warehouse, Camera, Search, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/inventario/QRScanner';
import { ProductSearch } from '@/components/inventario/ProductSearch';
import toast from 'react-hot-toast';

// Configurazione zone magazzino
const ZONES = [
  {
    id: 'secco',
    name: 'SECCO',
    icon: '📦',
    description: 'Prodotti non deperibili',
    bufferId: 29,
    bufferName: 'Secco-01',
    gradient: 'from-cyan-500 to-cyan-700',
    count: 0
  },
  {
    id: 'secco-sopra',
    name: 'SECCO SOPRA',
    icon: '📋',
    description: 'Scaffalatura superiore',
    bufferId: 30,
    bufferName: 'Secco Sopra-02',
    gradient: 'from-purple-500 to-purple-700',
    count: 0
  },
  {
    id: 'pingu',
    name: 'PINGU',
    icon: '🐧',
    description: 'Area refrigerata speciale',
    bufferId: 31,
    bufferName: 'Pingu-01',
    gradient: 'from-orange-500 to-orange-700',
    count: 0
  },
  {
    id: 'frigo',
    name: 'FRIGO',
    icon: '❄️',
    description: 'Prodotti refrigerati',
    bufferId: 28,
    bufferName: 'Frigo-01',
    gradient: 'from-cyan-400 to-cyan-600',
    count: 0
  }
];

interface BufferProduct {
  id: number;
  name: string;
  code: string;
  barcode: string;
  image?: string;
  quantity: number;
  uom: string;
  lot_id?: number;
  lot_name?: string;
  expiration_date?: string;
}

export default function UbicazioniPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Stati principali
  const [currentOperation, setCurrentOperation] = useState<'buffer' | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [bufferProducts, setBufferProducts] = useState<BufferProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<BufferProduct | null>(null);
  const [zoneCounts, setZoneCounts] = useState<Record<string, number>>({});

  // Stati form
  const [productCode, setProductCode] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [locationCode, setLocationCode] = useState('');
  const [locationData, setLocationData] = useState<any>(null);
  const [isFromCatalog, setIsFromCatalog] = useState(false); // Modalità: buffer o catalogo
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [showLocationScanner, setShowLocationScanner] = useState(false);

  const productInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkConnection();
    loadBufferCounts();
  }, []);

  const checkConnection = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  const loadBufferCounts = async () => {
    try {
      const counts: Record<string, number> = {};

      for (const zone of ZONES) {
        const response = await fetch('/api/ubicazioni/buffer-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ locationId: zone.bufferId })
        });

        const data = await response.json();
        if (data.success) {
          counts[zone.id] = data.count || 0;
        }
      }

      setZoneCounts(counts);
    } catch (error) {
      console.error('Errore caricamento contatori:', error);
    }
  };

  const selectOperation = () => {
    setCurrentOperation('buffer');
  };

  const selectZone = async (zoneId: string) => {
    const zone = ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    setSelectedZone(zoneId);
    setLoading(true);

    try {
      // Carica prodotti nel buffer di questa zona
      const response = await fetch('/api/ubicazioni/buffer-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locationId: zone.bufferId })
      });

      const data = await response.json();
      if (data.success) {
        setBufferProducts(data.products || []);
        toast.success(`Zona ${zone.name}: ${data.products?.length || 0} prodotti da sistemare`);
      } else {
        toast.error(data.error || 'Errore caricamento prodotti');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProductScan = async (code: string) => {
    if (!code || !selectedZone) return;

    const zone = ZONES.find(z => z.id === selectedZone);
    if (!zone) return;

    setLoading(true);

    try {
      // Cerca il prodotto nel buffer di questa zona
      const response = await fetch('/api/ubicazioni/find-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code,
          locationId: zone.bufferId
        })
      });

      const data = await response.json();

      if (data.success && data.product) {
        setSelectedProduct(data.product);
        setLotNumber(data.product.lot_name || '');
        // Converti la data da formato Odoo (YYYY-MM-DD HH:MM:SS) a YYYY-MM-DD per input date
        const expiryDateStr = data.product.expiration_date ? data.product.expiration_date.split(' ')[0] : '';
        setExpiryDate(expiryDateStr);
        setQuantity(data.product.quantity?.toString() || '1');
        toast.success(`Prodotto trovato: ${data.product.name}`);

        // Focus automatico sul campo ubicazione
        setTimeout(() => locationInputRef.current?.focus(), 300);
      } else {
        toast.error('Prodotto non trovato nel buffer di questa zona');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
      setProductCode('');
    }
  };

  const handleProductSelectFromCatalog = (product: any) => {
    // Prodotto selezionato dal catalogo (non dal buffer)
    setSelectedProduct({
      id: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode || '',
      image: product.image,
      quantity: 1,
      uom: product.uom || 'PZ',
      lot_id: undefined, // Non ha lotto ancora
      lot_name: undefined,
      expiration_date: undefined
    });

    setIsFromCatalog(true);
    setLotNumber(''); // Reset campi
    setExpiryDate('');
    setQuantity('1');
    toast.success(`Prodotto selezionato: ${product.name}`);

    // Focus su campo lotto
    setTimeout(() => {
      const lotInput = document.querySelector('input[placeholder*="lotto"]') as HTMLInputElement;
      if (lotInput) lotInput.focus();
    }, 300);
  };

  const handleLocationScan = async (code: string) => {
    if (!code) return;

    setLoading(true);

    try {
      const response = await fetch('/api/inventory/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locationCode: code })
      });

      const data = await response.json();

      if (data.success && data.location) {
        setLocationData(data.location);
        toast.success(`Ubicazione: ${data.location.complete_name}`);
      } else {
        toast.error('Ubicazione non trovata');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
      setLocationCode('');
    }
  };

  const checkProductInLocation = async (productId: number, locationId: number): Promise<boolean> => {
    try {
      const response = await fetch('/api/ubicazioni/check-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, locationId })
      });

      const data = await response.json();
      return data.success && data.exists;
    } catch (error) {
      console.error('Errore verifica prodotto:', error);
      return false;
    }
  };

  const confirmTransfer = async () => {
    if (!selectedProduct || !locationData) {
      toast.error('Compila tutti i campi');
      return;
    }

    // Il lotto non è più obbligatorio - può essere vuoto per prodotti senza tracking

    // Per prodotti dal catalogo, la scadenza è obbligatoria solo se c'è il lotto
    if (isFromCatalog && lotNumber.trim() && !expiryDate) {
      toast.error('La scadenza è obbligatoria quando si specifica un lotto');
      return;
    }

    // Per prodotti dal buffer con lotto, il lot_id deve esistere
    if (!isFromCatalog && lotNumber.trim() && !selectedProduct.lot_id) {
      toast.error('Lotto ID mancante - riprova la selezione del prodotto');
      return;
    }

    setLoading(true);

    try {
      // VERIFICA: Controlla se il prodotto esiste già nell'ubicazione
      const exists = await checkProductInLocation(selectedProduct.id, locationData.id);

      if (exists) {
        setLoading(false);
        setShowBlockModal(true); // Mostra popup di blocco
        return;
      }

      // Determina source location
      const zone = ZONES.find(z => z.id === selectedZone);
      const sourceLocationId = isFromCatalog ? 8 : (zone?.bufferId || 8); // 8 = Virtual Locations/Stock se catalogo

      const response = await fetch('/api/ubicazioni/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          sourceLocationId,
          destLocationId: locationData.id,
          quantity: parseFloat(quantity),
          lotName: lotNumber,
          lotId: selectedProduct.lot_id, // undefined per prodotti dal catalogo
          expiryDate: expiryDate || null,
          isFromCatalog
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Trasferimento completato!');

        // Reset form
        setSelectedProduct(null);
        setLocationData(null);
        setLotNumber('');
        setExpiryDate('');
        setQuantity('1');
        setIsFromCatalog(false);

        // Ricarica prodotti buffer se necessario
        if (selectedZone) {
          await selectZone(selectedZone);
          await loadBufferCounts();
        }

        // Focus su scanner prodotto
        setTimeout(() => productInputRef.current?.focus(), 300);
      } else {
        toast.error(data.error || 'Errore trasferimento');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const backToOperationSelection = () => {
    setCurrentOperation(null);
    setSelectedZone(null);
    setSelectedProduct(null);
    setLocationData(null);
    setBufferProducts([]);
  };

  const backToZoneSelection = () => {
    setSelectedZone(null);
    setSelectedProduct(null);
    setLocationData(null);
    setBufferProducts([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AppHeader
        title="Gestione Ubicazioni"
        subtitle="Buffer → Ubicazioni"
        icon={<Warehouse className="h-8 w-8 text-white" />}
        showHomeButton={true}
        showBackButton={false}
        rightElement={
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            connectionStatus === 'connected'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            <span className="text-sm font-medium">
              {connectionStatus === 'connected' ? 'Connesso' : 'Non connesso'}
            </span>
          </div>
        }
      />

      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-strong p-6 rounded-xl">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-center">Caricamento...</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Selezione Operazione */}
        {!currentOperation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-3xl p-8 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={selectOperation}
          >
            <div className="relative">
              <div className="absolute -top-4 -right-4 bg-red-500 text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg">
                {Object.values(zoneCounts).reduce((a, b) => a + b, 0)}
              </div>

              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl flex items-center justify-center text-4xl">
                📥
              </div>

              <h2 className="text-2xl font-bold text-center mb-3">
                Buffer → Ubicazioni
              </h2>

              <p className="text-muted-foreground text-center">
                Trasferisci prodotti dal buffer di ricevimento alle ubicazioni di stoccaggio
              </p>
            </div>
          </motion.div>
        )}

        {/* Selezione Zona */}
        {currentOperation && !selectedZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              onClick={backToOperationSelection}
              className="mb-6 glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
            >
              ← Torna indietro
            </button>

            <h2 className="text-3xl font-bold text-center mb-3">
              🏭 Seleziona la Zona di Lavoro
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Scegli la zona del magazzino dove vuoi operare
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ZONES.map((zone) => (
                <motion.div
                  key={zone.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  className={`relative glass-strong rounded-2xl p-8 cursor-pointer bg-gradient-to-br ${zone.gradient}`}
                  onClick={() => selectZone(zone.id)}
                >
                  {zoneCounts[zone.id] > 0 && (
                    <div className="absolute top-4 right-4 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full font-bold text-lg">
                      {zoneCounts[zone.id]}
                    </div>
                  )}

                  <div className="text-6xl mb-4 text-center">
                    {zone.icon}
                  </div>

                  <h3 className="text-2xl font-bold text-center mb-2 text-white">
                    {zone.name}
                  </h3>

                  <p className="text-center text-white/90">
                    {zone.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Workflow Principale */}
        {selectedZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              onClick={backToZoneSelection}
              className="mb-6 glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
            >
              ← Torna alla selezione zona
            </button>

            {/* Griglia prodotti buffer */}
            {bufferProducts.length > 0 && (
              <div className="glass-strong rounded-xl p-6 mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Package className="w-6 h-6 text-blue-400" />
                  Prodotti disponibili in {ZONES.find(z => z.id === selectedZone)?.bufferName}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {bufferProducts.map((product) => (
                    <div
                      key={`${product.id}-${product.lot_name}`}
                      className="glass p-3 rounded-xl cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => {
                        // Seleziona direttamente il prodotto dalla griglia
                        setSelectedProduct(product);
                        setLotNumber(product.lot_name || '');
                        const expiryDateStr = product.expiration_date ? product.expiration_date.split(' ')[0] : '';
                        setExpiryDate(expiryDateStr);
                        setQuantity(product.quantity?.toString() || '1');
                        setIsFromCatalog(false);
                        toast.success(`Prodotto selezionato: ${product.name}`);

                        // Focus automatico sul campo ubicazione
                        setTimeout(() => locationInputRef.current?.focus(), 300);
                      }}
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg mb-2 mx-auto"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-700 rounded-lg mb-2 flex items-center justify-center mx-auto">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}

                      <div className="text-sm font-semibold line-clamp-2 mb-1">
                        {product.name}
                      </div>

                      <div className="text-xs text-muted-foreground mb-1">
                        {product.code}
                      </div>

                      <div className="text-sm font-bold text-green-400">
                        {product.quantity} {product.uom}
                      </div>

                      {product.expiration_date && (
                        <div className="text-xs text-orange-400 mt-1">
                          Scad: {new Date(product.expiration_date).toLocaleDateString('it-IT')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form principale */}
            <div className="glass-strong rounded-xl p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-400" />
                Gestione Prodotto
              </h3>

              {/* Step 1: Scanner prodotto */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3 text-blue-400">
                  1️⃣ Trova il Prodotto
                </h4>

                <div className="flex gap-3 mb-3">
                  <input
                    ref={productInputRef}
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleProductScan(productCode);
                      }
                    }}
                    placeholder="Scansiona o digita il codice prodotto..."
                    className="flex-1 glass px-4 py-3 rounded-xl border-2 border-white/20 focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <button
                  onClick={() => setShowProductSearch(true)}
                  className="w-full glass-strong px-4 py-3 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Oppure cerca dal catalogo prodotti</span>
                </button>
              </div>

              {/* Prodotto selezionato */}
              {selectedProduct && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass p-6 rounded-xl mb-6"
                >
                  <div className="flex gap-4">
                    <div>
                      {selectedProduct.image ? (
                        <img
                          src={selectedProduct.image}
                          alt={selectedProduct.name}
                          className="w-32 h-32 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-32 h-32 bg-gray-700 rounded-lg flex items-center justify-center">
                          <Package className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h4 className="text-xl font-bold mb-2">{selectedProduct.name}</h4>
                      <p className="text-muted-foreground mb-4">
                        Codice: {selectedProduct.code}
                        {isFromCatalog && <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">📚 Dal Catalogo</span>}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-muted-foreground mb-2">
                            LOTTO
                          </label>
                          <input
                            type="text"
                            value={lotNumber}
                            onChange={(e) => setLotNumber(e.target.value)}
                            placeholder="Numero lotto (opzionale)"
                            className="w-full glass px-4 py-2 rounded-lg border-2 border-white/20 focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-muted-foreground mb-2">
                            SCADENZA {isFromCatalog && '*'}
                          </label>
                          <input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className={`w-full glass px-4 py-2 rounded-lg border-2 focus:outline-none ${
                              isFromCatalog
                                ? 'border-yellow-500/50 focus:border-yellow-500'
                                : 'border-white/20 focus:border-blue-500'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-muted-foreground mb-2">
                            QUANTITÀ
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              className="flex-1 glass px-4 py-2 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                            />
                            <span className="glass px-4 py-2 rounded-lg font-semibold">
                              {selectedProduct.uom}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Scanner ubicazione */}
              {selectedProduct && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-blue-400">
                    2️⃣ Ubicazione di Destinazione
                  </h4>

                  <div className="flex gap-3">
                    <input
                      ref={locationInputRef}
                      type="text"
                      value={locationCode}
                      onChange={(e) => setLocationCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleLocationScan(locationCode);
                        }
                      }}
                      placeholder="Scansiona il codice ubicazione..."
                      className="flex-1 glass px-4 py-3 rounded-xl border-2 border-white/20 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => setShowLocationScanner(true)}
                      className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="hidden sm:inline">Camera</span>
                    </button>
                  </div>

                  {locationData && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 glass p-4 rounded-lg border-l-4 border-blue-500"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-400" />
                        <span className="font-semibold">Ubicazione Selezionata:</span>
                      </div>
                      <div className="text-lg font-bold mt-1">
                        {locationData.complete_name || locationData.name}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Pulsante conferma */}
              {selectedProduct && locationData && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={confirmTransfer}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                >
                  ✅ CONFERMA TRASFERIMENTO
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* QR Scanner per ubicazioni */}
      <QRScanner
        isOpen={showLocationScanner}
        onClose={() => setShowLocationScanner(false)}
        onScan={(code) => {
          setShowLocationScanner(false);
          setLocationCode(code);
          handleLocationScan(code);
        }}
        title="Scanner Ubicazione"
      />

      {/* Ricerca prodotti dal catalogo */}
      <ProductSearch
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelectProduct={handleProductSelectFromCatalog}
        currentLocationName={locationData?.complete_name || locationData?.name}
      />

      {/* Modal di blocco - prodotto già esistente */}
      <AnimatePresence>
        {showBlockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setShowBlockModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-strong rounded-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>

                <h3 className="text-2xl font-bold mb-3">⚠️ Prodotto Già Presente</h3>

                <p className="text-muted-foreground mb-6">
                  Questo prodotto esiste già in questa ubicazione.
                  <br />
                  <strong className="text-white">Scegli un'altra ubicazione</strong> per completare il trasferimento.
                </p>

                <button
                  onClick={() => setShowBlockModal(false)}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-3 px-6 rounded-xl font-bold transition-all"
                >
                  Ho Capito
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
