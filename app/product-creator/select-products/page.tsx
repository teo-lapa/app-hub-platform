'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Sparkles,
  Package,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Save
} from 'lucide-react';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Product {
  nome: string;
  codice?: string;
  quantita: number;
  prezzo_unitario: number;
  prezzo_totale: number;
  unita_misura?: string;
  note?: string;
}

interface EnrichedProduct extends Product {
  selected: boolean;
  enriching: boolean;
  enriched: boolean;
  expanded: boolean;
  editing: boolean;
  enrichedData?: {
    nome_completo: string;
    descrizione_breve?: string;
    descrizione_dettagliata?: string;
    categoria?: string;
    sottocategoria?: string;
    marca?: string;
    codice_ean?: string;
    prezzo_vendita_suggerito?: number;
    caratteristiche?: string[];
    tags?: string[];
    unita_misura?: string;
    peso?: number;
    dimensioni?: string;
  };
}

export default function SelectProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);

  useEffect(() => {
    // Load data from sessionStorage
    const data = sessionStorage.getItem('parsedInvoice');
    if (!data) {
      toast.error('Dati fattura non trovati');
      router.push('/product-creator');
      return;
    }

    const parsed = JSON.parse(data);
    setInvoiceData(parsed);
    setProducts(
      parsed.prodotti.map((p: Product) => ({
        ...p,
        selected: true, // Pre-select all
        enriching: false,
        enriched: false,
        expanded: false,
        editing: false,
      }))
    );

    // Check if coming from arrivo-merce
    const urlParams = new URLSearchParams(window.location.search);
    const fromArrivoMerce = urlParams.get('from') === 'arrivo-merce';
    if (fromArrivoMerce) {
      console.log('📦 Chiamato da arrivo-merce, modalità integrata attiva');
    }
  }, [router]);

  const toggleProduct = (index: number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleExpand = (index: number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, expanded: !p.expanded } : p))
    );
  };

  const toggleEdit = (index: number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, editing: !p.editing } : p))
    );
  };

  const updateEnrichedField = (index: number, field: string, value: any) => {
    setProducts((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              enrichedData: {
                ...p.enrichedData!,
                [field]: value,
              },
            }
          : p
      )
    );
  };

  const enrichProduct = async (index: number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, enriching: true } : p))
    );

    try {
      const response = await fetch('/api/product-creator/enrich-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: products[index],
          invoiceData: invoiceData
        }),
      });

      const result = await response.json();

      if (result.success) {
        setProducts((prev) =>
          prev.map((p, i) =>
            i === index
              ? {
                  ...p,
                  enriching: false,
                  enriched: true,
                  expanded: true,
                  enrichedData: result.data,
                }
              : p
          )
        );
        toast.success(`✅ ${products[index].nome} arricchito!`);
      } else {
        toast.error(result.error || 'Errore arricchimento');
        setProducts((prev) =>
          prev.map((p, i) => (i === index ? { ...p, enriching: false } : p))
        );
      }
    } catch (error) {
      console.error('Enrich error:', error);
      toast.error('Errore durante l\'arricchimento');
      setProducts((prev) =>
        prev.map((p, i) => (i === index ? { ...p, enriching: false } : p))
      );
    }
  };

  const enrichAllSelected = async () => {
    setEnrichingAll(true);
    const selectedIndices = products
      .map((p, i) => (p.selected && !p.enriched ? i : -1))
      .filter((i) => i !== -1);

    for (const index of selectedIndices) {
      await enrichProduct(index);
    }

    setEnrichingAll(false);
    toast.success('✅ Tutti i prodotti arricchiti!');
  };

  const createProducts = async () => {
    const selectedProducts = products.filter((p) => p.selected && p.enriched);

    if (selectedProducts.length === 0) {
      toast.error('Seleziona e arricchisci almeno un prodotto!');
      return;
    }

    setIsCreating(true);
    const loadingToast = toast.loading(
      `🚀 Creazione di ${selectedProducts.length} prodotti in Odoo...`
    );

    try {
      const response = await fetch('/api/product-creator/create-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: selectedProducts.map((p) => p.enrichedData),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          `✅ Creati ${result.summary.created}/${result.summary.total} prodotti!`,
          { id: loadingToast }
        );

        if (result.errors && result.errors.length > 0) {
          toast.error(`⚠️ ${result.errors.length} errori`, {
            duration: 5000,
          });
        }

        // Check if coming from arrivo-merce
        const urlParams = new URLSearchParams(window.location.search);
        const fromArrivoMerce = urlParams.get('from') === 'arrivo-merce';

        if (fromArrivoMerce && result.results && result.results.length > 0) {
          // Salva i prodotti creati per arrivo-merce
          const createdProductId = result.results[0].product_id;
          const arrivoMerceState = sessionStorage.getItem('arrivo_merce_state');

          if (arrivoMerceState && createdProductId) {
            const state = JSON.parse(arrivoMerceState);
            state.createdProductId = createdProductId;
            sessionStorage.setItem('arrivo_merce_state', JSON.stringify(state));

            // Clear parsed invoice
            sessionStorage.removeItem('parsedInvoice');

            // Ritorna ad arrivo-merce
            setTimeout(() => {
              router.push('/arrivo-merce?resume=true');
            }, 1500);
            return;
          }
        }

        // Clear session storage
        sessionStorage.removeItem('parsedInvoice');

        // Redirect to success or home
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        toast.error(result.error || 'Errore creazione prodotti', {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error('Create error:', error);
      toast.error('Errore durante la creazione', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const selectedCount = products.filter((p) => p.selected).length;
  const enrichedCount = products.filter((p) => p.enriched).length;
  const readyToCreate = products.filter((p) => p.selected && p.enriched).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <AppHeader
        title="🎯 Selezione Prodotti"
        subtitle="Seleziona e arricchisci i prodotti da creare"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{products.length}</p>
              <p className="text-sm text-gray-600">Prodotti Totali</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{selectedCount}</p>
              <p className="text-sm text-gray-600">Selezionati</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{enrichedCount}</p>
              <p className="text-sm text-gray-600">Arricchiti</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{readyToCreate}</p>
              <p className="text-sm text-gray-600">Pronti</p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row gap-4 mb-6"
        >
          <button
            onClick={enrichAllSelected}
            disabled={enrichingAll || selectedCount === 0 || enrichedCount === selectedCount}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {enrichingAll ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Arricchimento in corso...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Arricchisci Tutti i Selezionati
              </>
            )}
          </button>

          <button
            onClick={createProducts}
            disabled={isCreating || readyToCreate === 0}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creazione in corso...
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Crea Prodotti in Odoo ({readyToCreate})
              </>
            )}
          </button>
        </motion.div>

        {/* Products List */}
        <div className="space-y-4">
          {products.map((product, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all ${
                product.selected ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              {/* Product Header */}
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleProduct(index)}
                    className={`flex-shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                      product.selected
                        ? 'bg-purple-600 border-purple-600'
                        : 'border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    {product.selected && <Check className="w-5 h-5 text-white" />}
                  </button>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      {product.enriched
                        ? product.enrichedData?.nome_completo
                        : product.nome}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {product.codice && (
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {product.codice}
                        </span>
                      )}
                      <span>
                        Qty: {product.quantita} {product.unita_misura || 'PZ'}
                      </span>
                      <span>Acquisto: €{product.prezzo_unitario.toFixed(2)}</span>
                      {product.enrichedData?.prezzo_vendita_suggerito && (
                        <span className="text-green-600 font-semibold">
                          Vendita: €
                          {product.enrichedData.prezzo_vendita_suggerito.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Enriched Data Badge */}
                    {product.enriched && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {product.enrichedData?.marca && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            {product.enrichedData.marca}
                          </span>
                        )}
                        {product.enrichedData?.categoria && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {product.enrichedData.categoria}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex-shrink-0 flex gap-2">
                    {!product.enriched && (
                      <button
                        onClick={() => enrichProduct(index)}
                        disabled={product.enriching || !product.selected}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {product.enriching ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            AI...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Arricchisci
                          </>
                        )}
                      </button>
                    )}

                    {product.enriched && (
                      <button
                        onClick={() => toggleExpand(index)}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-all"
                      >
                        {product.expanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {product.expanded && product.enrichedData && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-200"
                  >
                    <div className="p-6 bg-gray-50 space-y-4">
                      {/* Edit Toggle */}
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-800">
                          Dettagli Prodotto
                        </h4>
                        <button
                          onClick={() => toggleEdit(index)}
                          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
                        >
                          {product.editing ? (
                            <>
                              <Save className="w-4 h-4" />
                              Salva
                            </>
                          ) : (
                            <>
                              <Edit2 className="w-4 h-4" />
                              Modifica
                            </>
                          )}
                        </button>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">
                          Descrizione Breve
                        </label>
                        {product.editing ? (
                          <textarea
                            value={product.enrichedData.descrizione_breve || ''}
                            onChange={(e) =>
                              updateEnrichedField(
                                index,
                                'descrizione_breve',
                                e.target.value
                              )
                            }
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                            rows={2}
                          />
                        ) : (
                          <p className="text-sm text-gray-600">
                            {product.enrichedData.descrizione_breve}
                          </p>
                        )}
                      </div>

                      {/* Detailed Description */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">
                          Descrizione Dettagliata
                        </label>
                        {product.editing ? (
                          <textarea
                            value={product.enrichedData.descrizione_dettagliata || ''}
                            onChange={(e) =>
                              updateEnrichedField(
                                index,
                                'descrizione_dettagliata',
                                e.target.value
                              )
                            }
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                            rows={3}
                          />
                        ) : (
                          <p className="text-sm text-gray-600">
                            {product.enrichedData.descrizione_dettagliata}
                          </p>
                        )}
                      </div>

                      {/* Characteristics */}
                      {product.enrichedData.caratteristiche &&
                        product.enrichedData.caratteristiche.length > 0 && (
                          <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-2">
                              Caratteristiche
                            </label>
                            <ul className="list-disc list-inside space-y-1">
                              {product.enrichedData.caratteristiche.map(
                                (char, i) => (
                                  <li key={i} className="text-sm text-gray-600">
                                    {char}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                      {/* Tags */}
                      {product.enrichedData.tags &&
                        product.enrichedData.tags.length > 0 && (
                          <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-2">
                              Tags
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {product.enrichedData.tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
