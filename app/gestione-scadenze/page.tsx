'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Package, MapPin, Calendar, Clock, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/inventario/QRScanner';
import { ConnectionStatus } from '@/components/inventario/ConnectionStatus';
import { ExpiryProductList } from '@/components/gestione-scadenze/ExpiryProductList';
import { ExpiryCamera } from '@/components/gestione-scadenze/ExpiryCamera';
import { ExpiryConfirmModal } from '@/components/gestione-scadenze/ExpiryConfirmModal';
import { getInventoryClient } from '@/lib/odoo/inventoryClient';
import toast from 'react-hot-toast';

interface ExpiryProduct {
  id: number;
  quant_id?: number;
  name: string;
  code: string;
  barcode?: string;
  image?: string;
  uom: string;
  quantity: number;
  lot_id?: number;
  lot_name?: string;
  lot_expiration_date?: string;
  hasExpiry: boolean;
  isVerified?: boolean; // Ha foto etichetta allegata
}

interface Location {
  id: number;
  name: string;
  complete_name?: string;
  barcode?: string;
}

export default function GestioneScadenzePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [products, setProducts] = useState<ExpiryProduct[]>([]);
  const [locationCode, setLocationCode] = useState('');

  // Scanner e camera states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showExpiryCamera, setShowExpiryCamera] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ExpiryProduct | null>(null);

  // Confirm modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    lotNumber: string;
    expiryDate: string;
    confidence: number;
    photos: string[];
  } | null>(null);

  const [processingAI, setProcessingAI] = useState(false);

  const locationScannerRef = useRef<HTMLInputElement>(null);
  const inventoryClient = getInventoryClient();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  // Scansiona ubicazione
  const scanLocation = async (code: string) => {
    if (!code) {
      toast.error('Inserisci un codice ubicazione');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Cercando ubicazione:', code);

      const result = await inventoryClient.findLocation(code);

      if (!result) {
        toast.error(`Ubicazione "${code}" non trovata`);
        setLoading(false);
        return;
      }

      const { location, inventory } = result;

      // Mappa i prodotti con info scadenze
      const expiryProducts: ExpiryProduct[] = inventory.map((item: any) => ({
        id: item.product_id,
        quant_id: item.quant_id,
        name: item.product_name,
        code: item.default_code || '',
        barcode: item.barcode || '',
        image: item.image_128 ? `data:image/png;base64,${item.image_128}` : undefined,
        uom: item.uom_id ? item.uom_id[1] : 'PZ',
        quantity: item.quantity || 0,
        lot_id: item.lot_id,
        lot_name: item.lot_name,
        lot_expiration_date: item.lot_expiration_date,
        hasExpiry: !!item.lot_expiration_date,
        isVerified: false
      }))
      .sort((a, b) => {
        // Prima i prodotti senza scadenza, poi per data scadenza
        if (!a.hasExpiry && b.hasExpiry) return -1;
        if (a.hasExpiry && !b.hasExpiry) return 1;
        if (a.lot_expiration_date && b.lot_expiration_date) {
          return new Date(a.lot_expiration_date).getTime() - new Date(b.lot_expiration_date).getTime();
        }
        return a.name.localeCompare(b.name, 'it');
      });

      setCurrentLocation(location);
      setProducts(expiryProducts);
      setLocationCode('');

      toast.success(`✅ ${location.name} - ${expiryProducts.length} prodotti`);

      // Controlla quali prodotti/lotti hanno già foto allegate
      checkVerifiedProducts(expiryProducts);

    } catch (error: any) {
      console.error('Errore scan ubicazione:', error);
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      scanLocation(locationCode);
    }
  };

  // Controlla quali prodotti/lotti hanno foto allegate (verificati)
  const checkVerifiedProducts = async (productsList: ExpiryProduct[]) => {
    try {
      const lotIds = productsList
        .filter(p => p.lot_id)
        .map(p => p.lot_id as number);

      const productIds = productsList
        .filter(p => !p.lot_id)
        .map(p => p.id);

      if (lotIds.length === 0 && productIds.length === 0) return;

      const response = await fetch('/api/gestione-scadenze/save-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'check_verified',
          lotIds: lotIds.length > 0 ? lotIds : undefined,
          productIds: productIds.length > 0 ? productIds : undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        const { verifiedLots, verifiedProducts } = data;

        // Aggiorna lo stato dei prodotti
        setProducts(prev => prev.map(p => ({
          ...p,
          isVerified: p.lot_id
            ? verifiedLots.includes(p.lot_id)
            : verifiedProducts.includes(p.id)
        })));

        const totalVerified = verifiedLots.length + verifiedProducts.length;
        if (totalVerified > 0) {
          console.log(`✅ ${totalVerified} prodotti già verificati`);
        }
      }
    } catch (error) {
      console.error('Errore controllo verificati:', error);
    }
  };

  const handleQRScan = (result: string) => {
    setLocationCode(result);
    scanLocation(result);
  };

  // Quando utente seleziona un prodotto, apri direttamente la camera
  const handleProductSelect = (product: ExpiryProduct) => {
    setSelectedProduct(product);
    setShowExpiryCamera(true);
  };

  // Callback quando le foto sono state scattate
  const handlePhotosCapture = async (photos: string[]) => {
    if (!selectedProduct || photos.length === 0) {
      toast.error('Nessuna foto scattata');
      return;
    }

    setShowExpiryCamera(false);
    setProcessingAI(true);

    try {
      // NON caricare le foto qui - le carichiamo DOPO la conferma sul lotto corretto
      // Chiama Gemini Vision per estrarre lotto e scadenza
      const extractResponse = await fetch('/api/gestione-scadenze/extract-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          photos: photos,
          productName: selectedProduct.name,
          currentLot: selectedProduct.lot_name,
          currentExpiry: selectedProduct.lot_expiration_date
        })
      });

      const extractData = await extractResponse.json();

      if (!extractData.success) {
        throw new Error(extractData.error || 'Errore estrazione dati');
      }

      console.log('🤖 Dati estratti da Gemini:', extractData);

      // Mostra modal di conferma con i dati estratti (foto salvate per upload successivo)
      setExtractedData({
        lotNumber: extractData.lotNumber || '',
        expiryDate: extractData.expiryDate || '',
        confidence: extractData.confidence || 0,
        photos: photos // Le foto verranno caricate dopo la conferma
      });
      setShowConfirmModal(true);

    } catch (error: any) {
      console.error('❌ Errore elaborazione:', error);
      toast.error('Errore: ' + error.message);
    } finally {
      setProcessingAI(false);
    }
  };

  // Conferma e salva i dati estratti
  const handleConfirmExpiry = async (lotNumber: string, expiryDate: string) => {
    if (!selectedProduct || !extractedData) return;

    try {
      setLoading(true);

      // 1. Prima crea/aggiorna il lotto
      const response = await fetch('/api/gestione-scadenze/save-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update_expiry',
          productId: selectedProduct.id,
          quantId: selectedProduct.quant_id,
          lotName: lotNumber,
          expiryDate: expiryDate
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore salvataggio');
      }

      console.log('✅ Lotto aggiornato/creato:', data);

      // 2. Ora carica le foto sul lotto appena creato/aggiornato
      const lotIdToUse = data.lotId || selectedProduct.lot_id;

      if (extractedData.photos && extractedData.photos.length > 0) {
        console.log(`📸 Caricando ${extractedData.photos.length} foto sul lotto ${lotIdToUse}...`);

        const uploadResponse = await fetch('/api/gestione-scadenze/save-expiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'upload_photos',
            productId: selectedProduct.id,
            lotId: lotIdToUse, // Usa il lotId appena creato/aggiornato
            photos: extractedData.photos
          })
        });

        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
          console.log(`✅ Foto caricate su ${uploadData.targetModel} ID ${uploadData.targetId}`);
        } else {
          console.warn('⚠️ Errore upload foto:', uploadData.error);
          // Non blocchiamo per errore foto, il lotto è già salvato
        }
      }

      // 3. Aggiorna prodotto nella lista locale - segna come verificato
      setProducts(prev => prev.map(p => {
        if (selectedProduct.quant_id
          ? p.quant_id === selectedProduct.quant_id
          : p.id === selectedProduct.id) {
          return {
            ...p,
            lot_id: lotIdToUse,
            lot_name: lotNumber,
            lot_expiration_date: expiryDate,
            hasExpiry: !!expiryDate,
            isVerified: true // Foto caricate = verificato
          };
        }
        return p;
      }));

      toast.success(`✅ Scadenza e foto salvate: ${selectedProduct.name}`);
      setShowConfirmModal(false);
      setSelectedProduct(null);
      setExtractedData(null);

    } catch (error: any) {
      console.error('❌ Errore salvataggio:', error);
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Riprova con nuove foto
  const handleRetryCapture = () => {
    setShowConfirmModal(false);
    setExtractedData(null);
    setShowExpiryCamera(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <AppHeader
        title="Gestione Scadenze"
        subtitle="Scansiona → Fotografa → Aggiorna"
        icon={<Calendar className="h-8 w-8 text-white" />}
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
              {connectionStatus === 'connected' ? 'Online' : 'Offline'}
            </span>
          </div>
        }
      />

      {/* Loading Overlay */}
      {(loading || processingAI) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-strong p-6 rounded-xl text-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p>{processingAI ? '🤖 Analizzando etichetta...' : 'Caricamento...'}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Scanner Section */}
        <div className="glass-strong rounded-xl p-6 mb-6">
          <div className="text-center mb-6">
            <Calendar className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Scanner Ubicazione</h2>
            <p className="text-muted-foreground">
              📱 Scansiona il QR dell'ubicazione per vedere i prodotti
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
              className="flex-1 min-w-0 glass px-4 py-3 rounded-xl border border-white/20 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <button
              onClick={() => setShowQRScanner(true)}
              className="glass-strong px-4 py-3 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Camera</span>
            </button>
          </div>
        </div>

        {/* Location Info */}
        {currentLocation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-xl p-6 mb-6 border-l-4 border-orange-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  {currentLocation.complete_name || currentLocation.name}
                </h3>
                <p className="text-muted-foreground">
                  {products.filter(p => !p.hasExpiry).length} senza scadenza · {products.filter(p => p.hasExpiry).length} con scadenza
                </p>
              </div>
              <div className="flex items-center gap-2 text-orange-400">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">{products.length}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Products List */}
        {products.length > 0 ? (
          <ExpiryProductList
            products={products}
            onSelectProduct={handleProductSelect}
          />
        ) : currentLocation ? (
          <div className="glass-strong rounded-xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nessun prodotto</h3>
            <p className="text-muted-foreground">
              Nessun prodotto in questa ubicazione
            </p>
          </div>
        ) : (
          <div className="glass-strong rounded-xl p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Scansiona ubicazione</h3>
            <p className="text-muted-foreground">
              Scansiona un QR per vedere i prodotti e gestire le scadenze
            </p>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
        title="Scanner Ubicazione"
      />

      {/* Expiry Camera Modal */}
      {selectedProduct && (
        <ExpiryCamera
          isOpen={showExpiryCamera}
          onClose={() => {
            setShowExpiryCamera(false);
            setSelectedProduct(null);
          }}
          onCapture={handlePhotosCapture}
          productName={selectedProduct.name}
          maxPhotos={3}
        />
      )}

      {/* Confirm Modal */}
      {selectedProduct && extractedData && (
        <ExpiryConfirmModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setSelectedProduct(null);
            setExtractedData(null);
          }}
          onConfirm={handleConfirmExpiry}
          onRetry={handleRetryCapture}
          productName={selectedProduct.name}
          extractedLot={extractedData.lotNumber}
          extractedExpiry={extractedData.expiryDate}
          confidence={extractedData.confidence}
          currentLot={selectedProduct.lot_name}
          currentExpiry={selectedProduct.lot_expiration_date}
        />
      )}

      {/* Connection Status */}
      <ConnectionStatus />

      {/* Mobile Home Button */}
      <MobileHomeButton />
    </div>
  );
}
