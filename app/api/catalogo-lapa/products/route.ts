import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

// Cache semplice per pagina
const pageCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minuti

export async function POST(request: NextRequest) {
  try {
    console.log('🛍️ [CATALOGO] API chiamata - caricamento prodotti...');
    const { page = 1, limit = 50, search = '', category = null } = await request.json();

    // ========== OTTIENI SESSION_ID DELL'UTENTE LOGGATO ==========
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [CATALOGO] Utente NON loggato - accesso negato');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per accedere al catalogo' },
        { status: 401 }
      );
    }

    console.log('✅ [CATALOGO] Usando session_id dell\'utente loggato');

    // Crea chiave cache (include anche categoria)
    const cacheKey = `${page}-${limit}-${search}-${category || ''}`;
    const cached = pageCache.get(cacheKey);

    // Controlla cache
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`⚡ Cache HIT: ${cacheKey}`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000)
      });
    }

    console.log(`🛒 Caricamento prodotti pagina ${page}...`);

    // Prepara dominio ricerca
    let domain: any[] = [['sale_ok', '=', true]];

    // Filtro categoria
    if (category) {
      if (category === 'SECCO') {
        // Per SECCO: include sia SECCO che SECCO 2
        domain.push('|',
          ['categ_id', 'ilike', 'SECCO 2'],
          ['categ_id', 'ilike', 'SECCO']
        );
      } else {
        // Per altre categorie: ricerca semplice
        domain.push(['categ_id', 'ilike', category]);
      }
    }

    // Filtro ricerca testuale
    if (search && search.trim()) {
      const s = search.trim();
      domain.push('|', '|', '|',
        ['name', 'ilike', s],
        ['default_code', 'ilike', s],
        ['barcode', '=', s],
        ['categ_id', 'ilike', s]
      );
    }

    // Carica prodotti
    const offset = (page - 1) * limit;

    const productsResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: [
              'id', 'name', 'default_code', 'barcode', 'list_price',
              'categ_id', 'image_256', 'description', 'description_sale',
              'qty_available', 'uom_id'
            ],
            offset,
            limit,
            order: 'name ASC',
            context: { lang: 'it_IT' }
          }
        },
        id: Math.random()
      })
    });

    const productsData = await productsResponse.json();

    if (productsData.error) {
      throw new Error(productsData.error.message || 'Errore caricamento prodotti');
    }

    const products = productsData.result;

    // Conta totale
    const countResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_count',
          args: [domain],
          kwargs: {}
        },
        id: Math.random()
      })
    });

    const countData = await countResponse.json();
    const total = countData.result || products.length;

    console.log(`✅ Caricati ${products.length} prodotti (${total} totali)`);

    const responseData = {
      success: true,
      data: products,
      total,
      page,
      limit
    };

    // Salva in cache
    pageCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    return NextResponse.json({ ...responseData, cached: false });

  } catch (error: any) {
    console.error('💥 Errore generale API:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    }, { status: 500 });
  }
}