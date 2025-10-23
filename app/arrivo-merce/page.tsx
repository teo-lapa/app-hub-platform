'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Search,
  CheckCircle,
  XCircle,
  Loader,
  Package,
  AlertTriangle,
  Calendar,
  Hash,
  Truck,
  ArrowLeft,
  Home
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import UnmatchedProductsHandler from '@/components/arrivo-merce/UnmatchedProductsHandler';
import TodayArrivalsList from '@/components/arrivo-merce/TodayArrivalsList';
import AttachmentSelector from '@/components/arrivo-merce/AttachmentSelector';

interface ParsedProduct {
  article_code?: string;
  description: string;
  quantity: number;
  unit: string;
  lot_number?: string;
  expiry_date?: string;
  variant?: string;
}

interface ParsedInvoice {
  supplier_name: string;
  supplier_vat?: string;
  document_number: string;
  document_date: string;
  products: ParsedProduct[];
}

interface IdentifiedSupplier {
  id: number;
  name: string;
  vat: string;
  match_score: number;
}

interface OdooPicking {
  id: number;
  name: string;
  partner_name: string;
  scheduled_date: string;
  state: string;
  origin: string;
  products_count?: number;
  total_qty?: number;
  date_match_score?: number;
}

export default function ArrivoMercePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0); // Step: 0=Lista, 1=Allegati, 2=Upload, 3=Verifica, 4=Trova, 5=Completa
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🆕 Step 0: Selected arrival from list
  const [selectedArrival, setSelectedArrival] = useState<any | null>(null);

  // 🆕 Step 0.5: Attachments from P.O.
  const [availableAttachments, setAvailableAttachments] = useState<any[]>([]);
  const [recommendedAttachment, setRecommendedAttachment] = useState<any | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Step 1: Upload file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Step 2: Parsed data
  const [parsedInvoice, setParsedInvoice] = useState<ParsedInvoice | null>(null);
  const [identifiedSuppliers, setIdentifiedSuppliers] = useState<IdentifiedSupplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<IdentifiedSupplier | null>(null);

  // Step 3: Odoo picking found
  const [availableReceptions, setAvailableReceptions] = useState<OdooPicking[]>([]);
  const [odooPicking, setOdooPicking] = useState<OdooPicking | null>(null);
  const [odooMoveLines, setOdooMoveLines] = useState<any[]>([]);
  const [alternatives, setAlternatives] = useState<any[]>([]);

  // Step 4: Processing results
  const [results, setResults] = useState<any>(null);
  const [processingBatch, setProcessingBatch] = useState<{ current: number; total: number } | null>(null);

  // Step 3.5: Unmatched products handling
  const [unmatchedProducts, setUnmatchedProducts] = useState<any[]>([]);
  const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);

  // Handle resume from Product Creator
  useEffect(() => {
    const resume = searchParams?.get('resume');
    if (resume === 'true') {
      const savedState = sessionStorage.getItem('arrivo_merce_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        console.log('📦 Ripristino stato da Product Creator:', state);

        // Se c'è un prodotto creato, aggiungi al picking
        if (state.createdProductId && state.pickingId) {
          handleProductCreatedCallback(state.createdProductId, state.pickingId, state);
        }
      }
    }
  }, [searchParams]);

  const handleProductCreatedCallback = async (productId: number, pickingId: number, state: any) => {
    try {
      // Aggiungi il prodotto creato al picking
      const response = await fetch('/api/arrivo-merce/add-product-to-picking', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          picking_id: pickingId,
          product_id: productId,
          quantity: state.productToCreate.quantity,
          lot_number: state.productToCreate.lot_number,
          expiry_date: state.productToCreate.expiry_date,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Prodotto creato aggiunto al picking!', data);

        // Ripristina lo stato
        setUnmatchedProducts(state.unmatchedProducts);
        setOdooPicking({ id: pickingId } as any);

        // Rimuovi il prodotto processato e continua
        const remainingProducts = state.unmatchedProducts.slice(state.currentIndex + 1);
        if (remainingProducts.length > 0) {
          setUnmatchedProducts(remainingProducts);
          setShowUnmatchedModal(true);
        } else {
          // Tutti i prodotti gestiti, vai ai risultati
          setStep(4);
        }

        // Pulisci sessionStorage
        sessionStorage.removeItem('arrivo_merce_state');
      } else {
        console.error('❌ Errore aggiunta prodotto:', data);
        alert(`Errore: ${data.error}`);
      }
    } catch (error: any) {
      console.error('❌ Errore callback prodotto creato:', error);
      alert(`Errore: ${error.message}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10 MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File troppo grande (${(file.size / 1024 / 1024).toFixed(2)} MB). Dimensione massima: 10 MB. Prova a ridurre la qualità del PDF.`);
      return;
    }

    // Warn for large files
    if (file.size > 5 * 1024 * 1024) {
      console.warn(`File grande (${(file.size / 1024 / 1024).toFixed(2)} MB) - il parsing potrebbe richiedere più tempo`);
    }

    setSelectedFile(file);
    setError(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleParsePDF = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/arrivo-merce/parse-invoice', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il parsing');
      }

      console.log('✅ Dati estratti:', data.data);
      setParsedInvoice(data.data);
      setStep(3);

    } catch (err: any) {
      console.error('❌ Errore parsing:', err);
      setError(err.message || 'Errore durante il parsing del documento');
    } finally {
      setLoading(false);
    }
  };

  // Sistema temporaneo: usa il vecchio find-reception che funziona
  const handleIdentifySupplier = async () => {
    if (!parsedInvoice) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/arrivo-merce/find-reception', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplier_name: parsedInvoice.supplier_name,
          supplier_vat: parsedInvoice.supplier_vat,
          document_number: parsedInvoice.document_number,
          document_date: parsedInvoice.document_date,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la ricerca della ricezione');
      }

      console.log('✅ Ricezione trovata:', data.picking);
      setOdooPicking(data.picking);
      setOdooMoveLines(data.move_lines);
      setAlternatives(data.alternatives || []);
      setStep(4);

    } catch (err: any) {
      console.error('❌ Errore ricerca ricezione:', err);
      setError(err.message || 'Errore durante la ricerca della ricezione');
    } finally {
      setLoading(false);
    }
  };

  const handleFindReceptionsBySupplier = async (supplierId: number) => {
    if (!parsedInvoice) return;

    setLoading(true);
    setError(null);

    try {
      // STEP 2: Cerca ricezioni per questo fornitore
      const receptionsResponse = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplier_id: supplierId,
          document_date: parsedInvoice.document_date,
          document_number: parsedInvoice.document_number,
          search_days: 7,
        }),
      });

      const receptionsData = await receptionsResponse.json();

      if (!receptionsResponse.ok) {
        throw new Error(receptionsData.error || 'Errore durante la ricerca delle ricezioni');
      }

      console.log('✅ Ricezioni trovate:', receptionsData);

      const receptions = receptionsData.receptions || [];
      setAvailableReceptions(receptions);

      if (receptions.length === 1 || receptionsData.suggested_action === 'use_first') {
        // Usa automaticamente la prima ricezione
        await handleLoadReceptionDetails(receptions[0].id);
      } else if (receptions.length > 1) {
        // Mostra la lista per selezione manuale
        setStep(2.75); // Step intermedio per selezione ricezione
      } else {
        throw new Error('Nessuna ricezione in attesa trovata per questo fornitore.');
      }

    } catch (err: any) {
      console.error('❌ Errore ricerca ricezioni:', err);
      setError(err.message || 'Errore durante la ricerca delle ricezioni');
      setLoading(false);
    }
  };

  const handleLoadReceptionDetails = async (pickingId: number) => {
    setLoading(true);
    setError(null);

    try {
      // STEP 3: Carica i dettagli completi della ricezione
      const detailsResponse = await fetch('/api/arrivo-merce/find-reception', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          picking_id: pickingId,
        }),
      });

      const detailsData = await detailsResponse.json();

      if (!detailsResponse.ok) {
        throw new Error(detailsData.error || 'Errore durante il caricamento dei dettagli');
      }

      console.log('✅ Dettagli ricezione caricati:', detailsData.picking);
      setOdooPicking(detailsData.picking);
      setOdooMoveLines(detailsData.move_lines);
      setStep(4);

    } catch (err: any) {
      console.error('❌ Errore caricamento dettagli:', err);
      setError(err.message || 'Errore durante il caricamento dei dettagli della ricezione');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReception = async () => {
    if (!parsedInvoice || !odooPicking || !odooMoveLines) return;

    setLoading(true);
    setError(null);

    try {
      const BATCH_SIZE = 10; // Processa 10 prodotti alla volta
      const totalProducts = parsedInvoice.products.length;
      const totalBatches = Math.ceil(totalProducts / BATCH_SIZE);

      console.log(`📦 Processamento in ${totalBatches} batch (${BATCH_SIZE} prodotti/batch)`);

      // Accumula risultati da tutti i batch
      let allUpdatedLines: any[] = [];
      let allCreatedLines: any[] = [];
      let allSetToZero: any[] = [];
      let allUnmatchedProducts: any[] = [];
      let allSupplierProductsUpdated: any[] = [];

      // Processa ogni batch
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalProducts);
        const batchProducts = parsedInvoice.products.slice(startIdx, endIdx);

        // Aggiorna UI con batch corrente
        setProcessingBatch({ current: batchIndex + 1, total: totalBatches });

        console.log(`\n🔄 Batch ${batchIndex + 1}/${totalBatches}: Processando prodotti ${startIdx + 1}-${endIdx}...`);

        const response = await fetch('/api/arrivo-merce/process-reception', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            picking_id: odooPicking.id,
            move_lines: odooMoveLines,
            parsed_products: batchProducts,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Errore nel batch ${batchIndex + 1}/${totalBatches}`);
        }

        console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} completato`);

        // Accumula risultati
        if (data.results) {
          if (Array.isArray(data.results.updated_lines)) {
            allUpdatedLines.push(...data.results.updated_lines);
          }
          if (Array.isArray(data.results.created_lines)) {
            allCreatedLines.push(...data.results.created_lines);
          }
          if (Array.isArray(data.results.set_to_zero)) {
            allSetToZero.push(...data.results.set_to_zero);
          }
          if (Array.isArray(data.results.unmatched_products)) {
            allUnmatchedProducts.push(...data.results.unmatched_products);
          }
          if (Array.isArray(data.results.supplier_products_updated)) {
            allSupplierProductsUpdated.push(...data.results.supplier_products_updated);
          }
        }
      }

      // Crea risultato aggregato
      const aggregatedResults = {
        updated_lines: allUpdatedLines,
        created_lines: allCreatedLines,
        set_to_zero: allSetToZero,
        unmatched_products: allUnmatchedProducts,
        supplier_products_updated: allSupplierProductsUpdated,
      };

      console.log('\n✅ Tutti i batch completati:', {
        updated: allUpdatedLines.length,
        created: allCreatedLines.length,
        set_to_zero: allSetToZero.length,
        unmatched: allUnmatchedProducts.length,
      });

      setResults(aggregatedResults);

      // Controlla se ci sono prodotti non matchati
      if (allUnmatchedProducts.length > 0) {
        console.log(`⚠️ Trovati ${allUnmatchedProducts.length} prodotti non matchati`);
        setUnmatchedProducts(allUnmatchedProducts);
        setShowUnmatchedModal(true);
      } else {
        // Nessun prodotto non matchato, vai direttamente ai risultati
        setStep(5);
      }

    } catch (err: any) {
      console.error('❌ Errore processamento:', err);
      setError(err.message || 'Errore durante il processamento della ricezione');
    } finally {
      setLoading(false);
      setProcessingBatch(null); // Reset batch indicator
    }
  };

  const handleReset = () => {
    setStep(0);
    setSelectedFile(null);
    setPreviewUrl(null);
    setParsedInvoice(null);
    setOdooPicking(null);
    setOdooMoveLines([]);
    setAlternatives([]);
    setResults(null);
    setError(null);
    setSelectedArrival(null);
    setAvailableAttachments([]);
    setRecommendedAttachment(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* Back to Dashboard Button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm border border-gray-200 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Torna al Dashboard</span>
          </button>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              📦 Arrivo Merce
            </h1>
            <p className="text-gray-600">
              Carica la fattura e compila automaticamente la ricezione in Odoo
            </p>
          </div>
        </motion.div>

        {/* Progress Steps - Solo da Step 2 in poi */}
        {step >= 2 && (
          <div className="mb-8">
            <div className="flex justify-between items-center max-w-3xl mx-auto">
              {[
                { num: 2, label: 'Carica Fattura', icon: Upload },
                { num: 3, label: 'Verifica Dati', icon: FileText },
                { num: 4, label: 'Trova Ricezione', icon: Search },
                { num: 5, label: 'Completa', icon: CheckCircle },
              ].map((s, idx) => (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        step >= s.num
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      } transition-all`}
                    >
                      {step > s.num ? (
                        <CheckCircle size={24} />
                      ) : (
                        <s.icon size={24} />
                      )}
                    </div>
                    <span className="text-xs mt-2 text-gray-600">{s.label}</span>
                  </div>
                  {idx < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        step > s.num ? 'bg-green-500' : 'bg-gray-200'
                      } transition-all`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
            >
              <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-red-900">Errore</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🆕 Step 0: Lista Arrivi di Oggi */}
        {step === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-lg p-8">
              <TodayArrivalsList
                onSelectArrival={async (arrival) => {
                  console.log('✅ Arrivo selezionato:', arrival);
                  setSelectedArrival(arrival);
                  setOdooPicking({
                    id: arrival.id,
                    name: arrival.name,
                    partner_name: arrival.partner_name,
                    scheduled_date: arrival.scheduled_date,
                    state: arrival.state,
                    origin: arrival.origin
                  });

                  // Se ha allegati, caricali e vai a Step 0.5
                  if (arrival.has_attachments && arrival.purchase_order_id) {
                    setLoadingAttachments(true);
                    try {
                      const response = await fetch('/api/arrivo-merce/get-po-attachments', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ purchase_order_id: arrival.purchase_order_id })
                      });

                      const data = await response.json();

                      if (response.ok) {
                        console.log('✅ Allegati caricati:', data.attachments.length);
                        setAvailableAttachments(data.attachments);
                        setRecommendedAttachment(data.recommended_attachment);
                        setStep(1); // Step 1: Seleziona allegato
                      } else {
                        console.error('❌ Errore caricamento allegati:', data.error);
                        setStep(2); // Fallback a upload manuale
                      }
                    } catch (error) {
                      console.error('❌ Errore fetch allegati:', error);
                      setStep(2); // Fallback a upload manuale
                    } finally {
                      setLoadingAttachments(false);
                    }
                  } else {
                    // Nessun allegato, vai direttamente a upload manuale
                    setStep(2);
                  }
                }}
              />

              {/* Opzione: Carica Manualmente */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setStep(2);
                    setSelectedArrival(null);
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={20} />
                  Oppure carica fattura manualmente
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 🆕 Step 1: Seleziona Allegato da P.O. */}
        {step === 1 && selectedArrival && availableAttachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-lg p-8">
              {/* Info arrivo selezionato */}
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">
                  📦 {selectedArrival.name} - {selectedArrival.partner_name}
                </h3>
                <p className="text-sm text-blue-700">
                  Ordine: {selectedArrival.purchase_order_name} | {selectedArrival.attachments_count} allegati trovati
                </p>
              </div>

              <AttachmentSelector
                attachments={availableAttachments}
                recommendedAttachment={recommendedAttachment}
                loading={loadingAttachments}
                processing={loading} // 🆕 Passa lo stato di processing
                onSelect={async (attachment) => {
                  console.log('✅ Allegato selezionato:', attachment.name);
                  setLoading(true);
                  setError(null);

                  try {
                    // Scarica e parsea l'allegato
                    const response = await fetch('/api/arrivo-merce/parse-attachment', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ attachment_id: attachment.id })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(data.error || 'Errore durante il parsing');
                    }

                    console.log('✅ Allegato parsato:', data.data);
                    setParsedInvoice(data.data);
                    setStep(3); // Vai a Step 3: Verifica Dati

                  } catch (err: any) {
                    console.error('❌ Errore parsing allegato:', err);
                    setError(err.message || 'Errore durante il parsing dell\'allegato');
                  } finally {
                    setLoading(false);
                  }
                }}
                onManualUpload={() => {
                  console.log('🔄 Passaggio a upload manuale');
                  setStep(2);
                }}
              />

              {/* Button Indietro */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setStep(0)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={20} />
                  Torna alla lista arrivi
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Upload File Manuale */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                1. Carica la Fattura
              </h2>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,image/*"
                  onChange={handleFileSelect}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="text-gray-400 mb-4" size={48} />
                  <p className="text-gray-700 font-medium mb-2">
                    Clicca per caricare o trascina qui
                  </p>
                  <p className="text-sm text-gray-500">
                    Supporta PDF e immagini (JPG, PNG)
                  </p>
                </label>
              </div>

              {selectedFile && (
                <div className="mt-6">
                  <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-green-600" size={24} />
                      <div>
                        <p className="font-medium text-gray-900">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="mt-4">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}

                  {selectedFile.size > 5 * 1024 * 1024 && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      <AlertTriangle className="inline mr-2" size={16} />
                      File grande ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB) - l'analisi potrebbe richiedere 30-60 secondi
                    </div>
                  )}

                  <button
                    onClick={handleParsePDF}
                    disabled={loading}
                    className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin" size={20} />
                        {selectedFile.size > 5 * 1024 * 1024
                          ? 'Analisi documento grande in corso... (può richiedere fino a 60 secondi)'
                          : 'Analisi in corso...'}
                      </>
                    ) : (
                      <>
                        Analizza Documento
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 3: Verify Parsed Data */}
        {step === 3 && parsedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                2. Verifica Dati Estratti
              </h2>

              {/* 🆕 Info Ricezione già selezionata */}
              {odooPicking && (
                <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="font-bold text-green-900">
                      Ricezione già selezionata: {odooPicking.name}
                    </span>
                  </div>
                  <p className="text-sm text-green-700">
                    Fornitore: {odooPicking.partner_name} | Data: {odooPicking.scheduled_date}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    ✅ Salteremo la ricerca e caricheremo direttamente le righe di questa ricezione
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="text-blue-600" size={20} />
                    <span className="text-sm font-medium text-blue-900">Fornitore</span>
                  </div>
                  <p className="font-bold text-blue-900">{parsedInvoice.supplier_name}</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="text-green-600" size={20} />
                    <span className="text-sm font-medium text-green-900">Documento</span>
                  </div>
                  <p className="font-bold text-green-900">{parsedInvoice.document_number}</p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-purple-600" size={20} />
                    <span className="text-sm font-medium text-purple-900">Data</span>
                  </div>
                  <p className="font-bold text-purple-900">{parsedInvoice.document_date}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Package size={20} />
                  Prodotti Estratti ({parsedInvoice.products.length})
                </h3>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {parsedInvoice.products.map((product, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {product.description}
                          </p>
                          {product.variant && (
                            <p className="text-sm text-gray-600 mt-1">
                              🏷️ {product.variant}
                            </p>
                          )}
                          {product.article_code && (
                            <p className="text-sm text-gray-500 mt-1">
                              Cod: {product.article_code}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-bold text-green-600">
                            {product.quantity} {product.unit}
                          </p>
                          {product.lot_number && (
                            <p className="text-xs text-gray-600 mt-1">
                              Lotto: {product.lot_number}
                            </p>
                          )}
                          {product.expiry_date && (
                            <p className="text-xs text-gray-600">
                              Scad: {product.expiry_date}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Ricarica
                </button>
                <button
                  onClick={async () => {
                    // 🆕 BYPASS: Se abbiamo già il picking dallo Step 0, carica direttamente le righe
                    if (odooPicking && odooPicking.id) {
                      console.log('🚀 BYPASS: Picking già selezionato, carico righe direttamente');
                      await handleLoadReceptionDetails(odooPicking.id);
                    } else {
                      // Altrimenti usa il vecchio metodo di ricerca
                      console.log('🔍 Nessun picking selezionato, uso ricerca tradizionale');
                      await handleIdentifySupplier();
                    }
                  }}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      {odooPicking ? 'Caricamento righe...' : 'Ricerca in corso...'}
                    </>
                  ) : (
                    <>
                      {odooPicking ? 'Procedi con Ricezione' : 'Trova Ricezione in Odoo'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 4: Odoo Picking Found */}
        {step === 4 && odooPicking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                3. Ricezione Trovata
              </h2>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-green-900 text-lg mb-4">
                  ✅ {odooPicking.name}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">Fornitore:</span>
                    <p className="font-medium text-green-900">{odooPicking.partner_name}</p>
                  </div>
                  <div>
                    <span className="text-green-700">Data prevista:</span>
                    <p className="font-medium text-green-900">{odooPicking.scheduled_date}</p>
                  </div>
                  <div>
                    <span className="text-green-700">Stato:</span>
                    <p className="font-medium text-green-900">{odooPicking.state}</p>
                  </div>
                  <div>
                    <span className="text-green-700">Origine:</span>
                    <p className="font-medium text-green-900">{odooPicking.origin || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {alternatives.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-yellow-600" size={20} />
                    <span className="font-medium text-yellow-900">
                      Trovate {alternatives.length} ricezioni alternative
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    Verrà utilizzata quella più recente. Verifica che sia corretta.
                  </p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-4">
                  Righe da compilare ({odooMoveLines.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {odooMoveLines.map((line) => (
                    <div
                      key={line.id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm"
                    >
                      <p className="font-medium text-gray-900">{line.product_name}</p>
                      <p className="text-gray-600">
                        Quantità: {line.qty_done || 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Indietro
                </button>
                <button
                  onClick={handleProcessReception}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      {processingBatch ? (
                        <span>
                          Batch {processingBatch.current}/{processingBatch.total} in corso...
                        </span>
                      ) : (
                        <span>Compilazione in corso...</span>
                      )}
                    </>
                  ) : (
                    <>
                      Compila Ricezione
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 5: Results */}
        {step === 5 && results && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
                <CheckCircle className="text-green-600" size={32} />
                Completato!
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{results.updated}</p>
                  <p className="text-sm text-green-700">Righe aggiornate</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{results.created}</p>
                  <p className="text-sm text-blue-700">Righe create</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{results.set_to_zero || 0}</p>
                  <p className="text-sm text-orange-700">Messe a zero</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-600">{results.no_match}</p>
                  <p className="text-sm text-yellow-700">Senza match</p>
                </div>
              </div>

              {results.supplier_info_updated > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 text-center">
                  <p className="text-2xl font-bold text-purple-600">{results.supplier_info_updated}</p>
                  <p className="text-sm text-purple-700">Listini fornitore aggiornati con codici e nomi dalla fattura</p>
                </div>
              )}

              {results.errors && results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-red-900 mb-2">Errori:</h3>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {results.errors.map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.details && results.details.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-gray-900 mb-4">Dettagli operazioni:</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.details.map((detail: any, idx: number) => (
                      <div
                        key={idx}
                        className={`rounded-lg p-3 border text-sm ${
                          detail.action === 'updated'
                            ? 'bg-green-50 border-green-200'
                            : detail.action === 'created'
                            ? 'bg-blue-50 border-blue-200'
                            : detail.action === 'set_to_zero'
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">
                              {detail.action === 'updated' && '✏️ Aggiornata'}
                              {detail.action === 'created' && '➕ Creata'}
                              {detail.action === 'set_to_zero' && '🔻 Messa a zero'}
                              {detail.action === 'no_match' && '⚠️ Nessun match'}
                            </p>
                            {detail.product_name && (
                              <p className="text-xs mt-1 font-semibold text-gray-700">
                                {detail.product_name}
                              </p>
                            )}
                            <p className="text-xs mt-1 text-gray-600">
                              Quantità: {detail.quantity || 'N/A'} | Lotto: {detail.lot || 'N/A'} | Scadenza: {detail.expiry ? (() => {
                                const [year, month, day] = detail.expiry.split('-');
                                return `${day}/${month}/${year}`;
                              })() : 'N/A'}
                            </p>
                            {detail.reason && (
                              <p className="text-xs mt-1 text-gray-600">{detail.reason}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Nuovo Arrivo
              </button>
            </div>
          </motion.div>
        )}

        {/* Unmatched Products Modal */}
        {showUnmatchedModal && unmatchedProducts.length > 0 && odooPicking && (
          <UnmatchedProductsHandler
            unmatchedProducts={unmatchedProducts}
            pickingId={odooPicking.id}
            onComplete={() => {
              setShowUnmatchedModal(false);
              setStep(5);
            }}
            onCancel={() => {
              setShowUnmatchedModal(false);
              setStep(5);
            }}
          />
        )}
      </div>
    </div>
  );
}
