/**
 * SHIPPING AGENT
 * Agent specializzato nella gestione delle spedizioni e consegne
 *
 * Funzionalità:
 * - Tracciamento spedizioni in corso
 * - Calcolo ETA (tempo stimato arrivo)
 * - Informazioni autista/corriere
 * - Storico consegne cliente
 * - Gestione problemi di consegna
 */

import { getOdooXMLRPCClient } from '@/lib/odoo-xmlrpc';

// ============================================================================
// TYPES
// ============================================================================

export interface ShipmentStatus {
  id: number;
  name: string;
  state: 'draft' | 'waiting' | 'confirmed' | 'assigned' | 'done' | 'cancel';
  state_label: string;
  customer_id: number;
  customer_name: string;
  scheduled_date: string | null;
  date_done: string | null;
  driver_id: number | null;
  driver_name: string | null;
  vehicle_id: number | null;
  vehicle_name: string | null;
  origin: string | null;
  note: string | null;
  backorder_id: number | null;
  location_dest: string | null;
  products_count: number;
  products: ShipmentProduct[];
}

export interface ShipmentProduct {
  product_id: number;
  product_name: string;
  quantity_ordered: number;
  quantity_delivered: number;
  unit: string;
}

export interface DeliveryETA {
  picking_id: number;
  picking_name: string;
  scheduled_date: string | null;
  estimated_arrival: string | null;
  minutes_remaining: number | null;
  is_late: boolean;
  status: string;
  customer_name: string;
  address: string;
}

export interface DriverInfo {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  current_deliveries: number;
  completed_today: number;
  vehicle_id: number | null;
  vehicle_name: string | null;
}

export interface DeliveryHistory {
  customer_id: number;
  customer_name: string;
  total_deliveries: number;
  last_delivery_date: string | null;
  avg_delivery_time: number | null;
  on_time_percentage: number;
  deliveries: DeliveryHistoryItem[];
}

export interface DeliveryHistoryItem {
  id: number;
  name: string;
  date: string;
  state: string;
  driver_name: string | null;
  products_count: number;
  was_on_time: boolean;
}

export interface DeliveryIssue {
  id: number;
  picking_id: number;
  picking_name: string;
  issue_type: 'delay' | 'missing_product' | 'damaged' | 'wrong_address' | 'customer_absent' | 'other';
  issue_type_label: string;
  description: string;
  reported_by: string;
  reported_at: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution: string | null;
}

export interface ShippingAgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// ============================================================================
// SHIPPING AGENT CLASS
// ============================================================================

export class ShippingAgent {
  private static instance: ShippingAgent;

  private constructor() {}

