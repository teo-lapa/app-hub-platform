-- Sales AI Hub Database Schema
-- PostgreSQL schema per memoria conversazionale e tracking interazioni

-- Table 1: Conversations (una conversazione per venditore)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id INTEGER NOT NULL, -- ID utente Odoo
  salesperson_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index per recupero veloce conversazioni per venditore
CREATE INDEX IF NOT EXISTS idx_conversations_salesperson ON conversations(salesperson_id);

-- Table 2: Conversation Messages (storico messaggi)
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- Dati extra: agenti usati, intent, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON conversation_messages(role);

-- Table 3: Client Interactions (azioni specifiche con clienti)
CREATE TABLE IF NOT EXISTS client_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  salesperson_id INTEGER NOT NULL,
  odoo_client_id INTEGER NOT NULL, -- ID cliente in Odoo
  client_name TEXT NOT NULL,
  interaction_type TEXT CHECK (interaction_type IN ('call', 'email', 'meeting', 'follow_up', 'order', 'visit')),
  summary TEXT,
  action_taken TEXT,
  outcome TEXT CHECK (outcome IN ('positive', 'neutral', 'negative', 'pending')),
  next_action TEXT,
  next_action_date DATE,
  amount DECIMAL(10, 2), -- Valore dell'ordine se interaction_type = 'order'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_interactions_client ON client_interactions(odoo_client_id);
