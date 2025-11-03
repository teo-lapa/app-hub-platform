// Mock data generator for ProductAnalysisDashboard
import type { ProductData, MockDataOptions } from './ProductAnalysisDashboard.types';

/**
 * Generates mock product analysis data for testing and development
 * @param options - Configuration options for mock data generation
 * @returns ProductData object with realistic mock data
 */
export function generateMockProductData(options: MockDataOptions = {}): ProductData {
  const {
    productId = 'PROD-001',
    productName = 'Parmigiano Reggiano DOP 24 Mesi',
    periodStart = '2024-10-01',
    periodEnd = '2024-10-31',
    generateCriticalScenario = false,
    generateOptimalScenario = false,
  } = options;

  // Base values
  const totalRevenue = generateOptimalScenario ? 150000 : generateCriticalScenario ? 95000 : 125000;
  const totalCosts = Math.round(totalRevenue * 0.6);
  const netProfit = totalRevenue - totalCosts;
  const marginPercent = (netProfit / totalRevenue) * 100;
  const quantitySold = generateOptimalScenario ? 1000 : generateCriticalScenario ? 650 : 850;
  const currentStock = generateOptimalScenario ? 180 : generateCriticalScenario ? 35 : 120;

  // Trends
  const revenueChange = generateOptimalScenario ? 18.5 : generateCriticalScenario ? 8.2 : 12.5;
  const profitChange = generateOptimalScenario ? 22.3 : generateCriticalScenario ? -2.5 : 15.3;
  const marginChange = generateOptimalScenario ? 3.5 : generateCriticalScenario ? -1.8 : 2.1;

  // Sales vs Purchases data points
  const salesVsPurchases = [
    { date: '01/10', sales: totalRevenue * 0.15, purchases: totalCosts * 0.18 },
    { date: '08/10', sales: totalRevenue * 0.20, purchases: totalCosts * 0.22 },
    { date: '15/10', sales: totalRevenue * 0.18, purchases: totalCosts * 0.15 },
    { date: '22/10', sales: totalRevenue * 0.25, purchases: totalCosts * 0.20 },
    { date: '29/10', sales: totalRevenue * 0.22, purchases: totalCosts * 0.25 },
  ];

  // Top customers
  const customerNames = [
    'Ristorante Da Vinci',
    'Hotel Bellevue',
    'Gastronomia Italiana',
    'Trattoria del Sole',
    'Bistro Milano',
    'Pizzeria Napoli',
    'Caffè Roma',
    'Osteria Antica',
    'Ristorante Venezia',
    'Bar Centrale',
  ];

  const topCustomers = customerNames.map((name, index) => {
    const quantity = Math.round(quantitySold * (0.18 - index * 0.02));
    const revenue = quantity * (totalRevenue / quantitySold);
    return {
      id: `C${index + 1}`,
      name,
      quantity,
      revenue: Math.round(revenue),
    };
  });

  // Customer distribution (pie chart)
  const customerDistribution = [
    {
      customer: topCustomers[0].name,
      value: topCustomers[0].revenue,
      percentage: Math.round((topCustomers[0].revenue / totalRevenue) * 100 * 10) / 10,
    },
    {
      customer: topCustomers[1].name,
      value: topCustomers[1].revenue,
      percentage: Math.round((topCustomers[1].revenue / totalRevenue) * 100 * 10) / 10,
    },
    {
      customer: topCustomers[2].name,
      value: topCustomers[2].revenue,
      percentage: Math.round((topCustomers[2].revenue / totalRevenue) * 100 * 10) / 10,
    },
    {
      customer: `Altri (${topCustomers.length - 3} clienti)`,
      value: topCustomers.slice(3).reduce((sum, c) => sum + c.revenue, 0),
      percentage:
        Math.round(
          (topCustomers.slice(3).reduce((sum, c) => sum + c.revenue, 0) / totalRevenue) * 100 * 10
        ) / 10,
    },
  ];

  // Suppliers
  const suppliers = [
    {
      id: 'S1',
      name: 'Caseificio Rossi SRL',
      price: 88.5,
      leadTime: 7,
      isPreferred: true,
    },
    {
      id: 'S2',
      name: 'Latteria Verdi & Co',
      price: 92.0,
      leadTime: 10,
      isPreferred: false,
    },
    {
      id: 'S3',
      name: 'Dairy Import AG',
      price: 85.0,
      leadTime: 14,
      isPreferred: false,
    },
  ];

  // Inventory
  const reorderPoint = generateCriticalScenario ? 120 : 100;
  const safetyStock = generateCriticalScenario ? 100 : 80;
  const incoming = generateCriticalScenario ? 0 : generateOptimalScenario ? 80 : 50;
  const outgoing = generateCriticalScenario ? 45 : generateOptimalScenario ? 25 : 30;

  const locations = generateCriticalScenario
    ? [
        { location: 'A-01-005 (Magazzino Principale)', quantity: Math.round(currentStock * 0.7) },
        { location: 'B-03-012 (Cella Frigo)', quantity: Math.round(currentStock * 0.3) },
      ]
    : [
        { location: 'A-01-001 (Magazzino Principale)', quantity: Math.round(currentStock * 0.65) },
        { location: 'B-02-015 (Cella Frigo)', quantity: Math.round(currentStock * 0.3) },
        { location: 'C-01-008 (In Transito)', quantity: Math.round(currentStock * 0.05) },
      ];

  // Recommendations
  let recommendations;
  if (generateCriticalScenario) {
    recommendations = {
      reorderNeeded: true,
      action: `ORDINE URGENTE RICHIESTO: Scorta critica sotto il punto di riordino. Ordinare almeno ${
        reorderPoint * 2
      } unità immediatamente.`,
      reason: `Stock attuale (${currentStock}) è ben al di sotto del punto di riordino (${reorderPoint}) con ${outgoing} unità in uscita e ${incoming} unità in arrivo. Rischio rottura di stock entro 3-5 giorni.`,
      priority: 'critical' as const,
    };
  } else if (generateOptimalScenario) {
    recommendations = {
      reorderNeeded: false,
      action:
        'Situazione ottimale. Stock ben bilanciato con margini eccellenti. Continuare con il piano attuale.',
      reason: `La giacenza è ben sopra il punto di riordino (${currentStock} vs ${reorderPoint}) con ordini in arrivo programmati. Margine del ${marginPercent.toFixed(
        1
      )}% supera il target aziendale.`,
      priority: 'low' as const,
    };
  } else {
    recommendations = {
      reorderNeeded: false,
      action:
        'Mantieni i livelli attuali di stock. Il prodotto sta performando bene con margini sopra target.',
      reason: `La giacenza è sopra il punto di riordino (${currentStock} vs ${reorderPoint}) e la domanda è stabile con trend positivo del ${revenueChange.toFixed(
        1
      )}%.`,
      priority: 'low' as const,
    };
  }

  // Build complete ProductData object
  return {
    product: {
      id: productId,
      name: productName,
      code: productId.replace('PROD', 'PAR') + '-1KG',
      category: 'Formaggi',
    },
    period: {
      start: periodStart,
      end: periodEnd,
      label: formatPeriodLabel(periodStart, periodEnd),
    },
    kpis: {
      totalRevenue,
      totalCosts,
      netProfit,
      marginPercent: Math.round(marginPercent * 10) / 10,
      quantitySold,
      currentStock,
    },
    trends: {
      revenueChange: Math.round(revenueChange * 10) / 10,
      profitChange: Math.round(profitChange * 10) / 10,
      marginChange: Math.round(marginChange * 10) / 10,
    },
    salesVsPurchases: salesVsPurchases.map((dp) => ({
      ...dp,
      sales: Math.round(dp.sales),
      purchases: Math.round(dp.purchases),
    })),
    topCustomers,
    customerDistribution,
    suppliers,
    inventory: {
      currentStock,
      locations,
      incoming,
      outgoing,
      reorderPoint,
      safetyStock,
    },
    recommendations,
  };
}

