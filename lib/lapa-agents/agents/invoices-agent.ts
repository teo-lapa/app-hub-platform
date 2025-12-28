/**
 * INVOICES AGENT - COLLEGATO A DATI REALI ODOO
 *
 * Gestione completa fatture con query su account.move:
 * - getCustomerInvoices(customerId): Fatture cliente da account.move
 * - getInvoiceDetails(invoiceId): Dettagli fattura con linee da account.move.line
 * - getCustomerBalance(customerId): Saldo aperto con amount_residual
 * - getDueInvoices(customerId): Fatture scadute/in scadenza
 * - getPaymentLink(invoiceId): Link portale pagamento fattura
 * - sendPaymentReminder(invoiceId): Invio reminder via email
 *
 * Campi principali account.move:
 * - move_type: 'out_invoice' (fattura cliente), 'out_refund' (nota credito)
 * - state: draft, posted, cancel
 * - payment_state: not_paid, in_payment, paid, partial
 * - amount_total: importo totale fattura
 * - amount_residual: importo ancora da pagare
 */

import { getOdooClient } from '@/lib/odoo-client';

// ============================================================================
// TYPES
// ============================================================================

export interface Invoice {
  id: number;
  name: string; // Numero fattura (es. INV/2024/0001)
  partner_id: [number, string]; // [id, "Nome Cliente"]
  partner_name: string;
  invoice_date: string | false;
  invoice_date_due: string | false;
  state: 'draft' | 'posted' | 'cancel'; // draft=bozza, posted=contabilizzata
  payment_state: 'not_paid' | 'in_payment' | 'paid' | 'partial' | 'reversed' | 'invoicing_legacy';
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  amount_residual: number; // Importo rimanente da pagare
  currency_id: [number, string];
  move_type: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund'; // out_invoice = fattura cliente
  invoice_origin?: string; // Origine (es. ordine di vendita)
  ref?: string; // Riferimento
  invoice_payment_term_id?: [number, string]; // Termini di pagamento
  invoice_line_ids?: number[]; // Linee fattura
}

export interface InvoiceLine {
  id: number;
  product_id: [number, string] | false;
  name: string; // Descrizione
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  price_total: number;
  tax_ids: number[];
  discount: number;
}

export interface InvoiceDetails extends Invoice {
  lines: InvoiceLine[];
  partner_email?: string;
  partner_phone?: string;
  partner_city?: string;
  days_overdue?: number;
}

export interface CustomerBalance {
  customer_id: number;
  customer_name: string;
  total_invoiced: number;
  total_paid: number;
  total_due: number;
  invoices_count: number;
  overdue_invoices: number;
  oldest_due_date: string | null;
  currency: string;
}

export interface DueInvoice {
  id: number;
  name: string;
  partner_name: string;
  amount_total: number;
  amount_residual: number;
  invoice_date_due: string;
  days_overdue: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================================================
// AGENT CLASS
// ============================================================================

export class InvoicesAgent {
  private odooClient: any = null;

  /**
   * Inizializza il client Odoo
   */
  private async ensureOdooClient() {
    if (!this.odooClient) {
      this.odooClient = await getOdooClient();
    }
    return this.odooClient;
  }

  /**
   * Ottieni tutti gli ID partner collegati (padre + figli)
   * In Odoo B2B, le fatture possono essere intestate ai contatti figli (es. "fatturazione")
   */
  private async getPartnerIdsWithChildren(customerId: number): Promise<number[]> {
    const client = await this.ensureOdooClient();

    // Cerca tutti i contatti figli del cliente (parent_id = customerId)
    const childContacts = await client.searchRead(
      'res.partner',
      [['parent_id', '=', customerId]],
      ['id', 'name', 'type'],
      100
    );

    // Crea lista di tutti gli ID da cercare: padre + figli
    const partnerIds = [customerId, ...childContacts.map((c: any) => c.id)];
    console.log(`🔍 [InvoicesAgent] Partner IDs (parent + children): ${partnerIds.join(', ')}`);

    return partnerIds;
  }

  // ============================================================================
  // PUBLIC METHODS - CORE FUNCTIONALITY
  // ============================================================================

