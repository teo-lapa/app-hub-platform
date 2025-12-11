import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';
const LAPA_COMPANY_ID = 1;

interface OdooSession {
  uid: number;
  cookies: string;
}

async function authenticate(): Promise<OdooSession> {
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
  const cookies = cookieHeader
    ? cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ')
    : '';

  const data = await response.json() as any;
  if (data.result?.uid) {
    return { uid: data.result.uid, cookies };
  }
  throw new Error('Authentication failed');
}

async function searchRead<T>(
  session: OdooSession,
  model: string,
  domain: any[],
  fields: string[],
  options: any = {}
): Promise<T[]> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': session.cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [],
        kwargs: { domain, fields, limit: options.limit || 50000, offset: options.offset || 0, order: options.order }
      },
      id: Date.now()
    })
  });

  const data = await response.json() as any;
  if (data.error) throw new Error(data.error.message);
  return data.result || [];
}

function classifyProduct(productName: string, categName: string): string {
  const name = (productName + ' ' + categName).toLowerCase();

  if (name.includes('surgel') || name.includes('frozen') || name.includes('gelato') ||
      name.includes('ping') || name.includes('ghiacc')) {
    return 'PING';
  }
  if (name.includes('fresco') || name.includes('frigo') || name.includes('latte') ||
      name.includes('formaggio') || name.includes('mozzarella') || name.includes('burrata') ||
      name.includes('ricotta') || name.includes('mascarpone') || name.includes('panna') ||
      name.includes('yogurt') || name.includes('salume') || name.includes('prosciutto') ||
      name.includes('mortadella') || name.includes('bresaola') || name.includes('speck')) {
    return 'FRIGO';
  }
  if (name.includes('vino') || name.includes('birra') || name.includes('acqua') ||
      name.includes('bevand') || name.includes('bottiglia') || name.includes('lattina')) {
    return 'SECCO_SOTTO';
  }
  return 'SECCO_SOPRA';
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticate();
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') || '2025-11';

    const startDate = `${month}-01`;
    const endDate = `${month}-30`;

    // Get sales data for real calculation
    const salesLines = await searchRead<any>(session, 'sale.order.line', [
      ['state', 'in', ['sale', 'done']],
      ['company_id', '=', LAPA_COMPANY_ID],
      ['qty_delivered', '>', 0],
      ['order_id.commitment_date', '>=', startDate],
      ['order_id.commitment_date', '<=', endDate]
    ], ['qty_delivered', 'price_unit', 'purchase_price'], { limit: 50000 });

    let revenueReale = 0;
    let costoMerceBase = 0;

    for (const line of salesLines) {
      revenueReale += (line.price_unit || 0) * (line.qty_delivered || 0);
      costoMerceBase += (line.purchase_price || 0) * (line.qty_delivered || 0);
    }

    // Add accessory costs (transport/documents) proportionally
    const costiAccessori = 9265.44 + 3354.66 + 4429.20;
    const acquistiPiuDazi = 187453.62 + 19585.90;
    const percVenduta = (costoMerceBase / acquistiPiuDazi) * 100;
    const quotaAccessori = costiAccessori * (percVenduta / 100);
    const costoMerceReale = costoMerceBase + quotaAccessori;

    const margineReale = revenueReale - costoMerceReale;
    const marginePctReale = revenueReale > 0 ? (margineReale / revenueReale) * 100 : 0;

    // Accounting data (from P&L screenshot)
    const fatturatoContabile = 300515.51;
    const costoMerceContabile = 228774.98;
    const margineContabile = fatturatoContabile - costoMerceContabile;
    const marginePctContabile = (margineContabile / fatturatoContabile) * 100;

    const costiFissiContabili = 84534.00;
    const costiFissiReali = 78130.21;

    const risultatoContabile = margineContabile - costiFissiContabili;
    const risultatoReale = margineReale - costiFissiReali;

    // Get warehouse data
    const products = await searchRead<any>(session, 'product.product', [
      ['type', '=', 'product'],
      ['qty_available', '>', 0],
      ['company_id', 'in', [LAPA_COMPANY_ID, false]]
    ], ['id', 'name', 'qty_available', 'standard_price', 'categ_id'], { limit: 50000 });

    const categIds = Array.from(new Set(products.map(p => p.categ_id?.[0]).filter(Boolean)));
    const categories = await searchRead<any>(session, 'product.category', [
      ['id', 'in', categIds]
    ], ['id', 'name', 'complete_name'], { limit: 1000 });

    const categMap: { [id: number]: string } = {};
    for (const cat of categories) {
      categMap[cat.id] = cat.complete_name || cat.name;
    }

    const magazzino: { [zona: string]: { count: number, qty: number, value: number } } = {
      'SECCO_SOPRA': { count: 0, qty: 0, value: 0 },
      'SECCO_SOTTO': { count: 0, qty: 0, value: 0 },
      'FRIGO': { count: 0, qty: 0, value: 0 },
      'PING': { count: 0, qty: 0, value: 0 }
    };

    for (const p of products) {
      const categName = p.categ_id ? categMap[p.categ_id[0]] || '' : '';
      const zona = classifyProduct(p.name, categName);
      const value = (p.qty_available || 0) * (p.standard_price || 0);

      magazzino[zona].count++;
      magazzino[zona].qty += p.qty_available || 0;
      magazzino[zona].value += value;
    }

    const totaleMagazzino = Object.values(magazzino).reduce((sum, z) => sum + z.value, 0);

    return NextResponse.json({
      success: true,
      month,
      contoEconomico: {
        contabile: {
          fatturato: fatturatoContabile,
          costoMerci: costoMerceContabile,
          margine: margineContabile,
          marginePct: marginePctContabile,
          costiFissi: costiFissiContabili,
          risultato: risultatoContabile
        },
        reale: {
          fatturato: revenueReale,
          costoMerci: costoMerceReale,
          margine: margineReale,
          marginePct: marginePctReale,
          costiFissi: costiFissiReali,
          risultato: risultatoReale
        }
      },
      magazzino: {
        zone: magazzino,
        totale: totaleMagazzino
      }
    });
  } catch (error) {
    console.error('Error fetching conto economico:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
