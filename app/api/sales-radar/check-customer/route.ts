import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales-radar/check-customer?name=XXX
 *
 * Verifica se un'azienda esiste già nel database Odoo
 * Cerca per nome, telefono, website o indirizzo
 *
 * Query params:
 * - name: string (obbligatorio) - Nome azienda
 * - phone: string (opzionale) - Telefono
 * - website: string (opzionale) - Sito web
 * - address: string (opzionale) - Indirizzo
 *
 * Risposta:
 * - exists: boolean - true se trovato in Odoo
 * - customer: oggetto contatto Odoo (se trovato)
 * - sales_data: dati vendite (fatturato, ordini, ultimo ordine)
 */
export async function GET(request: NextRequest) {
  try {
    // Get odoo_session_id from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    // Get search query parameters
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');
    const website = searchParams.get('website');
    const address = searchParams.get('address');

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Parametro "name" richiesto'
      }, { status: 400 });
    }

    console.log('🔍 [CHECK-CUSTOMER] Ricerca in Odoo:', { name, phone, website, address });

    // Build search domain (OR logic for fuzzy matching)
    // Cerca aziende (is_company=true) che matchano nome, telefono, website o indirizzo
    const searchDomain: any[] = [
      ['is_company', '=', true],
      '|', '|', '|',
      ['name', 'ilike', name],
      ['phone', 'ilike', phone || ''],
      ['website', 'ilike', website || ''],
      ['street', 'ilike', address || '']
    ];

    // Cerca contatti
    const contacts = await client.searchRead(
      'res.partner',
      searchDomain,
      [
        'id', 'name', 'display_name', 'email', 'phone', 'mobile',
        'street', 'zip', 'city', 'country_id', 'state_id',
        'website', 'vat', 'is_company',
        'total_invoiced', // Fatturato totale
        'sale_order_count', // Numero ordini
        'customer_rank' // Rank cliente (quante volte è stato cliente)
      ],
      10, // Limit 10 risultati
      'customer_rank desc' // Ordina per customer_rank (clienti migliori prima)
    );

    if (contacts.length === 0) {
      console.log('❌ [CHECK-CUSTOMER] Cliente NON trovato in Odoo');
      return NextResponse.json({
        success: true,
        exists: false,
        customer: null,
        sales_data: null
      });
    }

    // Prendi il primo match (più probabile)
    const customer = contacts[0];

    console.log(`✅ [CHECK-CUSTOMER] Cliente TROVATO: ${customer.display_name} (ID: ${customer.id})`);

    // Cerca ultimo ordine di vendita
    let lastOrderDate = null;
    let lastOrderAmount = null;

    try {
      const orders = await client.searchRead(
        'sale.order',
        [
          ['partner_id', '=', customer.id],
          ['state', 'in', ['sale', 'done']] // Solo ordini confermati
        ],
        ['id', 'name', 'date_order', 'amount_total'],
        1,
        'date_order desc'
      );

      if (orders.length > 0) {
        lastOrderDate = orders[0].date_order;
        lastOrderAmount = orders[0].amount_total;
      }
    } catch (error) {
      console.warn('⚠️ Errore recupero ultimo ordine:', error);
    }

    // Costruisci oggetto sales_data
    const salesData = {
      total_invoiced: customer.total_invoiced || 0,
      order_count: customer.sale_order_count || 0,
      customer_rank: customer.customer_rank || 0,
      last_order_date: lastOrderDate,
      last_order_amount: lastOrderAmount
    };

    return NextResponse.json({
      success: true,
      exists: true,
      customer: {
        id: customer.id,
        name: customer.name,
        display_name: customer.display_name,
        email: customer.email || '',
        phone: customer.phone || '',
        mobile: customer.mobile || '',
        street: customer.street || '',
        zip: customer.zip || '',
        city: customer.city || '',
        country: customer.country_id ? customer.country_id[1] : '',
        state: customer.state_id ? customer.state_id[1] : '',
        website: customer.website || '',
        vat: customer.vat || '',
        is_company: customer.is_company
      },
      sales_data: salesData
    });

  } catch (error) {
    console.error('❌ [CHECK-CUSTOMER] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante la verifica cliente',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
