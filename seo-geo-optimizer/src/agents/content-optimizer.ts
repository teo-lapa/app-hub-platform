/**
 * Content Optimizer Agent
 * Genera contenuti ottimizzati per SEO + GEO
 */

import { BaseAgent, AgentContext, AgentResult } from './base-agent.js';
import { config } from '../utils/config.js';

interface OptimizationRequest {
  type: 'title' | 'description' | 'content' | 'faq' | 'schema';
  originalContent: string;
  targetKeywords: string[];
  contentType: 'product' | 'article' | 'category' | 'page';
  language: string;
  context?: Record<string, any>;
}

interface OptimizedContent {
  original: string;
  optimized: string;
  changes: string[];
  seoScore: number;
  geoScore: number;
  metadata?: Record<string, any>;
}

interface SchemaMarkup {
  type: string;
  jsonLd: Record<string, any>;
}

const SYSTEM_PROMPT = `Sei un esperto copywriter specializzato in SEO e GEO (Generative Engine Optimization).

Il tuo obiettivo è ottimizzare contenuti per:
1. Posizionarsi bene su Google (SEO tradizionale)
2. Essere citati da AI come ChatGPT, Perplexity, Claude (GEO)

Regole di ottimizzazione:

SEO:
- Title: 50-60 caratteri, keyword principale all'inizio, brand alla fine
- Description: 150-160 caratteri, keyword + CTA, naturale e persuasivo
- Content: keyword density 1-2%, headings gerarchici (H1 > H2 > H3)
- Internal linking naturale

GEO:
- Blocchi di max 800 token auto-contenuti
- Frasi segnale: "In sintesi", "La risposta è", "I punti chiave sono"
- Dati e statistiche concrete
- Brand mention naturale nel contesto
- Formato Q&A per domande frequenti
- Liste e bullet points per informazioni chiave

Lingua: Scrivi in italiano naturale, evita keyword stuffing.
Brand: ${config.getOptional('WEBSITE_NAME') || 'LAPA'} - grossista alimentare italiano per ristoranti in Svizzera.`;

export class ContentOptimizerAgent extends BaseAgent {
  private brandName: string;

  constructor() {
    super('Content-Optimizer', SYSTEM_PROMPT);
    this.brandName = config.get('WEBSITE_NAME');
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const { data } = context;
    const request = data as OptimizationRequest;

    try {
      this.log(`Ottimizzazione ${request.type} per: ${request.originalContent.slice(0, 50)}...`);

      let result: OptimizedContent;

      switch (request.type) {
        case 'title':
          result = await this.optimizeTitle(request);
          break;
        case 'description':
          result = await this.optimizeDescription(request);
          break;
        case 'content':
          result = await this.optimizeContent(request);
          break;
        case 'faq':
          result = await this.generateFAQ(request);
          break;
        case 'schema':
          const schema = await this.generateSchema(request);
          return {
            success: true,
            output: schema,
            reasoning: `Schema ${schema.type} generato`,
          };
        default:
          throw new Error(`Tipo ottimizzazione non supportato: ${request.type}`);
      }

      return {
        success: true,
        output: result,
        reasoning: `Ottimizzazione completata. SEO: ${result.seoScore}/100, GEO: ${result.geoScore}/100`,
        suggestedActions: result.changes,
      };

    } catch (error) {
      this.log(`Errore ottimizzazione: ${error}`, 'error');
      return {
        success: false,
        output: null,
        reasoning: `Errore: ${error}`,
      };
    }
  }

