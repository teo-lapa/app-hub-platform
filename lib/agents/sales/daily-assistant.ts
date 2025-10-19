import Anthropic from '@anthropic-ai/sdk';
import { memoryManager } from './memory-manager';
import { customerIntel } from './customer-intelligence';
import { performanceTracker } from './performance-tracker';
import { SalespersonContext, Intent, IntentType, MessageContext, DailyPlanOutput } from './types';

/**
 * Daily Assistant Agent
 * Orchestratore principale che coordina gli altri agenti specializzati
 */

export class DailyAssistantAgent {
  private claude: Anthropic;

  constructor() {
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
  }

  /**
   * Processa un messaggio del venditore
   */
  async processMessage(
    salesperson: SalespersonContext,
    message: string
  ): Promise<string> {
    try {
      // 1. Recupera contesto
      const context = await memoryManager.getMessageContext(salesperson);

      // 2. Salva messaggio utente
      await memoryManager.saveMessage(salesperson, 'user', message);

      // 3. Analizza intent
      const intent = await this.analyzeIntent(message, context);

      // 4. Route all'agente appropriato
      let response = '';

      try {
        switch (intent.type) {
          case 'daily_plan':
            response = await this.generateDailyPlan(salesperson);
            break;

          case 'client_analysis':
          case 'client_question':
            response = await this.analyzeClient(intent, salesperson);
            break;

          case 'churn_risk':
            response = await this.listChurnRisks(salesperson);
            break;

          case 'upsell_opportunities':
            response = await this.listUpsellOpportunities(salesperson);
            break;

          case 'performance_check':
            response = await this.showPerformance(salesperson);
            break;

          case 'record_interaction':
            response = await this.recordInteraction(intent, salesperson, message);
            break;

          case 'upcoming_actions':
            response = await this.showUpcomingActions(salesperson);
            break;

          case 'general':
          default:
            response = await this.handleGeneralQuery(message, context);
            break;
        }
      } catch (agentError: any) {
        // Gestione errori Odoo (es. Session expired)
        if (agentError.message?.includes('Session expired') || agentError.message?.includes('session')) {
          response = `⚠️ Non riesco a connettermi a Odoo in questo momento (sessione scaduta).\n\nPer favore prova a:\n1. Ricaricare la pagina\n2. Fare nuovamente login\n3. Riprovare la richiesta\n\nSe il problema persiste, contatta il supporto IT.`;
        } else {
          // Altri errori degli agenti
          console.error('[Daily Assistant] Agent error:', agentError);
          response = `Mi dispiace, si è verificato un errore durante l'elaborazione della tua richiesta.\n\nPuoi provare a riformulare la domanda o contattare il supporto.\n\n**Errore tecnico:** ${agentError.message || 'Errore sconosciuto'}`;
        }
      }

      // 5. Salva risposta
      await memoryManager.saveMessage(salesperson, 'assistant', response, {
        intent: intent.type,
        timestamp: new Date().toISOString()
      });

      return response;

    } catch (error: any) {
      console.error('[Daily Assistant] Critical error in processMessage:', error);
      return `Mi dispiace, si è verificato un errore critico. Per favore riprova tra poco.\n\n**Dettagli tecnici:** ${error.message || 'Errore sconosciuto'}`;
    }
  }

  /**
   * Analizza l'intent del messaggio usando Claude
   */
  private async analyzeIntent(message: string, context: MessageContext): Promise<Intent> {
    const prompt = `Analizza questo messaggio di un venditore e identifica l'intent.

Messaggio: "${message}"

Possibili intents:
- daily_plan: vuole sapere cosa fare oggi/questa settimana
- client_question: domanda su un cliente specifico
- client_analysis: vuole analisi dettagliata di un cliente
- churn_risk: vuole sapere quali clienti sono a rischio
- upsell_opportunities: cerca opportunità di vendita
- performance_check: vuole vedere i suoi KPI
- record_interaction: sta registrando un'interazione (es: "ho chiamato X")
- upcoming_actions: vuole vedere azioni programmate future
- general: altro

Rispondi SOLO con un JSON nel formato:
{"type": "...", "confidence": 0.0-1.0, "extractedData": {...}}

Se menzione un nome cliente, aggiungi extractedData.clientName.`;

    const response = await this.claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { type: 'general', confidence: 0.5 };
    }

