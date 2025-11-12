'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/inventario/QRScanner';
import { ProductEditModal } from '@/components/inventario/ProductEditModal';
import toast from 'react-hot-toast';

// Configurazione zone con bufferId da Odoo
const ZONES = [
  { id: 'frigo', name: 'FRIGO', icon: '❄️', bufferId: 28, color: '#06b6d4' },
  { id: 'secco', name: 'SECCO', icon: '📦', bufferId: 29, color: '#0ea5e9' },
  { id: 'secco-sopra', name: 'SECCO SOPRA', icon: '📋', bufferId: 30, color: '#7c3aed' },
  { id: 'pingu', name: 'PINGU', icon: '🐧', bufferId: 31, color: '#f59e0b' }
];

interface VerificationRequest {
  id: number;
  product_id: number;
  product_name: string;
  lot_id: number | null;
  lot_name: string | null;
  location_id: number;
  location_name: string;
  quantity: number;
  expiry_date: string | null;
  requested_at: string;
  requested_by: string | null;
  note: string | null;
}

interface ZoneCounts {
  [key: string]: number;
}

interface ProductForModal {
  id: number;
  name: string;
  code?: string;
  image?: string;
  stockQuantity: number;
  countedQuantity: number;
  uom?: string;
  lot?: {
    id: number;
    name: string;
    expiration_date?: string;
  };
}

