'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Plus, ExternalLink, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { DraftInvoiceDetail, ParsedInvoiceData, MissingProductCorrection, OdooProduct } from './types';
import Link from 'next/link';

interface ManageMissingProductsViewProps {
  missingProducts: MissingProductCorrection[];
  draftInvoice: DraftInvoiceDetail;
  parsedData: ParsedInvoiceData;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ManageMissingProductsView({
  missingProducts,
  draftInvoice,
  parsedData,
  onComplete,
  onCancel
}: ManageMissingProductsViewProps) {
  const [productStates, setProductStates] = useState<{
    [key: number]: {
      searching: boolean;
      suggestions: OdooProduct[];
      selectedProduct: OdooProduct | null;
      adding: boolean;
      added: boolean;
      error?: string;
    }
  }>({});

  // Auto-search products on mount
  useEffect(() => {
    missingProducts.forEach((_, idx) => {
      searchProduct(idx);
    });
  }, []);

  const searchProduct = async (index: number) => {
    const missing = missingProducts[index];
    if (!missing.description) return;

    setProductStates(prev => ({
      ...prev,
      [index]: { ...prev[index], searching: true, suggestions: [], selectedProduct: null, adding: false, added: false }
    }));

    try {
      // Estrai termine di ricerca dalla descrizione
      // Cerca codice prodotto tipo "P09956" o "[RI1500TS]"
      const codeMatch = missing.description.match(/P\d+|[\[\(][A-Z0-9]+[\]\)]/);
      const searchTerm = codeMatch ? codeMatch[0].replace(/[\[\]\(\)]/g, '') : missing.description.split(':')[0].trim();

      const response = await fetch('/api/valida-fatture/search-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: draftInvoice.partner_id[0],
          search_term: searchTerm
        })
      });

      const data = await response.json();

      if (data.success) {
        setProductStates(prev => ({
          ...prev,
          [index]: {
            ...prev[index],
            searching: false,
            suggestions: data.products || [],
            selectedProduct: data.products?.length > 0 ? data.products[0] : null
          }
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setProductStates(prev => ({
        ...prev,
        [index]: { ...prev[index], searching: false, error: error.message }
      }));
    }
  };

  const addProductToInvoice = async (index: number) => {
    const missing = missingProducts[index];
    const state = productStates[index];

    if (!state?.selectedProduct) return;

    setProductStates(prev => ({
      ...prev,
      [index]: { ...prev[index], adding: true }
    }));

    try {
      // Estrai quantità e prezzo dalla descrizione/parsed line
      const quantity = missing.parsed_line?.quantity || 1;
      const price_unit = missing.parsed_line?.unit_price || state.selectedProduct.list_price;

      const response = await fetch('/api/valida-fatture/add-product-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: draftInvoice.id,
          product_id: state.selectedProduct.id,
          quantity,
          price_unit,
          name: state.selectedProduct.name
        })
      });

      const data = await response.json();

      if (data.success) {
        setProductStates(prev => ({
          ...prev,
          [index]: { ...prev[index], adding: false, added: true }
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setProductStates(prev => ({
        ...prev,
        [index]: { ...prev[index], adding: false, error: error.message }
      }));
    }
  };

  const allAdded = missingProducts.every((_, idx) => productStates[idx]?.added);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Invoice Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Gestione Prodotti Mancanti</h2>
        <p className="text-purple-100">
          Trovati <span className="font-bold">{missingProducts.length}</span> prodotti nella fattura definitiva che non sono in bozza
        </p>
      </div>

      {/* Missing Products List */}
      <div className="space-y-4">
        {missingProducts.map((missing, idx) => {
          const state = productStates[idx] || { searching: false, suggestions: [], selectedProduct: null, adding: false, added: false };

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white rounded-2xl shadow-sm p-6 ${state.added ? 'ring-2 ring-green-500' : ''}`}
            >
              {/* Product from PDF */}
              <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{missing.description}</h3>
                    {missing.parsed_line && (
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>Quantità: <span className="font-semibold">{missing.parsed_line.quantity}</span></span>
                        <span>Prezzo: <span className="font-semibold">€{missing.parsed_line.unit_price.toFixed(2)}</span></span>
                        <span>Totale: <span className="font-semibold">€{missing.parsed_line.subtotal.toFixed(2)}</span></span>
                      </div>
                    )}
                  </div>
                  {state.added && (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  )}
                </div>
              </div>

              {/* Search Results */}
              {state.searching && (
                <div className="flex items-center gap-2 text-blue-600 mb-4">
                  <Search className="w-5 h-5 animate-spin" />
                  <span>Ricerca prodotti del fornitore...</span>
                </div>
              )}

              {!state.searching && !state.added && (
                <>
                  {state.suggestions.length > 0 ? (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Prodotti trovati nel catalogo fornitore:
                      </label>
                      <select
                        value={state.selectedProduct?.id || ''}
                        onChange={(e) => {
                          const productId = parseInt(e.target.value);
                          const product = state.suggestions.find(p => p.id === productId);
                          setProductStates(prev => ({
                            ...prev,
                            [idx]: { ...prev[idx], selectedProduct: product || null }
                          }));
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 mb-3"
                      >
                        {state.suggestions.map(prod => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} {prod.default_code ? `[${prod.default_code}]` : ''} - €{prod.list_price.toFixed(2)}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => addProductToInvoice(idx)}
                        disabled={state.adding || !state.selectedProduct}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                      >
                        {state.adding ? (
                          <>
                            <Package className="w-5 h-5 animate-spin" />
                            Aggiunta in corso...
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5" />
                            Aggiungi alla Fattura
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-amber-900 mb-1">Prodotto non trovato nel catalogo fornitore</p>
                          <p className="text-sm text-amber-700">
                            Devi creare questo prodotto prima di poterlo aggiungere alla fattura
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/product-creator?supplier=${draftInvoice.partner_id[1]}&description=${encodeURIComponent(missing.description)}&price=${missing.parsed_line?.unit_price || 0}`}
                        target="_blank"
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Crea Prodotto con AI
                      </Link>

                      <button
                        onClick={() => searchProduct(idx)}
                        className="w-full mt-2 bg-gray-200 text-gray-700 py-2 rounded-xl font-semibold hover:bg-gray-300 transition-all flex items-center justify-center gap-2"
                      >
                        <Search className="w-4 h-4" />
                        Riprova Ricerca
                      </button>
                    </div>
                  )}
                </>
              )}

              {state.added && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-green-900">Prodotto aggiunto alla fattura!</p>
                </div>
              )}

              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <p className="font-semibold text-red-900">Errore: {state.error}</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-300 transition-all"
        >
          Annulla
        </button>
        <button
          onClick={onComplete}
          disabled={!allAdded}
          className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
          {allAdded ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Completa e Rianalizza
            </>
          ) : (
            <>
              <ArrowRight className="w-5 h-5" />
              Continua ({Object.values(productStates).filter(s => s.added).length}/{missingProducts.length})
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
