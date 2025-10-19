'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Video, Mail, CheckCircle, XCircle, MinusCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';

interface InteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
  customerName: string;
}

type InteractionType = 'visit' | 'call' | 'email';
type Outcome = 'positive' | 'neutral' | 'negative';
type SampleFeedback = 'good' | 'bad' | 'indifferent';

export function InteractionModal({
  isOpen,
  onClose,
  customerId,
  customerName
}: InteractionModalProps) {
  const [interactionType, setInteractionType] = useState<InteractionType>('visit');
  const [outcome, setOutcome] = useState<Outcome>('neutral');
  const [sampleFeedback, setSampleFeedback] = useState<SampleFeedback>('indifferent');
  const [samplesGiven, setSamplesGiven] = useState<string[]>([]);
  const [sampleInput, setSampleInput] = useState('');
  const [orderGenerated, setOrderGenerated] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSample = () => {
    if (sampleInput.trim()) {
      setSamplesGiven([...samplesGiven, sampleInput.trim()]);
      setSampleInput('');
    }
  };

  const handleRemoveSample = (index: number) => {
    setSamplesGiven(samplesGiven.filter((_, i) => i !== index));
  };

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
      const samples_given = samplesGiven.map(sample => ({
        product_id: 0, // Placeholder - future enhancement
        product_name: sample,
        quantity: 1
      }));

      const response = await fetch('/api/maestro/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_avatar_id: customerId.toString(),
          interaction_type: interactionType,
          outcome: outcomeMap[outcome],
          samples_given: samples_given.length > 0 ? samples_given : undefined,
          order_placed: orderGenerated,
          notes: notes || undefined
        })
      });

      if (!response.ok) throw new Error('Failed to save interaction');

      toast.success('Interazione registrata con successo!');
      onClose();

      // Reset form
      setInteractionType('visit');
      setOutcome('neutral');
      setSamplesGiven([]);
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

                {/* Samples Given */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Campioni consegnati
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={sampleInput}
                      onChange={(e) => setSampleInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSample()}
                      placeholder="Nome prodotto..."
                      className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleAddSample}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Aggiungi
                    </button>
                  </div>
                  {samplesGiven.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {samplesGiven.map((sample, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300"
                        >
                          <Package className="h-3 w-3" />
                          {sample}
                          <button
                            onClick={() => handleRemoveSample(idx)}
                            className="ml-1 hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sample Feedback */}
                {samplesGiven.length > 0 && (
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
                    'Salva interazione'
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
