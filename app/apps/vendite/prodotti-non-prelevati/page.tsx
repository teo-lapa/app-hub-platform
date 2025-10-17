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
  productId: number;
  productName: string;
  quantityOrdered: number;
  quantityDelivered: number;
  quantityRemaining: number;
  dateOrder: string;
  state: string;
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
      // Cerca il gruppo "Sales / User" o "Sales / Administrator"
      const salesGroups = await searchRead<any>(
        'res.groups',
        [['name', 'in', ['User', 'Administrator']], ['category_id.name', '=', 'Sales']],
        ['id'],
        0
      );

      if (salesGroups.length === 0) {
        console.warn('Nessun gruppo vendite trovato');
        setSalespeople([]);
        return;
      }

      const groupIds = salesGroups.map((g: any) => g.id);

      // Carica solo gli utenti che appartengono ai gruppi vendite
      const users = await searchRead<any>(
        'res.users',
        [['active', '=', true], ['groups_id', 'in', groupIds]],
        ['id', 'name'],
        0,
        'name asc'
      );
      setSalespeople(users.map((u: any) => ({ id: u.id, name: u.name })));
    } catch (error: any) {
      console.error('Errore caricamento venditori:', error);
    }
  };

  const loadUnpickedProducts = async () => {
    setIsLoading(true);
    setStatusMessage('Caricamento in corso...');

    try {
      // Costruisci il domain con i filtri
      const domain: any[] = [
        ['order_id.state', 'in', ['sale', 'done']],
        ['product_uom_qty', '>', 0],
      ];

      // Filtro per venditore
      if (selectedSalesperson) {
        domain.push(['order_id.user_id', '=', selectedSalesperson]);
      }

      // Filtro per data di consegna - ordini con consegna fino alla data selezionata
      if (selectedDate) {
        domain.push(['order_id.commitment_date', '<=', selectedDate + ' 23:59:59']);
      }

      const orderLines = await searchRead<any>(
        'sale.order.line',
        domain,
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

      const unpicked = orderLines.filter((line: any) => {
        const remaining = line.product_uom_qty - (line.qty_delivered || 0);
        return remaining > 0;
      });

      if (unpicked.length > 0) {
        const orderIds = [...new Set(unpicked.map((line: any) => line.order_id[0]))];
        const orders = await searchRead<any>(
          'sale.order',
          [['id', 'in', orderIds]],
          ['id', 'name', 'partner_id', 'date_order', 'commitment_date', 'user_id', 'state'],
          0
        );

        const orderMap = new Map(orders.map((o: any) => [o.id, o]));

        const cards: ProductCard[] = unpicked
          .map((line: any) => {
            const order = orderMap.get(line.order_id[0]);
            if (!order) return null;

            return {
              orderId: order.id,
              orderName: order.name,
              customerId: order.partner_id[0],
              customerName: order.partner_id[1],
              productId: line.product_id[0],
              productName: line.product_id[1],
              quantityOrdered: line.product_uom_qty,
              quantityDelivered: line.qty_delivered || 0,
              quantityRemaining: line.product_uom_qty - (line.qty_delivered || 0),
              dateOrder: order.date_order,
              state: order.state,
            };
          })
          .filter((card): card is ProductCard => card !== null);

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

      const newOrderVals: any = {
        partner_id: modalProduct.customerId,
        date_order: new Date().toISOString(),
        commitment_date: deliveryDate,
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
        <Link href="/" className="text-white hover:text-gray-300">
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
              <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="mb-4 pb-4 border-b border-gray-700">
                  <div className="font-bold text-white text-lg mb-1">
                    👤 {product.customerName}
                  </div>
                  <div className="text-sm text-gray-400">
                    Ordine: {product.orderName}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Prodotto:</span>
                    <span className="text-white font-semibold">{product.productName}</span>
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
