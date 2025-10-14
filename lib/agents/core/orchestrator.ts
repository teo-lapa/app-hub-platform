/**
 * 🧠 MAIN ORCHESTRATOR
 * Il cervello del sistema multi-agente
 * Coordina tutti gli agenti e gestisce i task complessi
 */

import Anthropic from '@anthropic-ai/sdk';
import { AutoDiscovery } from './auto-discovery';
import { AgentFactory } from './agent-factory';
import { SpecializedAgent } from '../specialized/specialized-agent';
import {
  AgentTask,
  TaskResult,
  OrchestratorState,
  AgentDefinition,
  AppContext,
  TaskType,
  TaskPriority,
  Coordination
} from '../types/agent-types';

export class Orchestrator {
  private state: OrchestratorState;
  private autoDiscovery: AutoDiscovery;
  private agentFactory: AgentFactory;
  private anthropic: Anthropic;
  private initialized: boolean = false;

  constructor() {
    this.state = {
      activeAgents: new Map(),
      taskQueue: [],
      activeTasks: new Map(),
      completedTasks: [],
      routing: {
        rules: [],
        history: []
      },
      coordination: {
        activeCoordinations: [],
        completedCoordinations: []
      }
    };

    this.autoDiscovery = new AutoDiscovery('app-hub-platform/app');
    this.agentFactory = new AgentFactory();
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
  }

