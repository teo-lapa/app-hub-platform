/**
 * HELPDESK AGENT
 * Agent per gestire il supporto clienti tramite Odoo Helpdesk
 *
 * Funzionalità:
 * - Creazione ticket helpdesk
 * - Visualizzazione ticket esistenti
 * - Aggiornamento stato e commenti
 * - Escalation a operatore umano
 * - Notifiche via email al team
 *
 * INTEGRAZIONE ODOO:
 * - Usa getOdooClient per connessione ai dati reali (stesso client usato dagli altri agenti)
 * - Modello principale: helpdesk.ticket
 * - Fallback a mail.message se helpdesk non disponibile
 */

import { getOdooClient } from '@/lib/odoo-client';
import { Resend } from 'resend';

// Configurazione email - lazy initialization per evitare errori se RESEND_API_KEY non è configurato
let resendInstance: Resend | null = null;
const HELPDESK_TEAM_EMAIL = 'lapa@lapa.ch';

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY non configurato - le email non verranno inviate');
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Tipi
export interface HelpdeskTicket {
  id: number;
  name: string; // Subject
  description?: string;
  partner_id: number; // Customer ID
  partner_name?: string;
  team_id?: number;
  user_id?: number; // Assigned to
  stage_id: number;
  stage_name?: string;
  priority: '0' | '1' | '2' | '3'; // 0=Low, 1=Medium, 2=High, 3=Urgent
  create_date: string;
  write_date: string;
  kanban_state: 'normal' | 'done' | 'blocked';
  message_ids?: number[];
}

export interface TicketComment {
  id: number;
  body: string;
  author_id: number;
  author_name?: string;
  date: string;
  message_type: 'comment' | 'notification' | 'email';
}

export interface CreateTicketParams {
  customerId: number;
  subject: string;
  description: string;
  priority?: '0' | '1' | '2' | '3';
  attachments?: Array<{
    name: string;
    content: string; // base64
    mimetype: string;
  }>;
}

export interface TicketListFilters {
  customerId?: number;
  stageId?: number;
  priority?: string;
  assignedToMe?: boolean;
  limit?: number;
  offset?: number;
}

// Traduzioni multilingua
const TRANSLATIONS = {
  it: {
    ticketCreated: 'Ticket creato con successo',
    ticketNotFound: 'Ticket non trovato',
    ticketUpdated: 'Ticket aggiornato',
    escalated: 'Ticket escalato a supporto umano',
    notificationSent: 'Notifica inviata al team',
    error: 'Errore durante l\'operazione',
    noTickets: 'Nessun ticket trovato',
    priorities: {
      '0': 'Bassa',
      '1': 'Media',
      '2': 'Alta',
      '3': 'Urgente'
    },
    stages: {
      new: 'Nuovo',
      in_progress: 'In lavorazione',
      pending: 'In attesa',
      solved: 'Risolto',
      closed: 'Chiuso'
    }
  },
  en: {
    ticketCreated: 'Ticket created successfully',
    ticketNotFound: 'Ticket not found',
    ticketUpdated: 'Ticket updated',
    escalated: 'Ticket escalated to human support',
    notificationSent: 'Notification sent to team',
    error: 'Error during operation',
    noTickets: 'No tickets found',
    priorities: {
      '0': 'Low',
      '1': 'Medium',
      '2': 'High',
      '3': 'Urgent'
    },
    stages: {
      new: 'New',
      in_progress: 'In Progress',
      pending: 'Pending',
      solved: 'Solved',
      closed: 'Closed'
    }
  },
  de: {
    ticketCreated: 'Ticket erfolgreich erstellt',
    ticketNotFound: 'Ticket nicht gefunden',
    ticketUpdated: 'Ticket aktualisiert',
    escalated: 'Ticket an menschlichen Support eskaliert',
    notificationSent: 'Benachrichtigung an Team gesendet',
    error: 'Fehler bei der Operation',
    noTickets: 'Keine Tickets gefunden',
    priorities: {
      '0': 'Niedrig',
      '1': 'Mittel',
      '2': 'Hoch',
      '3': 'Dringend'
    },
    stages: {
      new: 'Neu',
      in_progress: 'In Bearbeitung',
      pending: 'Wartend',
      solved: 'Gelöst',
      closed: 'Geschlossen'
    }
  }
};

