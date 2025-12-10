/**
 * SEO Analyzer Agent
 * Analizza contenuti per ottimizzazione SEO tradizionale
 */

import { BaseAgent, AgentContext, AgentResult } from './base-agent.js';
import { contentProcessor } from '../rag/content-processor.js';
import { SEO_RULES, SEO_SCORE_THRESHOLDS, CONTENT_TYPES } from '../../config/seo-rules.js';

interface SEOAnalysis {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: SEOIssue[];
  suggestions: string[];
  metrics: {
    title: TitleAnalysis;
    description: DescriptionAnalysis;
    content: ContentAnalysis;
    technical: TechnicalAnalysis;
    structuredData: StructuredDataAnalysis;
    social: SocialAnalysis;
  };
}

interface SEOIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  fix?: string;
}

interface TitleAnalysis {
  value: string;
  length: number;
  score: number;
  issues: string[];
}

interface DescriptionAnalysis {
  value: string;
  length: number;
  score: number;
  issues: string[];
}

interface ContentAnalysis {
  wordCount: number;
  headingStructure: { h1: number; h2: number; h3: number };
  keywordDensity: Record<string, number>;
  score: number;
  issues: string[];
}

interface TechnicalAnalysis {
  hasCanonical: boolean;
  hasHreflang: boolean;
  hasSitemap: boolean;
  hasRobots: boolean;
  score: number;
  issues: string[];
}

interface StructuredDataAnalysis {
  schemas: string[];
  missingSchemas: string[];
  score: number;
  issues: string[];
}

interface SocialAnalysis {
  openGraph: { present: string[]; missing: string[] };
  twitterCards: { present: string[]; missing: string[] };
  score: number;
  issues: string[];
}

const SYSTEM_PROMPT = `Sei un esperto SEO senior con 15+ anni di esperienza.
Il tuo compito è analizzare contenuti web e fornire valutazioni precise e azionabili.

Regole:
1. Sii specifico e pratico nelle raccomandazioni
2. Prioritizza gli interventi per impatto
3. Considera sia SEO on-page che tecnico
4. Valuta la qualità del contenuto, non solo i tecnicismi
5. Fornisci sempre esempi concreti per i miglioramenti

Focus su:
- Meta title e description ottimali
- Struttura heading (H1, H2, H3)
- Keyword density naturale (non keyword stuffing)
- Schema.org e dati strutturati
- Open Graph e Twitter Cards
- Canonical URLs e hreflang
- Performance e Core Web Vitals`;

export class SEOAnalyzerAgent extends BaseAgent {
  constructor() {
    super('SEO-Analyzer', SYSTEM_PROMPT);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const { data } = context;

    try {
      this.log(`Analisi SEO per: ${data.title || data.name || 'Contenuto'}`);

      // Processa il contenuto
      const processed = contentProcessor.processHTML(data.content || data.body || '');

      // Analisi componenti
      const titleAnalysis = this.analyzeTitle(data.meta_title || data.title || data.name);
      const descriptionAnalysis = this.analyzeDescription(data.meta_description || '');
      const contentAnalysis = this.analyzeContent(processed, data.keywords || []);
      const technicalAnalysis = this.analyzeTechnical(data);
      const structuredDataAnalysis = this.analyzeStructuredData(data);
      const socialAnalysis = this.analyzeSocial(data);

      // Raccogli tutti i problemi
      const issues: SEOIssue[] = [
        ...this.titleToIssues(titleAnalysis),
        ...this.descriptionToIssues(descriptionAnalysis),
        ...this.contentToIssues(contentAnalysis),
        ...this.technicalToIssues(technicalAnalysis),
        ...this.structuredDataToIssues(structuredDataAnalysis),
        ...this.socialToIssues(socialAnalysis),
      ];

      // Calcola score totale
      const totalScore = this.calculateTotalScore({
        title: titleAnalysis.score,
        description: descriptionAnalysis.score,
        content: contentAnalysis.score,
        technical: technicalAnalysis.score,
        structuredData: structuredDataAnalysis.score,
        social: socialAnalysis.score,
      });

      // Genera suggerimenti AI
      const suggestions = await this.generateAISuggestions(data, issues);

      const analysis: SEOAnalysis = {
        score: totalScore,
        grade: this.scoreToGrade(totalScore),
        issues: issues.sort((a, b) => this.severityWeight(b.severity) - this.severityWeight(a.severity)),
        suggestions,
        metrics: {
          title: titleAnalysis,
          description: descriptionAnalysis,
          content: contentAnalysis,
          technical: technicalAnalysis,
          structuredData: structuredDataAnalysis,
          social: socialAnalysis,
        },
      };

      return {
        success: true,
        output: analysis,
        reasoning: `Analisi SEO completata. Score: ${totalScore}/100 (${this.scoreToGrade(totalScore)})`,
        suggestedActions: suggestions.slice(0, 5),
      };

    } catch (error) {
      this.log(`Errore analisi: ${error}`, 'error');
      return {
        success: false,
        output: null,
        reasoning: `Errore durante l'analisi SEO: ${error}`,
      };
    }
  }

