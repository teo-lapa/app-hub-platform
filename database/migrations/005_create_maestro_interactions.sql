-- ============================================================================
-- Migration 005: Create maestro_interactions table
-- ============================================================================
-- This table is required for tracking sales rep interactions with customers
-- Referenced in customer detail page but was missing from initial setup
-- ============================================================================

-- Create maestro_interactions table
CREATE TABLE IF NOT EXISTS maestro_interactions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  customer_avatar_id UUID NOT NULL REFERENCES customer_avatars(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES maestro_recommendations(id) ON DELETE SET NULL,

  -- Salesperson Info
  salesperson_id INTEGER NOT NULL,
  salesperson_name VARCHAR(255) NOT NULL,

  -- Interaction Data
  interaction_type VARCHAR(20) NOT NULL CHECK (
    interaction_type IN ('visit', 'call', 'email', 'whatsapp', 'other')
  ),
  interaction_date TIMESTAMP DEFAULT NOW(),

  outcome VARCHAR(30) NOT NULL CHECK (
    outcome IN ('successful', 'unsuccessful', 'neutral', 'follow_up_needed')
  ),
  notes TEXT,

  -- Order Info
  order_placed BOOLEAN DEFAULT false,
  order_value NUMERIC(12, 2),
  samples_given JSONB, -- Array of {product_id, product_name, quantity}

  next_follow_up_date DATE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_interactions_customer ON maestro_interactions(customer_avatar_id);
CREATE INDEX IF NOT EXISTS idx_interactions_salesperson ON maestro_interactions(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON maestro_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_recommendation ON maestro_interactions(recommendation_id) WHERE recommendation_id IS NOT NULL;

-- Create trigger for auto-update updated_at
DROP TRIGGER IF EXISTS trigger_interactions_updated_at ON maestro_interactions;
CREATE TRIGGER trigger_interactions_updated_at
  BEFORE UPDATE ON maestro_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Insert sample interactions for testing (OPTIONAL - uncomment to use)
-- ============================================================================

/*
-- Get customer UUIDs for NAPULE customers
DO $$
DECLARE
  customer_995_uuid UUID;
  customer_999_uuid UUID;
BEGIN
  -- Get UUIDs
  SELECT id INTO customer_995_uuid FROM customer_avatars WHERE odoo_partner_id = 995;
  SELECT id INTO customer_999_uuid FROM customer_avatars WHERE odoo_partner_id = 999;

  -- Sample interactions for Customer 995 (NAPULE AG ERLENBACH - high churn risk)
  IF customer_995_uuid IS NOT NULL THEN
    INSERT INTO maestro_interactions (
      customer_avatar_id,
      salesperson_id,
      salesperson_name,
      interaction_type,
      interaction_date,
      outcome,
      notes,
      order_placed,
      order_value,
      next_follow_up_date
    ) VALUES
    (
      customer_995_uuid,
      14,
      'Mihai Nita',
      'call',
      NOW() - INTERVAL '10 days',
      'unsuccessful',
      'Tentato contatto telefonico, nessuna risposta. Cliente non ordinava da 143 giorni.',
      false,
      NULL,
      CURRENT_DATE + INTERVAL '3 days'
    ),
    (
      customer_995_uuid,
      14,
      'Mihai Nita',
      'email',
      NOW() - INTERVAL '5 days',
      'neutral',
      'Inviata email con offerta speciale su Fiordilatte e Farina (top products). In attesa di risposta.',
      false,
      NULL,
      CURRENT_DATE + INTERVAL '7 days'
    ),
    (
      customer_995_uuid,
      14,
      'Mihai Nita',
      'visit',
      NOW() - INTERVAL '2 days',
      'follow_up_needed',
      'Visita in sede. Parlato con responsabile acquisti. Hanno avuto problemi di budget. Interessati a riprendere ordini mese prossimo. Lasciato catalogo aggiornato.',
      false,
      NULL,
      CURRENT_DATE + INTERVAL '14 days'
    );

    RAISE NOTICE 'Inserted 3 sample interactions for Customer 995 (NAPULE AG ERLENBACH)';
  END IF;

  -- Sample interactions for Customer 999 (NAPULE AG ZOLLIKON - active customer)
  IF customer_999_uuid IS NOT NULL THEN
    INSERT INTO maestro_interactions (
      customer_avatar_id,
      salesperson_id,
      salesperson_name,
      interaction_type,
      interaction_date,
      outcome,
      notes,
      order_placed,
      order_value,
      samples_given,
      next_follow_up_date
    ) VALUES
    (
      customer_999_uuid,
      14,
      'Mihai Nita',
      'visit',
      NOW() - INTERVAL '15 days',
      'successful',
      'Visita programmata. Cliente molto soddisfatto della qualità Farina 00 Verace. Ordinato 50kg.',
      true,
      1250.00,
      NULL,
      CURRENT_DATE + INTERVAL '7 days'
    ),
    (
      customer_999_uuid,
      14,
      'Mihai Nita',
      'whatsapp',
      NOW() - INTERVAL '7 days',
      'successful',
      'Check-in post consegna. Tutto OK, farina perfetta per la pizza. Cliente felice.',
      false,
      NULL,
      NULL,
      CURRENT_DATE + INTERVAL '10 days'
    ),
    (
      customer_999_uuid,
      14,
      'Mihai Nita',
      'call',
      NOW() - INTERVAL '1 day',
      'successful',
      'Chiamata per proporre carta asciugamani in promozione. Interessato, farà ordine nei prossimi giorni.',
      false,
      NULL,
      '[{"product_id": 456, "product_name": "Carta Asciugamani Mini", "quantity": 2}]'::jsonb,
      CURRENT_DATE + INTERVAL '3 days'
    );

    RAISE NOTICE 'Inserted 3 sample interactions for Customer 999 (NAPULE AG ZOLLIKON)';
  END IF;

END $$;
*/

-- ============================================================================
-- Verification query
-- ============================================================================

-- Check table was created
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'maestro_interactions'
) as table_exists;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'maestro_interactions'
ORDER BY indexname;

-- Count records (should be 0 unless sample data was inserted)
SELECT COUNT(*) as total_interactions FROM maestro_interactions;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