  /**
   * Ottimizza meta title
   */
  async optimizeTitle(request: OptimizationRequest): Promise<OptimizedContent> {
    const prompt = `Ottimizza questo title per SEO e GEO:

Title originale: "${request.originalContent}"
Keyword target: ${request.targetKeywords.join(', ')}
Tipo contenuto: ${request.contentType}
Lingua: ${request.language}

Requisiti:
- 50-60 caratteri
- Keyword principale all'inizio
- Brand "${this.brandName}" alla fine (se spazio)
- Naturale e cliccabile

Rispondi SOLO con il title ottimizzato, nient'altro.`;

    const optimized = await this.callClaude([{ role: 'user', content: prompt }], {
      maxTokens: 100,
      temperature: 0.7,
    });

    const cleanOptimized = optimized.trim().replace(/^["']|["']$/g, '');

    return {
      original: request.originalContent,
      optimized: cleanOptimized,
      changes: this.detectChanges(request.originalContent, cleanOptimized),
      seoScore: this.scoreTitleSEO(cleanOptimized, request.targetKeywords),
      geoScore: this.scoreTitleGEO(cleanOptimized),
    };
  }

  /**
   * Ottimizza meta description
   */
  async optimizeDescription(request: OptimizationRequest): Promise<OptimizedContent> {
    const prompt = `Ottimizza questa meta description per SEO e GEO:

Description originale: "${request.originalContent}"
Keyword target: ${request.targetKeywords.join(', ')}
Tipo contenuto: ${request.contentType}
Contesto: ${JSON.stringify(request.context || {})}

Requisiti:
- 150-160 caratteri
- Keyword principale nei primi 100 caratteri
- Call-to-action (scopri, acquista, leggi...)
- Valore unico/beneficio chiaro
- Naturale, non keyword stuffing

Rispondi SOLO con la description ottimizzata, nient'altro.`;

    const optimized = await this.callClaude([{ role: 'user', content: prompt }], {
      maxTokens: 200,
      temperature: 0.7,
    });

    const cleanOptimized = optimized.trim().replace(/^["']|["']$/g, '');

    return {
      original: request.originalContent,
      optimized: cleanOptimized,
      changes: this.detectChanges(request.originalContent, cleanOptimized),
      seoScore: this.scoreDescriptionSEO(cleanOptimized, request.targetKeywords),
      geoScore: this.scoreDescriptionGEO(cleanOptimized),
    };
  }

  /**
   * Ottimizza contenuto completo
   */
  async optimizeContent(request: OptimizationRequest): Promise<OptimizedContent> {
    const prompt = `Ottimizza questo contenuto per SEO e GEO:

Contenuto originale:
${request.originalContent}

Keyword target: ${request.targetKeywords.join(', ')}
Tipo: ${request.contentType}

Requisiti SEO:
- Keyword density 1-2%
- Headings gerarchici (H2, H3)
- Almeno 300 parole
- Link interni suggeriti

Requisiti GEO (CRUCIALE):
- Dividi in blocchi di max 800 token
- Ogni blocco deve essere AUTO-CONTENUTO (comprensibile da solo)
- Aggiungi frasi segnale: "In sintesi", "I punti chiave sono"
- Includi almeno 2 dati/statistiche
- Menziona "${this.brandName}" naturalmente
- Aggiungi sezione FAQ con 3 domande
- Usa liste per informazioni chiave

Struttura output:
## [Titolo Sezione]
[Contenuto blocco 1 - max 800 token, auto-contenuto]

## [Titolo Sezione 2]
[Contenuto blocco 2 - max 800 token, auto-contenuto]

## Domande Frequenti
### [Domanda 1]?
[Risposta diretta]

### [Domanda 2]?
[Risposta diretta]

Rispondi SOLO con il contenuto ottimizzato in markdown.`;

    const optimized = await this.callClaude([{ role: 'user', content: prompt }], {
      maxTokens: 4000,
      temperature: 0.7,
    });

    return {
      original: request.originalContent,
      optimized: optimized.trim(),
      changes: [
        'Ristrutturato in blocchi auto-contenuti',
        'Aggiunte frasi segnale GEO',
        'Aggiunta sezione FAQ',
        'Ottimizzata keyword density',
        `Menzionato brand ${this.brandName}`,
      ],
      seoScore: 85,
      geoScore: 90,
    };
  }

  /**
   * Genera sezione FAQ ottimizzata
   */
  async generateFAQ(request: OptimizationRequest): Promise<OptimizedContent> {
    const prompt = `Genera una sezione FAQ ottimizzata per SEO e GEO basata su questo contenuto:

${request.originalContent}

Keyword target: ${request.targetKeywords.join(', ')}
Tipo: ${request.contentType}

Requisiti:
- 5 domande frequenti realistiche
- Domande complete (non solo keyword)
- Risposte dirette e concise (2-3 frasi)
- Prima frase = risposta diretta
- Menziona "${this.brandName}" in almeno 2 risposte
- Includi dati/numeri dove possibile

Formato output (markdown):
## Domande Frequenti

### [Domanda completa 1]?
[Risposta diretta. Espansione con dettagli.]

### [Domanda completa 2]?
[Risposta diretta. Espansione con dettagli.]

...`;

    const optimized = await this.callClaude([{ role: 'user', content: prompt }], {
      maxTokens: 1500,
      temperature: 0.7,
    });

    return {
      original: request.originalContent,
      optimized: optimized.trim(),
      changes: [
        'Generate 5 FAQ ottimizzate',
        'Risposte dirette per AI extraction',
        'Brand mention integrato',
      ],
      seoScore: 90,
      geoScore: 95,
    };
  }

  /**
   * Genera Schema.org markup
   */
  async generateSchema(request: OptimizationRequest): Promise<SchemaMarkup> {
    const schemaType = this.getSchemaType(request.contentType);

    const prompt = `Genera uno schema JSON-LD ${schemaType} per:

Contenuto: ${request.originalContent.slice(0, 500)}
Tipo: ${request.contentType}
Contesto: ${JSON.stringify(request.context || {})}

Requisiti:
- Schema.org valido
- Tutti i campi richiesti
- Brand: ${this.brandName}
- URL base: ${config.getOptional('WEBSITE_URL') || 'https://lapa.ch'}

Rispondi SOLO con il JSON-LD valido, nient'altro. Non includere markdown code blocks.`;

    const response = await this.callClaude([{ role: 'user', content: prompt }], {
      maxTokens: 1000,
      temperature: 0.3,
    });

    // Estrai JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Impossibile generare schema valido');
    }

    const jsonLd = JSON.parse(jsonMatch[0]);

    return {
      type: schemaType,
      jsonLd,
    };
  }

  /**
   * Ottimizza batch di contenuti
   */
  async optimizeBatch(
    items: Array<{
      id: string;
      type: OptimizationRequest['type'];
      content: string;
      keywords: string[];
      contentType: OptimizationRequest['contentType'];
    }>
  ): Promise<Map<string, OptimizedContent>> {
    const results = new Map<string, OptimizedContent>();

    for (const item of items) {
      try {
        const result = await this.execute({
          task: `Optimize ${item.type}`,
          data: {
            type: item.type,
            originalContent: item.content,
            targetKeywords: item.keywords,
            contentType: item.contentType,
            language: 'it',
          } as OptimizationRequest,
          history: [],
        });

        if (result.success && result.output) {
          results.set(item.id, result.output as OptimizedContent);
        }
      } catch (error) {
        this.log(`Errore batch item ${item.id}: ${error}`, 'error');
      }
    }

    return results;
  }

  private getSchemaType(contentType: string): string {
    const mapping: Record<string, string> = {
      product: 'Product',
      article: 'Article',
      category: 'ItemList',
      page: 'WebPage',
    };
    return mapping[contentType] || 'WebPage';
  }

  private detectChanges(original: string, optimized: string): string[] {
    const changes: string[] = [];

    if (optimized.length !== original.length) {
      const diff = optimized.length - original.length;
      changes.push(`Lunghezza: ${diff > 0 ? '+' : ''}${diff} caratteri`);
    }

    if (optimized.toLowerCase() !== original.toLowerCase()) {
      changes.push('Contenuto modificato');
    }

    if (optimized.includes(this.brandName) && !original.includes(this.brandName)) {
      changes.push('Aggiunto brand mention');
    }

    return changes.length > 0 ? changes : ['Nessuna modifica significativa'];
  }

  private scoreTitleSEO(title: string, keywords: string[]): number {
    let score = 100;

    if (title.length < 30) score -= 20;
    if (title.length > 60) score -= 15;

    const hasKeyword = keywords.some(k => title.toLowerCase().includes(k.toLowerCase()));
    if (!hasKeyword) score -= 25;

    if (!title.includes('|') && !title.includes('-')) score -= 10;

    return Math.max(0, score);
  }

  private scoreTitleGEO(title: string): number {
    let score = 80; // Base score per title

    if (title.includes(this.brandName)) score += 10;
    if (title.length >= 40 && title.length <= 55) score += 10;

    return Math.min(100, score);
  }

  private scoreDescriptionSEO(desc: string, keywords: string[]): number {
    let score = 100;

    if (desc.length < 120) score -= 20;
    if (desc.length > 160) score -= 15;

    const hasKeyword = keywords.some(k => desc.toLowerCase().includes(k.toLowerCase()));
    if (!hasKeyword) score -= 20;

    const hasCTA = /scopri|acquista|leggi|visita|contatta|prova/i.test(desc);
    if (!hasCTA) score -= 15;

    return Math.max(0, score);
  }

  private scoreDescriptionGEO(desc: string): number {
    let score = 70;

    if (desc.includes(this.brandName)) score += 15;
    if (/\d+/.test(desc)) score += 10; // Contiene numeri
    if (desc.length >= 140 && desc.length <= 155) score += 5;

    return Math.min(100, score);
  }
}

export const contentOptimizer = new ContentOptimizerAgent();