/**
 * Formats period dates into a human-readable label
 */
function formatPeriodLabel(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const monthNames = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ];

  // If same month and year, return "Mese Anno"
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
  }

  // Otherwise return "Mese1 - Mese2 Anno"
  return `${monthNames[startDate.getMonth()]} - ${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
}

/**
 * Generates a list of products for testing
 */
export function generateMockProductList() {
  return [
    {
      id: 'PROD-001',
      name: 'Parmigiano Reggiano DOP 24 Mesi',
      code: 'PAR-24M-1KG',
      category: 'Formaggi',
    },
    {
      id: 'PROD-002',
      name: 'Prosciutto di Parma DOP 24 Mesi',
      code: 'PRO-24M-1KG',
      category: 'Salumi',
    },
    {
      id: 'PROD-003',
      name: 'Gorgonzola Piccante DOP',
      code: 'GOR-PIC-1KG',
      category: 'Formaggi',
    },
    {
      id: 'PROD-004',
      name: 'Aceto Balsamico Tradizionale',
      code: 'ACE-BAL-250ML',
      category: 'Condimenti',
    },
    {
      id: 'PROD-005',
      name: 'Pasta Italiana Artigianale',
      code: 'PAS-ART-500G',
      category: 'Pasta',
    },
  ];
}

/**
 * Generates mock data for multiple products
 */
export function generateMultipleProductsData(count: number = 5): ProductData[] {
  const products = generateMockProductList().slice(0, count);

  return products.map((product, index) => {
    const isOptimal = index % 3 === 0;
    const isCritical = index % 5 === 0;

    return generateMockProductData({
      productId: product.id,
      productName: product.name,
      generateOptimalScenario: isOptimal && !isCritical,
      generateCriticalScenario: isCritical,
    });
  });
}

/**
 * Mock API response generator
 */
export function generateMockAPIResponse(
  options: MockDataOptions & { success?: boolean; delay?: number } = {}
): Promise<any> {
  const { success = true, delay = 1000, ...dataOptions } = options;

  return new Promise((resolve) => {
    setTimeout(() => {
      if (success) {
        resolve({
          success: true,
          data: generateMockProductData(dataOptions),
          timestamp: new Date().toISOString(),
        });
      } else {
        resolve({
          success: false,
          error: 'Failed to fetch product analysis data',
          timestamp: new Date().toISOString(),
        });
      }
    }, delay);
  });
}

// Pre-configured scenarios
export const MOCK_SCENARIOS = {
  optimal: () =>
    generateMockProductData({
      generateOptimalScenario: true,
      productName: 'Parmigiano Reggiano DOP 24 Mesi',
    }),
  critical: () =>
    generateMockProductData({
      generateCriticalScenario: true,
      productName: 'Prosciutto di Parma DOP 24 Mesi',
    }),
  normal: () =>
    generateMockProductData({
      productName: 'Gorgonzola Piccante DOP',
    }),
};

// Export default
export default {
  generateMockProductData,
  generateMockProductList,
  generateMultipleProductsData,
  generateMockAPIResponse,
  MOCK_SCENARIOS,
};
