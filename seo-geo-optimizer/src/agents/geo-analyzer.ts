/**
 * GEO Analyzer Agent
 * Analizza contenuti per ottimizzazione Generative Engine (AI/LLM)
 */

import { BaseAgent, AgentContext, AgentResult } from './base-agent.js';
import { contentProcessor } from '../rag/content-processor.js';
import { GEO_RULES, GEO_SCORE_THRESHOLDS, GEO_CHECKLIST } from '../../config/geo-rules.js';
import { config } from '../utils/config.js';

interface GEOAnalysis {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readiness: 'AI-Ready' | 'Needs Work' | 'Not Optimized';
  issues: GEOIssue[];
  suggestions: string[];
  metrics: {
    contentStructure: ContentStructureAnalysis;
    authority: AuthorityAnalysis;
    formatting: FormattingAnalysis;
    questionOptimization: QuestionAnalysis;
    citability: CitabilityAnalysis;
  };
  checklist: ChecklistItem[];
  aiSimulation: AISimulationResult;
}

interface GEOIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  impact: string;
  fix?: string;
}

interface ContentStructureAnalysis {
  totalBlocks: number;
  avgBlockTokens: number;
  maxBlockTokens: number;
  standaloneBlocks: number;
  standalonePercentage: number;
  score: number;
  issues: string[];
}

interface AuthorityAnalysis {
  hasStatistics: boolean;
  hasCitations: boolean;
  hasExpertQuotes: boolean;
  hasBrandMention: boolean;
  trustSignalsCount: number;
  score: number;
  issues: string[];
}

interface FormattingAnalysis {
  hasLists: boolean;
  hasTables: boolean;
  hasQAFormat: boolean;
  signalPhrasesCount: number;
  readabilityScore: number;
  score: number;
  issues: string[];
}

interface QuestionAnalysis {
  questionsAnswered: number;
  hasFAQStructure: boolean;
  directAnswers: number;
  score: number;
  issues: string[];
}

interface CitabilityAnalysis {
  quotablePassages: number;
  uniqueInsights: number;
  definitionCount: number;
  score: number;
  issues: string[];
}

interface ChecklistItem {
  id: string;
  question: string;
  passed: boolean;
  weight: number;
}

interface AISimulationResult {
  wouldBeCited: boolean;
  confidence: number;
  reasoning: string;
  suggestedQueries: string[];
}

const SYSTEM_PROMPT = `Sei un esperto di GEO (Generative Engine Optimization) e comprendi profondamente come i Large Language Models selezionano e citano le fonti.

Il tuo obiettivo è analizzare contenuti web per determinare se sono ottimizzati per essere citati da AI come ChatGPT, Perplexity, Claude e Google AI Overviews.

Principi chiave che conosci:
1. I modelli AI estraggono informazioni a livello di PARAGRAFO, non di pagina
2. Ogni blocco di contenuto deve essere AUTO-CONTENUTO e comprensibile da solo
3. I trust signals sono i nuovi backlinks: citazioni, statistiche, expertise
4. L'AI premia contenuti AUTOREVOLI, non solo ottimizzati tecnicamente
5. Il brand deve essere menzionato NATURALMENTE nel contesto delle risposte
6. Formati strutturati (liste, tabelle, Q&A) facilitano l'estrazione AI
7. Frasi segnale ("In sintesi", "La risposta è") aiutano l'AI a identificare le risposte chiave

Analizza il contenuto con questi criteri e fornisci feedback azionabile per renderlo "AI-citabile".`;

export class GEOAnalyzerAgent extends BaseAgent {
  private brandName: string;
  private maxTokensPerBlock: number;

