/**
 * MAESTRO AI - Notification Check Cron Endpoint
 *
 * POST /api/maestro/notifications/check
 *
 * Checks for customers that need notifications and sends alerts
 * Called by Vercel Cron (daily at 9 AM)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { sendChurnAlert } from '@/lib/notifications/email';
import { notifyChurn } from '@/lib/notifications/telegram';
import {
  NOTIFICATION_RULES,
  shouldNotify,
  getNotificationChannels,
  shouldThrottle,
} from '@/lib/notifications/rules';

interface NotificationPreferences {
  salesperson_id: number;
  email_enabled: boolean;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  churn_threshold: number;
}

interface CustomerAvatar {
  id: number;
  odoo_partner_id: number;
  name: string;
  email: string | null;
  churn_risk_score: number;
  days_since_last_order: number;
  last_order_date: Date | null;
  avg_order_value: number;
  total_revenue: number;
  revenue_trend: string;
  assigned_salesperson_id: number | null;
  assigned_salesperson_name: string | null;
  assigned_salesperson_email: string | null;
}

interface NotificationLog {
  customer_id: number;
  rule_name: string;
  last_sent_at: Date | null;
}

/**
 * POST /api/maestro/notifications/check
 *
 * Authentication: Requires Bearer token matching CRON_SECRET
 */
