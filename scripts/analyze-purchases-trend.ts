/**
 * Analisi Trend Acquisti Merci - LAPA
 * Confronto dettagliato Giu-Nov per capire perché gli acquisti sono esplosi
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

  async analyzePurchasesTrend() {
    console.log('📊 ANALISI TREND ACQUISTI MERCI - GIU-NOV 2025\n');
    console.log('='.repeat(90));

    const months = [
      { name: 'Giugno', start: '2025-06-01', end: '2025-06-30' },
      { name: 'Luglio', start: '2025-07-01', end: '2025-07-31' },
      { name: 'Agosto', start: '2025-08-01', end: '2025-08-31' },
      { name: 'Settembre', start: '2025-09-01', end: '2025-09-30' },
      { name: 'Ottobre', start: '2025-10-01', end: '2025-10-31' },
      { name: 'Novembre', start: '2025-11-01', end: '2025-11-30' },
    ];

    // Raccolta dati per ogni mese
    const monthlyData: any[] = [];

    for (const month of months) {
      const invoices = await this.searchRead<any>('account.move', [
        ['move_type', '=', 'in_invoice'],
        ['state', '=', 'posted'],
        ['invoice_date', '>=', month.start],
        ['invoice_date', '<=', month.end]
      ], [
        'id', 'name', 'partner_id', 'invoice_date', 'amount_untaxed', 'create_date'
      ], { order: 'amount_untaxed desc' });

      // Raggruppa per fornitore
      const bySupplier: { [key: string]: { name: string; total: number; count: number } } = {};

      for (const inv of invoices) {
        const suppId = inv.partner_id?.[0]?.toString() || 'N/A';
        const suppName = inv.partner_id?.[1] || 'Sconosciuto';
        if (!bySupplier[suppId]) bySupplier[suppId] = { name: suppName, total: 0, count: 0 };
        bySupplier[suppId].total += inv.amount_untaxed;
        bySupplier[suppId].count++;
      }

      const total = invoices.reduce((sum, inv) => sum + inv.amount_untaxed, 0);

      monthlyData.push({
        month: month.name,
        total,
        count: invoices.length,
        suppliers: bySupplier,
        invoices
      });
    }

    // 1. RIEPILOGO MENSILE
    console.log('\n📅 RIEPILOGO ACQUISTI MENSILI');
    console.log('-'.repeat(60));
    console.log('Mese        | Fatture | Totale Acquisti | vs Giugno');
    console.log('-'.repeat(60));

    const baseMonth = monthlyData[0].total; // Giugno come base
    for (const data of monthlyData) {
      const diff = data.total - baseMonth;
      const diffPct = (diff / baseMonth * 100).toFixed(1);
      const arrow = diff > 10000 ? '📈⚠️' : diff > 0 ? '📈' : '📉';
      console.log(`${data.month.padEnd(11)} | ${data.count.toString().padStart(7)} | ${data.total.toFixed(0).padStart(15)} | ${arrow} ${diff > 0 ? '+' : ''}${diff.toFixed(0)} (${diffPct}%)`);
    }

    // 2. CONFRONTO FORNITORI: Chi è cresciuto di più?
    console.log('\n' + '='.repeat(90));
    console.log('🔍 CONFRONTO FORNITORI: GIUGNO vs NOVEMBRE');
    console.log('='.repeat(90));

    const juneSuppliers = monthlyData[0].suppliers;
    const novSuppliers = monthlyData[5].suppliers;

    // Trova tutti i fornitori
    const allSupplierIds = new Set([
      ...Object.keys(juneSuppliers),
      ...Object.keys(novSuppliers)
    ]);

    const supplierComparison: any[] = [];
    for (const suppId of allSupplierIds) {
      const june = juneSuppliers[suppId]?.total || 0;
      const nov = novSuppliers[suppId]?.total || 0;
      const name = juneSuppliers[suppId]?.name || novSuppliers[suppId]?.name || 'Sconosciuto';
      const diff = nov - june;

      supplierComparison.push({ suppId, name, june, nov, diff });
    }

    // Ordina per differenza (chi è cresciuto di più)
    supplierComparison.sort((a, b) => b.diff - a.diff);

    console.log('\n🔴 FORNITORI CON MAGGIORE AUMENTO (Novembre vs Giugno):');
    console.log('-'.repeat(90));
    console.log('Fornitore                                    | Giugno     | Novembre   | Differenza');
    console.log('-'.repeat(90));

    for (const supp of supplierComparison.slice(0, 20)) {
      if (supp.diff > 0) {
        console.log(`${supp.name.substring(0, 42).padEnd(42)} | ${supp.june.toFixed(0).padStart(10)} | ${supp.nov.toFixed(0).padStart(10)} | +${supp.diff.toFixed(0).padStart(9)}`);
      }
    }

    // Fornitori che sono diminuiti
    console.log('\n🟢 FORNITORI DIMINUITI:');
    const decreased = supplierComparison.filter(s => s.diff < -1000).sort((a, b) => a.diff - b.diff);
    for (const supp of decreased.slice(0, 10)) {
      console.log(`${supp.name.substring(0, 42).padEnd(42)} | ${supp.june.toFixed(0).padStart(10)} | ${supp.nov.toFixed(0).padStart(10)} | ${supp.diff.toFixed(0).padStart(10)}`);
    }

    // Nuovi fornitori (non c'erano a giugno)
    console.log('\n🆕 NUOVI FORNITORI (non presenti a Giugno):');
    const newSuppliers = supplierComparison.filter(s => s.june === 0 && s.nov > 500).sort((a, b) => b.nov - a.nov);
    for (const supp of newSuppliers.slice(0, 15)) {
      console.log(`${supp.name.substring(0, 42).padEnd(42)} | ${'-'.padStart(10)} | ${supp.nov.toFixed(0).padStart(10)} | NUOVO`);
    }

    // 3. TREND MENSILE PER TOP FORNITORI
    console.log('\n' + '='.repeat(90));
    console.log('📈 TREND MENSILE TOP 15 FORNITORI');
    console.log('='.repeat(90));

    // Calcola totale per fornitore su tutti i mesi
    const supplierTotals: { [key: string]: { name: string; byMonth: number[]; total: number } } = {};

    for (let i = 0; i < monthlyData.length; i++) {
      for (const [suppId, data] of Object.entries(monthlyData[i].suppliers) as any) {
        if (!supplierTotals[suppId]) {
          supplierTotals[suppId] = { name: data.name, byMonth: [0, 0, 0, 0, 0, 0], total: 0 };
        }
        supplierTotals[suppId].byMonth[i] = data.total;
        supplierTotals[suppId].total += data.total;
      }
    }

    const topSuppliers = Object.values(supplierTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    console.log('\nFornitore                          | Giu    | Lug    | Ago    | Set    | Ott    | Nov    | Trend');
    console.log('-'.repeat(110));

    for (const supp of topSuppliers) {
      const values = supp.byMonth.map(v => v.toFixed(0).padStart(6)).join(' | ');
      const trend = supp.byMonth[5] > supp.byMonth[0] * 1.3 ? '📈⚠️' :
                    supp.byMonth[5] > supp.byMonth[0] ? '📈' :
                    supp.byMonth[5] < supp.byMonth[0] * 0.7 ? '📉' : '➡️';
      console.log(`${supp.name.substring(0, 32).padEnd(32)} | ${values} | ${trend}`);
    }

    // 4. TOTALE AUMENTO E DIAGNOSI
    console.log('\n' + '='.repeat(90));
    console.log('🎯 DIAGNOSI AUMENTO ACQUISTI');
    console.log('='.repeat(90));

    const juneTotal = monthlyData[0].total;
    const novTotal = monthlyData[5].total;
    const totalIncrease = novTotal - juneTotal;

    console.log(`\nAcquisti Giugno: CHF ${juneTotal.toFixed(0)}`);
    console.log(`Acquisti Novembre: CHF ${novTotal.toFixed(0)}`);
    console.log(`AUMENTO TOTALE: CHF ${totalIncrease.toFixed(0)} (+${(totalIncrease/juneTotal*100).toFixed(1)}%)`);

    // Chi ha contribuito di più all'aumento
    const topIncreases = supplierComparison.filter(s => s.diff > 0).slice(0, 10);
    const topIncreaseTotal = topIncreases.reduce((sum, s) => sum + s.diff, 0);

    console.log(`\n📊 I TOP 10 fornitori con maggiore aumento spiegano CHF ${topIncreaseTotal.toFixed(0)} dell'aumento`);
    console.log(`   Questo è il ${(topIncreaseTotal / totalIncrease * 100).toFixed(0)}% dell'aumento totale`);

    // 5. ANALISI FATTURE ANOMALE OTTOBRE-NOVEMBRE
    console.log('\n' + '='.repeat(90));
    console.log('🔍 FATTURE PIÙ GRANDI OTTOBRE + NOVEMBRE');
    console.log('='.repeat(90));

    const octNovInvoices = [...monthlyData[4].invoices, ...monthlyData[5].invoices]
      .sort((a: any, b: any) => b.amount_untaxed - a.amount_untaxed)
      .slice(0, 30);

    console.log('\nData       | Importo      | Fornitore                                  | Registrata');
    console.log('-'.repeat(100));

    for (const inv of octNovInvoices) {
      const regDate = inv.create_date?.substring(0, 10) || '';
      const late = inv.invoice_date !== regDate ? `⚠️ ${regDate}` : '✓';
      console.log(`${inv.invoice_date} | ${inv.amount_untaxed.toFixed(2).padStart(12)} | ${inv.partner_id?.[1]?.substring(0, 40).padEnd(40)} | ${late}`);
    }
  }
}

// Esecuzione
const analyzer = new OdooAnalyzer();
analyzer.analyzePurchasesTrend().catch(console.error);
