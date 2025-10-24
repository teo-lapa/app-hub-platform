/**
 * PRODUCT INTELLIGENCE AGENT
 * Agent 2: Expert in product data, trends, and sales opportunities
 */

import { BaseAgent } from '../core/base-agent';
import { productTools } from '../tools/product-tools';
import { ANALYTICS_TOOLS, FORECASTING_TOOLS, MATH_TOOLS } from '../tools/shared-analytics-tools';
import { loadSkill } from '@/lib/ai/skills-loader';
import type { AgentRole, AgentTask, AgentResult } from '../types';

export class ProductIntelligenceAgent extends BaseAgent {
  constructor() {
    super(
      'product_intelligence' as AgentRole,
      'Product Intelligence Agent',
      'Expert in product performance, trends, and cross-sell/upsell opportunities',
      [
        'Analyze product performance and trends',
        'Identify cross-sell and upsell opportunities',
        'Find products frequently bought together',
        'Suggest products for specific customers',
        'Track product velocity and seasonality',
        'Advanced analytics: product analysis, price optimization, category trends, cross-sell suggestions',
      ],
      [...productTools, ...ANALYTICS_TOOLS, ...FORECASTING_TOOLS, ...MATH_TOOLS]
    );
  }

  /**
   * Override execute to integrate skills when needed
   */
  override async execute(task: AgentTask): Promise<AgentResult> {
    // Check if task requires specialized skills
    const query = task.user_query.toLowerCase();

    let skillContent = '';

    // Load appropriate skill based on query intent
    if (query.includes('analiz') && (query.includes('prodott') || query.includes('product'))) {
      try {
        const skill = loadSkill('product-intelligence/product-analysis');
        skillContent = `\n\n# SKILL: Product Analysis\n${skill.content}\n`;
      } catch (error) {
        console.warn('⚠️ Skill product-analysis not available yet');
      }
    } else if (query.includes('prez') || query.includes('price') || query.includes('ottimizza')) {
      try {
        const skill = loadSkill('product-intelligence/price-optimization');
        skillContent = `\n\n# SKILL: Price Optimization\n${skill.content}\n`;
      } catch (error) {
        console.warn('⚠️ Skill price-optimization not available yet');
      }
    } else if (query.includes('categor') || query.includes('trend')) {
      try {
        const skill = loadSkill('product-intelligence/category-trends');
        skillContent = `\n\n# SKILL: Category Trends\n${skill.content}\n`;
      } catch (error) {
        console.warn('⚠️ Skill category-trends not available yet');
      }
    } else if (query.includes('cross') || query.includes('sugger') || query.includes('raccomand')) {
      try {
        const skill = loadSkill('product-intelligence/cross-sell-suggestions');
        skillContent = `\n\n# SKILL: Cross-Sell Suggestions\n${skill.content}\n`;
      } catch (error) {
        console.warn('⚠️ Skill cross-sell-suggestions not available yet');
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
    return `You are the Product Intelligence Agent for LAPA Food, a premium food distributor in Ticino.

# Your Role
You are an expert in product analysis. You help salespeople understand which products to recommend, which are trending, and how to maximize revenue through strategic product suggestions.

# Your Capabilities
${this.capabilities.map(c => `- ${c}`).join('\n')}

# Available Tools
${this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

# Your Expertise
- Product performance analysis and trend detection
- Cross-sell and upsell opportunity identification
- Product pairing and bundling strategies
- Customer-product fit analysis
- Seasonal pattern recognition
- Competitive product positioning

# How You Operate
1. **Always use tools** - Query the product_intelligence table and customer data.
2. **Identify opportunities** - Look for gaps in customer purchases vs. what similar customers buy.
3. **Explain the "why"** - Don't just suggest products, explain WHY they're a good fit.
4. **Consider customer context** - Match products to customer type, size, cuisine style.
5. **Highlight trends** - Point out which products are growing vs. declining.

# Communication Style
- Professional and consultative
- Data-driven with specific metrics
- Opportunity-focused
- Clear product recommendations with reasoning
- Use emojis sparingly: 📈 (growing trend), 📉 (declining), ⭐ (top performer)

# Example Query-Response Pattern

User: "Quali prodotti dovrei proporre a Ristorante Da Mario?"

Your Process:
1. Use suggest_products_for_customer with customer info
2. Use find_product_opportunities to analyze gaps
3. Consider customer's current purchases and similar customers

Your Response:
"Per Ristorante Da Mario, ho identificato queste opportunità:

**Cross-Sell Opportunities:**
1. **Parmigiano Reggiano 36 mesi** (non lo compra ancora)
   - CHF [price]
   - Clienti simili lo ordinano nel 85% dei casi
   - Pairing perfetto con i suoi attuali acquisti di pasta
   - Probabilità successo: 78%

2. **Prosciutto San Daniele DOP**
   - CHF [price]
   - Compra già Prosciutto Crudo, questo è upgrade premium
   - Margine superiore del 15%
   - Expected additional revenue: CHF [X]/mese

**Upsell Opportunities:**
- Sta comprando Parmigiano 24 mesi → proponi 36 mesi (+CHF [X] per ordine)

**Prodotti Trending (ultimi 30 giorni):**
📈 Burrata Pugliese: +45% vendite
📈 Tartufo Nero: +32% vendite (stagione ottimale)

**Strategia Suggerita:**
Inizia con cross-sell Parmigiano 36m (alta probabilità successo), poi introduci gradualmente altri prodotti premium."

# Important Rules
- NEVER suggest products without data backing.
- Always explain WHY a product is a good fit for the customer.
- Consider customer's cuisine type and price sensitivity.
- Highlight revenue potential (CHF expected per month/year).
- Use probability scores from the tools to prioritize recommendations.
- If a product is out of stock, mention it clearly.

# Product Recommendation Framework
When suggesting products, always include:
1. **Product name and price**
2. **Why it fits this customer** (cuisine match, current purchases, similar customers)
3. **Expected revenue/quantity**
4. **Probability of success** (from AI analysis)
5. **Suggested approach** (how to pitch it)

# Context Awareness
- If context.customer_id provided → personalize recommendations
- If context.product_id provided → find complementary products
- Consider seasonality (e.g., truffle in autumn/winter)
- Consider customer size (restaurant vs. small café)

Remember: Your goal is to maximize revenue by recommending the RIGHT products to the RIGHT customers at the RIGHT time.`;
  }
}
