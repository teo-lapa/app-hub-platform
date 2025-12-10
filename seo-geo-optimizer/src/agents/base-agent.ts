/**
 * Base Agent
 * Classe base per tutti gli agenti AI
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../utils/config.js';

export interface AgentContext {
  task: string;
  data: Record<string, any>;
  history: AgentMessage[];
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentResult {
  success: boolean;
  output: any;
  reasoning?: string;
  suggestedActions?: string[];
  metadata?: Record<string, any>;
}

export abstract class BaseAgent {
  protected claude: Anthropic;
  protected model: string = 'claude-sonnet-4-20250514';
  protected maxTokens: number = 4096;
  protected name: string;
  protected systemPrompt: string;

  constructor(name: string, systemPrompt: string) {
    this.claude = new Anthropic({
      apiKey: config.get('ANTHROPIC_API_KEY'),
    });
    this.name = name;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Esegue il task principale dell'agente
   */
  abstract execute(context: AgentContext): Promise<AgentResult>;

  /**
   * Chiama Claude con un prompt
   */
  protected async callClaude(
    messages: { role: 'user' | 'assistant'; content: string }[],
    options: {
      maxTokens?: number;
      temperature?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<string> {
    const { maxTokens = this.maxTokens, temperature = 0.7 } = options;

    const response = await this.claude.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system: this.systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  /**
   * Analizza contenuto e restituisce JSON strutturato
   */
  protected async analyzeWithJSON<T>(
    prompt: string,
    schema: string
  ): Promise<T> {
    const fullPrompt = `${prompt}

Rispondi SOLO con un JSON valido che segue questo schema:
${schema}

JSON:`;

    const response = await this.callClaude([{ role: 'user', content: fullPrompt }], {
      temperature: 0.3,
    });

    // Estrai JSON dalla risposta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Risposta non contiene JSON valido');
    }

    return JSON.parse(jsonMatch[0]) as T;
  }

  /**
   * Log delle operazioni
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}]`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ERROR: ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} WARN: ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Nome dell'agente
   */
  getName(): string {
    return this.name;
  }
}
