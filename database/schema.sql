-- =====================================================
-- MAESTRO AI - Customer Avatar System
-- Database Schema for Vercel Postgres
-- =====================================================

-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- TABLE 1: Customer Avatars (Gemelli Digitali)
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_avatars (
  id SERIAL PRIMARY KEY,
  odoo_partner_id INT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  city VARCHAR(100),

  -- Behavioral Data
  first_order_date TIMESTAMP,
  last_order_date TIMESTAMP,
  total_orders INT DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  order_frequency_days INT, -- media giorni tra ordini
  days_since_last_order INT DEFAULT 0,

  -- Preferenze Prodotti (JSON)
  top_products JSONB DEFAULT '[]'::jsonb, -- [{product_id, name, quantity, revenue}]
  product_categories JSONB DEFAULT '{}'::jsonb, -- {category: percentage}
  favorite_products TEXT[], -- array prodotti preferiti

  -- AI Scores (0-100)
  health_score INT DEFAULT 50, -- salute relazione
  churn_risk_score INT DEFAULT 0, -- rischio abbandono (0=basso, 100=alto)
  upsell_potential_score INT DEFAULT 0, -- potenziale cross-sell
  engagement_score INT DEFAULT 50, -- quanto è attivo
  loyalty_score INT DEFAULT 50, -- fedeltà al brand

  -- Personality & Preferences
  personality_type VARCHAR(50), -- "early_adopter", "conservative", "price_sensitive"
  preferred_contact_method VARCHAR(20) DEFAULT 'visit', -- "phone", "email", "visit"
  best_contact_time VARCHAR(50), -- "morning", "afternoon", "evening"
  communication_style VARCHAR(50), -- "formal", "casual", "direct"
  decision_making_speed VARCHAR(20), -- "fast", "medium", "slow"

  -- Notes & Context
  notes TEXT, -- note venditori aggregate
  last_interaction_notes TEXT, -- ultima interazione
  special_requests TEXT, -- richieste speciali

  -- Venditore Assegnato
  assigned_salesperson_id INT, -- odoo res.users.id
  assigned_salesperson_name VARCHAR(255),

  -- Vector Embedding per similarity search (AI)
  embedding vector(1536), -- OpenAI ada-002 embeddings

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sync_odoo TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_health_score ON customer_avatars(health_score DESC);
CREATE INDEX IF NOT EXISTS idx_churn_risk ON customer_avatars(churn_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_last_order ON customer_avatars(last_order_date DESC);
CREATE INDEX IF NOT EXISTS idx_odoo_partner ON customer_avatars(odoo_partner_id);
CREATE INDEX IF NOT EXISTS idx_salesperson ON customer_avatars(assigned_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_active ON customer_avatars(is_active) WHERE is_active = true;

-- Vector similarity search (per trovare clienti simili)
CREATE INDEX IF NOT EXISTS idx_embedding ON customer_avatars USING ivfflat (embedding vector_cosine_ops);

-- =====================================================
-- TABLE 2: Sales Interactions (Feedback Venditori)
-- =====================================================
CREATE TABLE IF NOT EXISTS sales_interactions (
  id SERIAL PRIMARY KEY,
  customer_avatar_id INT REFERENCES customer_avatars(id) ON DELETE CASCADE,
  odoo_partner_id INT NOT NULL,

  salesperson_id INT NOT NULL, -- odoo user_id
  salesperson_name VARCHAR(255),

  interaction_type VARCHAR(50) NOT NULL, -- "visit", "call", "email", "sample", "order"
  interaction_date TIMESTAMP DEFAULT NOW(),

  -- Dettagli interazione
  outcome VARCHAR(50), -- "success", "no_answer", "refused", "scheduled_followup", "order_placed"
  duration_minutes INT, -- durata interazione
  notes TEXT,

  -- Campionature
  samples_given JSONB DEFAULT '[]'::jsonb, -- [{product_id, product_name, quantity}]
  sample_feedback VARCHAR(50), -- "loved", "neutral", "rejected", "pending"

  -- Ordine generato?
  order_generated BOOLEAN DEFAULT false,
  order_id INT, -- odoo sale.order id
  order_amount DECIMAL(10,2),

  -- Sentiment Analysis (AI)
  sentiment_score DECIMAL(3,2), -- -1 (negativo) a +1 (positivo)
  sentiment_label VARCHAR(20), -- "positive", "neutral", "negative"
  key_topics JSONB DEFAULT '[]'::jsonb, -- ["pricing", "quality", "delivery"] estratti da AI

  -- Follow-up
  requires_followup BOOLEAN DEFAULT false,
  followup_date TIMESTAMP,
  followup_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_interactions ON sales_interactions(customer_avatar_id);
CREATE INDEX IF NOT EXISTS idx_salesperson_interactions ON sales_interactions(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_date_interactions ON sales_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_outcome ON sales_interactions(outcome);

-- =====================================================
-- TABLE 3: Maestro Recommendations (Azioni AI)
-- =====================================================
CREATE TABLE IF NOT EXISTS maestro_recommendations (
  id SERIAL PRIMARY KEY,
  customer_avatar_id INT REFERENCES customer_avatars(id) ON DELETE CASCADE,
  odoo_partner_id INT NOT NULL,
  salesperson_id INT NOT NULL,

  -- Recommendation Details
  recommendation_type VARCHAR(50) NOT NULL, -- "churn_prevention", "upsell", "new_product", "reactivation", "followup"
  priority INT DEFAULT 50, -- 0-100, più alto = più urgente
  urgency_level VARCHAR(20) DEFAULT 'medium', -- "low", "medium", "high", "critical"

  action_suggested TEXT NOT NULL, -- "Visita cliente, proponi nuovo prodotto X"
  reasoning TEXT, -- "Non ordina da 45 giorni, ultimo ordine €500, ama prodotti artigianali"
  expected_outcome TEXT, -- "Ordine stimato €800-1200"

  suggested_products JSONB DEFAULT '[]'::jsonb, -- [{product_id, name, why, expected_quantity}]
  suggested_approach TEXT, -- "Tono: amichevole, menziona prodotto Y che ha amato"
  talking_points TEXT[], -- ["Nuovo prodotto artigianale", "Sconto 10% questa settimana"]

  -- Timing
  best_time_to_contact VARCHAR(50), -- "domani mattina", "questa settimana"
  optimal_day_of_week VARCHAR(20), -- "lunedì", "mercoledì"

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- "pending", "accepted", "in_progress", "completed", "dismissed"
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  dismissal_reason TEXT,

  outcome VARCHAR(50), -- "order_generated", "scheduled_followup", "no_interest", "not_available"
  outcome_notes TEXT,
  actual_order_amount DECIMAL(10,2),

  -- AI Confidence & Learning
  confidence_score DECIMAL(3,2) DEFAULT 0.5, -- 0-1, quanto il Maestro è sicuro
  success_probability DECIMAL(3,2), -- probabilità di successo stimata

  -- Feedback Loop (per migliorare AI)
  was_successful BOOLEAN,
  actual_vs_expected_variance DECIMAL(5,2), -- differenza tra previsto e reale

  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- dopo questa data, raccomandazione non più rilevante
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salesperson_pending ON maestro_recommendations(salesperson_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_priority ON maestro_recommendations(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_type ON maestro_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_urgency ON maestro_recommendations(urgency_level);
CREATE INDEX IF NOT EXISTS idx_customer_recs ON maestro_recommendations(customer_avatar_id);

-- =====================================================
-- TABLE 4: Product Intelligence
-- =====================================================
CREATE TABLE IF NOT EXISTS product_intelligence (
  id SERIAL PRIMARY KEY,
  odoo_product_id INT UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_category VARCHAR(100),
  product_code VARCHAR(100),

  -- Sales Metrics
  total_quantity_sold INT DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  avg_price DECIMAL(10,2),
  units_sold_last_30d INT DEFAULT 0,
  units_sold_last_90d INT DEFAULT 0,

  -- Trends
  trend_30d VARCHAR(20), -- "growing", "stable", "declining"
  growth_rate_30d DECIMAL(5,2), -- percentuale crescita
  velocity_score INT DEFAULT 50, -- quanto veloce si vende (0-100)

  -- Customer Segments
  total_customers INT DEFAULT 0,
  top_customer_segments JSONB DEFAULT '[]'::jsonb, -- [{segment: "restaurants", count: 15, revenue: 5000}]
  customer_satisfaction_avg DECIMAL(3,2), -- da feedback campioni

  -- AI Insights
  best_paired_products JSONB DEFAULT '[]'::jsonb, -- prodotti spesso ordinati insieme
  similar_products INT[], -- IDs prodotti simili
  seasonal_pattern VARCHAR(50), -- "summer_peak", "winter_low", "all_year"
  recommended_for_segments TEXT[], -- ["high_volume_restaurants", "pizzerias"]

  -- Stock & Availability
  current_stock INT,
  stock_status VARCHAR(20), -- "in_stock", "low_stock", "out_of_stock"

  last_calculated TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_odoo ON product_intelligence(odoo_product_id);
CREATE INDEX IF NOT EXISTS idx_product_trend ON product_intelligence(trend_30d);
CREATE INDEX IF NOT EXISTS idx_product_velocity ON product_intelligence(velocity_score DESC);

-- =====================================================
-- TABLE 5: Maestro Learning (Sistema Auto-apprendimento)
-- =====================================================
CREATE TABLE IF NOT EXISTS maestro_learning (
  id SERIAL PRIMARY KEY,

  -- Cosa ha imparato
  learning_type VARCHAR(50) NOT NULL, -- "product_pairing", "customer_pattern", "timing_optimal", "approach_successful"
  category VARCHAR(50), -- "sales", "product", "customer_behavior", "timing"
  pattern_name VARCHAR(255), -- nome descrittivo del pattern
  pattern_discovered TEXT NOT NULL,

  -- Evidence & Data
  supporting_data JSONB DEFAULT '{}'::jsonb, -- dati che supportano il pattern
  sample_size INT DEFAULT 0, -- quanti casi hanno generato questo pattern
  confidence DECIMAL(3,2) DEFAULT 0.5,
  statistical_significance DECIMAL(3,2), -- p-value o altra metrica

  -- Application
  applied_to_recommendations BOOLEAN DEFAULT false,
  times_applied INT DEFAULT 0,
  success_rate DECIMAL(3,2), -- % di volte che funziona
  avg_impact_revenue DECIMAL(10,2), -- impatto medio su revenue

  -- Validity
  is_active BOOLEAN DEFAULT true,
  requires_validation BOOLEAN DEFAULT true,
  validated BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  last_validated TIMESTAMP,
  last_applied TIMESTAMP,
  invalidated_at TIMESTAMP,
  invalidation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_learning_type ON maestro_learning(learning_type);
CREATE INDEX IF NOT EXISTS idx_learning_active ON maestro_learning(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_success_rate ON maestro_learning(success_rate DESC);

-- =====================================================
-- TABLE 6: Daily Action Plans (Piano Giornaliero)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_action_plans (
  id SERIAL PRIMARY KEY,
  salesperson_id INT NOT NULL,
  salesperson_name VARCHAR(255),
  plan_date DATE NOT NULL,

  -- Actions Generated
  total_actions INT DEFAULT 0,
  high_priority_actions INT DEFAULT 0,
  medium_priority_actions INT DEFAULT 0,
  low_priority_actions INT DEFAULT 0,

  -- Expected Outcomes
  estimated_orders INT DEFAULT 0,
  estimated_revenue DECIMAL(10,2) DEFAULT 0,
  estimated_visits INT DEFAULT 0,

  -- Actual Results (filled at end of day)
  actual_orders INT DEFAULT 0,
  actual_revenue DECIMAL(10,2) DEFAULT 0,
  actual_visits INT DEFAULT 0,
  actions_completed INT DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- "pending", "in_progress", "completed"
  completion_rate DECIMAL(3,2), -- % azioni completate

  -- AI Learning
  plan_effectiveness_score DECIMAL(3,2), -- quanto è stato efficace il piano
  variance_analysis JSONB DEFAULT '{}'::jsonb, -- differenze previsto vs reale

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  UNIQUE(salesperson_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_plan_salesperson ON daily_action_plans(salesperson_id, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_plan_date ON daily_action_plans(plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_plan_status ON daily_action_plans(status);

-- =====================================================
-- TABLE 7: System Metrics (Monitoring)
-- =====================================================
CREATE TABLE IF NOT EXISTS system_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,

  -- Database Stats
  total_avatars INT DEFAULT 0,
  active_avatars INT DEFAULT 0,
  new_avatars_today INT DEFAULT 0,

  -- Activity Stats
  total_interactions INT DEFAULT 0,
  visits_today INT DEFAULT 0,
  calls_today INT DEFAULT 0,
  samples_distributed INT DEFAULT 0,

  -- AI Stats
  recommendations_generated INT DEFAULT 0,
  recommendations_accepted INT DEFAULT 0,
  recommendations_completed INT DEFAULT 0,
  avg_recommendation_success_rate DECIMAL(3,2),

  -- Revenue Impact
  total_orders_generated INT DEFAULT 0,
  total_revenue_generated DECIMAL(10,2) DEFAULT 0,
  ai_assisted_revenue DECIMAL(10,2) DEFAULT 0,

  -- Performance
  avg_response_time_ms INT,
  api_calls_count INT DEFAULT 0,
  errors_count INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(metric_date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_date ON system_metrics(metric_date DESC);

-- =====================================================
-- VIEWS (per query veloci)
-- =====================================================

-- View: Top Churn Risk Customers
CREATE OR REPLACE VIEW v_high_churn_risk AS
SELECT
  ca.id,
  ca.odoo_partner_id,
  ca.name,
  ca.city,
  ca.churn_risk_score,
  ca.days_since_last_order,
  ca.last_order_date,
  ca.total_revenue,
  ca.assigned_salesperson_name,
  ca.assigned_salesperson_id
FROM customer_avatars ca
WHERE ca.churn_risk_score > 60
  AND ca.is_active = true
ORDER BY ca.churn_risk_score DESC, ca.days_since_last_order DESC;

-- View: Top Upsell Opportunities
CREATE OR REPLACE VIEW v_upsell_opportunities AS
SELECT
  ca.id,
  ca.odoo_partner_id,
  ca.name,
  ca.city,
  ca.upsell_potential_score,
  ca.avg_order_value,
  ca.total_orders,
  ca.total_revenue,
  ca.assigned_salesperson_name,
  ca.assigned_salesperson_id
FROM customer_avatars ca
WHERE ca.upsell_potential_score > 60
  AND ca.is_active = true
ORDER BY ca.upsell_potential_score DESC;

-- View: Pending Actions per Salesperson
CREATE OR REPLACE VIEW v_pending_actions AS
SELECT
  mr.salesperson_id,
  mr.salesperson_name,
  COUNT(*) as total_pending,
  SUM(CASE WHEN mr.urgency_level = 'critical' THEN 1 ELSE 0 END) as critical,
  SUM(CASE WHEN mr.urgency_level = 'high' THEN 1 ELSE 0 END) as high,
  SUM(CASE WHEN mr.urgency_level = 'medium' THEN 1 ELSE 0 END) as medium,
  SUM(CASE WHEN mr.urgency_level = 'low' THEN 1 ELSE 0 END) as low
FROM maestro_recommendations mr
WHERE mr.status = 'pending'
  AND (mr.expires_at IS NULL OR mr.expires_at > NOW())
GROUP BY mr.salesperson_id, mr.salesperson_name;

-- =====================================================
-- FUNCTIONS (utility)
-- =====================================================

-- Function: Update avatar scores basandosi su dati recenti
CREATE OR REPLACE FUNCTION update_avatar_scores(avatar_id INT)
RETURNS VOID AS $$
BEGIN
  UPDATE customer_avatars
  SET
    days_since_last_order = EXTRACT(DAY FROM (NOW() - last_order_date)),

    -- Churn risk: più giorni senza ordine + bassa frequenza = alto rischio
    churn_risk_score = LEAST(100, GREATEST(0,
      (EXTRACT(DAY FROM (NOW() - last_order_date)) / NULLIF(order_frequency_days, 0) * 50)::INT
    )),

    -- Health score: opposto di churn + engagement
    health_score = GREATEST(0, LEAST(100,
      100 - (EXTRACT(DAY FROM (NOW() - last_order_date)) / NULLIF(order_frequency_days, 0) * 50)::INT + engagement_score
    ) / 2),

    updated_at = NOW()
  WHERE id = avatar_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Auto-update avatar scores quando cambiano dati
CREATE OR REPLACE FUNCTION trigger_update_scores()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_avatar_scores(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER avatar_auto_update_scores
  AFTER INSERT OR UPDATE OF last_order_date, total_orders, order_frequency_days
  ON customer_avatars
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_scores();

-- =====================================================
-- INITIAL DATA / SEED
-- =====================================================

-- Seed: Product categories comuni
-- (Verrà popolato durante sync Odoo)

-- =====================================================
-- COMMENTS (documentazione)
-- =====================================================

COMMENT ON TABLE customer_avatars IS 'Gemelli digitali dei clienti con AI scores e behavioral data';
COMMENT ON TABLE sales_interactions IS 'Storico interazioni venditori-clienti per feedback loop';
COMMENT ON TABLE maestro_recommendations IS 'Azioni suggerite dal Maestro AI per i venditori';
COMMENT ON TABLE product_intelligence IS 'Intelligence sui prodotti con trend e pattern';
COMMENT ON TABLE maestro_learning IS 'Pattern appresi dal sistema per auto-miglioramento';
COMMENT ON TABLE daily_action_plans IS 'Piani giornalieri generati per ogni venditore';
COMMENT ON TABLE system_metrics IS 'Metriche di sistema per monitoring e analytics';

-- =====================================================
-- GRANT PERMISSIONS (adjust based on your setup)
-- =====================================================

-- Per ora lasciamo permessi di default Vercel Postgres
-- In production, configurare ruoli specifici per sicurezza

-- =====================================================
-- END OF SCHEMA
-- =====================================================
