'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Truck,
  AlertTriangle,
  CheckCircle,
  Loader,
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
  X,
  Camera,
  Search
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
  clienteId: number;
  dataPrevisita: string;
  salesOrder: string;
  outCompletato: string;
  prodottiNonScaricati: ProductNotDelivered[];
  messaggiScaricoParziale: PartialDischargeMessage[];
  haScarichiParziali: boolean;
  autista?: string;
  veicolo?: string;
  returnCreated?: boolean;
}

export default function ScarichiParzialiPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ResidualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderForMotivation, setSelectedOrderForMotivation] = useState<ResidualOrder | null>(null);
  const [processingProduct, setProcessingProduct] = useState<string | null>(null); // "orderNum|prodName"
  const [notFoundModal, setNotFoundModal] = useState<{ order: ResidualOrder; product: ProductNotDelivered } | null>(null);
  const [notFoundReason, setNotFoundReason] = useState('');
  const [productResults, setProductResults] = useState<Record<string, { success: boolean; message: string; aiResult?: any }>>({}); // key: "orderNum|prodName"
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ order: ResidualOrder; product: ProductNotDelivered } | null>(null);

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

  const openPickingInOdoo = async (pickingName: string) => {
    const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

    try {
      // Cerca l'ID del picking
      const response = await fetch('/api/scarichi-parziali/get-picking-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickingName })
      });

      const data = await response.json();

      if (data.success && data.pickingId) {
        // Apri direttamente il documento
        const url = `${odooUrl}/web#id=${data.pickingId}&model=stock.picking&view_type=form&cids=1&menu_id=146`;
        window.open(url, '_blank');
      } else {
        // Fallback: apri la lista
        const searchUrl = `${odooUrl}/web#action=stock.action_picking_tree_all&model=stock.picking&view_type=list&cids=1&menu_id=146`;
        window.open(searchUrl, '_blank');
      }
    } catch (error) {
      console.error('Errore apertura picking:', error);
      // Fallback: apri la lista
      const searchUrl = `${odooUrl}/web#action=stock.action_picking_tree_all&model=stock.picking&view_type=list&cids=1&menu_id=146`;
      window.open(searchUrl, '_blank');
    }
  };

  const openSalesOrderInOdoo = async (salesOrderName: string) => {
    const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

    try {
      // Cerca l'ID del sales order
      const response = await fetch('/api/scarichi-parziali/get-sales-order-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesOrderName })
      });

      const data = await response.json();

      if (data.success && data.salesOrderId) {
        // Apri direttamente il documento
        const url = `${odooUrl}/web#id=${data.salesOrderId}&model=sale.order&view_type=form&cids=1&menu_id=162`;
        window.open(url, '_blank');
      } else {
        // Fallback: apri la lista
        const searchUrl = `${odooUrl}/web#action=sale.action_orders&model=sale.order&view_type=list&cids=1&menu_id=162`;
        window.open(searchUrl, '_blank');
      }
    } catch (error) {
      console.error('Errore apertura sales order:', error);
      // Fallback: apri la lista
      const searchUrl = `${odooUrl}/web#action=sale.action_orders&model=sale.order&view_type=list&cids=1&menu_id=162`;
      window.open(searchUrl, '_blank');
    }
  };

  const productKey = (orderNum: string, prodName: string) => `${orderNum}|${prodName}`;

  const handlePhotoCapture = (order: ResidualOrder, product: ProductNotDelivered) => {
    setPendingPhoto({ order, product });
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingPhoto) return;

    const key = productKey(pendingPhoto.order.numeroOrdineResiduo, pendingPhoto.product.nome);
    setProcessingProduct(key);

    try {
      // Comprimi foto (max 1200px, qualità 70%) e converti in base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 1200;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = () => reject(new Error('Errore caricamento immagine'));
        img.src = URL.createObjectURL(file);
      });

      const response = await fetch('/api/scarichi-parziali/process-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'photo',
          product: pendingPhoto.product,
          order: {
            numeroOrdineResiduo: pendingPhoto.order.numeroOrdineResiduo,
            cliente: pendingPhoto.order.cliente,
            salesOrder: pendingPhoto.order.salesOrder
          },
          photo: base64,
          messaggiAutista: pendingPhoto.order.messaggiScaricoParziale
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setProductResults(prev => ({ ...prev, [key]: { success: true, message: data.message, aiResult: data.aiResult } }));
    } catch (err: any) {
      setProductResults(prev => ({ ...prev, [key]: { success: false, message: err.message } }));
    } finally {
      setProcessingProduct(null);
      setPendingPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleNotFound = async () => {
    if (!notFoundModal) return;
    const { order, product } = notFoundModal;
    const key = productKey(order.numeroOrdineResiduo, product.nome);
    setProcessingProduct(key);
    setNotFoundModal(null);

    try {
      const response = await fetch('/api/scarichi-parziali/process-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'not_found',
          product,
          order: {
            numeroOrdineResiduo: order.numeroOrdineResiduo,
            cliente: order.cliente,
            salesOrder: order.salesOrder
          },
          reason: notFoundReason,
          messaggiAutista: order.messaggiScaricoParziale
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setProductResults(prev => ({ ...prev, [key]: { success: true, message: data.message } }));
    } catch (err: any) {
      setProductResults(prev => ({ ...prev, [key]: { success: false, message: err.message } }));
    } finally {
      setProcessingProduct(null);
      setNotFoundReason('');
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {orders.map((order, index) => (
                <motion.div
                  key={order.numeroOrdineResiduo}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 relative">
                    {/* Pallino verde se transfer creato */}
                    {order.returnCreated && (
                      <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1.5 shadow-lg animate-pulse" title="Transfer già creato">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Truck className="w-5 h-5 text-white" />
                        <div>
                          <button
                            onClick={() => openPickingInOdoo(order.numeroOrdineResiduo)}
                            className="text-base font-bold text-white hover:text-orange-100 hover:underline flex items-center space-x-1 transition-colors"
                            title="Apri documento in Odoo"
                          >
                            <span>{order.numeroOrdineResiduo}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => openSalesOrderInOdoo(order.salesOrder)}
                            className="text-xs text-orange-100 hover:text-white hover:underline flex items-center space-x-1 transition-colors"
                            title="Apri Sales Order in Odoo"
                          >
                            <span>{order.salesOrder}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {order.prodottiNonScaricati && order.prodottiNonScaricati.length > 0 && (
                        <div className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                          <span className="text-xs font-semibold text-white">
                            {order.prodottiNonScaricati.length} prodotti
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info autista e veicolo */}
                    {(order.autista || order.veicolo) && (
                      <div className="flex items-center space-x-2 text-xs mt-1.5">
                        {order.autista && (
                          <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                            <User className="w-3 h-3 text-white" />
                            <span className="text-white font-medium">{order.autista}</span>
                          </div>
                        )}
                        {order.veicolo && (
                          <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                            <Car className="w-3 h-3 text-white" />
                            <span className="text-white font-medium">{order.veicolo}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="px-4 py-3 space-y-3">
                    {/* Cliente */}
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Cliente</p>
                        <p className="text-sm font-medium text-gray-900">{order.cliente}</p>
                      </div>
                    </div>

                    {/* Data */}
                    <div className="flex items-start space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
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
                    <div className="flex items-start space-x-2">
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          Motivazione scarico parziale
                        </p>
                        <button onClick={() => setSelectedOrderForMotivation(order)} className="w-full text-left text-xs text-gray-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5 hover:bg-yellow-100 cursor-pointer">
                          {getReasonSummary(order)}
                        </button>
                      </div>
                    </div>

                    {/* Prodotti non scaricati con azioni */}
                    {order.prodottiNonScaricati && order.prodottiNonScaricati.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <Package className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-semibold text-blue-900">
                            Prodotti nel furgone ({order.prodottiNonScaricati.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {order.prodottiNonScaricati.map((prod, idx) => {
                            const key = productKey(order.numeroOrdineResiduo, prod.nome);
                            const result = productResults[key];
                            const isProcessing = processingProduct === key;

                            return (
                              <div key={idx} className="bg-white rounded-lg p-2 border border-blue-100">
                                <div className="flex justify-between items-start text-xs mb-2">
                                  <span className="text-gray-700 flex-1 font-medium">{prod.nome}</span>
                                  <span className="font-semibold text-blue-700 ml-2 whitespace-nowrap">
                                    {prod.quantitaRichiesta - prod.quantitaEffettiva} {prod.uom}
                                  </span>
                                </div>

                                {result ? (
                                  <div className={`text-xs px-2 py-1.5 rounded ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                    {result.message}
                                    {result.aiResult && (
                                      <div className="mt-1 text-[10px] opacity-75">
                                        AI: {result.aiResult.labelText} ({result.aiResult.confidence})
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handlePhotoCapture(order, prod)}
                                      disabled={isProcessing}
                                      className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 text-xs font-semibold"
                                    >
                                      {isProcessing ? (
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Camera className="w-3.5 h-3.5" />
                                      )}
                                      <span>{isProcessing ? 'Elaboro...' : 'Foto'}</span>
                                    </button>
                                    <button
                                      onClick={() => { setNotFoundModal({ order, product: prod }); setNotFoundReason(''); }}
                                      disabled={isProcessing}
                                      className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 text-xs font-semibold"
                                    >
                                      <Search className="w-3.5 h-3.5" />
                                      <span>Non Trovato</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                  <p className="text-lg font-bold text-gray-900">{selectedOrderForMotivation.numeroOrdineResiduo}</p>
                </div>
                {selectedOrderForMotivation.messaggiScaricoParziale && selectedOrderForMotivation.messaggiScaricoParziale.length > 0 ? (
                  selectedOrderForMotivation.messaggiScaricoParziale.map((msg, idx) => (
                    <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">{msg.autore}</span>
                        <span className="text-xs text-gray-500">{new Date(msg.data).toLocaleString('it-IT')}</span>
                      </div>
                      {msg.messaggio && <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.messaggio}</p>}
                      {msg.allegati && msg.allegati.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {msg.allegati.map((att: any, i: number) => (
                            <div key={i} className="text-sm text-gray-600 flex items-center space-x-2">
                              {att.tipo?.includes('audio') ? <Volume2 className="w-4 h-4 text-gray-600" /> : <FileText className="w-4 h-4 text-gray-600" />}
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

      {/* Input file nascosto per camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modal Non Trovato */}
      <AnimatePresence>
        {notFoundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Prodotto Non Trovato</h3>
                <button onClick={() => setNotFoundModal(null)} className="text-white hover:bg-white/20 rounded-lg p-1.5"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Prodotto</p>
                  <p className="font-semibold text-gray-900">{notFoundModal.product.nome}</p>
                  <p className="text-sm text-gray-600">{notFoundModal.product.quantitaRichiesta - notFoundModal.product.quantitaEffettiva} {notFoundModal.product.uom}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Perché non è stato trovato?</label>
                  <textarea
                    value={notFoundReason}
                    onChange={(e) => setNotFoundReason(e.target.value)}
                    placeholder="Es: non presente nel buffer, prodotto danneggiato, ubicazione sbagliata..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    rows={3}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleNotFound}
                  disabled={!notFoundReason.trim()}
                  className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold disabled:opacity-50"
                >
                  Conferma Non Trovato
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
}
