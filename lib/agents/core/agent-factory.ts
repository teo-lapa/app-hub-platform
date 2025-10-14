/**
 * 🏭 AGENT FACTORY
 * Crea automaticamente agenti specializzati per ogni app
 */

import { AgentDefinition, AppContext, AgentCapability } from '../types/agent-types';
import { SpecializedAgent } from '../specialized/specialized-agent';

export class AgentFactory {
  private agentRegistry: Map<string, AgentDefinition>;
  private agentInstances: Map<string, SpecializedAgent>;

  constructor() {
    this.agentRegistry = new Map();
    this.agentInstances = new Map();
  }

  /**
   * Crea un agente specializzato per una app
   */
  async createAgentForApp(appContext: AppContext): Promise<SpecializedAgent> {
    console.log(`🏭 Creating agent for: ${appContext.appName}`);

    // Check if agent already exists
    const existingAgent = this.agentInstances.get(appContext.appName);
    if (existingAgent) {
      console.log(`♻️  Agent already exists, returning existing instance`);
      return existingAgent;
    }

    // Generate agent definition
    const definition = this.generateAgentDefinition(appContext);

    // Create agent instance
    const agent = new SpecializedAgent(definition);

    // Register agent
    this.agentRegistry.set(definition.id, definition);
    this.agentInstances.set(appContext.appName, agent);

    console.log(`✅ Agent created: ${definition.name}`);

    return agent;
  }

  /**
   * Genera la definizione di un agente basandosi sul contesto dell'app
   */
  private generateAgentDefinition(appContext: AppContext): AgentDefinition {
    const agentId = this.generateAgentId(appContext.appName);
    const agentName = this.generateAgentName(appContext.appName);

    // Generate capabilities
    const capabilities = this.generateCapabilities(appContext);

    // Generate tools list
    const tools = this.generateToolsList(appContext);

    const definition: AgentDefinition = {
      id: agentId,
      name: agentName,
      type: 'specialized',
      status: 'idle',
      appContext,
      capabilities,
      config: {
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8000,
        temperature: 0.3,  // Lower for more deterministic code generation
        tools
      },
      stats: {
        tasksCompleted: 0,
        tasksInProgress: 0,
        tasksFailed: 0,
        averageCompletionTime: 0,
        successRate: 100,
        lastActive: new Date()
      },
      learningData: {
        successfulPatterns: [],
        commonErrors: [],
        improvements: []
      }
    };

    return definition;
  }

