/**
 * MAESTRO AI - Notification Test Endpoints
 *
 * Test email and Telegram notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendChurnAlert, sendDailySummary } from '@/lib/notifications/email';
import { notifyChurn, notifyDailySummary, testTelegramConnection, getBotInfo } from '@/lib/notifications/telegram';

/**
 * POST /api/maestro/notifications/test
 *
 * Test different notification types
 *
 * Body:
 * {
 *   "type": "email" | "telegram" | "both",
 *   "notificationType": "churn" | "summary",
 *   "email": "test@example.com",  // For email tests
 *   "telegramChatId": "123456789"  // For Telegram tests
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, notificationType, email, telegramChatId, salespersonName } = body;

    const results: any = {
      success: true,
      results: {},
    };

    // ===== EMAIL TESTS =====
    if (type === 'email' || type === 'both') {
      if (!email) {
        return NextResponse.json(
          { error: 'Email address required for email test' },
          { status: 400 }
        );
      }

      if (notificationType === 'churn' || !notificationType) {
        console.log('📧 Testing churn alert email...');

        try {
          const churnResult = await sendChurnAlert({
            salespersonEmail: email,
            salespersonName: salespersonName || 'Test User',
            customerName: 'Demo Cliente S.r.l.',
            customerId: 12345,
            churnRisk: 87,
            lastOrderDays: 65,
            lastOrderDate: '2024-11-15',
            avgOrderValue: 3500.50,
            totalRevenue: 125000.75,
          });

          results.results.churnEmail = {
            success: true,
            emailId: churnResult.data?.id,
            message: 'Churn alert email sent successfully',
          };
        } catch (error: any) {
          results.results.churnEmail = {
            success: false,
            error: error.message,
          };
          results.success = false;
        }
      }

      if (notificationType === 'summary' || !notificationType) {
        console.log('📧 Testing daily summary email...');

        try {
          const summaryResult = await sendDailySummary({
            salespersonEmail: email,
            salespersonName: salespersonName || 'Test User',
            date: new Date().toLocaleDateString('it-CH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            summary: {
              visitsToday: 3,
              visitsPending: 5,
              churnAlerts: 2,
              highRiskCustomers: [
                {
                  name: 'Demo Cliente 1 S.r.l.',
                  churnRisk: 87,
                  lastOrderDays: 65,
                },
                {
                  name: 'Demo Cliente 2 AG',
                  churnRisk: 75,
                  lastOrderDays: 48,
                },
              ],
              revenue: {
                today: 5200,
                thisWeek: 24500,
                thisMonth: 98750,
              },
              topCustomers: [
                { name: 'Top Cliente 1', revenue: 45000 },
                { name: 'Top Cliente 2', revenue: 38500 },
                { name: 'Top Cliente 3', revenue: 29800 },
              ],
            },
          });

          results.results.summaryEmail = {
            success: true,
            emailId: summaryResult.data?.id,
            message: 'Daily summary email sent successfully',
          };
        } catch (error: any) {
          results.results.summaryEmail = {
            success: false,
            error: error.message,
          };
          results.success = false;
        }
      }
    }

    // ===== TELEGRAM TESTS =====
    if (type === 'telegram' || type === 'both') {
      if (!telegramChatId) {
        return NextResponse.json(
          { error: 'Telegram chat ID required for Telegram test' },
          { status: 400 }
        );
      }

      if (notificationType === 'churn' || !notificationType) {
        console.log('💬 Testing churn alert Telegram...');

        try {
          await notifyChurn({
            chatId: telegramChatId,
            customerName: 'Demo Cliente S.r.l.',
            customerId: 12345,
            churnRisk: 87,
            lastOrderDays: 65,
            totalRevenue: 125000,
          });

          results.results.churnTelegram = {
            success: true,
            message: 'Churn alert Telegram sent successfully',
          };
        } catch (error: any) {
          results.results.churnTelegram = {
            success: false,
            error: error.message,
          };
          results.success = false;
        }
      }

      if (notificationType === 'summary' || !notificationType) {
        console.log('💬 Testing daily summary Telegram...');

        try {
          await notifyDailySummary({
            chatId: telegramChatId,
            salespersonName: salespersonName || 'Test User',
            date: new Date().toLocaleDateString('it-CH'),
            summary: {
              visitsToday: 3,
              visitsPending: 5,
              churnAlerts: 2,
              revenueToday: 5200,
              revenueWeek: 24500,
              revenueMonth: 98750,
              topCustomers: [
                { name: 'Top Cliente 1', revenue: 45000 },
                { name: 'Top Cliente 2', revenue: 38500 },
                { name: 'Top Cliente 3', revenue: 29800 },
              ],
            },
          });

          results.results.summaryTelegram = {
            success: true,
            message: 'Daily summary Telegram sent successfully',
          };
        } catch (error: any) {
          results.results.summaryTelegram = {
            success: false,
            error: error.message,
          };
          results.success = false;
        }
      }
    }

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('❌ Test notification failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Test notification failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/maestro/notifications/test
 *
 * Test Telegram bot connection and get bot info
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const telegramChatId = searchParams.get('telegramChatId');

    // Get bot info
    let botInfo = null;
    try {
      botInfo = await getBotInfo();
    } catch (error: any) {
      console.error('Failed to get bot info:', error);
    }

    // Test connection if chat ID provided
    let connectionTest = null;
    if (telegramChatId) {
      try {
        await testTelegramConnection(telegramChatId);
        connectionTest = {
          success: true,
          message: 'Test message sent successfully',
        };
      } catch (error: any) {
        connectionTest = {
          success: false,
          error: error.message,
        };
      }
    }

    return NextResponse.json({
      success: true,
      telegram: {
        configured: !!process.env.TELEGRAM_BOT_TOKEN,
        botInfo,
        connectionTest,
      },
      email: {
        configured: !!process.env.RESEND_API_KEY,
      },
    });

  } catch (error: any) {
    console.error('❌ Connection test failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Connection test failed',
      },
      { status: 500 }
    );
  }
}
