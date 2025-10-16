'use client';

import React, { useState } from 'react';
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
import { useRouter } from 'next/navigation';

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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setStep(2);

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
      setStep(3);

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
      setStep(3);

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
      const response = await fetch('/api/arrivo-merce/process-reception', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          picking_id: odooPicking.id,
          move_lines: odooMoveLines,
          parsed_products: parsedInvoice.products,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il processamento');
      }

      console.log('✅ Processamento completato:', data.results);
      setResults(data.results);
      setStep(4);

    } catch (err: any) {
      console.error('❌ Errore processamento:', err);
      setError(err.message || 'Errore durante il processamento della ricezione');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewUrl(null);
    setParsedInvoice(null);
    setOdooPicking(null);
    setOdooMoveLines([]);
    setAlternatives([]);
    setResults(null);
    setError(null);
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
            onClick={() => router.push('/')}
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

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between items-center max-w-3xl mx-auto">
            {[
              { num: 1, label: 'Carica Fattura', icon: Upload },
              { num: 2, label: 'Verifica Dati', icon: FileText },
              { num: 3, label: 'Trova Ricezione', icon: Search },
              { num: 4, label: 'Completa', icon: CheckCircle },
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

        {/* Step 1: Upload File */}
        {step === 1 && (
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

                  <button
                    onClick={handleParsePDF}
                    disabled={loading}
                    className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin" size={20} />
                        Analisi in corso...
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

        {/* Step 2: Verify Parsed Data */}
        {step === 2 && parsedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                2. Verifica Dati Estratti
              </h2>

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
                  onClick={handleIdentifySupplier}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      Ricerca in corso...
                    </>
                  ) : (
                    <>
                      Trova Ricezione in Odoo
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Odoo Picking Found */}
        {step === 3 && odooPicking && (
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
                  onClick={() => setStep(2)}
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
                      Compilazione in corso...
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

        {/* Step 4: Results */}
        {step === 4 && results && (
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
      </div>
    </div>
  );
}
