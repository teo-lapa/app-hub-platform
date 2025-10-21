'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SalesPerson {
  id: number;
  name: string;
}

interface ProductCard {
  orderId: number;
  orderName: string;
  customerId: number;
  customerName: string;
  customerSalesperson?: string; // Venditore assegnato al cliente
  productId: number;
  productName: string;
  quantityOrdered: number;
  quantityDelivered: number;
  quantityRemaining: number;
  dateOrder: string;
  state: string;
  hasNewOrder?: boolean; // Indica se è già stato creato un nuovo ordine per questo prodotto
}

async function callKw<T = any>(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {}
): Promise<T> {
  const response = await fetch('/api/odoo/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      model,
      method,
      args,
      kwargs,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Errore RPC');
  }

  return data.result;
}

async function searchRead<T = any>(
  model: string,
  domain: any[],
  fields: string[] = [],
  limit = 0,
  order = ''
): Promise<T[]> {
  return callKw<T[]>(model, 'search_read', [domain], { fields, limit, order });
}

export default function ProdottiNonPrelevatiPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Seleziona i filtri e clicca CERCA');
  const [salespeople, setSalespeople] = useState<SalesPerson[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [unpickedProducts, setUnpickedProducts] = useState<ProductCard[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalProduct, setModalProduct] = useState<ProductCard | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );

  useEffect(() => {
    loadSalespeople();
  }, []);

  const loadSalespeople = async () => {
    try {
      // Recupera l'utente corrente loggato
      const currentUser = await callKw<any>('res.users', 'read', [[]], {
        fields: ['id', 'name'],
      });

      const currentUserId = currentUser && currentUser.length > 0 ? currentUser[0].id : null;
      console.log(`👤 Utente loggato (res.users): ID ${currentUserId}`, currentUser);

      // Cerca il dipendente collegato all'utente loggato
      let currentEmployeeUserId: number | null = null;
      if (currentUserId) {
        const currentEmployee = await searchRead<any>(
          'hr.employee',
          [['user_id', '=', currentUserId]],
          ['id', 'name', 'user_id'],
          1
        );

        if (currentEmployee.length > 0) {
          currentEmployeeUserId = currentEmployee[0].user_id ? currentEmployee[0].user_id[0] : null;
          console.log(`👤 Dipendente trovato: ${currentEmployee[0].name} - user_id: ${currentEmployeeUserId}`);
        } else {
          console.log('⚠️ Nessun dipendente trovato per questo utente');
        }
      }

      // Cerca tutti i clienti (partner) che hanno un venditore assegnato (user_id)
      const partners = await searchRead<any>(
        'res.partner',
        [
          ['user_id', '!=', false], // Solo clienti con venditore assegnato
          ['active', '=', true],
        ],
        ['user_id'],
        0
      );

      // Estrai gli ID univoci dei venditori
      const salespeopleIds = Array.from(new Set(partners.map((p: any) => p.user_id[0])));

      console.log(`✅ Trovati ${salespeopleIds.length} venditori con clienti associati`);

      if (salespeopleIds.length === 0) {
        setSalespeople([]);
        return;
      }

      // Carica i dettagli dei venditori
      const users = await searchRead<any>(
        'res.users',
        [['id', 'in', salespeopleIds]],
        ['id', 'name'],
        0,
        'name asc'
      );

      setSalespeople(users.map((u: any) => ({ id: u.id, name: u.name })));

      // Imposta automaticamente il venditore collegato al dipendente come preselezionato
      if (currentEmployeeUserId && salespeopleIds.includes(currentEmployeeUserId)) {
        setSelectedSalesperson(currentEmployeeUserId);
        console.log(`✅ Venditore preimpostato: ID ${currentEmployeeUserId}`);
      }
    } catch (error: any) {
      console.error('Errore caricamento venditori:', error);
    }
  };

  const loadUnpickedProducts = async () => {
    setIsLoading(true);
    setStatusMessage('Caricamento in corso...');

    try {
      // STEP 1: Filtriamo prima gli ORDINI per commitment_date e venditore
      const orderDomain: any[] = [
        ['state', 'in', ['sale', 'done']],
      ];

      // Filtro per venditore
      if (selectedSalesperson) {
        orderDomain.push(['user_id', '=', selectedSalesperson]);
      }

      // Filtro per data di consegna - ordini con commitment_date nel giorno selezionato
      if (selectedDate) {
        orderDomain.push(['commitment_date', '>=', selectedDate + ' 00:00:00']);
        orderDomain.push(['commitment_date', '<=', selectedDate + ' 23:59:59']);
      }

      console.log('🔍 Order domain filter:', JSON.stringify(orderDomain));

      // Cerca gli ordini che soddisfano i filtri
      const orders = await searchRead<any>(
        'sale.order',
        orderDomain,
        ['id', 'name', 'partner_id', 'date_order', 'commitment_date', 'user_id', 'state'],
        0,
        'id desc'
      );

      console.log(`✅ Trovati ${orders.length} ordini che soddisfano i filtri`);

      if (orders.length === 0) {
        setUnpickedProducts([]);
        setStatusMessage('Nessun ordine trovato con i filtri selezionati');
        return;
      }

      // STEP 2: Ora cerchiamo le righe d'ordine di questi ordini specifici
      const orderIds = orders.map((o: any) => o.id);
      const orderLines = await searchRead<any>(
        'sale.order.line',
        [
          ['order_id', 'in', orderIds],
          ['product_uom_qty', '>', 0],
        ],
        [
          'id',
          'order_id',
          'product_id',
          'product_uom_qty',
          'qty_delivered',
          'name',
        ],
        0,
        'order_id desc'
      );

      // Filtra solo le righe con prodotti non completamente consegnati
      const unpicked = orderLines.filter((line: any) => {
        const remaining = line.product_uom_qty - (line.qty_delivered || 0);
        return remaining > 0;
      });

      console.log(`✅ Trovate ${unpicked.length} righe con prodotti non prelevati`);

      if (unpicked.length > 0) {
        const orderMap = new Map(orders.map((o: any) => [o.id, o]));

        // Controlla per ogni ordine se ci sono messaggi che indicano la creazione di un nuovo ordine
        const orderMessages = await searchRead<any>(
          'mail.message',
          [
            ['model', '=', 'sale.order'],
            ['res_id', 'in', orderIds],
            ['body', 'ilike', 'Nuovo ordine creato per prodotti non prelevati'],
          ],
          ['res_id'],
          0
        );

        const ordersWithNewOrder = new Set(orderMessages.map((msg: any) => msg.res_id));

        // Carica i dati dei clienti per ottenere il venditore assegnato (user_id)
        const customerIds = Array.from(new Set(orders.map((o: any) => o.partner_id[0])));
        const customers = await searchRead<any>(
          'res.partner',
          [['id', 'in', customerIds]],
          ['id', 'user_id'],
          0
        );

        const customerSalespersonMap = new Map(
          customers.map((c: any) => [c.id, c.user_id ? c.user_id[1] : null])
        );

        const cards = unpicked
          .map((line: any) => {
            const order = orderMap.get(line.order_id[0]);
            if (!order) return null;

            const card: ProductCard = {
              orderId: order.id,
              orderName: order.name,
              customerId: order.partner_id[0],
              customerName: order.partner_id[1],
              customerSalesperson: customerSalespersonMap.get(order.partner_id[0]),
              productId: line.product_id[0],
              productName: line.product_id[1],
              quantityOrdered: line.product_uom_qty,
              quantityDelivered: line.qty_delivered || 0,
              quantityRemaining: line.product_uom_qty - (line.qty_delivered || 0),
              dateOrder: order.date_order,
              state: order.state,
              hasNewOrder: ordersWithNewOrder.has(order.id),
            };
            return card;
          })
          .filter((card) => card !== null) as ProductCard[];

        setUnpickedProducts(cards);
        setStatusMessage(`Trovati ${cards.length} prodotti non prelevati`);
      } else {
        setUnpickedProducts([]);
        setStatusMessage('Nessun prodotto non prelevato trovato');
      }
    } catch (error: any) {
      console.error('Errore:', error);
      setStatusMessage(`Errore: ${error.message}`);
      setUnpickedProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = (product: ProductCard) => {
    setModalProduct(product);
    setShowModal(true);
    setDeliveryDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  };

  const confirmCreateOrder = async () => {
    if (!modalProduct || !deliveryDate) {
      alert('Seleziona una data di consegna');
      return;
    }

    setIsLoading(true);
    try {
      const orders = await searchRead<any>(
        'sale.order',
        [['id', '=', modalProduct.orderId]],
        ['pricelist_id'],
        1
      );

      const pricelistId = orders[0]?.pricelist_id ? orders[0].pricelist_id[0] : null;

      // Converti le date in formato Odoo (YYYY-MM-DD HH:MM:SS)
      const now = new Date();
      const dateOrderStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newOrderVals: any = {
        partner_id: modalProduct.customerId,
        date_order: dateOrderStr,
        commitment_date: deliveryDate, // Questo è già in formato YYYY-MM-DD
      };

      if (pricelistId) {
        newOrderVals.pricelist_id = pricelistId;
      }

      const newOrderId = await callKw<number>(
        'sale.order',
        'create',
        [newOrderVals],
        {}
      );

      const orderLineVals: any = {
        order_id: newOrderId,
        product_id: modalProduct.productId,
        product_uom_qty: modalProduct.quantityRemaining,
        name: modalProduct.productName,
      };

      await callKw('sale.order.line', 'create', [orderLineVals], {});

      // Aggiungi un messaggio nel chatter del NUOVO ordine per tracciare l'origine
      try {
        await callKw(
          'mail.message',
          'create',
          [
            {
              model: 'sale.order',
              res_id: newOrderId,
              body: `<p>🔄 <strong>Ordine creato dalla Dashboard Prodotti Non Prelevati</strong></p>
<p>Questo ordine è stato generato automaticamente per recuperare i prodotti non prelevati dall'ordine <a href="/web#id=${modalProduct.orderId}&model=sale.order">${modalProduct.orderName}</a>.</p>
<ul>
<li><strong>Prodotto:</strong> ${modalProduct.productName}</li>
<li><strong>Quantità:</strong> ${modalProduct.quantityRemaining}</li>
<li><strong>Cliente:</strong> ${modalProduct.customerName}</li>
<li><strong>Data consegna:</strong> ${deliveryDate}</li>
</ul>`,
              message_type: 'comment',
              subtype_id: 1, // mt_note
            },
          ],
          {}
        );

        // Aggiungi anche un messaggio nell'ordine ORIGINALE per tracciare che è stato creato un nuovo ordine
        await callKw(
          'mail.message',
          'create',
          [
            {
              model: 'sale.order',
              res_id: modalProduct.orderId,
              body: `<p>✅ <strong>Nuovo ordine creato per prodotti non prelevati</strong></p>
<p>È stato creato un nuovo ordine per recuperare i prodotti non prelevati da questo ordine.</p>
<ul>
<li><strong>Nuovo ordine:</strong> <a href="/web#id=${newOrderId}&model=sale.order">Visualizza ordine</a></li>
<li><strong>Prodotto:</strong> ${modalProduct.productName}</li>
<li><strong>Quantità:</strong> ${modalProduct.quantityRemaining}</li>
<li><strong>Data consegna:</strong> ${deliveryDate}</li>
</ul>`,
              message_type: 'comment',
              subtype_id: 1, // mt_note
            },
          ],
          {}
        );
      } catch (msgError: any) {
        console.warn('Impossibile aggiungere messaggio nel chatter:', msgError);
      }

      alert(`Ordine creato con successo! Prodotto: ${modalProduct.productName}, Quantità: ${modalProduct.quantityRemaining}`);
      setShowModal(false);
      loadUnpickedProducts();
    } catch (error: any) {
      console.error('Errore creazione ordine:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center gap-4 border-b border-gray-700">
        <Link href="/dashboard" className="text-white hover:text-gray-300">
          🏠 Home
        </Link>
        <h1 className="text-xl font-bold text-white flex-1">
          📦 Prodotti Non Prelevati
        </h1>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Venditore
            </label>
            <select
              value={selectedSalesperson || ''}
              onChange={(e) => setSelectedSalesperson(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
            >
              <option value="">Tutti i venditori</option>
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
            />
          </div>

          <button
            onClick={loadUnpickedProducts}
            disabled={isLoading}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-semibold disabled:opacity-50"
          >
            {isLoading ? 'Caricamento...' : 'CERCA'}
          </button>
        </div>

        <div className="text-gray-400 mb-4">{statusMessage}</div>

        {/* Cards Grid */}
        {unpickedProducts.length === 0 && !isLoading ? (
          <div className="text-center py-20 text-gray-500">
            <div className="text-6xl mb-4">📭</div>
            <p>Nessun prodotto non prelevato trovato</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unpickedProducts.map((product, idx) => (
              <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700 relative">
                {/* Indicatore stato ordine - punto verde se è stato creato un ordine, rosso altrimenti */}
                <div className="absolute top-4 right-4">
                  <div
                    className={`w-4 h-4 rounded-full ${
                      product.hasNewOrder ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    title={
                      product.hasNewOrder
                        ? 'Nuovo ordine già creato per questo prodotto'
                        : 'Nessun ordine creato ancora'
                    }
                  />
                </div>

                <div className="mb-4 pb-4 border-b border-gray-700">
                  <div className="font-bold text-white text-lg mb-1">
                    👤 {product.customerName}
                  </div>
                  <div className="text-sm text-gray-400">
                    Ordine:{' '}
                    <a
                      href={`https://lapa-sandalo.odoo.com/web#id=${product.orderId}&model=sale.order&view_type=form`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline font-semibold"
                    >
                      {product.orderName}
                    </a>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Prodotto:</span>
                    <span className="text-white font-semibold">{product.productName}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Venditore cliente:</span>
                    <span className="text-blue-400 font-semibold">
                      {product.customerSalesperson || 'Non assegnato'}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Quantità ordinata:</span>
                    <span className="text-white">{product.quantityOrdered}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Quantità consegnata:</span>
                    <span className="text-white">{product.quantityDelivered}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Da prelevare:</span>
                    <span className="text-green-400 font-bold text-lg">
                      {product.quantityRemaining}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Data ordine:</span>
                    <span className="text-white">
                      {new Date(product.dateOrder).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleCreateOrder(product)}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-semibold"
                >
                  Crea Nuovo Ordine
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">
              Crea Nuovo Ordine
            </h3>

            {modalProduct && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">
                    Cliente
                  </label>
                  <input
                    type="text"
                    value={modalProduct.customerName}
                    disabled
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">
                    Prodotto
                  </label>
                  <input
                    type="text"
                    value={modalProduct.productName}
                    disabled
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">
                    Quantità
                  </label>
                  <input
                    type="text"
                    value={modalProduct.quantityRemaining}
                    disabled
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">
                    Data di Consegna
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Annulla
              </button>
              <button
                onClick={confirmCreateOrder}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-semibold disabled:opacity-50"
              >
                {isLoading ? 'Creazione...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
