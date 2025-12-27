/**
 * LAPA AI Agents - Statistics Store
 *
 * Modulo per tracciare le statistiche delle richieste agli agenti
 * Utilizza Vercel KV per persistenza dei dati
 *
 * Struttura dati KV:
 * - lapa_stats:requests:{date} -> RequestRecord[]  (richieste del giorno)
 * - lapa_stats:sessions -> Set<string> (sessioni uniche)
 * - lapa_stats:escalations:{date} -> number (escalation del giorno)
 * - lapa_stats:totals:{agentId} -> AgentTotals (totali per agente)
 */

import { kv } from '@vercel/kv';

interface RequestRecord {
  agentId: string;
  timestamp: string;
  duration: number;
  success: boolean;
  sessionId: string;
}

interface AgentTotals {
  requestsTotal: number;
  successTotal: number;
  durationTotal: number;
  lastActive: string;
}

// Funzioni helper per le chiavi
function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getRequestsKey(date?: string): string {
  return `lapa_stats:requests:${date || getTodayKey()}`;
}

function getEscalationsKey(date?: string): string {
  return `lapa_stats:escalations:${date || getTodayKey()}`;
}

function getSessionsKey(): string {
  return `lapa_stats:sessions`;
}

function getTotalsKey(agentId: string): string {
  return `lapa_stats:totals:${agentId}`;
}

// Store class con KV
class AgentStatsStore {
  // Cache locale per evitare troppe chiamate KV
  private localCache: {
    requests: RequestRecord[];
    sessions: Set<string>;
    escalations: number;
    lastSync: Date | null;
  } = {
    requests: [],
    sessions: new Set(),
    escalations: 0,
    lastSync: null
  };

  /**
   * Registra una richiesta processata
   */
  async recordRequest(agentId: string, duration: number, success: boolean, sessionId: string) {
    const record: RequestRecord = {
      agentId,
      timestamp: new Date().toISOString(),
      duration,
      success,
      sessionId
    };

    try {
      // Aggiungi alla lista delle richieste di oggi
      const key = getRequestsKey();
      const existing = await kv.get<RequestRecord[]>(key) || [];
      existing.push(record);

      // Mantieni solo gli ultimi 1000 record per giorno
      if (existing.length > 1000) {
        existing.splice(0, existing.length - 1000);
      }

      await kv.set(key, existing, { ex: 86400 * 7 }); // Scade dopo 7 giorni

      // Aggiungi sessione
      await kv.sadd(getSessionsKey(), sessionId);

      // Aggiorna totali per agente
      const totalsKey = getTotalsKey(agentId);
      const totals = await kv.get<AgentTotals>(totalsKey) || {
        requestsTotal: 0,
        successTotal: 0,
        durationTotal: 0,
        lastActive: new Date().toISOString()
      };

      totals.requestsTotal++;
      if (success) totals.successTotal++;
      totals.durationTotal += duration;
      totals.lastActive = new Date().toISOString();

      await kv.set(totalsKey, totals);

      // Aggiorna cache locale
      this.localCache.requests.push(record);
      this.localCache.sessions.add(sessionId);

      console.log(`📊 Stats recorded: ${agentId} - ${duration}ms - ${success ? 'success' : 'failed'}`);
    } catch (error) {
      console.error('❌ Error recording stats to KV:', error);
      // Fallback: salva solo in cache locale
      this.localCache.requests.push(record);
      this.localCache.sessions.add(sessionId);
    }
  }

  /**
   * Registra un'escalation a operatore umano
   */
  async recordEscalation() {
    try {
      const key = getEscalationsKey();
      await kv.incr(key);
      this.localCache.escalations++;
      console.log('📊 Escalation recorded');
    } catch (error) {
      console.error('❌ Error recording escalation to KV:', error);
      this.localCache.escalations++;
    }
  }

  /**
   * Ottieni richieste di oggi
   */
  async getTodayRequests(): Promise<RequestRecord[]> {
    try {
      const key = getRequestsKey();
      return await kv.get<RequestRecord[]>(key) || [];
    } catch (error) {
      console.error('❌ Error getting today requests from KV:', error);
      return this.localCache.requests;
    }
  }

  /**
   * Ottieni richieste per un agente specifico (oggi)
   */
  async getAgentRequests(agentId: string): Promise<RequestRecord[]> {
    const requests = await this.getTodayRequests();
    return requests.filter(r => r.agentId === agentId);
  }

  /**
   * Ottieni statistiche per un agente
   */
  getAgentStats(agentId: string) {
    // Versione sincrona che usa cache + valori di default
    // Per la dashboard che chiama questa funzione sincronicamente
    const todayRequests = this.localCache.requests.filter(r => r.agentId === agentId);
    const successfulRequests = todayRequests.filter(r => r.success);

    const avgDuration = todayRequests.length > 0
      ? todayRequests.reduce((sum, r) => sum + r.duration, 0) / todayRequests.length / 1000
      : 0;

    const lastRequest = todayRequests.length > 0
      ? todayRequests[todayRequests.length - 1].timestamp
      : new Date().toISOString();

    return {
      requestsToday: todayRequests.length,
      requestsTotal: todayRequests.length, // Sarà aggiornato async
      avgResponseTime: parseFloat(avgDuration.toFixed(1)),
      successRate: todayRequests.length > 0
        ? parseFloat(((successfulRequests.length / todayRequests.length) * 100).toFixed(1))
        : 100,
      lastActive: lastRequest
    };
  }

