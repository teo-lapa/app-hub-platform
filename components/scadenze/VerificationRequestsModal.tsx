'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, MapPin, Calendar, CheckCircle, Clock } from 'lucide-react';

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
  requested_by: string;
  note: string | null;
}

interface VerificationRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: VerificationRequest[];
  onRefresh: () => void;
}

export function VerificationRequestsModal({
  isOpen,
  onClose,
  requests,
  onRefresh,
}: VerificationRequestsModalProps) {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'ora';
      if (diffMins < 60) return `${diffMins} minuti fa`;
      if (diffHours < 24) return `${diffHours} ore fa`;
      if (diffDays < 7) return `${diffDays} giorni fa`;
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-10 z-50 glass rounded-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Richieste di Verifica
                    </h2>
                    <p className="text-sm text-white/80">
                      {requests.length} {requests.length === 1 ? 'prodotto da verificare' : 'prodotti da verificare'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-12 h-12 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Nessuna richiesta</h3>
                  <p className="text-slate-400">
                    Al momento non ci sono prodotti in attesa di verifica
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {requests.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-strong p-6 rounded-xl hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Informazioni prodotto */}
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg mb-1 break-words">
                                {request.product_name || `Prodotto #${request.product_id}`}
                              </h3>
                              {request.lot_name && (
                                <div className="text-sm text-slate-400 mb-1">
                                  Lotto: <span className="text-slate-300">{request.lot_name}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Dettagli */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            {/* Ubicazione */}
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-4 h-4 text-blue-400" />
                              <span className="text-slate-400">Ubicazione:</span>
                              <span className="font-medium text-slate-200">
                                {request.location_name || `#${request.location_id}`}
                              </span>
                            </div>

                            {/* Quantità */}
                            <div className="flex items-center gap-2 text-sm">
                              <Package className="w-4 h-4 text-green-400" />
                              <span className="text-slate-400">Quantità:</span>
                              <span className="font-medium text-slate-200">
                                {request.quantity || 0}
                              </span>
                            </div>

                            {/* Data scadenza */}
                            {request.expiry_date && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-orange-400" />
                                <span className="text-slate-400">Scadenza:</span>
                                <span className="font-medium text-slate-200">
                                  {new Date(request.expiry_date).toLocaleDateString('it-IT')}
                                </span>
                              </div>
                            )}

                            {/* Richiesta da */}
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-purple-400" />
                              <span className="text-slate-400">Richiesta:</span>
                              <span className="font-medium text-slate-200">
                                {formatDate(request.requested_at)}
                              </span>
                            </div>
                          </div>

                          {/* Note */}
                          {request.note && (
                            <div className="bg-slate-800/50 rounded-lg p-3 mt-3">
                              <p className="text-sm text-slate-300">{request.note}</p>
                            </div>
                          )}

                          {/* Richiesto da */}
                          {request.requested_by && (
                            <div className="text-xs text-slate-500 mt-2">
                              Richiesto da: {request.requested_by}
                            </div>
                          )}
                        </div>

                        {/* Badge ID */}
                        <div className="shrink-0">
                          <div className="bg-purple-500/20 px-3 py-1 rounded-full">
                            <span className="text-xs font-mono text-purple-300">
                              #{request.id}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  💡 Vai all'app <strong>Gestione Inventario</strong> per verificare questi prodotti
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={onRefresh}
                    className="px-4 py-2 glass-strong rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Aggiorna
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold transition-colors"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
