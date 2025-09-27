import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    odoo_url: process.env.ODOO_URL ? 'SET' : 'NOT_SET',
    odoo_db: process.env.ODOO_DB ? 'SET' : 'NOT_SET',
    odoo_api_key: process.env.ODOO_API_KEY ? 'SET' : 'NOT_SET',
    jwt_secret: process.env.JWT_SECRET ? 'SET' : 'NOT_SET',
    node_env: process.env.NODE_ENV,
    vercel: process.env.VERCEL ? 'YES' : 'NO'
  });
}