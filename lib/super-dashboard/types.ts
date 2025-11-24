/**
 * TypeScript types for Super Dashboard
 * Defines all data structures used across the dashboard
 */

export type ChangeType = 'up' | 'down';

export interface KPIValue {
  value: number;
  change: number;
  changeType: ChangeType;
  subtitle: string;
}

export interface KPIData {
  revenue: KPIValue;
  orders: KPIValue;
  customers: KPIValue;
  healthScore: KPIValue;
  stockValue: KPIValue;
  deliveries: KPIValue;
  margins: KPIValue;
}

export interface HighRiskCustomer {
  id: number;
  name: string;
  healthScore: number;
  churnRisk: number;
  revenueYTD: number;
  daysSinceOrder: number;
  city: string;
}

export interface UpsellOpportunity {
  id: number;
  name: string;
  upsellScore: number;
  suggestedProducts: string;
  potentialValue: number;
}

export interface HeatmapDataPoint {
  health: number;
  value: number;
  name: string;
  status: 'critical' | 'warning' | 'ok' | 'excellent';
}

export interface ArrivoMerce {
  ora: string;
  fornitore: string;
  prodotti: number;
  status: 'done' | 'progress' | 'waiting';
  statusText: string;
}

export interface StockCritico {
  prodotto: string;
  stock: number;
  min: number;
  giorni: number;
  severity: 'critical' | 'high' | 'medium';
}

export interface ScadenzaImminente {
  prodotto: string;
  lotto: string;
  scadenza: string;
  qty: string;
  zone: string;
}

export interface WarehouseCapacity {
  total: number;
  secco: number;
  frigo: number;
  pingu: number;
}

export interface Autista {
  nome: string;
  stops: number;
  totale: number;
  eta: string;
  status: 'delivery' | 'transit' | 'starting';
  lat: number;
  lng: number;
}

export interface KPIGiornata {
  label: string;
  value: string;
  color: string;
}

export interface ProblemaDelivery {
  autista: string;
  problema: string;
  cliente: string;
  severity: 'high' | 'medium' | 'low';
}

export interface PLData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  netIncome: number;
}

export interface BreakEven {
  units: number;
  revenue: number;
  currentUnits: number;
  currentRevenue: number;
  marginSafety: number;
  marginSafetyPercent: number;
}

export interface BreakEvenChartDataPoint {
  units: number;
  revenue: number;
  costs: number;
}

export interface ARAging {
  period: string;
  amount: number;
  count: number;
  percent: number;
  severity: 'ok' | 'warning' | 'high' | 'critical';
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  revenue: number;
  orders: number;
  quota: number;
  emoji: string;
}

export interface ActivityHeatmapEntry {
  name: string;
  days: string[];
}

export interface TeamKPI {
  name: string;
  convRate: number;
  avgDeal: number;
  visits: number;
  samples: number;
  health: number;
}

export interface TopProduct {
  rank: number;
  name: string;
  revenue: number;
  units: string;
  margin: number;
  trend: number;
}

export interface SlowMover {
  name: string;
  stock: number;
  lastSale: string;
  days: number;
  severity: 'critical' | 'high';
}

export interface ABCDataPoint {
  category: string;
  products: number;
  revenue: number;
  color: string;
}

export interface CriticalAlert {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  icon: string;
  alert: string;
  affected: string;
  action: string;
}

export interface Recommendation {
  type: 'Upsell' | 'Churn' | 'Cross';
  description: string;
  customer: string;
  confidence: number;
}

export interface AIActivity {
  time: string;
  agent: string;
  action: string;
  result: string;
  impact: string;
}

export interface AIModel {
  name: string;
  accuracy: number;
  confidence: 'High' | 'Medium' | 'Low';
  predictions: number;
  status: 'active' | 'training';
}

export interface SystemStatus {
  service: string;
  status: 'connected' | 'healthy' | 'running' | 'live';
  lastUpdate: string;
}

// Sales Timeline types
export interface SalesTimelineData {
  summary: {
    totalOrders: number;
    totalValue: number;
    avgOrderValue: number;
  };
  byPeriod: SalesPeriodGroup[];
  byTeam: SalesTeamGroup[];
  timeline: TimelineDataPoint[];
}

export interface SalesPeriodGroup {
  period: string;
  orderCount: number;
  totalValue: number;
  orders: SalesOrder[];
}

export interface SalesTeamGroup {
  teamName: string;
  salesperson: string;
  orderCount: number;
  totalValue: number;
  avgOrderValue: number;
}

export interface SalesOrder {
  id: number;
  name: string;
  date_order: string;
  commitment_date: string;
  amount_total: number;
  user_id: [number, string]; // Odoo many2one format [id, name]
  team_id?: [number, string];
  state: string;
}

export interface TimelineDataPoint {
  date: string;
  orderCount: number;
  value: number;
}

export type GroupByOption = 'day' | 'week' | 'month' | 'team';
export type PeriodOption = 'today' | 'week' | 'month' | 'quarter' | 'year';

// Sales Radar Activity types
export interface SalesRadarActivity {
  id: string;
  type: 'lead_created' | 'voice_note' | 'written_note' | 'stage_change' |
        'lead_archived' | 'lead_reactivated' | 'tag_added' | 'tag_removed' |
        'note_added' | 'field_updated';
  timestamp: string;
  userId: number;
  userName: string;
  targetName: string;
  targetType: 'lead' | 'partner';
  targetId: number;
  location?: {
    lat: number;
    lng: number;
  };
  preview?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

export interface SalesRadarVendorStats {
  userId: number;
  userName: string;
  leadsCreated: number;
  voiceNotes: number;
  writtenNotes: number;
  stageChanges: number;
  leadsArchived: number;
  leadsReactivated: number;
  tagsAdded: number;
  notesAdded: number;
  totalInteractions: number;
}

export interface SalesRadarActivitySummary {
  totalInteractions: number;
  leadsCreated: number;
  voiceNotes: number;
  writtenNotes: number;
  stageChanges: number;
  leadsArchived: number;
  leadsReactivated: number;
  tagsAdded: number;
  notesAdded: number;
  activeVendors: number;
  period: string;
  startDate: string;
}

export interface SalesRadarActivityData {
  summary: SalesRadarActivitySummary;
  activities: SalesRadarActivity[];
  vendorStats: SalesRadarVendorStats[];
}

// Aggregated dashboard data interface
export interface DashboardData {
  kpi: KPIData;
  highRiskCustomers: HighRiskCustomer[];
  upsellOpportunities: UpsellOpportunity[];
  heatmapData: HeatmapDataPoint[];
  arriviMerce: ArrivoMerce[];
  stockCritico: StockCritico[];
  scadenzeImminenti: ScadenzaImminente[];
  warehouseCapacity: WarehouseCapacity;
  autisti: Autista[];
  kpiGiornata: KPIGiornata[];
  problemiDelivery: ProblemaDelivery[];
  plData: PLData;
  breakEven: BreakEven;
  breakEvenChartData: BreakEvenChartDataPoint[];
  arAging: ARAging[];
  leaderboard: LeaderboardEntry[];
  activityHeatmap: ActivityHeatmapEntry[];
  teamKPIs: TeamKPI[];
  topProducts: TopProduct[];
  slowMovers: SlowMover[];
  abcData: ABCDataPoint[];
  criticalAlerts: CriticalAlert[];
  recommendations: Recommendation[];
  priorities: string[];
  aiActivity: AIActivity[];
  aiModels: AIModel[];
  systemStatus: SystemStatus[];
}