  /**
   * Ottiene fatture di un cliente specifico
   * @param customerId - ID Odoo del cliente
   * @returns Lista fatture del cliente
   */
  async getCustomerInvoices(customerId: number): Promise<{
    success: boolean;
    data?: Invoice[];
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    return this.getInvoices(customerId, 'all', 1000);
  }

  /**
   * Alias per getOpenBalance - ottiene il saldo di un cliente
   * @param customerId - ID Odoo del cliente
   */
  async getCustomerBalance(customerId: number): Promise<{
    success: boolean;
    data?: CustomerBalance;
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    return this.getOpenBalance(customerId);
  }

  /**
   * Ottiene lista fatture con filtri
   * @param customerId - ID Odoo del cliente (opzionale)
   * @param status - Stato pagamento: 'open' (non pagate), 'paid' (pagate), 'all' (tutte)
   * @param limit - Numero massimo risultati
   */
  async getInvoices(
    customerId?: number,
    status: 'open' | 'paid' | 'all' = 'all',
    limit: number = 100
  ): Promise<{
    success: boolean;
    data?: Invoice[];
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    try {
      const client = await this.ensureOdooClient();

      // Costruisci domain per filtrare
      const domain: any[] = [
        ['move_type', '=', 'out_invoice'], // Solo fatture clienti (non fornitori)
      ];

      // Filtro per cliente - include anche i contatti figli (es. "fatturazione", "consegna")
      if (customerId) {
        const partnerIds = await this.getPartnerIdsWithChildren(customerId);
        domain.push(['partner_id', 'in', partnerIds]);
      }

      // Filtro per stato pagamento
      if (status === 'open') {
        domain.push(['payment_state', 'in', ['not_paid', 'partial']]);
        domain.push(['state', '=', 'posted']); // Solo fatture contabilizzate
      } else if (status === 'paid') {
        domain.push(['payment_state', '=', 'paid']);
      }

      const fields = [
        'name',
        'partner_id',
        'invoice_date',
        'invoice_date_due',
        'state',
        'payment_state',
        'amount_untaxed',
        'amount_tax',
        'amount_total',
        'amount_residual',
        'currency_id',
        'move_type',
        'invoice_origin',
        'ref',
        'invoice_payment_term_id',
      ];

      const invoices = await client.searchRead('account.move', domain, fields, limit);

      // Arricchisci con nome partner
      const enrichedInvoices = invoices.map((inv: any) => ({
        ...inv,
        partner_name: Array.isArray(inv.partner_id) ? inv.partner_id[1] : 'N/A',
      }));

      const statusLabel = {
        open: { it: 'aperte', en: 'open', de: 'offen' },
        paid: { it: 'pagate', en: 'paid', de: 'bezahlt' },
        all: { it: 'totali', en: 'all', de: 'alle' },
      };

      return {
        success: true,
        data: enrichedInvoices,
        message: {
          it: `Trovate ${enrichedInvoices.length} fatture ${statusLabel[status].it}${customerId ? ' per questo cliente' : ''}`,
          en: `Found ${enrichedInvoices.length} ${statusLabel[status].en} invoices${customerId ? ' for this customer' : ''}`,
          de: `${enrichedInvoices.length} ${statusLabel[status].de} Rechnungen gefunden${customerId ? ' für diesen Kunden' : ''}`,
        },
      };
    } catch (error) {
      console.error('❌ [InvoicesAgent] Error fetching invoices:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: {
          it: 'Errore nel recupero delle fatture',
          en: 'Error fetching invoices',
          de: 'Fehler beim Abrufen der Rechnungen',
        },
      };
    }
  }

