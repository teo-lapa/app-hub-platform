'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Truck,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader,
  ChevronRight,
  Zap
} from 'lucide-react';

interface Arrival {
  id: number;
  name: string;
  partner_id: number;
  partner_name: string;
  scheduled_date: string;
  state: string;
  origin: string;
  purchase_order_id: number | null;
  purchase_order_name: string | null;
  attachments_count: number;
  products_count: number;
  has_purchase_order: boolean;
  has_attachments: boolean;
  is_ready: boolean;
  is_completed: boolean; // 🆕
}

interface TodayArrivalsListProps {
  onSelectArrival: (arrival: Arrival) => void;
}

export default function TodayArrivalsList({ onSelectArrival }: TodayArrivalsListProps) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [classifying, setClassifying] = useState<number | null>(null);

  useEffect(() => {
    loadArrivals();
  }, []);

  const loadArrivals = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/arrivo-merce/list-today', {
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il caricamento');
      }

      console.log('✅ Arrivi caricati:', data.arrivals.length);
      setArrivals(data.arrivals);

    } catch (err: any) {
      console.error('❌ Errore caricamento arrivi:', err);
      setError(err.message || 'Errore durante il caricamento degli arrivi');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (arrival: Arrival) => {
    // Non permettere selezione se già completato
    if (arrival.is_completed) {
      alert('Questo arrivo è già stato completato!');
      return;
    }

    setSelectedId(arrival.id);
    onSelectArrival(arrival);
  };

  const handleClassifyDocuments = async (e: React.MouseEvent, arrivalId: number, arrivalName: string) => {
    e.stopPropagation(); // Non triggerare onSelectArrival

    const confirm = window.confirm(
      `Vuoi classificare tutti i documenti PDF di ${arrivalName} con AI?\n\nQuesto rinominerà i file in base al tipo (FATTURA, ORDINE, DDT, etc.)`
    );

    if (!confirm) return;

    setClassifying(arrivalId);

    try {
      const response = await fetch('/api/arrivo-merce/classify-attachments', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ picking_id: arrivalId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la classificazione');
      }

      alert(data.message || 'Documenti classificati con successo!');

      // Ricarica gli arrivi per mostrare i nuovi nomi
      loadArrivals();

    } catch (error: any) {
      console.error('Errore classificazione:', error);
      alert(error.message || 'Errore durante la classificazione dei documenti');
    } finally {
      setClassifying(null);
    }
  };

  // 🆕 Funzione per aprire link Odoo
  const openOdooLink = (e: React.MouseEvent, model: string, id: number) => {
    e.stopPropagation(); // Non triggerare onSelectArrival

    // URL base Odoo (prendi da env o usa default)
    const odooBaseUrl = 'https://lapa.ch';
    const url = `${odooBaseUrl}/web#id=${id}&model=${model}&view_type=form`;

    window.open(url, '_blank');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'assigned': return 'bg-green-100 text-green-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'assigned': return 'Pronto';
      case 'confirmed': return 'Confermato';
      case 'waiting': return 'In Attesa';
      default: return state;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Caricamento arrivi...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Errore</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={loadArrivals}
              className="mt-3 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (arrivals.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Nessun arrivo previsto oggi
        </h3>
        <p className="text-gray-500">
          Non ci sono ricezioni programmate per oggi
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          📦 Arrivi di Oggi ({arrivals.length})
        </h2>
        <button
          onClick={loadArrivals}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aggiorna
        </button>
      </div>

      {arrivals.map((arrival, index) => (
        <motion.div
          key={arrival.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => handleSelect(arrival)}
          className={`
            bg-white rounded-xl border-2 p-4 transition-all
            ${arrival.is_completed
              ? 'opacity-60 cursor-not-allowed border-green-300 bg-green-50'
              : 'cursor-pointer hover:shadow-lg hover:scale-[1.02]'
            }
            ${selectedId === arrival.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
            ${!arrival.is_ready && !arrival.is_completed ? 'opacity-75' : ''}
          `}
        >
          <div className="flex items-start justify-between">
            {/* Left: Info principale */}
            <div className="flex-1">
              {/* Nome picking + Badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {/* Nome picking CLICCABILE */}
                <button
                  onClick={(e) => openOdooLink(e, 'stock.picking', arrival.id)}
                  className="font-bold text-blue-600 hover:text-blue-800 underline text-lg"
                  title="Apri in Odoo"
                >
                  {arrival.name}
                </button>

                {/* Badge COMPLETATO */}
                {arrival.is_completed && (
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-600 text-white flex items-center gap-1">
                    <CheckCircle size={12} />
                    COMPLETATO
                  </span>
                )}

                {/* Badge stato normale */}
                {!arrival.is_completed && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(arrival.state)}`}>
                    {getStateLabel(arrival.state)}
                  </span>
                )}
              </div>

              {/* Fornitore */}
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <Truck size={16} className="text-blue-600" />
                <span className="font-medium">{arrival.partner_name}</span>
              </div>

              {/* Dettagli in riga */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {/* Orario */}
                <div className="flex items-center gap-1">
                  <Clock size={14} className="text-purple-600" />
                  <span>{formatTime(arrival.scheduled_date)}</span>
                </div>

                {/* Prodotti */}
                <div className="flex items-center gap-1">
                  <Package size={14} className="text-green-600" />
                  <span>{arrival.products_count} prodotti</span>
                </div>

                {/* P.O. CLICCABILE */}
                {arrival.has_purchase_order && arrival.purchase_order_id ? (
                  <div className="flex items-center gap-1">
                    <FileText size={14} className="text-orange-600" />
                    <button
                      onClick={(e) => openOdooLink(e, 'purchase.order', arrival.purchase_order_id!)}
                      className="text-orange-600 hover:text-orange-800 underline font-medium"
                      title="Apri P.O. in Odoo"
                    >
                      {arrival.purchase_order_name}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle size={14} />
                    <span>P.O. non trovato</span>
                  </div>
                )}

                {/* Allegati + Pulsante Classifica */}
                {arrival.has_attachments ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle size={14} />
                      <span>{arrival.attachments_count} allegati 📎</span>
                    </div>
                    <button
                      onClick={(e) => handleClassifyDocuments(e, arrival.id, arrival.name)}
                      disabled={classifying === arrival.id}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="Classifica i documenti PDF con AI"
                    >
                      {classifying === arrival.id ? (
                        <>
                          <Loader size={12} className="animate-spin" />
                          <span>Classificando...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={12} />
                          <span>Classifica</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle size={14} />
                    <span>Nessun allegato</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Status indicator + arrow */}
            <div className="flex items-center gap-2">
              {arrival.is_ready ? (
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              ) : (
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              )}
              <ChevronRight className="text-gray-400" size={20} />
            </div>
          </div>

          {/* Warning se non pronto */}
          {!arrival.is_ready && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
              <AlertTriangle size={12} className="inline mr-1" />
              {!arrival.has_purchase_order && 'Ordine di acquisto non trovato. '}
              {!arrival.has_attachments && 'Nessun allegato disponibile. '}
              Carica manualmente la fattura.
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
