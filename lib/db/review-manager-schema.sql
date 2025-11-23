-- ============================================
-- REVIEW MANAGER PRO - Database Schema
-- Sistema gestione recensioni multi-piattaforma
-- ============================================

-- Table 1: Businesses (Clienti/Ristoranti)
CREATE TABLE IF NOT EXISTS rm_businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,                    -- Nome attività (es. "Ristorante Mario")
  slug VARCHAR(100) UNIQUE NOT NULL,             -- URL-friendly name (es. "ristorante-mario")
  owner_name VARCHAR(255),                       -- Nome proprietario
  owner_email VARCHAR(255),                      -- Email proprietario
  owner_phone VARCHAR(50),                       -- Telefono
  address TEXT,                                  -- Indirizzo
  city VARCHAR(100),                             -- Città
  country VARCHAR(50) DEFAULT 'IT',              -- Paese
  logo_url TEXT,                                 -- Logo attività

  -- Impostazioni risposte AI
  response_mode VARCHAR(20) DEFAULT 'manual' CHECK (response_mode IN ('auto', 'manual')),
  response_tone VARCHAR(50) DEFAULT 'friendly' CHECK (response_tone IN ('friendly', 'elegant', 'professional', 'casual')),
  response_languages TEXT[] DEFAULT ARRAY['IT'], -- Lingue supportate

  -- Stato
  is_active BOOLEAN DEFAULT true,
  subscription_plan VARCHAR(50) DEFAULT 'basic', -- basic, pro, enterprise

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_rm_businesses_slug ON rm_businesses(slug);
CREATE INDEX IF NOT EXISTS idx_rm_businesses_active ON rm_businesses(is_active);

