import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const odooUrl = process.env.ODOO_URL;
    const odooDb = process.env.ODOO_DB;

    // Authenticate
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: 'paul@lapa.ch',
          password: 'lapa201180'
        },
        id: 1
      })
    });

    const authData = await authResponse.json();
    if (authData.error) {
      throw new Error('Odoo authentication failed');
    }

    const cookies = authResponse.headers.get('set-cookie');

    // Search for suppliers (partners with is_company=true and supplier_rank>0)
    const domain = search
      ? [['is_company', '=', true], ['supplier_rank', '>', 0], '|', ['name', 'ilike', search], ['ref', 'ilike', search]]
      : [['is_company', '=', true], ['supplier_rank', '>', 0]];

    const supplierResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [
            domain,
            ['id', 'name', 'ref', 'vat', 'email', 'phone']
          ],
          kwargs: {
            limit: 50,
            order: 'name ASC'
          }
        },
        id: Math.floor(Math.random() * 1000000000)
      })
    });

    const supplierData = await supplierResponse.json();

    if (supplierData.error) {
      throw new Error(supplierData.error.message || 'Failed to fetch suppliers');
    }

    return NextResponse.json({
      success: true,
      data: supplierData.result || []
    });

  } catch (error: any) {
    console.error('❌ Error fetching suppliers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