  static getInstance(): ShippingAgent {
    if (!ShippingAgent.instance) {
      ShippingAgent.instance = new ShippingAgent();
    }
    return ShippingAgent.instance;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Traccia una spedizione specifica tramite order ID
   */
  async trackShipment(orderId: number | string): Promise<ShippingAgentResponse> {
    try {
      const client = await getOdooXMLRPCClient();

      // Cerca il picking associato all'ordine di vendita
      let pickings;

      if (typeof orderId === 'number') {
        // Se è un numero, cerca direttamente il picking ID
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            [['id', '=', orderId]]
          ],
          {
            fields: [
              'id', 'name', 'state', 'scheduled_date', 'date_done',
              'partner_id', 'origin', 'note', 'backorder_id',
              'location_dest_id', 'driver_id', 'move_ids'
            ],
            limit: 1
          }
        );
      } else {
        // Se è una stringa, cerca per nome ordine o picking name
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            ['|', ['origin', '=', orderId], ['name', '=', orderId]]
          ],
          {
            fields: [
              'id', 'name', 'state', 'scheduled_date', 'date_done',
              'partner_id', 'origin', 'note', 'backorder_id',
              'location_dest_id', 'driver_id', 'move_ids'
            ],
            limit: 1
          }
        );
      }

      if (!pickings || pickings.length === 0) {
        return {
          success: false,
          error: this.t('shipment_not_found', { orderId })
        };
      }

      const picking = pickings[0];

      // Carica le move lines per i prodotti
      const moves = await this.getPickingProducts(client, picking.move_ids);

      // Ottieni info autista/veicolo se disponibile
      let driverInfo = null;
      if (picking.driver_id) {
        driverInfo = await this.getDriverDetails(client, picking.driver_id[0]);
      }

      const shipmentStatus: ShipmentStatus = {
        id: picking.id,
        name: picking.name,
        state: picking.state,
        state_label: this.getStateLabel(picking.state),
        customer_id: picking.partner_id[0],
        customer_name: picking.partner_id[1],
        scheduled_date: picking.scheduled_date,
        date_done: picking.date_done,
        driver_id: driverInfo?.id || null,
        driver_name: driverInfo?.name || null,
        vehicle_id: driverInfo?.vehicle_id || null,
        vehicle_name: driverInfo?.vehicle_name || null,
        origin: picking.origin,
        note: picking.note,
        backorder_id: picking.backorder_id ? picking.backorder_id[0] : null,
        location_dest: picking.location_dest_id ? picking.location_dest_id[1] : null,
        products_count: moves.length,
        products: moves
      };

      return {
        success: true,
        data: shipmentStatus,
        message: this.t('shipment_tracked_successfully')
      };

    } catch (error) {
      console.error('[ShippingAgent] Errore trackShipment:', error);
      return {
        success: false,
        error: this.t('error_tracking_shipment', { error: (error as Error).message })
      };
    }
  }

  /**
   * Ottiene l'ETA (tempo stimato arrivo) per un ordine
   */
  async getDeliveryETA(orderId: number | string): Promise<ShippingAgentResponse> {
    try {
      const client = await getOdooXMLRPCClient();

      // Cerca il picking
      let pickings;
      if (typeof orderId === 'number') {
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            [['id', '=', orderId]]
          ],
          {
            fields: ['id', 'name', 'state', 'scheduled_date', 'partner_id', 'driver_id'],
            limit: 1
          }
        );
      } else {
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            ['|', ['origin', '=', orderId], ['name', '=', orderId]]
          ],
          {
            fields: ['id', 'name', 'state', 'scheduled_date', 'partner_id', 'driver_id'],
            limit: 1
          }
        );
      }

      if (!pickings || pickings.length === 0) {
        return {
          success: false,
          error: this.t('shipment_not_found', { orderId })
        };
      }

      const picking = pickings[0];

      // Ottieni indirizzo cliente
      const address = await this.getCustomerAddress(client, picking.partner_id[0]);

      // Calcola ETA
      const eta = this.calculateETA(picking.scheduled_date, picking.state);

      const deliveryETA: DeliveryETA = {
        picking_id: picking.id,
        picking_name: picking.name,
        scheduled_date: picking.scheduled_date,
        estimated_arrival: eta.estimatedArrival,
        minutes_remaining: eta.minutesRemaining,
        is_late: eta.isLate,
        status: this.getStateLabel(picking.state),
        customer_name: picking.partner_id[1],
        address: address
      };

      return {
        success: true,
        data: deliveryETA,
        message: this.t('eta_calculated_successfully')
      };

    } catch (error) {
      console.error('[ShippingAgent] Errore getDeliveryETA:', error);
      return {
        success: false,
        error: this.t('error_calculating_eta', { error: (error as Error).message })
      };
    }
  }

  /**
   * Ottiene informazioni sull'autista/corriere assegnato
   */
  async getDeliveryDriver(orderId: number | string): Promise<ShippingAgentResponse> {
    try {
      const client = await getOdooXMLRPCClient();

      // Cerca il picking
      let pickings;
      if (typeof orderId === 'number') {
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            [['id', '=', orderId]]
          ],
          {
            fields: ['driver_id'],
            limit: 1
          }
        );
      } else {
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            ['|', ['origin', '=', orderId], ['name', '=', orderId]]
          ],
          {
            fields: ['driver_id'],
            limit: 1
          }
        );
      }

      if (!pickings || pickings.length === 0) {
        return {
          success: false,
          error: this.t('shipment_not_found', { orderId })
        };
      }

      const picking = pickings[0];

      if (!picking.driver_id) {
        return {
          success: false,
          error: this.t('no_driver_assigned')
        };
      }

      const driverInfo = await this.getDriverDetails(client, picking.driver_id[0]);

      // Conta consegne oggi
      const today = new Date().toISOString().split('T')[0];
      const todayPickings = await client.execute_kw(
        'stock.picking',
        'search_count',
        [
          [
            ['driver_id', '=', picking.driver_id[0]],
            ['scheduled_date', '>=', `${today} 00:00:00`],
            ['scheduled_date', '<=', `${today} 23:59:59`]
          ]
        ]
      );

      const completedToday = await client.execute_kw(
        'stock.picking',
        'search_count',
        [
          [
            ['driver_id', '=', picking.driver_id[0]],
            ['state', '=', 'done'],
            ['date_done', '>=', `${today} 00:00:00`],
            ['date_done', '<=', `${today} 23:59:59`]
          ]
        ]
      );

      const driver: DriverInfo = {
        ...driverInfo,
        current_deliveries: todayPickings,
        completed_today: completedToday
      };

      return {
        success: true,
        data: driver,
        message: this.t('driver_info_retrieved')
      };

    } catch (error) {
      console.error('[ShippingAgent] Errore getDeliveryDriver:', error);
      return {
        success: false,
        error: this.t('error_getting_driver', { error: (error as Error).message })
      };
    }
  }

  /**
   * Ottiene lo storico consegne di un cliente
   */
  async getDeliveryHistory(customerId: number, limit: number = 20): Promise<ShippingAgentResponse> {
    try {
      const client = await getOdooXMLRPCClient();

      // Ottieni info cliente
      const customers = await client.execute_kw(
        'res.partner',
        'read',
        [[customerId]],
        {
          fields: ['name']
        }
      );

      if (!customers || customers.length === 0) {
        return {
          success: false,
          error: this.t('customer_not_found', { customerId })
        };
      }

      const customer = customers[0];

      // Cerca tutte le consegne del cliente
      const pickings = await client.execute_kw(
        'stock.picking',
        'search_read',
        [
          [
            ['partner_id', '=', customerId],
            ['picking_type_code', '=', 'outgoing'],
            ['state', '!=', 'cancel']
          ]
        ],
        {
          fields: ['id', 'name', 'state', 'scheduled_date', 'date_done', 'driver_id', 'move_ids'],
          order: 'date_done DESC, scheduled_date DESC',
          limit: limit
        }
      );

      const deliveries: DeliveryHistoryItem[] = [];
      let totalOnTime = 0;

      for (const picking of pickings) {
        const wasOnTime = this.wasDeliveryOnTime(picking.scheduled_date, picking.date_done);
        if (wasOnTime) totalOnTime++;

        // Conta prodotti
        const productsCount = picking.move_ids ? picking.move_ids.length : 0;

        deliveries.push({
          id: picking.id,
          name: picking.name,
          date: picking.date_done || picking.scheduled_date || '',
          state: this.getStateLabel(picking.state),
          driver_name: picking.driver_id ? picking.driver_id[1] : null,
          products_count: productsCount,
          was_on_time: wasOnTime
        });
      }

      // Calcola statistiche
      const onTimePercentage = pickings.length > 0
        ? Math.round((totalOnTime / pickings.length) * 100)
        : 0;

      // Calcola tempo medio di consegna (dalla data schedulata alla data effettiva)
      let avgDeliveryTime = null;
      const completedDeliveries = pickings.filter((p: any) => p.date_done && p.scheduled_date);
      if (completedDeliveries.length > 0) {
        const totalMinutes = completedDeliveries.reduce((sum: number, p: any) => {
          const scheduled = new Date(p.scheduled_date).getTime();
          const done = new Date(p.date_done).getTime();
          return sum + (done - scheduled) / (1000 * 60); // minuti
        }, 0);
        avgDeliveryTime = Math.round(totalMinutes / completedDeliveries.length);
      }

      const history: DeliveryHistory = {
        customer_id: customerId,
        customer_name: customer.name,
        total_deliveries: pickings.length,
        last_delivery_date: pickings.length > 0
          ? (pickings[0].date_done || pickings[0].scheduled_date)
          : null,
        avg_delivery_time: avgDeliveryTime,
        on_time_percentage: onTimePercentage,
        deliveries: deliveries
      };

      return {
        success: true,
        data: history,
        message: this.t('history_retrieved_successfully')
      };

    } catch (error) {
      console.error('[ShippingAgent] Errore getDeliveryHistory:', error);
      return {
        success: false,
        error: this.t('error_getting_history', { error: (error as Error).message })
      };
    }
  }

  /**
   * Segnala un problema di consegna
   */
  async reportDeliveryIssue(
    orderId: number | string,
    issueType: 'delay' | 'missing_product' | 'damaged' | 'wrong_address' | 'customer_absent' | 'other',
    description: string,
    reportedBy: string = 'Sistema'
  ): Promise<ShippingAgentResponse> {
    try {
      const client = await getOdooXMLRPCClient();

      // Cerca il picking
      let pickings;
      if (typeof orderId === 'number') {
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            [['id', '=', orderId]]
          ],
          {
            fields: ['id', 'name', 'note'],
            limit: 1
          }
        );
      } else {
        pickings = await client.execute_kw(
          'stock.picking',
          'search_read',
          [
            ['|', ['origin', '=', orderId], ['name', '=', orderId]]
          ],
          {
            fields: ['id', 'name', 'note'],
            limit: 1
          }
        );
      }

      if (!pickings || pickings.length === 0) {
        return {
          success: false,
          error: this.t('shipment_not_found', { orderId })
        };
      }

      const picking = pickings[0];

      // Crea messaggio problema
      const issueMessage = this.formatIssueMessage(issueType, description, reportedBy);

      // Aggiorna le note del picking con il problema
      const currentNote = picking.note || '';
      const updatedNote = currentNote
        ? `${currentNote}\n\n${issueMessage}`
        : issueMessage;

      await client.execute_kw(
        'stock.picking',
        'write',
        [[picking.id], { note: updatedNote }]
      );

      // Crea attività di follow-up (se possibile)
      try {
        await this.createFollowUpActivity(client, picking.id, issueType, description);
      } catch (activityError) {
        console.warn('[ShippingAgent] Non è stato possibile creare attività:', activityError);
      }

      const issue: DeliveryIssue = {
        id: Date.now(), // ID temporaneo
        picking_id: picking.id,
        picking_name: picking.name,
        issue_type: issueType,
        issue_type_label: this.getIssueTypeLabel(issueType),
        description: description,
        reported_by: reportedBy,
        reported_at: new Date().toISOString(),
        status: 'open',
        resolution: null
      };

      return {
        success: true,
        data: issue,
        message: this.t('issue_reported_successfully')
      };

    } catch (error) {
      console.error('[ShippingAgent] Errore reportDeliveryIssue:', error);
      return {
        success: false,
        error: this.t('error_reporting_issue', { error: (error as Error).message })
      };
    }
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Ottiene i prodotti di un picking
   */
  private async getPickingProducts(client: any, moveIds: number[]): Promise<ShipmentProduct[]> {
    if (!moveIds || moveIds.length === 0) return [];

    const moves = await client.execute_kw(
      'stock.move',
      'read',
      [moveIds],
      {
        fields: ['product_id', 'product_uom_qty', 'quantity_done', 'product_uom']
      }
    );

    return moves.map((move: any) => ({
      product_id: move.product_id[0],
      product_name: move.product_id[1],
      quantity_ordered: move.product_uom_qty,
      quantity_delivered: move.quantity_done,
      unit: move.product_uom ? move.product_uom[1] : 'Unità'
    }));
  }

  /**
   * Ottiene dettagli autista
   */
  private async getDriverDetails(client: any, driverId: number): Promise<DriverInfo> {
    const employees = await client.execute_kw(
      'hr.employee',
      'read',
      [[driverId]],
      {
        fields: ['id', 'name', 'work_phone', 'work_email', 'vehicle']
      }
    );

    if (!employees || employees.length === 0) {
      throw new Error('Driver not found');
    }

    const employee = employees[0];

    return {
      id: employee.id,
      name: employee.name,
      phone: employee.work_phone,
      email: employee.work_email,
      vehicle_id: employee.vehicle ? employee.vehicle[0] : null,
      vehicle_name: employee.vehicle ? employee.vehicle[1] : null,
      current_deliveries: 0,
      completed_today: 0
    };
  }

  /**
   * Ottiene indirizzo cliente formattato
   */
  private async getCustomerAddress(client: any, partnerId: number): Promise<string> {
    const partners = await client.execute_kw(
      'res.partner',
      'read',
      [[partnerId]],
      {
        fields: ['street', 'street2', 'city', 'zip', 'country_id']
      }
    );

    if (!partners || partners.length === 0) return '';

    const partner = partners[0];
    const parts = [];

    if (partner.street) parts.push(partner.street);
    if (partner.street2) parts.push(partner.street2);
    if (partner.zip && partner.city) parts.push(`${partner.zip} ${partner.city}`);
    else if (partner.city) parts.push(partner.city);
    if (partner.country_id) parts.push(partner.country_id[1]);

    return parts.join(', ');
  }

  /**
   * Calcola ETA basato su scheduled_date e stato
   */
  private calculateETA(scheduledDate: string | null, state: string): {
    estimatedArrival: string | null;
    minutesRemaining: number | null;
    isLate: boolean;
  } {
    if (!scheduledDate) {
      return {
        estimatedArrival: null,
        minutesRemaining: null,
        isLate: false
      };
    }

    const scheduled = new Date(scheduledDate);
    const now = new Date();

    // Se già consegnato, ETA è la data di consegna
    if (state === 'done') {
      return {
        estimatedArrival: scheduledDate,
        minutesRemaining: 0,
        isLate: false
      };
    }

    // Calcola minuti rimanenti
    const minutesRemaining = Math.round((scheduled.getTime() - now.getTime()) / (1000 * 60));

    // Determina se è in ritardo
    const isLate = minutesRemaining < 0;

    return {
      estimatedArrival: scheduledDate,
      minutesRemaining: minutesRemaining,
      isLate: isLate
    };
  }

  /**
   * Verifica se una consegna è stata effettuata in orario
   */
  private wasDeliveryOnTime(scheduledDate: string | null, doneDate: string | null): boolean {
    if (!scheduledDate || !doneDate) return false;

    const scheduled = new Date(scheduledDate);
    const done = new Date(doneDate);

    // Considera "in orario" se consegnato entro 30 minuti dalla data schedulata
    const diffMinutes = (done.getTime() - scheduled.getTime()) / (1000 * 60);

    return diffMinutes <= 30;
  }

  /**
   * Formatta messaggio problema
   */
  private formatIssueMessage(
    issueType: string,
    description: string,
    reportedBy: string
  ): string {
    const timestamp = new Date().toLocaleString('it-IT');
    const typeLabel = this.getIssueTypeLabel(issueType);

    return `--- PROBLEMA SEGNALATO ---
Tipo: ${typeLabel}
Data/Ora: ${timestamp}
Segnalato da: ${reportedBy}
Descrizione: ${description}
---`;
  }

  /**
   * Crea attività di follow-up
   */
  private async createFollowUpActivity(
    client: any,
    pickingId: number,
    issueType: string,
    description: string
  ): Promise<void> {
    const activityTypeIds = await client.execute_kw(
      'mail.activity.type',
      'search',
      [[['name', '=', 'To Do']]],
      { limit: 1 }
    );

    if (!activityTypeIds || activityTypeIds.length === 0) {
      throw new Error('Activity type not found');
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await client.execute_kw(
      'mail.activity',
      'create',
      [{
        activity_type_id: activityTypeIds[0],
        res_model: 'stock.picking',
        res_id: pickingId,
        summary: `Problema consegna: ${this.getIssueTypeLabel(issueType)}`,
        note: description,
        date_deadline: tomorrow.toISOString().split('T')[0]
      }]
    );
  }

  /**
   * Ottiene label stato tradotta
   */
  private getStateLabel(state: string): string {
    const labels: Record<string, string> = {
      'draft': 'Bozza',
      'waiting': 'In Attesa',
      'confirmed': 'Confermato',
      'assigned': 'Pronto',
      'done': 'Consegnato',
      'cancel': 'Annullato'
    };

    return labels[state] || state;
  }

  /**
   * Ottiene label tipo problema tradotta
   */
  private getIssueTypeLabel(issueType: string): string {
    const labels: Record<string, string> = {
      'delay': 'Ritardo',
      'missing_product': 'Prodotto Mancante',
      'damaged': 'Danneggiato',
      'wrong_address': 'Indirizzo Errato',
      'customer_absent': 'Cliente Assente',
      'other': 'Altro'
    };

    return labels[issueType] || issueType;
  }

  /**
   * Traduzioni multilingua (semplificato)
   */
  private t(key: string, params?: Record<string, any>): string {
    const translations: Record<string, string> = {
      'shipment_not_found': `Spedizione non trovata: ${params?.orderId || ''}`,
      'shipment_tracked_successfully': 'Spedizione tracciata con successo',
      'error_tracking_shipment': `Errore nel tracciamento: ${params?.error || ''}`,
      'eta_calculated_successfully': 'ETA calcolato con successo',
      'error_calculating_eta': `Errore nel calcolo ETA: ${params?.error || ''}`,
      'no_driver_assigned': 'Nessun autista assegnato a questa consegna',
      'driver_info_retrieved': 'Informazioni autista recuperate',
      'error_getting_driver': `Errore nel recupero info autista: ${params?.error || ''}`,
      'customer_not_found': `Cliente non trovato: ${params?.customerId || ''}`,
      'history_retrieved_successfully': 'Storico recuperato con successo',
      'error_getting_history': `Errore nel recupero storico: ${params?.error || ''}`,
      'issue_reported_successfully': 'Problema segnalato con successo',
      'error_reporting_issue': `Errore nella segnalazione: ${params?.error || ''}`
    };

    return translations[key] || key;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const shippingAgent = ShippingAgent.getInstance();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Traccia spedizione
 */
export async function trackShipment(orderId: number | string) {
  return shippingAgent.trackShipment(orderId);
}

/**
 * Ottieni ETA consegna
 */
export async function getDeliveryETA(orderId: number | string) {
  return shippingAgent.getDeliveryETA(orderId);
}

/**
 * Ottieni info autista
 */
export async function getDeliveryDriver(orderId: number | string) {
  return shippingAgent.getDeliveryDriver(orderId);
}

/**
 * Ottieni storico consegne cliente
 */
export async function getDeliveryHistory(customerId: number, limit?: number) {
  return shippingAgent.getDeliveryHistory(customerId, limit);
}

/**
 * Segnala problema consegna
 */
export async function reportDeliveryIssue(
  orderId: number | string,
  issueType: 'delay' | 'missing_product' | 'damaged' | 'wrong_address' | 'customer_absent' | 'other',
  description: string,
  reportedBy?: string
) {
  return shippingAgent.reportDeliveryIssue(orderId, issueType, description, reportedBy);
}