  /**
   * Ottieni statistiche per un agente (async, con dati completi da KV)
   */
  async getAgentStatsAsync(agentId: string) {
    try {
      // Ottieni totali persistiti
      const totalsKey = getTotalsKey(agentId);
      const totals = await kv.get<AgentTotals>(totalsKey);

      // Ottieni richieste di oggi
      const todayRequests = await this.getAgentRequests(agentId);
      const successfulToday = todayRequests.filter(r => r.success);

      const avgDurationToday = todayRequests.length > 0
        ? todayRequests.reduce((sum, r) => sum + r.duration, 0) / todayRequests.length / 1000
        : 0;

      return {
        requestsToday: todayRequests.length,
        requestsTotal: totals?.requestsTotal || todayRequests.length,
        avgResponseTime: parseFloat(avgDurationToday.toFixed(1)),
        successRate: totals && totals.requestsTotal > 0
          ? parseFloat(((totals.successTotal / totals.requestsTotal) * 100).toFixed(1))
          : 100,
        lastActive: totals?.lastActive || new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting agent stats from KV:', error);
      return this.getAgentStats(agentId);
    }
  }

  /**
   * Ottieni statistiche globali
   */
  getGlobalStats() {
    // Versione sincrona con cache locale
    const todayRequests = this.localCache.requests;
    const successfulToday = todayRequests.filter(r => r.success);

    return {
      totalRequests: todayRequests.length,
      activeConversations: this.localCache.sessions.size,
      resolvedToday: successfulToday.length,
      escalatedToday: this.localCache.escalations,
      avgResponseTime: todayRequests.length > 0
        ? parseFloat((todayRequests.reduce((sum, r) => sum + r.duration, 0) / todayRequests.length / 1000).toFixed(1))
        : 0,
      customerSatisfaction: 4.7 // TODO: collegare a sistema feedback reale
    };
  }

  /**
   * Ottieni statistiche globali (async, con dati completi da KV)
   */
  async getGlobalStatsAsync() {
    try {
      const todayRequests = await this.getTodayRequests();
      const successfulToday = todayRequests.filter(r => r.success);

      // Ottieni numero sessioni
      const sessionsCount = await kv.scard(getSessionsKey()) || 0;

      // Ottieni escalations di oggi
      const escalations = await kv.get<number>(getEscalationsKey()) || 0;

      return {
        totalRequests: todayRequests.length,
        activeConversations: sessionsCount,
        resolvedToday: successfulToday.length,
        escalatedToday: escalations,
        avgResponseTime: todayRequests.length > 0
          ? parseFloat((todayRequests.reduce((sum, r) => sum + r.duration, 0) / todayRequests.length / 1000).toFixed(1))
          : 0,
        customerSatisfaction: 4.7 // TODO: collegare a sistema feedback reale
      };
    } catch (error) {
      console.error('❌ Error getting global stats from KV:', error);
      return this.getGlobalStats();
    }
  }

  /**
   * Numero conversazioni attive
   */
  getConversationCount(): number {
    return this.localCache.sessions.size;
  }

  /**
   * Sincronizza cache locale con KV
   */
  async syncFromKV() {
    try {
      const todayRequests = await kv.get<RequestRecord[]>(getRequestsKey()) || [];
      const escalations = await kv.get<number>(getEscalationsKey()) || 0;

      this.localCache.requests = todayRequests;
      this.localCache.escalations = escalations;
      this.localCache.lastSync = new Date();

      // Ricostruisci set sessioni
      this.localCache.sessions = new Set(todayRequests.map(r => r.sessionId));

      console.log(`📊 Stats synced from KV: ${todayRequests.length} requests, ${this.localCache.sessions.size} sessions`);
    } catch (error) {
      console.error('❌ Error syncing from KV:', error);
    }
  }

  /**
   * Reset statistiche (per testing)
   */
  async reset() {
    try {
      await kv.del(getRequestsKey());
      await kv.del(getEscalationsKey());
      // Non resettiamo i totali storici

      this.localCache.requests = [];
      this.localCache.sessions.clear();
      this.localCache.escalations = 0;

      console.log('📊 Stats reset');
    } catch (error) {
      console.error('❌ Error resetting stats:', error);
    }
  }
}

// Singleton export
export const agentStats = new AgentStatsStore();

// Helper functions per retrocompatibilità (ora async)
export function recordRequest(agentId: string, duration: number, success: boolean, sessionId: string) {
  // Fire and forget - non blocca la risposta
  agentStats.recordRequest(agentId, duration, success, sessionId).catch(err => {
    console.error('❌ Error in recordRequest:', err);
  });
}

export function recordEscalation() {
  // Fire and forget
  agentStats.recordEscalation().catch(err => {
    console.error('❌ Error in recordEscalation:', err);
  });
}
