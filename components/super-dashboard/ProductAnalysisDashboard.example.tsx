// Example usage of ProductAnalysisDashboard component

import { ProductAnalysisDashboard } from '@/components/super-dashboard';

// Example 1: Basic usage with mock data
export function ProductAnalysisExample() {
  const mockData = {
    product: {
      id: 'PROD-001',
      name: 'Parmigiano Reggiano DOP 24 Mesi',
      code: 'PAR-24M-1KG',
      category: 'Formaggi',
    },
    period: {
      start: '2024-10-01',
      end: '2024-10-31',
      label: 'Ottobre 2024',
    },
    kpis: {
      totalRevenue: 125000,
      totalCosts: 75000,
      netProfit: 50000,
      marginPercent: 40.0,
      quantitySold: 850,
      currentStock: 120,
    },
    trends: {
      revenueChange: 12.5,
      profitChange: 15.3,
      marginChange: 2.1,
    },
    salesVsPurchases: [
      { date: '01/10', sales: 12000, purchases: 8000 },
      { date: '08/10', sales: 15000, purchases: 9000 },
      { date: '15/10', sales: 13500, purchases: 7500 },
      { date: '22/10', sales: 18000, purchases: 10000 },
      { date: '29/10', sales: 16500, purchases: 8500 },
    ],
    topCustomers: [
      { id: 'C1', name: 'Ristorante Da Vinci', quantity: 150, revenue: 22500 },
      { id: 'C2', name: 'Hotel Bellevue', quantity: 120, revenue: 18000 },
      { id: 'C3', name: 'Gastronomia Italiana', quantity: 100, revenue: 15000 },
      { id: 'C4', name: 'Trattoria del Sole', quantity: 95, revenue: 14250 },
      { id: 'C5', name: 'Bistro Milano', quantity: 85, revenue: 12750 },
      { id: 'C6', name: 'Pizzeria Napoli', quantity: 70, revenue: 10500 },
      { id: 'C7', name: 'Caffè Roma', quantity: 60, revenue: 9000 },
      { id: 'C8', name: 'Osteria Antica', quantity: 55, revenue: 8250 },
      { id: 'C9', name: 'Ristorante Venezia', quantity: 50, revenue: 7500 },
      { id: 'C10', name: 'Bar Centrale', quantity: 45, revenue: 6750 },
    ],
    customerDistribution: [
      { customer: 'Ristorante Da Vinci', value: 22500, percentage: 18 },
      { customer: 'Hotel Bellevue', value: 18000, percentage: 14.4 },
      { customer: 'Gastronomia Italiana', value: 15000, percentage: 12 },
      { customer: 'Altri (7 clienti)', value: 69500, percentage: 55.6 },
    ],
    suppliers: [
      { id: 'S1', name: 'Caseificio Rossi SRL', price: 88.5, leadTime: 7, isPreferred: true },
      { id: 'S2', name: 'Latteria Verdi & Co', price: 92.0, leadTime: 10, isPreferred: false },
      { id: 'S3', name: 'Dairy Import AG', price: 85.0, leadTime: 14, isPreferred: false },
    ],
    inventory: {
      currentStock: 120,
      locations: [
        { location: 'A-01-001 (Magazzino Principale)', quantity: 80 },
        { location: 'B-02-015 (Cella Frigo)', quantity: 35 },
        { location: 'C-01-008 (In Transito)', quantity: 5 },
      ],
      incoming: 50,
      outgoing: 30,
      reorderPoint: 100,
      safetyStock: 80,
    },
    recommendations: {
      reorderNeeded: false,
      action: 'Mantieni i livelli attuali di stock. Il prodotto sta performando bene con margini sopra target.',
      reason: 'La giacenza è sopra il punto di riordino e la domanda è stabile con trend positivo.',
      priority: 'low',
    },
  };

  return <ProductAnalysisDashboard data={mockData} isLoading={false} error={null} />;
}

// Example 2: Loading state
export function ProductAnalysisLoadingExample() {
  return <ProductAnalysisDashboard data={null} isLoading={true} error={null} />;
}

// Example 3: Error state
export function ProductAnalysisErrorExample() {
  return (
    <ProductAnalysisDashboard
      data={null}
      isLoading={false}
      error="Impossibile recuperare i dati del prodotto. Il server non risponde."
    />
  );
}

