/**
 * API Endpoint per eseguire la migrazione della tabella product_reservations
 *
 * Questo endpoint crea la tabella sul database Vercel PostgreSQL.
 * Chiamarlo SOLO UNA VOLTA dopo il deploy su staging.
 *
 * GET /api/admin/migrate-reservations
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    console.log('🚀 Starting migration: Product Reservations Table...');

    // Step 1: Crea tabella product_reservations
    console.log('📋 Creating table: product_reservations...');
    await sql`
      CREATE TABLE IF NOT EXISTS product_reservations (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        order_id INTEGER,
        text_note TEXT,
        audio_url TEXT,
        image_url TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Step 2: Crea indici
    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_customer ON product_reservations(customer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_product ON product_reservations(product_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_order ON product_reservations(order_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_status ON product_reservations(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_created ON product_reservations(created_at DESC)`;

    // Step 3: Crea funzione trigger se non esiste
    const functionExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
      )
    `;

    if (!functionExists.rows[0].exists) {
      await sql`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $$ language 'plpgsql'
      `;
    }

    // Step 4: Crea trigger
    await sql`DROP TRIGGER IF EXISTS update_product_reservations_updated_at ON product_reservations`;
    await sql`
      CREATE TRIGGER update_product_reservations_updated_at
      BEFORE UPDATE ON product_reservations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `;

    // Step 5: Verifica
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'product_reservations'
      )
    `;

    if (!tableCheck.rows[0].exists) {
      throw new Error('Table verification failed');
    }

    const indexCount = await sql`
      SELECT count(*) as count
      FROM pg_indexes
      WHERE tablename = 'product_reservations'
    `;

    const columnCount = await sql`
      SELECT count(*) as count
      FROM information_schema.columns
      WHERE table_name = 'product_reservations'
    `;

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully!',
      details: {
        table: 'product_reservations',
        columns: parseInt(columnCount.rows[0].count),
        indexes: parseInt(indexCount.rows[0].count),
        link: 'customer_id → Avatar cliente Odoo esistente',
      },
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
