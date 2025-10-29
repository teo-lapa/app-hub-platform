/**
 * Analisi Cadenza Fornitori da Odoo
 *
 * Recupera storico purchase.order ultimi 6 mesi e calcola:
 * - Numero totale ordini per fornitore
 * - Cadenza media giorni tra ordini
 * - Giorni settimana più frequenti
 * - Lead time medio
 * - Valore medio ordine
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Carica variabili ambiente
config({ path: path.join(process.cwd(), '.env.local') });

// Configurazione Odoo Production
const ODOO_CONFIG = {
  url: process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478',
  username: process.env.ODOO_ADMIN_EMAIL || 'apphubplatform@lapa.ch',
  password: process.env.ODOO_ADMIN_PASSWORD || 'apphubplatform2025'
};

interface PurchaseOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string;
  date_approve: string | false;
  date_planned: string | false;
  amount_total: number;
  state: string;
}

interface SupplierAnalysis {
  id: number;
  name: string;
  total_orders: number;
  average_days_between_orders: number;
  most_frequent_days: string[];
  average_lead_time_days: number;
  average_order_value: number;
  last_order_date: string;
}

interface AnalysisResult {
  analysis_date: string;
  period: string;
  suppliers: SupplierAnalysis[];
}

// Session cookie (salvato dopo autenticazione)
let sessionCookie: string | null = null;

// Autenticazione Odoo
async function authenticate(): Promise<number> {
  console.log('Authenticating with Odoo...');
  console.log(`URL: ${ODOO_CONFIG.url}`);
  console.log(`DB: ${ODOO_CONFIG.db}`);
  console.log(`User: ${ODOO_CONFIG.username}`);

  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      }
    })
  });

  const data = await response.json();

  if (data.error || !data.result?.uid) {
    console.error('Authentication error:', data.error);
    throw new Error('Authentication failed');
  }

  // Estrai session_id dai cookie
  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('No session_id received from Odoo');
  }

  sessionCookie = `session_id=${sessionMatch[1]}`;

  console.log(`Authenticated as UID: ${data.result.uid}`);
  return data.result.uid;
}

// Execute_kw - Chiamata modelli Odoo
async function executeKw(
  uid: number,
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {}
): Promise<any> {
  if (!sessionCookie) {
    throw new Error('Not authenticated. Call authenticate() first.');
  }

  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Odoo Error: ${data.error.data?.message || data.error.message}`);
  }

  return data.result;
}

// Recupera ordini acquisto ultimi 6 mesi
async function fetchPurchaseOrders(uid: number): Promise<PurchaseOrder[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFrom = sixMonthsAgo.toISOString().split('T')[0];

  console.log(`Fetching purchase orders from ${dateFrom}...`);

  const orders = await executeKw(
    uid,
    'purchase.order',
    'search_read',
    [
      [
        ['state', 'in', ['purchase', 'done']],
        ['date_order', '>=', dateFrom]
      ]
    ],
    {
      fields: ['name', 'partner_id', 'date_order', 'date_approve', 'date_planned', 'amount_total', 'state'],
      order: 'date_order asc'
    }
  );

  console.log(`Found ${orders.length} purchase orders`);
  return orders;
}

// Calcola differenza giorni tra due date
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Ottieni giorno settimana da data
function getDayOfWeek(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

// Trova giorni più frequenti
function getMostFrequentDays(dates: string[]): string[] {
  const dayCount: Record<string, number> = {};

  dates.forEach(date => {
    const day = getDayOfWeek(date);
    dayCount[day] = (dayCount[day] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(dayCount));
  return Object.entries(dayCount)
    .filter(([_, count]) => count === maxCount)
    .map(([day, _]) => day);
}

// Analizza ordini per fornitore
function analyzeSuppliers(orders: PurchaseOrder[]): SupplierAnalysis[] {
  // Raggruppa per fornitore
  const supplierOrders: Record<number, PurchaseOrder[]> = {};

  orders.forEach(order => {
    const supplierId = order.partner_id[0];
    if (!supplierOrders[supplierId]) {
      supplierOrders[supplierId] = [];
    }
    supplierOrders[supplierId].push(order);
  });

  const analyses: SupplierAnalysis[] = [];

  for (const [supplierIdStr, supplierOrdersList] of Object.entries(supplierOrders)) {
    const supplierId = parseInt(supplierIdStr);

    // Filtra fornitori con meno di 3 ordini
    if (supplierOrdersList.length < 3) {
      continue;
    }

    // Ordina per data
    supplierOrdersList.sort((a, b) =>
      new Date(a.date_order).getTime() - new Date(b.date_order).getTime()
    );

    // Calcola cadenza media
    const daysBetweenOrders: number[] = [];
    for (let i = 1; i < supplierOrdersList.length; i++) {
      const days = daysBetween(
        supplierOrdersList[i - 1].date_order,
        supplierOrdersList[i].date_order
      );
      daysBetweenOrders.push(days);
    }

    const avgDaysBetween = daysBetweenOrders.length > 0
      ? daysBetweenOrders.reduce((a, b) => a + b, 0) / daysBetweenOrders.length
      : 0;

    // Calcola lead time medio
    const leadTimes: number[] = [];
    supplierOrdersList.forEach(order => {
      if (order.date_approve && order.date_planned) {
        const leadTime = daysBetween(order.date_approve, order.date_planned);
        leadTimes.push(leadTime);
      }
    });

    const avgLeadTime = leadTimes.length > 0
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : 0;

    // Calcola valore medio ordine
    const avgOrderValue = supplierOrdersList.reduce((sum, o) => sum + o.amount_total, 0) / supplierOrdersList.length;

    // Giorni più frequenti
    const orderDates = supplierOrdersList.map(o => o.date_order);
    const mostFrequentDays = getMostFrequentDays(orderDates);

    // Ultima data ordine
    const lastOrderDate = supplierOrdersList[supplierOrdersList.length - 1].date_order;

    analyses.push({
      id: supplierId,
      name: supplierOrdersList[0].partner_id[1],
      total_orders: supplierOrdersList.length,
      average_days_between_orders: Math.round(avgDaysBetween * 10) / 10,
      most_frequent_days: mostFrequentDays,
      average_lead_time_days: Math.round(avgLeadTime * 10) / 10,
      average_order_value: Math.round(avgOrderValue * 100) / 100,
      last_order_date: lastOrderDate
    });
  }

  // Ordina per numero ordini decrescente
  analyses.sort((a, b) => b.total_orders - a.total_orders);

  return analyses;
}

// Main
async function main() {
  try {
    console.log('========================================');
    console.log('SUPPLIER CADENCE ANALYSIS');
    console.log('========================================\n');

    // 1. Autenticazione
    const uid = await authenticate();

    // 2. Fetch purchase orders
    const orders = await fetchPurchaseOrders(uid);

    if (orders.length === 0) {
      console.warn('No purchase orders found in the last 6 months');
      return;
    }

    // 3. Analizza fornitori
    console.log('\nAnalyzing suppliers...');
    const suppliers = analyzeSuppliers(orders);

    console.log(`\nFound ${suppliers.length} active suppliers (with 3+ orders)`);

    // 4. Prepara risultato
    const result: AnalysisResult = {
      analysis_date: new Date().toISOString().split('T')[0],
      period: '6 months',
      suppliers
    };

    // 5. Salva su file
    const outputDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'supplier-cadence-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

    console.log(`\nResults saved to: ${outputPath}`);

    // 6. Stampa summary
    console.log('\n========================================');
    console.log('TOP 10 SUPPLIERS BY ORDER FREQUENCY');
    console.log('========================================\n');

    suppliers.slice(0, 10).forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.name}`);
      console.log(`   Orders: ${supplier.total_orders}`);
      console.log(`   Avg Days Between Orders: ${supplier.average_days_between_orders}`);
      console.log(`   Most Frequent Days: ${supplier.most_frequent_days.join(', ')}`);
      console.log(`   Avg Lead Time: ${supplier.average_lead_time_days} days`);
      console.log(`   Avg Order Value: €${supplier.average_order_value.toLocaleString()}`);
      console.log(`   Last Order: ${supplier.last_order_date}`);
      console.log('');
    });

    console.log('Analysis completed successfully!\n');

  } catch (error: any) {
    console.error('\nERROR:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run
main();
