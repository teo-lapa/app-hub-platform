/**
 * LAPA AI - Avatar Service
 *
 * Servizio per gestire gli avatar dei clienti.
 * Wrapper semplificato sopra ConversationMemoryService.
 *
 * Uso:
 *   const avatarService = getAvatarService();
 *   await avatarService.updateAvatar(customerId, { preferredTone: 'friendly' });
 *   await avatarService.addNote(customerId, "La figlia si sposa ad aprile");
 *   await avatarService.addFollowup(customerId, "Chiedere come è andato il matrimonio");
 */

import {
  getMemoryService,
  CustomerAvatar,
  CustomerMemory,
  ConversationMemoryService
} from './memory/conversation-memory';

export interface AvatarUpdate {
  preferredTone?: 'formal' | 'informal' | 'friendly';
  preferredLanguage?: 'it' | 'de' | 'fr' | 'en';
  usesEmoji?: boolean;
  communicationNotes?: string;
  birthday?: string;
  importantDates?: Array<{ date: string; occasion: string }>;
  orderPatterns?: {
    preferredDay?: string;
    preferredTime?: string;
    usualProducts?: string[];
    deliveryNotes?: string;
  };
}

export class AvatarService {
  private memoryService: ConversationMemoryService;

  constructor() {
    this.memoryService = getMemoryService();
  }

  /**
   * Ottiene l'avatar di un cliente
   */
  async getAvatar(customerId: number): Promise<CustomerAvatar | null> {
    return this.memoryService.getAvatar(customerId);
  }

  /**
   * Aggiorna l'avatar di un cliente
   */
  async updateAvatar(customerId: number, data: AvatarUpdate): Promise<CustomerMemory | null> {
    return this.memoryService.updateAvatar(customerId, data);
  }

  /**
   * Aggiunge una nota personale
   * Es: "La figlia si sposa ad aprile"
   */
  async addNote(customerId: number, note: string): Promise<boolean> {
    return this.memoryService.addPersonalNote(customerId, note);
  }

  /**
   * Aggiunge un follow-up da fare
   * Es: "Chiedere come è andato il matrimonio"
   */
  async addFollowup(customerId: number, action: string): Promise<boolean> {
    return this.memoryService.addFollowup(customerId, action);
  }

  /**
   * Segna un follow-up come completato
   */
  async completeFollowup(customerId: number, actionSubstring: string): Promise<boolean> {
    return this.memoryService.markFollowupDone(customerId, actionSubstring);
  }

  /**
   * Imposta il compleanno del cliente
   * @param birthday formato MM-DD (es: "03-15" per 15 marzo)
   */
  async setBirthday(customerId: number, birthday: string): Promise<boolean> {
    const result = await this.memoryService.updateAvatar(customerId, { birthday });
    return result !== null;
  }

  /**
   * Aggiunge una data importante
   * @param date formato MM-DD
   * @param occasion descrizione dell'occasione
   */
  async addImportantDate(customerId: number, date: string, occasion: string): Promise<boolean> {
    const avatar = await this.getAvatar(customerId);
    const importantDates = avatar?.importantDates || [];
    importantDates.push({ date, occasion });

    const result = await this.memoryService.updateAvatar(customerId, { importantDates });
    return result !== null;
  }

  /**
   * Imposta lo stile di comunicazione
   */
  async setCommunicationStyle(
    customerId: number,
    style: {
      tone?: 'formal' | 'informal' | 'friendly';
      usesEmoji?: boolean;
      notes?: string;
    }
  ): Promise<boolean> {
    const result = await this.memoryService.updateAvatar(customerId, {
      preferredTone: style.tone,
      usesEmoji: style.usesEmoji,
      communicationNotes: style.notes
    });
    return result !== null;
  }

  /**
   * Imposta i pattern di ordine
   */
  async setOrderPatterns(
    customerId: number,
    patterns: {
      preferredDay?: string;
      preferredTime?: string;
      usualProducts?: string[];
      deliveryNotes?: string;
    }
  ): Promise<boolean> {
    const result = await this.memoryService.updateAvatar(customerId, {
      orderPatterns: patterns
    });
    return result !== null;
  }

  /**
   * Ottiene il profilo completo di un cliente (memoria + avatar)
   */
  async getFullProfile(customerId: number): Promise<CustomerMemory | null> {
    return this.memoryService.loadMemory(customerId);
  }

  /**
   * Verifica se oggi è una data speciale per il cliente
   */
  async checkSpecialDates(customerId: number): Promise<{
    isBirthday: boolean;
    todayEvents: string[];
  }> {
    const avatar = await this.getAvatar(customerId);
    if (!avatar) {
      return { isBirthday: false, todayEvents: [] };
    }

    const today = new Date();
    const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const isBirthday = avatar.birthday === todayMMDD;
    const todayEvents = (avatar.importantDates || [])
      .filter(d => d.date === todayMMDD)
      .map(d => d.occasion);

    return { isBirthday, todayEvents };
  }

  /**
   * Ottiene i follow-up pendenti per un cliente
   */
  async getPendingFollowups(customerId: number): Promise<Array<{ date: string; action: string }>> {
    const avatar = await this.getAvatar(customerId);
    if (!avatar?.followups) return [];

    return avatar.followups
      .filter(f => !f.done)
      .map(f => ({ date: f.date, action: f.action }));
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let avatarServiceInstance: AvatarService | null = null;

export function getAvatarService(): AvatarService {
  if (!avatarServiceInstance) {
    avatarServiceInstance = new AvatarService();
  }
  return avatarServiceInstance;
}

// Re-export types for convenience
export type { CustomerAvatar, CustomerMemory };
