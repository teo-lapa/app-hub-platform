'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, MapPin, ArrowRight, Warehouse, Camera, Search, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/inventario/QRScanner';
import { ProductSearch } from '@/components/inventario/ProductSearch';
import { Calculator } from '@/components/inventario/Calculator';
import { WasteTransferModal } from '@/components/inventario/WasteTransferModal';
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
  supplier_id?: number | null;
  supplier_name?: string | null;
}

export default function UbicazioniPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Stati principali
  const [currentOperation, setCurrentOperation] = useState<'buffer' | 'sposta' | 'rientro' | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [bufferProducts, setBufferProducts] = useState<BufferProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<BufferProduct | null>(null);
  const [zoneCounts, setZoneCounts] = useState<Record<string, number>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');

  // Stati form
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [locationCode, setLocationCode] = useState('');
  const [locationData, setLocationData] = useState<any>(null);
  const [isFromCatalog, setIsFromCatalog] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showWasteTransferModal, setShowWasteTransferModal] = useState(false);

  // Stati spostamento ubicazione → ubicazione
  const [sourceLocationCode, setSourceLocationCode] = useState('');
  const [sourceLocationData, setSourceLocationData] = useState<any>(null);
  const [sourceProducts, setSourceProducts] = useState<BufferProduct[]>([]);
  const [showSourceScanner, setShowSourceScanner] = useState(false);

  const locationInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

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
      // Carica tutti i counts in parallelo per velocizzare
      const countPromises = ZONES.map(async (zone) => {
        const response = await fetch('/api/ubicazioni/buffer-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ locationId: zone.bufferId })
        });
        const data = await response.json();
        return { zoneId: zone.id, count: data.success ? (data.count || 0) : 0 };
      });

      const results = await Promise.all(countPromises);
      const counts: Record<string, number> = {};
      results.forEach(({ zoneId, count }) => {
        counts[zoneId] = count;
      });

      setZoneCounts(counts);
    } catch (error) {
      console.error('Errore caricamento contatori:', error);
    }
  };

  const selectOperation = (op: 'buffer' | 'sposta' | 'rientro' = 'buffer') => {
    setCurrentOperation(op);
  };

  // Seleziona il buffer di destinazione (Ubicazione → Buffer)
  const selectBufferDest = (zone: typeof ZONES[number]) => {
    setLocationData({ id: zone.bufferId, name: zone.bufferName, complete_name: zone.bufferName });
    toast.success(`Buffer: ${zone.bufferName}`);
  };

  // Mappa un item dell'inventario (endpoint /api/inventory/location) nello shape BufferProduct
  const mapInventoryItem = (it: any): BufferProduct => ({
    id: it.product_id,
    name: it.product_name,
    code: it.default_code || '',
    barcode: it.barcode || '',
    image: it.image_128 ? `data:image/jpeg;base64,${it.image_128}` : undefined,
    quantity: it.quantity || 0,
    uom: it.uom_id ? it.uom_id[1] : 'PZ',
    lot_id: it.lot_id || undefined,
    lot_name: it.lot_name || undefined,
    expiration_date: it.lot_expiration_date || undefined
  });

  // Carica ubicazione di PARTENZA + prodotti presenti
  const loadSourceLocation = async (code: string) => {
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
        setSourceLocationData(data.location);
        const items = (data.inventory || [])
          .filter((it: any) => !it._catalog_item && (it.quantity || 0) > 0)
          .map(mapInventoryItem);
        setSourceProducts(items);
        // reset selezione precedente
        setSelectedProduct(null);
        setLocationData(null);
        toast.success(`Partenza: ${data.location.complete_name} — ${items.length} prodotti`);
      } else {
        toast.error('Ubicazione non trovata');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
      setSourceLocationCode('');
    }
  };

  // Conferma spostamento ubicazione → ubicazione
  const confirmSposta = async () => {
    if (!selectedProduct || !sourceLocationData || !locationData) {
      toast.error('Compila tutti i campi');
      return;
    }
    if (sourceLocationData.id === locationData.id) {
      toast.error('Partenza e destinazione coincidono');
      return;
    }
    if (parseFloat(quantity) > selectedProduct.quantity) {
      toast.error(`Quantità massima disponibile: ${selectedProduct.quantity}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ubicazioni/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          sourceLocationId: sourceLocationData.id,
          destLocationId: locationData.id,
          quantity: parseFloat(quantity),
          lotName: lotNumber,
          lotId: selectedProduct.lot_id,
          expiryDate: expiryDate || null,
          isFromCatalog: false
        })
      });
      const data = await response.json();

      if (data.success) {
        toast.success('✅ Spostamento completato!');
        const reloadCode = sourceLocationData.barcode || sourceLocationData.name;
        setSelectedProduct(null);
        setLocationData(null);
        setLotNumber('');
        setExpiryDate('');
        setQuantity('1');
        if (reloadCode) await loadSourceLocation(reloadCode);
      } else {
        toast.error(data.error || 'Errore spostamento');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
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
    setSourceLocationData(null);
    setSourceProducts([]);
    setSourceLocationCode('');
  };

  const backToZoneSelection = () => {
    setSelectedZone(null);
    setSelectedProduct(null);
    setLocationData(null);
    setBufferProducts([]);
    setSelectedSupplier('ALL');
  };

  // Ottieni lista fornitori unici (filtra null/undefined e assicura string[])
  const uniqueSuppliers: string[] = Array.from(
    new Set(
      bufferProducts
        .filter((p): p is BufferProduct & { supplier_name: string } => !!p.supplier_name)
        .map(p => p.supplier_name)
    )
  ).sort();

  // Filtra prodotti per fornitore selezionato
  const filteredProducts = selectedSupplier === 'ALL'
    ? bufferProducts
    : bufferProducts.filter(p => p.supplier_name === selectedSupplier);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-3xl p-8 cursor-pointer hover:scale-[1.02] transition-transform"
              onClick={() => selectOperation('buffer')}
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-3xl p-8 cursor-pointer hover:scale-[1.02] transition-transform"
              onClick={() => selectOperation('sposta')}
            >
              <div className="relative">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-4xl">
                  🔄
                </div>

                <h2 className="text-2xl font-bold text-center mb-3">
                  Sposta tra Ubicazioni
                </h2>

                <p className="text-muted-foreground text-center">
                  Sposta un prodotto da un'ubicazione a un'altra scegliendo quantità e lotto
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-3xl p-8 cursor-pointer hover:scale-[1.02] transition-transform"
              onClick={() => selectOperation('rientro')}
            >
              <div className="relative">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-4xl">
                  📦
                </div>

                <h2 className="text-2xl font-bold text-center mb-3">
                  Rimetti nel Buffer
                </h2>

                <p className="text-muted-foreground text-center">
                  Riporta un prodotto da un'ubicazione al buffer, scegliendo quantità e zona
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Selezione Zona */}
        {currentOperation === 'buffer' && !selectedZone && (
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
            <div className="mb-6 flex gap-3 flex-wrap">
              <button
                onClick={backToZoneSelection}
                className="glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
              >
                ← Torna alla selezione zona
              </button>

              <button
                onClick={() => router.push('/scarti')}
                className="glass-strong px-6 py-3 rounded-xl hover:bg-orange-500/20 transition-colors flex items-center gap-2 bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30"
              >
                📊 Dashboard Scarti
              </button>

              <button
                onClick={() => setShowWasteTransferModal(true)}
                className="glass-strong px-6 py-3 rounded-xl hover:bg-red-500/20 transition-colors flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30"
              >
                🗑️ Gestione Scarti
              </button>
            </div>

            {/* Griglia prodotti buffer */}
            {bufferProducts.length > 0 && (
              <div className="glass-strong rounded-xl p-6 mb-6">
                <div className="flex flex-col gap-3 mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Package className="w-6 h-6 text-blue-400" />
                    Prodotti disponibili in {ZONES.find(z => z.id === selectedZone)?.bufferName}
                  </h3>

                  {/* Filtro Fornitore */}
                  {uniqueSuppliers.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                        🏭 Fornitore:
                      </label>
                      <select
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg border-2 border-slate-500 focus:border-blue-500 focus:outline-none font-semibold w-full sm:w-auto sm:min-w-[200px]"
                        style={{ color: 'white', backgroundColor: '#334155' }}
                      >
                        <option value="ALL" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                          TUTTI ({bufferProducts.length})
                        </option>
                        {uniqueSuppliers.map((supplier) => {
                          const count = bufferProducts.filter(p => p.supplier_name === supplier).length;
                          return (
                            <option key={supplier} value={supplier} style={{ backgroundColor: '#1e293b', color: 'white' }}>
                              {supplier} ({count})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {filteredProducts.map((product) => (
                    <div
                      key={`${product.id}-${product.lot_name}`}
                      className="glass p-3 rounded-xl cursor-pointer active:scale-95 hover:scale-105 transition-transform touch-manipulation"
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

                <button
                  onClick={() => setShowProductSearch(true)}
                  className="w-full glass-strong px-6 py-4 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  <span className="font-semibold">🔍 Cerca dal catalogo prodotti</span>
                </button>
              </div>

              {/* Prodotto selezionato */}
              {selectedProduct && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass p-6 rounded-xl mb-6"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-shrink-0 mx-auto sm:mx-0">
                      {selectedProduct.image ? (
                        <img
                          src={selectedProduct.image}
                          alt={selectedProduct.name}
                          className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-700 rounded-lg flex items-center justify-center">
                          <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h4 className="text-lg sm:text-xl font-bold mb-2">{selectedProduct.name}</h4>
                      <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                        Codice: {selectedProduct.code}
                        {isFromCatalog && <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">📚 Dal Catalogo</span>}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                            <button
                              onClick={() => setShowCalculator(true)}
                              className="flex-1 glass px-4 py-2 rounded-lg border border-blue-500/50 hover:border-blue-500 hover:bg-white/10 transition-colors text-left font-mono text-lg"
                            >
                              {quantity}
                            </button>
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
                      className="flex-1 glass px-4 py-3 rounded-xl border-2 border-white/20 focus:border-blue-500 focus:outline-none text-base"
                      inputMode="text"
                    />
                    <button
                      onClick={() => setShowLocationScanner(true)}
                      className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2 touch-manipulation"
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
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                >
                  ✅ CONFERMA TRASFERIMENTO
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Workflow Spostamento Ubicazione → Ubicazione */}
        {currentOperation === 'sposta' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={backToOperationSelection}
              className="mb-6 glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
            >
              ← Torna indietro
            </button>

            <div className="glass-strong rounded-xl p-6">
              {/* Step 1: Ubicazione di partenza */}
              <h4 className="text-lg font-semibold mb-3 text-purple-400">
                1️⃣ Ubicazione di Partenza
              </h4>
              <div className="flex gap-3 mb-2">
                <input
                  ref={sourceInputRef}
                  type="text"
                  value={sourceLocationCode}
                  onChange={(e) => setSourceLocationCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadSourceLocation(sourceLocationCode);
                  }}
                  placeholder="Scansiona l'ubicazione di partenza..."
                  className="flex-1 glass px-4 py-3 rounded-xl border-2 border-white/20 focus:border-purple-500 focus:outline-none text-base"
                  inputMode="text"
                />
                <button
                  onClick={() => setShowSourceScanner(true)}
                  className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2 touch-manipulation"
                >
                  <Camera className="w-5 h-5" />
                  <span className="hidden sm:inline">Camera</span>
                </button>
              </div>

              {sourceLocationData && (
                <div className="mb-6 glass p-4 rounded-lg border-l-4 border-purple-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold">Partenza:</span>
                    <span className="font-bold">{sourceLocationData.complete_name || sourceLocationData.name}</span>
                  </div>
                </div>
              )}

              {/* Griglia prodotti presenti nell'ubicazione di partenza */}
              {sourceLocationData && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-purple-400">
                    2️⃣ Scegli il Prodotto da Spostare
                  </h4>
                  {sourceProducts.length === 0 ? (
                    <p className="text-muted-foreground glass p-4 rounded-lg">
                      Nessun prodotto disponibile in questa ubicazione.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {sourceProducts.map((product) => (
                        <div
                          key={`${product.id}-${product.lot_name}`}
                          className={`glass p-3 rounded-xl cursor-pointer active:scale-95 hover:scale-105 transition-transform touch-manipulation ${
                            selectedProduct && selectedProduct.id === product.id && selectedProduct.lot_name === product.lot_name
                              ? 'ring-2 ring-purple-500'
                              : ''
                          }`}
                          onClick={() => {
                            setSelectedProduct(product);
                            setLotNumber(product.lot_name || '');
                            setExpiryDate(product.expiration_date ? product.expiration_date.split(' ')[0] : '');
                            setQuantity(product.quantity?.toString() || '1');
                            setIsFromCatalog(false);
                            toast.success(`Prodotto: ${product.name}`);
                            setTimeout(() => locationInputRef.current?.focus(), 300);
                          }}
                        >
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-16 h-16 object-cover rounded-lg mb-2 mx-auto" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-700 rounded-lg mb-2 flex items-center justify-center mx-auto">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="text-sm font-semibold line-clamp-2 mb-1">{product.name}</div>
                          <div className="text-xs text-muted-foreground mb-1">{product.code}</div>
                          <div className="text-sm font-bold text-green-400">{product.quantity} {product.uom}</div>
                          {product.lot_name && (
                            <div className="text-xs text-blue-400 mt-1">Lotto: {product.lot_name}</div>
                          )}
                          {product.expiration_date && (
                            <div className="text-xs text-orange-400 mt-1">
                              Scad: {new Date(product.expiration_date).toLocaleDateString('it-IT')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prodotto selezionato: quantità */}
              {selectedProduct && (
                <div className="glass p-6 rounded-xl mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h4 className="text-lg font-bold">{selectedProduct.name}</h4>
                    {selectedProduct.lot_name && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                        Lotto {selectedProduct.lot_name}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      QUANTITÀ DA SPOSTARE (max {selectedProduct.quantity})
                    </label>
                    <div className="flex gap-2 max-w-xs">
                      <button
                        onClick={() => setShowCalculator(true)}
                        className="flex-1 glass px-4 py-2 rounded-lg border border-purple-500/50 hover:border-purple-500 hover:bg-white/10 transition-colors text-left font-mono text-lg"
                      >
                        {quantity}
                      </button>
                      <span className="glass px-4 py-2 rounded-lg font-semibold">{selectedProduct.uom}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Ubicazione di destinazione */}
              {selectedProduct && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-purple-400">
                    3️⃣ Ubicazione di Destinazione
                  </h4>
                  <div className="flex gap-3">
                    <input
                      ref={locationInputRef}
                      type="text"
                      value={locationCode}
                      onChange={(e) => setLocationCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLocationScan(locationCode);
                      }}
                      placeholder="Scansiona l'ubicazione di destinazione..."
                      className="flex-1 glass px-4 py-3 rounded-xl border-2 border-white/20 focus:border-purple-500 focus:outline-none text-base"
                      inputMode="text"
                    />
                    <button
                      onClick={() => setShowLocationScanner(true)}
                      className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2 touch-manipulation"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="hidden sm:inline">Camera</span>
                    </button>
                  </div>

                  {locationData && (
                    <div className="mt-4 glass p-4 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-green-400" />
                        <span className="font-semibold">Destinazione:</span>
                        <span className="font-bold">{locationData.complete_name || locationData.name}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conferma */}
              {selectedProduct && locationData && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={confirmSposta}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                >
                  🔄 CONFERMA SPOSTAMENTO
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Workflow Rimetti nel Buffer (Ubicazione → Buffer) */}
        {currentOperation === 'rientro' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={backToOperationSelection}
              className="mb-6 glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
            >
              ← Torna indietro
            </button>

            <div className="glass-strong rounded-xl p-6">
              {/* Step 1: Ubicazione di partenza */}
              <h4 className="text-lg font-semibold mb-3 text-amber-400">
                1️⃣ Ubicazione di Partenza
              </h4>
              <div className="flex gap-3 mb-2">
                <input
                  ref={sourceInputRef}
                  type="text"
                  value={sourceLocationCode}
                  onChange={(e) => setSourceLocationCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadSourceLocation(sourceLocationCode);
                  }}
                  placeholder="Scansiona l'ubicazione di partenza..."
                  className="flex-1 glass px-4 py-3 rounded-xl border-2 border-white/20 focus:border-amber-500 focus:outline-none text-base"
                  inputMode="text"
                />
                <button
                  onClick={() => setShowSourceScanner(true)}
                  className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2 touch-manipulation"
                >
                  <Camera className="w-5 h-5" />
                  <span className="hidden sm:inline">Camera</span>
                </button>
              </div>

              {sourceLocationData && (
                <div className="mb-6 glass p-4 rounded-lg border-l-4 border-amber-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-amber-400" />
                    <span className="font-semibold">Partenza:</span>
                    <span className="font-bold">{sourceLocationData.complete_name || sourceLocationData.name}</span>
                  </div>
                </div>
              )}

              {/* Griglia prodotti presenti nell'ubicazione di partenza */}
              {sourceLocationData && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-amber-400">
                    2️⃣ Scegli il Prodotto da Riportare
                  </h4>
                  {sourceProducts.length === 0 ? (
                    <p className="text-muted-foreground glass p-4 rounded-lg">
                      Nessun prodotto disponibile in questa ubicazione.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {sourceProducts.map((product) => (
                        <div
                          key={`${product.id}-${product.lot_name}`}
                          className={`glass p-3 rounded-xl cursor-pointer active:scale-95 hover:scale-105 transition-transform touch-manipulation ${
                            selectedProduct && selectedProduct.id === product.id && selectedProduct.lot_name === product.lot_name
                              ? 'ring-2 ring-amber-500'
                              : ''
                          }`}
                          onClick={() => {
                            setSelectedProduct(product);
                            setLotNumber(product.lot_name || '');
                            setExpiryDate(product.expiration_date ? product.expiration_date.split(' ')[0] : '');
                            setQuantity(product.quantity?.toString() || '1');
                            setIsFromCatalog(false);
                            setLocationData(null);
                            toast.success(`Prodotto: ${product.name}`);
                          }}
                        >
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-16 h-16 object-cover rounded-lg mb-2 mx-auto" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-700 rounded-lg mb-2 flex items-center justify-center mx-auto">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="text-sm font-semibold line-clamp-2 mb-1">{product.name}</div>
                          <div className="text-xs text-muted-foreground mb-1">{product.code}</div>
                          <div className="text-sm font-bold text-green-400">{product.quantity} {product.uom}</div>
                          {product.lot_name && (
                            <div className="text-xs text-blue-400 mt-1">Lotto: {product.lot_name}</div>
                          )}
                          {product.expiration_date && (
                            <div className="text-xs text-orange-400 mt-1">
                              Scad: {new Date(product.expiration_date).toLocaleDateString('it-IT')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prodotto selezionato: quantità */}
              {selectedProduct && (
                <div className="glass p-6 rounded-xl mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h4 className="text-lg font-bold">{selectedProduct.name}</h4>
                    {selectedProduct.lot_name && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                        Lotto {selectedProduct.lot_name}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      QUANTITÀ DA RIPORTARE (max {selectedProduct.quantity})
                    </label>
                    <div className="flex gap-2 max-w-xs">
                      <button
                        onClick={() => setShowCalculator(true)}
                        className="flex-1 glass px-4 py-2 rounded-lg border border-amber-500/50 hover:border-amber-500 hover:bg-white/10 transition-colors text-left font-mono text-lg"
                      >
                        {quantity}
                      </button>
                      <span className="glass px-4 py-2 rounded-lg font-semibold">{selectedProduct.uom}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Buffer di destinazione */}
              {selectedProduct && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-amber-400">
                    3️⃣ Scegli il Buffer di Destinazione
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {ZONES.map((zone) => (
                      <button
                        key={zone.id}
                        onClick={() => selectBufferDest(zone)}
                        className={`glass p-4 rounded-xl cursor-pointer active:scale-95 hover:scale-105 transition-transform touch-manipulation text-center ${
                          locationData && locationData.id === zone.bufferId ? 'ring-2 ring-amber-500' : ''
                        }`}
                      >
                        <div className="text-3xl mb-2">{zone.icon}</div>
                        <div className="font-bold">{zone.name}</div>
                        <div className="text-xs text-muted-foreground">{zone.bufferName}</div>
                      </button>
                    ))}
                  </div>

                  {locationData && (
                    <div className="mt-4 glass p-4 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-green-400" />
                        <span className="font-semibold">Destinazione:</span>
                        <span className="font-bold">{locationData.complete_name || locationData.name}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conferma */}
              {selectedProduct && locationData && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={confirmSposta}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                >
                  📦 RIMETTI NEL BUFFER
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

      {/* QR Scanner ubicazione di partenza (spostamento) */}
      <QRScanner
        isOpen={showSourceScanner}
        onClose={() => setShowSourceScanner(false)}
        onScan={(code) => {
          setShowSourceScanner(false);
          loadSourceLocation(code);
        }}
        title="Scanner Ubicazione Partenza"
      />

      {/* Ricerca prodotti dal catalogo */}
      <ProductSearch
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelectProduct={handleProductSelectFromCatalog}
        currentLocationName={locationData?.complete_name || locationData?.name}
      />

      {/* Calcolatrice per quantità */}
      <Calculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onConfirm={(value) => setQuantity(value)}
        title="Quantità"
        initialValue={quantity}
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

      {/* Modal Gestione Scarti */}
      <WasteTransferModal
        isOpen={showWasteTransferModal}
        onClose={() => setShowWasteTransferModal(false)}
        onSuccess={() => {
          toast.success('✅ Scarto registrato con successo!');
          setShowWasteTransferModal(false);
          // Ricarica counts se necessario
          loadBufferCounts();
        }}
      />
    </div>
  );
}
