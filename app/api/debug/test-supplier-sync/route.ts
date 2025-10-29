import { NextResponse } from 'next/server';
import { syncSuppliersFromOdoo } from '@/lib/suppliers/sync-suppliers-odoo';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to test supplier sync
 */
export async function GET() {
  try {
    console.log('🔍 [DEBUG] Testing supplier sync...');

    const result = await syncSuppliersFromOdoo({ dryRun: false });

    return NextResponse.json({
      success: true,
      result,
      env: {
        hasOdooUrl: !!process.env.ODOO_URL,
        hasOdooDb: !!process.env.ODOO_DB,
        hasOdooUsername: !!process.env.ODOO_USERNAME,
        hasOdooPassword: !!process.env.ODOO_PASSWORD,
      }
    });
  } catch (error: any) {
    console.error('❌ [DEBUG] Error:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      env: {
        hasOdooUrl: !!process.env.ODOO_URL,
        hasOdooDb: !!process.env.ODOO_DB,
        hasOdooUsername: !!process.env.ODOO_USERNAME,
        hasOdooPassword: !!process.env.ODOO_PASSWORD,
      }
    }, { status: 500 });
  }
}
