import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/order-prices/[orderId]/create-task
 *
 * Creates a task in Odoo requesting price lock approval from Laura
 *
 * Body:
 * - lineId: number
 * - productName: string
 * - costPrice: number
 * - avgSellingPrice: number
 * - proposedPrice: number
 * - discount: number
 * - note: string (optional)
 *
 * Returns task creation confirmation
 */

interface RouteContext {
  params: {
    orderId: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const orderId = parseInt(params.orderId);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      lineId,
      productName,
      productCode,
      costPrice,
      avgSellingPrice,
      proposedPrice,
      discount,
      note
    } = body;

    if (!lineId || !productName || proposedPrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('📋 [CREATE-TASK-API] Creating price lock request task:', {
      orderId,
      lineId,
      productName,
      proposedPrice
    });

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CREATE-TASK-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Verify order exists and is in draft state
    console.log('🔍 [CREATE-TASK-API] Verifying order...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', orderId],
          ['company_id', '=', 1] // Only LAPA company orders
        ],
        fields: ['id', 'name', 'state', 'partner_id'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [CREATE-TASK-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    if (order.state !== 'draft') {
      console.error('❌ [CREATE-TASK-API] Order is not in draft state:', order.state);
      return NextResponse.json(
        {
          success: false,
          error: `Order ${order.name} is already confirmed`
        },
        { status: 409 }
      );
    }

    // Calculate profit margin percentage
    const profitMargin = costPrice > 0
      ? (((proposedPrice - costPrice) / costPrice) * 100).toFixed(2)
      : 'N/A';

    // Build task description with all the details
    const maxPrice = avgSellingPrice > 0 ? (avgSellingPrice * 2.5).toFixed(2) : (costPrice * 4.2).toFixed(2);

    let taskDescription = `Richiesta di blocco prezzo per prodotto:\n\n`;
    taskDescription += `📦 Prodotto: ${productName}\n`;
    if (productCode) {
      taskDescription += `🔖 Codice: ${productCode}\n`;
    }
    taskDescription += `📋 Ordine: ${order.name}\n`;
    taskDescription += `👤 Cliente: ${order.partner_id[1]}\n\n`;
    taskDescription += `💰 Dettagli Prezzo:\n`;
    taskDescription += `- Prezzo di Costo: CHF ${costPrice.toFixed(2)}\n`;
    if (avgSellingPrice > 0) {
      taskDescription += `- Prezzo Medio (3 mesi): CHF ${avgSellingPrice.toFixed(2)}\n`;
    }
    taskDescription += `- Prezzo Massimo Consigliato: CHF ${maxPrice}\n`;
    taskDescription += `- Prezzo Proposto: CHF ${proposedPrice.toFixed(2)}\n`;
    if (discount > 0) {
      taskDescription += `- Sconto Applicato: ${discount.toFixed(1)}%\n`;
    }
    taskDescription += `- Margine di Profitto: ${profitMargin}%\n\n`;

    if (note && note.trim()) {
      taskDescription += `📝 Note del Venditore:\n${note.trim()}\n\n`;
    }

    taskDescription += `⚠️ Si prega di verificare e approvare il blocco di questo prezzo nel listino del cliente.`;

    // Create task in Odoo assigned to Laura (user ID: 8)
    console.log('📋 [CREATE-TASK-API] Creating task in Odoo...');

    const taskData = {
      name: `Blocco Prezzo: ${productName.substring(0, 50)} - ${order.name}`,
      description: taskDescription,
      user_ids: [[6, 0, [8]]], // Assign to Laura Teodorescu
      partner_id: order.partner_id[0], // Link to customer
      company_id: 1, // LAPA company
      priority: '1', // High priority
      // If you have a specific project for these tasks, add project_id here
      // project_id: PROJECT_ID
    };

    const taskId = await callOdoo(
      cookies,
      'project.task',
      'create',
      [taskData]
    );

    if (!taskId) {
      console.error('❌ [CREATE-TASK-API] Failed to create task');
      return NextResponse.json(
        { success: false, error: 'Failed to create task in Odoo' },
        { status: 500 }
      );
    }

    console.log(`✅ [CREATE-TASK-API] Task created successfully with ID: ${taskId}`);

    return NextResponse.json({
      success: true,
      taskId,
      message: `Richiesta inviata a Laura per il prodotto ${productName}`
    });

  } catch (error: any) {
    console.error('💥 [CREATE-TASK-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error creating task',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
