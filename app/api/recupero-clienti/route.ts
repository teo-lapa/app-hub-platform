import { NextResponse } from 'next/server';

// Le note vengono salvate in localStorage lato client.
// Questa API serve solo per future integrazioni (es. Odoo, Vanessa).
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Recupero clienti API attiva' });
}