export async function POST(request: NextRequest) {
  console.log('\n🔔 [Notifications] Check endpoint triggered');

  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    console.warn('⚠️  [Notifications] Unauthorized attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const startTime = Date.now();
    let notificationsSent = 0;
    let notificationsSkipped = 0;
    const errors: Array<{ customerId: number; error: string }> = [];

    // 1. Fetch all active customer avatars with high/critical churn risk
    console.log('📊 [Notifications] Fetching high-risk customers...');

    const { rows: customers } = await sql<CustomerAvatar>`
      SELECT
        id,
        odoo_partner_id,
        name,
        email,
        churn_risk_score,
        days_since_last_order,
        last_order_date,
        avg_order_value,
        total_revenue,
        revenue_trend,
        assigned_salesperson_id,
        assigned_salesperson_name,
        assigned_salesperson_email
      FROM customer_avatars
      WHERE
        churn_risk_score >= 70
        AND assigned_salesperson_email IS NOT NULL
        AND is_active = true
      ORDER BY churn_risk_score DESC
    `;

    console.log(`   Found ${customers.length} high-risk customers`);

    if (customers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No high-risk customers found',
        stats: {
          checked: 0,
          notificationsSent: 0,
          notificationsSkipped: 0,
        },
      });
    }

    // 2. Fetch notification preferences for all salespeople
    console.log('⚙️  [Notifications] Fetching salesperson preferences...');

    const { rows: preferences } = await sql<NotificationPreferences>`
      SELECT
        salesperson_id,
        email_enabled,
        telegram_enabled,
        telegram_chat_id,
        churn_threshold
      FROM notification_preferences
    `.catch(() => ({ rows: [] })); // Table might not exist yet

    const preferencesMap = new Map(
      preferences.map(p => [p.salesperson_id, p])
    );

    console.log(`   Loaded preferences for ${preferences.length} salespeople`);

    // 3. Fetch notification logs to check throttling
    console.log('📝 [Notifications] Fetching notification logs...');

    const { rows: logs } = await sql<NotificationLog>`
      SELECT
        customer_id,
        rule_name,
        MAX(sent_at) as last_sent_at
      FROM notification_logs
      WHERE
        sent_at > NOW() - INTERVAL '30 days'
      GROUP BY customer_id, rule_name
    `.catch(() => ({ rows: [] })); // Table might not exist yet

    const logsMap = new Map<string, Date>();
    logs.forEach(log => {
      const key = `${log.customer_id}:${log.rule_name}`;
      logsMap.set(key, log.last_sent_at!);
    });

    // 4. Process each customer and send notifications
    console.log('🚀 [Notifications] Processing customers...');

    for (const customer of customers) {
      try {
        // Get salesperson preferences
        const prefs = preferencesMap.get(customer.assigned_salesperson_id || 0);

        // Determine which notification rule applies
        let ruleName: keyof typeof NOTIFICATION_RULES | null = null;

        if (customer.churn_risk_score >= 85) {
          ruleName = 'CHURN_CRITICAL';
        } else if (customer.churn_risk_score >= 70) {
          ruleName = 'CHURN_HIGH';
        }

        if (!ruleName) {
          notificationsSkipped++;
          continue;
        }

        // Check if we should send notification based on preferences
        const userPrefs = prefs
          ? {
              enabled: prefs.email_enabled || prefs.telegram_enabled,
              churnThreshold: prefs.churn_threshold,
              emailEnabled: prefs.email_enabled,
              telegramEnabled: prefs.telegram_enabled,
            }
          : { enabled: true }; // Default: enabled if no preferences

        if (!shouldNotify(ruleName, customer, userPrefs)) {
          notificationsSkipped++;
          continue;
        }

        // Check throttling
        const logKey = `${customer.id}:${ruleName}`;
        const lastSent = logsMap.get(logKey) || null;

        if (shouldThrottle(ruleName, lastSent)) {
          console.log(`   ⏸️  Skipping ${customer.name} - throttled (last sent: ${lastSent})`);
          notificationsSkipped++;
          continue;
        }

        // Get notification channels
        const channels = getNotificationChannels(ruleName, userPrefs);

        if (channels.length === 0) {
          notificationsSkipped++;
          continue;
        }

        // Send notifications
        console.log(`   📤 Sending ${ruleName} alert for ${customer.name} via ${channels.join(', ')}`);

        for (const channel of channels) {
          try {
            if (channel === 'email' && customer.assigned_salesperson_email) {
              await sendChurnAlert({
                salespersonEmail: customer.assigned_salesperson_email,
                salespersonName: customer.assigned_salesperson_name || undefined,
                customerName: customer.name,
                customerId: customer.odoo_partner_id,
                churnRisk: customer.churn_risk_score,
                lastOrderDays: customer.days_since_last_order,
                lastOrderDate: customer.last_order_date?.toISOString().split('T')[0],
                avgOrderValue: customer.avg_order_value,
                totalRevenue: customer.total_revenue,
              });

              notificationsSent++;
            }

            if (channel === 'telegram' && prefs?.telegram_chat_id) {
              await notifyChurn({
                chatId: prefs.telegram_chat_id,
                customerName: customer.name,
                customerId: customer.odoo_partner_id,
                churnRisk: customer.churn_risk_score,
                lastOrderDays: customer.days_since_last_order,
                totalRevenue: customer.total_revenue,
              });

              notificationsSent++;
            }
          } catch (channelError: any) {
            console.error(`   ❌ Error sending ${channel} notification:`, channelError.message);
            errors.push({
              customerId: customer.id,
              error: `${channel}: ${channelError.message}`,
            });
          }
        }

        // Log notification
        await sql`
          INSERT INTO notification_logs (
            customer_id,
            rule_name,
            channels,
            sent_at
          ) VALUES (
            ${customer.id},
            ${ruleName},
            ${JSON.stringify(channels)},
            NOW()
          )
        `.catch(err => {
          console.warn('   ⚠️  Failed to log notification:', err.message);
        });

      } catch (customerError: any) {
        console.error(`   ❌ Error processing customer ${customer.name}:`, customerError);
        errors.push({
          customerId: customer.id,
          error: customerError.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ [Notifications] Check complete in ${duration}ms`);
    console.log(`   - Customers checked: ${customers.length}`);
    console.log(`   - Notifications sent: ${notificationsSent}`);
    console.log(`   - Skipped: ${notificationsSkipped}`);
    console.log(`   - Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      message: 'Notification check complete',
      stats: {
        customersChecked: customers.length,
        notificationsSent,
        notificationsSkipped,
        errors: errors.length,
        durationMs: duration,
      },
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('❌ [Notifications] Check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Notification check failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/maestro/notifications/check
 *
 * Get notification check status (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Get recent notification logs
    const { rows: recentLogs } = await sql`
      SELECT
        rule_name,
        COUNT(*) as count,
        MAX(sent_at) as last_sent
      FROM notification_logs
      WHERE sent_at > NOW() - INTERVAL '7 days'
      GROUP BY rule_name
      ORDER BY last_sent DESC
    `.catch(() => ({ rows: [] }));

    // Get high-risk customers count
    const { rows: [stats] } = await sql`
      SELECT
        COUNT(*) as total_high_risk,
        COUNT(*) FILTER (WHERE churn_risk_score >= 85) as critical_count,
        COUNT(*) FILTER (WHERE churn_risk_score >= 70 AND churn_risk_score < 85) as high_count
      FROM customer_avatars
      WHERE churn_risk_score >= 70 AND is_active = true
    `;

    return NextResponse.json({
      success: true,
      stats: {
        highRiskCustomers: {
          total: Number(stats.total_high_risk),
          critical: Number(stats.critical_count),
          high: Number(stats.high_count),
        },
        recentNotifications: recentLogs.map(log => ({
          rule: log.rule_name,
          count: Number(log.count),
          lastSent: log.last_sent,
        })),
      },
    });

  } catch (error: any) {
    console.error('❌ [Notifications] Failed to get status:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get notification status',
      },
      { status: 500 }
    );
  }
}
