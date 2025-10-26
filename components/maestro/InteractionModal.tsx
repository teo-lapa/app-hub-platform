'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Video, Mail, CheckCircle, XCircle, MinusCircle, Package, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { VehicleProductSelector } from '@/components/maestro/VehicleProductSelectorSimple';

interface InteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
  customerName: string;
  odooPartnerId: number;
  salesPersonId?: number; // ID del venditore per mostrare i suoi prodotti in macchina
}

type InteractionType = 'visit' | 'call' | 'email';
type Outcome = 'positive' | 'neutral' | 'negative';
type SampleFeedback = 'good' | 'bad' | 'indifferent';

interface SelectedProduct {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image?: string;
  uom: string;
  quantity: number;
}

export function InteractionModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  odooPartnerId,
  salesPersonId
}: InteractionModalProps) {
  const [interactionType, setInteractionType] = useState<InteractionType>('visit');
  const [outcome, setOutcome] = useState<Outcome>('neutral');
  const [sampleFeedback, setSampleFeedback] = useState<SampleFeedback>('indifferent');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [orderGenerated, setOrderGenerated] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Map outcome to API format
      const outcomeMap: Record<Outcome, 'successful' | 'unsuccessful' | 'neutral' | 'follow_up_needed'> = {
        positive: 'successful',
        negative: 'unsuccessful',
        neutral: 'neutral'
      };

      // Map samples to API format
      const samples_given = selectedProducts.map(product => ({
        product_id: product.id,
        product_name: product.name,
        quantity: product.quantity
      }));

      // 1. Se ci sono campioni dalla macchina, crea l'ordine confermato in Odoo
      let orderId: number | null = null;
      if (selectedProducts.length > 0) {
        const orderResponse = await fetch('/api/maestro/create-sample-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            odooPartnerId,
            customerName,
            salesPersonId,
            interactionType,
            outcome,
            sampleFeedback,
            notes,
            sampleProducts: selectedProducts.map(p => ({
              productId: p.id,
              productName: p.name,
              quantity: p.quantity,
              uom: p.uom
            }))
          })
        });

        const orderData = await orderResponse.json();

        if (orderData.success) {
          orderId = orderData.orderId;
          toast.success(`Ordine campioni ${orderId} creato e validato con successo!`, {
            duration: 5000,
            icon: '🎁'
          });
        } else {
          console.warn('Errore creazione ordine campioni:', orderData.error);
          toast.error('Errore nella creazione dell\'ordine campioni: ' + (orderData.error?.message || 'Errore sconosciuto'));
          return; // Non continuare se l'ordine fallisce
        }
      }

      // 2. Trova customer_avatar UUID dall'Odoo Partner ID
      const avatarResponse = await fetch(`/api/maestro/customers/${odooPartnerId}`);
      if (!avatarResponse.ok) {
        toast.error('Errore nel trovare il cliente');
        return;
      }
      const customerData = await avatarResponse.json();
      const customerAvatarId = String(customerData.customer.id); // UUID del customer_avatar (force string)

      console.log('🔍 Customer Avatar ID type:', typeof customerAvatarId, 'value:', customerAvatarId);

      // 3. Registra l'interazione nel sistema Maestro
      const interactionPayload: any = {
        customer_avatar_id: customerAvatarId,
        interaction_type: interactionType,
        outcome: outcomeMap[outcome],
        order_placed: orderGenerated || (orderId !== null),
      };

      // Aggiungi solo i campi opzionali se hanno valori validi
      if (samples_given.length > 0) {
        interactionPayload.samples_given = samples_given;
      }
      if (orderId !== null) {
        interactionPayload.odoo_order_id = orderId;
      }
      if (notes && notes.trim()) {
        interactionPayload.notes = notes.trim();
      }

      console.log('🔥 [FIX-VERSION-2] Payload pulito:', interactionPayload);

      const response = await fetch('/api/maestro/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interactionPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [FIX-VERSION-2] Error response:', errorData);
        throw new Error('Failed to save interaction');
      }

      toast.success('Interazione registrata con successo!');
      onClose();

      // Reset form
      setInteractionType('visit');
      setOutcome('neutral');
      setSelectedProducts([]);
      setSampleFeedback('indifferent');
      setOrderGenerated(false);
      setNotes('');
    } catch (error) {
      toast.error('Errore nel salvare l\'interazione');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <div>
                  <h2 className="text-2xl font-bold text-white">Registra Interazione</h2>
                  <p className="text-sm text-slate-400 mt-1">{customerName}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Interaction Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Tipo di interazione
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'visit', icon: Video, label: 'Visita' },
                      { value: 'call', icon: Phone, label: 'Chiamata' },
                      { value: 'email', icon: Mail, label: 'Email' }
                    ].map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => setInteractionType(value as InteractionType)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                          interactionType === value
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outcome */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Esito
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'positive', icon: CheckCircle, label: 'Positivo', color: 'green' },
                      { value: 'neutral', icon: MinusCircle, label: 'Neutrale', color: 'yellow' },
                      { value: 'negative', icon: XCircle, label: 'Negativo', color: 'red' }
                    ].map(({ value, icon: Icon, label, color }) => (
                      <button
                        key={value}
                        onClick={() => setOutcome(value as Outcome)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                          outcome === value
                            ? `border-${color}-500 bg-${color}-500/10 text-${color}-400`
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Samples Given - Vehicle Products Selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Campioni Omaggio dalla Macchina
                  </label>

                  {/* Selected Products List */}
                  {selectedProducts.length > 0 && (
                    <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
                      {selectedProducts.map((product) => (
                        <div
                          key={product.id}
                          className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex items-center gap-3"
                        >
                          {/* Product Image */}
                          <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-400" />
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-white truncate">{product.name}</h4>
                            <p className="text-xs text-slate-400">{product.code}</p>
                          </div>

                          {/* Quantity */}
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{product.quantity}</span>
                            <span className="text-xs text-slate-400">{product.uom}</span>
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => setSelectedProducts(selectedProducts.filter(p => p.id !== product.id))}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Button to Open Vehicle Selector */}
                  <button
                    onClick={() => setShowVehicleSelector(true)}
                    className="w-full p-4 bg-blue-500/10 border-2 border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all flex items-center justify-center gap-3 text-blue-400 hover:text-blue-300"
                  >
                    <Truck className="w-5 h-5" />
                    <span className="font-medium">
                      {selectedProducts.length > 0 ? 'Aggiungi Altri Campioni dalla Macchina' : 'Seleziona Campioni dalla Macchina'}
                    </span>
                  </button>

                  {/* Info Banner quando ci sono campioni selezionati */}
                  {selectedProducts.length > 0 && (
                    <div className="mt-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex gap-3">
                        <div className="text-2xl">🎁</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-green-400 mb-1">
                            Ordine Campioni Omaggio Confermato
                          </h4>
                          <p className="text-xs text-slate-300">
                            Confermando, verrà creato un <strong>ordine già confermato e validato</strong> in Odoo con:
                            prodotti dalla macchina (prezzo €0), picking automatico validato (prodotti consegnati),
                            tutte le note (tipo visita, esito, feedback) nel Chatter dell'ordine.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vehicle Product Selector Modal */}
                {showVehicleSelector && (
                  <VehicleProductSelector
                    salesPersonId={salesPersonId}
                    onConfirm={(products) => {
                      // Merge new products with existing ones
                      const existingIds = new Set(selectedProducts.map(p => p.id));
                      const newProducts = products.filter(p => !existingIds.has(p.id));
                      setSelectedProducts([...selectedProducts, ...newProducts]);
                      setShowVehicleSelector(false);
                    }}
                    onClose={() => setShowVehicleSelector(false)}
                  />
                )}

                {/* Sample Feedback */}
                {selectedProducts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Feedback campioni
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'good', label: 'Ottimo', color: 'green' },
                        { value: 'indifferent', label: 'Indifferente', color: 'yellow' },
                        { value: 'bad', label: 'Negativo', color: 'red' }
                      ].map(({ value, label, color }) => (
                        <button
                          key={value}
                          onClick={() => setSampleFeedback(value as SampleFeedback)}
                          className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                            sampleFeedback === value
                              ? `border-${color}-500 bg-${color}-500/10 text-${color}-400`
                              : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Generated */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderGenerated}
                      onChange={(e) => setOrderGenerated(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                    />
                    <span className="text-sm font-medium text-slate-300">
                      Ordine generato durante questa interazione
                    </span>
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Note
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Aggiungi note sulla visita, commenti del cliente, ecc..."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      {selectedProducts.length > 0 ? (
                        <>
                          🎁 Conferma e Crea Preventivo Campioni ({selectedProducts.length})
                        </>
                      ) : (
                        'Salva interazione'
                      )}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
