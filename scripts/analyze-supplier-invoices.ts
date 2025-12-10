/**
 * Analisi Fatture Fornitori - LAPA
 * Cerca anomalie, duplicati e problemi di competenza temporale
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

interface Invoice {
  id: number;
  name: string;
  partner_id: [number, string];
  invoice_date: string;
  date: string; // data contabile
  create_date: string;
  amount_total: number;
  amount_untaxed: number;
  state: string;
  move_type: string;
  ref?: string;
  invoice_origin?: string;
}

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
      console.log('✅ Autenticazione riuscita, UID:', this.uid);
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
          kwargs: { domain, fields, limit: options.limit || 5000, offset: options.offset || 0, order: options.order }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || [];
  }

  async analyzeSupplierInvoices() {
    console.log('\n📊 ANALISI FATTURE FORNITORI LAPA\n');
    console.log('='.repeat(60));

    // Recupera fatture fornitori degli ultimi 12 mesi
    const startDate = '2024-12-01';
    const endDate = '2025-11-30';

    console.log(`\n📅 Periodo analizzato: ${startDate} - ${endDate}\n`);

    // Fatture fornitori (in_invoice = fattura fornitore)
    const invoices = await this.searchRead<Invoice>('account.move', [
      ['move_type', '=', 'in_invoice'],
      ['state', '=', 'posted'],
      ['invoice_date', '>=', startDate],
      ['invoice_date', '<=', endDate]
    ], [
      'id', 'name', 'partner_id', 'invoice_date', 'date', 'create_date',
      'amount_total', 'amount_untaxed', 'state', 'move_type', 'ref', 'invoice_origin'
    ], { order: 'invoice_date desc' });

    console.log(`📄 Totale fatture trovate: ${invoices.length}\n`);

    // 1. ANALISI PER MESE
    console.log('='.repeat(60));
    console.log('📆 RIEPILOGO MENSILE ACQUISTI');
    console.log('='.repeat(60));

    const byMonth: { [key: string]: { count: number; total: number; invoices: Invoice[] } } = {};

    for (const inv of invoices) {
      const month = inv.invoice_date?.substring(0, 7) || 'N/A';
      if (!byMonth[month]) byMonth[month] = { count: 0, total: 0, invoices: [] };
      byMonth[month].count++;
      byMonth[month].total += inv.amount_untaxed;
      byMonth[month].invoices.push(inv);
    }

    const sortedMonths = Object.keys(byMonth).sort().reverse();
    for (const month of sortedMonths) {
      const data = byMonth[month];
      console.log(`${month}: ${data.count.toString().padStart(3)} fatture | CHF ${data.total.toFixed(2).padStart(12)}`);
    }

    // 2. ANALISI PER FORNITORE
    console.log('\n' + '='.repeat(60));
    console.log('🏭 TOP 15 FORNITORI PER IMPORTO');
    console.log('='.repeat(60));

    const bySupplier: { [key: string]: { name: string; count: number; total: number } } = {};

    for (const inv of invoices) {
      const supplierId = inv.partner_id?.[0]?.toString() || 'N/A';
      const supplierName = inv.partner_id?.[1] || 'Sconosciuto';
      if (!bySupplier[supplierId]) bySupplier[supplierId] = { name: supplierName, count: 0, total: 0 };
      bySupplier[supplierId].count++;
      bySupplier[supplierId].total += inv.amount_untaxed;
    }

    const topSuppliers = Object.entries(bySupplier)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15);

    for (const [id, data] of topSuppliers) {
      console.log(`${data.name.substring(0, 35).padEnd(35)} | ${data.count.toString().padStart(3)} fatt. | CHF ${data.total.toFixed(2).padStart(12)}`);
    }

    // 3. CERCA POSSIBILI DUPLICATI
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  POSSIBILI FATTURE DUPLICATE');
    console.log('='.repeat(60));

    const duplicateCheck: { [key: string]: Invoice[] } = {};

    for (const inv of invoices) {
      // Chiave: fornitore + importo + data (entro 3 giorni)
      const key = `${inv.partner_id?.[0]}_${inv.amount_total.toFixed(2)}`;
      if (!duplicateCheck[key]) duplicateCheck[key] = [];
      duplicateCheck[key].push(inv);
    }

    let duplicatesFound = 0;
    for (const [key, invs] of Object.entries(duplicateCheck)) {
      if (invs.length > 1) {
        // Controlla se sono nello stesso mese o vicine
        const dates = invs.map(i => new Date(i.invoice_date).getTime());
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 31) { // Stesso mese circa
          duplicatesFound++;
          console.log(`\n🔴 Possibile duplicato (${invs.length} fatture, stesso importo):`);
          for (const inv of invs) {
            console.log(`   - ${inv.name} | ${inv.invoice_date} | CHF ${inv.amount_total.toFixed(2)} | ${inv.partner_id?.[1]?.substring(0, 30)}`);
          }
        }
      }
    }

    if (duplicatesFound === 0) {
      console.log('✅ Nessun duplicato evidente trovato');
    }

    // 4. FATTURE CON RITARDO DI REGISTRAZIONE
    console.log('\n' + '='.repeat(60));
    console.log('⏰ FATTURE REGISTRATE IN RITARDO (>7 giorni dalla data fattura)');
    console.log('='.repeat(60));

    const lateRegistrations: Invoice[] = [];

    for (const inv of invoices) {
      if (inv.invoice_date && inv.create_date) {
        const invoiceDate = new Date(inv.invoice_date);
        const createDate = new Date(inv.create_date);
        const daysDiff = Math.floor((createDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 7) {
          lateRegistrations.push({ ...inv, daysDiff } as any);
        }
      }
    }

    lateRegistrations.sort((a: any, b: any) => b.daysDiff - a.daysDiff);

    for (const inv of lateRegistrations.slice(0, 20)) {
      const daysDiff = (inv as any).daysDiff;
      console.log(`${inv.name.padEnd(15)} | Fatt: ${inv.invoice_date} | Reg: ${inv.create_date?.substring(0, 10)} | +${daysDiff} gg | CHF ${inv.amount_total.toFixed(2).padStart(10)} | ${inv.partner_id?.[1]?.substring(0, 25)}`);
    }

    if (lateRegistrations.length === 0) {
      console.log('✅ Nessuna fattura con ritardo significativo');
    } else {
      console.log(`\n📊 Totale fatture in ritardo: ${lateRegistrations.length}`);
    }

    // 5. FATTURE ANOMALE (importi molto alti)
    console.log('\n' + '='.repeat(60));
    console.log('💰 FATTURE CON IMPORTI PIÙ ALTI (Top 20)');
    console.log('='.repeat(60));

    const sortedByAmount = [...invoices].sort((a, b) => b.amount_total - a.amount_total).slice(0, 20);

    for (const inv of sortedByAmount) {
      console.log(`${inv.invoice_date} | ${inv.name.padEnd(15)} | CHF ${inv.amount_total.toFixed(2).padStart(12)} | ${inv.partner_id?.[1]?.substring(0, 35)}`);
    }

    // 6. CONFRONTO MESE SU MESE
    console.log('\n' + '='.repeat(60));
    console.log('📈 VARIAZIONE MESE SU MESE');
    console.log('='.repeat(60));

    for (let i = 0; i < sortedMonths.length - 1; i++) {
      const currentMonth = sortedMonths[i];
      const prevMonth = sortedMonths[i + 1];
      const current = byMonth[currentMonth].total;
      const prev = byMonth[prevMonth].total;
      const variation = prev > 0 ? ((current - prev) / prev * 100) : 0;
      const arrow = variation > 0 ? '📈' : variation < 0 ? '📉' : '➡️';

      console.log(`${currentMonth} vs ${prevMonth}: ${arrow} ${variation > 0 ? '+' : ''}${variation.toFixed(1)}% (${current.toFixed(0)} vs ${prev.toFixed(0)})`);
    }

    // 7. RIEPILOGO FINALE
    console.log('\n' + '='.repeat(60));
    console.log('📋 RIEPILOGO FINALE');
    console.log('='.repeat(60));

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_untaxed, 0);
    const avgMonthly = totalAmount / sortedMonths.length;

    console.log(`Totale fatture analizzate: ${invoices.length}`);
    console.log(`Totale acquisti (netto): CHF ${totalAmount.toFixed(2)}`);
    console.log(`Media mensile: CHF ${avgMonthly.toFixed(2)}`);
    console.log(`Fornitori unici: ${Object.keys(bySupplier).length}`);
    console.log(`Possibili duplicati: ${duplicatesFound}`);
    console.log(`Fatture registrate in ritardo: ${lateRegistrations.length}`);
  }
}

// Esecuzione
const analyzer = new OdooAnalyzer();
analyzer.analyzeSupplierInvoices().catch(console.error);
