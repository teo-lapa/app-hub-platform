import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export const dynamic = 'force-dynamic';

interface ProductData {
  nome?: string;
  nome_completo: string;
  descrizione_breve?: string;
  descrizione_dettagliata?: string;
  categoria?: string;
  categoria_odoo_id?: number;
  categoria_nome?: string;
  sottocategoria?: string;
  marca?: string;
  codice_ean?: string;
  codice_sa?: string;
  prezzo_acquisto?: number;
  prezzo_vendita_suggerito?: number;
  unita_misura?: string;
  uom_odoo_id?: number;
  uom_nome?: string;
  peso?: number;
  dimensioni?: string;
  caratteristiche?: string[];
  tags?: string[];
  fornitore_odoo_id?: number | null;
  immagine_search_query?: string;
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

    // Ottieni session_id utente
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    console.log(`📦 Creating ${products.length} products in Odoo...`);

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

    // STEP 2: Create products one by one
    const results = [];
    const errors = [];

    for (const product of products as ProductData[]) {
      try {
        console.log(`📝 Creating product: ${product.nome_completo}`);

        // Prepare product data for Odoo
        const odooProduct: any = {
          name: product.nome_completo || product.nome || 'Prodotto senza nome',
          type: 'product', // Prodotto immagazzinabile
          categ_id: product.categoria_odoo_id || 1, // Use AI-selected category or default (1 = "All")
          sale_ok: true,
          purchase_ok: true,
        };

        // Add optional fields only if they exist and are valid
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

        // Use AI-selected unit of measure (default to ID 1 if not provided)
        if (product.uom_odoo_id && product.uom_odoo_id > 0) {
          odooProduct.uom_id = product.uom_odoo_id; // Unit of measure for sales
          odooProduct.uom_po_id = product.uom_odoo_id; // Unit of measure for purchase
        }

        if (product.prezzo_vendita_suggerito && product.prezzo_vendita_suggerito > 0) {
          odooProduct.list_price = product.prezzo_vendita_suggerito; // Sales price
        }

        if (product.prezzo_acquisto && product.prezzo_acquisto > 0) {
          odooProduct.standard_price = product.prezzo_acquisto; // Cost price
        }

        if (product.peso && product.peso > 0) {
          odooProduct.weight = product.peso;
        }

        // Add SA fiscal code
        if (product.codice_sa) {
          odooProduct.hs_code = product.codice_sa; // Harmonized System Code
        }

        // Add tags and notes
        let notes = [];
        if (product.tags && product.tags.length > 0) {
          notes.push(`Tags: ${product.tags.join(', ')}`);
        }
        if (product.caratteristiche && product.caratteristiche.length > 0) {
          notes.push(`Caratteristiche: ${product.caratteristiche.join(', ')}`);
        }
        if (product.dimensioni) {
          notes.push(`Dimensioni: ${product.dimensioni}`);
        }
        if (notes.length > 0) {
          odooProduct.description_purchase = notes.join('\n');
        }

        // Create product in Odoo
        const createResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': `session_id=${sessionId}`
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
          const productId = createData.result;
          console.log('✅ Product created:', product.nome_completo, 'ID:', productId);

          // STEP 3: Create supplier price list if supplier is available
          if (product.fornitore_odoo_id && product.prezzo_acquisto) {
            try {
              console.log(`💰 Creating supplier price for product ${productId} with supplier ${product.fornitore_odoo_id}`);

              const priceListData = {
                partner_id: product.fornitore_odoo_id,
                product_id: productId,
                price: product.prezzo_acquisto,
                min_qty: 1,
              };

              const priceResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                  'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    model: 'product.supplierinfo',
                    method: 'create',
                    args: [priceListData],
                    kwargs: {},
                  },
                  id: Math.floor(Math.random() * 1000000000)
                })
              });

              const priceData = await priceResponse.json();

              if (priceData.error) {
                console.error('⚠️ Error creating supplier price:', priceData.error);
              } else {
                console.log('✅ Supplier price created with ID:', priceData.result);
              }
            } catch (priceError) {
              console.error('⚠️ Exception creating supplier price:', priceError);
            }
          }

          // STEP 4: Generate and upload product image with Gemini 2.5 Flash Image
          if (product.nome_completo) {
            try {
              console.log(`🎨 Generating image for product ${productId}`);

              // Call internal Gemini image generation API
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003';

              const imageResponse = await fetch(`${baseUrl}/api/product-creator/generate-image-gemini`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productName: product.nome_completo,
                  productDescription: product.descrizione_breve || '',
                  productId: productId
                })
              });

              const imageData = await imageResponse.json();

              if (imageData.success) {
                console.log('✅ Product image generated and uploaded with Gemini 2.5 Flash Image');
              } else {
                console.error('⚠️ Image generation failed:', imageData.error);
              }
            } catch (imageError) {
              console.error('⚠️ Exception generating image:', imageError);
            }
          }

          results.push({
            product: product.nome_completo,
            odoo_id: productId,
            success: true,
            supplier_price_created: !!product.fornitore_odoo_id,
            image_generated: !!product.immagine_search_query
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