  constructor() {
    super('GEO-Analyzer', SYSTEM_PROMPT);
    this.brandName = config.get('WEBSITE_NAME');
    this.maxTokensPerBlock = config.get('MAX_TOKENS_PER_BLOCK');
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const { data } = context;

    try {
      this.log(`Analisi GEO per: ${data.title || data.name || 'Contenuto'}`);

      // Processa il contenuto
      const processed = contentProcessor.processHTML(data.content || data.body || '');
      const geoMetrics = contentProcessor.calculateGEOMetrics(processed);

      // Analisi componenti
      const contentStructure = this.analyzeContentStructure(processed);
      const authority = this.analyzeAuthority(processed, data);
      const formatting = this.analyzeFormatting(processed, geoMetrics);
      const questionOptimization = this.analyzeQuestionOptimization(processed, data);
      const citability = await this.analyzeCitability(processed, data);

      // Checklist
      const checklist = this.evaluateChecklist(processed, geoMetrics, data);

      // Raccogli problemi
      const issues: GEOIssue[] = [
        ...this.structureToIssues(contentStructure),
        ...this.authorityToIssues(authority),
        ...this.formattingToIssues(formatting),
        ...this.questionToIssues(questionOptimization),
        ...this.citabilityToIssues(citability),
      ];

      // Calcola score totale
      const totalScore = this.calculateTotalScore({
        contentStructure: contentStructure.score,
        authority: authority.score,
        formatting: formatting.score,
        questionOptimization: questionOptimization.score,
        citability: citability.score,
      });

      // Simulazione AI
      const aiSimulation = await this.simulateAIResponse(processed, data, totalScore);

      // Genera suggerimenti
      const suggestions = await this.generateGEOSuggestions(data, issues, totalScore);

      const analysis: GEOAnalysis = {
        score: totalScore,
        grade: this.scoreToGrade(totalScore),
        readiness: this.getReadinessLevel(totalScore),
        issues: issues.sort((a, b) => this.severityWeight(b.severity) - this.severityWeight(a.severity)),
        suggestions,
        metrics: {
          contentStructure,
          authority,
          formatting,
          questionOptimization,
          citability,
        },
        checklist,
        aiSimulation,
      };

      return {
        success: true,
        output: analysis,
        reasoning: `Analisi GEO completata. Score: ${totalScore}/100 - ${this.getReadinessLevel(totalScore)}`,
        suggestedActions: suggestions.slice(0, 5),
      };

    } catch (error) {
      this.log(`Errore analisi: ${error}`, 'error');
      return {
        success: false,
        output: null,
        reasoning: `Errore durante l'analisi GEO: ${error}`,
      };
    }
  }

