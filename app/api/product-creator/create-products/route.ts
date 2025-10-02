import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ProductData {
  nome_completo: string;
  descrizione_breve?: string;
  descrizione_dettagliata?: string;
  categoria?: string;
  sottocategoria?: string;
  marca?: string;
  codice_ean?: string;
  prezzo_acquisto?: number;
  prezzo_vendita_suggerito?: number;
  unita_misura?: string;
  peso?: number;
  caratteristiche?: string[];
  tags?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { products } = await request.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessun prodotto fornito' },
        { status: 400 }
      );
    }

    console.log(`📦 Creating ${products.length} products in Odoo...`);

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    // STEP 1: Authenticate with Odoo
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: 'paul@lapa.ch',
          password: 'lapa201180'
        },
        id: 1
      })
    });

    const authData = await authResponse.json();

    if (authData.error) {
      console.error('❌ Odoo auth error:', authData.error);
      return NextResponse.json({ success: false, error: 'Errore autenticazione Odoo' }, { status: 401 });
    }

    const cookies = authResponse.headers.get('set-cookie');

    // STEP 2: Create products one by one
    const results = [];
    const errors = [];

    for (const product of products as ProductData[]) {
      try {
        console.log(`📝 Creating product: ${product.nome_completo}`);

        // Prepare product data for Odoo
        const odooProduct: any = {
          name: product.nome_completo,
          type: 'product', // Prodotto immagazzinabile
          categ_id: 1, // Default category, TODO: map from product.categoria
          sale_ok: true,
          purchase_ok: true,
        };

        // Add optional fields
        if (product.descrizione_dettagliata) {
          odooProduct.description = product.descrizione_dettagliata;
        }

        if (product.descrizione_breve) {
          odooProduct.description_sale = product.descrizione_breve;
        }

        if (product.codice_ean) {
          odooProduct.barcode = product.codice_ean;
          odooProduct.default_code = product.codice_ean; // Internal reference
        }

        if (product.prezzo_vendita_suggerito) {
          odooProduct.list_price = product.prezzo_vendita_suggerito; // Sales price
        }

        if (product.prezzo_acquisto) {
          odooProduct.standard_price = product.prezzo_acquisto; // Cost price
        }

        if (product.peso) {
          odooProduct.weight = product.peso;
        }

        // Add tags as notes
        if (product.tags && product.tags.length > 0) {
          odooProduct.description_purchase = `Tags: ${product.tags.join(', ')}`;
        }

        // Create product in Odoo
        const createResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': cookies || ''
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'product.product',
              method: 'create',
              args: [odooProduct],
              kwargs: {},
              context: {}
            },
            id: Math.floor(Math.random() * 1000000000)
          })
        });

        const createData = await createResponse.json();

        if (createData.error) {
          console.error('❌ Error creating product:', product.nome_completo, createData.error);
          errors.push({
            product: product.nome_completo,
            error: createData.error.message || 'Errore sconosciuto'
          });
        } else {
          console.log('✅ Product created:', product.nome_completo, 'ID:', createData.result);
          results.push({
            product: product.nome_completo,
            odoo_id: createData.result,
            success: true
          });
        }

      } catch (error: any) {
        console.error('❌ Exception creating product:', product.nome_completo, error);
        errors.push({
          product: product.nome_completo,
          error: error.message || 'Errore sconosciuto'
        });
      }
    }

    // Return summary
    console.log(`✅ Created ${results.length}/${products.length} products successfully`);

    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} errors occurred:`, errors);
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: products.length,
        created: results.length,
        failed: errors.length
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ General error creating products:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la creazione dei prodotti'
      },
      { status: 500 }
    );
  }
}
