import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    // Get all UoM (Unit of Measure)
    const uomResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'uom.uom',
          method: 'search_read',
          args: [
            [], // no domain = all records
            ['id', 'name', 'category_id', 'uom_type', 'factor', 'rounding']
          ],
          kwargs: {
            limit: 200
          }
        },
        id: Math.floor(Math.random() * 1000000000)
      })
    });

    const uomData = await uomResponse.json();

    if (uomData.error) {
      throw new Error(uomData.error.message || 'Failed to fetch UoM');
    }

    return NextResponse.json({
      success: true,
      data: uomData.result || []
    });

  } catch (error: any) {
    console.error('❌ Error fetching UoM:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
