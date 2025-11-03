/**
 * ESEMPIO FRONTEND - Componente React per visualizzare i margini
 *
 * Questo è un esempio di come utilizzare l'API /api/margini
 * in un componente React/Next.js
 */

'use client';

import { useState, useEffect } from 'react';

// ========================================================================
// TYPES
// ========================================================================

interface MarginiSummary {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercentage: number;
  orderCount: number;
  productCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

interface Product {
  id: number;
  name: string;
  defaultCode: string;
  category: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercentage: number;
  avgSalePrice: number;
  avgCostPrice: number;
}

interface GiftProduct {
  id: number;
  name: string;
  defaultCode: string;
  quantity: number;
  cost: number;
  date: string;
  orderName: string;
}

interface GiftByCustomer {
  customerId: number;
  customerName: string;
  products: GiftProduct[];
  totalCost: number;
}

interface Trend {
  date: string;
  revenue: number;
  margin: number;
  cost: number;
  orders: number;
}

interface MarginiResponse {
  summary: MarginiSummary;
  topProducts: Product[];
  lossProducts: Product[];
  giftsGiven: {
    totalCost: number;
    productCount: number;
    products: GiftProduct[];
    byCustomer: GiftByCustomer[];
  };
  trends: Trend[];
  groupedData?: {
    groupBy: string;
    groups: Array<{
      name: string;
      revenue: number;
      cost: number;
      margin: number;
      marginPercentage: number;
      productCount: number;
    }>;
  };
}

// ========================================================================
// COMPONENTE PRINCIPALE
// ========================================================================

export default function MarginiDashboard() {
  const [data, setData] = useState<MarginiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtri
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState<'product' | 'category' | ''>('');

  useEffect(() => {
    fetchMargini();
  }, []);

  async function fetchMargini() {
    setLoading(true);
    setError(null);

    try {
      // Costruisci URL con query params
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (groupBy) params.append('groupBy', groupBy);

      const url = `/api/margini${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);

    } catch (err) {
      console.error('Error fetching margini:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange() {
    fetchMargini();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Errore</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Analisi Margini</h1>

      {/* FILTRI */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Filtri</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data Inizio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data Fine</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Raggruppa per</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Nessuno</option>
              <option value="product">Prodotto</option>
              <option value="category">Categoria</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFilterChange}
              className="w-full bg-blue-500 text-white rounded px-4 py-2 hover:bg-blue-600"
            >
              Applica Filtri
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Fatturato"
          value={`€${data.summary.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          bgColor="bg-blue-50"
          textColor="text-blue-700"
        />
        <SummaryCard
          title="Costo"
          value={`€${data.summary.totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          bgColor="bg-orange-50"
          textColor="text-orange-700"
        />
        <SummaryCard
          title="Margine"
          value={`€${data.summary.totalMargin.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          subtitle={`${data.summary.marginPercentage.toFixed(2)}%`}
          bgColor="bg-green-50"
          textColor="text-green-700"
        />
        <SummaryCard
          title="Ordini"
          value={data.summary.orderCount.toString()}
          subtitle={`${data.summary.productCount} prodotti`}
          bgColor="bg-purple-50"
          textColor="text-purple-700"
        />
      </div>

      {/* TOP PRODUCTS */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Top 10 Prodotti per Margine</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Codice</th>
                  <th className="px-4 py-2 text-left">Nome</th>
                  <th className="px-4 py-2 text-right">Qtà</th>
                  <th className="px-4 py-2 text-right">Fatturato</th>
                  <th className="px-4 py-2 text-right">Costo</th>
                  <th className="px-4 py-2 text-right">Margine</th>
                  <th className="px-4 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-sm">{p.defaultCode}</td>
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 text-right">{p.quantitySold.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">€{p.totalRevenue.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">€{p.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-600">
                      €{p.totalMargin.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">{p.marginPercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* LOSS PRODUCTS */}
      {data.lossProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600">
              Prodotti in Perdita ({data.lossProducts.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Codice</th>
                    <th className="px-4 py-2 text-left">Nome</th>
                    <th className="px-4 py-2 text-right">Qtà</th>
                    <th className="px-4 py-2 text-right">Fatturato</th>
                    <th className="px-4 py-2 text-right">Costo</th>
                    <th className="px-4 py-2 text-right">Perdita</th>
                    <th className="px-4 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lossProducts.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-red-50">
                      <td className="px-4 py-2 font-mono text-sm">{p.defaultCode}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 text-right">{p.quantitySold.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">€{p.totalRevenue.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">€{p.totalCost.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-600">
                        €{p.totalMargin.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {p.marginPercentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GIFTS */}
      {data.giftsGiven.productCount > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              Prodotti Regalati ({data.giftsGiven.productCount})
            </h2>
            <p className="text-gray-600 mb-4">
              Costo totale: €{data.giftsGiven.totalCost.toFixed(2)}
            </p>

            <h3 className="font-semibold mb-2">Per Cliente</h3>
            <div className="space-y-3">
              {data.giftsGiven.byCustomer.map((customer) => (
                <div key={customer.customerId} className="border rounded p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{customer.customerName}</h4>
                    <span className="text-red-600 font-semibold">
                      €{customer.totalCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {customer.products.map((p, i) => (
                      <div key={i} className="ml-4">
                        • {p.name} ({p.defaultCode}) - Qtà: {p.quantity}, Costo: €
                        {p.cost.toFixed(2)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TRENDS CHART (semplificato) */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Trend Giornalieri</h2>
          <div className="space-y-2">
            {data.trends.slice(0, 10).map((trend) => (
              <div key={trend.date} className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-600">{trend.date}</div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="text-sm">
                    €{trend.revenue.toFixed(2)} / €{trend.margin.toFixed(2)}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-green-500 h-4 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (trend.margin / data.summary.totalMargin) * 100 * 10
                        )}%`
                      }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500">{trend.orders} ordini</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================================================
// COMPONENTI HELPER
// ========================================================================

function SummaryCard({
  title,
  value,
  subtitle,
  bgColor,
  textColor
}: {
  title: string;
  value: string;
  subtitle?: string;
  bgColor: string;
  textColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg shadow p-6`}>
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
  );
}
