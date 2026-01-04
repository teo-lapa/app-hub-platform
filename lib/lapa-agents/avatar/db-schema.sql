-- ============================================================================
-- LAPA AI - Avatar System Database Schema
-- ============================================================================
--
-- Sistema Avatar a 2 livelli per personalizzare la comunicazione AI:
-- - company_avatars: Dati aziendali (prodotti, ordini, info locale)
-- - contact_avatars: Dati persona (comunicazione, personalità, note)
--
-- Database: Vercel Postgres (Neon)
-- ============================================================================

-- ============================================================================
-- TABLE: company_avatars
-- ============================================================================
-- Avatar dell'azienda/locale (ristorante, pizzeria, fornitore, etc.)

CREATE TABLE IF NOT EXISTS company_avatars (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Odoo Integration
  odoo_partner_id INTEGER UNIQUE NOT NULL,
  partner_type VARCHAR(20) NOT NULL CHECK (partner_type IN ('cliente', 'fornitore')),

  -- Dati Anagrafici
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) CHECK (business_type IN (
    'ristorante', 'pizzeria', 'ristorante_pizzeria', 'bar_gelateria',
    'pasticceria', 'hotel', 'negozio_alimentare', 'catering', 'food_truck', 'altro'
  )),
  industry VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  country VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(500),
  vat VARCHAR(50),

  -- Categorizzazione Odoo
  odoo_tags INTEGER[],             -- category_id array da Odoo
  customer_rank INTEGER DEFAULT 0,
  supplier_rank INTEGER DEFAULT 0,

  -- Arricchimento Web (JSONB per flessibilità)
  web_enrichment JSONB DEFAULT '{}'::jsonb,
  /*
    Struttura web_enrichment:
    {
      "website_url": "...",
      "menu_items": ["Pizza Margherita", "Tiramisù"],
      "cuisine_style": "Napoletana",
      "price_range": "€€",
      "specialties": ["Pizza con forno a legna"],
      "google_rating": 4.5,
      "google_reviews_count": 234,
      "instagram_handle": "@casacosi",
      "instagram_followers": 2500,
      "last_enrichment_date": "2026-01-04"
    }
  */

  -- Pattern Acquisti (JSONB)
  purchase_patterns JSONB DEFAULT '{}'::jsonb,
  /*
    Struttura purchase_patterns:
    {
      "order_frequency_days": 7,
      "preferred_delivery_days": ["martedì", "venerdì"],
      "top_products": [{"product_id": 123, "product_name": "Mozzarella", "quantity_avg": 10}],
      "avg_order_value": 850,
      "total_revenue": 45000,
      "total_orders": 52
    }
  */

  -- Note Aziendali
  company_notes TEXT[],

  -- Status & Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sync_odoo TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_avatars_odoo_id ON company_avatars(odoo_partner_id);
