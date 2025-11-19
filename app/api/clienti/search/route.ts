import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

// ID TEAM LAPA REALI
const LAPA_TEAM_IDS = [5, 9, 12, 8, 1, 11, 14];

// Mappa utenti autorizzati per team
const USER_TEAM_PERMISSIONS: Record<number, number[] | 'ALL'> = {
  1: 'ALL',    // LapaBot → SUPER ADMIN
  407: [1],    // Domingos Ferreira → I Maestri del Sapore
  14: [12],    // Mihai Nita → I Custodi della Tradizione
  121: [9],    // Alessandro Motta → I Campioni del Gusto
  7: 'ALL',    // Paul Teodorescu → SUPER ADMIN
  8: 'ALL',    // Laura Teodorescu → SUPER ADMIN
  249: 'ALL'   // Gregorio Buccolieri → SUPER ADMIN
};

// Chiama DIRETTAMENTE Odoo usando il session_id dell'utente
async function callOdoo(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {},
  sessionId: string
): Promise<any> {
  try {
    console.log(`📡 Chiamata Odoo: ${model}.${method}`);

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs: kwargs || {}
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error: ${response.status}`, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error('❌ Errore Odoo:', data.error);
      throw new Error(data.error.data?.message || 'Errore Odoo');
    }

    return data.result;
  } catch (error: any) {
    console.error(`❌ Errore chiamata ${model}.${method}:`, error);
    throw error;
  }
}

// Funzione per formattare l'indirizzo
function formatAddress(company: any) {
  const parts = [];
  if (company.street) parts.push(company.street);
  if (company.city) parts.push(company.city);
  if (company.zip) parts.push(company.zip);
  if (company.country_id && company.country_id[1]) parts.push(company.country_id[1]);
  return parts.join(', ');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Query troppo corta (minimo 2 caratteri)'
      }, { status: 400 });
    }

    // Ottieni session_id dell'utente loggato
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ Utente NON loggato');
      return NextResponse.json({
        success: false,
        error: 'Devi fare login per cercare clienti'
      }, { status: 401 });
    }

    console.log(`🔍 Ricerca GLOBALE clienti: "${query}"`);

    // RICERCA GLOBALE: cerca in TUTTO Odoo, non solo team LAPA
    // Permessi gestiti automaticamente da Odoo tramite session_id

    // Domain corretto per trovare:
    // 1. Aziende (is_company=true)
    // 2. Contatti (is_company=false AND type='contact')
    // 3. ESCLUSI indirizzi di consegna/fatturazione (type='delivery'/'invoice')
    // NOTA: NON filtro per customer_rank perché molti clienti hanno customer_rank=0
    const searchDomain = [
      // RIMOSSO: ['customer_rank', '>', 0] → Bloccava 3360+ clienti incluso DGD

      // Logica OR: Aziende O Contatti veri (NO indirizzi)
      '|',
        ['is_company', '=', true],         // Aziende
        '&',                                // AND
          ['is_company', '=', false],      // Contatti
          ['type', '=', 'contact'],        // Ma solo type='contact' (NO delivery/invoice)

      // Ricerca testuale (nome, email, telefono, città)
      '|', '|', '|', '|',
      ['name', 'ilike', query],
      ['email', 'ilike', query],
      ['phone', 'ilike', query],
      ['mobile', 'ilike', query],
      ['city', 'ilike', query]
    ];

    const companies = await callOdoo(
      'res.partner',
      'search_read',
      [searchDomain],
      {
        fields: [
          'id',
          'name',
          'email',
          'phone',
          'mobile',
          'street',
          'city',
          'zip',
          'country_id',
          'user_id',
          'team_id',
          'child_ids',
          'type',           // Per vedere se è contact/delivery/invoice
          'is_company',     // Per vedere se è azienda o contatto
          'parent_id',      // Per vedere se è figlio di un'azienda
          'property_product_pricelist'  // Lista prezzi (livello cliente)
        ],
        limit: 50, // Massimo 50 risultati
        order: 'name asc'
      },
      sessionId
    );

    console.log(`✅ Trovati ${companies.length} clienti per query "${query}"`);

    // Formatta risultati
    const results = companies.map((company: any) => ({
      id: company.id,
      name: company.name,
      email: company.email || '',
      phone: company.phone || company.mobile || '',
      address: formatAddress(company),
      city: company.city || '',
      zip: company.zip || '',
      salesperson: company.user_id ? company.user_id[1] : 'Non assegnato',
      teamId: company.team_id ? company.team_id[0] : null,
      teamName: company.team_id ? company.team_id[1] : 'Nessun team',
      hasChildren: (company.child_ids || []).length > 0,
      isCompany: company.is_company,
      type: company.type,
      parentId: company.parent_id ? company.parent_id[0] : null,
      pricelist: company.property_product_pricelist ? company.property_product_pricelist[1] : null,
      pricelistId: company.property_product_pricelist ? company.property_product_pricelist[0] : null
    }));

    return NextResponse.json({
      success: true,
      query: query,
      count: results.length,
      results: results
    });

  } catch (error: any) {
    console.error('❌ Errore ricerca clienti:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la ricerca'
      },
      { status: 500 }
    );
  }
}
