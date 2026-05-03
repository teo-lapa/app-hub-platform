-- LAPA WINE — initial schema
-- Run on Neon Postgres: psql "$DATABASE_URL" -f migrations/lapa-wine.sql
-- Idempotent (CREATE IF NOT EXISTS where possible).

-- ── ENUMS ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE wine_opzione_commerciale AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE wine_order_status AS ENUM ('pending', 'confirmed', 'served', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── RESTAURANTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_restaurants (
  id                              TEXT PRIMARY KEY DEFAULT ('r_' || encode(gen_random_bytes(8), 'hex')),
  slug                            TEXT UNIQUE NOT NULL,
  name                            TEXT NOT NULL,
  owner_email                     TEXT NOT NULL,
  logo_url                        TEXT,
  address                         TEXT,
  accent_color                    TEXT,
  monogram                        TEXT,
  language_default                TEXT NOT NULL DEFAULT 'it',
  opzione_commerciale             wine_opzione_commerciale NOT NULL,
  sconto_acquisto_pct             DECIMAL(5, 2),
  target_rotazione_min_chf_mese   DECIMAL(10, 2),
  active                          BOOLEAN NOT NULL DEFAULT true,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wine_restaurants_owner_email ON wine_restaurants(owner_email);

-- ── PRODUCTS (catalogo Vergani) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_products (
  id                          TEXT PRIMARY KEY DEFAULT ('w_' || encode(gen_random_bytes(8), 'hex')),
  vergani_sku                 TEXT UNIQUE NOT NULL,
  name                        TEXT NOT NULL,
  producer                    TEXT NOT NULL,
  region                      TEXT NOT NULL,
  subregion                   TEXT,
  denomination                TEXT,
  grape_varieties             TEXT[] NOT NULL DEFAULT '{}',
  vintage                     INTEGER,
  format_cl                   INTEGER NOT NULL,
  wine_type                   TEXT NOT NULL,
  price_vergani_to_lapa_chf   DECIMAL(10, 2) NOT NULL,
  price_carta_suggested_chf   DECIMAL(10, 2) NOT NULL,
  fascia                      TEXT NOT NULL,
  story_short                 TEXT NOT NULL,
  tasting_notes               TEXT[] NOT NULL DEFAULT '{}',
  food_pairings               TEXT[] NOT NULL DEFAULT '{}',
  service_temp_c              INTEGER,
  decantation_minutes         INTEGER,
  image_url                   TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wine_products_wine_type ON wine_products(wine_type);
CREATE INDEX IF NOT EXISTS idx_wine_products_region ON wine_products(region);
CREATE INDEX IF NOT EXISTS idx_wine_products_fascia ON wine_products(fascia);

-- ── STOCK PER RISTORANTE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_restaurant_stocks (
  id                  TEXT PRIMARY KEY DEFAULT ('s_' || encode(gen_random_bytes(8), 'hex')),
  restaurant_id       TEXT NOT NULL REFERENCES wine_restaurants(id) ON DELETE CASCADE,
  wine_id             TEXT NOT NULL REFERENCES wine_products(id) ON DELETE CASCADE,
  qty_in_stock        INTEGER NOT NULL DEFAULT 0,
  qty_threshold_min   INTEGER NOT NULL DEFAULT 2,
  price_carta_chf     DECIMAL(10, 2),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, wine_id)
);
CREATE INDEX IF NOT EXISTS idx_wine_stocks_restaurant ON wine_restaurant_stocks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_wine_stocks_wine ON wine_restaurant_stocks(wine_id);

-- ── MENU ITEMS DEL RISTORANTE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_menu_items (
  id              TEXT PRIMARY KEY DEFAULT ('m_' || encode(gen_random_bytes(8), 'hex')),
  restaurant_id   TEXT NOT NULL REFERENCES wine_restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT,
  ingredients     TEXT[] NOT NULL DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wine_menu_restaurant ON wine_menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_wine_menu_category ON wine_menu_items(category);

-- ── SUGGESTIONS LOG (AI sommelier) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_suggestions (
  id              TEXT PRIMARY KEY DEFAULT ('sg_' || encode(gen_random_bytes(8), 'hex')),
  restaurant_id   TEXT NOT NULL REFERENCES wine_restaurants(id) ON DELETE CASCADE,
  table_code      TEXT NOT NULL,
  dishes_input    TEXT NOT NULL,
  wines_proposed  JSONB NOT NULL,
  wine_chosen_id  TEXT,
  customer_email  TEXT,
  session_id      TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'it',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wine_suggestions_restaurant ON wine_suggestions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_wine_suggestions_email ON wine_suggestions(customer_email);
CREATE INDEX IF NOT EXISTS idx_wine_suggestions_session ON wine_suggestions(session_id);

-- ── CUSTOMER FINALE (opt-in via Google) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_customers (
  id                   TEXT PRIMARY KEY DEFAULT ('c_' || encode(gen_random_bytes(8), 'hex')),
  email                TEXT UNIQUE NOT NULL,
  name                 TEXT NOT NULL,
  picture_url          TEXT,
  restaurants_visited  TEXT[] NOT NULL DEFAULT '{}',
  preferences          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ORDINI (comanda al tavolo) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_orders (
  id                  TEXT PRIMARY KEY DEFAULT ('o_' || encode(gen_random_bytes(8), 'hex')),
  restaurant_id       TEXT NOT NULL REFERENCES wine_restaurants(id) ON DELETE CASCADE,
  table_code          TEXT NOT NULL,
  wine_id             TEXT NOT NULL REFERENCES wine_products(id),
  qty                 INTEGER NOT NULL DEFAULT 1,
  price_carta_chf     DECIMAL(10, 2) NOT NULL,
  status              wine_order_status NOT NULL DEFAULT 'pending',
  customer_email      TEXT,
  suggestion_id       TEXT REFERENCES wine_suggestions(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wine_orders_restaurant ON wine_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_wine_orders_wine ON wine_orders(wine_id);
CREATE INDEX IF NOT EXISTS idx_wine_orders_email ON wine_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_wine_orders_status ON wine_orders(status);

-- ── VENDITE (per conto vendita Vergani) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS wine_sales (
  id                              TEXT PRIMARY KEY DEFAULT ('sa_' || encode(gen_random_bytes(8), 'hex')),
  restaurant_id                   TEXT NOT NULL REFERENCES wine_restaurants(id) ON DELETE CASCADE,
  wine_id                         TEXT NOT NULL REFERENCES wine_products(id),
  qty                             INTEGER NOT NULL,
  price_carta_chf                 DECIMAL(10, 2) NOT NULL,
  price_lapa_to_restaurant_chf    DECIMAL(10, 2) NOT NULL,
  price_vergani_to_lapa_chf       DECIMAL(10, 2) NOT NULL,
  sold_at                         TIMESTAMPTZ NOT NULL,
  invoiced_to_restaurant_at       TIMESTAMPTZ,
  paid_by_restaurant_at           TIMESTAMPTZ,
  paid_to_vergani_at              TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wine_sales_restaurant ON wine_sales(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_wine_sales_wine ON wine_sales(wine_id);
CREATE INDEX IF NOT EXISTS idx_wine_sales_sold_at ON wine_sales(sold_at);
