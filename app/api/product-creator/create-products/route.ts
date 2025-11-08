import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

        // TRACCIABILITÀ: Attiva per prodotti FRIGO (freschi)
        const isFrigo = product.categoria_nome?.toLowerCase().includes('frigo') ||
                       product.categoria_nome?.toLowerCase().includes('lattic') ||
                       product.categoria_nome?.toLowerCase().includes('mozzarell') ||
                       product.nome_completo?.toLowerCase().includes('fresc');

        if (isFrigo) {
          odooProduct.tracking = 'lot'; // Tracciabilità per lotti
          odooProduct.use_expiration_date = true; // Data scadenza
          console.log(`   🧊 Prodotto FRIGO - Tracciabilità attivata`);
        }

        // IVA: Get tax IDs for customer and supplier
        try {
          // IVA Cliente: 8.1% per food, 22% per non-food
          const isNonFood = product.categoria_nome?.toLowerCase().includes('non-food') ||
                           product.categoria_nome?.toLowerCase().includes('pulizia') ||
                           product.categoria_nome?.toLowerCase().includes('carta');

          const taxRate = isNonFood ? 22 : 8.1;

          const taxSaleResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `session_id=${sessionId}`
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'account.tax',
                method: 'search_read',
                args: [[['amount', '=', taxRate], ['type_tax_use', '=', 'sale']], ['id']],
                kwargs: { limit: 1 }
              },
              id: Math.floor(Math.random() * 1000000000)
            })
          });
          const taxSaleData = await taxSaleResponse.json();

          if (taxSaleData.result && taxSaleData.result.length > 0) {
            odooProduct.taxes_id = [[6, 0, [taxSaleData.result[0].id]]];
            console.log(`   💰 IVA Cliente ${taxRate}% impostata`);
          }

          // IVA Fornitore: 0% import (per fornitori esteri) o 8.1% (per fornitori italiani)
          // Default: 0% import per sicurezza
          const taxPurchaseResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `session_id=${sessionId}`
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'account.tax',
                method: 'search_read',
                args: [[['amount', '=', 0], ['type_tax_use', '=', 'purchase']], ['id']],
                kwargs: { limit: 1 }
              },
              id: Math.floor(Math.random() * 1000000000)
            })
          });
          const taxPurchaseData = await taxPurchaseResponse.json();

          if (taxPurchaseData.result && taxPurchaseData.result.length > 0) {
            odooProduct.supplier_taxes_id = [[6, 0, [taxPurchaseData.result[0].id]]];
            console.log(`   💰 IVA Fornitore 0% import impostata`);
          }
        } catch (taxError) {
          console.warn('⚠️  Errore impostazione IVA:', taxError);
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
          console.error('❌ Error creating product:', product.nome_completo);
          console.error('Full Odoo error:', JSON.stringify(createData.error, null, 2));

          // Extract detailed error message
          const errorMsg = createData.error.data?.message ||
                          createData.error.message ||
                          JSON.stringify(createData.error);

          errors.push({
            product: product.nome_completo,
            error: errorMsg
          });
        } else {
          const productId = createData.result;
          console.log('✅ Product created:', product.nome_completo, 'ID:', productId);

          // STEP 3: Create supplier price list if supplier is available
          if (product.fornitore_odoo_id && product.prezzo_acquisto) {
            try {
              console.log(`💰 Creating supplier price for product ${productId} with supplier ${product.fornitore_odoo_id}`);

              // Get EUR currency ID
              const eurResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'call',
                  params: {
                    model: 'res.currency',
                    method: 'search_read',
                    args: [[['name', '=', 'EUR']], ['id']],
                    kwargs: { limit: 1 }
                  },
                  id: Math.floor(Math.random() * 1000000000)
                })
              });
              const eurData = await eurResponse.json();
              const eurId = eurData.result?.[0]?.id || 3; // Default EUR ID

              const priceListData: any = {
                partner_id: product.fornitore_odoo_id,
                product_id: productId,
                price: product.prezzo_acquisto,
                min_qty: 1,
                currency_id: eurId, // SEMPRE EUR
              };

              // Add supplier product name and code from invoice
              if (product.nome || product.nome_completo) {
                priceListData.product_name = product.nome || product.nome_completo;
              }
              if (product.codice_ean) {
                priceListData.product_code = product.codice_ean;
              }

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

          // STEP 4: Generate and upload product image with Gemini 2.5 Flash Image (INLINE)
          let imageGenerated = false;
          if (product.nome_completo) {
            try {
              console.log(`🎨 Generating image for product ${productId} with Gemini AI`);

              // Initialize Gemini AI
              const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';
              if (!API_KEY) {
                console.error('❌ GEMINI_API_KEY not configured!');
                throw new Error('Gemini API key not configured');
              }

              const genAI = new GoogleGenerativeAI(API_KEY);
              const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

              // Create product photography prompt
              const imagePrompt = `Professional product photography of ${product.nome_completo}. ${product.descrizione_breve || ''}. Clean white background, e-commerce style, well-lit, centered, high quality, studio lighting, detailed, sharp focus, commercial photo.`;

              console.log('📝 Prompt:', imagePrompt.substring(0, 100) + '...');
              console.log('⏳ Generating image (this may take 30-40 seconds)...');

              const startTime = Date.now();
              const result = await model.generateContent(imagePrompt);
              const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

              console.log(`✅ Gemini responded in ${elapsedTime}s`);

              const response = result.response;

              if (!response || !response.candidates || response.candidates.length === 0) {
                console.error('❌ No image generated by Gemini');
                throw new Error('No image generated');
              }

              // Extract image data
              const candidate = response.candidates[0];
              const parts = candidate.content?.parts || [];

              let imageBase64 = null;
              for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                  imageBase64 = part.inlineData.data;
                  break;
                }
              }

              if (!imageBase64) {
                console.error('❌ No image data in Gemini response');
                throw new Error('No image data found');
              }

              console.log('✅ Image generated:', Math.round(imageBase64.length * 0.75 / 1024), 'KB');

              // Upload image to Odoo product
              console.log(`📤 Uploading image to Odoo product ${productId}`);

              const updateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
                    method: 'write',
                    args: [
                      [productId],
                      { image_1920: imageBase64 }
                    ],
                    kwargs: {},
                  },
                  id: Math.floor(Math.random() * 1000000000)
                })
              });

              const updateData = await updateResponse.json();

              if (updateData.error) {
                console.error('⚠️ Error uploading image to Odoo:', updateData.error);
              } else {
                console.log('✅ Image uploaded to Odoo successfully!');
                imageGenerated = true;
              }

            } catch (imageError: any) {
              console.error('⚠️ Exception generating/uploading image:', imageError.message || imageError);
            }
          }

          results.push({
            product: product.nome_completo,
            odoo_id: productId,
            success: true,
            supplier_price_created: !!product.fornitore_odoo_id,
            image_generated: imageGenerated
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
