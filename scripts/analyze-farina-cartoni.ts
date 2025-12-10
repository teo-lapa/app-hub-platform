/**
 * Analisi Farina Verace e Cartoni Pizza (Liner) - LAPA
 * Margini e stock in magazzino
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
    console.log('📊 ANALISI FARINA VERACE E CARTONI PIZZA\n');
    console.log('='.repeat(90));

    // 1. FARINA VERACE - Prodotti e Stock
    console.log('\n🌾 FARINA VERACE - PRODOTTI E STOCK');
    console.log('='.repeat(90));

    const farineProducts = await this.searchRead<any>('product.product', [
      '|', '|', '|',
      ['name', 'ilike', 'verace'],
      ['name', 'ilike', 'farina'],
      ['default_code', 'ilike', 'MEY'],
      ['name', 'ilike', 'meyerhans']
    ], [
      'id', 'name', 'default_code', 'list_price', 'standard_price', 'qty_available', 'uom_id'
    ], { limit: 100 });

    console.log(`\nProdotti farina trovati: ${farineProducts.length}`);
    console.log('\nProdotto                                          | Costo    | Prezzo   | Margine% | Stock   | Valore Stock');
    console.log('-'.repeat(110));

    let totalFarinaStock = 0;
    let totalFarinaValue = 0;

    for (const prod of farineProducts) {
      const cost = prod.standard_price || 0;
      const price = prod.list_price || 0;
      const marginPct = price > 0 ? ((price - cost) / price * 100) : 0;
      const stockValue = (prod.qty_available || 0) * cost;

      totalFarinaStock += prod.qty_available || 0;
      totalFarinaValue += stockValue;

      if (prod.qty_available > 0 || price > 20) {
        const marginWarning = marginPct < 20 ? '⚠️' : marginPct < 15 ? '🔴' : '';
        console.log(`${marginWarning}${prod.name.substring(0, 46).padEnd(46)} | ${cost.toFixed(2).padStart(8)} | ${price.toFixed(2).padStart(8)} | ${marginPct.toFixed(1).padStart(7)}% | ${(prod.qty_available || 0).toFixed(0).padStart(7)} | ${stockValue.toFixed(2).padStart(10)}`);
      }
    }

    console.log('-'.repeat(110));
    console.log(`TOTALE STOCK FARINE: ${totalFarinaStock} unità | Valore: CHF ${totalFarinaValue.toFixed(2)}`);

    // 2. VENDITE FARINA VERACE (ultimi 6 mesi)
    console.log('\n\n📈 VENDITE FARINA VERACE (Giu-Nov 2025)');
    console.log('='.repeat(90));

    // Prendi gli ID dei prodotti farina
    const farinaIds = farineProducts.map(p => p.id);

    const farinaLines = await this.searchRead<any>('account.move.line', [
      ['move_id.move_type', '=', 'out_invoice'],
      ['move_id.state', '=', 'posted'],
      ['move_id.invoice_date', '>=', '2025-06-01'],
      ['move_id.invoice_date', '<=', '2025-11-30'],
      ['product_id', 'in', farinaIds]
    ], [
      'product_id', 'quantity', 'price_subtotal', 'price_unit', 'move_id'
    ], { limit: 10000 });

    console.log(`\nRighe vendita farine trovate: ${farinaLines.length}`);

    // Raggruppa per prodotto
    const farinaSales: { [key: number]: { name: string; qty: number; revenue: number } } = {};
    for (const line of farinaLines) {
      const prodId = line.product_id?.[0];
      const prodName = line.product_id?.[1] || 'N/A';
      if (!prodId) continue;

      if (!farinaSales[prodId]) farinaSales[prodId] = { name: prodName, qty: 0, revenue: 0 };
      farinaSales[prodId].qty += line.quantity;
      farinaSales[prodId].revenue += line.price_subtotal;
    }

    const topFarinaSales = Object.entries(farinaSales)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    console.log('\nProdotto                                          | Qtà Venduta | Fatturato  | Prezzo Medio');
    console.log('-'.repeat(95));

    let totalFarinaRevenue = 0;
    let totalFarinaQty = 0;

    for (const prod of topFarinaSales.slice(0, 20)) {
      const avgPrice = prod.qty > 0 ? prod.revenue / prod.qty : 0;
      // Trova il costo
      const prodData = farineProducts.find(p => p.id === prod.id);
      const cost = prodData?.standard_price || 0;
      const marginPct = avgPrice > 0 ? ((avgPrice - cost) / avgPrice * 100) : 0;
      const marginWarning = marginPct < 20 ? '⚠️' : marginPct < 15 ? '🔴' : '';

      totalFarinaRevenue += prod.revenue;
      totalFarinaQty += prod.qty;

      console.log(`${marginWarning}${prod.name.substring(0, 46).padEnd(46)} | ${prod.qty.toFixed(0).padStart(11)} | ${prod.revenue.toFixed(2).padStart(10)} | ${avgPrice.toFixed(2)} (${marginPct.toFixed(0)}%)`);
    }

    console.log('-'.repeat(95));
    console.log(`TOTALE VENDITE FARINE: ${totalFarinaQty.toFixed(0)} unità | CHF ${totalFarinaRevenue.toFixed(2)}`);
    console.log(`MEDIA MENSILE: CHF ${(totalFarinaRevenue / 6).toFixed(2)}`);

    // 3. CARTONI PIZZA - LINER
    console.log('\n\n📦 CARTONI PIZZA (LINER) - PRODOTTI E STOCK');
    console.log('='.repeat(90));

    const cartoniProducts = await this.searchRead<any>('product.product', [
      '|', '|', '|', '|',
      ['name', 'ilike', 'cartone pizza'],
      ['name', 'ilike', 'cartoni pizza'],
      ['name', 'ilike', 'liner'],
      ['name', 'ilike', 'pizza box'],
      ['default_code', 'ilike', 'CART']
    ], [
      'id', 'name', 'default_code', 'list_price', 'standard_price', 'qty_available', 'uom_id'
    ], { limit: 200 });

    console.log(`\nProdotti cartoni trovati: ${cartoniProducts.length}`);
    console.log('\nProdotto                                          | Costo    | Prezzo   | Margine% | Stock   | Valore Stock');
    console.log('-'.repeat(110));

    let totalCartoniStock = 0;
    let totalCartoniValue = 0;

    // Ordina per valore stock
    const cartoniSorted = cartoniProducts
      .map(p => ({
        ...p,
        stockValue: (p.qty_available || 0) * (p.standard_price || 0)
      }))
      .sort((a, b) => b.stockValue - a.stockValue);

    for (const prod of cartoniSorted) {
      const cost = prod.standard_price || 0;
      const price = prod.list_price || 0;
      const marginPct = price > 0 ? ((price - cost) / price * 100) : 0;

      totalCartoniStock += prod.qty_available || 0;
      totalCartoniValue += prod.stockValue;

      if (prod.qty_available > 0) {
        console.log(`${prod.name.substring(0, 46).padEnd(46)} | ${cost.toFixed(2).padStart(8)} | ${price.toFixed(2).padStart(8)} | ${marginPct.toFixed(1).padStart(7)}% | ${(prod.qty_available || 0).toFixed(0).padStart(7)} | ${prod.stockValue.toFixed(2).padStart(10)}`);
      }
    }

    console.log('-'.repeat(110));
    console.log(`TOTALE STOCK CARTONI: ${totalCartoniStock} pezzi | Valore: CHF ${totalCartoniValue.toFixed(2)}`);

    // 4. ACQUISTI CARTONI LINER ULTIMI 3 MESI
    console.log('\n\n💰 ACQUISTI DA LINER (Set-Nov 2025)');
    console.log('='.repeat(90));

    const linerInvoices = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'in_invoice'],
      ['state', '=', 'posted'],
      ['partner_id.name', 'ilike', 'liner'],
      ['invoice_date', '>=', '2025-09-01'],
      ['invoice_date', '<=', '2025-11-30']
    ], [
      'id', 'name', 'invoice_date', 'amount_untaxed', 'amount_total'
    ], { order: 'invoice_date desc' });

    console.log(`\nFatture Liner trovate: ${linerInvoices.length}`);
    let totalLinerPurchases = 0;

    for (const inv of linerInvoices) {
      totalLinerPurchases += inv.amount_untaxed;
      console.log(`${inv.invoice_date} | ${inv.name.padEnd(20)} | CHF ${inv.amount_untaxed.toFixed(2).padStart(12)}`);
    }
    console.log('-'.repeat(60));
    console.log(`TOTALE ACQUISTI LINER (3 mesi): CHF ${totalLinerPurchases.toFixed(2)}`);

    // 5. VENDITE CARTONI (ultimi 6 mesi)
    console.log('\n\n📈 VENDITE CARTONI PIZZA (Giu-Nov 2025)');
    console.log('='.repeat(90));

    const cartoniIds = cartoniProducts.map(p => p.id);

    const cartoniLines = await this.searchRead<any>('account.move.line', [
      ['move_id.move_type', '=', 'out_invoice'],
      ['move_id.state', '=', 'posted'],
      ['move_id.invoice_date', '>=', '2025-06-01'],
      ['move_id.invoice_date', '<=', '2025-11-30'],
      ['product_id', 'in', cartoniIds]
    ], [
      'product_id', 'quantity', 'price_subtotal', 'price_unit'
    ], { limit: 10000 });

    // Raggruppa per prodotto
    const cartoniSales: { [key: number]: { name: string; qty: number; revenue: number } } = {};
    for (const line of cartoniLines) {
      const prodId = line.product_id?.[0];
      const prodName = line.product_id?.[1] || 'N/A';
      if (!prodId) continue;

      if (!cartoniSales[prodId]) cartoniSales[prodId] = { name: prodName, qty: 0, revenue: 0 };
      cartoniSales[prodId].qty += line.quantity;
      cartoniSales[prodId].revenue += line.price_subtotal;
    }

    const topCartoniSales = Object.entries(cartoniSales)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    console.log('\nProdotto                                          | Qtà Venduta | Fatturato  | Prezzo Medio');
    console.log('-'.repeat(95));

    let totalCartoniRevenue = 0;
    let totalCartoniQtySold = 0;

    for (const prod of topCartoniSales.slice(0, 20)) {
      const avgPrice = prod.qty > 0 ? prod.revenue / prod.qty : 0;
      totalCartoniRevenue += prod.revenue;
      totalCartoniQtySold += prod.qty;

      console.log(`${prod.name.substring(0, 46).padEnd(46)} | ${prod.qty.toFixed(0).padStart(11)} | ${prod.revenue.toFixed(2).padStart(10)} | ${avgPrice.toFixed(3)}`);
    }

    console.log('-'.repeat(95));
    console.log(`TOTALE VENDITE CARTONI: ${totalCartoniQtySold.toFixed(0)} pezzi | CHF ${totalCartoniRevenue.toFixed(2)}`);

    // 6. RIEPILOGO FINALE
    console.log('\n\n' + '='.repeat(90));
    console.log('🎯 RIEPILOGO FINALE');
    console.log('='.repeat(90));

    console.log('\n📦 STOCK IN MAGAZZINO:');
    console.log(`   Farine: CHF ${totalFarinaValue.toFixed(2)}`);
    console.log(`   Cartoni: CHF ${totalCartoniValue.toFixed(2)}`);
    console.log(`   TOTALE: CHF ${(totalFarinaValue + totalCartoniValue).toFixed(2)}`);

    console.log('\n💰 ACQUISTI LINER (3 mesi): CHF ' + totalLinerPurchases.toFixed(2));
    console.log('📈 VENDITE CARTONI (6 mesi): CHF ' + totalCartoniRevenue.toFixed(2));

    const cartoniStockMonths = totalCartoniRevenue > 0 ? (totalCartoniValue / (totalCartoniRevenue / 6)) : 0;
    console.log(`\n⏱️ MESI DI STOCK CARTONI: ${cartoniStockMonths.toFixed(1)} mesi`);

    if (cartoniStockMonths > 2) {
      console.log('   ⚠️ Hai più di 2 mesi di stock cartoni - capitale bloccato!');
    }

    console.log('\n🌾 FARINE:');
    console.log(`   Fatturato 6 mesi: CHF ${totalFarinaRevenue.toFixed(2)}`);
    console.log(`   Media mensile: CHF ${(totalFarinaRevenue / 6).toFixed(2)}`);

    // Calcola margine medio farine
    let totalFarinaCost = 0;
    for (const prod of topFarinaSales) {
      const prodData = farineProducts.find(p => p.id === prod.id);
      totalFarinaCost += prod.qty * (prodData?.standard_price || 0);
    }
    const farinaMarginPct = totalFarinaRevenue > 0 ? ((totalFarinaRevenue - totalFarinaCost) / totalFarinaRevenue * 100) : 0;

    console.log(`   Margine medio: ${farinaMarginPct.toFixed(1)}%`);
    if (farinaMarginPct < 20) {
      console.log('   🔴 MARGINE TROPPO BASSO! Serve aumento prezzi.');
      const targetMargin = 25;
      const priceIncrease = ((targetMargin - farinaMarginPct) / (100 - targetMargin)) * 100;
      console.log(`   💡 Per arrivare al ${targetMargin}% di margine, aumentare prezzi del +${priceIncrease.toFixed(1)}%`);
    }
  }
}

// Esecuzione
const analyzer = new OdooAnalyzer();
analyzer.analyze().catch(console.error);
