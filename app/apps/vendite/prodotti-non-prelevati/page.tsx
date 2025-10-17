'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ============================================================================
// INTERFACCE TYPESCRIPT
// ============================================================================

interface SalesPerson {
  id: number;
  name: string;
}

interface UnpickedProduct {
  id: number;
  order_id: [number, string];
  order_name: string;
  partner_id: [number, string];
  partner_name: string;
  product_id: [number, string];
  product_name: string;
  product_uom_qty: number;
  qty_delivered: number;
  qty_remaining: number;
  date_order: string;
  user_id: [number, string] | false; // Venditore
  state: string;
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

// ============================================================================
// FUNZIONI RPC
// ============================================================================

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

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

export default function ProdottiNonPrelevatiPage() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Seleziona i filtri e clicca CERCA');

  // Filtri
  const [salespeople, setSalespeople] = useState<SalesPerson[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Dati
  const [unpickedProducts, setUnpickedProducts] = useState<ProductCard[]>([]);

  // Modal per creare nuovo ordine
  const [showModal, setShowModal] = useState(false);
  const [modalProduct, setModalProduct] = useState<ProductCard | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );

  // --------------------------------------------------------------------------
  // EFFECTS
  // --------------------------------------------------------------------------

  useEffect(() => {
    const stored = localStorage.getItem('lapa_theme') as 'light' | 'dark' | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  useEffect(() => {
    loadSalespeople();
  }, []);

  // --------------------------------------------------------------------------
  // UTILITY FUNCTIONS
  // --------------------------------------------------------------------------

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('lapa_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // --------------------------------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------------------------------

  const loadSalespeople = async () => {
    try {
      // Carica tutti i venditori (utenti con gruppo vendite)
      const users = await searchRead<any>(
        'res.users',
        [['active', '=', true]],
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
      // Costruisci il dominio di ricerca
      const domain: any[] = [
        ['state', 'in', ['sale', 'done']], // Ordini confermati
      ];

      // Filtro per venditore
      if (selectedSalesperson) {
        domain.push(['user_id', '=', selectedSalesperson]);
      }

      // Filtro per data (ordini fino alla data selezionata)
      if (selectedDate) {
        domain.push(['date_order', '<=', selectedDate + ' 23:59:59']);
      }

      console.log('Domain:', domain);

      // Carica le righe d'ordine
      const orderLines = await searchRead<any>(
        'sale.order.line',
        [
          ['order_id.state', 'in', ['sale', 'done']],
          ['order_id.user_id', selectedSalesperson ? '=' : '!=', selectedSalesperson || false],
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

      console.log('Order lines trovate:', orderLines.length);

      // Filtra solo i prodotti che hanno quantità non consegnata
      const unpicked = orderLines.filter((line: any) => {
        const remaining = line.product_uom_qty - (line.qty_delivered || 0);
        return remaining > 0;
      });

      console.log('Prodotti non prelevati:', unpicked.length);

      // Se ci sono prodotti non prelevati, carica i dettagli degli ordini
      if (unpicked.length > 0) {
        const orderIds = [...new Set(unpicked.map((line: any) => line.order_id[0]))];

        const orders = await searchRead<any>(
          'sale.order',
          [['id', 'in', orderIds]],
          ['id', 'name', 'partner_id', 'date_order', 'user_id', 'state'],
          0
        );

        const orderMap = new Map(orders.map((o: any) => [o.id, o]));

        // Combina i dati
        const cards: ProductCard[] = unpicked
          .map((line: any) => {
            const order = orderMap.get(line.order_id[0]);
            if (!order) return null;

            // Applica filtri
            if (selectedSalesperson && order.user_id && order.user_id[0] !== selectedSalesperson) {
              return null;
            }

            if (selectedDate && order.date_order > selectedDate + ' 23:59:59') {
              return null;
            }

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

  // --------------------------------------------------------------------------
  // CREATE NEW ORDER
  // --------------------------------------------------------------------------

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
      // Trova il listino del cliente dall'ordine originale
      const orders = await searchRead<any>(
        'sale.order',
        [['id', '=', modalProduct.orderId]],
        ['pricelist_id'],
        1
      );

      const pricelistId = orders[0]?.pricelist_id ? orders[0].pricelist_id[0] : null;

      // Crea il nuovo ordine
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

      // Aggiungi la riga dell'ordine
      const orderLineVals: any = {
        order_id: newOrderId,
        product_id: modalProduct.productId,
        product_uom_qty: modalProduct.quantityRemaining,
        name: modalProduct.productName,
      };

      await callKw('sale.order.line', 'create', [orderLineVals], {});

      alert(`Ordine creato con successo! Prodotto: ${modalProduct.productName}, Quantità: ${modalProduct.quantityRemaining}`);
      setShowModal(false);

      // Ricarica i dati
      loadUnpickedProducts();
    } catch (error: any) {
      console.error('Errore creazione ordine:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #0b1220;
          --text: #e5e7eb;
          --muted: #94a3b8;
          --card: #0f172a;
          --border: #1f2937;
          --chip: #0b1220;
          --ok: #16a34a;
          --err: #ef4444;
          --accent: #22c55e;
          --accent2: #2563eb;
          --btnText: #052112;
          --btnText2: #eaf2ff;
        }

        [data-theme='light'] {
          --bg: #f6f8fc;
          --text: #0a1628;
          --muted: #5b6a7f;
          --card: #ffffff;
          --border: #e5e9f2;
          --chip: #eef3fb;
          --accent: #0ea5e9;
          --accent2: #7c3aed;
          --btnText: #04212b;
          --btnText2: #f1eaff;
        }

        html,
        body {
          height: 100%;
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font: 15px/1.5 system-ui, Segoe UI, Arial;
        }

        * {
          box-sizing: border-box;
        }

        #app {
          position: fixed;
          inset: 0;
          overflow: auto;
          background: radial-gradient(1200px 800px at 20% -10%, #111827 0%, var(--bg) 55%, var(--bg) 100%);
        }

        .wrap {
          max-width: 1400px;
          margin: 22px auto;
          padding: 0 18px 40px;
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 5;
          backdrop-filter: blur(8px);
          background: color-mix(in oklab, var(--bg) 80%, transparent);
          border-bottom: 1px solid var(--border);
          padding: 12px 16px;
          margin: 0 -18px 18px;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.2px;
          margin-right: auto;
        }

        .filters {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          padding: 16px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
        }

        select,
        input[type='date'] {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          min-width: 200px;
        }

        .btn {
          padding: 12px 16px;
          border: 0;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 800;
          transition: 0.15s transform;
          font-size: 14px;
        }

        .btn:active {
          transform: translateY(1px);
        }

        .btn.green {
          background: var(--accent);
          color: var(--btnText);
        }

        .btn.blue {
          background: var(--accent2);
          color: var(--btnText2);
        }

        .btn.ghost {
          background: var(--chip);
          color: var(--muted);
          border: 1px solid var(--border);
        }

        .btn.slim {
          padding: 8px 12px;
          font-size: 12px;
          border-radius: 10px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .info {
          color: var(--muted);
          font-size: 13px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .product-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .product-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .card-header {
          display: flex;
          align-items: start;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px dashed var(--border);
        }

        .card-title {
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          margin-bottom: 4px;
        }

        .card-subtitle {
          font-size: 13px;
          color: var(--muted);
        }

        .card-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }

        .card-label {
          color: var(--muted);
          font-weight: 600;
        }

        .card-value {
          color: var(--text);
          font-weight: 700;
        }

        .card-value.highlight {
          color: var(--accent);
          font-size: 18px;
        }

        .card-footer {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px dashed var(--border);
        }

        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.68);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal.show {
          display: flex;
        }

        .modal-dialog {
          width: 500px;
          max-width: 95vw;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          flex: 1;
        }

        .modal-close {
          background: transparent;
          border: none;
          color: var(--muted);
          cursor: pointer;
          font-weight: 700;
          font-size: 20px;
        }

        .modal-body {
          padding: 16px;
        }

        .modal-field {
          margin-bottom: 16px;
        }

        .modal-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .modal-field input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid var(--border);
        }

        .loading {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          animation: spin 1s linear infinite;
          display: inline-block;
          vertical-align: -3px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--muted);
        }

        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        @media (max-width: 768px) {
          .cards-grid {
            grid-template-columns: 1fr;
          }

          .filters {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-group {
            width: 100%;
          }

          select,
          input[type='date'] {
            width: 100%;
          }
        }
      `}</style>

      <div id="app">
        <div className="wrap">
          <div className="topbar">
            <Link
              href="/"
              className="btn ghost"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              🏠 Home
            </Link>
            <div className="title">📦 Prodotti Non Prelevati</div>
            <button className="btn ghost" type="button" onClick={toggleTheme}>
              {theme === 'light' ? '☀️ Chiaro' : '🌙 Scuro'}
            </button>
          </div>

          {/* Filtri */}
          <div className="filters">
            <div className="filter-group">
              <label className="filter-label">Venditore</label>
              <select
                value={selectedSalesperson || ''}
                onChange={(e) => setSelectedSalesperson(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Tutti i venditori</option>
                {salespeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
              <label className="filter-label" style={{ opacity: 0 }}>-</label>
              <button
                className="btn green"
                type="button"
                onClick={loadUnpickedProducts}
                disabled={isLoading}
              >
                {isLoading ? <span className="loading"></span> : 'CERCA'}
              </button>
            </div>
          </div>

          <div className="info">{statusMessage}</div>

          {/* Cards Grid */}
          {unpickedProducts.length === 0 && !isLoading ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p>Nessun prodotto non prelevato trovato</p>
            </div>
          ) : (
            <div className="cards-grid">
              {unpickedProducts.map((product, idx) => (
                <div key={idx} className="product-card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">👤 {product.customerName}</div>
                      <div className="card-subtitle">Ordine: {product.orderName}</div>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-row">
                      <span className="card-label">Prodotto:</span>
                      <span className="card-value">{product.productName}</span>
                    </div>

                    <div className="card-row">
                      <span className="card-label">Quantità ordinata:</span>
                      <span className="card-value">{product.quantityOrdered}</span>
                    </div>

                    <div className="card-row">
                      <span className="card-label">Quantità consegnata:</span>
                      <span className="card-value">{product.quantityDelivered}</span>
                    </div>

                    <div className="card-row">
                      <span className="card-label">Da prelevare:</span>
                      <span className="card-value highlight">{product.quantityRemaining}</span>
                    </div>

                    <div className="card-row">
                      <span className="card-label">Data ordine:</span>
                      <span className="card-value">
                        {new Date(product.dateOrder).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  </div>

                  <div className="card-footer">
                    <button
                      className="btn blue"
                      style={{ width: '100%' }}
                      onClick={() => handleCreateOrder(product)}
                    >
                      Crea Nuovo Ordine
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal per creare ordine */}
      <div className={`modal ${showModal ? 'show' : ''}`}>
        <div className="modal-dialog">
          <div className="modal-header">
            <h3>Crea Nuovo Ordine</h3>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              ✕
            </button>
          </div>
          <div className="modal-body">
            {modalProduct && (
              <>
                <div className="modal-field">
                  <label>Cliente</label>
                  <input type="text" value={modalProduct.customerName} disabled />
                </div>

                <div className="modal-field">
                  <label>Prodotto</label>
                  <input type="text" value={modalProduct.productName} disabled />
                </div>

                <div className="modal-field">
                  <label>Quantità</label>
                  <input type="text" value={modalProduct.quantityRemaining} disabled />
                </div>

                <div className="modal-field">
                  <label>Data di Consegna</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn ghost" onClick={() => setShowModal(false)}>
              Annulla
            </button>
            <button
              className="btn blue"
              onClick={confirmCreateOrder}
              disabled={isLoading}
            >
              {isLoading ? <span className="loading"></span> : 'Conferma'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
