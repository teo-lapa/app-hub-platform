import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot | null = null;

/**
 * Initialize Telegram bot (lazy initialization)
 */
function getBot(): TelegramBot {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: false, // No polling in production (use webhooks)
    });
  }

  if (!bot) {
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN env variable.');
  }

  return bot;
}

export interface TelegramAlertParams {
  chatId: string;
  message: string;
  parseMode?: 'Markdown' | 'HTML';
}

/**
 * Send generic Telegram message
 */
export async function sendTelegramAlert(params: TelegramAlertParams) {
  try {
    const telegramBot = getBot();
    const result = await telegramBot.sendMessage(params.chatId, params.message, {
      parse_mode: params.parseMode || 'Markdown',
    });

    console.log('Telegram message sent:', {
      messageId: result.message_id,
      chatId: params.chatId,
    });

    return result;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

/**
 * Send churn alert via Telegram
 */
export async function notifyChurn(params: {
  chatId: string;
  customerName: string;
  customerId: number;
  churnRisk: number;
  lastOrderDays: number;
  totalRevenue?: number;
}) {
  const urgencyEmoji = params.churnRisk >= 85 ? '🔴' : params.churnRisk >= 70 ? '🟠' : '🟡';
  const urgencyLevel = params.churnRisk >= 85 ? 'CRITICO' : params.churnRisk >= 70 ? 'ALTO' : 'MEDIO';

  const message = `
${urgencyEmoji} *Alert Churn ${urgencyLevel}*

*Cliente:* ${params.customerName}
*Rischio:* ${params.churnRisk}/100
*Ultimo ordine:* ${params.lastOrderDays} giorni fa
${params.totalRevenue ? `*Fatturato totale:* CHF ${params.totalRevenue.toLocaleString('it-CH')}` : ''}

⚠️ *Azione richiesta:* Contatta OGGI questo cliente

[Vedi Dashboard](${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/maestro-ai?customerId=${params.customerId})
  `.trim();

  return sendTelegramAlert({
    chatId: params.chatId,
    message,
  });
}

/**
 * Send daily summary via Telegram
 */
export async function notifyDailySummary(params: {
  chatId: string;
  salespersonName: string;
  date: string;
  summary: {
    visitsToday: number;
    visitsPending: number;
    churnAlerts: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    topCustomers?: Array<{ name: string; revenue: number }>;
  };
}) {
  const { summary } = params;

  const topCustomersText = summary.topCustomers && summary.topCustomers.length > 0
    ? '\n\n*🏆 Top Clienti:*\n' +
      summary.topCustomers.slice(0, 3).map((c, i) =>
        `${i + 1}. ${c.name} - CHF ${c.revenue.toLocaleString('it-CH')}`
      ).join('\n')
    : '';

  const message = `
📊 *Daily Summary - ${params.date}*

Ciao ${params.salespersonName}!

*Visite:*
✅ Completate oggi: ${summary.visitsToday}
⏳ Pendenti: ${summary.visitsPending}

*Alert:*
${summary.churnAlerts > 0 ? '⚠️' : '✅'} Churn alerts: ${summary.churnAlerts}

*Fatturato:*
💰 Oggi: CHF ${summary.revenueToday.toLocaleString('it-CH')}
📈 Settimana: CHF ${summary.revenueWeek.toLocaleString('it-CH')}
📊 Mese: CHF ${summary.revenueMonth.toLocaleString('it-CH')}${topCustomersText}

[Apri Dashboard](${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/maestro-ai)
  `.trim();

  return sendTelegramAlert({
    chatId: params.chatId,
    message,
  });
}

/**
 * Send visit reminder via Telegram
 */
export async function notifyVisitReminder(params: {
  chatId: string;
  customerName: string;
  visitDate: string;
  visitTime?: string;
  notes?: string;
}) {
  const message = `
🗓️ *Promemoria Visita*

*Cliente:* ${params.customerName}
*Data:* ${params.visitDate}${params.visitTime ? `\n*Ora:* ${params.visitTime}` : ''}
${params.notes ? `\n*Note:* ${params.notes}` : ''}

[Vedi Dettagli](${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/maestro-ai)
  `.trim();

  return sendTelegramAlert({
    chatId: params.chatId,
    message,
  });
}

/**
 * Test Telegram connection
 */
export async function testTelegramConnection(chatId: string) {
  const message = `
✅ *Test Connessione Riuscito*

Il tuo account Telegram è connesso correttamente a Maestro AI.

Riceverai notifiche per:
• Alert churn clienti
• Daily summary
• Promemoria visite

[Gestisci Notifiche](${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/settings/notifications)
  `.trim();

  return sendTelegramAlert({
    chatId,
    message,
  });
}

/**
 * Get bot info for verification
 */
export async function getBotInfo() {
  try {
    const telegramBot = getBot();
    return await telegramBot.getMe();
  } catch (error) {
    console.error('Error getting bot info:', error);
    throw error;
  }
}
