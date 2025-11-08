-- Migrazione: Tabella per assegnazioni prodotti pre-ordine a clienti
-- Data: 2025-01-04

CREATE TABLE IF NOT EXISTS preorder_customer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT unique_product_customer UNIQUE (product_id, customer_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_preorder_product_id ON preorder_customer_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_preorder_customer_id ON preorder_customer_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_preorder_created_at ON preorder_customer_assignments(created_at);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_preorder_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_preorder_assignments_updated_at
  BEFORE UPDATE ON preorder_customer_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_preorder_assignments_updated_at();

-- Commenti
COMMENT ON TABLE preorder_customer_assignments IS 'Assegnazioni di prodotti pre-ordine a clienti specifici';
COMMENT ON COLUMN preorder_customer_assignments.product_id IS 'ID prodotto Odoo';
COMMENT ON COLUMN preorder_customer_assignments.customer_id IS 'ID cliente Odoo (res.partner)';
COMMENT ON COLUMN preorder_customer_assignments.quantity IS 'Quantità richiesta dal cliente';
COMMENT ON COLUMN preorder_customer_assignments.notes IS 'Note opzionali sull''assegnazione';
