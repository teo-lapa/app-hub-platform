import { NextResponse } from 'next/server';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

export async function GET() {
  try {
    const response = await fetch(`${ODOO_URL}/web/session/get_session_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {},
        id: 1
      })
    });

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      connected: response.ok,
      url: ODOO_URL,
      db: ODOO_DB
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    return NextResponse.json({
      success: false,
      connected: false,
      error: 'Connection failed'
    });
  }
}