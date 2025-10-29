/**
 * MOCK DATA for Super Dashboard
 * Used for development, testing, and fallback
 *
 * To switch between mock and real data:
 * - Set NEXT_PUBLIC_USE_MOCK_DATA=true in .env for mock
 * - Set NEXT_PUBLIC_USE_MOCK_DATA=false in .env for real Odoo data
 */

export const mockKPIData = {
  revenue: {
    value: 2500000,
    change: 12,
    changeType: 'up' as const,
    subtitle: 'vs mese scorso',
  },
  orders: {
    value: 1245,
    change: 8,
    changeType: 'up' as const,
    subtitle: '142 ordini/giorno',
  },
  customers: {
    value: 458,
    change: 5,
    changeType: 'up' as const,
    subtitle: '5 nuovi clienti',
  },
  healthScore: {
    value: 78,
    change: -3,
    changeType: 'down' as const,
    subtitle: 'Media clienti',
  },
  stockValue: {
    value: 850000,
    change: -8,
    changeType: 'down' as const,
    subtitle: '3,245 prodotti',
  },
  deliveries: {
    value: 42,
    change: 2,
    changeType: 'up' as const,
    subtitle: '38 completate',
  },
};

export const mockHighRiskCustomers = [
  {
    id: 1,
    name: 'Ristorante Da Mario',
    healthScore: 35,
    churnRisk: 85,
    revenueYTD: 45000,
    daysSinceOrder: 45,
    city: 'Zurigo',
  },
  {
    id: 2,
    name: 'Pizzeria Bella Napoli',
    healthScore: 42,
    churnRisk: 72,
    revenueYTD: 32000,
    daysSinceOrder: 38,
    city: 'Basilea',
  },
  {
    id: 3,
    name: 'Hotel Splendide',
    healthScore: 48,
    churnRisk: 68,
    revenueYTD: 28000,
    daysSinceOrder: 31,
    city: 'Lucerna',
  },
];

export const mockUpsellOpportunities = [
  {
    id: 1,
    name: 'Trattoria del Sole',
    upsellScore: 92,
    suggestedProducts: 'Formaggi Premium',
    potentialValue: 8000,
  },
  {
    id: 2,
    name: 'Ristorante La Piazza',
    upsellScore: 88,
    suggestedProducts: 'Pesce Fresco',
    potentialValue: 6000,
  },
];

export const mockHeatmapData: Array<{
  health: number;
  value: number;
  name: string;
  status: 'critical' | 'warning' | 'ok' | 'excellent';
}> = [
  { health: 25, value: 5000, name: 'Cliente A', status: 'critical' },
  { health: 30, value: 8000, name: 'Cliente B', status: 'critical' },
  { health: 35, value: 12000, name: 'Cliente C', status: 'warning' },
  { health: 40, value: 35000, name: 'Da Mario', status: 'warning' },
  { health: 42, value: 32000, name: 'Bella Napoli', status: 'warning' },
  { health: 48, value: 28000, name: 'Splendide', status: 'warning' },
  { health: 65, value: 8000, name: 'Cliente G', status: 'ok' },
  { health: 70, value: 12000, name: 'Cliente H', status: 'ok' },
  { health: 75, value: 15000, name: 'Cliente I', status: 'ok' },
  { health: 85, value: 65000, name: 'Champion A', status: 'excellent' },
  { health: 88, value: 58000, name: 'Champion B', status: 'excellent' },
  { health: 92, value: 72000, name: 'Champion C', status: 'excellent' },
  { health: 90, value: 55000, name: 'Champion D', status: 'excellent' },
];

export const mockArriviMerce = [
  { ora: '08:30', fornitore: 'Supplier Italy A', prodotti: 45, status: 'done' as const, statusText: '✅ Completato' },
  { ora: '10:00', fornitore: 'Supplier Italy B', prodotti: 32, status: 'progress' as const, statusText: '🔄 In corso' },
  { ora: '14:00', fornitore: 'Supplier Swiss C', prodotti: 18, status: 'waiting' as const, statusText: '⏳ Attesa' },
];

export const mockStockCritico = [
  { prodotto: 'Prosciutto Crudo 24M', stock: 15, min: 50, giorni: 3, severity: 'critical' as const },
  { prodotto: 'Mozzarella di Bufala DOP', stock: 28, min: 80, giorni: 5, severity: 'high' as const },
  { prodotto: 'Grana Padano 24M', stock: 42, min: 100, giorni: 7, severity: 'medium' as const },
];

export const mockScadenzeImminenti = [
  { prodotto: 'Bresaola IGP', lotto: 'L2024-A45', scadenza: '12 giorni', qty: '8 kg', zone: 'Frigo' },
  { prodotto: 'Burrata Pugliese', lotto: 'L2025-B12', scadenza: '18 giorni', qty: '15 pz', zone: 'Frigo' },
  { prodotto: 'Taleggio DOP', lotto: 'L2024-C89', scadenza: '22 giorni', qty: '12 kg', zone: 'Frigo' },
];

