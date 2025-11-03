/**
 * ESEMPIO DI UTILIZZO API ANALISI PRODOTTO
 *
 * Questo file mostra come usare l'API /api/analisi-prodotto
 * in un componente React/Next.js
 */

'use client';

import { useState } from 'react';

// ========================================================================
// TYPES (same as API response)
// ========================================================================

interface ProductInfo {
  id: number;
  name: string;
  defaultCode: string | null;
  barcode: string | null;
  category: string;
  listPrice: number;
  standardPrice: number;
  theoreticalMargin: number;
  qtyAvailable: number;
  virtualAvailable: number;
  incomingQty: number;
  outgoingQty: number;
  uom: string;
}

interface Supplier {
  partnerId: number;
  partnerName: string;
  productName: string | null;
  productCode: string | null;
  price: number;
  minQty: number;
  delay: number;
}

interface PurchaseOrder {
  orderId: number;
  orderName: string;
  supplierId: number;
  supplierName: string;
  productQty: number;
  qtyReceived: number;
  priceUnit: number;
  priceSubtotal: number;
  dateOrder: string;
  state: string;
}

interface SaleOrder {
  orderId: number;
  orderName: string;
  customerId: number;
  customerName: string;
  productQty: number;
  qtyDelivered: number;
  priceUnit: number;
  priceSubtotal: number;
  createDate: string;
  state: string;
}

interface SupplierStats {
  supplierName: string;
  orders: number;
  qty: number;
  cost: number;
  avgPrice: number;
}

interface CustomerStats {
  customerName: string;
  orders: number;
  qty: number;
  revenue: number;
  avgPrice: number;
}

interface Statistics {
  totalPurchased: number;
  totalReceived: number;
  totalPurchaseCost: number;
  avgPurchasePrice: number;
  totalSold: number;
  totalDelivered: number;
  totalRevenue: number;
  avgSalePrice: number;
  profit: number;
  marginPercent: number;
  roi: number;
  monthlyAvgSales: number;
  weeklyAvgSales: number;
  daysOfCoverage: number;
}

interface ReorderSuggestion {
  reorderPoint: number;
  safetyStock: number;
  optimalOrderQty: number;
  currentStock: number;
  actionRequired: boolean;
  actionMessage: string;
  leadTime: number;
}

interface AnalisiProdottoResponse {
  product: ProductInfo;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  saleOrders: SaleOrder[];
  statistics: Statistics;
  topSuppliers: SupplierStats[];
  topCustomers: CustomerStats[];
  reorderSuggestion: ReorderSuggestion;
  period: {
    dateFrom: string;
    dateTo: string;
  };
}

// ========================================================================
// EXAMPLE COMPONENT
// ========================================================================

export default function AnalisiProdottoExample() {
  const [productName, setProductName] = useState('FIORDILATTE JULIENNE TAGLIO NAPOLI');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalisiProdottoResponse | null>(null);

  const handleAnalyze = async () => {
    if (!productName.trim()) {
      setError('Inserisci il nome del prodotto');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Build URL with query parameters
      const url = new URL('/api/analisi-prodotto', window.location.origin);
      url.searchParams.set('productName', productName);
      if (dateFrom) url.searchParams.set('dateFrom', dateFrom);
      if (dateTo) url.searchParams.set('dateTo', dateTo);

      console.log('Fetching:', url.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);

    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Errore durante l\'analisi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Analisi Prodotto</h1>

      {/* SEARCH FORM */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Prodotto *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Es: FIORDILATTE JULIENNE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inizio (opzionale)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Fine (opzionale)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Analisi in corso...' : 'Analizza Prodotto'}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <strong>Errore:</strong> {error}
        </div>
      )}

      {/* RESULTS */}
      {data && (
        <div className="space-y-6">
          {/* PRODUCT INFO */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{data.product.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Codice</p>
                <p className="font-semibold">{data.product.defaultCode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Categoria</p>
                <p className="font-semibold">{data.product.category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Disponibile</p>
                <p className="font-semibold">
                  {data.product.qtyAvailable} {data.product.uom}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Margine Teorico</p>
                <p className="font-semibold">
                  {data.product.theoreticalMargin.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* STATISTICS */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold mb-4">
              Statistiche ({data.period.dateFrom} - {data.period.dateTo})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-600">Venduto</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.statistics.totalSold.toFixed(0)} {data.product.uom}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <p className="text-sm text-gray-600">Fatturato</p>
                <p className="text-2xl font-bold text-green-600">
                  CHF {data.statistics.totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <p className="text-sm text-gray-600">Profitto</p>
                <p className="text-2xl font-bold text-purple-600">
                  CHF {data.statistics.profit.toFixed(2)}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <p className="text-sm text-gray-600">Margine</p>
                <p className="text-2xl font-bold text-orange-600">
                  {data.statistics.marginPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* REORDER SUGGESTION */}
          <div
            className={`rounded-lg shadow-md p-6 ${
              data.reorderSuggestion.actionRequired
                ? 'bg-red-50 border-2 border-red-500'
                : 'bg-green-50 border-2 border-green-500'
            }`}
          >
            <h3 className="text-xl font-bold mb-4">Suggerimento Riordino</h3>
            <p
              className={`text-lg font-semibold mb-4 ${
                data.reorderSuggestion.actionRequired
                  ? 'text-red-700'
                  : 'text-green-700'
              }`}
            >
              {data.reorderSuggestion.actionMessage}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Stock Attuale</p>
                <p className="font-semibold">
                  {data.reorderSuggestion.currentStock.toFixed(0)} {data.product.uom}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Punto Riordino</p>
                <p className="font-semibold">
                  {data.reorderSuggestion.reorderPoint.toFixed(0)} {data.product.uom}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Quantità Ottimale</p>
                <p className="font-semibold">
                  {data.reorderSuggestion.optimalOrderQty.toFixed(0)} {data.product.uom}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Lead Time</p>
                <p className="font-semibold">{data.reorderSuggestion.leadTime} giorni</p>
              </div>
            </div>
          </div>

          {/* TOP CUSTOMERS */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold mb-4">Top 10 Clienti</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-right">Ordini</th>
                    <th className="px-4 py-2 text-right">Quantità</th>
                    <th className="px-4 py-2 text-right">Fatturato</th>
                    <th className="px-4 py-2 text-right">Prezzo Medio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCustomers.map((customer, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">{customer.customerName}</td>
                      <td className="px-4 py-2 text-right">{customer.orders}</td>
                      <td className="px-4 py-2 text-right">
                        {customer.qty.toFixed(2)} {data.product.uom}
                      </td>
                      <td className="px-4 py-2 text-right">
                        CHF {customer.revenue.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        CHF {customer.avgPrice.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SUPPLIERS */}
          {data.suppliers.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold mb-4">Fornitori</h3>
              <div className="space-y-3">
                {data.suppliers.map((supplier, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <p className="font-semibold">{supplier.partnerName}</p>
                    <p className="text-sm text-gray-600">
                      Prezzo: CHF {supplier.price.toFixed(2)} | Min Qty: {supplier.minQty} |
                      Lead Time: {supplier.delay} giorni
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
