/**
 * MAESTRO AI - Daily Summary Notification Endpoint
 *
 * POST /api/maestro/notifications/daily-summary
 *
 * Sends daily summary emails to all salespeople
 * Called by Vercel Cron (daily at 8 AM)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { sendDailySummary } from '@/lib/notifications/email';
import { notifyDailySummary } from '@/lib/notifications/telegram';

interface Salesperson {
  id: number;
  name: string;
  email: string;
}

interface NotificationPreferences {
  salesperson_id: number;
  email_enabled: boolean;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
}

interface SalespersonStats {
  visits_today: number;
  visits_pending: number;
  churn_alerts: number;
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
}

/**
 * POST /api/maestro/notifications/daily-summary
 *
 * Authentication: Requires Bearer token matching CRON_SECRET
 */
export async function POST(request: NextRequest) {
  console.log('\n📊 [Daily Summary] Endpoint triggered');

  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    console.warn('⚠️  [Daily Summary] Unauthorized attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const startTime = Date.now();
    let summariesSent = 0;
    const errors: Array<{ salespersonId: number; error: string }> = [];

    // Get today's date for the summary
    const today = new Date();
    const dateStr = today.toLocaleDateString('it-CH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 1. Fetch all active salespeople
    console.log('👥 [Daily Summary] Fetching salespeople...');

    const { rows: salespeople } = await sql<Salesperson>`
      SELECT DISTINCT
        id,
        name,
        email
      FROM salespeople
      WHERE email IS NOT NULL AND email != ''
      ORDER BY name
    `;

    console.log(`   Found ${salespeople.length} salespeople`);

    if (salespeople.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No salespeople found',
        stats: { summariesSent: 0 },
      });
    }

    // 2. Fetch notification preferences
    console.log('⚙️  [Daily Summary] Fetching preferences...');

    const { rows: preferences } = await sql<NotificationPreferences>`
      SELECT
        salesperson_id,
        email_enabled,
        telegram_enabled,
        telegram_chat_id,
        daily_summary_enabled,
        daily_summary_time
      FROM notification_preferences
    `.catch(() => ({ rows: [] }));

    const preferencesMap = new Map(
      preferences.map(p => [p.salesperson_id, p])
    );

    // 3. Process each salesperson
    console.log('🚀 [Daily Summary] Generating summaries...');

    for (const salesperson of salespeople) {
      try {
        // Check preferences
        const prefs = preferencesMap.get(salesperson.id);

        // Skip if daily summary is disabled
        if (prefs && prefs.daily_summary_enabled === false) {
          console.log(`   ⏭️  Skipping ${salesperson.name} - daily summary disabled`);
          continue;
        }

        // Fetch stats for this salesperson
        const stats = await fetchSalespersonStats(salesperson.id);

        // Fetch high-risk customers
        const highRiskCustomers = await fetchHighRiskCustomers(salesperson.id);

        // Fetch top customers
        const topCustomers = await fetchTopCustomers(salesperson.id);

        // Prepare summary data
        const summary = {
          visitsToday: stats.visits_today,
          visitsPending: stats.visits_pending,
          churnAlerts: stats.churn_alerts,
          highRiskCustomers: highRiskCustomers.map(c => ({
            name: c.name,
            churnRisk: c.churn_risk_score,
            lastOrderDays: c.days_since_last_order,
          })),
          revenue: {
            today: stats.revenue_today,
            thisWeek: stats.revenue_week,
            thisMonth: stats.revenue_month,
          },
          topCustomers: topCustomers.map(c => ({
            name: c.name,
            revenue: c.total_revenue,
          })),
        };

        // Send email if enabled
        if (!prefs || prefs.email_enabled !== false) {
          console.log(`   📧 Sending email to ${salesperson.name}`);

          await sendDailySummary({
            salespersonEmail: salesperson.email,
            salespersonName: salesperson.name,
            date: dateStr,
            summary,
          });

          summariesSent++;
        }

        // Send Telegram if enabled and chat ID exists
        if (prefs?.telegram_enabled && prefs.telegram_chat_id) {
          console.log(`   💬 Sending Telegram to ${salesperson.name}`);

          await notifyDailySummary({
            chatId: prefs.telegram_chat_id,
            salespersonName: salesperson.name,
            date: dateStr,
            summary: {
              visitsToday: stats.visits_today,
              visitsPending: stats.visits_pending,
              churnAlerts: stats.churn_alerts,
              revenueToday: stats.revenue_today,
              revenueWeek: stats.revenue_week,
              revenueMonth: stats.revenue_month,
              topCustomers: summary.topCustomers.slice(0, 3),
            },
          });

          summariesSent++;
        }

      } catch (salespersonError: any) {
        console.error(`   ❌ Error processing ${salesperson.name}:`, salespersonError);
        errors.push({
          salespersonId: salesperson.id,
          error: salespersonError.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ [Daily Summary] Complete in ${duration}ms`);
    console.log(`   - Salespeople: ${salespeople.length}`);
    console.log(`   - Summaries sent: ${summariesSent}`);
    console.log(`   - Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      message: 'Daily summaries sent',
      stats: {
        salespeople: salespeople.length,
        summariesSent,
        errors: errors.length,
        durationMs: duration,
      },
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('❌ [Daily Summary] Failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Daily summary generation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch statistics for a salesperson
 */
async function fetchSalespersonStats(salespersonId: number): Promise<SalespersonStats> {
  // Visits today
  const { rows: [visitsToday] } = await sql`
    SELECT COUNT(*) as count
    FROM customer_visits
    WHERE
      salesperson_id = ${salespersonId}
      AND visit_date = CURRENT_DATE
      AND status = 'completed'
  `.catch(() => ({ rows: [{ count: 0 }] }));

  // Visits pending
  const { rows: [visitsPending] } = await sql`
    SELECT COUNT(*) as count
    FROM customer_visits
    WHERE
      salesperson_id = ${salespersonId}
      AND status = 'pending'
  `.catch(() => ({ rows: [{ count: 0 }] }));

  // Churn alerts (high-risk customers)
  const { rows: [churnAlerts] } = await sql`
    SELECT COUNT(*) as count
    FROM customer_avatars
    WHERE
      assigned_salesperson_id = ${salespersonId}
      AND churn_risk_score >= 70
      AND is_active = true
  `.catch(() => ({ rows: [{ count: 0 }] }));

  // Revenue calculations would require joining with Odoo data
  // For now, we'll use placeholder values or aggregate from customer_avatars
  const { rows: [revenue] } = await sql`
    SELECT
      COALESCE(SUM(total_revenue) FILTER (
        WHERE last_order_date >= CURRENT_DATE
      ), 0) as revenue_today,
      COALESCE(SUM(total_revenue) FILTER (
        WHERE last_order_date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0) as revenue_week,
      COALESCE(SUM(total_revenue) FILTER (
        WHERE last_order_date >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) as revenue_month
    FROM customer_avatars
    WHERE assigned_salesperson_id = ${salespersonId}
  `.catch(() => ({
    rows: [{
      revenue_today: 0,
      revenue_week: 0,
      revenue_month: 0,
    }],
  }));

  return {
    visits_today: Number(visitsToday.count),
    visits_pending: Number(visitsPending.count),
    churn_alerts: Number(churnAlerts.count),
    revenue_today: Number(revenue.revenue_today),
    revenue_week: Number(revenue.revenue_week),
    revenue_month: Number(revenue.revenue_month),
  };
}

/**
 * Fetch high-risk customers for a salesperson
 */
async function fetchHighRiskCustomers(salespersonId: number) {
  const { rows } = await sql`
    SELECT
      name,
      churn_risk_score,
      days_since_last_order
    FROM customer_avatars
    WHERE
      assigned_salesperson_id = ${salespersonId}
      AND churn_risk_score >= 70
      AND is_active = true
    ORDER BY churn_risk_score DESC
    LIMIT 5
  `.catch(() => ({ rows: [] }));

  return rows;
}

/**
 * Fetch top customers by revenue for a salesperson
 */
async function fetchTopCustomers(salespersonId: number) {
  const { rows } = await sql`
    SELECT
      name,
      total_revenue
    FROM customer_avatars
    WHERE
      assigned_salesperson_id = ${salespersonId}
      AND is_active = true
    ORDER BY total_revenue DESC
    LIMIT 5
  `.catch(() => ({ rows: [] }));

  return rows;
}

/**
 * GET /api/maestro/notifications/daily-summary
 *
 * Get daily summary preview for testing
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const salespersonId = searchParams.get('salespersonId');

  if (!salespersonId) {
    return NextResponse.json(
      { error: 'salespersonId required' },
      { status: 400 }
    );
  }

  try {
    const stats = await fetchSalespersonStats(Number(salespersonId));
    const highRiskCustomers = await fetchHighRiskCustomers(Number(salespersonId));
    const topCustomers = await fetchTopCustomers(Number(salespersonId));

    return NextResponse.json({
      success: true,
      stats,
      highRiskCustomers,
      topCustomers,
    });

  } catch (error: any) {
    console.error('❌ [Daily Summary] Failed to fetch preview:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch summary preview',
      },
      { status: 500 }
    );
  }
}
