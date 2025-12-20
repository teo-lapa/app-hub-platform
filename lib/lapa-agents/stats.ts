/**
 * LAPA AI Agents - Statistics Store
 *
 * Modulo per tracciare le statistiche delle richieste agli agenti
 * In memoria - si resetta al riavvio del server
 * Per produzione: usare Redis o database
 */

interface RequestRecord {
  agentId: string;
  timestamp: Date;
  duration: number;
  success: boolean;
}

// Store singleton per le statistiche
class AgentStatsStore {
  private requests: RequestRecord[] = [];
  private conversations: Set<string> = new Set();
  private escalations: number = 0;

  /**
   * Registra una richiesta processata
   */
  recordRequest(agentId: string, duration: number, success: boolean, sessionId: string) {
    this.requests.push({
      agentId,
      timestamp: new Date(),
      duration,
      success
    });
    this.conversations.add(sessionId);

    // Mantieni solo gli ultimi 10000 record per non esaurire memoria
    if (this.requests.length > 10000) {
      this.requests = this.requests.slice(-10000);
    }
  }

  /**
   * Registra un'escalation a operatore umano
   */
  recordEscalation() {
    this.escalations++;
  }

  /**
   * Ottieni tutte le richieste
   */
  getRequests(): RequestRecord[] {
    return this.requests;
  }

  /**
   * Ottieni richieste di oggi
   */
  getTodayRequests(): RequestRecord[] {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return this.requests.filter(r => r.timestamp >= todayStart);
  }

  /**
   * Ottieni richieste per un agente specifico
   */
  getAgentRequests(agentId: string): RequestRecord[] {
    return this.requests.filter(r => r.agentId === agentId);
  }

  /**
   * Ottieni statistiche per un agente
   */
  getAgentStats(agentId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const agentRequests = this.getAgentRequests(agentId);
    const todayRequests = agentRequests.filter(r => r.timestamp >= todayStart);
    const successfulRequests = agentRequests.filter(r => r.success);

    const avgDuration = agentRequests.length > 0
      ? agentRequests.reduce((sum, r) => sum + r.duration, 0) / agentRequests.length / 1000
      : 0;

    const lastRequest = agentRequests.length > 0
      ? agentRequests[agentRequests.length - 1].timestamp.toISOString()
      : new Date().toISOString();

    return {
      requestsToday: todayRequests.length,
      requestsTotal: agentRequests.length,
      avgResponseTime: parseFloat(avgDuration.toFixed(1)),
      successRate: agentRequests.length > 0
        ? parseFloat(((successfulRequests.length / agentRequests.length) * 100).toFixed(1))
        : 100,
      lastActive: lastRequest
    };
  }

  /**
   * Ottieni statistiche globali
   */
  getGlobalStats() {
    const todayRequests = this.getTodayRequests();
    const successfulToday = todayRequests.filter(r => r.success);

    return {
      totalRequests: todayRequests.length,
      activeConversations: this.conversations.size,
      resolvedToday: successfulToday.length,
      escalatedToday: this.escalations,
      avgResponseTime: todayRequests.length > 0
        ? parseFloat((todayRequests.reduce((sum, r) => sum + r.duration, 0) / todayRequests.length / 1000).toFixed(1))
        : 0,
      customerSatisfaction: 4.7 // TODO: collegare a sistema feedback reale
    };
  }

  /**
   * Numero conversazioni attive
   */
  getConversationCount(): number {
    return this.conversations.size;
  }

  /**
   * Reset statistiche (per testing)
   */
  reset() {
    this.requests = [];
    this.conversations.clear();
    this.escalations = 0;
  }
}

// Singleton export
export const agentStats = new AgentStatsStore();

// Helper functions per retrocompatibilità
export function recordRequest(agentId: string, duration: number, success: boolean, sessionId: string) {
  agentStats.recordRequest(agentId, duration, success, sessionId);
}

export function recordEscalation() {
  agentStats.recordEscalation();
}
