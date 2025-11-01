import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Adding Odoo attachment ID columns...');
    
    await sql`
      ALTER TABLE product_reservations
      ADD COLUMN IF NOT EXISTS audio_odoo_attachment_id INTEGER,
      ADD COLUMN IF NOT EXISTS image_odoo_attachment_id INTEGER
    `;
    
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_reservations'
      ORDER BY ordinal_position
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Colonne aggiunte con successo',
      columns: result.rows
    });
  } catch (error: any) {
    console.error('Error adding columns:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
