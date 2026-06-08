import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, resolveSalesperson, salespersonPartnerDomain } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/silvano/mappa
 * Clienti del venditore con coordinate per la mappa.
 */
export async function GET(request: NextRequest) {
  try {
    const seller = await resolveSalesperson(request);
    const domain = salespersonPartnerDomain(seller.userId);
    domain.push(['parent_id', '=', false]);
    domain.push(['partner_latitude', '!=', 0]);
    domain.push(['partner_longitude', '!=', 0]);

    const partners = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain,
      fields: ['id', 'name', 'street', 'city', 'zip', 'partner_latitude', 'partner_longitude', 'total_invoiced'],
      limit: 500,
    });

    const clienti = partners.map((p: any) => ({
      id: p.id,
      name: p.name,
      address: [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      lat: p.partner_latitude,
      lng: p.partner_longitude,
      totalInvoiced: p.total_invoiced || 0,
    }));

    return NextResponse.json({ success: true, count: clienti.length, clienti });
  } catch (error: any) {
    console.error('💥 [SILVANO/mappa]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
