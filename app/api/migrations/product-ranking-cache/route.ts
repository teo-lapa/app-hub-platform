import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * GET /api/migrations/product-ranking-cache
 *
 * Crea la tabella product_ranking_cache per ordinamento intelligente prodotti
 * NOTA: Questo endpoint dovrebbe essere protetto o rimosso dopo l'esecuzione
 */
export async function GET() {
  try {
    console.log('🚀 [MIGRATION] Starting product_ranking_cache table creation...');

    // Create main table
    await sql`
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
        purchase_frequency INTEGER DEFAULT 0,
        total_amount_purchased DECIMAL(10, 2) DEFAULT 0,

        -- Statistiche globali LAPA (tutti i clienti, ultimi 12 mesi)
        global_qty_sold DECIMAL(10, 2) DEFAULT 0,
        global_orders_count INTEGER DEFAULT 0,

        -- Metadata
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (odoo_partner_id, odoo_product_id)
      )
    `;

    console.log('✅ [MIGRATION] Table created successfully');

    // Create index for customer score
    await sql`
      CREATE INDEX IF NOT EXISTS idx_partner_customer_score
        ON product_ranking_cache(odoo_partner_id, customer_score DESC)
    `;

    console.log('✅ [MIGRATION] Index idx_partner_customer_score created');

    // Create index for global score
    await sql`
      CREATE INDEX IF NOT EXISTS idx_partner_global_score
        ON product_ranking_cache(odoo_partner_id, global_score DESC)
    `;

    console.log('✅ [MIGRATION] Index idx_partner_global_score created');

    // Create index for updated_at
    await sql`
      CREATE INDEX IF NOT EXISTS idx_updated_at
        ON product_ranking_cache(updated_at DESC)
    `;

    console.log('✅ [MIGRATION] Index idx_updated_at created');

    // Verify table exists
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'product_ranking_cache'
    `;

    if (result.rows.length === 0) {
      throw new Error('Table creation verification failed');
    }

    console.log('✅ [MIGRATION] Table verification successful');

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      details: {
        table: 'product_ranking_cache',
        indexes: [
          'idx_partner_customer_score',
          'idx_partner_global_score',
          'idx_updated_at'
        ],
        nextSteps: [
          'Create cron job to populate cache',
          'Modify products API to use cache for sorting'
        ]
      }
    });

  } catch (error: any) {
    console.error('❌ [MIGRATION] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
