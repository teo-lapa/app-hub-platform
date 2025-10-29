import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OdooProduct {
  id: number;
  name: string;
  image_128?: string;
  qty_available: number;
  uom_name: string;
  seller_ids: number[];
  list_price: number;
}

interface OdooSupplierInfo {
  id: number;
  partner_id: [number, string];
  product_tmpl_id: [number, string];
}

interface OdooSaleOrderLine {
  product_id: [number, string];
  product_uom_qty: number;
  order_id: [number, string];
}

interface OdooSaleOrder {
  id: number;
  date_order: string;
  state: string;
}

export async function GET(request: NextRequest) {
  try {
    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_USERNAME = process.env.ODOO_ADMIN_EMAIL;
    const ODOO_PASSWORD = process.env.ODOO_ADMIN_PASSWORD;

    if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Odoo configuration missing' },
        { status: 500 }
      );
    }

    // Authenticate
    const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD }
      })
    });

    const authData = await authResponse.json();
    if (!authData.result || !authData.result.uid) {
      return NextResponse.json(
        { success: false, error: 'Odoo authentication failed' },
        { status: 401 }
      );
    }

    const uid = authData.result.uid;
    const sessionId = authData.result.session_id;

    // Helper for Odoo calls
    const odooCall = async (model: string, method: string, args: any[], kwargs: any = {}) => {
      const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
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
      return data.result;
    };

    // Fetch all products with stock
    const products: OdooProduct[] = await odooCall(
      'product.product',
      'search_read',
      [
        [['sale_ok', '=', true], ['active', '=', true]],
        ['id', 'name', 'image_128', 'qty_available', 'uom_name', 'seller_ids', 'list_price']
      ]
    );

    // Fetch supplier info for all products
    const allSellerIds = products.flatMap(p => p.seller_ids || []);
    const supplierInfos: OdooSupplierInfo[] = allSellerIds.length > 0
      ? await odooCall('product.supplierinfo', 'search_read', [
          [['id', 'in', allSellerIds]],
          ['id', 'partner_id', 'product_tmpl_id']
        ])
      : [];

    // Create map: product_id -> supplier info
    const supplierMap = new Map<number, { supplier_id: number; supplier_name: string }>();
    supplierInfos.forEach(si => {
      if (si.product_tmpl_id && si.partner_id) {
        supplierMap.set(si.product_tmpl_id[0], {
          supplier_id: si.partner_id[0],
          supplier_name: si.partner_id[1]
        });
      }
    });

    // Calculate sales data (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];

    const saleOrders: OdooSaleOrder[] = await odooCall('sale.order', 'search_read', [
      [
        ['date_order', '>=', fourteenDaysAgoStr],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'date_order', 'state']
    ]);

    const saleOrderIds = saleOrders.map(so => so.id);

    const saleLines: OdooSaleOrderLine[] = saleOrderIds.length > 0
      ? await odooCall('sale.order.line', 'search_read', [
          [['order_id', 'in', saleOrderIds]],
          ['product_id', 'product_uom_qty', 'order_id']
        ])
      : [];

    // Create sales map by product and time period
    const salesMap = new Map<number, { sales_5: number; sales_10: number; sales_14: number }>();

    saleLines.forEach(line => {
      if (!line.product_id) return;
      const productId = line.product_id[0];
      const orderId = line.order_id[0];
      const order = saleOrders.find(so => so.id === orderId);
      if (!order) return;

      const orderDate = new Date(order.date_order);
      const daysAgo = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

      if (!salesMap.has(productId)) {
        salesMap.set(productId, { sales_5: 0, sales_10: 0, sales_14: 0 });
      }

      const sales = salesMap.get(productId)!;
      if (daysAgo <= 5) sales.sales_5 += line.product_uom_qty;
      if (daysAgo <= 10) sales.sales_10 += line.product_uom_qty;
      if (daysAgo <= 14) sales.sales_14 += line.product_uom_qty;
    });

    // Build final product list
    const catalogProducts = products.map(p => {
      const sales = salesMap.get(p.id) || { sales_5: 0, sales_10: 0, sales_14: 0 };
      const supplierInfo = supplierMap.get(p.id);

      return {
        id: p.id,
        name: p.name,
        image_url: p.image_128 || '',
        current_stock: p.qty_available || 0,
        uom: p.uom_name || 'Units',
        sales_5_days: sales.sales_5,
        sales_10_days: sales.sales_10,
        sales_14_days: sales.sales_14,
        supplier_id: supplierInfo?.supplier_id || 0,
        supplier_name: supplierInfo?.supplier_name || 'N/A',
        avg_price: p.list_price || 0
      };
    });

    return NextResponse.json({
      success: true,
      products: catalogProducts,
      total: catalogProducts.length
    });

  } catch (error: any) {
    console.error('Error fetching product catalog:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
