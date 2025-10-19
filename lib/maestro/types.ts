/**
 * MAESTRO AI - TypeScript Types & Interfaces
 *
 * STRICT TYPE SYSTEM - NO 'any' ALLOWED
 * Comprehensive type definitions for Odoo integration and Customer Avatar management
 */

// ============================================================================
// ODOO BASE TYPES
// ============================================================================

/**
 * Odoo Many2one field: [id, display_name] or false
 */
export type OdooMany2one = [number, string] | false;

/**
 * Odoo One2many/Many2many field: array of IDs
 */
export type OdooMany2many = number[];

/**
 * Odoo domain operators
 */
export type OdooDomainOperator =
  | '=' | '!='
  | '>' | '>=' | '<' | '<='
  | 'like' | 'ilike' | '=like' | '=ilike'
  | 'in' | 'not in'
  | 'child_of' | 'parent_of';

/**
 * Odoo domain clause: [field, operator, value]
 */
export type OdooDomainClause = [string, OdooDomainOperator, unknown];
export type OdooDomainLogic = '&' | '|' | '!';
export type OdooDomain = Array<OdooDomainClause | OdooDomainLogic>;

/**
 * Odoo order states
 */
export type OdooOrderState = 'draft' | 'sent' | 'sale' | 'done' | 'cancel';

/**
 * Odoo partner types
 */
export type OdooPartnerType = 'contact' | 'invoice' | 'delivery' | 'other';

// ============================================================================
// ODOO MODELS
// ============================================================================

/**
 * res.partner (Customer/Contact) from Odoo
 */
export interface OdooPartner {
  id: number;
  name: string;
  parent_id: OdooMany2one;
  is_company: boolean;
  type: OdooPartnerType;
  child_ids: OdooMany2many;
  user_id: OdooMany2one;

  // Contact info
  email: string | false;
  phone: string | false;
  mobile: string | false;

  // Address
  street: string | false;
  city: string | false;
  zip: string | false;
  country_id: OdooMany2one;

  // Customer/Supplier flags
  customer_rank: number;
  supplier_rank: number;
}

/**
 * sale.order from Odoo
 */
export interface OdooOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  state: OdooOrderState;
  order_line: OdooMany2many;
  user_id: OdooMany2one;
}

/**
 * sale.order.line from Odoo
 */
export interface OdooOrderLine {
  id: number;
  order_id: [number, string];
  product_id: [number, string];
  product_uom_qty: number;
  qty_delivered: number;
  price_unit: number;
  price_subtotal: number;
  price_total: number;
  discount: number;
  name: string;
}

/**
 * product.product from Odoo
 */
export interface OdooProduct {
  id: number;
  name: string;
  default_code: string | false;
  list_price: number;
  standard_price: number;
  categ_id: [number, string];
  qty_available: number;
}

/**
 * res.users (Salesperson) from Odoo
 */
export interface OdooUser {
  id: number;
  name: string;
  login: string;
  email: string;
  partner_id: [number, string];
  active: boolean;
}

// ============================================================================
// ODOO RPC CLIENT
// ============================================================================

/**
 * Odoo RPC Client interface
 */
export interface OdooRPCClient {
  searchRead<T = unknown>(
    model: string,
    domain: OdooDomain,
    fields: string[],
    limit?: number,
    offset?: number,
    order?: string
  ): Promise<T[]>;

  search(
    model: string,
    domain: OdooDomain,
    limit?: number,
    offset?: number,
    order?: string
  ): Promise<number[]>;

  searchCount(
    model: string,
    domain: OdooDomain
  ): Promise<number>;

  read<T = unknown>(
    model: string,
    ids: number[],
    fields: string[]
  ): Promise<T[]>;
}

// ============================================================================
// CUSTOMER AVATAR
// ============================================================================

export interface CustomerAvatar {
  id: string;
  odoo_partner_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;

  // Metriche transazionali
  first_order_date: Date | null;
  last_order_date: Date | null;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  order_frequency_days: number | null;
  days_since_last_order: number;

  // Prodotti e categorie
  top_products: ProductPurchasePattern[];
  product_categories: Record<string, CategoryStats>;

  // AI Scores (0-100)
  health_score: number;
  churn_risk_score: number;
  upsell_potential_score: number;
  engagement_score: number;

  // Assignment
  assigned_salesperson_id: number | null;
  assigned_salesperson_name: string | null;