  private analyzeContentStructure(
    processed: ReturnType<typeof contentProcessor.processHTML>
  ): ContentStructureAnalysis {
    const issues: string[] = [];
    let score = 100;

    const blocks = processed.blocks;
    const totalBlocks = blocks.length;
    const blockTokens = blocks.map(b => b.tokenEstimate);
    const avgBlockTokens = blockTokens.reduce((a, b) => a + b, 0) / (totalBlocks || 1);
    const maxBlockTokens = Math.max(...blockTokens, 0);
    const standaloneBlocks = blocks.filter(b => b.isStandalone).length;
    const standalonePercentage = totalBlocks > 0 ? (standaloneBlocks / totalBlocks) * 100 : 0;

    // Verifica dimensione blocchi
    if (maxBlockTokens > this.maxTokensPerBlock) {
      issues.push(`Blocchi troppo grandi (max ${maxBlockTokens} token, limite ${this.maxTokensPerBlock})`);
      score -= 20;
    }

    if (avgBlockTokens > this.maxTokensPerBlock * 0.8) {
      issues.push(`Media blocchi alta (${Math.round(avgBlockTokens)} token)`);
      score -= 10;
    }

    // Verifica blocchi standalone
    if (standalonePercentage < 50) {
      issues.push(`Solo ${Math.round(standalonePercentage)}% blocchi auto-contenuti (target: >50%)`);
      score -= 25;
    }

    if (totalBlocks < 3) {
      issues.push('Contenuto non sufficientemente strutturato in blocchi');
      score -= 15;
    }

    return {
      totalBlocks,
      avgBlockTokens: Math.round(avgBlockTokens),
      maxBlockTokens,
      standaloneBlocks,
      standalonePercentage: Math.round(standalonePercentage),
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeAuthority(
    processed: ReturnType<typeof contentProcessor.processHTML>,
    data: Record<string, any>
  ): AuthorityAnalysis {
    const issues: string[] = [];
    let score = 100;

    const text = processed.plainText;
    const hasStatistics = /\d+%|\d+\s*(euro|€|dollari|\$|milioni|miliardi|anni|mesi|giorni)/i.test(text);
    const hasCitations = /secondo|fonte:|studio|ricerca|report|dati di|analisi di/i.test(text);
    const hasExpertQuotes = /"[^"]{20,}"|\u201c[^\u201d]{20,}\u201d/g.test(text);
    const hasBrandMention = text.toLowerCase().includes(this.brandName.toLowerCase());

    let trustSignalsCount = 0;
    if (hasStatistics) trustSignalsCount++;
    if (hasCitations) trustSignalsCount++;
    if (hasExpertQuotes) trustSignalsCount++;
    if (hasBrandMention) trustSignalsCount++;
    if (data.author_name) trustSignalsCount++;
    if (data.certifications) trustSignalsCount++;

    // Valutazione
    if (!hasStatistics) {
      issues.push('Mancano dati/statistiche concrete');
      score -= 20;
    }

    if (!hasCitations) {
      issues.push('Mancano citazioni o riferimenti a fonti');
      score -= 20;
    }

    if (!hasBrandMention) {
      issues.push(`Brand "${this.brandName}" non menzionato nel contenuto`);
      score -= 15;
    }

    if (trustSignalsCount < 3) {
      issues.push(`Pochi segnali di trust (${trustSignalsCount}/6)`);
      score -= 10;
    }

    return {
      hasStatistics,
      hasCitations,
      hasExpertQuotes,
      hasBrandMention,
      trustSignalsCount,
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeFormatting(
    processed: ReturnType<typeof contentProcessor.processHTML>,
    geoMetrics: ReturnType<typeof contentProcessor.calculateGEOMetrics>
  ): FormattingAnalysis {
    const issues: string[] = [];
    let score = 100;

    const hasLists = geoMetrics.hasLists;
    const hasTables = processed.tables > 0;
    const hasQAFormat = geoMetrics.hasQAFormat;
    const signalPhrasesCount = geoMetrics.signalPhrasesCount;
    const readabilityScore = geoMetrics.readabilityScore;

    if (!hasLists) {
      issues.push('Mancano liste/bullet points (facilitano estrazione AI)');
      score -= 15;
    }

    if (!hasQAFormat) {
      issues.push('Manca formato Q&A o FAQ');
      score -= 15;
    }

    if (signalPhrasesCount === 0) {
      issues.push('Mancano frasi segnale ("In sintesi", "La risposta è", etc.)');
      score -= 10;
    }

    if (readabilityScore < 50) {
      issues.push(`Leggibilità bassa (${Math.round(readabilityScore)}/100)`);
      score -= 10;
    }

    return {
      hasLists,
      hasTables,
      hasQAFormat,
      signalPhrasesCount,
      readabilityScore: Math.round(readabilityScore),
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeQuestionOptimization(
    processed: ReturnType<typeof contentProcessor.processHTML>,
    data: Record<string, any>
  ): QuestionAnalysis {
    const issues: string[] = [];
    let score = 100;

    const text = processed.plainText;

    // Conta domande nel contenuto
    const questionMatches = text.match(/\?/g) || [];
    const questionsAnswered = questionMatches.length;

    // Verifica struttura FAQ
    const hasFAQStructure = processed.headings.some(h => h.text.includes('?')) ||
                            /FAQ|domande frequenti|Q&A/i.test(text);

    // Conta risposte dirette (frasi che iniziano con la risposta)
    const directAnswerPatterns = /^(La risposta è|Sì,|No,|Il|La|I|Le|Un|Una)/gm;
    const directAnswers = (text.match(directAnswerPatterns) || []).length;

    if (questionsAnswered === 0) {
      issues.push('Nessuna domanda indirizzata nel contenuto');
      score -= 20;
    }

    if (!hasFAQStructure) {
      issues.push('Manca sezione FAQ o struttura Q&A');
      score -= 15;
    }

    if (directAnswers < 3) {
      issues.push('Poche risposte dirette (inizia con "La risposta è...", etc.)');
      score -= 10;
    }

    return {
      questionsAnswered,
      hasFAQStructure,
      directAnswers,
      score: Math.max(0, score),
      issues,
    };
  }

  private async analyzeCitability(
    processed: ReturnType<typeof contentProcessor.processHTML>,
    data: Record<string, any>
  ): Promise<CitabilityAnalysis> {
    const issues: string[] = [];
    let score = 100;

    const text = processed.plainText;

    // Passaggi quotabili (frasi complete con informazioni concrete)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const quotablePatterns = /\d+|definisce|significa|consiste|rappresenta|è caratterizzato/i;
    const quotablePassages = sentences.filter(s => quotablePatterns.test(s)).length;

    // Insights unici (affermazioni con "secondo noi", "la nostra esperienza", etc.)
    const uniquePatterns = /secondo (noi|la nostra)|la nostra esperienza|abbiamo scoperto|i nostri dati mostrano/gi;
    const uniqueInsights = (text.match(uniquePatterns) || []).length;

    // Definizioni
    const definitionPatterns = /è definito come|significa|si intende|consiste in/gi;
    const definitionCount = (text.match(definitionPatterns) || []).length;

    if (quotablePassages < 5) {
      issues.push(`Pochi passaggi quotabili (${quotablePassages}, target: >5)`);
      score -= 20;
    }

    if (uniqueInsights === 0) {
      issues.push('Mancano insights originali/unici');
      score -= 15;
    }

    if (definitionCount === 0) {
      issues.push('Mancano definizioni chiare (aiutano AI a citare)');
      score -= 10;
    }

    return {
      quotablePassages,
      uniqueInsights,
      definitionCount,
      score: Math.max(0, score),
      issues,
    };
  }

  private evaluateChecklist(
    processed: ReturnType<typeof contentProcessor.processHTML>,
    geoMetrics: ReturnType<typeof contentProcessor.calculateGEOMetrics>,
    data: Record<string, any>
  ): ChecklistItem[] {
    const text = processed.plainText;

    return GEO_CHECKLIST.map(item => {
      let passed = false;

      switch (item.id) {
        case 'block_size':
          passed = geoMetrics.maxBlockSize <= this.maxTokensPerBlock;
          break;
        case 'self_contained':
          passed = processed.blocks.filter(b => b.isStandalone).length >= processed.blocks.length * 0.5;
          break;
        case 'clear_answers':
          passed = /la risposta|in sintesi|in conclusione/i.test(text);
          break;
        case 'citations':
          passed = geoMetrics.hasCitations;
          break;
        case 'statistics':
          passed = geoMetrics.hasStatistics;
          break;
        case 'brand_mention':
          passed = geoMetrics.hasBrandMention;
          break;
        case 'bullet_points':
          passed = geoMetrics.hasLists;
          break;
        case 'qa_format':
          passed = geoMetrics.hasQAFormat;
          break;
        case 'expert_voice':
          passed = /esperti|professionisti|anni di esperienza|specializzati/i.test(text);
          break;
        case 'unique_value':
          passed = /esclusivo|unico|solo da noi|originale/i.test(text);
          break;
      }

      return {
        id: item.id,
        question: item.question,
        passed,
        weight: item.weight,
      };
    });
  }

  private async simulateAIResponse(
    processed: ReturnType<typeof contentProcessor.processHTML>,
    data: Record<string, any>,
    score: number
  ): Promise<AISimulationResult> {
    // Simulazione basata su euristica
    const wouldBeCited = score >= 70;
    const confidence = Math.min(95, score + 10);

    // Genera query suggerite basate sul contenuto
    const keywords = contentProcessor.extractKeywords(processed, 5);
    const title = data.title || data.name || '';

    const suggestedQueries = [
      `Cos'è ${keywords[0] || title}?`,
      `Come funziona ${keywords[0] || title}?`,
      `${title} - vantaggi e caratteristiche`,
      `Dove acquistare ${keywords[0] || 'prodotti'} di qualità?`,
      `Migliori ${keywords[0] || 'prodotti'} italiani`,
    ].filter(q => q.length > 10);

    let reasoning = '';
    if (score >= 85) {
      reasoning = 'Contenuto ben strutturato con alta probabilità di essere citato. Blocchi auto-contenuti, segnali di autorità presenti, formato ottimizzato per estrazione AI.';
    } else if (score >= 70) {
      reasoning = 'Contenuto con buona base per citazione AI. Alcune ottimizzazioni potrebbero migliorare la probabilità di essere selezionato come fonte.';
    } else if (score >= 50) {
      reasoning = 'Contenuto necessita ottimizzazioni significative per essere considerato fonte autorevole dai modelli AI.';
    } else {
      reasoning = 'Contenuto non ottimizzato per AI. Richiede ristrutturazione completa per essere citabile.';
    }

    return {
      wouldBeCited,
      confidence,
      reasoning,
      suggestedQueries,
    };
  }

  private structureToIssues(analysis: ContentStructureAnalysis): GEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: msg.includes('auto-contenuti') ? 'critical' : 'high',
      category: 'Struttura Contenuto',
      message: msg,
      impact: 'AI estrae a livello di blocco - blocchi non ottimizzati non vengono citati',
      fix: 'Ristruttura il contenuto in blocchi di max 800 token, ognuno comprensibile da solo',
    }));
  }

  private authorityToIssues(analysis: AuthorityAnalysis): GEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: msg.includes('Brand') ? 'critical' : 'high',
      category: 'Autorevolezza',
      message: msg,
      impact: 'I trust signals sono i nuovi backlinks per AI',
      fix: msg.includes('Brand')
        ? `Menziona "${this.brandName}" naturalmente nel contesto delle risposte`
        : 'Aggiungi dati, statistiche e citazioni per aumentare credibilità',
    }));
  }

  private formattingToIssues(analysis: FormattingAnalysis): GEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: 'medium',
      category: 'Formattazione',
      message: msg,
      impact: 'Formati strutturati facilitano l\'estrazione AI',
    }));
  }

  private questionToIssues(analysis: QuestionAnalysis): GEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: msg.includes('FAQ') ? 'high' : 'medium',
      category: 'Ottimizzazione Domande',
      message: msg,
      impact: 'AI cerca risposte a domande complete, non solo keyword',
    }));
  }

  private citabilityToIssues(analysis: CitabilityAnalysis): GEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: msg.includes('quotabili') ? 'high' : 'medium',
      category: 'Citabilità',
      message: msg,
      impact: 'Contenuti senza passaggi quotabili non vengono selezionati come fonte',
    }));
  }

  private calculateTotalScore(scores: Record<string, number>): number {
    const weights = {
      contentStructure: 0.25,
      authority: 0.25,
      formatting: 0.15,
      questionOptimization: 0.20,
      citability: 0.15,
    };

    let total = 0;
    for (const [key, weight] of Object.entries(weights)) {
      total += (scores[key] || 0) * weight;
    }

    return Math.round(total);
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private getReadinessLevel(score: number): 'AI-Ready' | 'Needs Work' | 'Not Optimized' {
    if (score >= GEO_SCORE_THRESHOLDS.excellent) return 'AI-Ready';
    if (score >= GEO_SCORE_THRESHOLDS.average) return 'Needs Work';
    return 'Not Optimized';
  }

  private severityWeight(severity: GEOIssue['severity']): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity];
  }

  private async generateGEOSuggestions(
    data: Record<string, any>,
    issues: GEOIssue[],
    score: number
  ): Promise<string[]> {
    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');

    const prompt = `Sei un esperto GEO. Analizza questi problemi e fornisci 5 azioni prioritarie per rendere questo contenuto "AI-citabile":

Contenuto: ${data.title || data.name}
Score attuale: ${score}/100

Problemi principali:
${criticalIssues.slice(0, 5).map(i => `- [${i.category}] ${i.message} → Impatto: ${i.impact}`).join('\n')}

Fornisci 5 azioni specifiche e pratiche. Ogni azione deve:
1. Essere immediatamente eseguibile
2. Avere un impatto misurabile sulla citabilità AI
3. Essere concisa (max 80 caratteri)

Inizia ogni azione con un verbo d'azione.`;

    try {
      const response = await this.callClaude([{ role: 'user', content: prompt }], {
        maxTokens: 600,
        temperature: 0.5,
      });

      return response
        .split('\n')
        .filter(line => line.trim().match(/^\d+\.|^-|^•/))
        .map(line => line.replace(/^\d+\.\s*|^-\s*|^•\s*/, '').trim())
        .filter(s => s.length > 0 && s.length < 150)
        .slice(0, 5);
    } catch {
      return criticalIssues.slice(0, 5).map(i => i.fix || i.message);
    }
  }
}

export const geoAnalyzer = new GEOAnalyzerAgent();
