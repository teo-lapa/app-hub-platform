'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Search, Plus, X, Package, Loader } from 'lucide-react';
import SearchProductModal from './SearchProductModal';
import { useRouter } from 'next/navigation';

interface UnmatchedProduct {
  invoice_product: {
    description: string;
    article_code?: string;
    quantity: number;
    unit: string;
    lot_number?: string;
    expiry_date?: string;
  };
  reason: string;
  confidence: number;
}

interface UnmatchedProductsHandlerProps {
  unmatchedProducts: UnmatchedProduct[];
  pickingId: number;
  onComplete: () => void;
  onCancel: () => void;
}

export default function UnmatchedProductsHandler({
  unmatchedProducts,
  pickingId,
  onComplete,
  onCancel
}: UnmatchedProductsHandlerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processedProducts, setProcessedProducts] = useState<string[]>([]);

  const currentProduct = unmatchedProducts[currentIndex];
  const isLastProduct = currentIndex === unmatchedProducts.length - 1;

  // OPZIONE 1: RICERCA MANUALE
  const handleSearchManual = () => {
    setSearchModalOpen(true);
  };

  const handleProductSelected = async (product: any) => {
    setSearchModalOpen(false);
    setProcessing(true);

    try {
      // Aggiungi il prodotto al picking
      const response = await fetch('/api/arrivo-merce/add-product-to-picking', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          picking_id: pickingId,
          product_id: product.id,
          quantity: currentProduct.invoice_product.quantity,
          lot_number: currentProduct.invoice_product.lot_number,
          expiry_date: currentProduct.invoice_product.expiry_date,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'aggiunta del prodotto');
      }

      console.log('✅ Prodotto aggiunto al picking:', data);

      // Aggiungi alla lista dei prodotti processati
      setProcessedProducts([...processedProducts, currentProduct.invoice_product.description]);

      // Passa al prossimo prodotto o completa
      if (isLastProduct) {
        onComplete();
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error: any) {
      console.error('❌ Errore aggiunta prodotto:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // OPZIONE 2: CREA NUOVO PRODOTTO
  const handleCreateNew = () => {
    // Salva lo stato attuale in sessionStorage
    sessionStorage.setItem('arrivo_merce_state', JSON.stringify({
      unmatchedProducts,
      pickingId,
      currentIndex,
      processedProducts,
      productToCreate: currentProduct.invoice_product
    }));

    // Crea i dati del prodotto da passare a Product Creator
    const productData = {
      fornitore: 'Da fattura',
      numero_fattura: '',
      data_fattura: new Date().toISOString().split('T')[0],
      prodotti: [
        {
          nome: currentProduct.invoice_product.description,
          codice: currentProduct.invoice_product.article_code || '',
          quantita: currentProduct.invoice_product.quantity,
          prezzo_unitario: 0,
          prezzo_totale: 0,
          unita_misura: currentProduct.invoice_product.unit || 'PZ',
          note: `Lotto: ${currentProduct.invoice_product.lot_number || 'N/A'}`
        }
      ]
    };

    // Salva i dati del prodotto per Product Creator
    sessionStorage.setItem('parsedInvoice', JSON.stringify(productData));

    // Naviga a Product Creator
    router.push('/product-creator/select-products?from=arrivo-merce');
  };

  // OPZIONE 3: SALTA PRODOTTO
  const handleSkip = () => {
    console.log('⏭️ Prodotto saltato:', currentProduct.invoice_product.description);

    // Passa al prossimo prodotto o completa
    if (isLastProduct) {
      onComplete();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Prodotti Non Trovati</h2>
                <p className="text-sm text-gray-500">
                  Prodotto {currentIndex + 1} di {unmatchedProducts.length}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / unmatchedProducts.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border-2 border-gray-200">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg">
                  {currentProduct.invoice_product.description}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentProduct.invoice_product.article_code && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg">
                      Codice: {currentProduct.invoice_product.article_code}
                    </span>
                  )}
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-lg">
                    Quantità: {currentProduct.invoice_product.quantity} {currentProduct.invoice_product.unit}
                  </span>
                  {currentProduct.invoice_product.lot_number && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-lg">
                      Lotto: {currentProduct.invoice_product.lot_number}
                    </span>
                  )}
                  {currentProduct.invoice_product.expiry_date && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-lg">
                      Scadenza: {currentProduct.invoice_product.expiry_date}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  <strong>Motivo:</strong> {currentProduct.reason}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6">
            <p className="text-gray-700 font-medium mb-4">Cosa vuoi fare con questo prodotto?</p>

            <div className="space-y-3">
              {/* OPZIONE 1: Ricerca Manuale */}
              <button
                onClick={handleSearchManual}
                disabled={processing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 flex items-center gap-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold">🔍 Ricerca Manuale</h4>
                  <p className="text-sm text-blue-100">Cerca il prodotto nel database Odoo</p>
                </div>
              </button>

              {/* OPZIONE 2: Crea Nuovo */}
              <button
                onClick={handleCreateNew}
                disabled={processing}
                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl p-4 flex items-center gap-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold">➕ Crea Nuovo Prodotto</h4>
                  <p className="text-sm text-green-100">Crea un nuovo prodotto con AI</p>
                </div>
              </button>

              {/* OPZIONE 3: Salta */}
              <button
                onClick={handleSkip}
                disabled={processing}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white rounded-xl p-4 flex items-center gap-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-gray-500 rounded-lg flex items-center justify-center">
                  <X className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold">❌ Salta Prodotto</h4>
                  <p className="text-sm text-gray-100">Ignora questo prodotto e continua</p>
                </div>
              </button>
            </div>

            {processing && (
              <div className="mt-4 flex items-center justify-center gap-2 text-gray-600">
                <Loader className="w-5 h-5 animate-spin" />
                <span>Elaborazione in corso...</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button
              onClick={onCancel}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Annulla tutto
            </button>
          </div>
        </motion.div>
      </div>

      {/* Search Modal */}
      <SearchProductModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectProduct={handleProductSelected}
        suggestedSearch={currentProduct.invoice_product.description}
      />
    </>
  );
}
