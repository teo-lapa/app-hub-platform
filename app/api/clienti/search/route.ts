import { NextRequest, NextResponse } from 'next/server';

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

// Usa l'API esistente /api/odoo/rpc per chiamare Odoo
async function callOdoo(model: string, method: string, args: any[] = [], kwargs: any = {}) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        method,
        args,
        kwargs
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'RPC Error');
    }

    return data.result;
  } catch (error: any) {
    console.error(`❌ Errore chiamata RPC ${model}.${method}:`, error);
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
    const userId = parseInt(searchParams.get('userId') || '7'); // Default Paul

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Query troppo corta (minimo 2 caratteri)'
      }, { status: 400 });
    }

    console.log(`🔍 Ricerca clienti: "${query}" per utente ${userId}`);

    // Verifica permessi utente
    const userPermissions = USER_TEAM_PERMISSIONS[userId];
    if (!userPermissions) {
      return NextResponse.json({
        success: false,
        error: 'Utente non autorizzato'
      }, { status: 403 });
    }

    // Determina i team accessibili
    let allowedTeamIds = LAPA_TEAM_IDS;
    if (userPermissions !== 'ALL') {
      allowedTeamIds = LAPA_TEAM_IDS.filter(id => userPermissions.includes(id));
    }

    console.log(`🔐 Team accessibili per utente ${userId}:`, allowedTeamIds);

    // Cerca clienti in Odoo
    // Cerca per: nome, email, telefono, città, indirizzo
    const searchDomain = [
      ['team_id', 'in', allowedTeamIds],
      ['is_company', '=', true],
      ['customer_rank', '>', 0],
      ['parent_id', '=', false],
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
          'child_ids'
        ],
        limit: 50, // Massimo 50 risultati
        order: 'name asc'
      }
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
      hasChildren: (company.child_ids || []).length > 0
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
