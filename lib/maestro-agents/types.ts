/**
 * MAESTRO AGENT NETWORK - Type Definitions
 * Complete type system for multi-agent architecture
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentRole =
  | 'orchestrator'
  | 'customer_intelligence'
  | 'product_intelligence'
  | 'sales_analyst'
  | 'maestro_intelligence'
  | 'action_executor'
  | 'external_research';

export type AgentStatus = 'idle' | 'busy' | 'error';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  handler: (input: any) => Promise<any>;
}

// ============================================================================
// AGENT INTERFACE
// ============================================================================

export interface Agent {
  role: AgentRole;
  name: string;
  description: string;
  capabilities: string[];
  tools: AgentTool[];
  status: AgentStatus;

  // Methods
  execute(task: AgentTask): Promise<AgentResult>;
  getSystemPrompt(): string;
}

// ============================================================================
// TASK & RESULT
// ============================================================================

export interface AgentTask {
  id: string;
  user_query: string;
  salesperson_id: number;
  context?: {
    customer_id?: number;
    product_id?: number;
    conversation_id?: string;
    current_page?: string;
    [key: string]: any;
  };
  created_at: Date;
}

export interface AgentResult {
  success: boolean;
  agent_role: AgentRole;
  data?: any;
  error?: string;
  tool_calls?: ToolCall[];
  tokens_used?: number;
  duration_ms?: number;
}

export interface ToolCall {
  tool_name: string;
  input: any;
  output: any;
  success: boolean;
  error?: string;
  duration_ms: number;
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

export interface OrchestratorDecision {
  agents_to_call: AgentRole[];
  execution_mode: 'parallel' | 'sequential';
  reasoning: string;
  estimated_duration_ms: number;
}

export interface OrchestratorResult {
  success: boolean;
  final_response: string;
  agents_called: AgentRole[];
  agent_results: AgentResult[];
  total_tokens_used: number;
  total_duration_ms: number;
  decision: OrchestratorDecision;
}

// ============================================================================
// DATABASE QUERY RESULTS
// ============================================================================

export interface CustomerProfile {
  id: number;
  odoo_partner_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;

  // Behavioral data
  first_order_date: Date | null;
  last_order_date: Date | null;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  order_frequency_days: number | null;
  days_since_last_order: number;

  // Products
  top_products: Array<{
    product_id: number;
    product_name: string;
    times_purchased: number;
    total_revenue: number;
  }>;
  product_categories: Record<string, number>;

  // AI Scores
  health_score: number;
  churn_risk_score: number;
  upsell_potential_score: number;
  engagement_score: number;
  loyalty_score: number;

  // Preferences
  personality_type: string | null;
  preferred_contact_method: string | null;
  best_contact_time: string | null;
  communication_style: string | null;

  // Salesperson
  assigned_salesperson_id: number | null;
  assigned_salesperson_name: string | null;

  // Metadata
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface SalesInteraction {
  id: number;
  customer_avatar_id: number;
  odoo_partner_id: number;
  salesperson_id: number;
  salesperson_name: string;
  interaction_type: 'visit' | 'call' | 'email' | 'sample' | 'other';
  interaction_date: Date;
  outcome: string | null;
  duration_minutes: number | null;
  notes: string | null;
  samples_given: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
  }> | null;
  sample_feedback: string | null;
  order_generated: boolean;
  order_id: number | null;
  order_amount: number | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  key_topics: string[] | null;
  requires_followup: boolean;
  followup_date: Date | null;
  followup_reason: string | null;
  created_at: Date;
}

export interface ProductIntelligence {
  id: number;
  odoo_product_id: number;
  product_name: string;
  product_category: string | null;
  product_code: string | null;

  // Sales metrics
  total_quantity_sold: number;
  total_revenue: number;
  avg_price: number | null;
  units_sold_last_30d: number;
  units_sold_last_90d: number;

  // Trends
  trend_30d: 'growing' | 'stable' | 'declining' | null;
  growth_rate_30d: number | null;
  velocity_score: number;

  // Customer segments
  total_customers: number;
  top_customer_segments: Array<{
    segment: string;
    count: number;
    revenue: number;
  }>;
  customer_satisfaction_avg: number | null;

  // Intelligence
  best_paired_products: Array<{
    product_id: number;
    product_name: string;
    pairing_frequency: number;
  }>;
  similar_products: number[] | null;
  seasonal_pattern: string | null;
  recommended_for_segments: string[] | null;

  // Stock
  current_stock: number | null;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | null;

  last_calculated: Date;
  updated_at: Date;
}

export interface MaestroRecommendation {
  id: number;
  customer_avatar_id: number;
  odoo_partner_id: number;
  salesperson_id: number;
  recommendation_type: 'churn_prevention' | 'upsell' | 'new_product' | 'reactivation' | 'followup';
  priority: number;
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  action_suggested: string;
  reasoning: string | null;
  expected_outcome: string | null;
  suggested_products: Array<{
    product_id: number;
    name: string;
    why: string;
    expected_quantity?: number;
  }>;
  suggested_approach: string | null;
  talking_points: string[] | null;
  best_time_to_contact: string | null;
  optimal_day_of_week: string | null;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'dismissed';
  outcome: string | null;
  outcome_notes: string | null;
  actual_order_amount: number | null;
  confidence_score: number;
  success_probability: number | null;
  was_successful: boolean | null;
  created_at: Date;
  expires_at: Date | null;
}

export interface SalespersonPerformance {
  salesperson_id: number;
  salesperson_name: string;
  period_days: number;

  customers: {
    total_assigned: number;
    active_customers: number;
    at_risk_customers: number;
    high_upsell_potential: number;
  };

  sales: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
    orders_vs_last_period_pct: number;
    revenue_vs_last_period_pct: number;
  };

  activity: {
    total_interactions: number;
    visits: number;
    calls: number;
    emails: number;
    avg_interactions_per_day: number;
    success_rate: number;
  };

  ai_recommendations: {
    generated: number;
    accepted: number;
    completed: number;
    success_rate: number;
    revenue_from_ai_actions: number;
  };

  top_products_sold: Array<{
    product: string;
    quantity: number;
    revenue: number;
  }>;
}

// ============================================================================
// EXTERNAL RESEARCH RESULTS
// ============================================================================

export interface RestaurantMenu {
  restaurant: string;
  website: string | null;
  menu_found: boolean;
  categories: Array<{
    category: string;
    dishes: Array<{
      name: string;
      price: number | null;
      description?: string;
    }>;
  }>;
  insights: {
    cuisine_type: string;
    price_range: string;
    dishes_with_keywords: Record<string, number>;
    potential_products: Array<{
      product: string;
      reasoning: string;
    }>;
  };
  last_updated: Date;
}

export interface RestaurantReviews {
  restaurant: string;
  google_rating: number | null;
  google_reviews_count: number | null;
  tripadvisor_rating: number | null;
  tripadvisor_reviews_count: number | null;
  sentiment_analysis: {
    positive_rate: number;
    neutral_rate: number;
    negative_rate: number;
  };
  common_themes: Array<{
    theme: string;
    mentions: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  keywords_frequency: Record<string, number>;
  insights_for_sales: string[];
}

export interface RestaurantSocialMedia {
  restaurant: string;
  facebook: {
    page_url: string | null;
    followers: number | null;
    posts_last_30d: number | null;
    engagement_rate: number | null;
    recent_posts_topics: string[];
  } | null;
  instagram: {
    handle: string | null;
    followers: number | null;
    posts_last_30d: number | null;
    engagement_rate: number | null;
    hashtags_used: string[];
    product_mentions: Array<{
      product: string;
      mentions: number;
    }>;
  } | null;
  insights: {
    social_activity_level: 'low' | 'medium' | 'high';
    brand_positioning: string;
    target_audience: string;
    sales_approach_suggestion: string;
  };
}

// ============================================================================
// API REQUEST/RESPONSE
// ============================================================================

export interface AgentChatRequest {
  message: string;
  salesperson_id: number;
  conversation_id?: string;
  context?: {
    customer_id?: number;
    product_id?: number;
    current_page?: string;
    [key: string]: any;
  };
}

export interface AgentChatResponse {
  success: boolean;
  data?: {
    reply: string;
    conversation_id: string;
    agents_used: AgentRole[];
    suggestions?: string[];
    tokens_used: number;
    duration_ms: number;
  };
  error?: string;
  timestamp: string;
}
