'use client';

/**
 * PORTALE CLIENTI - Pagina Checkout
 *
 * Permette ai clienti di:
 * 1. Visualizzare riepilogo carrello
 * 2. Inserire data consegna preferita
 * 3. Aggiungere note all'ordine
 * 4. Selezionare termini di pagamento
 * 5. Confermare ordine (crea sale.order REALE su Odoo)
 * 6. Redirect a pagina dettaglio ordine confermato
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Loader2, ShoppingCart, Package, AlertCircle, CheckCircle } from 'lucide-react';

interface CartItem {
  product_id: number;
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  uom: string;
}

interface PaymentTerm {
  id: number;
  name: string;
}

export default function CheckoutPage() {
  const router = useRouter();

  // State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [paymentTermId, setPaymentTermId] = useState<number | undefined>();
  const [notes, setNotes] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingCart, setLoadingCart] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Carica carrello da localStorage (o da API se hai cart backend)
   */
  useEffect(() => {
    try {
      // Prova a caricare da localStorage
      const cartData = localStorage.getItem('portale_cart');
      if (cartData) {
        const items: CartItem[] = JSON.parse(cartData);
        setCartItems(items);
      }

      // TODO: Se hai un cart backend, caricalo qui tramite fetch
      // const response = await fetch('/api/portale-clienti/cart');
      // const data = await response.json();
      // setCartItems(data.items);

    } catch (err) {
      console.error('Errore caricamento carrello:', err);
      setError('Impossibile caricare il carrello');
    } finally {
      setLoadingCart(false);
    }
  }, []);

  /**
   * Carica termini di pagamento disponibili (opzionale)
   */
  useEffect(() => {
    async function loadPaymentTerms() {
      try {
        // TODO: Se vuoi permettere selezione termini pagamento, caricali da Odoo
        // const response = await fetch('/api/portale-clienti/payment-terms');
        // const data = await response.json();
        // setPaymentTerms(data.terms);

        // Mock per ora
        setPaymentTerms([
          { id: 1, name: 'Immediato' },
          { id: 2, name: '30 giorni' },
          { id: 3, name: '60 giorni' },
        ]);
      } catch (err) {
        console.error('Errore caricamento termini pagamento:', err);
      }
    }

    loadPaymentTerms();
  }, []);

  /**
   * Calcola totale carrello
   */
  const calculateTotal = (): number => {
    return cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  };

  /**
   * Gestisce conferma ordine
   */
  const handleCheckout = async () => {
    // Validazione
    if (cartItems.length === 0) {
      setError('Il carrello è vuoto');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepara payload per API
      const payload = {
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        delivery_date: deliveryDate || undefined,
        payment_term_id: paymentTermId,
        notes: notes.trim() || undefined,
      };

      console.log('📦 Invio ordine:', payload);

      // Chiama API checkout
      const response = await fetch('/api/portale-clienti/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Errore durante la creazione dell\'ordine');
      }

      console.log('✅ Ordine creato:', data);

      // Mostra successo
      setSuccess(true);

      // Clear carrello
      localStorage.removeItem('portale_cart');

      // Redirect a dettaglio ordine dopo 2 secondi
      setTimeout(() => {
        router.push(`/portale-clienti/ordini/${data.order_id}`);
      }, 2000);

    } catch (err: any) {
      console.error('❌ Errore checkout:', err);
      setError(err.message || 'Errore durante la creazione dell\'ordine');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Loading iniziale
   */
  if (loadingCart) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  /**
   * Carrello vuoto
   */
  if (cartItems.length === 0 && !loadingCart) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-semibold mb-2">Carrello vuoto</h2>
          <p className="text-gray-600 mb-6">
            Non ci sono prodotti nel carrello. Aggiungi prodotti prima di procedere all'ordine.
          </p>
          <button
            onClick={() => router.push('/portale-clienti/catalogo')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Vai al catalogo
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render principale
   */
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Conferma Ordine</h1>
        <p className="text-gray-600">Verifica i dettagli e conferma il tuo ordine</p>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Ordine confermato!</h3>
            <p className="text-green-700 text-sm">
              Il tuo ordine è stato creato con successo. Reindirizzamento in corso...
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Errore</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna sinistra: Form dettagli ordine */}
        <div className="lg:col-span-2 space-y-6">
          {/* Riepilogo carrello */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Prodotti ({cartItems.length})
            </h2>

            <div className="space-y-3">
              {cartItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {item.product_name}
                      {item.product_code && (
                        <span className="text-sm text-gray-500 ml-2">[{item.product_code}]</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {item.quantity} {item.uom} × €{item.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      €{(item.quantity * item.unit_price).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data consegna preferita */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data consegna preferita (opzionale)
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Indica quando vorresti ricevere l'ordine. La data effettiva verrà confermata.
            </p>
          </div>

          {/* Termini di pagamento */}
          {paymentTerms.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Termini di pagamento (opzionale)
              </label>
              <select
                value={paymentTermId || ''}
                onChange={(e) => setPaymentTermId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleziona...</option>
                {paymentTerms.map(term => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note ordine */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note ordine (opzionale)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Aggiungi eventuali note o richieste speciali..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Colonna destra: Riepilogo e conferma */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
            <h2 className="text-xl font-semibold mb-4">Riepilogo</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Prodotti:</span>
                <span>{cartItems.length}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Quantità totale:</span>
                <span>
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Totale:</span>
                  <span className="text-blue-600">€{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading || success}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Conferma in corso...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Ordine confermato!
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Conferma Ordine
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Confermando l'ordine, accetti i nostri{' '}
              <a href="/termini" className="text-blue-600 hover:underline">
                termini e condizioni
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
