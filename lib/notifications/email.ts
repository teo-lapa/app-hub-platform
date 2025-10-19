import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ChurnAlertParams {
  salespersonEmail: string;
  salespersonName?: string;
  customerName: string;
  customerId: number;
  churnRisk: number;
  lastOrderDays: number;
  lastOrderDate?: string;
  avgOrderValue?: number;
  totalRevenue?: number;
}

export interface DailySummaryParams {
  salespersonEmail: string;
  salespersonName: string;
  date: string;
  summary: {
    visitsToday: number;
    visitsPending: number;
    churnAlerts: number;
    highRiskCustomers: Array<{
      name: string;
      churnRisk: number;
      lastOrderDays: number;
    }>;
    revenue: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    topCustomers: Array<{
      name: string;
      revenue: number;
    }>;
  };
}

/**
 * Send churn alert email to salesperson
 */
export async function sendChurnAlert(params: ChurnAlertParams) {
  try {
    const {
      salespersonEmail,
      salespersonName,
      customerName,
      customerId,
      churnRisk,
      lastOrderDays,
      lastOrderDate,
      avgOrderValue,
      totalRevenue,
    } = params;

    const urgencyLevel = churnRisk >= 85 ? 'CRITICO' : churnRisk >= 70 ? 'ALTO' : 'MEDIO';
    const urgencyColor = churnRisk >= 85 ? '#dc2626' : churnRisk >= 70 ? '#f59e0b' : '#3b82f6';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alert Churn - ${customerName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: ${urgencyColor}; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
                🚨 Alert Churn - ${urgencyLevel}
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              <p style="margin: 0; font-size: 16px; color: #374151;">
                Ciao ${salespersonName || 'Team'},
              </p>
              <p style="margin: 15px 0 0; font-size: 16px; color: #374151;">
                Un cliente assegnato a te richiede attenzione immediata:
              </p>
            </td>
          </tr>

          <!-- Customer Card -->
          <tr>
            <td style="padding: 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border-left: 4px solid ${urgencyColor};">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 15px; font-size: 20px; color: #111827;">
                      ${customerName}
                    </h2>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #6b7280; font-size: 14px;">Rischio Churn:</strong>
                        </td>
                        <td align="right" style="padding: 8px 0;">
                          <span style="background-color: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 600;">
                            ${churnRisk}/100
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #6b7280; font-size: 14px;">Ultimo Ordine:</strong>
                        </td>
                        <td align="right" style="padding: 8px 0; color: #111827; font-size: 14px;">
                          ${lastOrderDays} giorni fa
                          ${lastOrderDate ? `<br/><span style="color: #6b7280; font-size: 12px;">(${lastOrderDate})</span>` : ''}
                        </td>
                      </tr>
                      ${avgOrderValue ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #6b7280; font-size: 14px;">Valore Medio Ordine:</strong>
                        </td>
                        <td align="right" style="padding: 8px 0; color: #111827; font-size: 14px;">
                          CHF ${avgOrderValue.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      ` : ''}
                      ${totalRevenue ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #6b7280; font-size: 14px;">Fatturato Totale:</strong>
                        </td>
                        <td align="right" style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">
                          CHF ${totalRevenue.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Required -->
          <tr>
            <td style="padding: 30px 40px;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                  ⚠️ Azione Richiesta
                </p>
                <p style="margin: 8px 0 0; color: #78350f; font-size: 14px;">
                  Contatta questo cliente OGGI per prevenire la perdita di fatturato.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px;" align="center">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/maestro-ai?customerId=${customerId}"
                 style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Vedi Dashboard Maestro AI
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                Questo è un alert automatico di Maestro AI<br/>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/settings/notifications" style="color: #2563eb; text-decoration: none;">
                  Gestisci preferenze notifiche
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: 'Maestro AI <maestro@lapa.ch>',
      to: salespersonEmail,
      subject: `🚨 Alert Churn ${urgencyLevel}: ${customerName}`,
      html,
    });

    console.log('Churn alert email sent:', {
      emailId: result.data?.id,
      to: salespersonEmail,
      customer: customerName,
      churnRisk,
    });

    return result;
  } catch (error) {
    console.error('Error sending churn alert email:', error);
    throw error;
  }
}

/**
 * Send daily summary email to salesperson
 */
export async function sendDailySummary(params: DailySummaryParams) {
  try {
    const { salespersonEmail, salespersonName, date, summary } = params;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Summary - ${date}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
                📊 Daily Summary
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${date}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              <p style="margin: 0; font-size: 16px; color: #374151;">
                Ciao ${salespersonName},
              </p>
              <p style="margin: 10px 0 0; font-size: 16px; color: #374151;">
                Ecco il riepilogo della tua giornata:
              </p>
            </td>
          </tr>

          <!-- Stats Grid -->
          <tr>
            <td style="padding: 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding: 0 10px 20px 0;">
                    <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                      <p style="margin: 0; color: #1e40af; font-size: 12px; font-weight: 600; text-transform: uppercase;">Visite Oggi</p>
                      <p style="margin: 8px 0 0; color: #1e3a8a; font-size: 32px; font-weight: 700;">${summary.visitsToday}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding: 0 0 20px 10px;">
                    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase;">Visite Pendenti</p>
                      <p style="margin: 8px 0 0; color: #78350f; font-size: 32px; font-weight: 700;">${summary.visitsPending}</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 0 10px 20px 0;">
                    <div style="background-color: ${summary.churnAlerts > 0 ? '#fee2e2' : '#f0fdf4'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${summary.churnAlerts > 0 ? '#dc2626' : '#22c55e'};">
                      <p style="margin: 0; color: ${summary.churnAlerts > 0 ? '#991b1b' : '#166534'}; font-size: 12px; font-weight: 600; text-transform: uppercase;">Alert Churn</p>
                      <p style="margin: 8px 0 0; color: ${summary.churnAlerts > 0 ? '#7f1d1d' : '#14532d'}; font-size: 32px; font-weight: 700;">${summary.churnAlerts}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding: 0 0 20px 10px;">
                    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e;">
                      <p style="margin: 0; color: #166534; font-size: 12px; font-weight: 600; text-transform: uppercase;">Revenue Oggi</p>
                      <p style="margin: 8px 0 0; color: #14532d; font-size: 24px; font-weight: 700;">CHF ${summary.revenue.today.toLocaleString('it-CH')}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Revenue Summary -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Fatturato</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Questa Settimana:</td>
                        <td align="right" style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">
                          CHF ${summary.revenue.thisWeek.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Questo Mese:</td>
                        <td align="right" style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">
                          CHF ${summary.revenue.thisMonth.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${summary.highRiskCustomers.length > 0 ? `
          <!-- High Risk Customers -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">⚠️ Clienti ad Alto Rischio</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; overflow: hidden;">
                ${summary.highRiskCustomers.slice(0, 5).map((customer, idx) => `
                <tr>
                  <td style="padding: 12px 16px; ${idx > 0 ? 'border-top: 1px solid #fde68a;' : ''}">
                    <strong style="color: #78350f; font-size: 14px;">${customer.name}</strong><br/>
                    <span style="color: #92400e; font-size: 12px;">
                      Rischio: ${customer.churnRisk}/100 | Ultimo ordine: ${customer.lastOrderDays}gg fa
                    </span>
                  </td>
                </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          ${summary.topCustomers.length > 0 ? `
          <!-- Top Customers -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">🏆 Top Clienti (Fatturato)</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; overflow: hidden;">
                ${summary.topCustomers.slice(0, 5).map((customer, idx) => `
                <tr>
                  <td style="padding: 12px 16px; ${idx > 0 ? 'border-top: 1px solid #bbf7d0;' : ''}">
                    <strong style="color: #14532d; font-size: 14px;">${customer.name}</strong>
                    <span style="float: right; color: #166534; font-size: 14px; font-weight: 600;">
                      CHF ${customer.revenue.toLocaleString('it-CH')}
                    </span>
                  </td>
                </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 40px;" align="center">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/maestro-ai"
                 style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Apri Dashboard Maestro AI
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                Daily summary automatico di Maestro AI<br/>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://maestro.lapa.ch'}/settings/notifications" style="color: #2563eb; text-decoration: none;">
                  Gestisci preferenze notifiche
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: 'Maestro AI <maestro@lapa.ch>',
      to: salespersonEmail,
      subject: `📊 Daily Summary - ${date}`,
      html,
    });

    console.log('Daily summary email sent:', {
      emailId: result.data?.id,
      to: salespersonEmail,
      date,
    });

    return result;
  } catch (error) {
    console.error('Error sending daily summary email:', error);
    throw error;
  }
}