-- ============================================
-- Table 2: Platform Credentials (API Keys per piattaforma)
-- ============================================
CREATE TABLE IF NOT EXISTS rm_platform_credentials (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES rm_businesses(id) ON DELETE CASCADE,

  platform VARCHAR(50) NOT NULL CHECK (platform IN ('google', 'instagram', 'tiktok', 'facebook', 'trustpilot')),

  -- Identificatori piattaforma
  platform_account_id VARCHAR(255),              -- ID account sulla piattaforma
  platform_account_name VARCHAR(255),            -- Nome visualizzato
  platform_page_id VARCHAR(255),                 -- Page ID (per Facebook/Instagram)
  google_place_id VARCHAR(255),                  -- Google Place ID
  google_location_id VARCHAR(255),               -- Google My Business Location ID

  -- Credenziali OAuth
  access_token TEXT,                             -- Token di accesso
  refresh_token TEXT,                            -- Token di refresh
  token_expires_at TIMESTAMP,                    -- Scadenza token

  -- API Keys (per piattaforme che usano API key invece di OAuth)
  api_key TEXT,
  api_secret TEXT,

  -- Stato
  is_connected BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP,
  sync_error TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique: un solo account per piattaforma per business
  UNIQUE(business_id, platform)
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_rm_credentials_business ON rm_platform_credentials(business_id);
CREATE INDEX IF NOT EXISTS idx_rm_credentials_platform ON rm_platform_credentials(platform);

-- ============================================
-- Table 3: Reviews (Recensioni da tutte le piattaforme)
-- ============================================
CREATE TABLE IF NOT EXISTS rm_reviews (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES rm_businesses(id) ON DELETE CASCADE,

  -- Piattaforma origine
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('google', 'instagram', 'tiktok', 'facebook', 'trustpilot')),
  platform_review_id VARCHAR(255),               -- ID recensione sulla piattaforma
  platform_url TEXT,                             -- URL diretto alla recensione

  -- Dati recensore
  reviewer_name VARCHAR(255),
  reviewer_profile_url TEXT,
  reviewer_photo_url TEXT,
  reviewer_is_local_guide BOOLEAN DEFAULT false, -- Per Google

  -- Contenuto recensione
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),  -- 1-5 stelle
  title VARCHAR(500),                            -- Titolo (se presente)
  content TEXT,                                  -- Testo recensione
  language VARCHAR(10) DEFAULT 'it',             -- Lingua rilevata

  -- Analisi AI
  sentiment_score DECIMAL(3,2),                  -- -1.00 a +1.00
  sentiment_label VARCHAR(20),                   -- positive, neutral, negative
  key_topics TEXT[],                             -- Topic estratti ['food', 'service', 'price']

  -- Risposta
  response_status VARCHAR(30) DEFAULT 'pending' CHECK (response_status IN (
    'pending',           -- Da rispondere
    'ai_generated',      -- AI ha generato risposta
    'approved',          -- Approvata, pronta per pubblicazione
    'published',         -- Pubblicata sulla piattaforma
    'rejected',          -- Rifiutata/ignorata
    'failed'             -- Errore pubblicazione
  )),
  ai_suggested_response TEXT,                    -- Risposta suggerita dall'AI
  final_response TEXT,                           -- Risposta finale (modificata o approvata)
  responded_at TIMESTAMP,                        -- Quando è stata pubblicata
  response_error TEXT,                           -- Errore se pubblicazione fallita

  -- Date
  review_date TIMESTAMP,                         -- Data recensione originale
  fetched_at TIMESTAMP DEFAULT NOW(),            -- Quando l'abbiamo importata

  -- Metadata
  raw_data JSONB,                                -- Dati grezzi dalla piattaforma
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique: evita duplicati
  UNIQUE(business_id, platform, platform_review_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_rm_reviews_business ON rm_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_rm_reviews_platform ON rm_reviews(platform);
CREATE INDEX IF NOT EXISTS idx_rm_reviews_status ON rm_reviews(response_status);
CREATE INDEX IF NOT EXISTS idx_rm_reviews_rating ON rm_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_rm_reviews_sentiment ON rm_reviews(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_rm_reviews_date ON rm_reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_rm_reviews_pending ON rm_reviews(business_id, response_status) WHERE response_status = 'pending';

-- ============================================
-- Table 4: Response Templates (Template risposte personalizzabili)
-- ============================================
CREATE TABLE IF NOT EXISTS rm_response_templates (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES rm_businesses(id) ON DELETE CASCADE, -- NULL = template globale

  name VARCHAR(100) NOT NULL,                    -- Nome template
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'positive_5star',
    'positive_4star',
    'neutral_3star',
    'negative_2star',
    'negative_1star',
    'generic'
  )),
  language VARCHAR(10) DEFAULT 'it',
  template_text TEXT NOT NULL,                   -- Testo con placeholders: {reviewer_name}, {business_name}

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table 5: Sync Logs (Log sincronizzazioni)
-- ============================================
CREATE TABLE IF NOT EXISTS rm_sync_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES rm_businesses(id) ON DELETE CASCADE,
  platform VARCHAR(50),

  sync_type VARCHAR(30) CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
  status VARCHAR(20) CHECK (status IN ('started', 'completed', 'failed')),

  reviews_fetched INTEGER DEFAULT 0,
  reviews_new INTEGER DEFAULT 0,
  responses_published INTEGER DEFAULT 0,

  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_rm_sync_logs_business ON rm_sync_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_rm_sync_logs_date ON rm_sync_logs(started_at DESC);

-- ============================================
-- Table 6: Business Metrics (Metriche aggregate - cache)
-- ============================================
CREATE TABLE IF NOT EXISTS rm_business_metrics (
  id SERIAL PRIMARY KEY,
  business_id INTEGER UNIQUE NOT NULL REFERENCES rm_businesses(id) ON DELETE CASCADE,

  -- Totali
  total_reviews INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),

  -- Per piattaforma
  google_reviews INTEGER DEFAULT 0,
  google_rating DECIMAL(3,2),
  instagram_comments INTEGER DEFAULT 0,
  tiktok_comments INTEGER DEFAULT 0,
  facebook_reviews INTEGER DEFAULT 0,
  facebook_rating DECIMAL(3,2),

  -- Distribuzione rating
  rating_5_count INTEGER DEFAULT 0,
  rating_4_count INTEGER DEFAULT 0,
  rating_3_count INTEGER DEFAULT 0,
  rating_2_count INTEGER DEFAULT 0,
  rating_1_count INTEGER DEFAULT 0,

  -- Sentiment
  positive_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  avg_sentiment DECIMAL(3,2),

  -- Response rate
  total_responses INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2),
  avg_response_time_hours INTEGER,

  -- Ultima review
  last_review_date TIMESTAMP,

  -- Cache timestamp
  last_calculated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Views utili
