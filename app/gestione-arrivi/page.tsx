'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Truck,
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  Zap,
  Eye,
  FileJson,
  Receipt
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  Arrival,
  ArrivalProcessingState,
  BatchProcessingState,
  ProcessingStatus
} from './types';

export default function GestioneArriviPage() {
  const router = useRouter();

  // Stati principali
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Batch processing
  const [batchState, setBatchState] = useState<BatchProcessingState>({
    is_running: false,
    total: 0,
    completed: 0,
    results: []
  });

  // Processing singolo
  const [processingArrival, setProcessingArrival] = useState<ArrivalProcessingState | null>(null);

  // Carica arrivi
  const loadArrivals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gestione-arrivi/list-today', {
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il caricamento');
      }

      setArrivals(data.arrivals);
      console.log('✅ Arrivi caricati:', data.arrivals.length);

    } catch (err: any) {
      console.error('❌ Errore:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArrivals();
  }, [loadArrivals]);

  // Processa un singolo arrivo
  const processArrival = async (arrival: Arrival): Promise<ArrivalProcessingState> => {
    const state: ArrivalProcessingState = {
      arrival_id: arrival.id,
      arrival_name: arrival.name,
      status: 'reading_documents',
      progress: 0,
      current_step: 'Lettura documenti...',
    };

    setProcessingArrival(state);

    try {
      // STEP 1: Leggi documenti
      state.status = 'reading_documents';
      state.progress = 10;
      state.current_step = 'Lettura documenti con AI...';
      setProcessingArrival({ ...state });

      const readResponse = await fetch('/api/gestione-arrivi/read-documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picking_id: arrival.id })
      });

      const readData = await readResponse.json();

      if (!readResponse.ok) {
        throw new Error(readData.error || 'Errore lettura documenti');
      }

      state.progress = 40;
      state.current_step = `Estratte ${readData.combined_lines?.length || 0} righe`;
      setProcessingArrival({ ...state });

      // STEP 2: Processa arrivo (matching + validazione + fattura)
      state.status = 'processing_arrival';
      state.progress = 50;
      state.current_step = 'Processamento arrivo...';
      setProcessingArrival({ ...state });

      // Prepara JSON di trascrizione
      const transcriptionJson = {
        source_picking_id: arrival.id,
        source_picking_name: arrival.name,
        extracted_at: new Date().toISOString(),
        documents_read: readData.documents?.map((d: any) => ({
          attachment_id: d.attachment_id,
          filename: d.filename,
          document_type: d.document_type
        })) || [],
        supplier: readData.supplier,
        invoice: readData.invoice_info,
        lines: readData.combined_lines
      };

      const processResponse = await fetch('/api/gestione-arrivi/process-arrival', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picking_id: arrival.id,
          extracted_lines: readData.combined_lines,
          attachment_ids: arrival.attachments?.map((a: any) => a.id) || [],
          transcription_json: transcriptionJson,
          skip_validation: false,
          skip_invoice: false
        })
      });

      const processData = await processResponse.json();

      if (!processResponse.ok) {
        throw new Error(processData.error || 'Errore processamento');
      }

      // Completato
      state.status = 'completed';
      state.progress = 100;
      state.current_step = 'Completato!';
      state.result = {
        success: true,
        picking_validated: processData.picking_validated,
        invoice_created: processData.invoice_created,
        invoice_id: processData.invoice_id,
        invoice_name: processData.invoice_name,
        documents_attached: processData.documents_attached,
        lines_updated: processData.lines_updated,
        lines_created: 0,
        lines_set_to_zero: processData.lines_set_to_zero,
        unmatched_products: processData.unmatched_products?.length || 0,
        errors: processData.errors || [],
        warnings: processData.warnings || []
      };

      setProcessingArrival({ ...state });
      return state;

    } catch (err: any) {
      state.status = 'error';
      state.error = err.message;
      state.current_step = 'Errore';
      setProcessingArrival({ ...state });
      return state;
    }
  };

  // Processa tutti gli arrivi (batch)
  const processAllArrivals = async () => {
    const toProcess = arrivals.filter(a => a.is_ready && !a.is_completed);

    if (toProcess.length === 0) {
      alert('Nessun arrivo pronto da processare');
      return;
    }

    setBatchState({
      is_running: true,
      total: toProcess.length,
      completed: 0,
      results: []
    });

    for (let i = 0; i < toProcess.length; i++) {
      const arrival = toProcess[i];

      setBatchState(prev => ({
        ...prev,
        completed: i,
        current_arrival: {
          arrival_id: arrival.id,
          arrival_name: arrival.name,
          status: 'pending',
          progress: 0,
          current_step: 'In attesa...'
        }
      }));

      const result = await processArrival(arrival);

      setBatchState(prev => ({
        ...prev,
        completed: i + 1,
        results: [...prev.results, result],
        current_arrival: undefined
      }));

      // Piccola pausa tra gli arrivi
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setBatchState(prev => ({
      ...prev,
      is_running: false
    }));

    // Ricarica la lista
    loadArrivals();
  };

  // Helper functions
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: ProcessingStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'pending': return 'bg-gray-400';
      default: return 'bg-blue-500';
    }
  };

  const readyArrivals = arrivals.filter(a => a.is_ready && !a.is_completed);
  const completedArrivals = arrivals.filter(a => a.is_completed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm border border-gray-200 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Torna al Dashboard</span>
          </button>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              🚀 Gestione Arrivi Automatica
            </h1>
            <p className="text-gray-600">
              Processa automaticamente tutti gli arrivi: lettura documenti → validazione → fattura bozza
            </p>
          </div>
        </motion.div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
            >
              <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
              <div>
                <h4 className="font-semibold text-red-900">Errore</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-600">Caricamento arrivi...</span>
          </div>
        )}

        {/* Main Content */}
        {!loading && (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{arrivals.length}</p>
                    <p className="text-sm text-gray-600">Arrivi Oggi</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Zap className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{readyArrivals.length}</p>
                    <p className="text-sm text-gray-600">Pronti da Processare</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CheckCircle className="text-purple-600" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{completedArrivals.length}</p>
                    <p className="text-sm text-gray-600">Completati</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Batch Processing Button */}
            <div className="mb-6">
              <button
                onClick={processAllArrivals}
                disabled={batchState.is_running || readyArrivals.length === 0}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
              >
                {batchState.is_running ? (
                  <>
                    <Loader className="animate-spin" size={24} />
                    <span>Processamento in corso... ({batchState.completed}/{batchState.total})</span>
                  </>
                ) : (
                  <>
                    <Play size={24} />
                    <span>Processa Tutti gli Arrivi ({readyArrivals.length})</span>
                  </>
                )}
              </button>
            </div>

            {/* Batch Progress */}
            {batchState.is_running && processingArrival && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-white rounded-xl shadow-lg border-2 border-indigo-200 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">
                    Processando: {processingArrival.arrival_name}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(processingArrival.status)}`}>
                    {processingArrival.current_step}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <motion.div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${processingArrival.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <p className="text-sm text-gray-600">
                  Progresso totale: {batchState.completed} / {batchState.total} arrivi
                </p>
              </motion.div>
            )}

            {/* Batch Results */}
            {batchState.results.length > 0 && !batchState.is_running && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6"
              >
                <h3 className="font-bold text-gray-900 mb-4">
                  Risultati Batch ({batchState.results.length} processati)
                </h3>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batchState.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        result.status === 'completed' ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {result.status === 'completed' ? (
                          <CheckCircle className="text-green-600" size={20} />
                        ) : (
                          <AlertTriangle className="text-red-600" size={20} />
                        )}
                        <span className="font-medium">{result.arrival_name}</span>
                      </div>
                      {result.result && (
                        <div className="text-sm text-gray-600">
                          {result.result.invoice_created && (
                            <span className="text-green-600">📄 {result.result.invoice_name}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setBatchState({ is_running: false, total: 0, completed: 0, results: [] })}
                  className="mt-4 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  <RotateCcw size={14} />
                  Cancella risultati
                </button>
              </motion.div>
            )}

            {/* Arrivals List */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  📦 Arrivi di Oggi
                </h2>
                <button
                  onClick={loadArrivals}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <RotateCcw size={14} />
                  Aggiorna
                </button>
              </div>

              {arrivals.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Nessun arrivo previsto oggi
                  </h3>
                </div>
              ) : (
                <div className="space-y-3">
                  {arrivals.map((arrival, index) => (
                    <motion.div
                      key={arrival.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`
                        bg-gray-50 rounded-xl border-2 p-4 transition-all
                        ${arrival.is_completed
                          ? 'opacity-60 border-green-300 bg-green-50'
                          : arrival.is_ready
                            ? 'border-indigo-200 hover:border-indigo-400 cursor-pointer hover:shadow-md'
                            : 'opacity-75 border-gray-200'
                        }
                      `}
                      onClick={() => {
                        if (!arrival.is_completed && arrival.is_ready && !batchState.is_running) {
                          processArrival(arrival);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Header */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-bold text-indigo-600 text-lg">
                              {arrival.name}
                            </span>

                            {arrival.is_completed && (
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-600 text-white flex items-center gap-1">
                                <CheckCircle size={12} />
                                COMPLETATO
                              </span>
                            )}

                            {!arrival.is_completed && arrival.is_ready && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                Pronto
                              </span>
                            )}

                            {!arrival.is_completed && !arrival.is_ready && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Non pronto
                              </span>
                            )}
                          </div>

                          {/* Fornitore */}
                          <div className="flex items-center gap-2 text-gray-700 mb-2">
                            <Truck size={16} className="text-indigo-600" />
                            <span className="font-medium">{arrival.partner_name}</span>
                          </div>

                          {/* Dettagli */}
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock size={14} className="text-purple-600" />
                              <span>{formatTime(arrival.scheduled_date)}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <Package size={14} className="text-green-600" />
                              <span>{arrival.products_count} prodotti</span>
                            </div>

                            {arrival.has_purchase_order && (
                              <div className="flex items-center gap-1">
                                <FileText size={14} className="text-orange-600" />
                                <span>{arrival.purchase_order_name}</span>
                              </div>
                            )}

                            {arrival.has_attachments && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle size={14} />
                                <span>{arrival.attachments_count} allegati</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-2">
                          {arrival.is_ready && !arrival.is_completed && (
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                          )}
                          <ChevronRight className="text-gray-400" size={20} />
                        </div>
                      </div>

                      {/* Warning */}
                      {!arrival.is_ready && !arrival.is_completed && (
                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
                          <AlertTriangle size={12} className="inline mr-1" />
                          {!arrival.has_purchase_order && 'Ordine non trovato. '}
                          {!arrival.has_attachments && 'Nessun allegato. '}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Single Processing Modal */}
        <AnimatePresence>
          {processingArrival && !batchState.is_running && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {processingArrival.status === 'completed' ? '✅ Completato!' :
                   processingArrival.status === 'error' ? '❌ Errore' :
                   '⏳ Processamento...'}
                </h2>

                <p className="text-lg text-gray-700 mb-4">
                  {processingArrival.arrival_name}
                </p>

                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                    <motion.div
                      className={`h-4 rounded-full ${
                        processingArrival.status === 'error' ? 'bg-red-500' :
                        processingArrival.status === 'completed' ? 'bg-green-500' :
                        'bg-indigo-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${processingArrival.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{processingArrival.current_step}</p>
                </div>

                {processingArrival.error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {processingArrival.error}
                  </div>
                )}

                {processingArrival.result && (
                  <div className="mb-4 space-y-2 text-sm">
                    {processingArrival.result.picking_validated && (
                      <p className="text-green-600">✅ Picking validato</p>
                    )}
                    {processingArrival.result.invoice_created && (
                      <p className="text-green-600">📄 Fattura creata: {processingArrival.result.invoice_name}</p>
                    )}
                    {processingArrival.result.documents_attached > 0 && (
                      <p className="text-blue-600">📎 {processingArrival.result.documents_attached} documenti allegati</p>
                    )}
                    {processingArrival.result.warnings.length > 0 && (
                      <div className="text-yellow-600">
                        ⚠️ Avvisi: {processingArrival.result.warnings.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => {
                    setProcessingArrival(null);
                    loadArrivals();
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {processingArrival.status === 'completed' || processingArrival.status === 'error'
                    ? 'Chiudi'
                    : 'Annulla'
                  }
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
