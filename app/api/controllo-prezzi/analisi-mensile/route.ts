import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { MonthlyAnalysisLine, MonthlyAnalysisStats, MonthlyAnalysisResponse } from '@/lib/types/monthly-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/controllo-prezzi/analisi-mensile
 *
 * Analizza i prezzi di vendita del mese per verificare se sono "regolari"
 * rispetto ai listini (prezzi bloccati o listino base).
 *
 * Query params:
 * - month: formato YYYY-MM (default: mese corrente)
 *
 * Filtra:
 * - Solo ordini confermati (state = 'sale' o 'done')
 * - Data consegna (commitment_date) nel mese specificato
 * - Solo ordini NON ancora fatturati (invoice_status in ['no', 'to invoice'])
 *
 * Gruppi:
 * - Gruppo 1 (fixed): Prodotti con prezzo fisso nel listino cliente
 * - Gruppo 2 (base_pricelist): Prodotti senza prezzo fisso, usano listino base
 */

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [ANALISI-MENSILE-API] Starting monthly price analysis...');
    const startTime = Date.now();

    // Parse month parameter
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    // Calculate month range
    let monthStart: string;
    let monthEnd: string;
    let monthLabel: string;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      monthStart = firstDay.toISOString().split('T')[0];
      monthEnd = lastDay.toISOString().split('T')[0];
      monthLabel = monthParam;
    } else {
      // Default: current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthStart = firstDay.toISOString().split('T')[0];
      monthEnd = lastDay.toISOString().split('T')[0];
      monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    console.log(`📅 [ANALISI-MENSILE-API] Analyzing month: ${monthLabel} (${monthStart} to ${monthEnd})`);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [ANALISI-MENSILE-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // STEP 1: Fetch confirmed orders for the month, NOT YET invoiced
    console.log('🔍 [ANALISI-MENSILE-API] Fetching confirmed orders (not invoiced)...');

    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['company_id', '=', 1],
          ['state', 'in', ['sale', 'done']],
          ['commitment_date', '>=', monthStart],
          ['commitment_date', '<=', monthEnd],
          ['invoice_status', 'in', ['no', 'to invoice']]
        ],
        fields: ['id', 'name', 'partner_id', 'pricelist_id', 'date_order', 'commitment_date'],
        order: 'commitment_date DESC'
      }
    );

    if (!orders || orders.length === 0) {
      console.log('ℹ️ [ANALISI-MENSILE-API] No orders found for this month');
      return NextResponse.json({
        success: true,
        month: monthLabel,
        stats: {
          totalLines: 0,
          fixedPriceCount: 0,
          fixedHigherCount: 0,
          fixedLowerCount: 0,
          fixedTotalDiffCHF: 0,
          basePriceCount: 0,
          baseHigherCount: 0,
          baseLowerCount: 0,
          baseTotalDiffCHF: 0,
          totalProfitCHF: 0,
          averageMarginPercent: 0
        },
        fixedPriceLines: [],
        basePriceLines: [],
        performanceMs: Date.now() - startTime
      } as MonthlyAnalysisResponse);
    }

    const orderIds = orders.map((o: any) => o.id);
    const pricelistIds = Array.from(new Set(orders.map((o: any) => o.pricelist_id?.[0]).filter(Boolean))) as number[];

    console.log(`✅ Found ${orders.length} orders with ${pricelistIds.length} unique pricelists`);

    // STEP 2: Batch fetch ALL order lines
    console.log('📦 [ANALISI-MENSILE-API] Batch fetching order lines...');
    const orderLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['order_id', 'in', orderIds]],
        fields: ['id', 'order_id', 'product_id', 'name', 'product_uom_qty', 'price_unit', 'discount']
      }
    );

    if (!orderLines || orderLines.length === 0) {
      console.log('⚠️ [ANALISI-MENSILE-API] No order lines found');
      return NextResponse.json({
        success: true,
        month: monthLabel,
        stats: {
          totalLines: 0,
          fixedPriceCount: 0,
          fixedHigherCount: 0,
          fixedLowerCount: 0,
          fixedTotalDiffCHF: 0,
          basePriceCount: 0,
          baseHigherCount: 0,
          baseLowerCount: 0,
          baseTotalDiffCHF: 0,
          totalProfitCHF: 0,
          averageMarginPercent: 0
        },
        fixedPriceLines: [],
        basePriceLines: [],
        performanceMs: Date.now() - startTime
      } as MonthlyAnalysisResponse);
    }

    const productIds = Array.from(new Set(orderLines.map((line: any) => line.product_id[0])));
    console.log(`✅ Found ${orderLines.length} order lines with ${productIds.length} unique products`);

    // STEP 3: Batch fetch ALL products (cost price + product_tmpl_id for pricelist matching)
    console.log('🏷️ [ANALISI-MENSILE-API] Batch fetching products...');
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [
          ['id', 'in', productIds],
          ['company_id', 'in', [1, false]]
        ],
        fields: ['id', 'name', 'default_code', 'list_price', 'standard_price', 'product_tmpl_id']
      }
    );

    const productMap = new Map(products.map((p: any) => [p.id, p]));
    // Also create a map from product_id to product_tmpl_id for pricelist matching
    const productToTemplateMap = new Map<number, number>();
    products.forEach((p: any) => {
      if (p.product_tmpl_id) {
        productToTemplateMap.set(p.id, p.product_tmpl_id[0]);
      }
    });
    const productTmplIds = Array.from(new Set(productToTemplateMap.values()));
    console.log(`✅ Fetched ${products.length} products (${productTmplIds.length} unique templates)`);

    // STEP 4: Fetch pricelists to get base_pricelist info
    console.log('💰 [ANALISI-MENSILE-API] Fetching pricelists...');
    const pricelists = await callOdoo(
      cookies,
      'product.pricelist',
      'search_read',
      [],
      {
        domain: [['id', 'in', pricelistIds]],
        fields: ['id', 'name', 'item_ids']
      }
    );

    const pricelistMap = new Map<number, any>(pricelists.map((p: any) => [p.id, p]));
    console.log(`✅ Fetched ${pricelists.length} pricelists`);

    // STEP 5: Batch fetch ALL pricelist items for customer pricelists
    // Search by BOTH product_id (variant) AND product_tmpl_id (template) since rules can be defined at either level
    console.log('📋 [ANALISI-MENSILE-API] Batch fetching pricelist items (variant + template rules)...');
    const pricelistItems = await callOdoo(
      cookies,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: [
          ['pricelist_id', 'in', pricelistIds],
          '|',
          ['product_id', 'in', productIds],
          ['product_tmpl_id', 'in', productTmplIds]
        ],
        fields: ['id', 'pricelist_id', 'product_id', 'product_tmpl_id', 'applied_on', 'compute_price', 'fixed_price', 'base', 'base_pricelist_id', 'price_discount', 'price_surcharge']
      }
    );

    // Create lookup maps:
    // - "pricelistId-productId" -> item (for variant-specific rules)
    // - "pricelistId-tmplId" -> item (for template-level rules)
    const customerPricelistItemMap = new Map<string, any>();
    const customerPricelistTmplMap = new Map<string, any>();
    const basePricelistIdsNeeded = new Set<number>();

    pricelistItems.forEach((item: any) => {
      const pricelistId = item.pricelist_id[0];

      // Variant-specific rule (applied_on = '0_product_variant')
      if (item.product_id) {
        const productId = item.product_id[0];
        const key = `${pricelistId}-${productId}`;
        customerPricelistItemMap.set(key, item);
      }

      // Template-level rule (applied_on = '1_product')
      if (item.product_tmpl_id) {
        const tmplId = item.product_tmpl_id[0];
        const key = `${pricelistId}-${tmplId}`;
        customerPricelistTmplMap.set(key, item);
      }

      // Collect base pricelist IDs for items that use formula with base=pricelist
      if (item.base === 'pricelist' && item.base_pricelist_id) {
        basePricelistIdsNeeded.add(item.base_pricelist_id[0]);
      }
    });

    console.log(`✅ Found ${pricelistItems.length} pricelist items (${customerPricelistItemMap.size} variant rules, ${customerPricelistTmplMap.size} template rules)`);

    // STEP 6: Fetch base pricelist items (for products without fixed price)
    // First, get the "global" rules from customer pricelists (applied_on = '3_global' with base = pricelist)
    console.log('📋 [ANALISI-MENSILE-API] Fetching global pricelist rules...');
    const globalRules = await callOdoo(
      cookies,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: [
          ['pricelist_id', 'in', pricelistIds],
          ['applied_on', '=', '3_global']
        ],
        fields: ['id', 'pricelist_id', 'compute_price', 'base', 'base_pricelist_id', 'price_discount', 'price_surcharge', 'fixed_price']
      }
    );

    // Map pricelist -> global rule (base pricelist)
    const pricelistGlobalRuleMap = new Map<number, any>();
    globalRules.forEach((rule: any) => {
      const pricelistId = rule.pricelist_id[0];
      pricelistGlobalRuleMap.set(pricelistId, rule);
      if (rule.base === 'pricelist' && rule.base_pricelist_id) {
        basePricelistIdsNeeded.add(rule.base_pricelist_id[0]);
      }
    });

    console.log(`✅ Found ${globalRules.length} global rules, need ${basePricelistIdsNeeded.size} base pricelists`);

    // STEP 7: Fetch items from base pricelists (also including template-level rules)
    let basePricelistItemMap = new Map<string, any>();
    let basePricelistTmplMap = new Map<string, any>();

    if (basePricelistIdsNeeded.size > 0) {
      console.log('📋 [ANALISI-MENSILE-API] Fetching base pricelist items (variant + template)...');
      const basePricelistItems = await callOdoo(
        cookies,
        'product.pricelist.item',
        'search_read',
        [],
        {
          domain: [
            ['pricelist_id', 'in', Array.from(basePricelistIdsNeeded)],
            ['compute_price', '=', 'fixed'],
            '|',
            ['product_id', 'in', productIds],
            ['product_tmpl_id', 'in', productTmplIds]
          ],
          fields: ['id', 'pricelist_id', 'product_id', 'product_tmpl_id', 'fixed_price']
        }
      );

      basePricelistItems.forEach((item: any) => {
        const pricelistId = item.pricelist_id[0];

        // Variant-specific rule
        if (item.product_id) {
          const productId = item.product_id[0];
          const key = `${pricelistId}-${productId}`;
          basePricelistItemMap.set(key, item);
        }

        // Template-level rule
        if (item.product_tmpl_id) {
          const tmplId = item.product_tmpl_id[0];
          const key = `${pricelistId}-${tmplId}`;
          basePricelistTmplMap.set(key, item);
        }
      });

      console.log(`✅ Fetched ${basePricelistItems.length} base pricelist items (${basePricelistItemMap.size} variant, ${basePricelistTmplMap.size} template)`);
    }

    // Fetch base pricelist names
    let basePricelistNamesMap = new Map<number, string>();
    if (basePricelistIdsNeeded.size > 0) {
      const basePricelists = await callOdoo(
        cookies,
        'product.pricelist',
        'search_read',
        [],
        {
          domain: [['id', 'in', Array.from(basePricelistIdsNeeded)]],
          fields: ['id', 'name']
        }
      );
      basePricelists.forEach((p: any) => {
        basePricelistNamesMap.set(p.id, p.name);
      });
    }

    // STEP 8: Create order lookup map
    const orderMap = new Map(orders.map((o: any) => [o.id, o]));

    // STEP 9: Process ALL data in-memory
    console.log('⚡ [ANALISI-MENSILE-API] Processing data in-memory...');

    const fixedPriceLines: MonthlyAnalysisLine[] = [];
    const basePriceLines: MonthlyAnalysisLine[] = [];

    const stats: MonthlyAnalysisStats = {
      totalLines: 0,
      fixedPriceCount: 0,
      fixedHigherCount: 0,
      fixedLowerCount: 0,
      fixedTotalDiffCHF: 0,
      basePriceCount: 0,
      baseHigherCount: 0,
      baseLowerCount: 0,
      baseTotalDiffCHF: 0,
      totalProfitCHF: 0,
      averageMarginPercent: 0
    };

    let totalMarginPercent = 0;

    for (const line of orderLines) {
      const order: any = orderMap.get(line.order_id[0]);
      if (!order) continue;

      const product: any = productMap.get(line.product_id[0]);
      if (!product) continue;

      const soldPrice = line.price_unit;
      const costPrice = product.standard_price || 0;
      const quantity = line.product_uom_qty || 1;
      const discount = line.discount || 0;
      const customerPricelistId = order.pricelist_id?.[0];

      // Check if product has fixed price in customer pricelist
      // Priority: 1. Variant-specific rule (product_id), 2. Template-level rule (product_tmpl_id)
      const productId = line.product_id[0];
      const productTmplId = productToTemplateMap.get(productId);

      const variantItemKey = `${customerPricelistId}-${productId}`;
      const tmplItemKey = productTmplId ? `${customerPricelistId}-${productTmplId}` : null;

      // Check variant rule first, then template rule
      let customerItem = customerPricelistItemMap.get(variantItemKey);
      if (!customerItem && tmplItemKey) {
        customerItem = customerPricelistTmplMap.get(tmplItemKey);
      }

      let priceGroup: 'fixed' | 'base_pricelist';
      let referencePrice: number;
      let referencePricelistName: string;

      if (customerItem && customerItem.compute_price === 'fixed') {
        // GROUP 1: Fixed price in customer pricelist (variant or template rule)
        priceGroup = 'fixed';
        referencePrice = customerItem.fixed_price;
        referencePricelistName = pricelistMap.get(customerPricelistId)?.name || 'Listino Cliente';
      } else {
        // GROUP 2: Use base pricelist
        priceGroup = 'base_pricelist';

        // Get global rule for this customer pricelist
        const globalRule = pricelistGlobalRuleMap.get(customerPricelistId);
        const basePricelistId = globalRule?.base_pricelist_id?.[0];

        if (basePricelistId) {
          // Look for fixed price in base pricelist (check variant first, then template)
          const baseVariantKey = `${basePricelistId}-${productId}`;
          const baseTmplKey = productTmplId ? `${basePricelistId}-${productTmplId}` : null;

          let baseItem = basePricelistItemMap.get(baseVariantKey);
          if (!baseItem && baseTmplKey) {
            baseItem = basePricelistTmplMap.get(baseTmplKey);
          }

          if (baseItem) {
            referencePrice = baseItem.fixed_price;
          } else {
            // Fallback to product list_price
            referencePrice = product.list_price || 0;
          }
          referencePricelistName = basePricelistNamesMap.get(basePricelistId) || 'Listino Base';
        } else {
          // No base pricelist found, use product list_price
          referencePrice = product.list_price || 0;
          referencePricelistName = 'Prezzo Listino';
        }
      }

      // Calculate effective price after discount
      const effectivePrice = soldPrice * (1 - discount / 100);

      // Calculate differences (using effective price after discount)
      const priceDiffCHF = effectivePrice - referencePrice;
      const priceDiffPercent = referencePrice > 0 ? ((effectivePrice - referencePrice) / referencePrice) * 100 : 0;
      const profitCHF = (effectivePrice - costPrice) * quantity;
      const marginPercent = costPrice > 0 ? ((effectivePrice - costPrice) / costPrice) * 100 : 0;

      // Determine direction
      let direction: 'higher' | 'lower' | 'equal';
      if (Math.abs(priceDiffCHF) < 0.01) {
        direction = 'equal';
      } else if (priceDiffCHF > 0) {
        direction = 'higher';
      } else {
        direction = 'lower';
      }

      const analysisLine: MonthlyAnalysisLine = {
        lineId: line.id,
        orderId: order.id,
        orderName: order.name,
        productId: line.product_id[0],
        productName: line.name || product.name,
        productCode: product.default_code || '',
        customerId: order.partner_id[0],
        customerName: order.partner_id[1],
        commitmentDate: order.commitment_date || order.date_order || '',
        quantity,
        soldPrice,
        effectivePrice,
        referencePrice,
        costPrice,
        discount,
        priceDiffCHF,
        priceDiffPercent,
        profitCHF,
        marginPercent,
        priceGroup,
        direction,
        referencePricelistName
      };

      // Add to appropriate group and update stats
      if (priceGroup === 'fixed') {
        fixedPriceLines.push(analysisLine);
        stats.fixedPriceCount++;
        stats.fixedTotalDiffCHF += priceDiffCHF;

        if (direction === 'higher') {
          stats.fixedHigherCount++;
        } else if (direction === 'lower') {
          stats.fixedLowerCount++;
        }
      } else {
        basePriceLines.push(analysisLine);
        stats.basePriceCount++;
        stats.baseTotalDiffCHF += priceDiffCHF;

        if (direction === 'higher') {
          stats.baseHigherCount++;
        } else if (direction === 'lower') {
          stats.baseLowerCount++;
        }
      }

      stats.totalLines++;
      stats.totalProfitCHF += profitCHF;
      totalMarginPercent += marginPercent;
    }

    // Calculate average margin
    stats.averageMarginPercent = stats.totalLines > 0 ? totalMarginPercent / stats.totalLines : 0;

    // Sort by difference (largest absolute difference first)
    fixedPriceLines.sort((a, b) => Math.abs(b.priceDiffCHF) - Math.abs(a.priceDiffCHF));
    basePriceLines.sort((a, b) => Math.abs(b.priceDiffCHF) - Math.abs(a.priceDiffCHF));

    const totalTime = Date.now() - startTime;
    console.log(`✅ [ANALISI-MENSILE-API] Complete in ${totalTime}ms:`, {
      totalLines: stats.totalLines,
      fixedPriceCount: stats.fixedPriceCount,
      basePriceCount: stats.basePriceCount
    });

    return NextResponse.json({
      success: true,
      month: monthLabel,
      stats,
      fixedPriceLines,
      basePriceLines,
      performanceMs: totalTime
    } as MonthlyAnalysisResponse);

  } catch (error: any) {
    console.error('💥 [ANALISI-MENSILE-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error analyzing monthly prices',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
