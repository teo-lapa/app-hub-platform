/**
 * Analisi Prezzi REALI Farine - dai dati di vendita effettivi
 * Non dal listino, ma da quanto viene effettivamente fatturato
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

class OdooAnalyzer {
  private uid: number | null = null;
  private cookies: string | null = null;

  async authenticate(): Promise<boolean> {
    const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
        id: Date.now()
      })
    });

    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      this.cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
    }

    const data = await response.json();
    if (data.result?.uid) {
      this.uid = data.result.uid;
      return true;
    }
    throw new Error('Autenticazione fallita');
  }

  async searchRead<T>(model: string, domain: any[], fields: string[], options: any = {}): Promise<T[]> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method: 'search_read',
          args: [],
          kwargs: { domain, fields, limit: options.limit || 10000, offset: options.offset || 0, order: options.order }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || [];
  }

  async analyze() {
    console.log('📊 ANALISI PREZZI REALI FARINE (da fatture effettive)\n');
    console.log('='.repeat(100));

    // 1. Prendi i prodotti farina con i costi
    const farineProducts = await this.searchRead<any>('product.product', [
      '|', '|', '|',
      ['name', 'ilike', 'verace'],
      ['name', 'ilike', 'farina 00'],
      ['name', 'ilike', 'caputo'],
      ['name', 'ilike', 'pizzuti']
    ], [
      'id', 'name', 'default_code', 'list_price', 'standard_price'
    ], { limit: 100 });

    // Crea mappa prodotti per costo
    const productCosts: { [key: number]: { name: string; cost: number; listPrice: number } } = {};
    for (const p of farineProducts) {
      productCosts[p.id] = {
        name: p.name,
        cost: p.standard_price || 0,
        listPrice: p.list_price || 0
      };
    }

    // 2. Prendi le righe fattura delle farine (ultimi 6 mesi)
    const farinaIds = farineProducts.map(p => p.id);

    const invoiceLines = await this.searchRead<any>('account.move.line', [
      ['move_id.move_type', '=', 'out_invoice'],
      ['move_id.state', '=', 'posted'],
      ['move_id.invoice_date', '>=', '2025-06-01'],
      ['move_id.invoice_date', '<=', '2025-11-30'],
      ['product_id', 'in', farinaIds],
      ['quantity', '>', 0]
    ], [
      'product_id', 'quantity', 'price_subtotal', 'price_unit', 'discount'
    ], { limit: 10000 });

    console.log(`\nRighe fattura farine trovate: ${invoiceLines.length}\n`);

    // 3. Raggruppa per prodotto e calcola prezzo medio REALE
    const salesByProduct: { [key: number]: {
      qty: number;
      revenue: number;
      prices: number[];
      discounts: number[];
    } } = {};

    for (const line of invoiceLines) {
      const prodId = line.product_id?.[0];
      if (!prodId) continue;

      if (!salesByProduct[prodId]) {
        salesByProduct[prodId] = { qty: 0, revenue: 0, prices: [], discounts: [] };
      }
      salesByProduct[prodId].qty += line.quantity;
      salesByProduct[prodId].revenue += line.price_subtotal;
      salesByProduct[prodId].prices.push(line.price_unit);
      if (line.discount > 0) {
        salesByProduct[prodId].discounts.push(line.discount);
      }
    }

    // 4. Calcola margini REALI
    console.log('🌾 MARGINI REALI FARINE (da prezzi effettivi di vendita)');
    console.log('='.repeat(100));
    console.log('\nProdotto                                     | Costo  | Prezzo Medio | Margine | Margine% | Fatturato');
    console.log('-'.repeat(100));

    const results: any[] = [];

    for (const [prodId, sales] of Object.entries(salesByProduct)) {
      const id = parseInt(prodId);
      const product = productCosts[id];
      if (!product) continue;

      const avgPrice = sales.qty > 0 ? sales.revenue / sales.qty : 0;
      const margin = avgPrice - product.cost;
      const marginPct = avgPrice > 0 ? (margin / avgPrice * 100) : 0;
      const avgDiscount = sales.discounts.length > 0
        ? sales.discounts.reduce((a, b) => a + b, 0) / sales.discounts.length
        : 0;

      results.push({
        name: product.name,
        cost: product.cost,
        listPrice: product.listPrice,
        avgPrice,
        margin,
        marginPct,
        revenue: sales.revenue,
        qty: sales.qty,
        avgDiscount
      });
    }

    // Ordina per fatturato
    results.sort((a, b) => b.revenue - a.revenue);

    let totalRevenue = 0;
    let totalCost = 0;

    for (const r of results) {
      const warning = r.marginPct < 15 ? '🔴' : r.marginPct < 25 ? '⚠️' : '✅';
      totalRevenue += r.revenue;
      totalCost += r.cost * r.qty;

      console.log(`${warning} ${r.name.substring(0, 40).padEnd(40)} | ${r.cost.toFixed(2).padStart(6)} | ${r.avgPrice.toFixed(2).padStart(12)} | ${r.margin.toFixed(2).padStart(7)} | ${r.marginPct.toFixed(1).padStart(7)}% | ${r.revenue.toFixed(0).padStart(9)}`);
    }

    const totalMargin = totalRevenue - totalCost;
    const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0;

    console.log('-'.repeat(100));
    console.log(`TOTALE                                       |        |              | ${totalMargin.toFixed(0).padStart(7)} | ${totalMarginPct.toFixed(1).padStart(7)}% | ${totalRevenue.toFixed(0).padStart(9)}`);

    // 5. Dettaglio per prodotto principale
    console.log('\n\n📋 DETTAGLIO FARINE PRINCIPALI');
    console.log('='.repeat(100));

    for (const r of results.slice(0, 10)) {
      console.log(`\n📦 ${r.name}`);
      console.log(`   Costo acquisto: CHF ${r.cost.toFixed(2)}`);
      console.log(`   Prezzo listino base: CHF ${r.listPrice.toFixed(2)}`);
      console.log(`   Prezzo medio vendita REALE: CHF ${r.avgPrice.toFixed(2)}`);
      console.log(`   Margine unitario: CHF ${r.margin.toFixed(2)} (${r.marginPct.toFixed(1)}%)`);
      console.log(`   Quantità venduta (6 mesi): ${r.qty.toFixed(0)} sacchi`);
      console.log(`   Fatturato totale: CHF ${r.revenue.toFixed(2)}`);
      console.log(`   Margine totale: CHF ${(r.margin * r.qty).toFixed(2)}`);

      if (r.marginPct < 20) {
        const targetMargin = 25;
        const newPrice = r.cost / (1 - targetMargin/100);
        const increase = newPrice - r.avgPrice;
        console.log(`   🔴 MARGINE BASSO! Per arrivare al ${targetMargin}%:`);
        console.log(`      Nuovo prezzo suggerito: CHF ${newPrice.toFixed(2)} (+${increase.toFixed(2)})`);
      }
    }

    // 6. Riepilogo finale
    console.log('\n\n' + '='.repeat(100));
    console.log('🎯 RIEPILOGO MARGINI FARINE');
    console.log('='.repeat(100));

    console.log(`\nFatturato totale farine (6 mesi): CHF ${totalRevenue.toFixed(2)}`);
    console.log(`Costo totale farine: CHF ${totalCost.toFixed(2)}`);
    console.log(`Margine totale: CHF ${totalMargin.toFixed(2)}`);
    console.log(`Margine medio: ${totalMarginPct.toFixed(1)}%`);

    console.log(`\nMedia mensile:`);
    console.log(`   Fatturato: CHF ${(totalRevenue / 6).toFixed(2)}`);
    console.log(`   Margine: CHF ${(totalMargin / 6).toFixed(2)}`);

    if (totalMarginPct < 25) {
      const currentMarginMonthly = totalMargin / 6;
      const targetMarginPct = 25;
      const targetMarginMonthly = (totalRevenue / 6) * (targetMarginPct / 100);
      const extraMargin = targetMarginMonthly - currentMarginMonthly;

      console.log(`\n💡 Se porti il margine farine al ${targetMarginPct}%:`);
      console.log(`   Margine mensile attuale: CHF ${currentMarginMonthly.toFixed(2)}`);
      console.log(`   Margine mensile target: CHF ${targetMarginMonthly.toFixed(2)}`);
      console.log(`   EXTRA MARGINE MENSILE: +CHF ${extraMargin.toFixed(2)}`);
    }
  }
}

// Esecuzione
const analyzer = new OdooAnalyzer();
analyzer.analyze().catch(console.error);
