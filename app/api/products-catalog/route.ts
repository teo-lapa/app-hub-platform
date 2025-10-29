import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export async function GET(request: NextRequest) {
  try {
    console.log('📦 [PRODUCTS-CATALOG] API chiamata...');

    // Get session_id from cookies (user must be logged in)
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [PRODUCTS-CATALOG] User not logged in');
      return NextResponse.json(
        { success: false, error: 'You must be logged in to access the catalog' },
        { status: 401 }
      );
    }

    console.log('✅ [PRODUCTS-CATALOG] Using user session_id');

    // Fetch all products with stock
    const productsResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_read',
          args: [[['sale_ok', '=', true], ['active', '=', true]]],
          kwargs: {
            fields: ['id', 'name', 'image_256', 'qty_available', 'uom_id', 'seller_ids', 'list_price'],
            limit: 2000,  // Increased to show all products
            order: 'name ASC',
            context: { bin_size: false }  // Get full base64 image, not just size
          }
        },
        id: Math.random()
      })
    });

    const productsData = await productsResponse.json();

    if (productsData.error) {
      console.error('❌ [PRODUCTS-CATALOG] Error fetching products:', productsData.error);
      return NextResponse.json({
        success: false,
        error: productsData.error.message || 'Error loading products'
      }, { status: 500 });
    }

    const products = productsData.result || [];
    console.log(`✅ [PRODUCTS-CATALOG] Loaded ${products.length} products`);

    // Get supplier info for products
    const allSellerIds = products.flatMap((p: any) => p.seller_ids || []);
    let supplierInfos: any[] = [];

    if (allSellerIds.length > 0) {
      const supplierResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'product.supplierinfo',
            method: 'search_read',
            args: [[['id', 'in', allSellerIds]]],
            kwargs: {
              fields: ['id', 'partner_id', 'product_tmpl_id']
            }
          },
          id: Math.random()
        })
      });

      const supplierData = await supplierResponse.json();
      supplierInfos = supplierData.result || [];
    }

    // Create supplier map
    const supplierMap = new Map<number, { supplier_id: number; supplier_name: string }>();
    supplierInfos.forEach((si: any) => {
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

    // Fetch sale orders
    const ordersResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'search_read',
          args: [[
            ['date_order', '>=', fourteenDaysAgoStr],
            ['state', 'in', ['sale', 'done']]
          ]],
          kwargs: {
            fields: ['id', 'date_order', 'state']
          }
        },
        id: Math.random()
      })
    });

    const ordersData = await ordersResponse.json();
    const saleOrders = ordersData.result || [];
    const saleOrderIds = saleOrders.map((so: any) => so.id);

    // Fetch sale order lines
    let saleLines: any[] = [];
    if (saleOrderIds.length > 0) {
      const linesResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'sale.order.line',
            method: 'search_read',
            args: [[['order_id', 'in', saleOrderIds]]],
            kwargs: {
              fields: ['product_id', 'product_uom_qty', 'order_id']
            }
          },
          id: Math.random()
        })
      });

      const linesData = await linesResponse.json();
      saleLines = linesData.result || [];
    }

    // Calculate sales by product and time period
    const salesMap = new Map<number, { sales_5: number; sales_10: number; sales_14: number }>();

    saleLines.forEach((line: any) => {
      if (!line.product_id) return;
      const productId = line.product_id[0];
      const orderId = line.order_id[0];
      const order = saleOrders.find((so: any) => so.id === orderId);
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
    const catalogProducts = products.map((p: any) => {
      const sales = salesMap.get(p.id) || { sales_5: 0, sales_10: 0, sales_14: 0 };
      const supplierInfo = supplierMap.get(p.id);
      const uom = p.uom_id ? p.uom_id[1] : 'Units';

      return {
        id: p.id,
        name: p.name,
        image_url: p.image_256 || '',
        current_stock: p.qty_available || 0,
        uom,
        sales_5_days: sales.sales_5,
        sales_10_days: sales.sales_10,
        sales_14_days: sales.sales_14,
        supplier_id: supplierInfo?.supplier_id || 0,
        supplier_name: supplierInfo?.supplier_name || 'N/A',
        avg_price: p.list_price || 0
      };
    });

    console.log(`✅ [PRODUCTS-CATALOG] Returning ${catalogProducts.length} products with sales data`);

    return NextResponse.json({
      success: true,
      products: catalogProducts,
      total: catalogProducts.length
    });

  } catch (error: any) {
    console.error('💥 [PRODUCTS-CATALOG] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
