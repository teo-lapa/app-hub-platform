/**
 * Sales AI Hub - Types
 * TypeScript types per il sistema multi-agente vendite
 */

// ========== CORE TYPES ==========

export interface SalespersonContext {
  id: number;
  name: string;
  email?: string;
  odoo_user_id: number;
}

export interface OdooClient {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  vat?: string;
  city?: string;
  user_id: [number, string]; // [id, name] del venditore assegnato
}

export interface OdooOrder {
  id: number;
  name: string;
  partner_id: [number, string]; // [id, name]
  amount_total: number;
  date_order: string;
  state: string;
  user_id: [number, string]; // [id, name] del venditore
}

// ========== AGENT TYPES ==========

export type AgentRole =
  | 'daily_assistant'
  | 'memory_manager'
  | 'customer_intel'
  | 'field_support'
  | 'performance_tracker'
  | 'sales_coach'
  | 'territory_manager'
  | 'sales_enablement';

export interface AgentResponse {
  agent: AgentRole;
  content: string;
  data?: any;
  metadata?: Record<string, any>;
}

// ========== INTENT TYPES ==========

export type IntentType =
  | 'daily_plan'           // "Cosa devo fare oggi?"
  | 'client_question'      // "Come va con Cliente X?"
  | 'client_analysis'      // "Analizza Cliente X"
  | 'field_support'        // "Cliente chiede sconto", "Prodotto out of stock"
  | 'performance_check'    // "Come sto andando?"
  | 'upcoming_actions'     // "Cosa devo fare questa settimana?"
  | 'churn_risk'          // "Quali clienti sono a rischio?"
  | 'upsell_opportunities' // "Quali clienti posso upsellare?"
  | 'record_interaction'   // "Ho chiamato Cliente X"
  | 'general'             // Domanda generica
;

export interface Intent {
  type: IntentType;
  confidence: number;
  extractedData?: {
    clientId?: number;
    clientName?: string;
    interactionType?: string;
    amount?: number;
    date?: string;
  };
}

// ========== CUSTOMER INTELLIGENCE TYPES ==========

export interface RFMScore {
  customerId: number;
  name: string;
  recency: number;          // Giorni dall'ultimo ordine
  frequency: number;        // Ordini ultimi 12 mesi
  monetary: number;         // Revenue ultimi 12 mesi
  recencyScore: number;     // 1-5
  frequencyScore: number;   // 1-5
  monetaryScore: number;    // 1-5
  rfmScore: string;         // es: "545"
  segment: string;          // es: "Champions", "At Risk"
}

export interface ChurnAlert {
  customer: OdooClient;
  rfm: RFMScore;
  riskFactors: string[];
  churnProbability: number; // 0-100
  suggestedActions: {
    priority: 'urgent' | 'high' | 'medium' | 'low';
    action: string;
    expectedROI?: number;
    cost?: number;
  }[];
}

export interface UpsellOpportunity {
  customer: OdooClient;
  currentSpend: number;
  potentialSpend: number;
  gap: number;
  suggestions: {
    product: string;
    reason: string;
    estimatedRevenue: number;
  }[];
}

// ========== PERFORMANCE TYPES ==========

export interface SalesKPIs {
  salespersonId: number;
  name: string;
  period: {
    start: Date;
    end: Date;
  };
  revenue: {
    total: number;
    target: number;
    progress: number; // percentage
    vs_last_period: number; // percentage change
  };
  activity: {
    visits: number;
    calls: number;
    emails: number;
    meetings: number;
  };
  clients: {
    total: number;
    new: number;
    retention_rate: number; // percentage
  };
  deals: {
    closed: number;
    avg_deal_size: number;
  };
}

// ========== TERRITORY TYPES ==========

export interface VisitPlan {
  salespersonId: number;
  date: Date;
  visits: {
    order: number;
    client: OdooClient;
    purpose: 'follow_up' | 'new_prospect' | 'upsell' | 'problem_solving';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    estimated_duration: number; // minuti
    notes?: string;
  }[];
  route: {
    total_distance: number; // km
    total_time: number; // minuti
    map_url?: string;
  };
}

// ========== DAILY PLAN TYPES ==========

export interface DailyPriority {
  type: 'churn_prevention' | 'upsell' | 'new_client' | 'follow_up' | 'problem_solving';
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  client: {
    id: number;
    name: string;
  };
  action: string;
  reason: string;
  expected_outcome?: string;
  estimated_time?: number; // minuti
}

export interface DailyPlanOutput {
  salespersonId: number;
  name: string;
  date: Date;
  kpis: {
    target_today: number;
    progress_to_target: number;
    tasks_completed: number;
    tasks_total: number;
  };
  priorities: DailyPriority[];
  scheduled_visits: VisitPlan['visits'];
  upcoming_calls: {
    time: string;
    client: string;
    purpose: string;
  }[];
  notes?: string;
}

// ========== MESSAGE CONTEXT ==========

export interface MessageContext {
  salesperson: SalespersonContext;
  conversationHistory: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  recentInteractions: {
    clientId: number;
    clientName: string;
    type: string;
    outcome: string;
    daysAgo: number;
  }[];
  upcomingActions: {
    clientName: string;
    action: string;
    date: Date;
  }[];
}
