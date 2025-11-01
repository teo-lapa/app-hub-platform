import { sql } from '@vercel/postgres';

async function addOdooAttachmentColumns() {
  try {
    console.log('Adding Odoo attachment ID columns to product_reservations table...');
    
    await sql`
      ALTER TABLE product_reservations
      ADD COLUMN IF NOT EXISTS audio_odoo_attachment_id INTEGER,
      ADD COLUMN IF NOT EXISTS image_odoo_attachment_id INTEGER
    `;
    
    console.log('✅ Columns added successfully!');
    
    // Verify
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_reservations'
      ORDER BY ordinal_position
    `;
    
    console.log('\nCurrent table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addOdooAttachmentColumns();