    try {
      const json = JSON.parse(content.text);
      return json as Intent;
    } catch {
      // Fallback: pattern matching semplice
      return this.simpleIntentDetection(message);
    }
  }

  /**
   * Intent detection semplice (fallback)
   */
  private simpleIntentDetection(message: string): Intent {
    const lower = message.toLowerCase();

    if (lower.includes('cosa devo fare') || lower.includes('oggi') || lower.includes('programma')) {
      return { type: 'daily_plan', confidence: 0.8 };
    }
    if (lower.includes('kpi') || lower.includes('performance') || lower.includes('come sto')) {
      return { type: 'performance_check', confidence: 0.8 };
    }
    if (lower.includes('rischio') || lower.includes('churn') || lower.includes('perdo')) {
      return { type: 'churn_risk', confidence: 0.8 };
    }
    if (lower.includes('upsell') || lower.includes('opportunità') || lower.includes('vendere di più')) {
      return { type: 'upsell_opportunities', confidence: 0.8 };
    }
    if (lower.includes('ho chiamato') || lower.includes('ho incontrato') || lower.includes('ordinato')) {
      return { type: 'record_interaction', confidence: 0.7 };
    }

    return { type: 'general', confidence: 0.5 };
  }

  /**
   * Genera piano giornaliero
   */
  private async generateDailyPlan(salesperson: SalespersonContext): Promise<string> {
    const [kpis, churnRisks, context] = await Promise.all([
      performanceTracker.getKPIs(salesperson),
      customerIntel.detectChurnRisks(salesperson.odoo_user_id),
      memoryManager.getMessageContext(salesperson)
    ]);

    // Priority 1: Churn prevention (top 3)
    const topChurnRisks = churnRisks.slice(0, 3);

    // Format response
    let response = `Buongiorno ${salesperson.name}! 👋\n\n`;
    response += `📊 **Il Tuo Status**\n`;
    response += `- Revenue mese: €${kpis.revenue.total.toLocaleString('it-IT', { maximumFractionDigits: 0 })} / €${kpis.revenue.target.toLocaleString('it-IT')} (${kpis.revenue.progress.toFixed(0)}%)\n`;
    response += `- Deals chiusi: ${kpis.deals.closed}\n`;
    response += `- Clienti attivi: ${kpis.clients.total}\n\n`;

    if (topChurnRisks.length > 0) {
      response += `🚨 **PRIORITÀ URGENTI - Churn Prevention**\n\n`;
      topChurnRisks.forEach((risk, idx) => {
        response += `${idx + 1}. **${risk.customer.name}** (Rischio: ${risk.churnProbability}%)\n`;
        response += `   - ${risk.riskFactors.join('\n   - ')}\n`;
        response += `   - AZIONE: ${risk.suggestedActions[0]?.action}\n\n`;
      });
    }

    // Upcoming actions
    if (context.upcomingActions.length > 0) {
      response += `📅 **Azioni Programmate Oggi**\n`;
      const today = new Date().toDateString();
      const todayActions = context.upcomingActions.filter(
        a => new Date(a.date).toDateString() === today
      );

      if (todayActions.length > 0) {
        todayActions.forEach(action => {
          response += `- ${action.clientName}: ${action.action}\n`;
        });
      } else {
        response += `Nessuna azione programmata per oggi\n`;
      }
      response += `\n`;
    }

    // Goal for today
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();
    const dayOfMonth = new Date().getDate();
    const dailyTarget = kpis.revenue.target / daysInMonth;
    const remaining = kpis.revenue.target - kpis.revenue.total;
    const daysRemaining = daysInMonth - dayOfMonth + 1;
    const dailyNeeded = remaining / daysRemaining;

    response += `🎯 **Obiettivo Oggi**\n`;
    response += `Per raggiungere il target mensile, oggi devi fare: €${dailyNeeded.toLocaleString('it-IT', { maximumFractionDigits: 0 })}\n`;
    response += `(Media giornaliera: €${dailyTarget.toLocaleString('it-IT', { maximumFractionDigits: 0 })})\n\n`;

    response += `Forza! 💪`;

    return response;
  }

  /**
   * Analizza cliente specifico
   */
  private async analyzeClient(intent: Intent, salesperson: SalespersonContext): Promise<string> {
    const clientName = intent.extractedData?.clientName;

    if (!clientName) {
      return "Per analizzare un cliente, dammi il nome. Es: 'Analizza Cliente Casa Cosi'";
    }

    // Search client by name
    const odoo = require('@/lib/odoo/rpcClient').createOdooRPCClient();
    const clients = await odoo.searchRead(
      'res.partner',
      [
        ['name', 'ilike', clientName],
        ['user_id', '=', salesperson.id]
      ],
      ['id', 'name'],
      5
    );

    if (clients.length === 0) {
      return `Non ho trovato clienti con nome "${clientName}" assegnati a te.`;
    }

    const client = clients[0];
    const analysis = await customerIntel.analyzeClient(client.id);

    let response = `📊 **Analisi ${client.name}**\n\n`;

    // RFM
    response += `**RFM Score**: ${analysis.rfm.rfmScore} - ${analysis.rfm.segment}\n`;
    response += `- Ultimo ordine: ${analysis.rfm.recency} giorni fa\n`;
    response += `- Ordini/anno: ${analysis.rfm.frequency}\n`;
    response += `- Revenue/anno: €${analysis.rfm.monetary.toLocaleString('it-IT', { maximumFractionDigits: 0 })}\n\n`;

    // Insights
    if (analysis.insights.length > 0) {
      response += `**Insights**:\n`;
      analysis.insights.forEach(insight => {
        response += `${insight}\n`;
      });
    }

    return response;
  }

  /**
   * Mostra clienti a rischio churn
   */
  private async listChurnRisks(salesperson: SalespersonContext): Promise<string> {
    const risks = await customerIntel.detectChurnRisks(salesperson.id);

    if (risks.length === 0) {
      return '✅ Ottimo! Nessun cliente a rischio churn al momento.';
    }

    let response = `🚨 **Clienti a Rischio Churn** (${risks.length})\n\n`;

    risks.slice(0, 5).forEach((risk, idx) => {
      response += `${idx + 1}. **${risk.customer.name}** - Rischio: ${risk.churnProbability}%\n`;
      response += `   Motivi: ${risk.riskFactors.join(', ')}\n`;
      response += `   Azione: ${risk.suggestedActions[0]?.action}\n\n`;
    });

    return response;
  }

  /**
   * Mostra opportunità upsell
   */
  private async listUpsellOpportunities(salesperson: SalespersonContext): Promise<string> {
    const opportunities = await customerIntel.findUpsellOpportunities(salesperson.id);

    if (opportunities.length === 0) {
      return 'Al momento non ho identificato opportunità di upsell specifiche.';
    }

    let response = `💰 **Opportunità Upsell** (${opportunities.length})\n\n`;

    opportunities.slice(0, 5).forEach((opp, idx) => {
      response += `${idx + 1}. **${opp.customer.name}**\n`;
      response += `   Spesa attuale: €${opp.currentSpend.toLocaleString('it-IT', { maximumFractionDigits: 0 })}\n`;
      response += `   Potenziale: €${opp.potentialSpend.toLocaleString('it-IT', { maximumFractionDigits: 0 })} (+€${opp.gap.toLocaleString('it-IT', { maximumFractionDigits: 0 })})\n\n`;
    });

    return response;
  }

  /**
   * Mostra performance
   */
  private async showPerformance(salesperson: SalespersonContext): Promise<string> {
    const kpis = await performanceTracker.getKPIs(salesperson);
    return performanceTracker.formatKPIs(kpis);
  }

  /**
   * Registra interazione
   */
  private async recordInteraction(
    intent: Intent,
    salesperson: SalespersonContext,
    message: string
  ): Promise<string> {
    const extracted = memoryManager.extractInteractionFromMessage(message);

    if (!extracted || !extracted.clientName) {
      return "Ho capito che hai avuto un'interazione, ma non ho capito con quale cliente. Puoi dirmi il nome?";
    }

    // Save interaction (simplified - in produzione cercare cliente in Odoo)
    // TODO: implementare salvataggio completo

    return `✅ Ho registrato: ${extracted.interactionType || 'interazione'} con ${extracted.clientName}${extracted.amount ? ` per €${extracted.amount.toLocaleString('it-IT')}` : ''}`;
  }

  /**
   * Mostra azioni future
   */
  private async showUpcomingActions(salesperson: SalespersonContext): Promise<string> {
    const context = await memoryManager.getMessageContext(salesperson);

    if (context.upcomingActions.length === 0) {
      return 'Non hai azioni programmate al momento.';
    }

    let response = `📅 **Azioni Programmate**\n\n`;

    context.upcomingActions.slice(0, 10).forEach(action => {
      const dateStr = new Date(action.date).toLocaleDateString('it-IT');
      response += `- ${dateStr}: ${action.clientName} - ${action.action}\n`;
    });

    return response;
  }

  /**
   * Gestisce domanda generica
   */
  private async handleGeneralQuery(message: string, context: MessageContext): Promise<string> {
    // Usa Claude per risposta contestuale
    const conversationHistory = context.conversationHistory.slice(-10);

    const systemPrompt = `Sei un assistente AI per venditori B2B nel settore food.
Aiuti i venditori a gestire clienti, pianificare visite e raggiungere obiettivi.
Rispondi in modo conciso, amichevole e pratico.

Contesto venditore:
- Nome: ${context.salesperson.name}
- Interazioni recenti: ${context.recentInteractions.length}
- Azioni programmate: ${context.upcomingActions.length}

Se la domanda riguarda dati specifici (clienti, ordini, KPI), di' al venditore di fare una domanda più specifica.`;

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    const response = await this.claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.7,
      system: systemPrompt,
      messages
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : 'Mi dispiace, non ho capito.';
  }
}

// Export singleton instance
export const dailyAssistant = new DailyAssistantAgent();