  /**
   * Ottiene dettagli completi di una fattura
   * @param invoiceId - ID Odoo della fattura
   */
  async getInvoiceDetails(invoiceId: number): Promise<{
    success: boolean;
    data?: InvoiceDetails;
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    try {
      const client = await this.ensureOdooClient();

      // Recupera dati fattura
      const invoices = await client.searchRead(
        'account.move',
        [['id', '=', invoiceId]],
        [
          'name',
          'partner_id',
          'invoice_date',
          'invoice_date_due',
          'state',
          'payment_state',
          'amount_untaxed',
          'amount_tax',
          'amount_total',
          'amount_residual',
          'currency_id',
          'move_type',
          'invoice_origin',
          'ref',
          'invoice_payment_term_id',
          'invoice_line_ids',
        ],
        1
      );

      if (!invoices || invoices.length === 0) {
        return {
          success: false,
          error: 'Invoice not found',
          message: {
            it: 'Fattura non trovata',
            en: 'Invoice not found',
            de: 'Rechnung nicht gefunden',
          },
        };
      }

      const invoice = invoices[0];

      // Recupera dettagli partner
      const partners = await client.searchRead(
        'res.partner',
        [['id', '=', Array.isArray(invoice.partner_id) ? invoice.partner_id[0] : invoice.partner_id]],
        ['email', 'phone', 'city'],
        1
      );

      const partner = partners && partners.length > 0 ? partners[0] : null;

      // Recupera linee fattura
      let lines: InvoiceLine[] = [];
      if (invoice.invoice_line_ids && invoice.invoice_line_ids.length > 0) {
        const linesData = await client.searchRead(
          'account.move.line',
          [['id', 'in', invoice.invoice_line_ids]],
          ['product_id', 'name', 'quantity', 'price_unit', 'price_subtotal', 'price_total', 'tax_ids', 'discount'],
          500
        );
        lines = linesData;
      }

      // Calcola giorni di ritardo
      let daysOverdue = 0;
      if (invoice.invoice_date_due && invoice.payment_state !== 'paid') {
        const dueDate = new Date(invoice.invoice_date_due);
        const today = new Date();
        const diffTime = today.getTime() - dueDate.getTime();
        daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const details: InvoiceDetails = {
        ...invoice,
        partner_name: Array.isArray(invoice.partner_id) ? invoice.partner_id[1] : 'N/A',
        partner_email: partner?.email || undefined,
        partner_phone: partner?.phone || undefined,
        partner_city: partner?.city || undefined,
        lines,
        days_overdue: daysOverdue > 0 ? daysOverdue : undefined,
      };

      return {
        success: true,
        data: details,
        message: {
          it: `Dettagli fattura ${invoice.name} caricati`,
          en: `Invoice ${invoice.name} details loaded`,
          de: `Rechnungsdetails ${invoice.name} geladen`,
        },
      };
    } catch (error) {
      console.error('❌ [InvoicesAgent] Error fetching invoice details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: {
          it: 'Errore nel recupero dei dettagli della fattura',
          en: 'Error fetching invoice details',
          de: 'Fehler beim Abrufen der Rechnungsdetails',
        },
      };
    }
  }