export const mockWarehouseCapacity = {
  total: 72,
  secco: 68,
  frigo: 78,
  pingu: 70,
};

export const mockAutisti = [
  { nome: 'Marco', stops: 5, totale: 12, eta: '15:30', status: 'delivery' as const, lat: 47.3769, lng: 8.5417 },
  { nome: 'Luca', stops: 3, totale: 8, eta: '14:45', status: 'transit' as const, lat: 47.5596, lng: 7.5886 },
  { nome: 'Paolo', stops: 0, totale: 15, eta: '13:00', status: 'starting' as const, lat: 47.0502, lng: 8.3093 },
];

export const mockKPIGiornata = [
  { label: 'On-Time', value: '94%', color: 'text-green-400' },
  { label: 'Completate', value: '38', color: 'text-blue-400' },
  { label: 'In Corso', value: '8', color: 'text-orange-400' },
  { label: 'Issues', value: '2', color: 'text-red-400' },
];

export const mockProblemiDelivery = [
  { autista: 'Marco', problema: 'Prodotto mancante (Qty -5)', cliente: 'Rist. Da Mario', severity: 'high' as const },
  { autista: 'Luca', problema: 'Ritardo traffico (+20min)', cliente: 'Hotel Splendide', severity: 'medium' as const },
];

export const mockPLData = {
  revenue: 2500000,
  cogs: 1500000,
  grossProfit: 1000000,
  opex: 600000,
  ebitda: 400000,
  netIncome: 280000,
};

export const mockBreakEven = {
  units: 1850,
  revenue: 1850000,
  currentUnits: 2400,
  currentRevenue: 2500000,
  marginSafety: 650000,
  marginSafetyPercent: 26,
};

export const mockBreakEvenChartData = [
  { units: 0, revenue: 0, costs: 600000 },
  { units: 500, revenue: 500000, costs: 750000 },
  { units: 1000, revenue: 1000000, costs: 900000 },
  { units: 1500, revenue: 1500000, costs: 1050000 },
  { units: 1850, revenue: 1850000, costs: 1850000 },
  { units: 2000, revenue: 2000000, costs: 1950000 },
  { units: 2400, revenue: 2500000, costs: 2160000 },
  { units: 3000, revenue: 3100000, costs: 2400000 },
];

export const mockARAging = [
  { period: '0-30 days', amount: 450000, count: 125, percent: 65, severity: 'ok' as const },
  { period: '31-60 days', amount: 180000, count: 42, percent: 26, severity: 'warning' as const },
  { period: '61-90 days', amount: 45000, count: 12, percent: 6, severity: 'high' as const },
  { period: '90+ OVERDUE', amount: 20000, count: 8, percent: 3, severity: 'critical' as const },
];

export const mockLeaderboard = [
  { rank: 1, name: 'Marco R.', revenue: 450000, orders: 145, quota: 112, emoji: '🥇' },
  { rank: 2, name: 'Laura B.', revenue: 420000, orders: 138, quota: 105, emoji: '🥈' },
  { rank: 3, name: 'Paolo G.', revenue: 385000, orders: 125, quota: 96, emoji: '🥉' },
  { rank: 4, name: 'Anna M.', revenue: 340000, orders: 112, quota: 85, emoji: '4' },
  { rank: 5, name: 'Luca T.', revenue: 310000, orders: 105, quota: 78, emoji: '5' },
];

export const mockActivityHeatmap = [
  { name: 'Marco', days: ['🟩', '🟩', '🟩', '🟩', '🟩', '⬜', '⬜', '🟩', '🟩', '🟩', '🟩', '🟩', '⬜', '⬜'] },
  { name: 'Laura', days: ['🟩', '🟩', '🟨', '🟩', '🟩', '⬜', '⬜', '🟩', '🟩', '🟩', '🟩', '🟨', '⬜', '⬜'] },
  { name: 'Paolo', days: ['🟩', '🟨', '🟨', '🟩', '🟩', '⬜', '⬜', '🟨', '🟩', '🟩', '🟨', '🟩', '⬜', '⬜'] },
  { name: 'Anna', days: ['🟨', '🟨', '🟩', '🟨', '🟩', '⬜', '⬜', '🟩', '🟨', '🟨', '🟩', '🟩', '⬜', '⬜'] },
  { name: 'Luca', days: ['🟨', '🟧', '🟨', '🟨', '🟩', '⬜', '⬜', '🟨', '🟨', '🟩', '🟨', '🟨', '⬜', '⬜'] },
];

