'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Truck,
  AlertTriangle,
  CheckCircle,
  Loader,
  ArrowRight,
  MapPin,
  Calendar,
  FileText,
  Home,
  RefreshCw,
  User,
  Car,
  ExternalLink,
  Volume2,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PartialDischargeMessage {
  autore: string;
  data: string;
  messaggio: string;
  allegati: any[];
}

interface ProductNotDelivered {
  nome: string;
  quantitaRichiesta: number;
  quantitaEffettiva: number;
  uom: string;
}

interface ResidualOrder {
  numeroOrdineResiduo: string;
  cliente: string;
  dataPrevisita: string;
  salesOrder: string;
  outCompletato: string;
  prodottiNonScaricati: ProductNotDelivered[];
  messaggiScaricoParziale: PartialDischargeMessage[];
  haScarichiParziali: boolean;
}

export default function ScarichiParzialiPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ResidualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingTransfer, setCreatingTransfer] = useState<string | null>(null);
  const [selectedOrderForMotivation, setSelectedOrderForMotivation] = useState<ResidualOrder | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/scarichi-parziali/list');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore caricamento ordini');
      }

      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Errore caricamento:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReturn = async (order: ResidualOrder) => {
    if (!order.prodottiNonScaricati || order.prodottiNonScaricati.length === 0) {
      alert('Nessun prodotto da rientrare');
      return;
    }

    const confirmMsg = `Creare il reso per l'ordine ${order.numeroOrdineResiduo}?\n\n` +
      `Cliente: ${order.cliente}\n` +
      `Prodotti: ${order.prodottiNonScaricati.length} articoli non consegnati`;

    if (!confirm(confirmMsg)) return;

    try {
      setCreatingTransfer(order.numeroOrdineResiduo);

      const response = await fetch('/api/scarichi-parziali/create-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordine: order
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore creazione reso');
      }

      alert(`✅ Reso creato con successo!\n\n${data.message}`);

      // Ricarica ordini
      await loadOrders();

    } catch (err: any) {
      console.error('Errore creazione reso:', err);
      alert(`❌ Errore: ${err.message}`);
    } finally {
      setCreatingTransfer(null);
    }
  };

  const getReasonSummary = (order: ResidualOrder): string => {
    if (!order.haScarichiParziali || !order.messaggiScaricoParziale || order.messaggiScaricoParziale.length === 0) {
      return 'Nessuna motivazione registrata';
    }

    const firstMessage = order.messaggiScaricoParziale[0];
    const text = firstMessage.messaggio || '';

    // Estrai testo significativo (rimuovi formattazioni)
    const cleanText = text
      .replace(/⚠️/g, '')
      .replace(/🎤/g, '')
      .replace(/\*\*/g, '')
      .replace(/SCARICO PARZIALE/g, '')
      .replace(/Giustificazione autista/g, '')
      .replace(/Audio registrato/g, '')
      .replace(/vedi allegato/g, '')
      .replace(/\n/g, ' ')
      .trim();

    if (cleanText && cleanText.length > 5) {
      return cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : '');
    }

    if (firstMessage.allegati && firstMessage.allegati.length > 0) {
      return `${firstMessage.allegati.length} allegato/i (audio/foto/testo)`;
    }

    return 'Motivazione presente (vedi dettagli)';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Caricamento ordini residui...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestione Scarichi Parziali
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {orders.length} ordini residui con prodotti in furgone
                </p>
              </div>
            </div>
            <button
              onClick={loadOrders}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Ricarica</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-800">Errore</h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Nessun ordine residuo
            </h2>
            <p className="text-gray-600">
              Tutti gli ordini sono stati completati!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {orders.map((order, index) => (
                <motion.div
                  key={order.numeroOrdineResiduo}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Truck className="w-6 h-6 text-white" />
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {order.numeroOrdineResiduo}
                          </h3>
                          <p className="text-sm text-orange-100">
                            {order.salesOrder}
                          </p>
                        </div>
                      </div>
                      {order.prodottiNonScaricati && order.prodottiNonScaricati.length > 0 && (
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-sm font-semibold text-white">
                            {order.prodottiNonScaricati.length} prodotti
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="px-6 py-4 space-y-4">
                    {/* Cliente */}
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Cliente</p>
                        <p className="text-sm font-medium text-gray-900">{order.cliente}</p>
                      </div>
                    </div>

                    {/* Data */}
                    <div className="flex items-start space-x-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Data prevista</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(order.dataPrevisita).toLocaleDateString('it-IT', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Motivazione */}
                    <div className="flex items-start space-x-3">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          Motivazione scarico parziale
                        </p>
                        <button onClick={() => setSelectedOrderForMotivation(order)} className="w-full text-left text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 hover:bg-yellow-100 cursor-pointer">
                          {getReasonSummary(order)}
                        </button>
                      </div>
                    </div>

                    {/* Prodotti non scaricati */}
                    {order.prodottiNonScaricati && order.prodottiNonScaricati.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Package className="w-4 h-4 text-blue-600" />
                          <h4 className="text-sm font-semibold text-blue-900">
                            Prodotti nel furgone ({order.prodottiNonScaricati.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {order.prodottiNonScaricati.slice(0, 3).map((prod, idx) => (
                            <div key={idx} className="flex justify-between items-start text-xs">
                              <span className="text-gray-700 flex-1">{prod.nome}</span>
                              <span className="font-semibold text-blue-700 ml-2">
                                {prod.quantitaRichiesta - prod.quantitaEffettiva} {prod.uom}
                              </span>
                            </div>
                          ))}
                          {order.prodottiNonScaricati.length > 3 && (
                            <p className="text-xs text-gray-500 italic">
                              + altri {order.prodottiNonScaricati.length - 3} prodotti...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <button
                      onClick={() => handleCreateReturn(order)}
                      disabled={
                        creatingTransfer === order.numeroOrdineResiduo ||
                        !order.prodottiNonScaricati ||
                        order.prodottiNonScaricati.length === 0
                      }
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {creatingTransfer === order.numeroOrdineResiduo ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          <span>Creazione in corso...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-5 h-5" />
                          <span>Crea Reso Furgone → Buffer</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

      {/* Modal Motivazione Completa */}
      <AnimatePresence>
        {selectedOrderForMotivation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-white" />
                  <h3 className="text-xl font-bold text-white">Motivazione Scarico Parziale</h3>
                </div>
                <button onClick={() => setSelectedOrderForMotivation(null)} className="text-white hover:bg-white/20 rounded-lg p-2"><X className="w-6 h-6" /></button>
              </div>
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Ordine</p>
                  <p className="text-lg font-bold">{selectedOrderForMotivation.numeroOrdineResiduo}</p>
                </div>
                {selectedOrderForMotivation.messaggiScaricoParziale && selectedOrderForMotivation.messaggiScaricoParziale.length > 0 ? (
                  selectedOrderForMotivation.messaggiScaricoParziale.map((msg, idx) => (
                    <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{msg.autore}</span>
                        <span className="text-xs text-gray-500">{new Date(msg.data).toLocaleString('it-IT')}</span>
                      </div>
                      {msg.messaggio && <p className="text-sm whitespace-pre-wrap">{msg.messaggio}</p>}
                      {msg.allegati && msg.allegati.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {msg.allegati.map((att: any, i: number) => (
                            <div key={i} className="text-sm flex items-center space-x-2">
                              {att.tipo?.includes('audio') ? <Volume2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              <span>{att.nome}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">Nessuna motivazione</p>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t">
                <button onClick={() => setSelectedOrderForMotivation(null)} className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800">Chiudi</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
}
