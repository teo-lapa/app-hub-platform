/**
 * Analisi Margini per Prodotto - LAPA
 * Trova dove aumentare i prezzi e dove tagliare
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

  async analyzeProductMargins() {
    console.log('📊 ANALISI MARGINI PER PRODOTTO - LAPA\n');
    console.log('='.repeat(80));

    // 1. Recupera tutti i prodotti con prezzi
    console.log('\n🔍 Recupero prodotti...\n');

    const products = await this.searchRead<any>('product.template', [
      ['sale_ok', '=', true],
      ['list_price', '>', 0]
    ], [
      'id', 'name', 'list_price', 'standard_price', 'categ_id', 'default_code',
      'type', 'uom_id'
    ], { limit: 5000 });

    console.log(`Totale prodotti vendibili: ${products.length}\n`);

    // Calcola margine per ogni prodotto
    const productsWithMargin = products.map(p => {
      const cost = p.standard_price || 0;
      const price = p.list_price || 0;
      const margin = price - cost;
      const marginPct = price > 0 ? (margin / price * 100) : 0;
      return {
        ...p,
        cost,
        price,
        margin,
        marginPct
      };
    }).filter(p => p.cost > 0 && p.price > 0); // Solo prodotti con costi e prezzi definiti

    console.log(`Prodotti con costi e prezzi definiti: ${productsWithMargin.length}\n`);

    // 2. PRODOTTI CON MARGINE PIÙ ALTO (dove sei forte)
    console.log('='.repeat(80));
    console.log('💰 TOP 30 PRODOTTI CON MARGINE % PIÙ ALTO (puoi aumentare ancora?)');
    console.log('='.repeat(80));
    console.log('\nProdotto                                          | Costo    | Prezzo   | Margine  | %');
    console.log('-'.repeat(95));

    const highMargin = [...productsWithMargin]
      .sort((a, b) => b.marginPct - a.marginPct)
      .slice(0, 30);

    for (const p of highMargin) {
      console.log(`${p.name.substring(0, 48).padEnd(48)} | ${p.cost.toFixed(2).padStart(8)} | ${p.price.toFixed(2).padStart(8)} | ${p.margin.toFixed(2).padStart(8)} | ${p.marginPct.toFixed(1)}%`);
    }

    // 3. PRODOTTI CON MARGINE PIÙ BASSO (problematici)
    console.log('\n' + '='.repeat(80));
    console.log('🔴 TOP 30 PRODOTTI CON MARGINE % PIÙ BASSO (dove perdi o guadagni poco)');
    console.log('='.repeat(80));
    console.log('\nProdotto                                          | Costo    | Prezzo   | Margine  | %');
    console.log('-'.repeat(95));

    const lowMargin = [...productsWithMargin]
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, 30);

    for (const p of lowMargin) {
      const warning = p.marginPct < 10 ? '⚠️' : p.marginPct < 0 ? '🔴' : '';
      console.log(`${warning}${p.name.substring(0, 46).padEnd(46)} | ${p.cost.toFixed(2).padStart(8)} | ${p.price.toFixed(2).padStart(8)} | ${p.margin.toFixed(2).padStart(8)} | ${p.marginPct.toFixed(1)}%`);
    }

    // 4. PRODOTTI IN PERDITA
    const losingProducts = productsWithMargin.filter(p => p.marginPct < 0);
    if (losingProducts.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🚨 PRODOTTI IN PERDITA (prezzo < costo)');
      console.log('='.repeat(80));

      for (const p of losingProducts) {
        console.log(`🔴 ${p.name.substring(0, 45).padEnd(45)} | Costo: ${p.cost.toFixed(2)} | Prezzo: ${p.price.toFixed(2)} | Perdita: ${p.margin.toFixed(2)}`);
      }
    }

    // 5. ANALISI PER CATEGORIA
    console.log('\n' + '='.repeat(80));
    console.log('📦 MARGINE MEDIO PER CATEGORIA');
    console.log('='.repeat(80));

    const byCategory: { [key: string]: { count: number; totalMarginPct: number; products: any[] } } = {};

    for (const p of productsWithMargin) {
      const categ = p.categ_id?.[1] || 'Senza categoria';
      if (!byCategory[categ]) byCategory[categ] = { count: 0, totalMarginPct: 0, products: [] };
      byCategory[categ].count++;
      byCategory[categ].totalMarginPct += p.marginPct;
      byCategory[categ].products.push(p);
    }

    const categories = Object.entries(byCategory)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgMargin: data.totalMarginPct / data.count,
        products: data.products
      }))
      .filter(c => c.count >= 3) // Solo categorie con almeno 3 prodotti
      .sort((a, b) => b.avgMargin - a.avgMargin);

    console.log('\nCategoria                                         | Prodotti | Margine Medio %');
    console.log('-'.repeat(75));

    for (const cat of categories.slice(0, 20)) {
      const bar = '█'.repeat(Math.min(30, Math.floor(cat.avgMargin / 2)));
      console.log(`${cat.name.substring(0, 48).padEnd(48)} | ${cat.count.toString().padStart(8)} | ${cat.avgMargin.toFixed(1)}% ${bar}`);
    }

    // Categorie con margine basso
    console.log('\n🔴 CATEGORIE CON MARGINE BASSO (< 20%):');
    const lowMarginCategories = categories.filter(c => c.avgMargin < 20);
    for (const cat of lowMarginCategories) {
      console.log(`   ${cat.name}: ${cat.avgMargin.toFixed(1)}% (${cat.count} prodotti)`);
    }

    // 6. SUGGERIMENTI DI AUMENTO PREZZO
    console.log('\n' + '='.repeat(80));
    console.log('💡 SUGGERIMENTI: PRODOTTI DOVE AUMENTARE IL PREZZO');
    console.log('='.repeat(80));

    // Prodotti con margine tra 15-30% e prezzo > 5 CHF (facili da aumentare)
    const canIncrease = productsWithMargin
      .filter(p => p.marginPct >= 15 && p.marginPct <= 35 && p.price >= 5)
      .sort((a, b) => b.price - a.price)
      .slice(0, 25);

    console.log('\nProdotti con buon margine dove un +5% non si noterebbe:\n');
    console.log('Prodotto                                          | Prezzo Att. | +5%      | Extra Margine');
    console.log('-'.repeat(90));

    let totalExtraMargin = 0;
    for (const p of canIncrease) {
      const newPrice = p.price * 1.05;
      const extraMargin = newPrice - p.price;
      totalExtraMargin += extraMargin;
      console.log(`${p.name.substring(0, 48).padEnd(48)} | ${p.price.toFixed(2).padStart(11)} | ${newPrice.toFixed(2).padStart(8)} | +${extraMargin.toFixed(2)}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 RIEPILOGO ANALISI MARGINI');
    console.log('='.repeat(80));

    const avgMargin = productsWithMargin.reduce((sum, p) => sum + p.marginPct, 0) / productsWithMargin.length;
    const productsUnder15 = productsWithMargin.filter(p => p.marginPct < 15).length;
    const productsUnder10 = productsWithMargin.filter(p => p.marginPct < 10).length;
    const productsNegative = productsWithMargin.filter(p => p.marginPct < 0).length;

    console.log(`\nMargine medio prodotti: ${avgMargin.toFixed(1)}%`);
    console.log(`Prodotti con margine < 15%: ${productsUnder15} (${(productsUnder15/productsWithMargin.length*100).toFixed(1)}%)`);
    console.log(`Prodotti con margine < 10%: ${productsUnder10} (${(productsUnder10/productsWithMargin.length*100).toFixed(1)}%)`);
    console.log(`Prodotti in perdita: ${productsNegative}`);

    console.log('\n💰 POTENZIALE AUMENTO PREZZI:');
    console.log(`   Se aumenti del 5% i 25 prodotti suggeriti sopra:`);
    console.log(`   Extra margine per unità venduta: +CHF ${totalExtraMargin.toFixed(2)}`);

    // 7. Analisi vendite per vedere quali prodotti vendono di più
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALISI VENDITE ULTIMI 6 MESI (Giu-Nov 2025)');
    console.log('='.repeat(80));

    const invoiceLines = await this.searchRead<any>('account.move.line', [
      ['move_id.move_type', '=', 'out_invoice'],
      ['move_id.state', '=', 'posted'],
      ['move_id.invoice_date', '>=', '2025-06-01'],
      ['move_id.invoice_date', '<=', '2025-11-30'],
      ['product_id', '!=', false],
      ['quantity', '>', 0]
    ], [
      'product_id', 'quantity', 'price_subtotal', 'price_unit'
    ], { limit: 50000 });

    console.log(`\nRighe fattura analizzate: ${invoiceLines.length}`);

    // Raggruppa per prodotto
    const salesByProduct: { [key: number]: { name: string; qty: number; revenue: number } } = {};

    for (const line of invoiceLines) {
      const prodId = line.product_id?.[0];
      const prodName = line.product_id?.[1] || 'N/A';
      if (!prodId) continue;

      if (!salesByProduct[prodId]) salesByProduct[prodId] = { name: prodName, qty: 0, revenue: 0 };
      salesByProduct[prodId].qty += line.quantity;
      salesByProduct[prodId].revenue += line.price_subtotal;
    }

    // Top prodotti per fatturato
    const topByRevenue = Object.entries(salesByProduct)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 30);

    console.log('\n🏆 TOP 30 PRODOTTI PER FATTURATO (Giu-Nov 2025):');
    console.log('\nProdotto                                          | Qtà Venduta | Fatturato    | €/unità');
    console.log('-'.repeat(95));

    for (const p of topByRevenue) {
      const avgPrice = p.qty > 0 ? p.revenue / p.qty : 0;
      // Trova il margine di questo prodotto
      const prodWithMargin = productsWithMargin.find(pw => pw.id === p.id);
      const marginNote = prodWithMargin ? ` (${prodWithMargin.marginPct.toFixed(0)}% marg)` : '';

      console.log(`${p.name.substring(0, 48).padEnd(48)} | ${p.qty.toFixed(0).padStart(11)} | ${p.revenue.toFixed(2).padStart(12)} | ${avgPrice.toFixed(2)}${marginNote}`);
    }

    // FOCUS: Top prodotti per fatturato con margine basso
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  ATTENZIONE: PRODOTTI AD ALTO VOLUME CON MARGINE BASSO');
    console.log('='.repeat(80));
    console.log('(Questi sono i prodotti dove un piccolo aumento fa grande differenza)\n');

    const highVolumeLowMargin = topByRevenue
      .map(p => {
        const prodWithMargin = productsWithMargin.find(pw => pw.id === p.id);
        return { ...p, margin: prodWithMargin?.marginPct || null, cost: prodWithMargin?.cost || 0, price: prodWithMargin?.price || 0 };
      })
      .filter(p => p.margin !== null && p.margin < 25 && p.revenue > 5000)
      .sort((a, b) => b.revenue - a.revenue);

    console.log('Prodotto                                     | Fatturato  | Margine | Suggerimento');
    console.log('-'.repeat(90));

    for (const p of highVolumeLowMargin.slice(0, 20)) {
      const suggestion = p.margin! < 10 ? 'AUMENTARE!' : p.margin! < 20 ? '+3-5%' : '+2-3%';
      const warning = p.margin! < 10 ? '🔴' : p.margin! < 20 ? '🟡' : '';
      console.log(`${warning}${p.name.substring(0, 42).padEnd(42)} | ${p.revenue.toFixed(0).padStart(10)} | ${p.margin?.toFixed(1).padStart(6)}% | ${suggestion}`);
    }
  }
}

// Esecuzione
const analyzer = new OdooAnalyzer();
analyzer.analyzeProductMargins().catch(console.error);
