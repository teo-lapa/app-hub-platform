'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowLeft,
  Home
} from 'lucide-react';
import { DraftInvoice, DraftInvoiceDetail, ValidationState, ParsedInvoiceData, ComparisonResult, CorrectionAction } from './types';
import ManageMissingProductsView from './ManageMissingProductsView';

export default function ValidaFatturePage() {
  const [state, setState] = useState<ValidationState>({
    step: 'select',
    iterations: 0
  });
  const [invoices, setInvoices] = useState<DraftInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Array<[number, string]>>([]);

  // Carica lista fatture bozza all'avvio
  useEffect(() => {
    loadDraftInvoices();
  }, [selectedCompanyId]);

  const loadDraftInvoices = async () => {
    try {
      setLoading(true);

      const url = selectedCompanyId
        ? `/api/valida-fatture/list-draft-invoices?company_id=${selectedCompanyId}`
        : '/api/valida-fatture/list-draft-invoices';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setInvoices(data.invoices);

        // Estrai aziende uniche dalle fatture
        if (data.invoices.length > 0) {
          const uniqueCompanies = Array.from(
            new Map(
              data.invoices
                .filter((inv: DraftInvoice) => inv.company_id && Array.isArray(inv.company_id) && inv.company_id.length >= 2)
                .map((inv: DraftInvoice) => [inv.company_id[0], inv.company_id])
            ).values()
          ) as Array<[number, string]>;
          setCompanies(uniqueCompanies);
        }
      } else {
        setState(prev => ({ ...prev, step: 'error', error_message: data.error }));
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error_message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const selectInvoice = async (invoice: DraftInvoice) => {
    try {
      setProcessing(true);
      setState(prev => ({ ...prev, step: 'analyzing' }));

      // 1. Carica dettaglio completo
      const detailResponse = await fetch('/api/valida-fatture/get-invoice-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id })
      });

      // Controlla se la risposta è JSON valido
      const detailContentType = detailResponse.headers.get('content-type');
      if (!detailContentType || !detailContentType.includes('application/json')) {
        const errorText = await detailResponse.text();
        console.error('❌ Server returned non-JSON response:', errorText.substring(0, 200));
        throw new Error('Errore del server nel recupero dettagli fattura.');
      }

      const detailData = await detailResponse.json();
      if (!detailData.success) throw new Error(detailData.error);

      const fullInvoice: DraftInvoiceDetail = detailData.invoice;

      // Controlla se ha PDF
      if (!fullInvoice.attachments || fullInvoice.attachments.length === 0) {
        setState(prev => ({
          ...prev,
          step: 'error',
          error_message: 'Questa fattura non ha PDF allegato. Caricalo prima di continuare.'
        }));
        setProcessing(false);
        return;
      }

      // 2. Analizza e confronta con AI
      const pdfAttachment = fullInvoice.attachments[0];

      const compareResponse = await fetch('/api/valida-fatture/analyze-and-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_base64: pdfAttachment.datas,
          pdf_mimetype: pdfAttachment.mimetype,
          draft_invoice: fullInvoice
        })
      });

      // Controlla se la risposta è JSON valido
      const contentType = compareResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await compareResponse.text();
        console.error('❌ Server returned non-JSON response:', errorText.substring(0, 200));
        throw new Error('Errore del server. Verifica i log o riprova.');
      }

      const compareData = await compareResponse.json();
      if (!compareData.success) throw new Error(compareData.error);

      setState(prev => ({
        ...prev,
        step: 'review',
        selected_invoice: fullInvoice,
        parsed_data: compareData.parsed_invoice,
        comparison: compareData.comparison,
        iterations: 0
      }));

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error_message: error.message
      }));
    } finally {
      setProcessing(false);
    }
  };

  const applyCorrections = async () => {
    if (!state.selected_invoice || !state.comparison) return;

    try {
      setProcessing(true);

      // Separa correzioni automatiche da quelle che richiedono approvazione
      const autoCorrections = state.comparison.corrections_needed.filter(
        c => !c.requires_user_approval
      );

      const manualCorrections = state.comparison.corrections_needed.filter(
        c => c.requires_user_approval && c.action === 'create'
      );

      // Se ci sono prodotti mancanti, vai allo step gestione
      if (manualCorrections.length > 0) {
        setState(prev => ({
          ...prev,
          step: 'manage_missing_products',
          missing_products: manualCorrections as any[]
        }));
        setProcessing(false);
        return;
      }

      // Altrimenti procedi con le correzioni automatiche
      setState(prev => ({ ...prev, step: 'correcting' }));

      if (autoCorrections.length === 0) {
        setState(prev => ({
          ...prev,
          step: 'error',
          error_message: 'Nessuna correzione automatica disponibile.'
        }));
        setProcessing(false);
        return;
      }

      const response = await fetch('/api/valida-fatture/apply-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: state.selected_invoice.id,
          corrections: autoCorrections,
          invoice_date: state.parsed_data?.invoice_date || null
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      // Completato! Vai direttamente allo step completed senza iterazioni
      setState(prev => ({
        ...prev,
        step: 'completed',
        correction_result: data
      }));

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error_message: error.message
      }));
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setState(prev => ({
      ...prev,
      step: 'select',
      iterations: 0
    }));
    loadDraftInvoices();
  };

  const goToStep = (targetStep: ValidationState['step']) => {
    // Permetti navigazione solo agli step già completati o allo step corrente
    const steps: ValidationState['step'][] = ['select', 'analyzing', 'review', 'manage_missing_products', 'correcting', 'completed'];
    const currentIdx = steps.indexOf(state.step);
    const targetIdx = steps.indexOf(targetStep);

    // Naviga solo se lo step è già stato completato o è quello corrente
    if (targetIdx <= currentIdx) {
      setState(prev => ({ ...prev, step: targetStep }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <FileCheck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Valida Fatture</h1>
                <p className="text-gray-600">Confronto intelligente fatture bozza con PDF definitivi</p>
              </div>
            </div>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </a>
          </div>
        </motion.div>

        {/* Progress Steps */}
        <div className="mb-8 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            {[
              { key: 'select', label: 'Seleziona' },
              { key: 'analyzing', label: 'Analisi' },
              { key: 'review', label: 'Revisione' },
              { key: 'manage_missing_products', label: 'Prodotti' },
              { key: 'correcting', label: 'Correzione' },
              { key: 'completed', label: 'Completato' }
            ].map((step, idx) => {
              const steps = ['select', 'analyzing', 'review', 'manage_missing_products', 'correcting', 'completed'];
              const currentIdx = steps.indexOf(state.step);
              const isActive = state.step === step.key;
              const isCompleted = currentIdx > idx;
              const isSkipped = step.key === 'manage_missing_products' && state.step !== 'manage_missing_products' && currentIdx > 3;
              const isClickable = isCompleted || isActive;

              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => isClickable && goToStep(step.key as ValidationState['step'])}
                      disabled={!isClickable}
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                        transition-all
                        ${isActive ? 'bg-blue-500 text-white' :
                          isCompleted ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer' :
                          isSkipped ? 'bg-gray-300 text-gray-600' :
                          'bg-gray-200 text-gray-500 cursor-not-allowed'}
                        ${isClickable && !isActive ? 'hover:scale-110' : ''}
                      `}
                    >
                      {idx + 1}
                    </button>
                    <span className="text-xs text-gray-600 mt-1">{step.label}</span>
                  </div>
                  {idx < 5 && <div className="w-16 h-1 bg-gray-200 mx-2" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {state.step === 'select' && (
            <>
              {/* Company Selector */}
              {companies.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 bg-white rounded-2xl shadow-sm p-6"
                >
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Filtra per Azienda:
                  </label>
                  <select
                    value={selectedCompanyId || ''}
                    onChange={(e) => setSelectedCompanyId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">Tutte le aziende</option>
                    {companies.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </motion.div>
              )}

              <InvoiceList
                invoices={invoices}
                loading={loading}
                onSelect={selectInvoice}
              />
            </>
          )}

          {state.step === 'analyzing' && <AnalyzingView />}

          {state.step === 'review' && state.comparison && (
            <ReviewView
              comparison={state.comparison}
              parsedData={state.parsed_data!}
              draftInvoice={state.selected_invoice!}
              onApply={applyCorrections}
              onCancel={reset}
              processing={processing}
              iteration={state.iterations}
            />
          )}

          {state.step === 'manage_missing_products' && state.missing_products && state.selected_invoice && (
            <ManageMissingProductsView
              missingProducts={state.missing_products}
              draftInvoice={state.selected_invoice}
              parsedData={state.parsed_data!}
              onComplete={() => {
                // Dopo aver aggiunto i prodotti, rianalizza
                setState(prev => ({ ...prev, step: 'analyzing' }));
                selectInvoice(state.selected_invoice!);
              }}
              onCancel={reset}
            />
          )}

          {state.step === 'correcting' && <CorrectingView />}

          {state.step === 'completed' && state.correction_result && (
            <CompletedView
              result={state.correction_result}
              onReset={reset}
            />
          )}

          {state.step === 'error' && (
            <ErrorView message={state.error_message || 'Errore sconosciuto'} onReset={reset} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// SUB-COMPONENTS

function InvoiceList({ invoices, loading, onSelect }: any) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-20">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-xl text-gray-600">Nessuna fattura bozza trovata</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {invoices.map((invoice: DraftInvoice) => (
        <motion.div
          key={invoice.id}
          whileHover={{ scale: 1.02 }}
          className="bg-white rounded-2xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect(invoice)}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900">{invoice.name}</h3>
              <p className="text-sm text-gray-600">{invoice.partner_id?.[1] || 'Fornitore N/A'}</p>
              {invoice.company_id && invoice.company_id[1] && (
                <p className="text-xs text-blue-600 mt-1">{invoice.company_id[1]}</p>
              )}
            </div>
            {invoice.has_attachment && (
              <FileText className="w-5 h-5 text-green-500" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Totale:</span>
              <span className="font-semibold text-gray-900">€{invoice.amount_total.toFixed(2)}</span>
            </div>
            {invoice.invoice_date && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Data:</span>
                <span className="text-gray-900">{invoice.invoice_date}</span>
              </div>
            )}
            {!invoice.has_attachment && (
              <div className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>Nessun PDF allegato</span>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function AnalyzingView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <Loader2 className="w-16 h-16 animate-spin text-blue-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Analisi in corso...</h2>
      <p className="text-gray-600">Claude sta analizzando il PDF e confrontando con la bozza</p>
    </motion.div>
  );
}

function ReviewView({ comparison, parsedData, draftInvoice, onApply, onCancel, processing, iteration }: any) {
  const diffAmount = comparison.total_difference;
  const isValid = Math.abs(diffAmount) <= 0.02;
  // Ci sono correzioni se ci sono azioni da fare (automatiche O manuali)
  const hasCorrections = comparison.corrections_needed.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Invoice Details Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{draftInvoice.name}</h2>
            <div className="space-y-1 text-blue-50">
              <p className="text-lg font-semibold">{draftInvoice.partner_id?.[1] || 'N/A'}</p>
              {draftInvoice.company_id && draftInvoice.company_id[1] && (
                <p className="text-sm">{draftInvoice.company_id[1]}</p>
              )}
              {draftInvoice.invoice_date && (
                <p className="text-sm">Data: {draftInvoice.invoice_date}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-100 mb-1">Totale Bozza</p>
            <p className="text-3xl font-bold">€{draftInvoice.amount_total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Totali Confronto */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">Confronto Totali</h2>

        {/* Date Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b">
          <div>
            <p className="text-sm text-gray-600 mb-1">Data Fattura PDF</p>
            <p className="text-lg font-semibold text-blue-600">
              {parsedData.invoice_date || 'N/A'}
            </p>
            {parsedData.invoice_number && (
              <p className="text-xs text-gray-500 mt-1">N. {parsedData.invoice_number}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Data Bozza Odoo</p>
            <p className="text-lg font-semibold text-purple-600">
              {draftInvoice.invoice_date || 'N/A'}
            </p>
          </div>
        </div>

        {/* Amounts Comparison */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Fattura Definitiva</p>
            <p className="text-2xl font-bold text-blue-600">€{parsedData.total_amount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Bozza Odoo</p>
            <p className="text-2xl font-bold text-purple-600">€{draftInvoice.amount_total.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Differenza</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                {diffAmount > 0 ? '+' : ''}€{diffAmount.toFixed(2)}
              </p>
              {diffAmount > 0 ? (
                <TrendingUp className="w-6 h-6 text-red-500" />
              ) : diffAmount < 0 ? (
                <TrendingDown className="w-6 h-6 text-red-500" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              )}
            </div>
          </div>
        </div>

        {iteration > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-800">Iterazione {iteration} / 5</span>
          </div>
        )}
      </div>

      {/* Differenze */}
      {comparison.differences.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">Differenze Trovate ({comparison.differences.length})</h2>
          <div className="space-y-3">
            {comparison.differences.map((diff: any, idx: number) => (
              <div key={idx} className="border-l-4 border-amber-400 bg-amber-50 p-4 rounded">
                <p className="font-semibold text-gray-900">{diff.description}</p>
                {diff.amount_difference && (
                  <p className="text-sm text-gray-600 mt-1">
                    Impatto: €{diff.amount_difference.toFixed(2)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correzioni */}
      {comparison.corrections_needed.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">Correzioni Proposte ({comparison.corrections_needed.length})</h2>
          <div className="space-y-3">
            {comparison.corrections_needed.map((corr: CorrectionAction, idx: number) => (
              <div key={idx} className={`p-4 rounded-lg border ${
                corr.requires_user_approval ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-2 ${
                      corr.action === 'update' ? 'bg-blue-200 text-blue-800' :
                      corr.action === 'delete' ? 'bg-red-200 text-red-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {corr.action.toUpperCase()}
                    </span>
                    <p className="text-sm text-gray-900 mt-1">{corr.reason}</p>
                  </div>
                  {corr.requires_user_approval && (
                    <span className="text-xs text-orange-700 font-semibold">Richiede approvazione</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
        >
          Annulla
        </button>
        <button
          onClick={onApply}
          disabled={processing || (!hasCorrections)}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Applicando...</span>
            </>
          ) : !hasCorrections ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Nessuna Correzione Necessaria</span>
            </>
          ) : isValid && hasCorrections ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Applica Correzioni (Totale OK)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Applica Correzioni</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function CorrectingView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <Loader2 className="w-16 h-16 animate-spin text-purple-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Applicando correzioni...</h2>
      <p className="text-gray-600">Aggiornamento fattura in Odoo in corso</p>
    </motion.div>
  );
}

function CompletedView({ result, onReset }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="bg-white rounded-2xl shadow-lg p-8 text-center"
    >
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-12 h-12 text-green-600" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Fattura Validata!</h2>
      <p className="text-gray-600 mb-6">La fattura è stata corretta e il totale è perfetto</p>

      <div className="bg-gray-50 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-600">{result.updated_lines}</p>
            <p className="text-sm text-gray-600">Righe Aggiornate</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-red-600">{result.deleted_lines}</p>
            <p className="text-sm text-gray-600">Righe Eliminate</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600">{result.created_lines}</p>
            <p className="text-sm text-gray-600">Righe Create</p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-1">Nuovo Totale</p>
          <p className="text-4xl font-bold text-gray-900">€{result.new_total.toFixed(2)}</p>
        </div>
      </div>

      <button
        onClick={onReset}
        className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
      >
        Valida Altra Fattura
      </button>
    </motion.div>
  );
}

function ErrorView({ message, onReset }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-white rounded-2xl shadow-lg p-8 text-center"
    >
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Errore</h2>
      <p className="text-gray-600 mb-6">{message}</p>
      <button
        onClick={onReset}
        className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Torna alla Lista</span>
      </button>
    </motion.div>
  );
}