CREATE INDEX IF NOT EXISTS idx_company_avatars_partner_type ON company_avatars(partner_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_company_avatars_business_type ON company_avatars(business_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_company_avatars_city ON company_avatars(city) WHERE is_active = true;

-- ============================================================================
-- TABLE: contact_avatars
-- ============================================================================
-- Avatar del contatto/persona (chef, titolare, responsabile ordini, etc.)

CREATE TABLE IF NOT EXISTS contact_avatars (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  odoo_partner_id INTEGER NOT NULL,
  company_avatar_id UUID NOT NULL REFERENCES company_avatars(id) ON DELETE CASCADE,

  -- Dati Anagrafici
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) CHECK (role IN (
    'titolare', 'direttore', 'chef', 'pizzaiolo', 'pasticcere',
    'responsabile_ordini', 'responsabile_cucina', 'amministrazione',
    'commercialista', 'cameriere', 'altro'
  )),
  role_description VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),

  -- ========================================
  -- COMUNICAZIONE (4 Stili - Merenda Semplificato)
  -- ========================================
  communication_style VARCHAR(20) NOT NULL DEFAULT 'relazionale' CHECK (
    communication_style IN ('diretto', 'analitico', 'relazionale', 'pratico')
  ),
  personality_category VARCHAR(20) DEFAULT 'gregario' CHECK (
    personality_category IN ('dominante', 'gregario')
  ),
  preferred_tone VARCHAR(20) DEFAULT 'informale' CHECK (
    preferred_tone IN ('formale', 'informale', 'amichevole')
  ),
  uses_emoji BOOLEAN DEFAULT true,
  preferred_language VARCHAR(5) DEFAULT 'it' CHECK (
    preferred_language IN ('it', 'de', 'fr', 'en')
  ),
  message_length VARCHAR(20) DEFAULT 'medio' CHECK (
    message_length IN ('corto', 'medio', 'dettagliato')
  ),

  -- Keywords e Approccio (JSONB)
  communication_guide JSONB DEFAULT '{}'::jsonb,
  /*
    Struttura communication_guide:
    {
      "keywords_to_use": ["subito", "risultato"],
      "keywords_to_avoid": ["forse", "vedremo"],
      "sales_approach": "Vai dritto al punto, proponi soluzioni",
      "greeting_example": "Ciao! Ho quello che ti serve:"
    }
  */

  -- ========================================
  -- INFO PERSONALI
  -- ========================================
  birthday VARCHAR(5),             -- Formato MM-DD (es: "03-15")
  important_dates JSONB DEFAULT '[]'::jsonb,
  /*
    Struttura important_dates:
    [
      {"date": "06-20", "occasion": "Anniversario apertura", "year": 2020}
    ]
  */
  personal_notes TEXT[],           -- Es: ["Tifoso del Napoli", "Ha un figlio"]

  -- ========================================
  -- RELAZIONE
  -- ========================================
  relationship_notes TEXT,
  decision_maker BOOLEAN DEFAULT false,
  best_contact_time VARCHAR(50),   -- Es: "mattina presto"

  -- ========================================
  -- FOLLOW-UP
  -- ========================================
  followups JSONB DEFAULT '[]'::jsonb,
  /*
    Struttura followups:
    [
      {
        "id": "uuid",
        "action": "Chiedere come è andata la degustazione",
        "created_at": "2026-01-04",
        "due_date": "2026-01-10",
        "done": false
      }
    ]
  */

  -- ========================================
  -- CONVERSAZIONI
  -- ========================================
  conversation_summary TEXT,
  last_interaction TIMESTAMP,
  total_interactions INTEGER DEFAULT 0,

  -- Status & Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint
  CONSTRAINT unique_odoo_contact UNIQUE (odoo_partner_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_avatars_company ON contact_avatars(company_avatar_id);
CREATE INDEX IF NOT EXISTS idx_contact_avatars_odoo_id ON contact_avatars(odoo_partner_id);
CREATE INDEX IF NOT EXISTS idx_contact_avatars_style ON contact_avatars(communication_style) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_contact_avatars_role ON contact_avatars(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_contact_avatars_decision_maker ON contact_avatars(decision_maker) WHERE is_active = true AND decision_maker = true;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_avatar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_avatar_updated ON company_avatars;
CREATE TRIGGER trigger_company_avatar_updated
  BEFORE UPDATE ON company_avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_avatar_timestamp();

DROP TRIGGER IF EXISTS trigger_contact_avatar_updated ON contact_avatars;
CREATE TRIGGER trigger_contact_avatar_updated
  BEFORE UPDATE ON contact_avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_avatar_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Vista: Contatti con stile comunicazione e azienda
CREATE OR REPLACE VIEW v_contact_with_company AS
SELECT
  c.id AS contact_id,
  c.name AS contact_name,
  c.role,
  c.communication_style,
  c.personality_category,
  c.preferred_tone,
  c.decision_maker,
  c.birthday,
  comp.id AS company_id,
  comp.name AS company_name,
  comp.business_type,
  comp.city,
  comp.partner_type
FROM contact_avatars c
JOIN company_avatars comp ON c.company_avatar_id = comp.id
WHERE c.is_active = true AND comp.is_active = true;

-- Vista: Clienti per stile comunicazione
CREATE OR REPLACE VIEW v_contacts_by_style AS
SELECT
  communication_style,
  personality_category,
  COUNT(*) AS total_contacts,
  COUNT(CASE WHEN decision_maker THEN 1 END) AS decision_makers
FROM contact_avatars
WHERE is_active = true
GROUP BY communication_style, personality_category
ORDER BY total_contacts DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE company_avatars IS 'Avatar aziendali - dati del locale/business (ristorante, pizzeria, fornitore)';
COMMENT ON TABLE contact_avatars IS 'Avatar contatti - dati della persona e stile comunicazione';

COMMENT ON COLUMN contact_avatars.communication_style IS 'Stile comunicazione: diretto (vai al punto), analitico (dati), relazionale (chiacchiere), pratico (zero pensieri)';
COMMENT ON COLUMN contact_avatars.personality_category IS 'Categoria Merenda: dominante (vuole emergere) o gregario (vuole appartenere)';

-- ============================================================================
-- RIEPILOGO
-- ============================================================================
/*
  STRUTTURA AVATAR:

  company_avatars (Azienda)
  ├── Dati Odoo (nome, tipo, città, contatti)
  ├── web_enrichment (menu, recensioni, social)
  ├── purchase_patterns (prodotti, frequenza, fatturato)
  └── company_notes

  contact_avatars (Persona)
  ├── Dati Odoo (nome, ruolo, email, tel)
  ├── 4 STILI COMUNICAZIONE:
  │   ├── diretto (Dominante - vai al punto)
  │   ├── analitico (Dominante - dammi dati)
  │   ├── relazionale (Gregario - chiacchieriamo)
  │   └── pratico (Gregario - fammi facile)
  ├── Info personali (compleanno, note)
  ├── followups (azioni da fare)
  └── conversation_summary

*/
