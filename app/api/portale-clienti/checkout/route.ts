/**
 * PORTALE CLIENTI - Checkout API
 *
 * POST /api/portale-clienti/checkout
 *
 * Crea un ordine REALE su Odoo con i prodotti nel carrello
 *
 * WORKFLOW:
 * 1. Valida i dati di input (prodotti, quantità)
 * 2. Estrae customer_id dal JWT token dell'utente autenticato
 * 3. Verifica disponibilità prodotti su Odoo
 * 4. Verifica limite credito cliente (opzionale)
 * 5. Crea sale.order su Odoo con order_line
 * 6. Conferma ordine (action_confirm) - genera picking automaticamente
 * 7. Restituisce orderId e order_name per conferma cliente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { CheckoutRequestSchema } from '@/lib/validation/checkout';
import { getOrderService, OrderServiceError, ProductNotFoundError, CreditLimitExceededError } from '@/lib/services/order-service';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  odooPartnerId?: number; // Customer ID su Odoo
}

/**
 * Estrae JWT token e customer_id
 */
async function getCustomerFromToken(): Promise<{ customerId: number; email: string } | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      console.error('❌ Nessun token JWT trovato');
      return null;
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    if (!decoded.odooPartnerId) {
      console.error('❌ Token valido ma senza odooPartnerId');
      return null;
    }

    return {
      customerId: decoded.odooPartnerId,
      email: decoded.email,
    };
  } catch (error: any) {
    console.error('❌ Errore verifica token JWT:', error.message);
    return null;
  }
}

/**
 * POST /api/portale-clienti/checkout
 * Crea ordine su Odoo usando il service layer
 */
export async function POST(request: NextRequest) {
  console.log('\n🛒 [API] POST /api/portale-clienti/checkout');

  try {
    // 1. Verifica sessione Odoo
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sessione Odoo non valida. Effettua il login.',
        },
      }, { status: 401 });
    }

    console.log('✅ Sessione Odoo valida');

    // 2. Estrai customer_id da JWT
    const customer = await getCustomerFromToken();
    if (!customer) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Utente non autenticato o token scaduto.',
        },
      }, { status: 401 });
    }

    console.log(`👤 Cliente: ${customer.email} (Odoo ID: ${customer.customerId})`);

    // 3. Valida body con Zod
    const body = await request.json();
    const validation = CheckoutRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dati non validi',
          details: validation.error.flatten().fieldErrors,
        },
      }, { status: 400 });
    }

    // 4. Usa OrderService per creare ordine con tutta la business logic
    const orderService = getOrderService();
    const result = await orderService.createOrder(
      customer.customerId,
      customer.email,
      validation.data
    );

    // 5. Risposta di successo
    return NextResponse.json({
      success: true,
      order_id: result.orderId,
      order_name: result.orderName,
      order_total: result.orderTotal,
      state: result.state,
      message: `Ordine ${result.orderName} creato con successo`,
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [API] Error durante checkout:', error);

    // Gestione errori custom del service
    if (error instanceof ProductNotFoundError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }, { status: 400 });
    }

    if (error instanceof CreditLimitExceededError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }, { status: 409 });
    }

    if (error instanceof OrderServiceError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }, { status: 500 });
    }

    // Gestione errori Odoo generici
    if (error.message?.includes('Session expired')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Sessione scaduta. Effettua nuovamente il login.',
        },
      }, { status: 401 });
    }

    // Errore generico
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Errore durante la creazione dell\'ordine',
        details: error.message,
      },
    }, { status: 500 });
  }
}
