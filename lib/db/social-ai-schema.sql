-- ============================================================================
-- SOCIAL AI STUDIO - Database Schema
-- ============================================================================
--
-- Schema PostgreSQL per gestione contenuti social AI-generated e analytics
-- Include RAG system foundation con pgvector per embeddings
--
-- ============================================================================

-- ============================================================================
-- TABLE: social_posts
-- ============================================================================
-- Contenuti social generati dall'AI (copy + immagini + video)

CREATE TABLE IF NOT EXISTS social_posts (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product Info (da Odoo)
  product_id INTEGER, -- ID prodotto Odoo (nullable se upload manuale)
  product_name VARCHAR(500) NOT NULL,
  product_code VARCHAR(100),
  product_category VARCHAR(255), -- Per clustering RAG

  -- Platform & Content Type
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'linkedin')),
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('image', 'video', 'both')),

  -- Generated Content
  caption TEXT NOT NULL,
  hashtags TEXT, -- JSON array di hashtags (es: '["#ZurichFood", "#SwissGastro"]')
  cta TEXT, -- Call to Action

  -- Media URLs (Vercel Blob Storage)
  image_url TEXT, -- URL immagine generata
  video_url TEXT, -- URL video generato
  thumbnail_url TEXT, -- Thumbnail del video

  -- Original product image
  original_image_url TEXT,

  -- Configuration Used
  tone VARCHAR(50) CHECK (tone IN ('professional', 'casual', 'fun', 'luxury')),
  video_style VARCHAR(50), -- default, zoom, rotate, cinematic, etc.
  video_duration INTEGER, -- 6, 12, 30 secondi
  aspect_ratio VARCHAR(10), -- 1:1, 4:3, 9:16, 16:9

  -- Branding
  logo_url TEXT,
  company_motto VARCHAR(255),

  -- Geo-Targeting
  target_canton VARCHAR(100), -- Zürich, Bern, Ticino, etc.
  target_city VARCHAR(100),
  target_language VARCHAR(10), -- de, en, it, fr

  -- User & Metadata
  created_by_user_id INTEGER, -- ID utente Odoo
  created_by_name VARCHAR(255),

  -- Analytics (aggiornati via API/webhook)
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0, -- Click su link/CTA
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.00, -- Calcolato: (likes+shares+comments)/reach*100

  -- Status & Publishing
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'scheduled', 'archived')),
  shared_at TIMESTAMP,
  scheduled_for TIMESTAMP,
  platform_post_id VARCHAR(255), -- ID del post sulla piattaforma (per webhook)
  platform_post_url TEXT, -- URL pubblico del post

  -- AI Quality Scores (per RAG filtering)
  ai_confidence DECIMAL(5,2), -- Confidence score di Gemini
  predicted_engagement DECIMAL(5,2), -- Engagement predetto da sentiment analysis

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Dati extra: device, A/B test variant, etc.
  tags TEXT[], -- Tags per categorizzazione manuale

  -- Recipe Data (ricette tradizionali generate)
  recipe_data JSONB, -- Dati ricetta: title, ingredients, steps, region, tradition, imageUrl, sources

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_social_posts_product ON social_posts(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_engagement ON social_posts(engagement_rate DESC) WHERE status = 'shared';
CREATE INDEX IF NOT EXISTS idx_social_posts_canton ON social_posts(target_canton) WHERE target_canton IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_category ON social_posts(product_category) WHERE product_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_hashtags ON social_posts USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_social_posts_tags ON social_posts USING GIN(tags);

-- Indice composito per RAG similarity search (category + platform + high engagement)
CREATE INDEX IF NOT EXISTS idx_social_posts_rag_candidates
ON social_posts(product_category, platform, engagement_rate DESC)
WHERE status = 'shared' AND engagement_rate >= 3.0;

-- ============================================================================
-- TABLE: social_analytics
-- ============================================================================
-- Time-series analytics per tracking performance giornaliera

CREATE TABLE IF NOT EXISTS social_analytics (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,

  -- Metrics Date (per time-series)
  metric_date DATE NOT NULL,

  -- Daily Metrics (snapshot giornaliero)
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0, -- Salvataggi (Instagram)
  video_views INTEGER DEFAULT 0, -- View complete video

  -- Geo Analytics
  top_locations JSONB DEFAULT '[]'::jsonb, -- Array [{city, views}, ...]
  location_canton VARCHAR(100),
  location_city VARCHAR(100),

  -- Demographics (se disponibili da API)
  age_ranges JSONB, -- {18-24: 30%, 25-34: 50%, ...}
  gender_split JSONB, -- {male: 45%, female: 55%}

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_analytics_post ON social_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON social_analytics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_post_date ON social_analytics(post_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_canton ON social_analytics(location_canton) WHERE location_canton IS NOT NULL;

-- Unique constraint: una sola metrica per post per giorno
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique_post_date ON social_analytics(post_id, metric_date);

-- ============================================================================
-- TABLE: brand_settings
-- ============================================================================
-- Configurazioni brand/logo per utenti

CREATE TABLE IF NOT EXISTS brand_settings (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User
  user_id INTEGER UNIQUE NOT NULL, -- ID utente Odoo
  user_name VARCHAR(255),

  -- Branding Assets
  logo_url TEXT, -- URL Vercel Blob
  company_motto VARCHAR(255),
  brand_color VARCHAR(7), -- HEX color (#FF5733)

  -- Default Preferences
  default_tone VARCHAR(50) CHECK (default_tone IN ('professional', 'casual', 'fun', 'luxury')),
  default_platforms TEXT DEFAULT '["instagram","facebook"]', -- JSON array preferenze piattaforme
  default_canton VARCHAR(100), -- Canton di default per targeting

  -- Hashtags Personalizzati
  custom_hashtags TEXT DEFAULT '[]', -- JSON array hashtags sempre inclusi

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_brand_settings_user ON brand_settings(user_id);

-- ============================================================================
-- TABLE: post_embeddings (per RAG System - pgvector)
-- ============================================================================
-- Embeddings vettoriali per similarity search RAG
-- NOTA: Richiede estensione pgvector installata

-- Abilita pgvector extension (se non già abilitato)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS post_embeddings (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,

  -- Embedding Vector (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding vector(1536) NOT NULL,

  -- Performance Score (per weighted search)
  performance_score DECIMAL(5,2) DEFAULT 0.00, -- Engagement rate snapshot

  -- Context (per filtering prima di similarity)
  platform VARCHAR(50),
  product_category VARCHAR(255),
  target_canton VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_embeddings_post ON post_embeddings(post_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_platform ON post_embeddings(platform);
CREATE INDEX IF NOT EXISTS idx_embeddings_category ON post_embeddings(product_category) WHERE product_category IS NOT NULL;

-- Indice IVFFLAT per similarity search vettoriale (richiede pgvector)
-- Crea indice con 100 liste (adatto per <100K embeddings)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
ON post_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- TABLE: canton_hashtags
-- ============================================================================
-- Database hashtags localizzati per Canton Svizzero

CREATE TABLE IF NOT EXISTS canton_hashtags (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Canton
  canton VARCHAR(100) NOT NULL,

  -- Hashtag
  hashtag VARCHAR(100) NOT NULL,

  -- Category (opzionale per filtrare per categoria prodotto)
  category VARCHAR(100), -- food, gastro, lifestyle, etc.

  -- Usage Stats
  usage_count INTEGER DEFAULT 0,
  avg_engagement DECIMAL(5,2) DEFAULT 0.00, -- Media engagement rate con questo hashtag

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_canton_hashtags_canton ON canton_hashtags(canton);
CREATE INDEX IF NOT EXISTS idx_canton_hashtags_category ON canton_hashtags(category) WHERE category IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_canton_hashtags_unique ON canton_hashtags(canton, hashtag);

-- Seed data Canton Zurigo
INSERT INTO canton_hashtags (canton, hashtag, category) VALUES
  ('Zürich', '#ZurichFood', 'food'),
  ('Zürich', '#ZürichEssen', 'food'),
  ('Zürich', '#ZurichGastro', 'food'),
  ('Zürich', '#ZurichLife', 'lifestyle'),
  ('Zürich', '#VisitZurich', 'lifestyle'),
  ('Zürich', '#ZurichRestaurants', 'food'),
  ('Zürich', '#ZH', 'general'),
  ('Zürich', '#Zürich', 'general'),
  ('Zürich', '#ZurichCity', 'general'),
  ('Zürich', '#SwissFood', 'food')
ON CONFLICT (canton, hashtag) DO NOTHING;

-- Altri cantoni (esempi)
INSERT INTO canton_hashtags (canton, hashtag, category) VALUES
  ('Bern', '#BernFood', 'food'),
  ('Bern', '#BernEssen', 'food'),
  ('Bern', '#VisitBern', 'lifestyle'),
  ('Ticino', '#TicinoFood', 'food'),
  ('Ticino', '#Ticino', 'general'),
  ('Ticino', '#Lugano', 'general')
ON CONFLICT (canton, hashtag) DO NOTHING;

-- ============================================================================
-- VIEWS (per query comuni)
-- ============================================================================

-- View: Top Performing Posts (ultimo mese)
CREATE OR REPLACE VIEW v_top_performing_posts AS
SELECT
  sp.id,
  sp.product_name,
  sp.platform,
  sp.caption,
  sp.hashtags,
  sp.engagement_rate,
  sp.views,
  sp.likes,
  sp.shares,
  sp.target_canton,
  sp.created_at,
  sp.shared_at,
  EXTRACT(DAY FROM (NOW() - sp.shared_at)) as days_ago
FROM social_posts sp
WHERE sp.status = 'shared'
  AND sp.shared_at >= NOW() - INTERVAL '30 days'
  AND sp.engagement_rate >= 3.0
ORDER BY sp.engagement_rate DESC
LIMIT 100;

-- View: Posts By Platform Performance
CREATE OR REPLACE VIEW v_platform_performance AS
SELECT
  platform,
  COUNT(*) as total_posts,
  ROUND(AVG(engagement_rate), 2) as avg_engagement,
  SUM(views) as total_views,
  SUM(likes) as total_likes,
  SUM(shares) as total_shares,
  SUM(comments) as total_comments
FROM social_posts
WHERE status = 'shared'
  AND shared_at >= NOW() - INTERVAL '30 days'
GROUP BY platform
ORDER BY avg_engagement DESC;

-- View: Canton Performance
CREATE OR REPLACE VIEW v_canton_performance AS
SELECT
  target_canton,
  COUNT(*) as total_posts,
  ROUND(AVG(engagement_rate), 2) as avg_engagement,
  SUM(views) as total_views,
  SUM(likes) as total_likes
FROM social_posts
WHERE status = 'shared'
  AND target_canton IS NOT NULL
  AND shared_at >= NOW() - INTERVAL '30 days'
GROUP BY target_canton
ORDER BY avg_engagement DESC;

-- View: Product Category Performance
CREATE OR REPLACE VIEW v_category_performance AS
SELECT
  product_category,
  COUNT(*) as total_posts,
  ROUND(AVG(engagement_rate), 2) as avg_engagement,
  SUM(views) as total_views
FROM social_posts
WHERE status = 'shared'
  AND product_category IS NOT NULL
  AND shared_at >= NOW() - INTERVAL '30 days'
GROUP BY product_category
ORDER BY avg_engagement DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Auto-update updated_at timestamp (riuso esistente)
-- Già definita in schema.sql, non ridefinire se esiste
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: RAG Similarity Search (pgvector)
-- Trova i top N post simili con alta performance
CREATE OR REPLACE FUNCTION match_high_performing_posts(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 5,
  filter_platform text DEFAULT NULL,
  filter_category text DEFAULT NULL,
  min_engagement float DEFAULT 3.0
)
RETURNS TABLE (
  post_id uuid,
  similarity float,
  engagement_rate decimal,
  caption text,
  hashtags text[],
  cta text,
  platform text,
  product_category text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    1 - (pe.embedding <=> query_embedding) as similarity,
    sp.engagement_rate,
    sp.caption,
    sp.hashtags,
    sp.cta,
    sp.platform,
    sp.product_category
  FROM post_embeddings pe
  JOIN social_posts sp ON pe.post_id = sp.id
  WHERE
    sp.status = 'shared'
    AND sp.engagement_rate >= min_engagement
    AND (filter_platform IS NULL OR pe.platform = filter_platform)
    AND (filter_category IS NULL OR pe.product_category = filter_category)
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY
    pe.performance_score DESC, -- Priorità a post performanti
    similarity DESC
  LIMIT match_count;
END;
$$;

-- Function: Calculate Engagement Rate
-- Trigger automatico per calcolare engagement_rate quando cambiano metriche
CREATE OR REPLACE FUNCTION calculate_engagement_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reach > 0 THEN
    NEW.engagement_rate := ROUND(
      ((NEW.likes + NEW.shares + NEW.comments)::DECIMAL / NEW.reach::DECIMAL) * 100,
      2
    );
  ELSE
    NEW.engagement_rate := 0.00;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: social_posts updated_at
DROP TRIGGER IF EXISTS trigger_social_posts_updated_at ON social_posts;
CREATE TRIGGER trigger_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: brand_settings updated_at
DROP TRIGGER IF EXISTS trigger_brand_settings_updated_at ON brand_settings;
CREATE TRIGGER trigger_brand_settings_updated_at
  BEFORE UPDATE ON brand_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: social_analytics updated_at
DROP TRIGGER IF EXISTS trigger_social_analytics_updated_at ON social_analytics;
CREATE TRIGGER trigger_social_analytics_updated_at
  BEFORE UPDATE ON social_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: canton_hashtags updated_at
DROP TRIGGER IF EXISTS trigger_canton_hashtags_updated_at ON canton_hashtags;
CREATE TRIGGER trigger_canton_hashtags_updated_at
  BEFORE UPDATE ON canton_hashtags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-calculate engagement_rate quando cambiano metriche
DROP TRIGGER IF EXISTS trigger_calculate_engagement ON social_posts;
CREATE TRIGGER trigger_calculate_engagement
  BEFORE INSERT OR UPDATE OF views, likes, shares, comments, reach ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_engagement_rate();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check tables exist
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('social_posts', 'social_analytics', 'brand_settings', 'post_embeddings', 'canton_hashtags')
ORDER BY table_name;

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
