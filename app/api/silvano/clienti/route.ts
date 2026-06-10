import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, resolveSalesperson, salespersonPartnerDomain } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/silvano/clienti?q=
 * Clienti del venditore corrente (res.partner.user_id = salesperson).
 */
export async function GET(request: NextRequest) {
  try {
    const seller = await resolveSalesperson(request);
    const q = (request.nextUrl.searchParams.get('q') || '').trim();

    const domain = salespersonPartnerDomain(seller.userId);
    domain.push(['parent_id', '=', false]); // solo aziende/contatti principali
    if (q) domain.push(['name', 'ilike', q]);

    const FIELDS = [
      'id', 'name', 'email', 'phone', 'mobile', 'street', 'city', 'zip',
      'partner_latitude', 'partner_longitude', 'total_invoiced', 'credit',
    ];

    const partners = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain,
      fields: FIELDS,
      limit: 300,
      order: 'name asc',
    });

    // Clienti privati (persone fisiche) di tutto il DB, solo quando si cerca per nome
    let privati: any[] = [];
    if (q) {
      const seen = new Set(partners.map((p: any) => p.id));
      privati = (await callOdooAsAdmin('res.partner', 'search_read', [], {
        domain: [
          ['customer_rank', '>', 0], ['parent_id', '=', false],
          ['is_company', '=', false], ['name', 'ilike', q],
        ],
        fields: FIELDS,
        limit: 50,
        order: 'name asc',
      })).filter((p: any) => !seen.has(p.id));
    }

    const clienti = [...partners, ...privati.map((p: any) => ({ ...p, _privato: true }))].map((p: any) => ({
      privato: p._privato || false,
      id: p.id,
      name: p.name,
      email: p.email || '',
      phone: p.phone || p.mobile || '',
      street: p.street || '',
      city: p.city || '',
      zip: p.zip || '',
      lat: p.partner_latitude || null,
      lng: p.partner_longitude || null,
      totalInvoiced: p.total_invoiced || 0,
      credit: p.credit || 0,
    }));

    return NextResponse.json({ success: true, seller, count: clienti.length, clienti });
  } catch (error: any) {
    console.error('💥 [SILVANO/clienti]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