-- ============================================

-- View: Recensioni da rispondere (pending)
CREATE OR REPLACE VIEW rm_pending_reviews AS
SELECT
  r.*,
  b.name as business_name,
  b.response_tone,
  b.response_languages
FROM rm_reviews r
JOIN rm_businesses b ON b.id = r.business_id
WHERE r.response_status = 'pending'
ORDER BY r.review_date DESC;

-- View: Statistiche per business
CREATE OR REPLACE VIEW rm_business_stats AS
SELECT
  b.id,
  b.name,
  b.slug,
  COUNT(r.id) as total_reviews,
  ROUND(AVG(r.rating), 2) as avg_rating,
  COUNT(CASE WHEN r.response_status = 'pending' THEN 1 END) as pending_responses,
  COUNT(CASE WHEN r.response_status = 'published' THEN 1 END) as published_responses,
  MAX(r.review_date) as last_review_date
FROM rm_businesses b
LEFT JOIN rm_reviews r ON r.business_id = b.id
GROUP BY b.id, b.name, b.slug;

-- ============================================
-- Trigger per updated_at
-- ============================================
CREATE TRIGGER update_rm_businesses_updated_at
BEFORE UPDATE ON rm_businesses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rm_credentials_updated_at
BEFORE UPDATE ON rm_platform_credentials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rm_reviews_updated_at
BEFORE UPDATE ON rm_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Dati iniziali: Template risposte default
-- ============================================
INSERT INTO rm_response_templates (business_id, name, category, language, template_text) VALUES
(NULL, 'Risposta 5 stelle IT', 'positive_5star', 'it', 'Grazie mille {reviewer_name} per la fantastica recensione! Siamo felicissimi che la tua esperienza da {business_name} sia stata eccellente. Ti aspettiamo presto!'),
(NULL, 'Risposta 4 stelle IT', 'positive_4star', 'it', 'Grazie {reviewer_name} per il tuo feedback positivo! Siamo contenti che ti sia piaciuto. Ci impegniamo sempre per migliorare. A presto da {business_name}!'),
(NULL, 'Risposta 3 stelle IT', 'neutral_3star', 'it', 'Grazie {reviewer_name} per il tuo feedback. Apprezziamo i tuoi commenti e li useremo per migliorare. Speriamo di rivederti presto da {business_name}!'),
(NULL, 'Risposta 2 stelle IT', 'negative_2star', 'it', 'Ci dispiace che la tua esperienza non sia stata all''altezza delle aspettative, {reviewer_name}. Il tuo feedback è importante per noi. Ti invitiamo a contattarci per capire come possiamo rimediare.'),
(NULL, 'Risposta 1 stella IT', 'negative_1star', 'it', 'Ci scusiamo sinceramente per la tua esperienza negativa, {reviewer_name}. Prendiamo molto seriamente il tuo feedback. Ti preghiamo di contattarci direttamente per risolvere la situazione.'),
(NULL, 'Risposta 5 stelle EN', 'positive_5star', 'en', 'Thank you so much {reviewer_name} for the amazing review! We are thrilled that your experience at {business_name} was excellent. See you soon!'),
(NULL, 'Risposta 5 stelle DE', 'positive_5star', 'de', 'Vielen Dank {reviewer_name} für die tolle Bewertung! Wir freuen uns sehr, dass Ihr Erlebnis bei {business_name} ausgezeichnet war. Bis bald!')
ON CONFLICT DO NOTHING;