  private analyzeTitle(title: string): TitleAnalysis {
    const issues: string[] = [];
    let score = 100;

    const length = title?.length || 0;

    if (!title || length === 0) {
      issues.push('Title mancante');
      score = 0;
    } else {
      if (length < SEO_RULES.title.minLength) {
        issues.push(`Title troppo corto (${length}/${SEO_RULES.title.minLength} caratteri)`);
        score -= 30;
      }
      if (length > SEO_RULES.title.maxLength) {
        issues.push(`Title troppo lungo (${length}/${SEO_RULES.title.maxLength} caratteri)`);
        score -= 20;
      }
      if (!title.includes('|') && !title.includes('-')) {
        issues.push('Title non segue il formato brand (manca separatore)');
        score -= 10;
      }
    }

    return {
      value: title || '',
      length,
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeDescription(description: string): DescriptionAnalysis {
    const issues: string[] = [];
    let score = 100;

    const length = description?.length || 0;

    if (!description || length === 0) {
      issues.push('Meta description mancante');
      score = 0;
    } else {
      if (length < SEO_RULES.description.minLength) {
        issues.push(`Description troppo corta (${length}/${SEO_RULES.description.minLength} caratteri)`);
        score -= 30;
      }
      if (length > SEO_RULES.description.maxLength) {
        issues.push(`Description troppo lunga (${length}/${SEO_RULES.description.maxLength} caratteri)`);
        score -= 20;
      }
      // Verifica presenza CTA
      const ctaPatterns = /scopri|acquista|contatta|leggi|visita|prova/i;
      if (!ctaPatterns.test(description)) {
        issues.push('Description senza call-to-action');
        score -= 10;
      }
    }

    return {
      value: description || '',
      length,
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeContent(
    processed: ReturnType<typeof contentProcessor.processHTML>,
    keywords: string[]
  ): ContentAnalysis {
    const issues: string[] = [];
    let score = 100;

    const wordCount = processed.wordCount;
    const h1Count = processed.headings.filter(h => h.level === 1).length;
    const h2Count = processed.headings.filter(h => h.level === 2).length;
    const h3Count = processed.headings.filter(h => h.level === 3).length;

    // Word count
    if (wordCount < SEO_RULES.content.minWordCount) {
      issues.push(`Contenuto troppo breve (${wordCount}/${SEO_RULES.content.minWordCount} parole)`);
      score -= 25;
    }

    // H1
    if (h1Count === 0) {
      issues.push('Manca H1');
      score -= 20;
    } else if (h1Count > 1) {
      issues.push(`Troppi H1 (${h1Count}, dovrebbe essere 1)`);
      score -= 15;
    }

    // H2
    if (h2Count < SEO_RULES.content.headingStructure.minH2) {
      issues.push(`Pochi H2 (${h2Count}, minimo ${SEO_RULES.content.headingStructure.minH2})`);
      score -= 10;
    }

    // Keyword density
    const keywordDensity: Record<string, number> = {};
    const textLower = processed.plainText.toLowerCase();

    for (const keyword of keywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = textLower.match(regex) || [];
      const density = (matches.length / wordCount) * 100;
      keywordDensity[keyword] = density;

      if (density < SEO_RULES.content.keywordDensity.min) {
        issues.push(`Keyword "${keyword}" sotto-utilizzata (${density.toFixed(1)}%)`);
        score -= 5;
      } else if (density > SEO_RULES.content.keywordDensity.max) {
        issues.push(`Keyword "${keyword}" over-ottimizzata (${density.toFixed(1)}%)`);
        score -= 10;
      }
    }

    // Immagini senza alt
    const imagesWithoutAlt = processed.images.filter(i => !i.hasAlt).length;
    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} immagini senza attributo alt`);
      score -= imagesWithoutAlt * 5;
    }

    return {
      wordCount,
      headingStructure: { h1: h1Count, h2: h2Count, h3: h3Count },
      keywordDensity,
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeTechnical(data: Record<string, any>): TechnicalAnalysis {
    const issues: string[] = [];
    let score = 100;

    const hasCanonical = !!data.canonical_url || !!data.website_url;
    const hasHreflang = !!data.hreflang || !!data.alternate_urls;
    const hasSitemap = data.sitemap !== false;
    const hasRobots = data.robots !== false;

    if (!hasCanonical) {
      issues.push('URL canonico non configurato');
      score -= 25;
    }

    if (!hasHreflang && data.languages && data.languages.length > 1) {
      issues.push('Hreflang non configurato per contenuto multilingua');
      score -= 20;
    }

    return {
      hasCanonical,
      hasHreflang,
      hasSitemap,
      hasRobots,
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeStructuredData(data: Record<string, any>): StructuredDataAnalysis {
    const issues: string[] = [];
    let score = 100;

    const schemas = data.schemas || [];
    const contentType = data.content_type || 'page';
    const requiredSchemas = CONTENT_TYPES[contentType as keyof typeof CONTENT_TYPES]?.requiredSchema || [];

    const missingSchemas = requiredSchemas.filter((s: string) => !schemas.includes(s));

    if (missingSchemas.length > 0) {
      issues.push(`Schema mancanti: ${missingSchemas.join(', ')}`);
      score -= missingSchemas.length * 15;
    }

    return {
      schemas,
      missingSchemas,
      score: Math.max(0, score),
      issues,
    };
  }

  private analyzeSocial(data: Record<string, any>): SocialAnalysis {
    const issues: string[] = [];
    let score = 100;

    const ogRequired = SEO_RULES.openGraph.required;
    const ogPresent = ogRequired.filter(tag => data[tag] || data.openGraph?.[tag.replace('og:', '')]);
    const ogMissing = ogRequired.filter(tag => !ogPresent.includes(tag));

    const twRequired = SEO_RULES.twitter.required;
    const twPresent = twRequired.filter(tag => data[tag] || data.twitterCards?.[tag.replace('twitter:', '')]);
    const twMissing = twRequired.filter(tag => !twPresent.includes(tag));

    if (ogMissing.length > 0) {
      issues.push(`Open Graph mancanti: ${ogMissing.join(', ')}`);
      score -= ogMissing.length * 10;
    }

    if (twMissing.length > 0) {
      issues.push(`Twitter Cards mancanti: ${twMissing.join(', ')}`);
      score -= twMissing.length * 5;
    }

    return {
      openGraph: { present: ogPresent, missing: ogMissing },
      twitterCards: { present: twPresent, missing: twMissing },
      score: Math.max(0, score),
      issues,
    };
  }

  private titleToIssues(analysis: TitleAnalysis): SEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: analysis.score === 0 ? 'critical' : analysis.score < 50 ? 'high' : 'medium',
      category: 'Title',
      message: msg,
      fix: this.suggestTitleFix(msg),
    }));
  }

  private descriptionToIssues(analysis: DescriptionAnalysis): SEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: analysis.score === 0 ? 'critical' : analysis.score < 50 ? 'high' : 'medium',
      category: 'Description',
      message: msg,
      fix: this.suggestDescriptionFix(msg),
    }));
  }

  private contentToIssues(analysis: ContentAnalysis): SEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: msg.includes('Manca H1') ? 'critical' : 'medium',
      category: 'Content',
      message: msg,
    }));
  }

  private technicalToIssues(analysis: TechnicalAnalysis): SEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: msg.includes('canonico') ? 'high' : 'medium',
      category: 'Technical',
      message: msg,
    }));
  }

  private structuredDataToIssues(analysis: StructuredDataAnalysis): SEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: 'high',
      category: 'Structured Data',
      message: msg,
    }));
  }

  private socialToIssues(analysis: SocialAnalysis): SEOIssue[] {
    return analysis.issues.map(msg => ({
      severity: msg.includes('og:image') ? 'high' : 'medium',
      category: 'Social',
      message: msg,
    }));
  }

  private suggestTitleFix(issue: string): string {
    if (issue.includes('mancante')) return 'Aggiungi un title descrittivo con keyword principale';
    if (issue.includes('corto')) return 'Espandi il title con keyword secondarie o brand';
    if (issue.includes('lungo')) return 'Riduci il title mantenendo keyword principale';
    if (issue.includes('separatore')) return 'Usa formato "Keyword - Brand" o "Keyword | Brand"';
    return '';
  }

  private suggestDescriptionFix(issue: string): string {
    if (issue.includes('mancante')) return 'Scrivi una description di 150-160 caratteri con CTA';
    if (issue.includes('corta')) return 'Espandi con benefici e call-to-action';
    if (issue.includes('lunga')) return 'Riduci a max 160 caratteri';
    if (issue.includes('CTA')) return 'Aggiungi verbo d\'azione: scopri, acquista, leggi...';
    return '';
  }

  private calculateTotalScore(scores: Record<string, number>): number {
    const weights = {
      title: 0.15,
      description: 0.10,
      content: 0.30,
      technical: 0.20,
      structuredData: 0.15,
      social: 0.10,
    };

    let total = 0;
    for (const [key, weight] of Object.entries(weights)) {
      total += (scores[key] || 0) * weight;
    }

    return Math.round(total);
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private severityWeight(severity: SEOIssue['severity']): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity];
  }

  private async generateAISuggestions(data: Record<string, any>, issues: SEOIssue[]): Promise<string[]> {
    if (issues.length === 0) {
      return ['Ottimo! Nessun problema SEO rilevato.'];
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');

    const prompt = `Analizza questi problemi SEO e fornisci 5 suggerimenti pratici prioritizzati:

Contenuto: ${data.title || data.name}
Tipo: ${data.content_type || 'pagina'}

Problemi critici/alti:
${criticalIssues.map(i => `- [${i.category}] ${i.message}`).join('\n')}

Fornisci 5 suggerimenti specifici e azionabili, ordinati per priorità.
Ogni suggerimento deve essere conciso (max 100 caratteri) e iniziare con un verbo d'azione.`;

    try {
      const response = await this.callClaude([{ role: 'user', content: prompt }], {
        maxTokens: 500,
        temperature: 0.5,
      });

      return response
        .split('\n')
        .filter(line => line.trim().match(/^\d+\.|^-|^•/))
        .map(line => line.replace(/^\d+\.\s*|^-\s*|^•\s*/, '').trim())
        .filter(s => s.length > 0)
        .slice(0, 5);
    } catch {
      return criticalIssues.slice(0, 5).map(i => i.fix || i.message);
    }
  }
}

export const seoAnalyzer = new SEOAnalyzerAgent();