  // Metadata
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_sync_odoo: Date | null;
}

export interface ProductPurchasePattern {
  product_id: number;
  product_name: string;
  times_purchased: number;
  total_quantity: number;
  total_revenue: number;
  last_purchase_date: Date;
  avg_days_between_purchases: number | null;
}

export interface CategoryStats {
  category_name: string;
  total_orders: number;
  total_revenue: number;
  percentage_of_total: number;
}

export interface Recommendation {
  id: string;
  customer_avatar_id: string;
  recommendation_type: 'churn_prevention' | 'upsell' | 'cross_sell' | 'reactivation' | 'routine_followup';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  title: string;
  description: string;
  suggested_actions: string[];
  suggested_products: number[] | null;

  reasoning: string; // AI-generated explanation
  expected_impact: string; // "Potential revenue: €X" or "Retention increase: Y%"

  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  outcome: string | null;
  outcome_notes: string | null;

  created_by: 'ai' | 'manual';
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;

  // Metadata
  ai_confidence: number; // 0-100
  estimated_effort_minutes: number;
}

export interface Interaction {
  id: string;
  customer_avatar_id: string;
  salesperson_id: number;
  salesperson_name: string;

  interaction_type: 'visit' | 'call' | 'email' | 'whatsapp' | 'other';
  interaction_date: Date;

  outcome: 'successful' | 'unsuccessful' | 'neutral' | 'follow_up_needed';
  notes: string | null;

  // Data specifici
  order_placed: boolean;
  order_value: number | null;
  samples_given: SampleGiven[] | null;
  next_follow_up_date: Date | null;

  // Link a raccomandazione se l'interazione è risultato di una
  recommendation_id: string | null;

  created_at: Date;
  updated_at: Date;
}

export interface SampleGiven {
  product_id: number;
  product_name: string;
  quantity: number;
}

export interface DailyPlan {
  date: Date;
  salesperson_id: number;
  salesperson_name: string;

  urgent_customers: CustomerWithRecommendations[];
  high_priority_customers: CustomerWithRecommendations[];
  upsell_opportunities: CustomerWithRecommendations[];
  routine_followups: CustomerWithRecommendations[];

  total_estimated_time_minutes: number;
  suggested_route: RouteStop[] | null;

  created_at: Date;
}

export interface CustomerWithRecommendations {
  avatar: CustomerAvatar;
  recommendations: Recommendation[];
  last_interaction: Interaction | null;
}

export interface RouteStop {
  order: number;
  customer_avatar_id: string;
  customer_name: string;
  city: string;
  estimated_time_minutes: number;
  recommended_actions: string[];
}

// API Request/Response types

export interface GetAvatarsQueryParams {
  salesperson_id?: number;
  health_score_min?: number;
  churn_risk_min?: number;
  limit?: number;
  offset?: number;
  sort_by?: 'health_score' | 'churn_risk_score' | 'total_revenue' | 'last_order_date';
  sort_order?: 'asc' | 'desc';
}

export interface GenerateRecommendationsRequest {
  salesperson_id: number;
  max_recommendations?: number;
  focus_on?: 'churn' | 'upsell' | 'all';
}

export interface GenerateRecommendationsResponse {
  recommendations: Recommendation[];
  summary: {
    total_generated: number;
    urgent_count: number;
    high_priority_count: number;
    estimated_total_time_minutes: number;
  };
}

export interface UpdateRecommendationRequest {
  status: 'in_progress' | 'completed' | 'dismissed';
  outcome?: 'success' | 'partial_success' | 'failed';
  outcome_notes?: string;
}

export interface CreateInteractionRequest {
  customer_avatar_id: string;
  interaction_type: 'visit' | 'call' | 'email' | 'whatsapp' | 'other';
  outcome: 'successful' | 'unsuccessful' | 'neutral' | 'follow_up_needed';
  notes?: string;
  order_placed?: boolean;
  order_value?: number;
  samples_given?: SampleGiven[];
  next_follow_up_date?: string; // ISO date string
  recommendation_id?: string;
}

export interface GetDailyPlanQueryParams {
  salesperson_id: number;
  date?: string; // ISO date string, defaults to today
}

// ============================================================================
// SYNC TYPES
// ============================================================================

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  synced: number;
  updated: number;
  created: number;
  errors: string[];
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
}

/**
 * Sync status
 */
