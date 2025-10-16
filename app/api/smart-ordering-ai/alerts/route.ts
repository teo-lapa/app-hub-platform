/**
 * API: Smart Ordering AI - Alerts
 * GET /api/smart-ordering-ai/alerts
 *
 * Recupera alert intelligenti
 */

import { NextRequest, NextResponse } from 'next/server';
import { smartAlertSystem } from '@/lib/smart-ordering/smart-alert-system';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'all';
    const productIdsParam = searchParams.get('productIds');

    console.log(`🔍 API /smart-ordering-ai/alerts?mode=${mode}`);

    let alerts;

    if (mode === 'specific' && productIdsParam) {
      const productIds = productIdsParam.split(',').map(id => parseInt(id));
      alerts = await smartAlertSystem.scanProducts(productIds);
    } else {
      alerts = await smartAlertSystem.scanAllProducts();
    }

    const summary = await smartAlertSystem.getAlertSummary(alerts);

    return NextResponse.json({
      success: true,
      alerts,
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Errore API alerts:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}

// POST per inviare notifiche
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertIds } = body as { action: string; alertIds?: string[] };

    console.log(`📧 API /smart-ordering-ai/alerts action=${action}`);

    if (action === 'send-notifications') {
      const alerts = await smartAlertSystem.scanAllProducts();
      await smartAlertSystem.sendNotifications(alerts);

      return NextResponse.json({
        success: true,
        message: 'Notifiche inviate',
        count: alerts.filter(a => a.severity === 'EMERGENCY' || a.severity === 'CRITICAL').length
      });
    }

    if (action === 'resolve' && alertIds) {
      for (const alertId of alertIds) {
        await smartAlertSystem.resolveAlert(alertId);
      }

      return NextResponse.json({
        success: true,
        message: `${alertIds.length} alert risolti`
      });
    }

    return NextResponse.json(
      { error: 'Azione non supportata' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('❌ Errore API alerts:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}