type Language = 'it' | 'en' | 'de';

// Wrapper per il client Odoo che mantiene la stessa interfaccia di prima
class OdooRPCWrapper {
  private client: Awaited<ReturnType<typeof getOdooClient>> | null = null;

  async ensureClient() {
    if (!this.client) {
      this.client = await getOdooClient();
    }
    return this.client;
  }

  async searchRead(model: string, domain: any[], fields: string[], limit?: number, order?: string) {
    const client = await this.ensureClient();
    // Usa searchReadKw per supportare l'ordinamento
    return client.searchReadKw(model, domain, fields, { limit: limit || 100, order: order || '' });
  }

  async callKw(model: string, method: string, args: any[], kwargs?: any) {
    const client = await this.ensureClient();
    return client.call(model, method, args, kwargs || {});
  }
}

export class HelpdeskAgent {
  private odooRPC: OdooRPCWrapper;
  private lang: Language = 'it';

  constructor(sessionId?: string, language: Language = 'it') {
    this.odooRPC = new OdooRPCWrapper();
    this.lang = language;
  }

  /**
   * Imposta la lingua
   */
  setLanguage(lang: Language) {
    this.lang = lang;
  }

  /**
   * Ottieni traduzione
   */
  private t(key: string): string {
    const keys = key.split('.');
    let value: any = TRANSLATIONS[this.lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  /**
   * Verifica se il modulo Helpdesk è disponibile
   */
  private async checkHelpdeskAvailable(): Promise<boolean> {
    // No caching - controlla ogni volta per evitare problemi con session expired
    try {
      // Prova a cercare 1 ticket per verificare che il modello esista
      console.log('🔍 Checking if helpdesk.ticket model is available...');
      await this.odooRPC.searchRead('helpdesk.ticket', [], ['id'], 1);
      console.log('✅ Helpdesk module available');
      return true;
    } catch (error: any) {
      console.log('⚠️ Helpdesk check error:', error.message);
      // Se è un errore di sessione, propaga
      if (error.message?.toLowerCase().includes('session')) {
        console.warn('⚠️ Session error checking helpdesk:', error.message);
        throw error;
      }
      // SOLO se il modello non esiste, usa fallback
      if (error.message?.toLowerCase().includes('does not exist') ||
          error.message?.toLowerCase().includes('model not found')) {
        console.log('⚠️ Helpdesk module not installed, will use fallback');
        return false;
      }
      // Per TUTTI gli altri errori (permessi, server error, ecc), assume che helpdesk esiste
      // e lascia che l'errore venga gestito nella creazione del ticket
      console.log('⚠️ Error during helpdesk check, but assuming module exists');
      return true;
    }
  }

  /**
   * CREA TICKET
   * Crea un nuovo ticket helpdesk e invia notifica email
   */
  async createTicket(params: CreateTicketParams): Promise<{
    success: boolean;
    ticketId?: number;
    ticket?: HelpdeskTicket;
    message?: string;
    error?: string;
  }> {
    try {
      console.log('🎫 Creating helpdesk ticket:', params);

      // Crea SEMPRE in helpdesk.ticket - niente fallback
      return await this.createHelpdeskTicket(params);

    } catch (error: any) {
      console.error('🎫 Error creating ticket:', error);
      return {
        success: false,
        error: error.message || this.t('error'),
        message: `Errore nella creazione del ticket. Per favore contatta lapa@lapa.ch`
      };
    }
  }

  /**
   * Crea ticket usando il modulo helpdesk.ticket
   * IMPORTANTE: Il ticket viene SEMPRE assegnato al venditore del cliente (user_id del partner)
   */
  private async createHelpdeskTicket(params: CreateTicketParams): Promise<{
    success: boolean;
    ticketId?: number;
    ticket?: HelpdeskTicket;
    message?: string;
    error?: string;
  }> {
    // Usa sempre il team "Servizio clienti" (support@lapa.ch) - ID 1
    const teamId = 1;
    console.log('🎫 Using helpdesk team: Servizio clienti (ID: 1)');

    // Recupera il venditore (user_id) del cliente per assegnare il ticket
    let salespersonId: number | null = null;
    let salespersonName: string | null = null;
    try {
      const customers = await this.odooRPC.callKw(
        'res.partner',
        'read',
        [[params.customerId], ['user_id', 'name']]
      );
      if (customers && customers.length > 0 && customers[0].user_id) {
        salespersonId = customers[0].user_id[0];
        salespersonName = customers[0].user_id[1];
        console.log(`🎫 Ticket will be assigned to salesperson: ${salespersonName} (ID: ${salespersonId})`);
      }
    } catch (e) {
      console.warn('🎫 Could not retrieve salesperson for customer:', e);
    }

    // Prepara i valori per il ticket
    const ticketValues: Record<string, any> = {
      name: params.subject,
      description: params.description,
      partner_id: params.customerId,
      priority: params.priority || '1',
      team_id: teamId,
    };

    // Assegna al venditore del cliente se disponibile
    if (salespersonId) {
      ticketValues.user_id = salespersonId;
    }

    console.log('🎫 Creating ticket with values:', JSON.stringify(ticketValues));

    // Crea il ticket tramite Odoo RPC
    let ticketId;
    try {
      ticketId = await this.odooRPC.callKw(
        'helpdesk.ticket',
        'create',
        [ticketValues]
      );
    } catch (createError: any) {
      console.error('🎫 Error creating helpdesk.ticket:', createError.message);
      console.error('🎫 Full error:', JSON.stringify(createError));

      // NON fare fallback - ritorna l'errore direttamente
      // Il ticket DEVE essere creato in helpdesk.ticket
      return {
        success: false,
        error: `Errore creazione ticket: ${createError.message || 'Errore sconosciuto'}`,
        message: `Non riesco a creare il ticket. Errore: ${createError.message}. Per favore contatta lapa@lapa.ch`
      };
    }

    if (!ticketId) {
      throw new Error('Failed to create ticket - no ID returned');
    }

    console.log('🎫 Ticket created with ID:', ticketId);

    // Gestisci allegati se presenti
    if (params.attachments && params.attachments.length > 0) {
      await this.attachFiles(ticketId, params.attachments, 'helpdesk.ticket');
    }

    // Leggi il ticket appena creato per ottenere tutti i dati
    const ticket = await this.getTicketById(ticketId);

    // Invia notifica email al team
    await this.sendTicketCreatedEmail({
      ticketId,
      subject: params.subject,
      description: params.description,
      customerId: params.customerId,
      priority: params.priority || '1',
    });

    return {
      success: true,
      ticketId,
      ticket: ticket || undefined,
      message: this.t('ticketCreated'),
    };
  }

  /**
   * Fallback: crea messaggio usando mail.message o crm.lead
   */
  private async createMailMessage(params: CreateTicketParams): Promise<{
    success: boolean;
    ticketId?: number;
    message?: string;
    error?: string;
  }> {
    console.log('🎫 Using fallback for ticket creation');

    const messageBody = `
      <h3>${params.subject}</h3>
      <p>${params.description}</p>
      <p><strong>Customer ID:</strong> ${params.customerId}</p>
      <p><strong>Priority:</strong> ${params.priority || '1'}</p>
    `;

    // Prima prova crm.lead che è più strutturato e visibile
    try {
      console.log('🎫 Trying crm.lead fallback...');
      const leadId = await this.odooRPC.callKw(
        'crm.lead',
        'create',
        [{
          name: `[Ticket AI] ${params.subject}`,
          description: params.description,
          partner_id: params.customerId,
          type: 'opportunity', // O 'lead' se preferisci
          priority: params.priority || '1',
          tag_ids: [[6, 0, []]], // Nessun tag iniziale
        }]
      );

      console.log('🎫 CRM Lead created with ID:', leadId);

      // Invia notifica email al team
      await this.sendTicketCreatedEmail({
        ticketId: leadId,
        subject: `[CRM Lead] ${params.subject}`,
        description: params.description,
        customerId: params.customerId,
        priority: params.priority || '1',
      });

      return {
        success: true,
        ticketId: leadId,
        message: `${this.t('ticketCreated')} (creato come Lead CRM #${leadId})`,
      };
    } catch (crmError: any) {
      console.warn('🎫 CRM Lead creation failed:', crmError.message);
    }

    // Se crm.lead fallisce, prova mail.message
    try {
      console.log('🎫 Trying mail.message fallback...');
      const messageId = await this.odooRPC.callKw(
        'mail.message',
        'create',
        [{
          subject: `[Ticket AI] ${params.subject}`,
          body: messageBody,
          message_type: 'notification',
          subtype_id: 1, // Note subtype
          model: 'res.partner',
          res_id: params.customerId,
        }]
      );

      console.log('🎫 Mail message created with ID:', messageId);

      // Gestisci allegati se presenti
      if (params.attachments && params.attachments.length > 0) {
        await this.attachFiles(messageId, params.attachments, 'mail.message');
      }

      // Invia notifica email al team
      await this.sendTicketCreatedEmail({
        ticketId: messageId,
        subject: `[Messaggio] ${params.subject}`,
        description: params.description,
        customerId: params.customerId,
        priority: params.priority || '1',
      });

      return {
        success: true,
        ticketId: messageId,
        message: `${this.t('ticketCreated')} (creato come messaggio #${messageId})`,
      };
    } catch (mailError: any) {
      console.error('🎫 Mail.message creation also failed:', mailError.message);
      return {
        success: false,
        error: `Impossibile creare richiesta: ${mailError.message}`,
        message: 'Non riesco a creare la richiesta di supporto. Per favore contatta direttamente lapa@lapa.ch'
      };
    }
  }

  /**
   * LISTA TICKET
   * Ottieni lista ticket con filtri (alias: getCustomerTickets)
   */
  async getTickets(filters: TicketListFilters = {}): Promise<{
    success: boolean;
    tickets?: HelpdeskTicket[];
    count?: number;
    error?: string;
  }> {
    try {
      const isHelpdeskAvailable = await this.checkHelpdeskAvailable();

      if (!isHelpdeskAvailable) {
        console.log('Helpdesk not available, cannot fetch tickets');
        return {
          success: false,
          error: 'Helpdesk module not available',
        };
      }

      // Costruisci domain per la query
      const domain: any[] = [];

      if (filters.customerId) {
        domain.push(['partner_id', '=', filters.customerId]);
      }

      if (filters.stageId) {
        domain.push(['stage_id', '=', filters.stageId]);
      }

      if (filters.priority) {
        domain.push(['priority', '=', filters.priority]);
      }

      console.log('Fetching tickets with domain:', domain);

      // Esegui search_read tramite RPC
      const tickets = await this.odooRPC.searchRead(
        'helpdesk.ticket',
        domain,
        [
          'name',
          'description',
          'partner_id',
          'team_id',
          'user_id',
          'stage_id',
          'priority',
          'create_date',
          'write_date',
          'kanban_state',
          'message_ids',
        ],
        filters.limit || 50,
        'create_date desc'
      );

      // Formatta i risultati
      const formattedTickets: HelpdeskTicket[] = tickets.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        partner_id: Array.isArray(t.partner_id) ? t.partner_id[0] : t.partner_id,
        partner_name: Array.isArray(t.partner_id) ? t.partner_id[1] : undefined,
        team_id: Array.isArray(t.team_id) ? t.team_id[0] : t.team_id,
        user_id: Array.isArray(t.user_id) ? t.user_id[0] : t.user_id,
        stage_id: Array.isArray(t.stage_id) ? t.stage_id[0] : t.stage_id,
        stage_name: Array.isArray(t.stage_id) ? t.stage_id[1] : undefined,
        priority: t.priority || '1',
        create_date: t.create_date,
        write_date: t.write_date,
        kanban_state: t.kanban_state || 'normal',
        message_ids: t.message_ids || [],
      }));

      console.log(`Found ${formattedTickets.length} tickets`);

      return {
        success: true,
        tickets: formattedTickets,
        count: formattedTickets.length,
      };

    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      return {
        success: false,
        error: error.message || this.t('error'),
      };
    }
  }

  /**
   * LISTA TICKET CLIENTE (alias semantico)
   * Wrapper per getTickets con customerId
   */
  async getCustomerTickets(customerId: number): Promise<{
    success: boolean;
    tickets?: HelpdeskTicket[];
    count?: number;
    error?: string;
  }> {
    return this.getTickets({ customerId });
  }

  /**
   * STATO TICKET
   * Ottieni dettagli completi di un ticket specifico (alias: getTicketDetails)
   */
  async getTicketStatus(ticketId: number): Promise<{
    success: boolean;
    ticket?: HelpdeskTicket;
    comments?: TicketComment[];
    error?: string;
  }> {
    try {
      const ticket = await this.getTicketById(ticketId);

      if (!ticket) {
        return {
          success: false,
          error: this.t('ticketNotFound'),
        };
      }

      // Ottieni commenti/messaggi del ticket
      const comments = await this.getTicketComments(ticketId);

      return {
        success: true,
        ticket,
        comments,
      };

    } catch (error: any) {
      console.error('Error fetching ticket status:', error);
      return {
        success: false,
        error: error.message || this.t('error'),
      };
    }
  }

  /**
   * DETTAGLI TICKET (alias semantico)
   * Wrapper per getTicketStatus
   */
  async getTicketDetails(ticketId: number): Promise<{
    success: boolean;
    ticket?: HelpdeskTicket;
    comments?: TicketComment[];
    error?: string;
  }> {
    return this.getTicketStatus(ticketId);
  }

  /**
   * AGGIUNGI COMMENTO
   * Aggiungi un commento/messaggio a un ticket
   */
  async addComment(
    ticketId: number,
    message: string,
    internal: boolean = false
  ): Promise<{
    success: boolean;
    commentId?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const isHelpdeskAvailable = await this.checkHelpdeskAvailable();

      console.log(`Adding comment to ticket ${ticketId}:`, message);

      if (isHelpdeskAvailable) {
        // Usa il metodo message_post per aggiungere un commento al ticket
        const commentId = await this.odooRPC.callKw(
          'helpdesk.ticket',
          'message_post',
          [[ticketId]],
          {
            body: message,
            message_type: internal ? 'comment' : 'notification',
            subtype_xmlid: internal ? 'mail.mt_note' : 'mail.mt_comment',
          }
        );

        console.log('Comment added with ID:', commentId);

        return {
          success: true,
          commentId,
          message: this.t('ticketUpdated'),
        };
      } else {
        // Fallback: aggiungi messaggio direttamente in mail.message
        const commentId = await this.odooRPC.callKw(
          'mail.message',
          'create',
          [{
            body: message,
            message_type: internal ? 'comment' : 'notification',
            model: 'mail.message',
            res_id: ticketId,
          }]
        );

        console.log('Message added with ID:', commentId);

        return {
          success: true,
          commentId,
          message: this.t('ticketUpdated'),
        };
      }

    } catch (error: any) {
      console.error('Error adding comment:', error);
      return {
        success: false,
        error: error.message || this.t('error'),
      };
    }
  }

  /**
   * ESCALATION A UMANO
   * Marca il ticket come urgente e assegna a un operatore umano
   */
  async escalateToHuman(
    ticketId: number,
    reason: string,
    assignToUserId?: number
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const isHelpdeskAvailable = await this.checkHelpdeskAvailable();

      console.log(`Escalating ticket ${ticketId} to human support`);

      if (isHelpdeskAvailable) {
        // Aggiorna il ticket: priorità urgente + stato bloccato
        const updateValues: Record<string, any> = {
          priority: '3', // Urgente
          kanban_state: 'blocked', // Bloccato = richiede attenzione
        };

        if (assignToUserId) {
          updateValues.user_id = assignToUserId;
        }

        await this.odooRPC.callKw(
          'helpdesk.ticket',
          'write',
          [[ticketId], updateValues]
        );
      }

      // Aggiungi commento con il motivo dell'escalation
      await this.addComment(
        ticketId,
        `🚨 ESCALATION A SUPPORTO UMANO\n\nMotivo: ${reason}`,
        false
      );

      // Invia notifica al team
      await this.notifyTeam(ticketId, `Ticket escalato: ${reason}`);

      return {
        success: true,
        message: this.t('escalated'),
      };

    } catch (error: any) {
      console.error('Error escalating ticket:', error);
      return {
        success: false,
        error: error.message || this.t('error'),
      };
    }
  }

  /**
   * NOTIFICA TEAM
   * Invia notifica email al team helpdesk
   */
  async notifyTeam(
    ticketId: number,
    message: string,
    urgent: boolean = false
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Ottieni dettagli ticket
      const ticket = await this.getTicketById(ticketId);

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      const priority = this.t(`priorities.${ticket.priority}`);
      const urgencyColor = ticket.priority === '3' ? '#dc2626' :
                          ticket.priority === '2' ? '#f59e0b' :
                          ticket.priority === '1' ? '#3b82f6' : '#6b7280';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Helpdesk Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: ${urgencyColor}; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
                ${urgent ? '🚨' : '📬'} Helpdesk Notification
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                ${message}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 15px; font-size: 18px; color: #111827;">
                      Ticket #${ticketId}: ${ticket.name}
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Cliente:</td>
                        <td align="right" style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">
                          ${ticket.partner_name || `ID ${ticket.partner_id}`}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Priorità:</td>
                        <td align="right" style="padding: 6px 0;">
                          <span style="background-color: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            ${priority}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Stato:</td>
                        <td align="right" style="padding: 6px 0; color: #111827; font-size: 14px;">
                          ${ticket.stage_name || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Creato:</td>
                        <td align="right" style="padding: 6px 0; color: #111827; font-size: 14px;">
                          ${new Date(ticket.create_date).toLocaleString('it-IT')}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 40px;" align="center">
              <a href="${process.env.ODOO_URL || 'http://localhost:8069'}/web#id=${ticketId}&model=helpdesk.ticket&view_type=form"
                 style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Vedi Ticket su Odoo
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                Notifica automatica Helpdesk Agent - LAPA Food
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

      const resend = getResend();
      if (!resend) {
        console.log('⚠️ Email non inviata - Resend non configurato');
        return {
          success: true,
          message: this.t('notificationSent') + ' (email skipped - Resend not configured)',
        };
      }

      const result = await resend.emails.send({
        from: 'Helpdesk LAPA <helpdesk@lapa.ch>',
        to: HELPDESK_TEAM_EMAIL,
        subject: `${urgent ? '🚨 URGENTE - ' : ''}Ticket #${ticketId}: ${ticket.name}`,
        html,
      });

      console.log('Team notification sent:', {
        emailId: result.data?.id,
        ticketId,
      });

      return {
        success: true,
        message: this.t('notificationSent'),
      };

    } catch (error: any) {
      console.error('Error sending team notification:', error);
      return {
        success: false,
        error: error.message || this.t('error'),
      };
    }
  }

  /**
   * HELPER: Ottieni ticket per ID
   */
  private async getTicketById(ticketId: number): Promise<HelpdeskTicket | null> {
    try {
      const isHelpdeskAvailable = await this.checkHelpdeskAvailable();

      if (!isHelpdeskAvailable) {
        return null;
      }

      const tickets = await this.odooRPC.callKw(
        'helpdesk.ticket',
        'read',
        [[ticketId]],
        {
          fields: [
            'name',
            'description',
            'partner_id',
            'team_id',
            'user_id',
            'stage_id',
            'priority',
            'create_date',
            'write_date',
            'kanban_state',
            'message_ids',
          ],
        }
      );

      if (!tickets || tickets.length === 0) {
        return null;
      }

      const t = tickets[0];
      return {
        id: t.id,
        name: t.name,
        description: t.description || '',
        partner_id: Array.isArray(t.partner_id) ? t.partner_id[0] : t.partner_id,
        partner_name: Array.isArray(t.partner_id) ? t.partner_id[1] : undefined,
        team_id: Array.isArray(t.team_id) ? t.team_id[0] : t.team_id,
        user_id: Array.isArray(t.user_id) ? t.user_id[0] : t.user_id,
        stage_id: Array.isArray(t.stage_id) ? t.stage_id[0] : t.stage_id,
        stage_name: Array.isArray(t.stage_id) ? t.stage_id[1] : undefined,
        priority: t.priority || '1',
        create_date: t.create_date,
        write_date: t.write_date,
        kanban_state: t.kanban_state || 'normal',
        message_ids: t.message_ids || [],
      };

    } catch (error) {
      console.error('Error fetching ticket by ID:', error);
      return null;
    }
  }

  /**
   * HELPER: Ottieni commenti di un ticket
   */
  private async getTicketComments(ticketId: number): Promise<TicketComment[]> {
    try {
      const isHelpdeskAvailable = await this.checkHelpdeskAvailable();

      // Costruisci domain in base alla disponibilità del modulo helpdesk
      const domain = isHelpdeskAvailable
        ? [['model', '=', 'helpdesk.ticket'], ['res_id', '=', ticketId]]
        : [['model', '=', 'mail.message'], ['res_id', '=', ticketId]];

      // Ottieni i messaggi associati
      const messages = await this.odooRPC.searchRead(
        'mail.message',
        domain,
        ['body', 'author_id', 'date', 'message_type'],
        0,
        'date desc'
      );

      return messages.map((m: any) => ({
        id: m.id,
        body: m.body,
        author_id: Array.isArray(m.author_id) ? m.author_id[0] : m.author_id,
        author_name: Array.isArray(m.author_id) ? m.author_id[1] : undefined,
        date: m.date,
        message_type: m.message_type || 'comment',
      }));

    } catch (error) {
      console.error('Error fetching ticket comments:', error);
      return [];
    }
  }

  /**
   * HELPER: Allega file a un ticket
   */
  private async attachFiles(
    ticketId: number,
    attachments: Array<{ name: string; content: string; mimetype: string }>,
    resModel: string = 'helpdesk.ticket'
  ): Promise<void> {
    try {
      for (const attachment of attachments) {
        await this.odooRPC.callKw(
          'ir.attachment',
          'create',
          [{
            name: attachment.name,
            datas: attachment.content, // base64
            res_model: resModel,
            res_id: ticketId,
            mimetype: attachment.mimetype,
          }]
        );
      }

      console.log(`Attached ${attachments.length} files to ${resModel} ${ticketId}`);

    } catch (error) {
      console.error('Error attaching files:', error);
      // Non bloccare la creazione del ticket per errori negli allegati
    }
  }

  /**
   * HELPER: Invia email di notifica creazione ticket
   */
  private async sendTicketCreatedEmail(params: {
    ticketId: number;
    subject: string;
    description: string;
    customerId: number;
    priority: string;
  }): Promise<void> {
    try {
      const priorityText = this.t(`priorities.${params.priority}`);
      const urgencyColor = params.priority === '3' ? '#dc2626' :
                          params.priority === '2' ? '#f59e0b' :
                          params.priority === '1' ? '#3b82f6' : '#6b7280';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nuovo Ticket Helpdesk</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: ${urgencyColor}; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
                📬 Nuovo Ticket Helpdesk
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                È stato creato un nuovo ticket di supporto:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 15px; font-size: 18px; color: #111827;">
                      ${params.subject}
                    </h2>
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      ${params.description}
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Ticket ID:</td>
                  <td align="right" style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">
                    #${params.ticketId}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Cliente ID:</td>
                  <td align="right" style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">
                    ${params.customerId}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Priorità:</td>
                  <td align="right" style="padding: 6px 0;">
                    <span style="background-color: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                      ${priorityText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 40px;" align="center">
              <a href="${process.env.ODOO_URL || 'http://localhost:8069'}/web#id=${params.ticketId}&model=helpdesk.ticket&view_type=form"
                 style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Vedi Ticket su Odoo
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                Notifica automatica Helpdesk Agent - LAPA Food
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

      const resend = getResend();
      if (!resend) {
        console.log('⚠️ Email creazione ticket non inviata - Resend non configurato');
        return;
      }

      await resend.emails.send({
        from: 'Helpdesk LAPA <helpdesk@lapa.ch>',
        to: HELPDESK_TEAM_EMAIL,
        subject: `Nuovo Ticket #${params.ticketId}: ${params.subject}`,
        html,
      });

      console.log('Ticket creation email sent to:', HELPDESK_TEAM_EMAIL);

    } catch (error) {
      console.error('Error sending ticket creation email:', error);
      // Non bloccare l'operazione principale per errori email
    }
  }
}

