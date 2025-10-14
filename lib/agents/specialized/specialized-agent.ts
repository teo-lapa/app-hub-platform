/**
 * 🎯 SPECIALIZED AGENT
 * Agente specializzato per una specifica app
 * Estende BaseAgent con funzionalità app-specific
 */

import { BaseAgent } from '../core/base-agent';
import { AgentDefinition, AgentTask, TaskResult } from '../types/agent-types';
import { AgentTools } from '../tools/agent-tools';

export class SpecializedAgent extends BaseAgent {
  private agentTools: AgentTools;

  constructor(definition: AgentDefinition) {
    super(definition);

    // Initialize tools
    this.agentTools = new AgentTools();

    // Register all available tools
    this.registerAllTools();
  }

  /**
   * Esegue un task con conoscenza specializzata dell'app
   */
  async executeTask(task: AgentTask): Promise<TaskResult> {
    console.log(`🎯 ${this.definition.name} executing task: ${task.type}`);

    // Add app-specific context to task
    if (this.definition.appContext) {
      task.request.context = {
        ...task.request.context,
        appContext: this.definition.appContext
      };
    }

    // Execute with base agent
    return super.executeTask(task);
  }

  /**
   * Registra tutti i tool disponibili
   */
  private registerAllTools(): void {
    // File operations
    this.registerTool({
      name: 'read_file',
      description: 'Read the contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to read'
          }
        },
        required: ['file_path']
      },
      handler: async (input: any) => {
        return this.agentTools.readFile(input.file_path);
      }
    });

    this.registerTool({
      name: 'write_file',
      description: 'Write content to a file (creates or overwrites)',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to write'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          }
        },
        required: ['file_path', 'content']
      },
      handler: async (input: any) => {
        return this.agentTools.writeFile(input.file_path, input.content);
      }
    });

    this.registerTool({
      name: 'modify_file',
      description: 'Modify specific parts of a file',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to modify'
          },
          old_content: {
            type: 'string',
            description: 'The exact content to replace'
          },
          new_content: {
            type: 'string',
            description: 'The new content to insert'
          }
        },
        required: ['file_path', 'old_content', 'new_content']
      },
      handler: async (input: any) => {
        return this.agentTools.modifyFile(
          input.file_path,
          input.old_content,
          input.new_content
        );
      }
    });

    // Code analysis
    this.registerTool({
      name: 'search_code',
      description: 'Search for code patterns in files',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Regex pattern to search for'
          },
          file_path: {
            type: 'string',
            description: 'Optional: specific file to search in'
          }
        },
        required: ['pattern']
      },
      handler: async (input: any) => {
        return this.agentTools.searchCode(input.pattern, input.file_path);
      }
    });

    this.registerTool({
      name: 'analyze_structure',
      description: 'Analyze code structure and get insights',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to analyze'
          }
        },
        required: ['file_path']
      },
      handler: async (input: any) => {
        return this.agentTools.analyzeStructure(input.file_path);
      }
    });

    this.registerTool({
      name: 'list_files',
      description: 'List files in the app directory',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to list (relative to app root)'
          },
          pattern: {
            type: 'string',
            description: 'Optional: glob pattern to filter files'
          }
        },
        required: ['directory']
      },
      handler: async (input: any) => {
        return this.agentTools.listFiles(input.directory, input.pattern);
      }
    });

    // App-specific tools based on category
    if (this.definition.appContext) {
      this.registerCategorySpecificTools(this.definition.appContext.category);
    }
  }

  /**
   * Registra tool specifici per categoria
   */
  private registerCategorySpecificTools(category: string): void {
    switch (category) {
      case 'magazzino':
        this.registerWarehouseTools();
        break;
      case 'vendite':
        this.registerSalesTools();
        break;
      case 'delivery':
        this.registerDeliveryTools();
        break;
    }
  }

  /**
   * Tool specifici per magazzino
   */
  private registerWarehouseTools(): void {
    this.registerTool({
      name: 'check_inventory',
      description: 'Check inventory levels in Odoo',
      inputSchema: {
        type: 'object',
        properties: {
          product_id: {
            type: 'number',
            description: 'Product ID to check'
          },
          location_id: {
            type: 'number',
            description: 'Optional: specific location'
          }
        },
        required: ['product_id']
      },
      handler: async (input: any) => {
        // TODO: Implement Odoo integration
        return { message: 'Odoo integration not yet implemented' };
      }
    });
  }

  /**
   * Tool specifici per vendite
   */
  private registerSalesTools(): void {
    this.registerTool({
      name: 'calculate_price',
      description: 'Calculate price with discounts and taxes',
      inputSchema: {
        type: 'object',
        properties: {
          base_price: {
            type: 'number',
            description: 'Base price'
          },
          quantity: {
            type: 'number',
            description: 'Quantity'
          },
          discount: {
            type: 'number',
            description: 'Discount percentage'
          }
        },
        required: ['base_price', 'quantity']
      },
      handler: async (input: any) => {
        const discount = input.discount || 0;
        const subtotal = input.base_price * input.quantity;
        const discountAmount = subtotal * (discount / 100);
        const total = subtotal - discountAmount;

        return {
          subtotal,
          discount: discountAmount,
          total
        };
      }
    });
  }

  /**
   * Tool specifici per delivery
   */
  private registerDeliveryTools(): void {
    this.registerTool({
      name: 'calculate_route',
      description: 'Calculate optimal delivery route',
      inputSchema: {
        type: 'object',
        properties: {
          destinations: {
            type: 'array',
            items: { type: 'object' },
            description: 'List of delivery destinations'
          }
        },
        required: ['destinations']
      },
      handler: async (input: any) => {
        // TODO: Implement route calculation
        return { message: 'Route calculation not yet implemented' };
      }
    });
  }

  /**
   * Override buildSystemPrompt per aggiungere conoscenza specializzata
   */
  protected buildSystemPrompt(task: AgentTask): string {
    let prompt = super.buildSystemPrompt(task);

    // Add app-specific knowledge
    if (this.definition.appContext) {
      prompt += this.buildAppSpecificKnowledge();
    }

    return prompt;
  }

  /**
   * Costruisce la conoscenza specifica dell'app
   */
  private buildAppSpecificKnowledge(): string {
    const ctx = this.definition.appContext!;

    let knowledge = `\n\n=== APP-SPECIFIC KNOWLEDGE ===\n\n`;

    // File structure
    knowledge += `Key Files:\n`;
    if (ctx.structure.pages.length > 0) {
      knowledge += `- Main Page: ${ctx.structure.pages[0]}\n`;
    }
    if (ctx.structure.apiRoutes.length > 0) {
      knowledge += `- API Routes: ${ctx.structure.apiRoutes.slice(0, 5).join(', ')}\n`;
    }

    // Common patterns
    knowledge += `\nCode Patterns to Follow:\n`;
    if (ctx.patterns.stateManagement) {
      knowledge += `- Use ${ctx.patterns.stateManagement} for state management\n`;
    }
    if (ctx.patterns.dataFetching) {
      knowledge += `- Use ${ctx.patterns.dataFetching} for data fetching\n`;
    }
    if (ctx.patterns.styling) {
      knowledge += `- Use ${ctx.patterns.styling} for styling\n`;
    }

    // Odoo models
    if (ctx.dependencies.odoo.length > 0) {
      knowledge += `\nOdoo Models in Use:\n`;
      ctx.dependencies.odoo.forEach(model => {
        knowledge += `- ${model}\n`;
      });
    }

    return knowledge;
  }

  /**
   * Analizza una richiesta e suggerisce file da modificare
   */
  async analyzeRequest(userRequest: string): Promise<string[]> {
    const ctx = this.definition.appContext;
    if (!ctx) return [];

    const suggestedFiles: string[] = [];

    // Analizza la richiesta per keywords
    const request = userRequest.toLowerCase();

    // Se parla di UI/frontend
    if (request.includes('ui') || request.includes('interfaccia') ||
        request.includes('button') || request.includes('form')) {
      suggestedFiles.push(...ctx.structure.pages);
      suggestedFiles.push(...ctx.structure.components.slice(0, 5));
    }

    // Se parla di API/backend
    if (request.includes('api') || request.includes('backend') ||
        request.includes('fetch') || request.includes('data')) {
      suggestedFiles.push(...ctx.structure.apiRoutes);
    }

    // Se parla di types
    if (request.includes('type') || request.includes('interface') ||
        request.includes('typescript')) {
      suggestedFiles.push(...ctx.structure.types);
    }

    return Array.from(new Set(suggestedFiles));  // Remove duplicates
  }
}