export const mockTeamKPIs = [
  { name: 'Marco', convRate: 42, avgDeal: 3100, visits: 18, samples: 45, health: 72 },
  { name: 'Laura', convRate: 38, avgDeal: 3000, visits: 16, samples: 38, health: 68 },
  { name: 'Paolo', convRate: 35, avgDeal: 3100, visits: 14, samples: 32, health: 65 },
  { name: 'Anna', convRate: 32, avgDeal: 3000, visits: 12, samples: 28, health: 62 },
  { name: 'Luca', convRate: 28, avgDeal: 3000, visits: 10, samples: 22, health: 58 },
];

export const mockTopProducts = [
  { rank: 1, name: 'Prosciutto Crudo 24M', revenue: 85000, units: '450 kg', margin: 42, trend: 15 },
  { rank: 2, name: 'Mozzarella Bufala DOP', revenue: 72000, units: '850 pz', margin: 38, trend: 12 },
  { rank: 3, name: 'Grana Padano 24M', revenue: 68000, units: '380 kg', margin: 40, trend: 8 },
  { rank: 4, name: 'Pasta Trafilata Bronzo', revenue: 54000, units: '1200 kg', margin: 35, trend: 5 },
  { rank: 5, name: 'Olio EVO Toscano', revenue: 48000, units: '320 lt', margin: 45, trend: 10 },
];

export const mockSlowMovers = [
  { name: 'Salame Tipo X', stock: 2500, lastSale: '180 gg', days: 210, severity: 'critical' as const },
  { name: 'Formaggio Rare Y', stock: 1800, lastSale: '165 gg', days: 195, severity: 'critical' as const },
  { name: 'Vino Premium Z', stock: 1200, lastSale: '142 gg', days: 172, severity: 'high' as const },
];

export const mockABCData = [
  { category: 'A (20%)', products: 65, revenue: 80, color: '#10b981' },
  { category: 'B (30%)', products: 30, revenue: 15, color: '#3b82f6' },
  { category: 'C (50%)', products: 5, revenue: 5, color: '#64748b' },
];

export const mockCriticalAlerts = [
  { priority: 'urgent' as const, icon: '🔴', alert: '3 clienti churn risk >85%', affected: 'CHF 95K revenue', action: 'ACT NOW' },
  { priority: 'urgent' as const, icon: '🔴', alert: 'Stock critico: 5 prodotti <3 giorni', affected: 'Revenue impact', action: 'ORDER' },
  { priority: 'high' as const, icon: '🟠', alert: '2 consegne in ritardo >30min', affected: '2 clienti', action: 'NOTIFY' },
  { priority: 'medium' as const, icon: '🟡', alert: 'Fatture scadute >90gg: CHF 20K', affected: '8 clienti', action: 'CALL' },
];

export const mockRecommendations = [
  { type: 'Upsell' as const, description: 'Proponi formaggi premium', customer: 'Rist. Da Mario', confidence: 92 },
  { type: 'Churn' as const, description: 'Offri sconto 10% + campioni', customer: 'Hotel Splendide', confidence: 88 },
  { type: 'Cross' as const, description: 'Suggerisci pasta + olio combo', customer: 'Pizz. Bella Napoli', confidence: 85 },
];

export const mockPriorities = [
  'Call 3 high-risk customers before 12:00',
  'Review and approve 2 pending recommendations',
  'Order 5 critical stock items (auto-draft ready)',
  'Resolve 2 delivery issues from morning shift',
  'Check cashflow: 8 invoices overdue >90 days',
];

export const mockAIActivity = [
  { time: '10:45 AM', agent: 'Customer Intel', action: 'Analyzed', result: '3 churn alerts', impact: 'Prevented CHF 95K loss' },
  { time: '10:30 AM', agent: 'Product Intel', action: 'Detected', result: '5 upsell opps', impact: 'CHF 25K potential' },
  { time: '09:15 AM', agent: 'Sales Analyst', action: 'Forecast', result: 'Updated', impact: '+12% vs last month' },
  { time: '08:00 AM', agent: 'Maestro Sync', action: 'Sync', result: 'Complete', impact: '458 customers synced' },
];

export const mockAIModels = [
  { name: 'Churn Prediction', accuracy: 89, confidence: 'High' as const, predictions: 245, status: 'active' as const },
  { name: 'Upsell Scoring', accuracy: 85, confidence: 'High' as const, predictions: 178, status: 'active' as const },
  { name: 'Demand Forecast', accuracy: 82, confidence: 'Medium' as const, predictions: 450, status: 'active' as const },
  { name: 'Price Optimizer', accuracy: 78, confidence: 'Medium' as const, predictions: 85, status: 'training' as const },
];

export const mockSystemStatus = [
  { service: 'Odoo Sync', status: 'connected' as const, lastUpdate: '2 min ago' },
  { service: 'Database', status: 'healthy' as const, lastUpdate: 'Real-time' },
  { service: 'AI Agents', status: 'running' as const, lastUpdate: 'Active' },
  { service: 'GPS Tracking', status: 'live' as const, lastUpdate: '10 sec ago' },
];
