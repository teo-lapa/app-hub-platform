import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { sql } from '@vercel/postgres';

/**
 * GET /api/smart-ordering-v2/pre-order-products
 *
 * Carica tutti i prodotti che hanno il tag "PRE-ORDINE"
 */
export async function GET(request: NextRequest) {
  try {
    // Get session
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // 1. Carica il tag "PRE-ORDINE"
    const tags = await rpc.searchRead(
      'product.tag',
      [['name', 'ilike', 'PRE-ORDINE']],
      ['id', 'name'],
      1
    );

    if (tags.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        message: 'Tag PRE-ORDINE non trovato'
      });
    }

    const preOrderTagId = tags[0].id;

    // 2. Prima carica i template con il tag
    const templates = await rpc.searchRead(
      'product.template',
      [
        ['product_tag_ids', 'in', [preOrderTagId]],
        ['active', '=', true]
      ],
      ['id']
    );

    if (templates.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        message: 'Nessun prodotto con tag PRE-ORDINE'
      });
    }

    const templateIds = templates.map((t: any) => t.id);
    console.log(`🔍 Trovati ${templates.length} template con tag PRE-ORDINE`);

    // 3. Carica i prodotti dai template
    const products = await rpc.searchRead(
      'product.product',
      [
        ['product_tmpl_id', 'in', templateIds],
        ['active', '=', true]
      ],
      [
        'id',
        'name',
        'display_name',  // Nome completo con attributi variante
        'default_code',
        'qty_available',
        'uom_id',
        'seller_ids',
        'product_tmpl_id'
      ]
    );

    //  3.1. Carica varianti per ogni template
    // Per ogni template, se ha più varianti, caricale tutte
    const templateVariantsMap = new Map<number, any[]>();

    // Prima raggruppo i prodotti per template
    const productsByTemplate = new Map<number, any[]>();
    for (const product of products) {
      const tmplId = product.product_tmpl_id[0];
      if (!productsByTemplate.has(tmplId)) {
        productsByTemplate.set(tmplId, []);
      }
      productsByTemplate.get(tmplId)!.push(product);
    }

    // Poi per ogni template che ha più di 1 variante, carico tutte le varianti
    for (const [tmplId, tmplProducts] of Array.from(productsByTemplate.entries())) {
      if (tmplProducts.length > 1) {
        // Questo template ha varianti! Carico tutte
        const allVariants = await rpc.searchRead(
          'product.product',
          [
            ['product_tmpl_id', '=', tmplId],
            ['active', '=', true]
          ],
          [
            'id',
            'display_name',
            'qty_available',
            'lst_price',
            'default_code'
          ]
        );
        templateVariantsMap.set(tmplId, allVariants);
        console.log(`📦 Template ${tmplId} ha ${allVariants.length} varianti`);
      }
    }

    // 3.2. Carica informazioni fornitori
    const supplierIds = new Set<number>();
    products.forEach((product: any) => {
      if (product.seller_ids && product.seller_ids.length > 0) {
        supplierIds.add(product.seller_ids[0]); // Main supplier
      }
    });

    const suppliers = await rpc.searchRead(
      'product.supplierinfo',
      [['id', 'in', Array.from(supplierIds)]],
      ['id', 'partner_id', 'delay']
    );

    const supplierMap = new Map();
    for (const seller of suppliers) {
      if (seller.partner_id && seller.partner_id.length > 0) {
        const partnerId = seller.partner_id[0];
        const partnerName = seller.partner_id[1];
        supplierMap.set(seller.id, {
          id: partnerId,
          name: partnerName,
          delay: seller.delay || 3
        });
      }
    }

    // 4. Carica assegnazioni clienti dal database
    const assignmentsByProduct = new Map<number, any[]>();

    try {
      if (products.length > 0) {
        // Raccogli tutti gli ID (prodotti principali + varianti)
        const allProductIds = new Set<number>();
        products.forEach(p => allProductIds.add(p.id));

        // Aggiungi anche gli ID delle varianti
        for (const [tmplId, variants] of Array.from(templateVariantsMap.entries())) {
          variants.forEach(v => allProductIds.add(v.id));
        }

        // Carica assegnazioni per TUTTI gli ID
        if (allProductIds.size > 0) {
          const productIdsArray = Array.from(allProductIds);

          // Carica tutte le assegnazioni per questi prodotti/varianti
          const placeholders = productIdsArray.map((_, i) => `$${i + 1}`).join(',');
          const queryText = `
            SELECT product_id, customer_id, quantity, notes
            FROM preorder_customer_assignments
            WHERE product_id IN (${placeholders})
            ORDER BY created_at DESC
          `;

          const assignmentsResult = await sql.query(queryText, productIdsArray);

          // Raggruppa per product_id
          for (const row of assignmentsResult.rows) {
            const productId = row.product_id;
            if (!assignmentsByProduct.has(productId)) {
              assignmentsByProduct.set(productId, []);
            }
            assignmentsByProduct.get(productId)!.push({
              customerId: row.customer_id,
              customerName: '', // Verrà caricato dal front-end
              quantity: parseFloat(row.quantity),
              notes: row.notes
            });
          }
        }

        console.log(`✅ Caricate assegnazioni per ${assignmentsByProduct.size} prodotti/varianti`);

        // DEBUG: Log dettagliato delle assegnazioni trovate
        for (const [productId, assignments] of Array.from(assignmentsByProduct.entries())) {
          console.log(`  📋 Product ${productId}: ${assignments.length} assegnazioni`);
        }
      }
    } catch (error) {
      console.error('❌ Errore caricamento assegnazioni:', error);
      // Non bloccare la risposta se la tabella non esiste ancora
    }

    // 5. Formatta i prodotti - 🔥 SOLO 1 PRODOTTO PER TEMPLATE
    // Uso productsByTemplate per prendere il PRIMO prodotto di ogni template
    console.log(`📦 productsByTemplate ha ${productsByTemplate.size} template`);
    const formattedProducts = Array.from(productsByTemplate.entries())
      .map(([tmplId, tmplProducts]) => {
        // Prendo sempre il PRIMO prodotto del template (quello principale)
        const product = tmplProducts[0];
        const mainSupplierId = product.seller_ids && product.seller_ids.length > 0 ? product.seller_ids[0] : null;
        const supplier = mainSupplierId ? supplierMap.get(mainSupplierId) : null;

        // Carica varianti se esistono per questo template
        const variants = templateVariantsMap.get(tmplId) || [];
        const hasVariants = variants.length > 1;

        return {
          id: product.id,
          name: product.name,
          display_name: product.display_name || product.name,  // Nome con attributi variante
          image_url: `https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${product.id}/image_128`,
          currentStock: product.qty_available || 0,
          uom: product.uom_id ? product.uom_id[1] : 'PZ',
          supplier: supplier ? {
            id: supplier.id,
            name: supplier.name
          } : {
            id: 0,
            name: 'Nessun fornitore'
          },
          hasPreOrderTag: true,
          assigned_customers: assignmentsByProduct.get(product.id) || [],  // Carica da DB
          // ✨ NUOVO: Supporto varianti
          hasVariants: hasVariants,
          variantCount: variants.length,
          variants: hasVariants ? variants.map(v => ({
            id: v.id,
            name: v.display_name,
            stock: v.qty_available || 0,
            price: v.lst_price || 0,
            code: v.default_code || '',
            assigned_customers: assignmentsByProduct.get(v.id) || []  // ✨ Assegnazioni per variante
          })) : []
        };
      });

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      totalCount: formattedProducts.length
    });

  } catch (error: any) {
    console.error('❌ Error loading pre-order products:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
