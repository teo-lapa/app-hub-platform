import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/add-order-message
 *
 * Adds a message to the order's chatter in Odoo
 *
 * Body:
 * - orderId: number (required)
 * - message: string (required)
 * - messageType: 'comment' | 'notification' (default: 'comment')
 *
 * Returns success confirmation
 */

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { orderId, message, messageType = 'comment' } = body;

    if (!orderId || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: orderId, message' },
        { status: 400 }
      );
    }

    console.log('💬 [ADD-ORDER-MESSAGE-API] Adding message to order:', {
      orderId,
      messageLength: message.length,
      messageType
    });

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [ADD-ORDER-MESSAGE-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Verify order exists
    console.log('🔍 [ADD-ORDER-MESSAGE-API] Verifying order...');
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
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [ADD-ORDER-MESSAGE-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];
    console.log(`✅ [ADD-ORDER-MESSAGE-API] Found order: ${order.name}`);

    // Add message to order chatter using message_post
    console.log('💬 [ADD-ORDER-MESSAGE-API] Posting message to chatter...');

    const messageResult = await callOdoo(
      cookies,
      'sale.order',
      'message_post',
      [orderId],
      {
        body: message,
        message_type: messageType,
        subtype_xmlid: messageType === 'comment' ? 'mail.mt_comment' : 'mail.mt_note'
      }
    );

    if (!messageResult) {
      console.error('❌ [ADD-ORDER-MESSAGE-API] Failed to post message');
      return NextResponse.json(
        { success: false, error: 'Failed to post message to order' },
        { status: 500 }
      );
    }

    console.log(`✅ [ADD-ORDER-MESSAGE-API] Message posted successfully to ${order.name}`);

    return NextResponse.json({
      success: true,
      messageId: messageResult,
      orderName: order.name
    });

  } catch (error: any) {
    console.error('💥 [ADD-ORDER-MESSAGE-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error adding message to order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
