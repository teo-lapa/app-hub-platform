-- Migration: Product Ranking Cache per ordinamento intelligente catalogo
-- Questa tabella cache statistiche di acquisto per ogni cliente+prodotto
-- Aggiornata da cron job notturno per performance ottimali

-- Drop table if exists (solo per development)
-- DROP TABLE IF EXISTS product_ranking_cache;

-- Tabella principale cache ranking prodotti
CREATE TABLE IF NOT EXISTS product_ranking_cache (
  odoo_partner_id INTEGER NOT NULL,
  odoo_product_id INTEGER NOT NULL,

  -- Score personalizzato cliente (basato su acquisti cliente)
  customer_score DECIMAL(10, 2) DEFAULT 0,

  -- Score globale LAPA (basato su vendite totali aziendali)
  global_score DECIMAL(10, 2) DEFAULT 0,

  -- Statistiche acquisti cliente (ultimi 12 mesi)
  last_purchase_date TIMESTAMP,
  total_qty_purchased DECIMAL(10, 2) DEFAULT 0,
  purchase_frequency INTEGER DEFAULT 0, -- Numero di volte acquistato
  total_amount_purchased DECIMAL(10, 2) DEFAULT 0,

  -- Statistiche globali LAPA (tutti i clienti, ultimi 12 mesi)
  global_qty_sold DECIMAL(10, 2) DEFAULT 0,
  global_orders_count INTEGER DEFAULT 0,

  -- Metadata
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (odoo_partner_id, odoo_product_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_partner_customer_score
  ON product_ranking_cache(odoo_partner_id, customer_score DESC);

CREATE INDEX IF NOT EXISTS idx_partner_global_score
  ON product_ranking_cache(odoo_partner_id, global_score DESC);

CREATE INDEX IF NOT EXISTS idx_updated_at
  ON product_ranking_cache(updated_at DESC);

-- Commenti per documentazione
COMMENT ON TABLE product_ranking_cache IS 'Cache pre-calcolata per ordinamento intelligente prodotti catalogo. Aggiornata ogni notte da cron job.';

COMMENT ON COLUMN product_ranking_cache.customer_score IS 'Score personalizzato: (qty*100) + (freq*50) + (recency_bonus). Più alto = più rilevante per cliente.';

COMMENT ON COLUMN product_ranking_cache.global_score IS 'Score vendite globali LAPA: (global_qty*10) + (global_orders*20). Best sellers aziendali.';

COMMENT ON COLUMN product_ranking_cache.purchase_frequency IS 'Numero di volte che il cliente ha ordinato questo prodotto negli ultimi 12 mesi.';
