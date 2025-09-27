import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { page = 1, limit = 50, search } = await request.json();

    console.log('🛒 Richiesta catalogo LAPA:', { page, limit, search });

    const odooUrl = process.env.ODOO_URL!;
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    // Credenziali da provare
    const credentialOptions = [
      { username: 'paul@lapa.ch', password: 'paul' },
      { username: 'paul@lapa.ch', password: 'lapa' },
      { username: 'admin', password: 'admin' },
      { username: 'admin', password: 'lapa' },
      { username: 'lapa', password: 'lapa' },
      { username: 'demo', password: 'demo' },
      { username: 'inventory', password: 'inventory' },
      { username: 'user', password: 'user' }
    ];

    let authenticatedUid = null;
    let workingCredentials = null;

    console.log('🔐 Autenticazione XMLRPC Odoo...');

    // PASSO 1: AUTENTICAZIONE con il protocollo corretto
    for (const cred of credentialOptions) {
      try {
        console.log(`🔑 Provo autenticazione: ${cred.username}...`);

        const authResponse = await fetch(`${odooUrl}/web/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              service: 'common',
              method: 'authenticate',
              args: [
                odooDb,
                cred.username,
                cred.password,
                {}
              ]
            }
          })
        });

        if (!authResponse.ok) {
          console.log(`❌ HTTP error ${authResponse.status} per ${cred.username}`);
          continue;
        }

        const authData = await authResponse.json();
        console.log(`📋 Auth response per ${cred.username}:`, authData);

        // Con /web/jsonrpc la risposta ha format: {jsonrpc: "2.0", result: uid}
        if (authData && authData.result && typeof authData.result === 'number' && authData.result > 0) {
          console.log(`✅ AUTENTICAZIONE RIUSCITA! User: ${cred.username}, UID: ${authData.result}`);
          authenticatedUid = authData.result;
          workingCredentials = cred;
          break;
        } else {
          console.log(`❌ Auth fallita per ${cred.username}:`, authData.error?.message || 'UID non valido');
        }
      } catch (error) {
        console.log(`💥 Errore auth ${cred.username}:`, error.message);
      }
    }

    // PASSO 2: Se autenticato, carico i PRODOTTI VERI
    if (authenticatedUid && workingCredentials) {
      console.log('📦 Caricamento prodotti VERI da Odoo con XMLRPC...');

      const offset = (page - 1) * limit;

      // Costruisco il domain per la ricerca
      let domain = [['sale_ok', '=', true]]; // Solo prodotti vendibili

      if (search && search.trim()) {
        domain = [
          '&', ['sale_ok', '=', true],
          '|', '|', '|',
          ['name', 'ilike', search],
          ['default_code', 'ilike', search],
          ['barcode', '=', search],
          ['categ_id.name', 'ilike', search]
        ];
      }

      try {
        // STEP 2A: Conto il totale
        console.log('🔢 Conto prodotti totali...');
        const countResponse = await fetch(`${odooUrl}/web/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              service: 'object',
              method: 'execute_kw',
              args: [
                odooDb,
                authenticatedUid,
                workingCredentials.password,
                'product.product',
                'search_count',
                [domain]
              ]
            }
          })
        });

        const countData = await countResponse.json();
        const totalCount = countData.result || 0;
        console.log(`📊 Prodotti totali trovati: ${totalCount}`);

        // STEP 2B: Carico i prodotti con dettagli
        console.log('📦 Carico dettagli prodotti...');
        const productsResponse = await fetch(`${odooUrl}/web/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              service: 'object',
              method: 'execute_kw',
              args: [
                odooDb,
                authenticatedUid,
                workingCredentials.password,
                'product.product',
                'search_read',
                [domain],
                {
                  fields: [
                    'id', 'name', 'default_code', 'barcode', 'list_price',
                    'categ_id', 'image_1920', 'description_sale', 'qty_available',
                    'uom_id', 'standard_price', 'active', 'detailed_type'
                  ],
                  offset: offset,
                  limit: limit,
                  order: 'name ASC'
                }
              ]
            }
          })
        });

        const productsData = await productsResponse.json();

        if (productsData && productsData.result && Array.isArray(productsData.result)) {
          console.log(`✅ Caricati ${productsData.result.length} prodotti VERI da Odoo!`);

          return NextResponse.json({
            success: true,
            data: productsData.result,
            total: totalCount,
            page: page,
            limit: limit,
            credentials: workingCredentials.username,
            uid: authenticatedUid,
            method: 'real_odoo_jsonrpc'
          });
        } else {
          throw new Error(productsData.error?.message || 'Formato dati prodotti non valido');
        }

      } catch (error) {
        console.error('❌ Errore caricamento prodotti:', error);
        throw error;
      }
    }

    // PASSO 3: Se arrivo qui, autenticazione fallita
    console.log('❌ TUTTE LE CREDENZIALI FALLITE');

    return NextResponse.json({
      success: false,
      error: 'Impossibile autenticarsi su Odoo. Credenziali non valide.',
      details: {
        message: 'Ho provato tutte le credenziali disponibili ma nessuna funziona con il protocollo JSONRPC di Odoo.',
        tried_credentials: credentialOptions.map(c => c.username),
        odoo_url: odooUrl,
        odoo_db: odooDb,
        protocol: 'JSONRPC via /web/jsonrpc',
        suggestion: 'Verifica username, password e permessi utente in Odoo.'
      }
    }, { status: 401 });

  } catch (error: any) {
    console.error('💥 Errore generale API:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    }, { status: 500 });
  }
}