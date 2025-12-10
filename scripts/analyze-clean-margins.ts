/**
 * Analisi Margini PULITI - LAPA
 * Esclude storni fine anno e analizza la situazione reale post-ristrutturazione
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
      console.log('✅ Autenticazione riuscita\n');
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

  async analyzeCleanMargins() {
    console.log('📊 ANALISI MARGINI PULITI - LAPA (Post-ristrutturazione)\n');
    console.log('='.repeat(70));

    // 1. ANALISI FATTURE CLIENTI (vendite)
    console.log('\n📈 ANALISI VENDITE (Fatture Clienti)\n');

    const salesInvoices = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-01-01'],
      ['invoice_date', '<=', '2025-11-30']
    ], [
      'id', 'name', 'partner_id', 'invoice_date', 'amount_untaxed', 'amount_total'
    ], { order: 'invoice_date desc' });

    console.log(`Totale fatture vendita: ${salesInvoices.length}`);

    // Raggruppa per mese
    const salesByMonth: { [key: string]: { count: number; total: number } } = {};
    for (const inv of salesInvoices) {
      const month = inv.invoice_date?.substring(0, 7) || 'N/A';
      if (!salesByMonth[month]) salesByMonth[month] = { count: 0, total: 0 };
      salesByMonth[month].count++;
      salesByMonth[month].total += inv.amount_untaxed;
    }

    // 2. ANALISI ACQUISTI
    console.log('\n📉 ANALISI ACQUISTI (Fatture Fornitori)\n');

    const purchaseInvoices = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'in_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-01-01'],
      ['invoice_date', '<=', '2025-11-30']
    ], [
      'id', 'name', 'partner_id', 'invoice_date', 'amount_untaxed', 'amount_total'
    ], { order: 'invoice_date desc' });

    const purchasesByMonth: { [key: string]: { count: number; total: number } } = {};
    for (const inv of purchaseInvoices) {
      const month = inv.invoice_date?.substring(0, 7) || 'N/A';
      if (!purchasesByMonth[month]) purchasesByMonth[month] = { count: 0, total: 0 };
      purchasesByMonth[month].count++;
      purchasesByMonth[month].total += inv.amount_untaxed;
    }

    // 3. ANALISI MAGAZZINO
    console.log('\n📦 ANALISI MAGAZZINO\n');

    const products = await this.searchRead<any>('product.product', [
      ['type', '=', 'product'],
      ['qty_available', '>', 0]
    ], [
      'id', 'name', 'qty_available', 'standard_price', 'list_price', 'categ_id'
    ], { limit: 5000 });

    let totalStockValue = 0;
    let totalStockItems = 0;
    const stockByCategory: { [key: string]: { qty: number; value: number } } = {};

    for (const prod of products) {
      const value = prod.qty_available * (prod.standard_price || 0);
      totalStockValue += value;
      totalStockItems += prod.qty_available;

      const categ = prod.categ_id?.[1] || 'Senza categoria';
      if (!stockByCategory[categ]) stockByCategory[categ] = { qty: 0, value: 0 };
      stockByCategory[categ].qty += prod.qty_available;
      stockByCategory[categ].value += value;
    }

    // 4. CONFRONTO PERIODO PULITO (Giu-Nov 2025) vs PERIODO SPORCO (Gen-Mag 2025)
    console.log('='.repeat(70));
    console.log('📊 CONFRONTO: PERIODO PULITO vs PERIODO CON CLIENTE PROBLEMATICO');
    console.log('='.repeat(70));

    const dirtyMonths = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
    const cleanMonths = ['2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11'];

    // Storni da escludere (dal conto 4210)
    const storni: { [key: string]: number } = {
      '2025-11': 3974.18,
      '2025-10': 8199.37,
      '2025-09': 8283.26,
      '2025-08': 12514.41,
      '2025-07': 7219.38,
      '2025-06': 15910.06,
      '2025-05': 18228.74,
      '2025-04': 38242.99,
      '2025-03': 21572.57,
      '2025-02': 26689.67
    };

    console.log('\n📅 DETTAGLIO MENSILE (Giugno - Novembre 2025 = Periodo PULITO):\n');
    console.log('Mese      | Vendite    | Acquisti   | Storno    | Vendite Nette | Margine Lordo | %');
    console.log('-'.repeat(90));

    let totalCleanSales = 0;
    let totalCleanPurchases = 0;
    let totalCleanStorni = 0;

    for (const month of cleanMonths) {
      const sales = salesByMonth[month]?.total || 0;
      const purchases = purchasesByMonth[month]?.total || 0;
      const storno = storni[month] || 0;
      const netSales = sales; // Le vendite sono già al netto nel fatturato
      const margin = netSales - purchases;
      const marginPct = netSales > 0 ? (margin / netSales * 100) : 0;

      totalCleanSales += sales;
      totalCleanPurchases += purchases;
      totalCleanStorni += storno;

      const marginColor = margin >= 0 ? '' : '🔴';
      console.log(`${month}   | ${sales.toFixed(0).padStart(10)} | ${purchases.toFixed(0).padStart(10)} | ${storno.toFixed(0).padStart(9)} | ${netSales.toFixed(0).padStart(13)} | ${marginColor}${margin.toFixed(0).padStart(13)} | ${marginPct.toFixed(1)}%`);
    }

    const totalCleanMargin = totalCleanSales - totalCleanPurchases;
    const totalCleanMarginPct = totalCleanSales > 0 ? (totalCleanMargin / totalCleanSales * 100) : 0;

    console.log('-'.repeat(90));
    console.log(`TOTALE    | ${totalCleanSales.toFixed(0).padStart(10)} | ${totalCleanPurchases.toFixed(0).padStart(10)} | ${totalCleanStorni.toFixed(0).padStart(9)} | ${totalCleanSales.toFixed(0).padStart(13)} | ${totalCleanMargin.toFixed(0).padStart(13)} | ${totalCleanMarginPct.toFixed(1)}%`);

    // Periodo sporco per confronto
    console.log('\n📅 DETTAGLIO MENSILE (Gennaio - Maggio 2025 = Periodo con cliente):\n');
    console.log('Mese      | Vendite    | Acquisti   | Storno    | Margine Lordo | %');
    console.log('-'.repeat(80));

    let totalDirtySales = 0;
    let totalDirtyPurchases = 0;
    let totalDirtyStorni = 0;

    for (const month of dirtyMonths) {
      const sales = salesByMonth[month]?.total || 0;
      const purchases = purchasesByMonth[month]?.total || 0;
      const storno = storni[month] || 0;
      const margin = sales - purchases;
      const marginPct = sales > 0 ? (margin / sales * 100) : 0;

      totalDirtySales += sales;
      totalDirtyPurchases += purchases;
      totalDirtyStorni += storno;

      console.log(`${month}   | ${sales.toFixed(0).padStart(10)} | ${purchases.toFixed(0).padStart(10)} | ${storno.toFixed(0).padStart(9)} | ${margin.toFixed(0).padStart(13)} | ${marginPct.toFixed(1)}%`);
    }

    const totalDirtyMargin = totalDirtySales - totalDirtyPurchases;

    console.log('-'.repeat(80));
    console.log(`TOTALE    | ${totalDirtySales.toFixed(0).padStart(10)} | ${totalDirtyPurchases.toFixed(0).padStart(10)} | ${totalDirtyStorni.toFixed(0).padStart(9)} | ${totalDirtyMargin.toFixed(0).padStart(13)} |`);

    // 5. MAGAZZINO DETTAGLIO
    console.log('\n' + '='.repeat(70));
    console.log('📦 VALORE MAGAZZINO ATTUALE');
    console.log('='.repeat(70));

    console.log(`\nTotale prodotti in stock: ${products.length}`);
    console.log(`Totale quantità: ${totalStockItems.toFixed(0)} unità`);
    console.log(`Valore totale magazzino: CHF ${totalStockValue.toFixed(2)}`);

    console.log('\n📦 TOP 10 CATEGORIE PER VALORE:\n');

    const sortedCategories = Object.entries(stockByCategory)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10);

    for (const [categ, data] of sortedCategories) {
      console.log(`${categ.substring(0, 40).padEnd(40)} | ${data.qty.toFixed(0).padStart(8)} pz | CHF ${data.value.toFixed(2).padStart(12)}`);
    }

    // 6. PRODOTTI CON PIÙ VALORE IN STOCK
    console.log('\n📦 TOP 20 PRODOTTI PER VALORE IN MAGAZZINO:\n');

    const productsWithValue = products.map(p => ({
      ...p,
      stockValue: p.qty_available * (p.standard_price || 0)
    })).sort((a, b) => b.stockValue - a.stockValue).slice(0, 20);

    for (const prod of productsWithValue) {
      console.log(`${prod.name.substring(0, 45).padEnd(45)} | ${prod.qty_available.toFixed(0).padStart(6)} pz | CHF ${prod.stockValue.toFixed(2).padStart(10)}`);
    }

    // 7. ANALISI FINALE
    console.log('\n' + '='.repeat(70));
    console.log('🎯 RIEPILOGO E DIAGNOSI');
    console.log('='.repeat(70));

    const avgCleanMonthlySales = totalCleanSales / cleanMonths.length;
    const avgCleanMonthlyPurchases = totalCleanPurchases / cleanMonths.length;
    const avgCleanMonthlyMargin = totalCleanMargin / cleanMonths.length;

    const avgDirtyMonthlySales = totalDirtySales / dirtyMonths.length;

    console.log(`\n📊 PERIODO PULITO (Giu-Nov 2025):`);
    console.log(`   Media vendite mensili: CHF ${avgCleanMonthlySales.toFixed(0)}`);
    console.log(`   Media acquisti mensili: CHF ${avgCleanMonthlyPurchases.toFixed(0)}`);
    console.log(`   Media margine lordo mensile: CHF ${avgCleanMonthlyMargin.toFixed(0)}`);
    console.log(`   Margine lordo %: ${totalCleanMarginPct.toFixed(1)}%`);

    console.log(`\n📊 PERIODO CON CLIENTE (Gen-Mag 2025):`);
    console.log(`   Media vendite mensili: CHF ${avgDirtyMonthlySales.toFixed(0)}`);

    const salesDrop = avgDirtyMonthlySales - avgCleanMonthlySales;
    const salesDropPct = (salesDrop / avgDirtyMonthlySales * 100);

    console.log(`\n⚠️  CALO FATTURATO dopo chiusura cliente: CHF ${salesDrop.toFixed(0)}/mese (${salesDropPct.toFixed(1)}%)`);

    console.log(`\n📦 MAGAZZINO:`);
    console.log(`   Valore attuale: CHF ${totalStockValue.toFixed(0)}`);
    console.log(`   Questo è circa ${(totalStockValue / avgCleanMonthlyPurchases).toFixed(1)} mesi di acquisti`);

    // Calcolo se il magazzino è gonfio
    const normalStockMonths = 1.5; // Normalmente 1-2 mesi di stock
    const expectedStock = avgCleanMonthlyPurchases * normalStockMonths;
    const excessStock = totalStockValue - expectedStock;

    if (excessStock > 0) {
      console.log(`   ⚠️  ECCESSO MAGAZZINO stimato: CHF ${excessStock.toFixed(0)}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('💡 DOVE POTREBBERO ESSERE I SOLDI:');
    console.log('='.repeat(70));
    console.log(`\n1. Storni cliente chiuso (pagati in anticipo): ~CHF 70.000`);
    console.log(`2. Magazzino potenzialmente in eccesso: ~CHF ${Math.max(0, excessStock).toFixed(0)}`);
    console.log(`3. Calo fatturato non compensato: ~CHF ${(salesDrop * 6).toFixed(0)} (su 6 mesi)`);
  }
}

// Esecuzione
const analyzer = new OdooAnalyzer();
analyzer.analyzeCleanMargins().catch(console.error);
