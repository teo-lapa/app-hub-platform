import * as db from '@/lib/db/sales-db';
import { MessageContext, SalespersonContext } from './types';

/**
 * Memory Manager Agent
 * Gestisce la persistenza e il recupero della memoria conversazionale
 */

export class MemoryManagerAgent {
  /**
   * Salva un messaggio nella conversazione
   */
  async saveMessage(
    salesperson: SalespersonContext,
    role: 'user' | 'assistant',
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    // Get or create conversation
    const conversation = await db.getOrCreateConversation(
      salesperson.id,
      salesperson.name
    );

    // Save message
    await db.saveMessage(conversation.id, role, content, metadata);
  }

  /**
   * Recupera lo storico della conversazione
   */
  async getConversationHistory(
    salespersonId: number,
    options: {
      limit?: number;
      daysBack?: number;
    } = {}
  ): Promise<MessageContext['conversationHistory']> {
    const { limit = 50, daysBack = 60 } = options;

    // Get conversation
    const conversation = await db.getOrCreateConversation(salespersonId, 'Unknown');

    // Get messages
    const messages = await db.getConversationHistory(
      conversation.id,
      limit,
      daysBack
    );

    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at)
    }));
  }

  /**
   * Salva un'interazione con un cliente
   */
  async saveClientInteraction(
    salespersonId: number,
    clientId: number,
    clientName: string,
    interaction: {
      type: 'call' | 'email' | 'meeting' | 'follow_up' | 'order' | 'visit';
      summary?: string;
      actionTaken?: string;
      outcome?: 'positive' | 'neutral' | 'negative' | 'pending';
      nextAction?: string;
      nextActionDate?: Date;
      amount?: number;
    }
  ): Promise<void> {
    // Get conversation
    const conversation = await db.getOrCreateConversation(salespersonId, 'Unknown');

    // Save interaction
    await db.saveClientInteraction({
      conversation_id: conversation.id,
      salesperson_id: salespersonId,
      odoo_client_id: clientId,
      client_name: clientName,
      interaction_type: interaction.type,
      summary: interaction.summary,
      action_taken: interaction.actionTaken,
      outcome: interaction.outcome,
      next_action: interaction.nextAction,
      next_action_date: interaction.nextActionDate,
      amount: interaction.amount
    });
  }

  /**
   * Recupera le interazioni recenti del venditore
   */
  async getRecentInteractions(
    salespersonId: number,
    daysBack: number = 60
  ): Promise<MessageContext['recentInteractions']> {
    const interactions = await db.getSalespersonInteractions(salespersonId, daysBack);

    return interactions.map(int => ({
      clientId: int.odoo_client_id,
      clientName: int.client_name,
      type: int.interaction_type,
      outcome: int.outcome || 'pending',
      daysAgo: Math.floor(
        (Date.now() - new Date(int.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    }));
  }

  /**
   * Recupera le azioni programmate future
   */
  async getUpcomingActions(
    salespersonId: number
  ): Promise<MessageContext['upcomingActions']> {
    const actions = await db.getUpcomingActions(salespersonId);

    return actions.map(action => ({
      clientName: action.client_name,
      action: action.next_action || 'Follow-up',
      date: new Date(action.next_action_date!)
    }));
  }

  /**
   * Recupera il contesto completo per un messaggio
   */
  async getMessageContext(
    salesperson: SalespersonContext,
    options: {
      historyLimit?: number;
      daysBack?: number;
    } = {}
  ): Promise<MessageContext> {
    const [conversationHistory, recentInteractions, upcomingActions] = await Promise.all([
      this.getConversationHistory(salesperson.id, options),
      this.getRecentInteractions(salesperson.id, options.daysBack),
      this.getUpcomingActions(salesperson.id)
    ]);

    return {
      salesperson,
      conversationHistory,
      recentInteractions,
      upcomingActions
    };
  }

  /**
   * Estrae dati strutturati da un messaggio utente
   * (usa pattern matching semplice - in futuro si può usare Claude per extraction)
   */
  extractInteractionFromMessage(message: string): {
    clientName?: string;
    interactionType?: 'call' | 'email' | 'meeting' | 'order';
    amount?: number;
    outcome?: 'positive' | 'neutral' | 'negative';
  } | null {
    const lowerMessage = message.toLowerCase();
    let extracted: any = {};

    // Extract interaction type
    if (lowerMessage.includes('chiamat') || lowerMessage.includes('telefonat')) {
      extracted.interactionType = 'call';
    } else if (lowerMessage.includes('email') || lowerMessage.includes('mail')) {
      extracted.interactionType = 'email';
    } else if (lowerMessage.includes('incontro') || lowerMessage.includes('meeting') || lowerMessage.includes('visita')) {
      extracted.interactionType = 'meeting';
    } else if (lowerMessage.includes('ordinat') || lowerMessage.includes('comprat') || lowerMessage.includes('ordine')) {
      extracted.interactionType = 'order';
    }

    // Extract amount (cerca pattern €XXX o XXXEUR)
    const amountMatch = message.match(/€\s*([0-9.,]+)|([0-9.,]+)\s*€|([0-9.,]+)\s*EUR/i);
    if (amountMatch) {
      const amountStr = amountMatch[1] || amountMatch[2] || amountMatch[3];
      extracted.amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
    }

    // Extract outcome
    if (lowerMessage.includes('positiv') || lowerMessage.includes('bene') || lowerMessage.includes('success') || lowerMessage.includes('chiuso')) {
      extracted.outcome = 'positive';
    } else if (lowerMessage.includes('negativ') || lowerMessage.includes('male') || lowerMessage.includes('rifiut') || lowerMessage.includes('no')) {
      extracted.outcome = 'negative';
    } else if (extracted.interactionType) {
      extracted.outcome = 'neutral';
    }

    // Extract client name (cerca nomi propri maiuscoli)
    // Pattern semplice: cerca 2-3 parole maiuscole consecutive
    const nameMatch = message.match(/\b([A-Z][a-zàèéìòù]+(?:\s+[A-Z][a-zàèéìòù]+){1,2})\b/);
    if (nameMatch) {
      extracted.clientName = nameMatch[1];
    }

    return Object.keys(extracted).length > 0 ? extracted : null;
  }

  /**
   * Salva il piano giornaliero
   */
  async saveDailyPlan(
    salespersonId: number,
    planDate: Date,
    priorities: any[],
    kpis: Record<string, any>
  ): Promise<void> {
    await db.saveDailyPlan(salespersonId, planDate, priorities, kpis);
  }

  /**
   * Recupera il piano giornaliero
   */
  async getDailyPlan(salespersonId: number, planDate: Date = new Date()) {
    return await db.getDailyPlan(salespersonId, planDate);
  }

  /**
   * Statistiche interazioni
   */
  async getInteractionStats(salespersonId: number, daysBack: number = 30) {
    return await db.getInteractionStats(salespersonId, daysBack);
  }
}

// Export singleton instance
export const memoryManager = new MemoryManagerAgent();
