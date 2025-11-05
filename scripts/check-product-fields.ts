/**
 * Check available fields on product.product in Odoo
 */

import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

async function checkProductFields() {
  try {
    // You need to get a session_id from cookies
    const sessionId = process.env.ODOO_SESSION_ID || '';

    if (!sessionId) {
      console.log('❌ Set ODOO_SESSION_ID in .env.local first');
      console.log('Get it from browser cookies after login');
      return;
    }

    const rpc = createOdooRPCClient(sessionId);

    // Get one product with all fields
    console.log('🔍 Fetching product fields from Odoo...\n');

    const products = await rpc.searchRead(
      'product.product',
      [['type', '=', 'product']],
      [], // Empty = all fields
      1   // Just one product
    );

    if (products.length > 0) {
      const product = products[0];
      console.log('📦 Available fields on product.product:\n');

      const fields = Object.keys(product).sort();

      // Look for pre-order related fields
      const preOrderFields = fields.filter(f =>
        f.includes('order') ||
        f.includes('purchase') ||
        f.includes('route') ||
        f.includes('procure') ||
        f.includes('to_order')
      );

      console.log('🎯 Pre-order related fields:');
      preOrderFields.forEach(f => {
        console.log(`  - ${f}: ${JSON.stringify(product[f])}`);
      });

      console.log('\n📋 All fields:');
      fields.forEach(f => {
        const value = product[f];
        const preview = typeof value === 'string' && value.length > 50
          ? value.substring(0, 50) + '...'
          : JSON.stringify(value);
        console.log(`  - ${f}: ${preview}`);
      });
    } else {
      console.log('❌ No products found');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkProductFields();