export default function VerificaInventarioPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Stati principali
  const [allRequests, setAllRequests] = useState<VerificationRequest[]>([]);
  const [zoneCounts, setZoneCounts] = useState<ZoneCounts>({});
  const [selectedZone, setSelectedZone] = useState<typeof ZONES[0] | null>(null);
  const [showZoneSelector, setShowZoneSelector] = useState(true);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [locationProducts, setLocationProducts] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stati modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductForModal | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);

  // Carica richieste all'avvio
  useEffect(() => {
    loadVerificationRequests();
  }, []);

  // Calcola conteggi zone quando cambiano le richieste
  useEffect(() => {
    calculateZoneCounts();
  }, [allRequests]);

  const loadVerificationRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/verification-requests');
      const data = await response.json();

      if (data.success) {
        setAllRequests(data.requests);
        toast.success(`${data.count} richieste di verifica caricate`);
      } else {
        toast.error('Errore caricamento richieste');
      }
    } catch (error) {
      console.error('Errore caricamento richieste:', error);
      toast.error('Errore connessione server');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateZoneCounts = () => {
    const counts: ZoneCounts = {
      'frigo': 0,
      'secco': 0,
      'secco-sopra': 0,
      'pingu': 0
    };

    allRequests.forEach(request => {
      const locationName = request.location_name?.toLowerCase() || '';

      if (locationName.includes('frigo')) {
        counts['frigo']++;
      } else if (locationName.includes('pingu')) {
        counts['pingu']++;
      } else if (locationName.includes('sopra')) {
        counts['secco-sopra']++;
      } else if (locationName.includes('secco')) {
        counts['secco']++;
      }
    });

    setZoneCounts(counts);
  };

  const handleZoneSelect = (zone: typeof ZONES[0]) => {
    setSelectedZone(zone);
    setShowZoneSelector(false);
    setShowLocationScanner(true);
  };

  const handleLocationScan = (scannedCode: string) => {
    // Chiudi scanner
    setShowQRScanner(false);

    // Filtra prodotti per questa ubicazione e zona
    const productsForLocation = allRequests.filter(request => {
      const locationName = request.location_name?.toLowerCase() || '';
      const zoneMatches = selectedZone && locationName.includes(selectedZone.name.toLowerCase());
      const locationMatches = request.location_name?.includes(scannedCode) ||
                             scannedCode.includes(request.location_name || '');

      return zoneMatches && locationMatches;
    });

    if (productsForLocation.length === 0) {
      toast.error('Nessun prodotto da verificare in questa ubicazione');
      return;
    }

    setCurrentLocation(scannedCode);
    setLocationProducts(productsForLocation);
    setShowLocationScanner(false);
    setShowProductList(true);
    toast.success(`${productsForLocation.length} prodotti da verificare`);
  };

  const handleProductClick = (request: VerificationRequest) => {
    setSelectedRequest(request);

    const productForModal: ProductForModal = {
      id: request.product_id,
      name: request.product_name,
      stockQuantity: request.quantity,
      countedQuantity: request.quantity,
      uom: 'PZ',
      lot: request.lot_id && request.lot_name ? {
        id: request.lot_id,
        name: request.lot_name,
        expiration_date: request.expiry_date || undefined
      } : undefined
    };

    setSelectedProduct(productForModal);
    setShowProductModal(true);
  };

  const handleProductConfirm = async (data: {
    quantity: number;
    lotName: string;
    expiryDate: string;
  }) => {
    if (!selectedRequest) return;

    try {
      const response = await fetch('/api/verification-requests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          verifiedBy: user?.name || 'Operatore',
          note: `Quantità verificata: ${data.quantity}, Lotto: ${data.lotName || 'N/A'}, Scadenza: ${data.expiryDate || 'N/A'}`
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Prodotto verificato con successo!');

        // Rimuovi dalla lista locale
        setLocationProducts(prev => prev.filter(p => p.id !== selectedRequest.id));
        setAllRequests(prev => prev.filter(p => p.id !== selectedRequest.id));

        // Chiudi modal
        setShowProductModal(false);
        setSelectedProduct(null);
        setSelectedRequest(null);

        // Se non ci sono più prodotti, torna allo scanner ubicazione
        if (locationProducts.length <= 1) {
          setShowProductList(false);
          setShowLocationScanner(true);
          toast('Ubicazione completata! Scansiona la prossima ubicazione', { icon: '✅' });
        }
      } else {
        toast.error('Errore nel completamento della verifica');
      }
    } catch (error) {
      console.error('Errore completamento verifica:', error);
      toast.error('Errore di connessione');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900/90 via-slate-800/90 to-indigo-900/90">
      {/* Header */}
      <AppHeader
        title="Verifica Inventario"
        subtitle="Gestione verifiche per zona"
        icon={<CheckCircle2 className="h-8 w-8 text-white" />}
        showHomeButton={true}
        showBackButton={false}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-strong p-6 rounded-xl">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-center">Caricamento...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Zone Selector */}
        {showZoneSelector && (
          <div className="scale-in">
            <h2 className="text-2xl font-bold mb-6 text-center">Seleziona Zona</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {ZONES.map(zone => (
                <button
                  key={zone.id}
                  onClick={() => handleZoneSelect(zone)}
                  className="glass-strong p-8 rounded-xl hover:bg-white/20 transition-all"
                  style={{
                    borderLeft: `4px solid ${zone.color}`,
                    background: `linear-gradient(135deg, ${zone.color}10 0%, transparent 100%)`
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{zone.icon}</div>
                    <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-bold">
                      {zoneCounts[zone.id] || 0}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{zone.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {zoneCounts[zone.id] || 0} prodotti da verificare
                  </p>
                </button>
              ))}
            </div>

            {allRequests.length === 0 && !isLoading && (
              <div className="glass-strong rounded-xl p-12 text-center mt-6">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nessuna verifica da fare</h3>
                <p className="text-muted-foreground">
                  Non ci sono richieste di verifica in attesa
                </p>
              </div>
            )}
          </div>
        )}

        {/* Location Scanner View */}
        {showLocationScanner && (
          <div className="slide-in-right">
            <div className="mb-6">
              <button
                onClick={() => {
                  setShowLocationScanner(false);
                  setShowZoneSelector(true);
                  setSelectedZone(null);
                }}
                className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Torna alle Zone
              </button>
            </div>

            <div className="glass-strong rounded-xl p-8 text-center">
              <div
                className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center text-4xl"
                style={{ backgroundColor: `${selectedZone?.color}20` }}
              >
                {selectedZone?.icon}
              </div>

              <h2 className="text-2xl font-bold mb-2">{selectedZone?.name}</h2>
              <p className="text-muted-foreground mb-8">
                {zoneCounts[selectedZone?.id || ''] || 0} prodotti da verificare
              </p>

              <button
                onClick={() => setShowQRScanner(true)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <MapPin className="w-6 h-6" />
                Scansiona Ubicazione
              </button>
            </div>
          </div>
        )}

        {/* Product List */}
        {showProductList && (
          <div className="slide-in-right">
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowProductList(false);
                  setShowLocationScanner(true);
                  setLocationProducts([]);
                  setCurrentLocation('');
                }}
                className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Torna allo Scanner
              </button>

              <div className="flex items-center gap-2">
                <div
                  className="px-4 py-2 rounded-lg font-semibold"
                  style={{ backgroundColor: `${selectedZone?.color}20`, color: selectedZone?.color }}
                >
                  {selectedZone?.name}
                </div>
                <div className="px-4 py-2 rounded-lg font-semibold bg-gray-700">
                  📍 {currentLocation}
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-6">Prodotti da Verificare</h2>

            <div className="space-y-4">
              {locationProducts.map((request) => (
                <div
                  key={request.id}
                  className="glass-strong p-6 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => handleProductClick(request)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{request.product_name}</h3>

                      {request.lot_name && (
                        <p className="text-sm text-yellow-400 mb-1">
                          🏷️ Lotto: {request.lot_name}
                        </p>
                      )}

                      {request.expiry_date && (
                        <p className="text-sm text-orange-400 mb-1">
                          📅 Scadenza: {new Date(request.expiry_date).toLocaleDateString('it-IT')}
                        </p>
                      )}

                      <p className="text-sm text-gray-400 mb-2">
                        Quantità: {request.quantity}
                      </p>

                      {request.note && (
                        <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                          <p className="text-xs text-yellow-400">💬 {request.note}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 ml-4">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {locationProducts.length === 0 && (
              <div className="glass-strong rounded-xl p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ubicazione Verificata!</h3>
                <p className="text-muted-foreground">
                  Tutti i prodotti sono stati verificati
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Home Button */}
      <MobileHomeButton />

      {/* QR Scanner per ubicazioni */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleLocationScan}
      />

      {/* Product Edit Modal */}
      <ProductEditModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProduct(null);
          setSelectedRequest(null);
        }}
        product={selectedProduct}
        onConfirm={handleProductConfirm}
        onOpenCalculator={(value) => {
          // Implementa calcolatrice se necessario
          console.log('Calcolatrice:', value);
        }}
      />
    </div>
  );
}
