-- ============================================================================
-- EMAIL AI MONITOR - Database Schema
-- ============================================================================
--
-- Schema PostgreSQL per sistema di monitoraggio Gmail con AI classification
-- Include RAG system per trovare email simili con pgvector embeddings
--
-- ============================================================================

-- ============================================================================
-- TABLE: gmail_connections
-- ============================================================================
-- Configurazione OAuth Gmail per utenti

CREATE TABLE IF NOT EXISTS gmail_connections (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Info
  user_id VARCHAR(255) NOT NULL, -- ID univoco utente
  user_name VARCHAR(255),
  gmail_address VARCHAR(500) NOT NULL,

  -- OAuth Tokens (encrypted in production!)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,

  -- Gmail Sync Settings
  last_sync_date TIMESTAMP, -- Ultima volta che abbiamo fetchato email
  last_message_id VARCHAR(255), -- ID ultima email processata (per incremental sync)
  sync_enabled BOOLEAN DEFAULT true,
  sync_frequency VARCHAR(20) DEFAULT 'daily' CHECK (sync_frequency IN ('hourly', 'daily', 'manual')),

  -- AI Automation Settings
  auto_classify BOOLEAN DEFAULT true, -- Auto-classifica urgenza
  auto_summarize BOOLEAN DEFAULT true, -- Auto-genera summary
  auto_move_spam BOOLEAN DEFAULT false, -- Auto-sposta spam (ATTENZIONE: può avere false positive)
  auto_draft_reply BOOLEAN DEFAULT false, -- Auto-genera bozze risposta

  -- Custom Classification Rules (JSON)
  client_domains JSONB DEFAULT '[]'::jsonb, -- ["customer.com", "client.it"] - dominio clienti
  supplier_domains JSONB DEFAULT '[]'::jsonb, -- ["supplier.com"] - dominio fornitori
  urgent_keywords JSONB DEFAULT '["urgente","fattura","pagamento","scadenza"]'::jsonb,
  spam_keywords JSONB DEFAULT '["offerta","promozione","sconto","newsletter"]'::jsonb,

  -- Notification Preferences
  notify_urgent BOOLEAN DEFAULT true, -- Notifica per email urgenti
  notify_clients BOOLEAN DEFAULT true, -- Notifica per email clienti
  notification_email VARCHAR(500), -- Email alternativa per notifiche

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user ON gmail_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_enabled ON gmail_connections(sync_enabled) WHERE sync_enabled = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_connections_gmail ON gmail_connections(gmail_address);

-- ============================================================================
-- TABLE: email_messages
-- ============================================================================
-- Email processate con classificazione AI

CREATE TABLE IF NOT EXISTS email_messages (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to gmail_connections
  connection_id UUID NOT NULL REFERENCES gmail_connections(id) ON DELETE CASCADE,

  -- Gmail Message Data
  gmail_message_id VARCHAR(255) UNIQUE NOT NULL, -- ID univoco Gmail
  gmail_thread_id VARCHAR(255), -- Thread ID per raggruppare conversazioni
  gmail_label_ids TEXT[], -- Labels Gmail (INBOX, IMPORTANT, SPAM, etc.)

  -- Email Headers
  sender_email VARCHAR(500) NOT NULL,
  sender_name VARCHAR(500),
  sender_domain VARCHAR(255), -- Estratto da sender_email per filtering

  recipient_email VARCHAR(500), -- Il nostro indirizzo
  cc_emails TEXT[], -- CC addresses
  bcc_emails TEXT[], -- BCC addresses

  subject TEXT,

  -- Email Body
  body_text TEXT, -- Plain text body
  body_html TEXT, -- HTML body
  snippet TEXT, -- Snippet breve Gmail (prime 200 chars)

  -- Attachments
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb, -- [{filename, mimeType, size}, ...]

  -- Email Metadata
  received_date TIMESTAMP NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,

  -- AI Classification
  urgency_level VARCHAR(20) DEFAULT 'normal' CHECK (urgency_level IN ('urgent', 'important', 'normal', 'low')),
  is_spam BOOLEAN DEFAULT false,
  is_client BOOLEAN DEFAULT false, -- Email da cliente
  is_supplier BOOLEAN DEFAULT false, -- Email da fornitore
  is_internal BOOLEAN DEFAULT false, -- Email interna team

  -- AI Analysis
  ai_summary TEXT, -- Riassunto generato da AI
  ai_draft_reply TEXT, -- Bozza risposta suggerita da AI
  ai_sentiment VARCHAR(20) CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  ai_confidence DECIMAL(5,2), -- Confidence score classificazione (0-100)
  ai_keywords TEXT[], -- Keywords estratte da AI

  -- Category Classification
  email_category VARCHAR(50) CHECK (email_category IN (
    'sales', 'support', 'invoice', 'order', 'delivery',
    'marketing', 'newsletter', 'notification', 'other'
  )),

  -- Actions Taken
  processed_at TIMESTAMP, -- Quando è stata processata dall'AI
  moved_to_spam BOOLEAN DEFAULT false, -- Se è stata spostata in spam
  moved_to_folder VARCHAR(255), -- Folder Gmail dove è stata spostata
  replied_at TIMESTAMP, -- Se è stata risposta
  archived_at TIMESTAMP, -- Se è stata archiviata
  reply_detected BOOLEAN DEFAULT false, -- Se è stata rilevata una risposta nel thread Gmail

  -- User Actions
  user_marked_important BOOLEAN DEFAULT false, -- Utente ha marcato come importante
  user_notes TEXT, -- Note utente
  user_tags TEXT[], -- Tag custom utente

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Extra data: device, geolocation, etc.

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_emails_connection ON email_messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_message ON email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON email_messages(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_sender ON email_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_sender_domain ON email_messages(sender_domain);
CREATE INDEX IF NOT EXISTS idx_emails_date ON email_messages(received_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_urgency ON email_messages(urgency_level) WHERE urgency_level IN ('urgent', 'important');
CREATE INDEX IF NOT EXISTS idx_emails_unprocessed ON email_messages(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emails_unread ON email_messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_emails_spam ON email_messages(is_spam) WHERE is_spam = true;
CREATE INDEX IF NOT EXISTS idx_emails_client ON email_messages(is_client) WHERE is_client = true;
CREATE INDEX IF NOT EXISTS idx_emails_supplier ON email_messages(is_supplier) WHERE is_supplier = true;
CREATE INDEX IF NOT EXISTS idx_emails_category ON email_messages(email_category) WHERE email_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_keywords ON email_messages USING GIN(ai_keywords);
CREATE INDEX IF NOT EXISTS idx_emails_user_tags ON email_messages USING GIN(user_tags);
CREATE INDEX IF NOT EXISTS idx_emails_labels ON email_messages USING GIN(gmail_label_ids);

-- Indice composito per dashboard queries
CREATE INDEX IF NOT EXISTS idx_emails_dashboard
ON email_messages(connection_id, received_date DESC, urgency_level)
WHERE processed_at IS NOT NULL;

-- ============================================================================
-- TABLE: email_embeddings
-- ============================================================================
-- Embeddings vettoriali per RAG similarity search
-- Trova email simili per suggerire risposte basate su email passate

-- Abilita pgvector extension (se non già abilitato)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS email_embeddings (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,

  -- Embedding Vector (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding vector(1536) NOT NULL,

  -- Context Metadata (per pre-filtering prima di similarity search)
  sender_domain VARCHAR(255),
  urgency_level VARCHAR(20),
  email_category VARCHAR(50),
  is_client BOOLEAN DEFAULT false,
  is_supplier BOOLEAN DEFAULT false,

  -- Performance Metadata
  was_replied BOOLEAN DEFAULT false, -- Se questa email ha avuto risposta
  reply_quality_score DECIMAL(5,2), -- Score qualità risposta (feedback utente)

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_embeddings_email_unique ON email_embeddings(email_id);
CREATE INDEX IF NOT EXISTS idx_email_embeddings_domain ON email_embeddings(sender_domain);
CREATE INDEX IF NOT EXISTS idx_email_embeddings_urgency ON email_embeddings(urgency_level);
CREATE INDEX IF NOT EXISTS idx_email_embeddings_category ON email_embeddings(email_category) WHERE email_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_embeddings_client ON email_embeddings(is_client) WHERE is_client = true;
CREATE INDEX IF NOT EXISTS idx_email_embeddings_replied ON email_embeddings(was_replied) WHERE was_replied = true;

-- Indice IVFFLAT per similarity search vettoriale (richiede pgvector)
-- Crea indice con 100 liste (adatto per <100K embeddings)
CREATE INDEX IF NOT EXISTS idx_email_embeddings_vector
ON email_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- TABLE: email_analytics
-- ============================================================================
-- Time-series analytics per tracking performance email AI

CREATE TABLE IF NOT EXISTS email_analytics (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  connection_id UUID NOT NULL REFERENCES gmail_connections(id) ON DELETE CASCADE,

  -- Analytics Date
  metric_date DATE NOT NULL,

  -- Daily Email Counts
  total_emails INTEGER DEFAULT 0,
  unread_emails INTEGER DEFAULT 0,
  urgent_emails INTEGER DEFAULT 0,
  important_emails INTEGER DEFAULT 0,
  spam_detected INTEGER DEFAULT 0,
  client_emails INTEGER DEFAULT 0,
  supplier_emails INTEGER DEFAULT 0,

  -- AI Performance
  emails_classified INTEGER DEFAULT 0, -- Quante email sono state classificate
  emails_summarized INTEGER DEFAULT 0,
  draft_replies_generated INTEGER DEFAULT 0,
  spam_moved INTEGER DEFAULT 0, -- Quante email spostate in spam

  -- Response Metrics
  emails_replied INTEGER DEFAULT 0,
  avg_response_time_hours DECIMAL(10,2), -- Tempo medio risposta in ore

  -- Top Senders (daily)
  top_senders JSONB DEFAULT '[]'::jsonb, -- [{email, count}, ...]
  top_domains JSONB DEFAULT '[]'::jsonb, -- [{domain, count}, ...]

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_email_analytics_connection ON email_analytics(connection_id);
CREATE INDEX IF NOT EXISTS idx_email_analytics_date ON email_analytics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_analytics_connection_date ON email_analytics(connection_id, metric_date DESC);

-- Unique constraint: una metrica per connection per giorno
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_analytics_unique ON email_analytics(connection_id, metric_date);

-- ============================================================================
-- VIEWS (per query comuni)
-- ============================================================================

-- View: Urgent Emails Unread
CREATE OR REPLACE VIEW v_urgent_unread_emails AS
SELECT
  em.id,
  em.gmail_message_id,
  em.sender_email,
  em.sender_name,
  em.subject,
  em.snippet,
  em.ai_summary,
  em.received_date,
  em.urgency_level,
  em.is_client,
  em.is_supplier,
  gc.gmail_address,
  EXTRACT(HOUR FROM (NOW() - em.received_date)) as hours_ago
FROM email_messages em
JOIN gmail_connections gc ON em.connection_id = gc.id
WHERE em.is_read = false
  AND em.urgency_level IN ('urgent', 'important')
  AND em.is_spam = false
ORDER BY em.received_date DESC;

-- View: Client Emails Summary
CREATE OR REPLACE VIEW v_client_emails_summary AS
SELECT
  sender_domain,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count,
  COUNT(*) FILTER (WHERE urgency_level = 'urgent') as urgent_count,
  MAX(received_date) as last_email_date,
  ARRAY_AGG(DISTINCT sender_email) as sender_emails
FROM email_messages
WHERE is_client = true
  AND is_spam = false
  AND received_date >= NOW() - INTERVAL '30 days'
GROUP BY sender_domain
ORDER BY total_emails DESC;

-- View: Daily Email Statistics
CREATE OR REPLACE VIEW v_daily_email_stats AS
SELECT
  DATE(received_date) as email_date,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE is_read = false) as unread,
  COUNT(*) FILTER (WHERE urgency_level = 'urgent') as urgent,
  COUNT(*) FILTER (WHERE urgency_level = 'important') as important,
  COUNT(*) FILTER (WHERE is_spam = true) as spam,
  COUNT(*) FILTER (WHERE is_client = true) as from_clients,
  COUNT(*) FILTER (WHERE is_supplier = true) as from_suppliers,
  ROUND(AVG(ai_confidence), 2) as avg_ai_confidence
FROM email_messages
WHERE received_date >= NOW() - INTERVAL '30 days'
GROUP BY DATE(received_date)
ORDER BY email_date DESC;

-- View: Top Senders (last 30 days)
CREATE OR REPLACE VIEW v_top_email_senders AS
SELECT
  sender_email,
  sender_name,
  sender_domain,
  COUNT(*) as email_count,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count,
  COUNT(*) FILTER (WHERE urgency_level IN ('urgent', 'important')) as priority_count,
  MAX(received_date) as last_email_date,
  is_client,
  is_supplier
FROM email_messages
WHERE received_date >= NOW() - INTERVAL '30 days'
  AND is_spam = false
GROUP BY sender_email, sender_name, sender_domain, is_client, is_supplier
ORDER BY email_count DESC
LIMIT 50;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Extract domain from email
CREATE OR REPLACE FUNCTION extract_email_domain(email_address VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  RETURN LOWER(SPLIT_PART(email_address, '@', 2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: RAG Similarity Search - trova email simili
-- Utile per suggerire risposte basate su email simili già gestite
CREATE OR REPLACE FUNCTION find_similar_emails(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5,
  filter_client boolean DEFAULT NULL,
  filter_supplier boolean DEFAULT NULL,
  filter_category text DEFAULT NULL,
  only_replied boolean DEFAULT false
)
RETURNS TABLE (
  email_id uuid,
  similarity float,
  sender_email varchar,
  subject text,
  ai_summary text,
  ai_draft_reply text,
  urgency_level varchar,
  email_category varchar,
  received_date timestamp
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    em.id,
    1 - (ee.embedding <=> query_embedding) as similarity,
    em.sender_email,
    em.subject,
    em.ai_summary,
    em.ai_draft_reply,
    em.urgency_level,
    em.email_category,
    em.received_date
  FROM email_embeddings ee
  JOIN email_messages em ON ee.email_id = em.id
  WHERE
    em.is_spam = false
    AND (filter_client IS NULL OR ee.is_client = filter_client)
    AND (filter_supplier IS NULL OR ee.is_supplier = filter_supplier)
    AND (filter_category IS NULL OR ee.email_category = filter_category)
    AND (only_replied = false OR ee.was_replied = true)
    AND 1 - (ee.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC,
    ee.reply_quality_score DESC NULLS LAST
  LIMIT match_count;
END;
$$;

-- Function: Calculate urgency score basato su keywords e sentiment
CREATE OR REPLACE FUNCTION calculate_urgency_score(
  subject_text text,
  body_text text,
  sender_domain varchar,
  urgent_keywords jsonb
)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  keyword TEXT;
BEGIN
  -- Check urgent keywords in subject (peso maggiore)
  FOR keyword IN SELECT jsonb_array_elements_text(urgent_keywords)
  LOOP
    IF LOWER(subject_text) LIKE '%' || LOWER(keyword) || '%' THEN
      score := score + 10;
    END IF;
    IF LOWER(body_text) LIKE '%' || LOWER(keyword) || '%' THEN
      score := score + 5;
    END IF;
  END LOOP;

  -- Check known client/supplier domain (peso aggiuntivo)
  -- (implementabile con join su gmail_connections)

  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: gmail_connections updated_at
DROP TRIGGER IF EXISTS trigger_gmail_connections_updated_at ON gmail_connections;
CREATE TRIGGER trigger_gmail_connections_updated_at
  BEFORE UPDATE ON gmail_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: email_messages updated_at
DROP TRIGGER IF EXISTS trigger_email_messages_updated_at ON email_messages;
CREATE TRIGGER trigger_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: email_analytics updated_at
DROP TRIGGER IF EXISTS trigger_email_analytics_updated_at ON email_analytics;
CREATE TRIGGER trigger_email_analytics_updated_at
  BEFORE UPDATE ON email_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-extract sender_domain quando si inserisce email
DROP TRIGGER IF EXISTS trigger_extract_sender_domain ON email_messages;
CREATE OR REPLACE FUNCTION set_sender_domain()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sender_domain := extract_email_domain(NEW.sender_email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_extract_sender_domain
  BEFORE INSERT OR UPDATE OF sender_email ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_sender_domain();

-- ============================================================================
-- SEED DATA (optional - configurazioni di esempio)
-- ============================================================================

-- Esempio connessione Gmail (DA RIMUOVERE IN PRODUCTION - solo per testing)
-- INSERT INTO gmail_connections (user_id, user_name, gmail_address, access_token, refresh_token) VALUES
--   ('demo-user-1', 'Demo User', 'demo@example.com', 'DEMO_ACCESS_TOKEN', 'DEMO_REFRESH_TOKEN')
-- ON CONFLICT (gmail_address) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check tables exist
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('gmail_connections', 'email_messages', 'email_embeddings', 'email_analytics')
ORDER BY table_name;

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('email_messages', 'email_embeddings', 'gmail_connections')
ORDER BY tablename, indexname;

-- ============================================================================
-- CLEANUP QUERIES (opzionali - per manutenzione)
-- ============================================================================

-- Elimina email spam vecchie di 90+ giorni
-- DELETE FROM email_messages WHERE is_spam = true AND received_date < NOW() - INTERVAL '90 days';

-- Elimina embeddings orfani (senza email)
-- DELETE FROM email_embeddings WHERE email_id NOT IN (SELECT id FROM email_messages);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
