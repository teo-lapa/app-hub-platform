import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo';
import type {
  Alert,
  AlertStats,
  AlertRule,
  DEFAULT_ALERT_RULES,
} from '@/lib/types/alert-rules';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// In-memory storage per demo (in produzione usare database)
let alertRules: AlertRule[] = [];
let generatedAlerts: Alert[] = [];

// Initialize default rules if empty
function initializeRules() {
  if (alertRules.length === 0) {
    const { DEFAULT_ALERT_RULES } = require('@/lib/types/alert-rules');
    alertRules = DEFAULT_ALERT_RULES.map((rule: any) => ({
      ...rule,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { cookies, nextUrl } = request;
    const action = nextUrl.searchParams.get('action') || 'generate';

    initializeRules();

    if (action === 'rules') {
      // Return only rules
      return NextResponse.json({
        success: true,
        rules: alertRules,
        performanceMs: Date.now() - startTime,
      });
    }

    console.log('[Alerts] Generating alerts...');

    const newAlerts: Alert[] = [];

    // ============================================================
    // STEP 1: Fetch Recent Draft Invoices
    // ============================================================
    const draftInvoices = await callOdoo(
      cookies,
      'account.move',
      'search_read',
      [[
        ['state', '=', 'draft'],
        ['move_type', '=', 'out_invoice'],
        ['company_id', '=', 1],
      ]],
      {
        fields: ['id', 'name', 'partner_id', 'amount_total', 'invoice_line_ids'],
        limit: 50,
      }
    );

    console.log(`[Alerts] Found ${draftInvoices.length} draft invoices`);

    // ============================================================
    // STEP 2: Fetch Invoice Lines
    // ============================================================
    const allLineIds = draftInvoices.flatMap((inv: any) => inv.invoice_line_ids || []);

    if (allLineIds.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        stats: getEmptyStats(),
        rules: alertRules,
        performanceMs: Date.now() - startTime,
      });
    }

    const invoiceLines = await callOdoo(
      cookies,
      'account.move.line',
      'search_read',
      [[
        ['id', 'in', allLineIds],
        ['display_type', '=', false],
      ]],
      {
        fields: ['id', 'move_id', 'product_id', 'price_unit', 'quantity', 'discount'],
      }
    );

    // Group by invoice
    const linesByInvoice = new Map<number, any[]>();
    invoiceLines.forEach((line: any) => {
      const invoiceId = line.move_id?.[0];
      if (!invoiceId) return;
      if (!linesByInvoice.has(invoiceId)) {
        linesByInvoice.set(invoiceId, []);
      }
      linesByInvoice.get(invoiceId)!.push(line);
    });

    // ============================================================
    // STEP 3: Fetch Products for Cost Data
    // ============================================================
    const productIds = [...new Set(
      invoiceLines
        .filter((line: any) => line.product_id)
        .map((line: any) => line.product_id[0])
    )];

    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [[
        ['id', 'in', productIds],
        ['company_id', 'in', [1, false]],
      ]],
      { fields: ['id', 'name', 'default_code', 'standard_price', 'list_price'] }
    );

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // ============================================================
    // STEP 4: Generate Alerts Based on Rules
    // ============================================================
    const enabledRules = alertRules.filter(r => r.enabled);

    for (const invoice of draftInvoices) {
      const invoiceId = invoice.id;
      const invoiceName = invoice.name;
      const customerId = invoice.partner_id[0];
      const customerName = invoice.partner_id[1];
      const totalAmount = invoice.amount_total || 0;

      const lines = linesByInvoice.get(invoiceId) || [];

      for (const line of lines) {
        if (!line.product_id) continue;

        const productId = line.product_id[0];
        const productName = line.product_id[1];
        const priceUnit = line.price_unit || 0;
        const discount = line.discount || 0;
        const quantity = line.quantity || 0;

        const product = productMap.get(productId);
        if (!product) continue;

        const cost = product.standard_price || 0;
        const listPrice = product.list_price || 0;

        // Calculate metrics
        const effectivePrice = priceUnit * (1 - discount / 100);
        const marginPercent = cost > 0 ? ((effectivePrice - cost) / cost) * 100 : 0;

        // ============================================================
        // RULE 1: Margine Negativo (CRITICAL)
        // ============================================================
        const marginRule = enabledRules.find(r => r.type === 'margin_negative');
        if (marginRule && marginPercent < (marginRule.threshold || 0)) {
          newAlerts.push({
            id: uuidv4(),
            ruleId: marginRule.id,
            ruleName: marginRule.name,
            type: 'margin_negative',
            severity: 'critical',
            title: `⚠️ Margine Negativo: ${productName}`,
            message: `Venduto a CHF ${effectivePrice.toFixed(2)} con costo CHF ${cost.toFixed(2)} - Margine: ${marginPercent.toFixed(1)}%`,
            productId,
            productName,
            customerId,
            customerName,
            invoiceId,
            invoiceName,
            value: marginPercent,
            threshold: marginRule.threshold || 0,
            createdAt: new Date().toISOString(),
            acknowledged: false,
          });
        }

        // ============================================================
        // RULE 2: Prezzo Zero su Fatture Grandi (HIGH)
        // ============================================================
        const priceZeroRule = enabledRules.find(r => r.type === 'price_zero');
        if (priceZeroRule && priceUnit === 0 && totalAmount > (priceZeroRule.threshold || 1000)) {
          newAlerts.push({
            id: uuidv4(),
            ruleId: priceZeroRule.id,
            ruleName: priceZeroRule.name,
            type: 'price_zero',
            severity: 'high',
            title: `🤔 Prezzo Zero: ${productName}`,
            message: `Prodotto gratuito su fattura da CHF ${totalAmount.toFixed(2)} per ${customerName}`,
            productId,
            productName,
            customerId,
            customerName,
            invoiceId,
            invoiceName,
            value: 0,
            threshold: priceZeroRule.threshold || 1000,
            createdAt: new Date().toISOString(),
            acknowledged: false,
          });
        }

        // ============================================================
        // RULE 3: Discrepanza Prezzo vs Listino (HIGH)
        // ============================================================
        const discrepancyRule = enabledRules.find(r => r.type === 'price_discrepancy');
        if (discrepancyRule && listPrice > 0) {
          const discrepancyPercent = Math.abs(((effectivePrice - listPrice) / listPrice) * 100);
          if (discrepancyPercent > (discrepancyRule.threshold || 20)) {
            newAlerts.push({
              id: uuidv4(),
              ruleId: discrepancyRule.id,
              ruleName: discrepancyRule.name,
              type: 'price_discrepancy',
              severity: 'high',
              title: `📊 Discrepanza Prezzo: ${productName}`,
              message: `Venduto a CHF ${effectivePrice.toFixed(2)} vs listino CHF ${listPrice.toFixed(2)} (${discrepancyPercent.toFixed(1)}% differenza)`,
              productId,
              productName,
              customerId,
              customerName,
              invoiceId,
              invoiceName,
              value: discrepancyPercent,
              threshold: discrepancyRule.threshold || 20,
              createdAt: new Date().toISOString(),
              acknowledged: false,
            });
          }
        }

        // ============================================================
        // RULE 4: Sconto Eccessivo (MEDIUM)
        // ============================================================
        const discountRule = enabledRules.find(r => r.type === 'high_discount');
        if (discountRule && discount > (discountRule.threshold || 30)) {
          newAlerts.push({
            id: uuidv4(),
            ruleId: discountRule.id,
            ruleName: discountRule.name,
            type: 'high_discount',
            severity: 'medium',
            title: `💸 Sconto Elevato: ${productName}`,
            message: `Sconto ${discount.toFixed(1)}% applicato per ${customerName}`,
            productId,
            productName,
            customerId,
            customerName,
            invoiceId,
            invoiceName,
            value: discount,
            threshold: discountRule.threshold || 30,
            createdAt: new Date().toISOString(),
            acknowledged: false,
          });
        }
      }
    }

    // Store generated alerts (sostituisce i precedenti)
    generatedAlerts = newAlerts;

    console.log(`[Alerts] Generated ${newAlerts.length} alerts`);

    // ============================================================
    // STEP 5: Calculate Stats
    // ============================================================
    const stats: AlertStats = {
      totalAlerts: newAlerts.length,
      criticalCount: newAlerts.filter(a => a.severity === 'critical').length,
      highCount: newAlerts.filter(a => a.severity === 'high').length,
      mediumCount: newAlerts.filter(a => a.severity === 'medium').length,
      lowCount: newAlerts.filter(a => a.severity === 'low').length,
      unacknowledgedCount: newAlerts.filter(a => !a.acknowledged).length,
      byType: {},
    };

    // Count by type
    newAlerts.forEach(alert => {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      alerts: newAlerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      stats,
      rules: alertRules,
      performanceMs: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('[Alerts] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        performanceMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// POST: Acknowledge alert or update rules
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId, ruleId, updates } = body;

    initializeRules();

    if (action === 'acknowledge' && alertId) {
      const alert = generatedAlerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date().toISOString();
        alert.acknowledgedBy = 'admin'; // TODO: get from session

        return NextResponse.json({
          success: true,
          alert,
        });
      }
    }

    if (action === 'update_rule' && ruleId && updates) {
      const rule = alertRules.find(r => r.id === ruleId);
      if (rule) {
        Object.assign(rule, updates, {
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          rule,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action or missing parameters' },
      { status: 400 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function getEmptyStats(): AlertStats {
  return {
    totalAlerts: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    unacknowledgedCount: 0,
    byType: {},
  };
}