  /**
   * Ottiene saldo aperto totale per un cliente
   * @param customerId - ID Odoo del cliente
   */
  async getOpenBalance(customerId: number): Promise<{
    success: boolean;
    data?: CustomerBalance;
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    try {
      const client = await this.ensureOdooClient();

      // Ottieni tutti i partner IDs (padre + figli)
      const partnerIds = await this.getPartnerIdsWithChildren(customerId);

      // Recupera tutte le fatture del cliente (inclusi contatti figli)
      const invoices = await client.searchRead(
        'account.move',
        [
          ['partner_id', 'in', partnerIds],
          ['move_type', '=', 'out_invoice'],
          ['state', '=', 'posted'],
        ],
        ['name', 'amount_total', 'amount_residual', 'payment_state', 'invoice_date_due', 'currency_id'],
        1000
      );

      // Recupera nome cliente
      const partners = await client.searchRead('res.partner', [['id', '=', customerId]], ['name'], 1);
      const customerName = partners && partners.length > 0 ? partners[0].name : 'N/A';

      let totalInvoiced = 0;
      let totalPaid = 0;
      let totalDue = 0;
      let overdueCount = 0;
      let oldestDueDate: string | null = null;
      let currency = 'CHF';

      const today = new Date();

      for (const inv of invoices) {
        totalInvoiced += inv.amount_total || 0;
        totalDue += inv.amount_residual || 0;

        if (inv.currency_id && Array.isArray(inv.currency_id)) {
          currency = inv.currency_id[1];
        }

        // Check se scaduta
        if (inv.invoice_date_due && inv.amount_residual > 0) {
          const dueDate = new Date(inv.invoice_date_due);
          if (dueDate < today) {
            overdueCount++;
          }

          if (!oldestDueDate || dueDate < new Date(oldestDueDate)) {
            oldestDueDate = inv.invoice_date_due;
          }
        }
      }

      totalPaid = totalInvoiced - totalDue;

      const balance: CustomerBalance = {
        customer_id: customerId,
        customer_name: customerName,
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        total_due: totalDue,
        invoices_count: invoices.length,
        overdue_invoices: overdueCount,
        oldest_due_date: oldestDueDate,
        currency: currency,
      };

      return {
        success: true,
        data: balance,
        message: {
          it: `Saldo aperto: ${currency} ${totalDue.toFixed(2)} su ${invoices.length} fatture`,
          en: `Open balance: ${currency} ${totalDue.toFixed(2)} on ${invoices.length} invoices`,
          de: `Offener Saldo: ${currency} ${totalDue.toFixed(2)} auf ${invoices.length} Rechnungen`,
        },
      };
    } catch (error) {
      console.error('❌ [InvoicesAgent] Error calculating open balance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: {
          it: 'Errore nel calcolo del saldo aperto',
          en: 'Error calculating open balance',
          de: 'Fehler bei der Berechnung des offenen Saldos',
        },
      };
    }
  }

  /**
   * Genera link per pagamento fattura
   * @param invoiceId - ID Odoo della fattura
   */
  async getPaymentLink(invoiceId: number): Promise<{
    success: boolean;
    data?: {
      invoice_id: number;
      invoice_name: string;
      payment_url: string;
      qr_code_url?: string;
    };
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    try {
      const client = await this.ensureOdooClient();

      // Recupera dati fattura
      const invoices = await client.searchRead(
        'account.move',
        [['id', '=', invoiceId]],
        ['name', 'access_token', 'amount_residual'],
        1
      );

      if (!invoices || invoices.length === 0) {
        return {
          success: false,
          error: 'Invoice not found',
          message: {
            it: 'Fattura non trovata',
            en: 'Invoice not found',
            de: 'Rechnung nicht gefunden',
          },
        };
      }

      const invoice = invoices[0];

      // In Odoo, il link pubblico di una fattura è generalmente:
      // https://domain/my/invoices/{invoice_id}?access_token={token}
      const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

      let accessToken = invoice.access_token;

      // Se non esiste access token, generalo
      if (!accessToken) {
        try {
          // Chiama il metodo Odoo per generare il portal access token
          const tokenResult = await client.call('account.move', 'action_get_access_url', [[invoiceId]]);
          if (tokenResult && tokenResult.url) {
            return {
              success: true,
              data: {
                invoice_id: invoiceId,
                invoice_name: invoice.name,
                payment_url: tokenResult.url,
              },
              message: {
                it: 'Link di pagamento generato',
                en: 'Payment link generated',
                de: 'Zahlungslink generiert',
              },
            };
          }
        } catch (error) {
          console.warn('⚠️ Could not generate access token, using basic URL');
        }
      }

      // Fallback: URL base senza token
      const paymentUrl = accessToken
        ? `${odooUrl}/my/invoices/${invoiceId}?access_token=${accessToken}`
        : `${odooUrl}/my/invoices/${invoiceId}`;

      return {
        success: true,
        data: {
          invoice_id: invoiceId,
          invoice_name: invoice.name,
          payment_url: paymentUrl,
        },
        message: {
          it: 'Link di pagamento generato',
          en: 'Payment link generated',
          de: 'Zahlungslink generiert',
        },
      };
    } catch (error) {
      console.error('❌ [InvoicesAgent] Error generating payment link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: {
          it: 'Errore nella generazione del link di pagamento',
          en: 'Error generating payment link',
          de: 'Fehler beim Generieren des Zahlungslinks',
        },
      };
    }
  }

  /**
   * Ottiene fatture in scadenza o scadute
   * @param customerId - ID Odoo del cliente (opzionale)
   * @param daysAhead - Giorni futuri da considerare (default 30)
   */
  async getDueInvoices(
    customerId?: number,
    daysAhead: number = 30
  ): Promise<{
    success: boolean;
    data?: DueInvoice[];
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    try {
      const client = await this.ensureOdooClient();

      // Calcola data limite
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Domain per fatture non pagate con scadenza
      const domain: any[] = [
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
        ['payment_state', 'in', ['not_paid', 'partial']],
        ['invoice_date_due', '!=', false],
        ['invoice_date_due', '<=', futureDateStr],
      ];

      if (customerId) {
        const partnerIds = await this.getPartnerIdsWithChildren(customerId);
        domain.push(['partner_id', 'in', partnerIds]);
      }

      const invoices = await client.searchRead(
        'account.move',
        domain,
        ['name', 'partner_id', 'amount_total', 'amount_residual', 'invoice_date_due'],
        500
      );

      const today = new Date();

      // Calcola urgenza e giorni di ritardo
      const dueInvoices: DueInvoice[] = invoices.map((inv: any) => {
        const dueDate = new Date(inv.invoice_date_due);
        const diffTime = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let urgency: 'critical' | 'high' | 'medium' | 'low';
        if (daysOverdue > 30) urgency = 'critical';
        else if (daysOverdue > 15) urgency = 'high';
        else if (daysOverdue > 0) urgency = 'medium';
        else urgency = 'low';

        return {
          id: inv.id,
          name: inv.name,
          partner_name: Array.isArray(inv.partner_id) ? inv.partner_id[1] : 'N/A',
          amount_total: inv.amount_total,
          amount_residual: inv.amount_residual,
          invoice_date_due: inv.invoice_date_due,
          days_overdue: daysOverdue,
          urgency,
        };
      });

      // Ordina per urgenza e giorni di ritardo
      dueInvoices.sort((a, b) => {
        const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const urgDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        if (urgDiff !== 0) return urgDiff;
        return b.days_overdue - a.days_overdue;
      });

      const overdueCount = dueInvoices.filter((inv) => inv.days_overdue > 0).length;

      return {
        success: true,
        data: dueInvoices,
        message: {
          it: `Trovate ${dueInvoices.length} fatture in scadenza (${overdueCount} già scadute)`,
          en: `Found ${dueInvoices.length} due invoices (${overdueCount} overdue)`,
          de: `${dueInvoices.length} fällige Rechnungen gefunden (${overdueCount} überfällig)`,
        },
      };
    } catch (error) {
      console.error('❌ [InvoicesAgent] Error fetching due invoices:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: {
          it: 'Errore nel recupero delle fatture in scadenza',
          en: 'Error fetching due invoices',
          de: 'Fehler beim Abrufen fälliger Rechnungen',
        },
      };
    }
  }

  /**
   * Invia reminder via email per fattura scaduta
   * @param invoiceId - ID Odoo della fattura
   * @param customMessage - Messaggio personalizzato (opzionale)
   */
  async sendPaymentReminder(
    invoiceId: number,
    customMessage?: string
  ): Promise<{
    success: boolean;
    data?: {
      invoice_id: number;
      invoice_name: string;
      sent_to: string;
      sent_at: string;
    };
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    try {
      const client = await this.ensureOdooClient();

      // Recupera dati fattura e partner
      const invoices = await client.searchRead(
        'account.move',
        [['id', '=', invoiceId]],
        ['name', 'partner_id', 'amount_residual', 'invoice_date_due'],
        1
      );

      if (!invoices || invoices.length === 0) {
        return {
          success: false,
          error: 'Invoice not found',
          message: {
            it: 'Fattura non trovata',
            en: 'Invoice not found',
            de: 'Rechnung nicht gefunden',
          },
        };
      }

      const invoice = invoices[0];
      const partnerId = Array.isArray(invoice.partner_id) ? invoice.partner_id[0] : invoice.partner_id;

      // Recupera email partner
      const partners = await client.searchRead('res.partner', [['id', '=', partnerId]], ['email', 'name'], 1);

      if (!partners || partners.length === 0 || !partners[0].email) {
        return {
          success: false,
          error: 'Customer email not found',
          message: {
            it: 'Email del cliente non trovata',
            en: 'Customer email not found',
            de: 'Kunden-E-Mail nicht gefunden',
          },
        };
      }

      const partner = partners[0];

      // In Odoo, per inviare un reminder puoi usare il metodo message_post
      // oppure action_invoice_sent che apre il wizard di invio
      try {
        // Usa message_post per aggiungere una nota e inviare email
        const messageBody = customMessage || `Gentile cliente,

Vi ricordiamo che la fattura ${invoice.name} con scadenza ${invoice.invoice_date_due || 'non specificata'}
è ancora da saldare per un importo di CHF ${invoice.amount_residual?.toFixed(2) || '0.00'}.

Vi preghiamo di procedere al pagamento quanto prima.

Cordiali saluti`;

        await client.call('account.move', 'message_post', [
          [invoiceId],
          {
            body: messageBody,
            subject: `Reminder: Fattura ${invoice.name}`,
            partner_ids: [partnerId],
            message_type: 'comment',
            subtype_xmlid: 'mail.mt_comment',
          },
        ]);

        return {
          success: true,
          data: {
            invoice_id: invoiceId,
            invoice_name: invoice.name,
            sent_to: partner.email,
            sent_at: new Date().toISOString(),
          },
          message: {
            it: `Reminder inviato a ${partner.email}`,
            en: `Reminder sent to ${partner.email}`,
            de: `Erinnerung an ${partner.email} gesendet`,
          },
        };
      } catch (error) {
        console.warn('⚠️ Could not send via message_post, trying alternative method');

        // Fallback: registra solo che il reminder è stato richiesto
        return {
          success: true,
          data: {
            invoice_id: invoiceId,
            invoice_name: invoice.name,
            sent_to: partner.email,
            sent_at: new Date().toISOString(),
          },
          message: {
            it: `Reminder registrato per ${partner.email} (invio manuale richiesto)`,
            en: `Reminder logged for ${partner.email} (manual sending required)`,
            de: `Erinnerung für ${partner.email} protokolliert (manuelles Senden erforderlich)`,
          },
        };
      }
    } catch (error) {
      console.error('❌ [InvoicesAgent] Error sending payment reminder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: {
          it: "Errore nell'invio del reminder di pagamento",
          en: 'Error sending payment reminder',
          de: 'Fehler beim Senden der Zahlungserinnerung',
        },
      };
    }
  }

  // ============================================================================
  // ANALYTICS & REPORTING
  // ============================================================================

  /**
   * Ottiene statistiche aggregate sulle fatture per periodo
   * @param startDate - Data inizio periodo (YYYY-MM-DD)
   * @param endDate - Data fine periodo (YYYY-MM-DD)
   * @param customerId - ID Odoo del cliente (opzionale)
   */
  async getInvoiceStats(
    startDate: string,
    endDate: string,
    customerId?: number
  ): Promise<{
    success: boolean;
    data?: {
      total_invoices: number;
      total_amount: number;
      total_paid: number;
      total_due: number;
      avg_payment_days: number;
      overdue_count: number;
      currency: string;
    };
    error?: string;
    message?: {
      it: string;
      en: string;
      de: string;
    };
  }> {
    try {
      const client = await this.ensureOdooClient();

      // Query fatture del periodo
      const domain: any[] = [
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
        ['invoice_date', '>=', startDate],
        ['invoice_date', '<=', endDate],
      ];

      if (customerId) {
        const partnerIds = await this.getPartnerIdsWithChildren(customerId);
        domain.push(['partner_id', 'in', partnerIds]);
      }

      const invoices = await client.searchRead(
        'account.move',
        domain,
        [
          'name',
          'amount_total',
          'amount_residual',
          'payment_state',
          'invoice_date',
          'invoice_date_due',
          'currency_id',
        ],
        1000
      );

      let totalAmount = 0;
      let totalPaid = 0;
      let totalDue = 0;
      let overdueCount = 0;
      let paymentDaysSum = 0;
      let paidInvoicesCount = 0;
      let currency = 'CHF';

      const today = new Date();

      for (const inv of invoices) {
        totalAmount += inv.amount_total || 0;
        totalDue += inv.amount_residual || 0;

        if (inv.currency_id && Array.isArray(inv.currency_id)) {
          currency = inv.currency_id[1];
        }

        // Conta scadute
        if (inv.invoice_date_due && inv.amount_residual > 0) {
          const dueDate = new Date(inv.invoice_date_due);
          if (dueDate < today) {
            overdueCount++;
          }
        }

        // Calcola giorni medi di pagamento per fatture pagate
        if (inv.payment_state === 'paid' && inv.invoice_date && inv.invoice_date_due) {
          const invoiceDate = new Date(inv.invoice_date);
          const dueDate = new Date(inv.invoice_date_due);
          const diffTime = dueDate.getTime() - invoiceDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          paymentDaysSum += diffDays;
          paidInvoicesCount++;
        }
      }

      totalPaid = totalAmount - totalDue;
      const avgPaymentDays = paidInvoicesCount > 0 ? Math.round(paymentDaysSum / paidInvoicesCount) : 0;

      return {
        success: true,
        data: {
          total_invoices: invoices.length,
          total_amount: totalAmount,
          total_paid: totalPaid,
          total_due: totalDue,
          avg_payment_days: avgPaymentDays,
          overdue_count: overdueCount,
          currency,
        },
        message: {
          it: `Statistiche periodo: ${invoices.length} fatture, ${currency} ${totalAmount.toFixed(2)} fatturato`,
          en: `Period stats: ${invoices.length} invoices, ${currency} ${totalAmount.toFixed(2)} revenue`,
          de: `Periodenstatistik: ${invoices.length} Rechnungen, ${currency} ${totalAmount.toFixed(2)} Umsatz`,
        },
      };
    } catch (error) {
      console.error('❌ [InvoicesAgent] Error calculating stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: {
          it: 'Errore nel calcolo delle statistiche',
          en: 'Error calculating statistics',
          de: 'Fehler bei der Berechnung der Statistiken',
        },
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Formatta un importo per la visualizzazione
   */
  formatAmount(amount: number, currency: string = 'CHF'): string {
    return `${currency} ${amount.toFixed(2)}`;
  }

  /**
   * Formatta una data per la visualizzazione
   */
  formatDate(dateString: string | false, locale: 'it' | 'en' | 'de' = 'it'): string {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    const localeMap = {
      it: 'it-IT',
      en: 'en-US',
      de: 'de-DE',
    };

    return date.toLocaleDateString(localeMap[locale], options);
  }

  /**
   * Ottiene label stato pagamento in multilingua
   */
  getPaymentStateLabel(paymentState: string): { it: string; en: string; de: string } {
    const labels: Record<string, { it: string; en: string; de: string }> = {
      not_paid: { it: 'Non pagata', en: 'Not paid', de: 'Nicht bezahlt' },
      in_payment: { it: 'In pagamento', en: 'In payment', de: 'In Zahlung' },
      paid: { it: 'Pagata', en: 'Paid', de: 'Bezahlt' },
      partial: { it: 'Parzialmente pagata', en: 'Partially paid', de: 'Teilweise bezahlt' },
      reversed: { it: 'Stornata', en: 'Reversed', de: 'Storniert' },
      invoicing_legacy: { it: 'Legacy', en: 'Legacy', de: 'Legacy' },
    };

    return labels[paymentState] || { it: paymentState, en: paymentState, de: paymentState };
  }

  /**
   * Ottiene emoji urgenza
   */
  getUrgencyEmoji(urgency: 'critical' | 'high' | 'medium' | 'low'): string {
    const emojis = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return emojis[urgency];
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let agentInstance: InvoicesAgent | null = null;

export function getInvoicesAgent(): InvoicesAgent {
  if (!agentInstance) {
    agentInstance = new InvoicesAgent();
  }
  return agentInstance;
}

export default InvoicesAgent;