export interface SyncStatus {
  totalAvatars: number;
  activeAvatars: number;
  lastSync: Date | null;
}

/**
 * Customer metrics for AI scoring
 */
export interface CustomerMetrics {
  daysSinceLastOrder: number;
  orderFrequencyDays: number | null;
  totalOrders: number;
  avgOrderValue: number;
  totalRevenue: number;
}

/**
 * AI scores calculation result
 */
export interface AIScoresResult {
  healthScore: number;
  churnRiskScore: number;
  upsellPotentialScore: number;
  engagementScore: number;
}

// ============================================================================
// ANALYSIS TYPES (for analyze-odoo API)
// ============================================================================

/**
 * Salesperson with customer count
 */
export interface SalespersonInfo {
  id: number;
  name: string;
  login: string;
  clienti_assegnati: number;
}

/**
 * Sales breakdown by salesperson
 */
export interface SalespersonSales {
  id: number | string;
  name: string;
  ordini: number;
  clienti: number;
  revenue: number;
}

/**
 * Odoo data analysis result
 */
export interface OdooAnalysis {
  success: true;
  timestamp: string;

  venditori: {
    target: string[];
    found: number;
    details: SalespersonInfo[];
  };

  clienti: {
    attivi_ultimi_4_mesi: number;
    per_venditore: SalespersonSales[];
  };

  ordini: {
    totali_4_mesi: number;
    ultimi_30_giorni: number;
    media_giornaliera: number;
  };

  revenue: {
    totale_4_mesi: number;
    media_per_ordine: number;
  };

  summary: {
    ready_for_sync: boolean;
    estimated_avatars: number;
    estimated_sync_time_minutes: number;
  };
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

/**
 * Analytics KPIs
 */
export interface AnalyticsKPIs {
  totalRevenue: number;
  totalOrders: number;
  activeCustomers: number;
  avgOrderValue: number;
}

/**
 * Salesperson performance metrics
 */
export interface SalespersonPerformance {
  name: string;
  revenue: number;
  orders: number;
  customerCount: number;
}

/**
 * Customer performance metrics
 */
export interface CustomerPerformance {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  healthScore: number;
}

/**
 * Churn alert for high-risk customer
 */
export interface ChurnAlert {
  id: string;
  name: string;
  city: string | null;
  churnRisk: number;
  healthScore: number;
  daysSinceLastOrder: number;
  avgOrderValue: number;
}

/**
 * Revenue data point by month
 */
export interface RevenueByMonth {
  month: string;
  revenue: number;
  orders: number;
}

/**
 * Customer health distribution
 */
export interface HealthDistribution {
  healthy: number;    // health_score >= 80
  warning: number;    // 50-79
  critical: number;   // < 50
}

/**
 * Complete analytics dashboard response
 */
export interface AnalyticsResponse {
  kpis: AnalyticsKPIs;
  topPerformers: {
    bySalesperson: SalespersonPerformance[];
    byCustomer: CustomerPerformance[];
  };
  churnAlerts: ChurnAlert[];
  revenueByMonth: RevenueByMonth[];
  healthDistribution: HealthDistribution;
}

// ============================================================================
// GENERIC API RESPONSE TYPES
// ============================================================================

/**
 * Generic success response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp?: string;
}

/**
 * Generic error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp?: string;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// MAESTRO AI CHAT TYPES
// ============================================================================

/**
 * Chat conversation
 */
export interface MaestroConversation {
  id: string;
  salesperson_id: number;
  salesperson_name: string;
  started_at: Date;
  last_message_at: Date;
  message_count: number;
  current_customer_id: number | null;
  current_page: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Chat message
 */
export interface MaestroChatMessage {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  tokens_used: number | null;
  finish_reason: string | null;
  tool_calls: any[] | null;
  tool_results: any[] | null;
  metadata: Record<string, any>;
  created_at: Date;
}

/**
 * Chat request body
 */
export interface MaestroChatRequest {
  message: string;
  conversationId?: string;
  salespersonId: number;
  context?: {
    customerId?: number;
    currentPage?: string;
  };
}

/**
 * Chat response
 */
export interface MaestroChatResponse {
  reply: string;
  conversationId: string;
  suggestions?: string[];
  data?: {
    customer?: CustomerAvatar;
    performance?: any;
  };
  tokensUsed?: number;
  toolCalls?: any[];
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}
