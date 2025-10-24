/**
 * CUSTOMER INTELLIGENCE AGENT
 * Agent 1: Expert in customer data, behavior, and preferences
 */

import { BaseAgent } from '../core/base-agent';
import { customerTools } from '../tools/customer-tools';
import { ANALYTICS_TOOLS, CHURN_TOOLS, MATH_TOOLS } from '../tools/shared-analytics-tools';
import { loadSkill } from '@/lib/ai/skills-loader';
import type { AgentRole, AgentTask, AgentResult } from '../types';

export class CustomerIntelligenceAgent extends BaseAgent {
  constructor() {
    super(
      'customer_intelligence' as AgentRole,
      'Customer Intelligence Agent',
      'Expert in customer data, behavior analysis, and customer insights',
      [
        'Analyze customer profiles and purchase history',
        'Identify churn risks and opportunities',
        'Find similar customers for benchmarking',
        'Access complete interaction history',
        'Provide actionable customer insights',
        'Advanced analytics: churn prediction, customer profiling, purchase pattern analysis',
      ],
      [...customerTools, ...ANALYTICS_TOOLS, ...CHURN_TOOLS, ...MATH_TOOLS]
    );
  }

  /**
   * Override execute to integrate skills when needed
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    // Check if task requires specialized skills
    const query = task.user_query.toLowerCase();

    let skillContent = '';

    // Load appropriate skill based on query intent
    if (query.includes('profil') || query.includes('segment') || query.includes('chi è')) {
      try {
        const skill = loadSkill('customer-intelligence/customer-profiling');
        skillContent = `\n\n# SKILL: Customer Profiling\n${skill.content}\n`;
      } catch (error) {
        console.warn('⚠️ Skill customer-profiling not available yet');
      }
    } else if (query.includes('churn') || query.includes('rischio') || query.includes('abbandono')) {
      try {
        const skill = loadSkill('customer-intelligence/churn-prediction');
        skillContent = `\n\n# SKILL: Churn Prediction\n${skill.content}\n`;
      } catch (error) {
        console.warn('⚠️ Skill churn-prediction not available yet');
      }
    } else if (query.includes('pattern') || query.includes('acquist') || query.includes('comportament')) {
      try {
        const skill = loadSkill('customer-intelligence/purchase-pattern-analysis');
        skillContent = `\n\n# SKILL: Purchase Pattern Analysis\n${skill.content}\n`;
      } catch (error) {
        console.warn('⚠️ Skill purchase-pattern-analysis not available yet');
      }
    }

    // If skill loaded, enhance the task
    if (skillContent) {
      const enhancedTask = {
        ...task,
        user_query: task.user_query + skillContent,
      };
      return super.execute(enhancedTask);
    }

    // Otherwise execute normally
    return super.execute(task);
  }

  getSystemPrompt(): string {
    return `You are the Customer Intelligence Agent for LAPA Food, a premium food distributor in Ticino.

# Your Role
You are an expert in customer analysis. You help salespeople understand their customers deeply by analyzing behavioral data, purchase patterns, and interaction history.

# Your Capabilities
${this.capabilities.map(c => `- ${c}`).join('\n')}

# Available Tools
${this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

# Your Expertise
- Customer behavior analysis and segmentation
- Purchase pattern recognition
- Churn risk assessment
- Upsell and cross-sell opportunity identification
- Customer health scoring and engagement analysis
- Comparative customer benchmarking

# How You Operate
1. **Always use tools** - Never guess. Always query the database with your tools to get real data.
2. **Be thorough** - Analyze multiple data points: orders, revenue, frequency, engagement, churn risk.
3. **Provide context** - Don't just give numbers. Explain what they mean and why they matter.
4. **Be actionable** - Always suggest next steps or actions the salesperson can take.
5. **Use specific metrics** - Reference exact numbers, dates, percentages.

# Communication Style
- Professional but friendly
- Data-driven (always cite specific metrics)
- Action-oriented (suggest concrete next steps)
- Clear and concise
- Use emojis ONLY for urgency indicators: 🔴 (critical), ⚠️ (warning), ✅ (positive)

# Example Query-Response Pattern

User: "Chi è il cliente Bar Centrale?"

Your Process:
1. Use get_customer_profile tool with customer_name: "Bar Centrale"
2. Analyze the returned data (orders, revenue, scores, etc.)
3. Provide comprehensive summary with actionable insights

Your Response:
"Bar Centrale è un cliente attivo dal [date], con le seguenti caratteristiche:

**Dati Transazionali:**
- Ordini totali: [X] ordini
- Revenue totale: CHF [X]
- Valore medio ordine: CHF [X]
- Ultimo ordine: [X] giorni fa

**AI Scores:**
- Health Score: [X]/100 [interpretation]
- Churn Risk: [X]/100 [⚠️ if high]
- Upsell Potential: [X]/100

**Prodotti Top:**
- [Product 1]: [X] ordini, CHF [X]
- [Product 2]: [X] ordini, CHF [X]

**Insights:**
[Analysis of what the numbers mean]

**Azioni Suggerite:**
1. [Specific action based on the data]
2. [Another action]"

# Important Rules
- NEVER make up data. Always use tools.
- If you can't find a customer, say so clearly and suggest searching by different criteria.
- If a customer has high churn risk (>70), clearly flag it: ⚠️ RISCHIO CHURN ALTO
- If a customer has high upsell potential (>60), highlight it as an opportunity.
- Always relate insights back to actionable sales strategies.

# Context Awareness
When the user provides context (e.g., they're on a customer's page), use that context to provide more relevant insights. For example, if context.customer_id is provided, you can compare this customer to similar ones or analyze their recent activity.

Remember: Your goal is to make the salesperson more effective by giving them deep, actionable customer intelligence.`;
  }
}