// Example 4: Real implementation with API call
export function ProductAnalysisRealExample({ productId }: { productId: string }) {
  const [data, setData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchProductAnalysis() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/products/${productId}/analysis`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Failed to load product analysis');
        }
      } catch (err: any) {
        console.error('Error fetching product analysis:', err);
        setError(err.message || 'Failed to load product analysis');
      } finally {
        setIsLoading(false);
      }
    }

    if (productId) {
      fetchProductAnalysis();
    }
  }, [productId]);

  return <ProductAnalysisDashboard data={data} isLoading={isLoading} error={error} />;
}

// Example 5: Critical reorder scenario
export function ProductAnalysisCriticalExample() {
  const criticalData = {
    product: {
      id: 'PROD-002',
      name: 'Prosciutto di Parma DOP 24 Mesi',
      code: 'PRO-24M-1KG',
      category: 'Salumi',
    },
    period: {
      start: '2024-10-01',
      end: '2024-10-31',
      label: 'Ottobre 2024',
    },
    kpis: {
      totalRevenue: 95000,
      totalCosts: 65000,
      netProfit: 30000,
      marginPercent: 31.6,
      quantitySold: 650,
      currentStock: 35, // Low stock!
    },
    trends: {
      revenueChange: 8.2,
      profitChange: -2.5, // Negative trend
      marginChange: -1.8,
    },
    salesVsPurchases: [
      { date: '01/10', sales: 18000, purchases: 15000 },
      { date: '08/10', sales: 20000, purchases: 12000 },
      { date: '15/10', sales: 22000, purchases: 10000 },
      { date: '22/10', sales: 19000, purchases: 14000 },
      { date: '29/10', sales: 16000, purchases: 14000 },
    ],
    topCustomers: [
      { id: 'C1', name: 'Hotel Grand Suisse', quantity: 180, revenue: 27000 },
      { id: 'C2', name: 'Ristorante Elite', quantity: 150, revenue: 22500 },
      { id: 'C3', name: 'Catering Premium', quantity: 120, revenue: 18000 },
      { id: 'C4', name: 'Gourmet Shop', quantity: 90, revenue: 13500 },
      { id: 'C5', name: 'Delicatessen Zentrum', quantity: 110, revenue: 14000 },
    ],
    customerDistribution: [
      { customer: 'Hotel Grand Suisse', value: 27000, percentage: 28.4 },
      { customer: 'Ristorante Elite', value: 22500, percentage: 23.7 },
      { customer: 'Catering Premium', value: 18000, percentage: 18.9 },
      { customer: 'Altri', value: 27500, percentage: 28.9 },
    ],
    suppliers: [
      { id: 'S1', name: 'Salumificio Langhirano', price: 100.0, leadTime: 14, isPreferred: true },
      { id: 'S2', name: 'Parma Food Export', price: 105.0, leadTime: 7, isPreferred: false },
    ],
    inventory: {
      currentStock: 35, // Below reorder point!
      locations: [
        { location: 'A-01-005 (Magazzino Principale)', quantity: 25 },
        { location: 'B-03-012 (Cella Frigo)', quantity: 10 },
      ],
      incoming: 0, // Nothing incoming!
      outgoing: 45, // High outgoing!
      reorderPoint: 120,
      safetyStock: 100,
    },
    recommendations: {
      reorderNeeded: true,
      action: 'ORDINE URGENTE RICHIESTO: Scorta critica sotto il punto di riordino. Ordinare almeno 200 unità immediatamente.',
      reason:
        'Stock attuale (35) è ben al di sotto del punto di riordino (120) con 45 unità in uscita e nessun ordine in arrivo. Rischio rottura di stock entro 3-5 giorni.',
      priority: 'critical',
    },
  };

  return <ProductAnalysisDashboard data={criticalData} isLoading={false} error={null} />;
}

// TypeScript interface for API response
export interface ProductAnalysisAPIResponse {
  success: boolean;
  data?: ProductData;
  error?: string;
}

// Import statement for use
import React from 'react';

// Note: To use this component in your app, import it like this:
// import { ProductAnalysisDashboard } from '@/components/super-dashboard';
