/**
 * Analisi Dettagliata NOVEMBRE 2025 - LAPA
 * Capire perché siamo a -10.607 CHF
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

  async analyzeNovember() {
    console.log('📊 ANALISI DETTAGLIATA NOVEMBRE 2025\n');
    console.log('='.repeat(80));
    console.log('Obiettivo: Capire perché siamo a -10.607 CHF\n');

    // RIEPILOGO DAL CONTO ECONOMICO (dati forniti dall'utente)
    console.log('📋 DATI DAL CONTO ECONOMICO NOVEMBRE 2025:');
    console.log('-'.repeat(50));
    console.log('Ricavi netti vendite (Fatturato):     300.538,72');
    console.log('Costo merci e materiali:             -228.745,88');
    console.log('Costi del personale:                  -50.595,60');
    console.log('Altri costi di esercizio:             -31.805,19');
    console.log('EBITDA:                               -10.607,95');
    console.log('-'.repeat(50));

    // 1. ANALISI FATTURE VENDITA NOVEMBRE
    console.log('\n' + '='.repeat(80));
    console.log('📈 FATTURE VENDITA NOVEMBRE 2025');
    console.log('='.repeat(80));

    const salesInvoices = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-11-01'],
      ['invoice_date', '<=', '2025-11-30']
    ], [
      'id', 'name', 'partner_id', 'invoice_date', 'amount_untaxed', 'amount_total', 'create_date'
    ], { order: 'amount_untaxed desc' });

    const totalSales = salesInvoices.reduce((sum, inv) => sum + inv.amount_untaxed, 0);
    console.log(`\nTotale fatture vendita: ${salesInvoices.length}`);
    console.log(`Totale netto vendite: CHF ${totalSales.toFixed(2)}`);

    // Note di credito vendita
    const salesCredits = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'out_refund'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-11-01'],
      ['invoice_date', '<=', '2025-11-30']
    ], [
      'id', 'name', 'partner_id', 'invoice_date', 'amount_untaxed', 'amount_total'
    ], { order: 'amount_untaxed desc' });

    const totalSalesCredits = salesCredits.reduce((sum, inv) => sum + inv.amount_untaxed, 0);
    console.log(`\nNote di credito a clienti: ${salesCredits.length}`);
    console.log(`Totale note credito: CHF ${totalSalesCredits.toFixed(2)}`);

    if (salesCredits.length > 0) {
      console.log('\n📋 Dettaglio note credito clienti:');
      for (const nc of salesCredits.slice(0, 15)) {
        console.log(`   ${nc.invoice_date} | ${nc.name.padEnd(20)} | CHF ${nc.amount_untaxed.toFixed(2).padStart(10)} | ${nc.partner_id?.[1]?.substring(0, 35)}`);
      }
    }

    console.log(`\n📊 VENDITE NETTE: CHF ${(totalSales - totalSalesCredits).toFixed(2)}`);

    // 2. ANALISI FATTURE ACQUISTO NOVEMBRE
    console.log('\n' + '='.repeat(80));
    console.log('📉 FATTURE ACQUISTO NOVEMBRE 2025');
    console.log('='.repeat(80));

    const purchaseInvoices = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'in_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-11-01'],
      ['invoice_date', '<=', '2025-11-30']
    ], [
      'id', 'name', 'partner_id', 'invoice_date', 'amount_untaxed', 'amount_total', 'create_date', 'ref'
    ], { order: 'amount_untaxed desc' });

    const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + inv.amount_untaxed, 0);
    console.log(`\nTotale fatture acquisto: ${purchaseInvoices.length}`);
    console.log(`Totale netto acquisti: CHF ${totalPurchases.toFixed(2)}`);

    // Top acquisti novembre
    console.log('\n📋 TOP 20 FATTURE ACQUISTO NOVEMBRE:');
    for (const inv of purchaseInvoices.slice(0, 20)) {
      const createDate = inv.create_date?.substring(0, 10) || '';
      const late = inv.invoice_date !== createDate ? ` (reg: ${createDate})` : '';
      console.log(`   ${inv.invoice_date} | CHF ${inv.amount_untaxed.toFixed(2).padStart(10)} | ${inv.partner_id?.[1]?.substring(0, 40)}${late}`);
    }

    // Note di credito fornitori
    const purchaseCredits = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'in_refund'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-11-01'],
      ['invoice_date', '<=', '2025-11-30']
    ], [
      'id', 'name', 'partner_id', 'invoice_date', 'amount_untaxed', 'amount_total'
    ], { order: 'amount_untaxed desc' });

    const totalPurchaseCredits = purchaseCredits.reduce((sum, inv) => sum + inv.amount_untaxed, 0);
    console.log(`\n📋 Note di credito da fornitori: ${purchaseCredits.length}`);
    console.log(`Totale note credito: CHF ${totalPurchaseCredits.toFixed(2)}`);

    if (purchaseCredits.length > 0) {
      console.log('\nDettaglio note credito fornitori:');
      for (const nc of purchaseCredits.slice(0, 10)) {
        console.log(`   ${nc.invoice_date} | ${nc.name.padEnd(20)} | CHF ${nc.amount_untaxed.toFixed(2).padStart(10)} | ${nc.partner_id?.[1]?.substring(0, 35)}`);
      }
    }

    console.log(`\n📊 ACQUISTI NETTI: CHF ${(totalPurchases - totalPurchaseCredits).toFixed(2)}`);

    // 3. FATTURE REGISTRATE IN RITARDO A NOVEMBRE
    console.log('\n' + '='.repeat(80));
    console.log('⏰ FATTURE CON DATA FATTURA VECCHIA REGISTRATE A NOVEMBRE');
    console.log('='.repeat(80));

    const lateInvoices = purchaseInvoices.filter(inv => {
      if (inv.invoice_date && inv.create_date) {
        const invoiceDate = new Date(inv.invoice_date);
        const createDate = new Date(inv.create_date);
        const daysDiff = Math.floor((createDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 14; // Più di 2 settimane di ritardo
      }
      return false;
    });

    let totalLateAmount = 0;
    console.log('\nFatture registrate con più di 14 giorni di ritardo:');
    for (const inv of lateInvoices) {
      const invoiceDate = new Date(inv.invoice_date);
      const createDate = new Date(inv.create_date);
      const daysDiff = Math.floor((createDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      totalLateAmount += inv.amount_untaxed;
      console.log(`   Fatt: ${inv.invoice_date} | Reg: ${inv.create_date?.substring(0, 10)} | +${daysDiff}gg | CHF ${inv.amount_untaxed.toFixed(2).padStart(10)} | ${inv.partner_id?.[1]?.substring(0, 30)}`);
    }
    console.log(`\n⚠️  TOTALE FATTURE IN RITARDO: CHF ${totalLateAmount.toFixed(2)}`);

    // 4. CONFRONTO CON OTTOBRE
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONFRONTO NOVEMBRE vs OTTOBRE 2025');
    console.log('='.repeat(80));

    const octSales = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-10-01'],
      ['invoice_date', '<=', '2025-10-31']
    ], ['amount_untaxed'], {});

    const octPurchases = await this.searchRead<any>('account.move', [
      ['move_type', '=', 'in_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', '2025-10-01'],
      ['invoice_date', '<=', '2025-10-31']
    ], ['amount_untaxed'], {});

    const totalOctSales = octSales.reduce((sum: number, inv: any) => sum + inv.amount_untaxed, 0);
    const totalOctPurchases = octPurchases.reduce((sum: number, inv: any) => sum + inv.amount_untaxed, 0);

    console.log('\n                    | OTTOBRE      | NOVEMBRE     | Differenza');
    console.log('-'.repeat(70));
    console.log(`Vendite             | ${totalOctSales.toFixed(0).padStart(12)} | ${totalSales.toFixed(0).padStart(12)} | ${(totalSales - totalOctSales).toFixed(0).padStart(10)}`);
    console.log(`Acquisti            | ${totalOctPurchases.toFixed(0).padStart(12)} | ${totalPurchases.toFixed(0).padStart(12)} | ${(totalPurchases - totalOctPurchases).toFixed(0).padStart(10)}`);
    console.log(`Margine Lordo       | ${(totalOctSales - totalOctPurchases).toFixed(0).padStart(12)} | ${(totalSales - totalPurchases).toFixed(0).padStart(12)} | ${((totalSales - totalPurchases) - (totalOctSales - totalOctPurchases)).toFixed(0).padStart(10)}`);

    // 5. ANALISI COSTI PERSONALE (se disponibile)
    console.log('\n' + '='.repeat(80));
    console.log('👥 ANALISI COSTI (dal Conto Economico)');
    console.log('='.repeat(80));

    // Dati dal conto economico mostrato dall'utente
    const costiNov = {
      personale: 50595.60,
      altriCosti: 31805.19,
      merci: 228745.88,
      fatturato: 300538.72
    };

    const costiOtt = {
      personale: 66662.81,
      altriCosti: 37118.53,
      merci: 220889.20,
      fatturato: 308552.00
    };

    console.log('\n                    | OTTOBRE      | NOVEMBRE     | Risparmio');
    console.log('-'.repeat(70));
    console.log(`Personale           | ${costiOtt.personale.toFixed(0).padStart(12)} | ${costiNov.personale.toFixed(0).padStart(12)} | ${(costiOtt.personale - costiNov.personale).toFixed(0).padStart(10)} ✅`);
    console.log(`Altri costi         | ${costiOtt.altriCosti.toFixed(0).padStart(12)} | ${costiNov.altriCosti.toFixed(0).padStart(12)} | ${(costiOtt.altriCosti - costiNov.altriCosti).toFixed(0).padStart(10)} ✅`);
    console.log(`Costo merci         | ${costiOtt.merci.toFixed(0).padStart(12)} | ${costiNov.merci.toFixed(0).padStart(12)} | ${(costiOtt.merci - costiNov.merci).toFixed(0).padStart(10)} ❌`);

    // 6. CALCOLO DEL PROBLEMA
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DIAGNOSI: PERCHÉ NOVEMBRE È IN PERDITA?');
    console.log('='.repeat(80));

    const margineNov = costiNov.fatturato - costiNov.merci;
    const margineOtt = costiOtt.fatturato - costiOtt.merci;
    const costiOperativiNov = costiNov.personale + costiNov.altriCosti;
    const costiOperativiOtt = costiOtt.personale + costiOtt.altriCosti;

    console.log('\n📊 SCOMPOSIZIONE:');
    console.log(`\nNOVEMBRE:`);
    console.log(`   Fatturato:              CHF ${costiNov.fatturato.toFixed(0)}`);
    console.log(`   - Costo merci:          CHF ${costiNov.merci.toFixed(0)}`);
    console.log(`   = Margine lordo:        CHF ${margineNov.toFixed(0)} (${(margineNov/costiNov.fatturato*100).toFixed(1)}%)`);
    console.log(`   - Personale:            CHF ${costiNov.personale.toFixed(0)}`);
    console.log(`   - Altri costi:          CHF ${costiNov.altriCosti.toFixed(0)}`);
    console.log(`   = EBITDA:               CHF ${(margineNov - costiOperativiNov).toFixed(0)}`);

    console.log(`\nOTTOBRE:`);
    console.log(`   Fatturato:              CHF ${costiOtt.fatturato.toFixed(0)}`);
    console.log(`   - Costo merci:          CHF ${costiOtt.merci.toFixed(0)}`);
    console.log(`   = Margine lordo:        CHF ${margineOtt.toFixed(0)} (${(margineOtt/costiOtt.fatturato*100).toFixed(1)}%)`);
    console.log(`   - Personale:            CHF ${costiOtt.personale.toFixed(0)}`);
    console.log(`   - Altri costi:          CHF ${costiOtt.altriCosti.toFixed(0)}`);
    console.log(`   = EBITDA:               CHF ${(margineOtt - costiOperativiOtt).toFixed(0)}`);

    // Calcolo break-even
    console.log('\n' + '='.repeat(80));
    console.log('🎯 CALCOLO BREAK-EVEN NOVEMBRE');
    console.log('='.repeat(80));

    const costiOperativi = costiNov.personale + costiNov.altriCosti; // 82.400 circa
    const marginePct = margineNov / costiNov.fatturato; // circa 24%

    const breakEvenFatturato = costiOperativi / marginePct;

    console.log(`\nCosti operativi fissi (personale + altri): CHF ${costiOperativi.toFixed(0)}`);
    console.log(`Margine lordo %: ${(marginePct * 100).toFixed(1)}%`);
    console.log(`\n🎯 BREAK-EVEN: CHF ${breakEvenFatturato.toFixed(0)} di fatturato`);
    console.log(`   Fatturato attuale: CHF ${costiNov.fatturato.toFixed(0)}`);
    console.log(`   Differenza: CHF ${(costiNov.fatturato - breakEvenFatturato).toFixed(0)}`);

    // 7. COSA SERVE PER ESSERE IN PARI
    console.log('\n' + '='.repeat(80));
    console.log('💡 COSA SERVE PER ANDARE IN PARI');
    console.log('='.repeat(80));

    const deficitEbitda = 10607.95;
    const extraSalesNeeded = deficitEbitda / marginePct;
    const priceIncreaseNeeded = (deficitEbitda / costiNov.fatturato) * 100;
    const costReductionNeeded = deficitEbitda;

    console.log(`\nPer coprire il deficit di CHF ${deficitEbitda.toFixed(0)}, serve UNA di queste opzioni:`);
    console.log(`\n   1. 📈 Aumentare fatturato di: +CHF ${extraSalesNeeded.toFixed(0)} (+${(extraSalesNeeded/costiNov.fatturato*100).toFixed(1)}%)`);
    console.log(`   2. 💰 Aumentare prezzi del: +${priceIncreaseNeeded.toFixed(1)}%`);
    console.log(`   3. ✂️  Ridurre costi merci di: -CHF ${deficitEbitda.toFixed(0)} (portare margine dal 24% al 27.5%)`);
    console.log(`   4. 👥 Ridurre altri costi di: -CHF ${costReductionNeeded.toFixed(0)}`);

    // ANALISI FORNITORI NOVEMBRE
    console.log('\n' + '='.repeat(80));
    console.log('🏭 TOP FORNITORI NOVEMBRE (dove vai a spendere)');
    console.log('='.repeat(80));

    const bySupplier: { [key: string]: { name: string; total: number; count: number } } = {};
    for (const inv of purchaseInvoices) {
      const suppId = inv.partner_id?.[0]?.toString() || 'N/A';
      const suppName = inv.partner_id?.[1] || 'Sconosciuto';
      if (!bySupplier[suppId]) bySupplier[suppId] = { name: suppName, total: 0, count: 0 };
      bySupplier[suppId].total += inv.amount_untaxed;
      bySupplier[suppId].count++;
    }

    const topSuppliers = Object.values(bySupplier).sort((a, b) => b.total - a.total).slice(0, 15);

    console.log('\nFornitore                                    | Fatture | Totale CHF');
    console.log('-'.repeat(75));
    for (const supp of topSuppliers) {
      console.log(`${supp.name.substring(0, 42).padEnd(42)} | ${supp.count.toString().padStart(7)} | ${supp.total.toFixed(2).padStart(12)}`);
    }
  }
}

// Esecuzione
const analyzer = new OdooAnalyzer();
analyzer.analyzeNovember().catch(console.error);