  /**
   * Genera un ID univoco per l'agente
   */
  private generateAgentId(appName: string): string {
    return `agent-${appName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  }

  /**
   * Genera un nome per l'agente
   */
  private generateAgentName(appName: string): string {
    // Convert kebab-case or snake_case to Title Case
    const words = appName.replace(/[-_]/g, ' ').split(' ');
    const titleCase = words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return `${titleCase} Agent`;
  }

  /**
   * Genera le capabilities dell'agente
   */
  private generateCapabilities(appContext: AppContext): AgentCapability[] {
    const capabilities: AgentCapability[] = [];

    // Base capabilities per tutti gli agenti
    capabilities.push({
      id: 'analyze-code',
      name: 'Code Analysis',
      description: `Analyze code structure and patterns in ${appContext.appName}`,
      examples: [
        'Find performance bottlenecks',
        'Identify code smells',
        'Suggest refactoring opportunities'
      ]
    });

    capabilities.push({
      id: 'fix-bugs',
      name: 'Bug Fixing',
      description: `Fix bugs and issues in ${appContext.appName}`,
      examples: [
        'Fix runtime errors',
        'Resolve type errors',
        'Handle edge cases'
      ]
    });

    capabilities.push({
      id: 'add-features',
      name: 'Feature Development',
      description: `Add new features to ${appContext.appName}`,
      examples: [
        'Implement new UI components',
        'Add new API endpoints',
        'Integrate with Odoo'
      ]
    });

    capabilities.push({
      id: 'refactor',
      name: 'Code Refactoring',
      description: `Refactor and improve ${appContext.appName} codebase`,
      examples: [
        'Extract reusable components',
        'Optimize performance',
        'Improve code readability'
      ]
    });

    // Category-specific capabilities
    if (appContext.category === 'magazzino') {
      capabilities.push({
        id: 'inventory-ops',
        name: 'Inventory Operations',
        description: 'Handle warehouse and inventory-specific operations',
        examples: [
          'Stock movements',
          'Location management',
          'Picking operations'
        ]
      });
    } else if (appContext.category === 'vendite') {
      capabilities.push({
        id: 'sales-ops',
        name: 'Sales Operations',
        description: 'Handle sales-specific operations',
        examples: [
          'Order processing',
          'Customer management',
          'Price calculations'
        ]
      });
    } else if (appContext.category === 'delivery') {
      capabilities.push({
        id: 'delivery-ops',
        name: 'Delivery Operations',
        description: 'Handle delivery-specific operations',
        examples: [
          'Route optimization',
          'Delivery tracking',
          'Signature capture'
        ]
      });
    }

    // Odoo-specific capabilities se l'app usa Odoo
    if (appContext.dependencies.odoo.length > 0) {
      capabilities.push({
        id: 'odoo-integration',
        name: 'Odoo Integration',
        description: `Integrate with Odoo models: ${appContext.dependencies.odoo.join(', ')}`,
        examples: [
          'Fetch data from Odoo',
          'Update Odoo records',
          'Handle Odoo API errors'
        ]
      });
    }

    return capabilities;
  }

  /**
   * Genera la lista di tool disponibili per l'agente
   */
  private generateToolsList(appContext: AppContext): string[] {
    const tools: string[] = [
      'read_file',
      'write_file',
      'search_code',
      'analyze_structure',
      'run_tests'
    ];

    // Add Odoo-specific tools if app uses Odoo
    if (appContext.dependencies.odoo.length > 0) {
      tools.push('query_odoo', 'update_odoo');
    }

    // Add category-specific tools
    if (appContext.category === 'magazzino') {
      tools.push('check_inventory', 'move_stock');
    } else if (appContext.category === 'vendite') {
      tools.push('create_order', 'calculate_price');
    }

    return tools;
  }

  /**
   * Crea agenti per tutte le app
   */
  async createAgentsForApps(apps: AppContext[]): Promise<Map<string, SpecializedAgent>> {
    console.log(`🏭 Creating agents for ${apps.length} apps...`);

    const agents = new Map<string, SpecializedAgent>();

    for (const app of apps) {
      try {
        const agent = await this.createAgentForApp(app);
        agents.set(app.appName, agent);
      } catch (error) {
        console.error(`❌ Failed to create agent for ${app.appName}:`, error);
      }
    }

    console.log(`✅ Created ${agents.size} agents`);

    return agents;
  }

  /**
   * Ottiene un agente dal registry
   */
  getAgent(appName: string): SpecializedAgent | undefined {
    return this.agentInstances.get(appName);
  }

  /**
   * Ottiene tutti gli agenti
   */
  getAllAgents(): Map<string, SpecializedAgent> {
    return this.agentInstances;
  }

  /**
   * Ottiene tutte le definizioni degli agenti
   */
  getAllDefinitions(): AgentDefinition[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Aggiorna un agente esistente
   */
  async updateAgent(appName: string, newContext: AppContext): Promise<void> {
    console.log(`🔄 Updating agent: ${appName}`);

    // Remove old agent
    this.agentInstances.delete(appName);

    // Find and remove old definition
    for (const [id, def] of this.agentRegistry.entries()) {
      if (def.appContext?.appName === appName) {
        this.agentRegistry.delete(id);
        break;
      }
    }

    // Create new agent with updated context
    await this.createAgentForApp(newContext);

    console.log(`✅ Agent updated: ${appName}`);
  }

  /**
   * Rimuove un agente
   */
  removeAgent(appName: string): void {
    console.log(`🗑️  Removing agent: ${appName}`);

    this.agentInstances.delete(appName);

    // Find and remove definition
    for (const [id, def] of this.agentRegistry.entries()) {
      if (def.appContext?.appName === appName) {
        this.agentRegistry.delete(id);
        break;
      }
    }

    console.log(`✅ Agent removed: ${appName}`);
  }

  /**
   * Ottiene statistiche del factory
   */
  getStats() {
    return {
      totalAgents: this.agentInstances.size,
      agentsByCategory: this.getAgentsByCategory(),
      agentsByStatus: this.getAgentsByStatus(),
      totalTasksCompleted: this.getTotalTasksCompleted(),
      averageSuccessRate: this.getAverageSuccessRate()
    };
  }

  /**
   * Raggruppa agenti per categoria
   */
  private getAgentsByCategory(): Record<string, number> {
    const byCategory: Record<string, number> = {};

    for (const def of this.agentRegistry.values()) {
      if (def.appContext) {
        const cat = def.appContext.category;
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }
    }

    return byCategory;
  }

  /**
   * Raggruppa agenti per status
   */
  private getAgentsByStatus(): Record<string, number> {
    const byStatus: Record<string, number> = {};

    for (const def of this.agentRegistry.values()) {
      byStatus[def.status] = (byStatus[def.status] || 0) + 1;
    }

    return byStatus;
  }

  /**
   * Calcola totale task completati
   */
  private getTotalTasksCompleted(): number {
    let total = 0;

    for (const def of this.agentRegistry.values()) {
      total += def.stats.tasksCompleted;
    }

    return total;
  }

  /**
   * Calcola success rate medio
   */
  private getAverageSuccessRate(): number {
    if (this.agentRegistry.size === 0) return 100;

    let total = 0;

    for (const def of this.agentRegistry.values()) {
      total += def.stats.successRate;
    }

    return total / this.agentRegistry.size;
  }
}