  /**
   * Inizializza l'orchestratore
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️  Orchestrator already initialized');
      return;
    }

    console.log('🚀 Initializing Orchestrator...');

    try {
      // 1. Discover all apps
      console.log('📡 Discovering apps...');
      const apps = await this.autoDiscovery.discoverAllApps();
      console.log(`✅ Found ${apps.length} apps`);

      // 2. Create agents for all apps
      console.log('🏭 Creating specialized agents...');
      const agents = await this.agentFactory.createAgentsForApps(apps);
      console.log(`✅ Created ${agents.size} agents`);

      // 3. Register agents in state
      for (const [appName, agent] of agents.entries()) {
        const definition = agent.getInfo();
        this.state.activeAgents.set(definition.id, definition);
      }

      // 4. Setup routing rules
      this.setupRoutingRules();

      this.initialized = true;
      console.log('🎉 Orchestrator initialized successfully!');
      console.log(`📊 Status: ${this.state.activeAgents.size} agents ready`);
    } catch (error) {
      console.error('❌ Failed to initialize orchestrator:', error);
      throw error;
    }
  }

  /**
   * Processa una richiesta dall'utente
   */
  async processUserRequest(userMessage: string): Promise<TaskResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`\n🎯 Processing user request: "${userMessage.substring(0, 100)}..."`);

    try {
      // 1. Analyze request with Claude
      const analysis = await this.analyzeRequest(userMessage);

      console.log(`📊 Analysis:`, {
        taskType: analysis.taskType,
        priority: analysis.priority,
        targetApps: analysis.targetApps
      });

      // 2. Create task
      const task = this.createTask(userMessage, analysis);

      // 3. Route to appropriate agent(s)
      if (analysis.targetApps.length === 1) {
        // Single app task - route to specialized agent
        return await this.executeSingleAgentTask(task, analysis.targetApps[0]);
      } else if (analysis.targetApps.length > 1) {
        // Multi-app task - coordinate multiple agents
        return await this.executeMultiAgentTask(task, analysis.targetApps);
      } else {
        // General task - orchestrator handles it
        return await this.executeGeneralTask(task);
      }
    } catch (error) {
      console.error('❌ Request processing failed:', error);

      return {
        success: false,
        message: `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            message: String(error)
          }
        ]
      };
    }
  }

  /**
   * Analizza la richiesta per determinare tipo, priorità e app coinvolte
   */
  private async analyzeRequest(userMessage: string): Promise<RequestAnalysis> {
    const appContexts = Array.from(this.state.activeAgents.values())
      .map(a => a.appContext)
      .filter(c => c !== undefined) as AppContext[];

    const systemPrompt = `You are an orchestrator AI analyzing user requests for a multi-app system.

Available Apps:
${appContexts.map(app => `- ${app.appName} (${app.category}): ${app.description}`).join('\n')}

Your task: Analyze the user's request and determine:
1. Task type (bug_fix, feature_add, refactor, documentation, testing, analysis, optimization, deployment)
2. Priority (low, medium, high, critical)
3. Which app(s) are involved (list app names, or "general" if not app-specific)
4. A brief description of what needs to be done

Respond in JSON format:
{
  "taskType": "...",
  "priority": "...",
  "targetApps": ["app1", "app2"],
  "description": "..."
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      taskType: analysis.taskType as TaskType,
      priority: analysis.priority as TaskPriority,
      targetApps: analysis.targetApps || [],
      description: analysis.description || userMessage
    };
  }

  /**
   * Crea un task dalla richiesta
   */
  private createTask(userMessage: string, analysis: RequestAnalysis): AgentTask {
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: analysis.taskType,
      priority: analysis.priority,
      status: 'pending',
      request: {
        userMessage,
        context: {
          analysis
        }
      },
      createdBy: 'user',
      metadata: {
        retryCount: 0,
        maxRetries: 3,
        tags: analysis.targetApps
      }
    };

    // Add to queue
    this.state.taskQueue.push(task);

    return task;
  }

  /**
   * Esegue un task con un singolo agente
   */
  private async executeSingleAgentTask(task: AgentTask, appName: string): Promise<TaskResult> {
    console.log(`🎯 Executing single-agent task for: ${appName}`);

    // Find agent
    const agent = this.agentFactory.getAgent(appName);

    if (!agent) {
      return {
        success: false,
        message: `Agent for app "${appName}" not found`,
        logs: []
      };
    }

    // Update task status
    task.status = 'in_progress';
    task.assignedTo = agent.getInfo().id;
    task.startTime = new Date();
    this.state.activeTasks.set(task.id, task);

    // Execute
    const result = await agent.executeTask(task);

    // Update task
    task.status = result.success ? 'completed' : 'failed';
    task.endTime = new Date();
    task.duration = task.endTime.getTime() - task.startTime.getTime();
    task.result = result;

    // Move to completed
    this.state.activeTasks.delete(task.id);
    this.state.completedTasks.push(task);

    console.log(`${result.success ? '✅' : '❌'} Task ${result.success ? 'completed' : 'failed'} in ${task.duration}ms`);

    return result;
  }

  /**
   * Esegue un task che coinvolge più agenti
   */
  private async executeMultiAgentTask(task: AgentTask, appNames: string[]): Promise<TaskResult> {
    console.log(`🤝 Executing multi-agent task for: ${appNames.join(', ')}`);

    // Create coordination
    const coordination: Coordination = {
      id: `coord-${Date.now()}`,
      taskId: task.id,
      involvedAgents: appNames,
      status: 'planning',
      plan: {
        steps: [],
        dependencies: new Map()
      },
      results: new Map()
    };

    this.state.coordination.activeCoordinations.push(coordination);

    try {
      // 1. Plan coordination
      coordination.status = 'planning';
      await this.planCoordination(task, appNames, coordination);

      // 2. Execute coordination
      coordination.status = 'executing';
      const results = await this.executeCoordination(coordination);

      // 3. Merge results
      const mergedResult = this.mergeResults(results);

      coordination.status = 'completed';
      this.state.coordination.completedCoordinations.push(coordination);

      console.log(`✅ Multi-agent task completed successfully`);

      return mergedResult;
    } catch (error) {
      coordination.status = 'failed';

      console.error(`❌ Multi-agent task failed:`, error);

      return {
        success: false,
        message: `Multi-agent coordination failed: ${error}`,
        logs: []
      };
    }
  }

  /**
   * Pianifica la coordinazione tra agenti
   */
  private async planCoordination(
    task: AgentTask,
    appNames: string[],
    coordination: Coordination
  ): Promise<void> {
    console.log(`📋 Planning coordination for ${appNames.length} agents...`);

    // For now, simple sequential execution
    // TODO: Implement more sophisticated planning with dependencies

    appNames.forEach((appName, index) => {
      coordination.plan.steps.push({
        id: `step-${index}`,
        agentId: appName,
        description: `Execute task for ${appName}`,
        status: 'pending',
        order: index
      });
    });

    console.log(`✅ Coordination plan created with ${coordination.plan.steps.length} steps`);
  }

  /**
   * Esegue la coordinazione
   */
  private async executeCoordination(coordination: Coordination): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const step of coordination.plan.steps) {
      console.log(`🔄 Executing step: ${step.description}`);

      step.status = 'in_progress';

      const agent = this.agentFactory.getAgent(step.agentId);

      if (!agent) {
        step.status = 'failed';
        continue;
      }

      // Find main task
      const mainTask = this.state.taskQueue.find(t => t.id === coordination.taskId);
      if (!mainTask) continue;

      // Execute
      const result = await agent.executeTask(mainTask);

      results.push(result);
      coordination.results.set(step.id, result);

      step.status = result.success ? 'completed' : 'failed';

      console.log(`${result.success ? '✅' : '❌'} Step ${result.success ? 'completed' : 'failed'}`);
    }

    return results;
  }

  /**
   * Merge dei risultati da più agenti
   */
  private mergeResults(results: TaskResult[]): TaskResult {
    const allChanges = results.flatMap(r => r.changes || []);
    const allLogs = results.flatMap(r => r.logs);
    const allArtifacts = results.flatMap(r => r.artifacts || []);

    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      message: allSuccess ?
        'All agents completed their tasks successfully' :
        'Some agents failed to complete their tasks',
      changes: allChanges,
      artifacts: allArtifacts,
      logs: allLogs,
      metrics: {
        linesAdded: allChanges.filter(c => c.type === 'created').length,
        linesRemoved: allChanges.filter(c => c.type === 'deleted').length,
        filesModified: allChanges.length
      }
    };
  }

  /**
   * Esegue un task generale (non app-specific)
   */
  private async executeGeneralTask(task: AgentTask): Promise<TaskResult> {
    console.log(`🔧 Executing general task...`);

    // Orchestrator handles general tasks directly
    return {
      success: true,
      message: 'General task completed. For app-specific tasks, please mention the app name.',
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          message: 'General task executed by orchestrator'
        }
      ]
    };
  }

  /**
   * Setup delle regole di routing
   */
  private setupRoutingRules(): void {
    // TODO: Implement sophisticated routing rules
    console.log('⚙️  Setting up routing rules...');
  }

  /**
   * Ottiene lo stato corrente
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Ottiene gli agenti attivi
   */
  getActiveAgents(): AgentDefinition[] {
    return Array.from(this.state.activeAgents.values());
  }

  /**
   * Ottiene statistiche
   */
  getStats() {
    return {
      totalAgents: this.state.activeAgents.size,
      activeTasks: this.state.activeTasks.size,
      completedTasks: this.state.completedTasks.length,
      queuedTasks: this.state.taskQueue.length,
      activeCoordinations: this.state.coordination.activeCoordinations.length,
      factoryStats: this.agentFactory.getStats()
    };
  }

  /**
   * Forza re-discovery delle app
   */
  async rediscoverApps(): Promise<void> {
    console.log('🔄 Re-discovering apps...');

    const apps = await this.autoDiscovery.discoverAllApps();

    // Update agents
    for (const app of apps) {
      const existingAgent = this.agentFactory.getAgent(app.appName);

      if (existingAgent) {
        // Update existing agent
        await this.agentFactory.updateAgent(app.appName, app);
      } else {
        // Create new agent
        const newAgent = await this.agentFactory.createAgentForApp(app);
        const definition = newAgent.getInfo();
        this.state.activeAgents.set(definition.id, definition);
      }
    }

    console.log(`✅ Re-discovery complete! ${apps.length} apps found`);
  }
}

// ============= TYPES =============

interface RequestAnalysis {
  taskType: TaskType;
  priority: TaskPriority;
  targetApps: string[];
  description: string;
}
