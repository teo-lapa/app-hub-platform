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

    // Get product categories
    const domain = search
      ? [['name', 'ilike', search]]
      : [];

    const categoryResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.category',
          method: 'search_read',
          args: [
            domain,
            ['id', 'name', 'parent_id', 'complete_name']
          ],
          kwargs: {
            limit: 100,
            order: 'complete_name ASC'
          }
        },
        id: Math.floor(Math.random() * 1000000000)
      })
    });

    const categoryData = await categoryResponse.json();

    if (categoryData.error) {
      throw new Error(categoryData.error.message || 'Failed to fetch categories');
    }

    return NextResponse.json({
      success: true,
      data: categoryData.result || []
    });

  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
