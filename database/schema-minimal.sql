-- MAESTRO AI - Minimal Schema (Essential Tables Only)

-- Table 2: Sales Interactions
CREATE TABLE IF NOT EXISTS sales_interactions (
  id SERIAL PRIMARY KEY,
  customer_avatar_id INT REFERENCES customer_avatars(id) ON DELETE CASCADE,
  odoo_partner_id INT NOT NULL,
  salesperson_id INT NOT NULL,
  salesperson_name VARCHAR(255),
  interaction_type VARCHAR(50) NOT NULL,
  interaction_date TIMESTAMP DEFAULT NOW(),
  outcome VARCHAR(50),
  notes TEXT,
  samples_given JSONB DEFAULT '[]'::jsonb,
  order_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table 3: Maestro Recommendations
CREATE TABLE IF NOT EXISTS maestro_recommendations (
  id SERIAL PRIMARY KEY,
  customer_avatar_id INT REFERENCES customer_avatars(id) ON DELETE CASCADE,
  odoo_partner_id INT NOT NULL,
  salesperson_id INT NOT NULL,
  recommendation_type VARCHAR(50) NOT NULL,
  priority INT DEFAULT 50,
  urgency_level VARCHAR(20) DEFAULT 'medium',
  action_suggested TEXT NOT NULL,
  reasoning TEXT,
  suggested_products JSONB DEFAULT '[]'::jsonb,
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
