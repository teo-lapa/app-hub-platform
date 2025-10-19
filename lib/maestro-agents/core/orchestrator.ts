/**
 * ORCHESTRATOR AGENT
 * Routes user queries to appropriate agents and coordinates multi-agent execution
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Agent,
  AgentTask,
  AgentRole,
  AgentResult,
  OrchestratorDecision,
  OrchestratorResult,
} from '../types';

// Import all specialized agents
import { CustomerIntelligenceAgent } from '../agents/customer-intelligence-agent';
import { ProductIntelligenceAgent } from '../agents/product-intelligence-agent';
import { SalesAnalystAgent } from '../agents/sales-analyst-agent';
import { MaestroIntelligenceAgent } from '../agents/maestro-intelligence-agent';
import { ActionExecutorAgent } from '../agents/action-executor-agent';
import { ExternalResearchAgent } from '../agents/external-research-agent';

export class OrchestratorAgent {
  private anthropic: Anthropic;
  private agents: Map<AgentRole, Agent>;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Initialize all specialized agents
    this.agents = new Map();
    this.agents.set('customer_intelligence', new CustomerIntelligenceAgent());
    this.agents.set('product_intelligence', new ProductIntelligenceAgent());
    this.agents.set('sales_analyst', new SalesAnalystAgent());
    this.agents.set('maestro_intelligence', new MaestroIntelligenceAgent());
    this.agents.set('action_executor', new ActionExecutorAgent());
    this.agents.set('external_research', new ExternalResearchAgent());
  }

  /**
   * Main entry point: Execute a task using appropriate agents
   */
  async execute(task: AgentTask): Promise<OrchestratorResult> {
    const startTime = Date.now();

    try {
      console.log('🎯 Orchestrator: Analyzing query:', task.user_query);

      // Step 1: Analyze query and decide which agents to call
      const decision = await this.analyzeAndRoute(task);

      console.log('🎯 Orchestrator: Decision:', {
        agents: decision.agents_to_call,
        mode: decision.execution_mode,
      });

      // Step 2: Execute agents (parallel or sequential)
      const agentResults = await this.executeAgents(task, decision);

      console.log('🎯 Orchestrator: Agent execution complete:', {
        agents: agentResults.length,
        successful: agentResults.filter(r => r.success).length,
      });

      // Step 3: Synthesize final response from agent results
      const finalResponse = await this.synthesizeResponse(task, agentResults, decision);

      const totalDuration = Date.now() - startTime;
      const totalTokens = agentResults.reduce((sum, r) => sum + (r.tokens_used || 0), 0);

      return {
        success: true,
        final_response: finalResponse,
        agents_called: decision.agents_to_call,
        agent_results: agentResults,
        total_tokens_used: totalTokens,
        total_duration_ms: totalDuration,
        decision,
      };
    } catch (error) {
      console.error('❌ Orchestrator error:', error);
      const totalDuration = Date.now() - startTime;

      return {
        success: false,
        final_response: `Mi dispiace, si è verificato un errore nell'elaborazione della tua richiesta. ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        agents_called: [],
        agent_results: [],
        total_tokens_used: 0,
        total_duration_ms: totalDuration,
        decision: {
          agents_to_call: [],
          execution_mode: 'parallel',
          reasoning: 'Error occurred',
          estimated_duration_ms: 0,
        },
      };
    }
  }

  /**
   * Analyze query and decide which agents to call
   */
  private async analyzeAndRoute(task: AgentTask): Promise<OrchestratorDecision> {
    const routingPrompt = `You are an intelligent query router for a multi-agent sales assistant system.

# Available Agents

1. **customer_intelligence** - Customer data, behavior, churn risk, history, profiles
2. **product_intelligence** - Product performance, trends, cross-sell/upsell opportunities
3. **sales_analyst** - Sales performance, KPIs, analytics, forecasts, team leaderboard
4. **maestro_intelligence** - AI recommendations, daily action plans, learned patterns, timing optimization
5. **action_executor** - Record interactions, update recommendations, log activities
6. **external_research** - External data: restaurant menus, reviews, social media, news

# Your Task

Analyze the user query and decide:
1. Which agent(s) to call (1 or more)
2. Execution mode: "parallel" (agents can run simultaneously) or "sequential" (one depends on another)
3. Reasoning for your decision

# Query Analysis Rules

**Single Agent Queries:**
- "Chi è [customer]?" → customer_intelligence
- "Cosa sta vendendo bene?" → product_intelligence
- "Come sto andando?" → sales_analyst
- "Cosa devo fare oggi?" → maestro_intelligence
- "Ho visitato [customer]..." → action_executor
- "Cerca il menù di [restaurant]" → external_research

**Multi-Agent Queries (Parallel):**
- "Analizza [customer] e dimmi cosa proporre" → customer_intelligence + product_intelligence (parallel)
- "Performance del team e top prodotti" → sales_analyst + product_intelligence (parallel)
- "Piano giornata con performance" → maestro_intelligence + sales_analyst (parallel)

**Multi-Agent Queries (Sequential):**
- "Cerca info su [restaurant] e dimmi cosa vendere" → external_research THEN product_intelligence (sequential)
- "Analizza [customer] e aggiorna raccomandazione" → customer_intelligence THEN action_executor (sequential)

**Context-Aware Routing:**
- If context.customer_id provided → likely customer_intelligence
- If user is logging an action → action_executor
- If asking about "today" or "piano" → maestro_intelligence
- If asking about performance or metrics → sales_analyst

# Response Format

Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "agents_to_call": ["agent1", "agent2"],
  "execution_mode": "parallel" | "sequential",
  "reasoning": "Why these agents and this mode",
  "estimated_duration_ms": 2000
}

# User Query
${task.user_query}

# Context
${task.context ? JSON.stringify(task.context, null, 2) : 'No additional context'}

# Decision (JSON only):`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: routingPrompt,
        },
      ],
    });

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from routing agent');
    }

    // Parse JSON (may be wrapped in markdown)
    let jsonText = textContent.text.trim();
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const decision: OrchestratorDecision = JSON.parse(jsonText);

    // Validate agent roles
    decision.agents_to_call = decision.agents_to_call.filter(role => this.agents.has(role as AgentRole));

    if (decision.agents_to_call.length === 0) {
      // Default to customer_intelligence if no agents matched
      decision.agents_to_call = ['customer_intelligence' as AgentRole];
      decision.reasoning = 'Fallback to customer intelligence agent';
    }

    return decision;
  }

  /**
   * Execute agents based on decision
   */
  private async executeAgents(
    task: AgentTask,
    decision: OrchestratorDecision
  ): Promise<AgentResult[]> {
    if (decision.execution_mode === 'parallel') {
      // Execute all agents in parallel
      const promises = decision.agents_to_call.map(role => {
        const agent = this.agents.get(role as AgentRole);
        if (!agent) {
          return Promise.resolve({
            success: false,
            agent_role: role as AgentRole,
            error: `Agent ${role} not found`,
          });
        }
        return agent.execute(task);
      });

      return Promise.all(promises);
    } else {
      // Execute agents sequentially
      const results: AgentResult[] = [];

      for (const role of decision.agents_to_call) {
        const agent = this.agents.get(role as AgentRole);
        if (!agent) {
          results.push({
            success: false,
            agent_role: role as AgentRole,
            error: `Agent ${role} not found`,
          });
          continue;
        }

        // Execute agent
        const result = await agent.execute(task);
        results.push(result);

        // If agent failed, stop sequential execution
        if (!result.success) {
          console.warn(`⚠️ Agent ${role} failed, stopping sequential execution`);
          break;
        }

        // Add result to context for next agent
        if (!task.context) {
          task.context = {};
        }
        task.context[`${role}_result`] = result.data;
      }

      return results;
    }
  }

  /**
   * Synthesize final response from multiple agent results
   */
  private async synthesizeResponse(
    task: AgentTask,
    agentResults: AgentResult[],
    decision: OrchestratorDecision
  ): Promise<string> {
    // If only one agent and it succeeded, return its response directly
    if (agentResults.length === 1 && agentResults[0].success) {
      return agentResults[0].data || 'Completato.';
    }

    // If all agents failed, return error message
    const successfulResults = agentResults.filter(r => r.success);
    if (successfulResults.length === 0) {
      return 'Mi dispiace, non sono riuscito a elaborare la tua richiesta. Tutti gli agenti hanno riscontrato errori.';
    }

    // Multiple agents: synthesize responses
    const synthesisPrompt = `You are synthesizing responses from multiple specialized agents into a single, coherent response.

# User Query
${task.user_query}

# Agents Called
${decision.agents_to_call.join(', ')}

# Agent Responses
${successfulResults
  .map(
    (result, i) => `
## Agent ${i + 1}: ${result.agent_role}
${result.data || '(No data)'}
`
  )
  .join('\n')}

# Your Task

Synthesize these agent responses into ONE coherent, well-structured response that:
1. Answers the user's original query completely
2. Combines insights from all agents logically
3. Removes redundancy and contradictions
4. Maintains the professional, data-driven tone
5. Includes specific metrics and actionable insights from the agents
6. Is written in Italian

# Guidelines

- If agents provided complementary information, integrate it smoothly
- If agents provided similar information, consolidate it
- Maintain section structure (use headers like **Cliente**, **Performance**, etc.)
- Keep the same emoji usage style as the individual agents
- Be concise but complete
- End with actionable next steps if relevant

# Synthesized Response (in Italian):`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: synthesisPrompt,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      // Fallback: concatenate agent responses
      return successfulResults.map(r => r.data).join('\n\n---\n\n');
    }

    return textContent.text.trim();
  }

  /**
   * Get a specific agent by role
   */
  getAgent(role: AgentRole): Agent | undefined {
    return this.agents.get(role);
  }

  /**
   * List all available agents
   */
  listAgents(): Array<{ role: AgentRole; name: string; description: string }> {
    return Array.from(this.agents.values()).map(agent => ({
      role: agent.role,
      name: agent.name,
      description: agent.description,
    }));
  }
}
