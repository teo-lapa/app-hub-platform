-- MAESTRO AI - Orders Cache
-- Cache degli ordini Odoo in PostgreSQL per performance e accesso agenti AI

-- Tabella ordini (cache da Odoo)
CREATE TABLE IF NOT EXISTS maestro_orders (
  id SERIAL PRIMARY KEY,
  odoo_order_id INTEGER UNIQUE NOT NULL,
  customer_avatar_id INTEGER REFERENCES customer_avatars(id) ON DELETE CASCADE,
  odoo_partner_id INTEGER NOT NULL,

  -- Order details
  order_name VARCHAR(100) NOT NULL,
  order_date TIMESTAMP NOT NULL,
  amount_total DECIMAL(12,2) DEFAULT 0,
  state VARCHAR(50),

  -- Salesperson assignment
  salesperson_id INTEGER,
  salesperson_name VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sync_odoo TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_orders_customer ON maestro_orders(customer_avatar_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON maestro_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON maestro_orders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_orders_state ON maestro_orders(state);
CREATE INDEX IF NOT EXISTS idx_orders_odoo_partner ON maestro_orders(odoo_partner_id);

-- Tabella righe ordine (prodotti acquistati)
CREATE TABLE IF NOT EXISTS maestro_order_lines (
  id SERIAL PRIMARY KEY,
  maestro_order_id INTEGER REFERENCES maestro_orders(id) ON DELETE CASCADE,
  odoo_line_id INTEGER,

  -- Product details
  product_id INTEGER,
  product_name VARCHAR(500),
  product_code VARCHAR(100),

  -- Quantities and prices
  quantity DECIMAL(10,2) DEFAULT 0,
  price_unit DECIMAL(12,2) DEFAULT 0,
  price_subtotal DECIMAL(12,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici per analisi prodotti
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON maestro_order_lines(maestro_order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_product ON maestro_order_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_product_code ON maestro_order_lines(product_code);

COMMENT ON TABLE maestro_orders IS 'Cache ordini Odoo per performance e accesso AI agents';
COMMENT ON TABLE maestro_order_lines IS 'Righe ordine (prodotti) per analisi e raccomandazioni AI';
