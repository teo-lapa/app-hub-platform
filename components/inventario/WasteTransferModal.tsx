'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Package, Camera, Trash2, AlertCircle, ChevronRight, Calculator as CalculatorIcon, QrCode } from 'lucide-react';
import { QRScanner } from './QRScanner';
import { Calculator } from './Calculator';
import { PhotoCapture } from './PhotoCapture';
import toast from 'react-hot-toast';
import type { WasteLocationProduct } from '@/lib/types';

interface WasteTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const WASTE_REASONS = [
  'Scaduto',
  'Danneggiato',
  'Catena freddo interrotta',
  'Confezione rotta',
  'Non conforme',
  'Altro'
];

// Fixed destination
const WASTE_LOCATION = {
  id: 648,
  name: 'MERCE DETERIORATA'
};

export function WasteTransferModal({ isOpen, onClose, onSuccess }: WasteTransferModalProps) {
  // States
  const [step, setStep] = useState<'location' | 'products' | 'form'>('location');
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [products, setProducts] = useState<WasteLocationProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<WasteLocationProduct | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('location');
      setSelectedLocation(null);
      setProducts([]);
      setSelectedProduct(null);
      setQuantity('1');
      setReason('');
      setNotes('');
      setPhotos([]);
    }
  }, [isOpen]);

  // Load products when location selected
  useEffect(() => {
    if (selectedLocation && step === 'products') {
      loadLocationProducts();
    }
  }, [selectedLocation, step]);

  async function loadLocationProducts() {
    setLoadingProducts(true);
    try {
      const response = await fetch(`/api/waste/location-products?locationId=${selectedLocation.id}`);
      if (!response.ok) throw new Error('Failed to load products');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Errore caricamento prodotti');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleLocationScanned(code: string) {
    if (!code) return;

    setLoading(true);
    setShowLocationScanner(false);

    try {
      // Usa la stessa API della pagina ubicazioni
      const response = await fetch('/api/inventory/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locationCode: code })
      });

      const data = await response.json();

      if (data.success && data.location) {
        setSelectedLocation(data.location);
        toast.success(`Ubicazione: ${data.location.complete_name || data.location.name}`);
        setStep('products');
      } else {
        toast.error('Ubicazione non trovata');
      }
    } catch (error: any) {
      console.error('Errore scansione ubicazione:', error);
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleProductSelect(product: any) {
    setSelectedProduct(product);
    setQuantity('1');
    setStep('form');
  }

  function handlePhotosCaptured(photoBase64: string) {
    // PhotoCapture può ritornare una singola foto o un JSON array
    try {
      const parsed = JSON.parse(photoBase64);
      if (Array.isArray(parsed)) {
        setPhotos(prev => [...prev, ...parsed].slice(0, 3));
      } else {
        setPhotos(prev => [...prev, photoBase64].slice(0, 3));
      }
    } catch {
      // È una singola foto base64
      setPhotos(prev => [...prev, photoBase64].slice(0, 3));
    }
    setShowPhotoCapture(false);
  }

  function handleRemovePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleConfirmWaste() {
    // Validation
    if (!selectedProduct) {
      toast.error('Seleziona un prodotto');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Inserisci quantità valida');
      return;
    }
    if (!reason) {
      toast.error('Seleziona motivo dello scarto');
      return;
    }
    if (photos.length === 0) {
      toast.error('Aggiungi almeno una foto');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        productId: selectedProduct.id,
        sourceLocationId: selectedLocation.id,
        quantity: parseFloat(quantity),
        lotName: selectedProduct.lot_name,
        lotId: selectedProduct.lot_id,
        expiryDate: selectedProduct.expiration_date,
        reason,
        notes,
        photos
      };

      console.log('🗑️ Payload waste transfer:', payload);

      const response = await fetch('/api/waste/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transfer failed');
      }

      toast.success('Scarto registrato con successo');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating waste transfer:', error);
      toast.error(error.message || 'Errore durante registrazione scarto');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Gestione Scarto</h2>
                  <p className="text-sm text-gray-600">
                    {step === 'location' && 'Seleziona ubicazione'}
                    {step === 'products' && 'Seleziona prodotto'}
                    {step === 'form' && 'Dettagli scarto'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-white/50 flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 border-b border-gray-200">
              <div className={`flex items-center gap-2 ${step === 'location' ? 'text-red-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'location' ? 'bg-red-100' : 'bg-gray-200'}`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium hidden sm:inline">Ubicazione</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`flex items-center gap-2 ${step === 'products' ? 'text-red-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'products' ? 'bg-red-100' : 'bg-gray-200'}`}>
                  <Package className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium hidden sm:inline">Prodotto</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`flex items-center gap-2 ${step === 'form' ? 'text-red-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'form' ? 'bg-red-100' : 'bg-gray-200'}`}>
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium hidden sm:inline">Dettagli</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* STEP 1: Location Selection */}
              {step === 'location' && (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Seleziona Ubicazione Origine</h3>
                    <p className="text-gray-600 mb-6">Scansiona il QR code dell'ubicazione da cui prelevare la merce da scartare</p>

                    <button
                      onClick={() => setShowLocationScanner(true)}
                      className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-3 mx-auto"
                    >
                      <QrCode className="w-6 h-6" />
                      Scansiona Ubicazione
                    </button>
                  </div>

                  {selectedLocation && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-sm text-green-700 font-medium">Ubicazione selezionata:</p>
                          <p className="text-green-900 font-semibold">{selectedLocation.name}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setStep('products')}
                        className="mt-4 w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                      >
                        Continua
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Product Selection */}
              {step === 'products' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setStep('location')}
                      className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Cambia ubicazione
                    </button>
                    <div className="text-sm text-gray-600">
                      {products.length} prodotti disponibili
                    </div>
                  </div>

                  {loadingProducts ? (
                    <div className="text-center py-12">
                      <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-red-600 rounded-full animate-spin"></div>
                      <p className="text-gray-600 mt-4">Caricamento prodotti...</p>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">Nessun prodotto disponibile in questa ubicazione</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                      {products.map((product) => (
                        <div
                          key={`${product.id}-${product.lot_name}`}
                          className="glass p-3 rounded-xl cursor-pointer active:scale-95 hover:scale-105 transition-transform touch-manipulation"
                          onClick={() => handleProductSelect(product)}
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

                          {product.lot_name && (
                            <div className="text-xs text-blue-400 mt-1">
                              Lotto: {product.lot_name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Waste Form */}
              {step === 'form' && selectedProduct && (
                <div className="space-y-6">
                  <button
                    onClick={() => setStep('products')}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 mb-4"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Cambia prodotto
                  </button>

                  {/* Selected Product Card */}
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
                    <div className="flex gap-4">
                      {selectedProduct.image ? (
                        <img
                          src={selectedProduct.image}
                          alt={selectedProduct.name}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{selectedProduct.name}</h3>
                        <p className="text-sm text-gray-600">Cod: {selectedProduct.code || selectedProduct.id}</p>
                        <p className="text-sm text-gray-600">Disponibile: {selectedProduct.quantity} {selectedProduct.uom || 'pz'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantità da scartare *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                        placeholder="0"
                        min="0.01"
                        step="0.01"
                      />
                      <button
                        onClick={() => setShowCalculator(true)}
                        className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                      >
                        <CalculatorIcon className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      UdM: {selectedProduct.uom || 'pz'}
                    </p>
                  </div>

                  {/* Reason Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo dello scarto *
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                    >
                      <option value="">Seleziona motivo...</option>
                      {WASTE_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note aggiuntive
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all resize-none"
                      placeholder="Aggiungi dettagli sullo scarto..."
                    />
                  </div>

                  {/* Destination (Fixed) */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Destinazione
                    </label>
                    <div className="flex items-center gap-2 text-gray-900 font-semibold">
                      <MapPin className="w-5 h-5 text-red-600" />
                      {WASTE_LOCATION.name}
                    </div>
                  </div>

                  {/* Photos Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Documentazione fotografica * (almeno 1 foto)
                    </label>

                    {/* Photo Grid */}
                    {photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        {photos.map((photo, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                            <Image
                              src={photo}
                              alt={`Foto scarto ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                            <button
                              onClick={() => handleRemovePhoto(index)}
                              className="absolute top-2 right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Photo Button */}
                    {photos.length < 3 && (
                      <button
                        onClick={() => setShowPhotoCapture(true)}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-red-600"
                      >
                        <Camera className="w-5 h-5" />
                        <span className="font-medium">Aggiungi Foto ({photos.length}/3)</span>
                      </button>
                    )}
                  </div>

                  {/* Validation Warning */}
                  {(!quantity || parseFloat(quantity) <= 0 || !reason || photos.length === 0) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-1">Completa tutti i campi obbligatori:</p>
                        <ul className="list-disc list-inside space-y-1 text-yellow-700">
                          {(!quantity || parseFloat(quantity) <= 0) && <li>Quantità da scartare</li>}
                          {!reason && <li>Motivo dello scarto</li>}
                          {photos.length === 0 && <li>Almeno una foto</li>}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              {step === 'form' && (
                <button
                  onClick={handleConfirmWaste}
                  disabled={loading || !quantity || parseFloat(quantity) <= 0 || !reason || photos.length === 0}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Registrazione in corso...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Conferma Scarto
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* QR Scanner Modal */}
      {showLocationScanner && (
        <QRScanner
          isOpen={showLocationScanner}
          onClose={() => setShowLocationScanner(false)}
          onScan={handleLocationScanned}
          title="Scansiona Ubicazione"
        />
      )}

      {/* Calculator Modal */}
      {showCalculator && (
        <Calculator
          isOpen={showCalculator}
          onClose={() => setShowCalculator(false)}
          onConfirm={(value) => {
            setQuantity(value);
            setShowCalculator(false);
          }}
          initialValue={quantity}
        />
      )}

      {/* Photo Capture Modal */}
      {showPhotoCapture && (
        <PhotoCapture
          isOpen={showPhotoCapture}
          onClose={() => setShowPhotoCapture(false)}
          onCapture={handlePhotosCaptured}
          maxPhotos={3 - photos.length}
        />
      )}
    </>
  );
}
