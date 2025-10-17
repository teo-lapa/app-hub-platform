'use client';

/**
 * TABELLA PRODOTTI CRITICI
 *
 * Mostra TUTTI i prodotti in ordine di criticità
 * AUTOMATICO - calcola lead time reali in background
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  TruckIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface CriticalProduct {
  id: number;
  name: string;
  currentStock: number;
  avgDailySales: number;
  daysRemaining: number;
  urgencyLevel: 'EMERGENCY' | 'CRITICAL' | 'HIGH' | 'MEDIUM';
  supplierName: string;
  supplierId: number;
  supplierLeadTime: number;
  supplierReliability: number | null;
  recommendedOrderQty: number;
  canOrderInTime: boolean; // Se days remaining >= lead time
}

export default function ProdottiCriticiPage() {
  const router = useRouter();
  const [products, setProducts] = useState<CriticalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [analyzingSuppliers, setAnalyzingSuppliers] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadCriticalProducts();
  }, []);

  async function loadCriticalProducts() {
    setLoading(true);
    try {
      console.log('📊 Caricamento prodotti critici...');

      // 1. Carica prodotti critici dall'API esistente
      const response = await fetch('/api/smart-ordering-v2/suppliers');
      const data = await response.json();

      if (data.success) {
        // 2. Estrai TUTTI i prodotti critici da tutti i fornitori
        const allProducts: CriticalProduct[] = [];

        data.suppliers.forEach((supplier: any) => {
          supplier.products
            .filter((p: any) => ['CRITICAL', 'HIGH', 'EMERGENCY'].includes(p.urgencyLevel))
            .forEach((product: any) => {
              allProducts.push({
                id: product.id,
                name: product.name,
                currentStock: product.currentStock,
                avgDailySales: product.avgDailySales,
                daysRemaining: product.daysRemaining,
                urgencyLevel: product.urgencyLevel,
                supplierName: supplier.name,
                supplierId: supplier.id,
                supplierLeadTime: supplier.leadTime,
                supplierReliability: null, // Sarà aggiornato dopo
                recommendedOrderQty: product.suggestedQty,
                canOrderInTime: product.daysRemaining >= supplier.leadTime
              });
            });
        });

        // 3. Ordina per criticità
        allProducts.sort((a, b) => {
          // Prima EMERGENCY
          if (a.urgencyLevel === 'EMERGENCY' && b.urgencyLevel !== 'EMERGENCY') return -1;
          if (b.urgencyLevel === 'EMERGENCY' && a.urgencyLevel !== 'EMERGENCY') return 1;

          // Poi CRITICAL
          if (a.urgencyLevel === 'CRITICAL' && b.urgencyLevel === 'HIGH') return -1;
          if (b.urgencyLevel === 'CRITICAL' && a.urgencyLevel === 'HIGH') return 1;

          // All'interno dello stesso livello, ordina per giorni rimanenti
          return a.daysRemaining - b.daysRemaining;
        });

        setProducts(allProducts);
        console.log(`✅ ${allProducts.length} prodotti critici caricati`);

        // 4. AUTOMATICO: Avvia analisi lead time in background per fornitori unici
        const uniqueSuppliers = Array.from(new Set(allProducts.map(p => p.supplierId)));
        analyzeSuppliers(uniqueSuppliers);
      }

    } catch (error) {
      console.error('❌ Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  }

  // AUTOMATICO: Analizza fornitori in background
  async function analyzeSuppliers(supplierIds: number[]) {
    console.log(`🔍 Analisi automatica ${supplierIds.length} fornitori...`);

    for (const supplierId of supplierIds) {
      if (analyzingSuppliers.has(supplierId)) continue;

      setAnalyzingSuppliers(prev => new Set(prev).add(supplierId));

      try {
        const response = await fetch(`/api/smart-ordering-v2/suppliers-enhanced?supplierId=${supplierId}`);
        const data = await response.json();

        if (data.success) {
          // Aggiorna prodotti con lead time reale
          setProducts(prev => prev.map(p =>
            p.supplierId === supplierId
              ? {
                  ...p,
                  supplierLeadTime: data.analysis.medianLeadTime,
                  supplierReliability: data.analysis.reliabilityScore,
                  canOrderInTime: p.daysRemaining >= data.analysis.medianLeadTime
                }
              : p
          ));

          console.log(`✅ Fornitore ${supplierId} analizzato: ${data.analysis.medianLeadTime}gg`);
        }
      } catch (error) {
        console.error(`⚠️ Errore fornitore ${supplierId}:`, error);
      } finally {
        setAnalyzingSuppliers(prev => {
          const next = new Set(prev);
          next.delete(supplierId);
          return next;
        });
      }

      // Aspetta 2 secondi tra analisi per non sovraccaricare Odoo
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('✅ Analisi automatica completata!');
  }

  function exportToExcel() {
    // TODO: Implementa export Excel
    console.log('📥 Export Excel...');
    alert('Export Excel - Da implementare');
  }

  const filteredProducts = filter === 'all'
    ? products
    : filter === 'cannot-order'
    ? products.filter(p => !p.canOrderInTime)
    : products.filter(p => p.urgencyLevel === filter.toUpperCase());

  const emergencyCount = products.filter(p => p.urgencyLevel === 'EMERGENCY').length;
  const criticalCount = products.filter(p => p.urgencyLevel === 'CRITICAL').length;
  const cannotOrderCount = products.filter(p => !p.canOrderInTime).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/ordini-smart-v2')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium text-gray-700"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Indietro
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Prodotti Critici</h1>
              <p className="text-gray-600">Tutti i prodotti che richiedono attenzione</p>
            </div>
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Esporta Excel
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Totale Prodotti"
            value={products.length}
            color="blue"
            onClick={() => setFilter('all')}
            active={filter === 'all'}
          />
          <StatCard
            label="EMERGENCY"
            value={emergencyCount}
            color="red"
            onClick={() => setFilter('emergency')}
            active={filter === 'emergency'}
          />
          <StatCard
            label="CRITICAL"
            value={criticalCount}
            color="orange"
            onClick={() => setFilter('critical')}
            active={filter === 'critical'}
          />
          <StatCard
            label="Non Ordinabili in Tempo"
            value={cannotOrderCount}
            color="purple"
            onClick={() => setFilter('cannot-order')}
            active={filter === 'cannot-order'}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento prodotti critici...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Urgenza</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Prodotto</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Stock</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Giorni</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Fornitore</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Lead Time</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Affidabilità</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Qtà Suggerita</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <ProductRow key={product.id} product={product} />
                  ))}
                </tbody>
              </table>
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Nessun prodotto trovato con questi filtri</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick, active }: any) {
  const colors: Record<string, string> = {
    blue: active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-900 hover:bg-blue-100',
    red: active ? 'bg-red-600 text-white' : 'bg-red-50 text-red-900 hover:bg-red-100',
    orange: active ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-900 hover:bg-orange-100',
    purple: active ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
  };

  return (
    <button
      onClick={onClick}
      className={`${colors[color] || colors.blue} p-4 rounded-xl transition cursor-pointer`}
    >
      <p className={`text-sm ${active ? 'opacity-90' : 'opacity-70'}`}>{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </button>
  );
}

function ProductRow({ product }: { product: CriticalProduct }) {
  const urgencyColors = {
    EMERGENCY: 'bg-red-100 text-red-900',
    CRITICAL: 'bg-orange-100 text-orange-900',
    HIGH: 'bg-yellow-100 text-yellow-900',
    MEDIUM: 'bg-blue-100 text-blue-900'
  };

  const reliabilityColor = product.supplierReliability
    ? product.supplierReliability >= 80 ? 'text-green-600' :
      product.supplierReliability >= 60 ? 'text-yellow-600' : 'text-red-600'
    : 'text-gray-400';

  return (
    <tr className="hover:bg-gray-50 transition">
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${urgencyColors[product.urgencyLevel]}`}>
          {product.urgencyLevel === 'EMERGENCY' && <ExclamationTriangleIcon className="w-4 h-4" />}
          {product.urgencyLevel}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">{product.name}</div>
        <div className="text-sm text-gray-500">ID: {product.id}</div>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="font-semibold text-gray-900">{product.currentStock.toFixed(0)}</span>
        <div className="text-xs text-gray-500">{product.avgDailySales.toFixed(1)}/gg</div>
      </td>
      <td className="px-6 py-4 text-right">
        <span className={`font-bold ${product.daysRemaining < 3 ? 'text-red-600' : product.daysRemaining < 7 ? 'text-orange-600' : 'text-gray-900'}`}>
          {product.daysRemaining.toFixed(1)}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <TruckIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-900">{product.supplierName}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <ClockIcon className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{product.supplierLeadTime}gg</span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <span className={`font-bold ${reliabilityColor}`}>
          {product.supplierReliability ? `${product.supplierReliability.toFixed(0)}/100` : '...'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="font-bold text-blue-600">{product.recommendedOrderQty}</span>
      </td>
      <td className="px-6 py-4 text-center">
        {!product.canOrderInTime ? (
          <span className="inline-block px-3 py-1 bg-red-100 text-red-900 text-xs font-bold rounded-full">
            ⚠️ URGENTE
          </span>
        ) : (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            Ordina
          </button>
        )}
      </td>
    </tr>
  );
}