CREATE INDEX IF NOT EXISTS idx_interactions_salesperson ON client_interactions(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON client_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_next_action ON client_interactions(next_action_date) WHERE next_action_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_type ON client_interactions(interaction_type);

-- Table 4: Daily Plans (piani giornalieri generati dall'AI)
CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id INTEGER NOT NULL,
  plan_date DATE NOT NULL,
  priorities JSONB DEFAULT '[]'::jsonb, -- Array di priorità ordinate
  kpis JSONB DEFAULT '{}'::jsonb, -- KPI del giorno
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Index per recupero piano del giorno
CREATE INDEX IF NOT EXISTS idx_daily_plans_salesperson_date ON daily_plans(salesperson_id, plan_date);

-- Funzione per auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger per conversations
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View: Recent Interactions (ultimi 60 giorni)
CREATE OR REPLACE VIEW recent_interactions AS
SELECT
  ci.*,
  c.salesperson_name,
  EXTRACT(DAY FROM (NOW() - ci.created_at)) as days_ago
FROM client_interactions ci
JOIN conversations c ON c.id = ci.conversation_id
WHERE ci.created_at >= NOW() - INTERVAL '60 days'
ORDER BY ci.created_at DESC;

-- View: Upcoming Actions (azioni pianificate future)
CREATE OR REPLACE VIEW upcoming_actions AS
SELECT
  ci.*,
  c.salesperson_name
FROM client_interactions ci
JOIN conversations c ON c.id = ci.conversation_id
WHERE ci.next_action_date IS NOT NULL
  AND ci.next_action_date >= CURRENT_DATE
ORDER BY ci.next_action_date ASC, ci.salesperson_id;

-- ============================================
-- PORTALE CLIENTI: Product Reservations
-- ============================================

-- Table: Product Reservations (prenotazioni prodotti non disponibili)
CREATE TABLE IF NOT EXISTS product_reservations (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL, -- ID prodotto Odoo
  customer_id INTEGER NOT NULL, -- ID cliente Odoo
  order_id INTEGER, -- ID ordine (può essere NULL se non ancora associato)
  text_note TEXT, -- Nota testuale
  audio_url TEXT, -- URL audio Vercel Blob
  image_url TEXT, -- URL immagine Vercel Blob
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON product_reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON product_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_order ON product_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON product_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_created ON product_reservations(created_at DESC);

-- Trigger per auto-update updated_at
CREATE TRIGGER update_product_reservations_updated_at
BEFORE UPDATE ON product_reservations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONTROLLO PREZZI: Price Reviews
-- ============================================

-- Table: Price Reviews (tracking stato controllo prezzi)
CREATE TABLE IF NOT EXISTS price_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL, -- ID prodotto Odoo
  order_id INTEGER NOT NULL, -- ID ordine Odoo
  order_line_id INTEGER NOT NULL, -- ID order line Odoo (identifica univocamente la riga)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'blocked')),
  reviewed_by TEXT, -- Chi ha marcato come controllato
  blocked_by TEXT, -- Chi ha bloccato il prezzo
  note TEXT, -- Note opzionali
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_price_reviews_product ON price_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_price_reviews_order ON price_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_price_reviews_order_line ON price_reviews(order_line_id);
CREATE INDEX IF NOT EXISTS idx_price_reviews_status ON price_reviews(status);
CREATE INDEX IF NOT EXISTS idx_price_reviews_created ON price_reviews(created_at DESC);

-- Unique constraint: una sola review per order line
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_reviews_unique_line ON price_reviews(order_line_id);

-- Trigger per auto-update updated_at
CREATE TRIGGER update_price_reviews_updated_at
BEFORE UPDATE ON price_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VOICE RECORDINGS: Registrazioni Vocali + AI
-- ============================================

-- Table: Voice Recordings (registrazioni vocali per arrivo merce e note)
CREATE TABLE IF NOT EXISTS voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL, -- ID utente che ha registrato
  plaud_file_id TEXT, -- ID file Plaud (se sincronizzato da Plaud Cloud)
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'arrivo_merce' CHECK (category IN ('arrivo_merce', 'inventory', 'note', 'order', 'other')),

  -- Audio & Storage
  audio_url TEXT, -- URL Vercel Blob o presigned URL Plaud
  audio_format TEXT DEFAULT 'audio/mpeg', -- MIME type
  duration INTEGER, -- Durata in secondi
  file_size INTEGER, -- Dimensione file in bytes

  -- AI Processing
  transcription TEXT, -- Trascrizione completa
  summary TEXT, -- Riassunto AI generato
  ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending', 'transcribing', 'processing', 'completed', 'failed')),
  ai_error TEXT, -- Messaggio errore se fallito

  -- Extracted Data (specifico per arrivo merce)
  extracted_products JSONB DEFAULT '[]'::jsonb, -- Array di prodotti estratti: [{name, quantity, weight, unit, odoo_product_id}]

  -- Odoo Integration
  odoo_picking_id INTEGER, -- ID movimento inventario Odoo (se creato)
  odoo_partner_id INTEGER, -- ID fornitore (se applicabile)

  -- Metadata
  tags TEXT[], -- Tags per categorizzazione e ricerca
  metadata JSONB DEFAULT '{}'::jsonb, -- Dati extra: device_id, language, confidence, etc.

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP -- Quando l'AI ha completato il processing
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_voice_recordings_user ON voice_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_category ON voice_recordings(category);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_ai_status ON voice_recordings(ai_status);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_created ON voice_recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_plaud_file ON voice_recordings(plaud_file_id) WHERE plaud_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voice_recordings_odoo_picking ON voice_recordings(odoo_picking_id) WHERE odoo_picking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voice_recordings_tags ON voice_recordings USING GIN(tags);

-- Indice full-text search su trascrizione (per ricerca testuale veloce)
CREATE INDEX IF NOT EXISTS idx_voice_recordings_transcription_search
ON voice_recordings USING GIN(to_tsvector('italian', COALESCE(transcription, '')));

-- Indice GIN per query JSONB su extracted_products
CREATE INDEX IF NOT EXISTS idx_voice_recordings_extracted_products
ON voice_recordings USING GIN(extracted_products);

-- Trigger per auto-update updated_at
CREATE TRIGGER update_voice_recordings_updated_at
BEFORE UPDATE ON voice_recordings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View: Recent Voice Recordings (ultimi 30 giorni)
CREATE OR REPLACE VIEW recent_voice_recordings AS
SELECT
  vr.*,
  EXTRACT(DAY FROM (NOW() - vr.created_at)) as days_ago,
  jsonb_array_length(vr.extracted_products) as products_count
FROM voice_recordings vr
WHERE vr.created_at >= NOW() - INTERVAL '30 days'
ORDER BY vr.created_at DESC;

-- View: Pending Processing (registrazioni in attesa di AI processing)
CREATE OR REPLACE VIEW pending_voice_recordings AS
SELECT *
FROM voice_recordings
WHERE ai_status IN ('pending', 'transcribing', 'processing')
ORDER BY created_at ASC;