/**
 * Factory function per creare un'istanza di HelpdeskAgent
 */
export function createHelpdeskAgent(
  sessionId?: string,
  language: Language = 'it'
): HelpdeskAgent {
  return new HelpdeskAgent(sessionId, language);
}

/**
 * METODI PUBBLICI DISPONIBILI:
 *
 * 1. createTicket(customerId, subject, description, priority?, attachments?)
 *    - Crea un nuovo ticket helpdesk
 *    - Fallback automatico a mail.message se helpdesk non disponibile
 *
 * 2. getCustomerTickets(customerId)
 *    - Ottiene tutti i ticket di un cliente
 *
 * 3. getTicketDetails(ticketId)
 *    - Ottiene dettagli completi di un ticket con commenti
 *
 * 4. addComment(ticketId, message, internal?)
 *    - Aggiunge un commento a un ticket
 *
 * ESEMPIO DI UTILIZZO:
 *
 * ```typescript
 * import { createHelpdeskAgent } from '@/lib/lapa-agents/agents/helpdesk-agent';
 *
 * const helpdeskAgent = createHelpdeskAgent(sessionId, 'it');
 *
 * // Crea ticket
 * const result = await helpdeskAgent.createTicket({
 *   customerId: 123,
 *   subject: 'Problema con ordine',
 *   description: 'Il mio ordine non è arrivato',
 *   priority: '2'
 * });
 *
 * // Lista ticket cliente
 * const tickets = await helpdeskAgent.getCustomerTickets(123);
 *
 * // Dettagli ticket
 * const details = await helpdeskAgent.getTicketDetails(456);
 *
 * // Aggiungi commento
 * await helpdeskAgent.addComment(456, 'Ho risolto il problema');
 * ```
 */
