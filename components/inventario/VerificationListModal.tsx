'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, MapPin, Calendar, CheckCircle, Clock, Camera, QrCode } from 'lucide-react';
import { QRScanner } from './QRScanner';
import toast from 'react-hot-toast';

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

interface VerificationListModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: VerificationRequest[];
  onRefresh: () => void;
}

export function VerificationListModal({
  isOpen,
  onClose,
  requests,
  onRefresh,
}: VerificationListModalProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifying, setVerifying] = useState(false);

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

  const handleScanLocation = (scannedCode: string) => {
    setShowScanner(false);

    // Cerca richiesta con ubicazione corrispondente
    const matchedRequest = requests.find(
      (req) =>
        req.location_name?.includes(scannedCode) ||
        req.location_id.toString() === scannedCode
    );

    if (matchedRequest) {
      setSelectedRequest(matchedRequest);
      setShowVerifyModal(true);
      toast.success(`✅ Trovata richiesta per ${matchedRequest.product_name}`);
    } else {
      toast.error('❌ Nessuna richiesta trovata per questa ubicazione');
    }
  };

  const handleVerify = async () => {
    if (!selectedRequest) return;

    setVerifying(true);
    try {
      const response = await fetch('/api/verification-requests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestId: selectedRequest.id,
          verifiedBy: 'inventory-user',
          note: verifyNote || 'Verificato da app inventario',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('✅ Verifica completata!');
        setShowVerifyModal(false);
        setSelectedRequest(null);
        setVerifyNote('');
        onRefresh();
      } else {
        toast.error(data.error || 'Errore durante verifica');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setVerifying(false);
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
                      Richieste di Verifica Inventario
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

            {/* Scanner QR Button */}
            <div className="p-4 bg-gradient-to-r from-purple-500/20 to-violet-500/20 border-b border-white/10">
              <button
                onClick={() => setShowScanner(true)}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                <QrCode className="w-6 h-6 text-purple-300" />
                <span className="font-semibold text-lg">Scansiona Ubicazione per Verificare</span>
              </button>
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
                      className="glass-strong p-6 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowVerifyModal(true);
                      }}
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
                  💡 Clicca su un prodotto o scansiona l'ubicazione per verificarlo
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </motion.div>

          {/* Scanner QR Modal */}
          {showScanner && (
            <div className="fixed inset-0 z-[60] bg-black">
              <QRScanner
                isOpen={showScanner}
                onClose={() => setShowScanner(false)}
                onScan={handleScanLocation}
              />
            </div>
          )}

          {/* Modal Verifica */}
          <AnimatePresence>
            {showVerifyModal && selectedRequest && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setShowVerifyModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="glass-strong rounded-2xl p-6 max-w-lg w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-purple-400" />
                    Verifica Prodotto
                  </h3>

                  <div className="mb-6 space-y-3">
                    <div className="glass p-4 rounded-lg">
                      <div className="font-semibold text-lg mb-2">
                        {selectedRequest.product_name}
                      </div>
                      <div className="text-sm text-slate-400 space-y-1">
                        <div>Ubicazione: {selectedRequest.location_name}</div>
                        {selectedRequest.lot_name && <div>Lotto: {selectedRequest.lot_name}</div>}
                        <div>Quantità: {selectedRequest.quantity}</div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Note verifica (opzionale)
                      </label>
                      <textarea
                        value={verifyNote}
                        onChange={(e) => setVerifyNote(e.target.value)}
                        placeholder="Es: Quantità verificata, tutto ok"
                        className="w-full glass px-4 py-3 rounded-lg border border-white/20 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 min-h-[100px]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowVerifyModal(false)}
                      className="flex-1 px-4 py-3 glass-strong rounded-lg hover:bg-white/10 transition-colors"
                      disabled={verifying}
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleVerify}
                      disabled={verifying}
                      className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {verifying ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Verifica in corso...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Completa Verifica
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
