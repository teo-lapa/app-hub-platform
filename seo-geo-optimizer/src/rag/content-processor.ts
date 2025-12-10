/**
 * Content Processor
 * Elaborazione e preparazione contenuti per analisi SEO/GEO
 */

import * as cheerio from 'cheerio';
import { config } from '../utils/config.js';

interface ProcessedContent {
  plainText: string;
  html: string;
  wordCount: number;
  tokenEstimate: number;
  headings: { level: number; text: string }[];
  links: { href: string; text: string; isExternal: boolean }[];
  images: { src: string; alt: string; hasAlt: boolean }[];
  lists: { type: 'ul' | 'ol'; items: string[] }[];
  tables: number;
  paragraphs: string[];
  blocks: ContentBlock[];
}

interface ContentBlock {
  id: string;
  content: string;
  tokenEstimate: number;
  type: 'intro' | 'heading' | 'paragraph' | 'list' | 'conclusion';
  isStandalone: boolean;
}

interface SEOMetrics {
  titleLength: number;
  descriptionLength: number;
  h1Count: number;
  h2Count: number;
  keywordDensity: Record<string, number>;
  hasCanonical: boolean;
  hasOgTags: boolean;
  hasTwitterCards: boolean;
  hasSchema: boolean;
  imageAltCoverage: number;
  internalLinks: number;
  externalLinks: number;
}

interface GEOMetrics {
  avgBlockSize: number;
  maxBlockSize: number;
  standaloneBlocks: number;
  hasStatistics: boolean;
  hasCitations: boolean;
  hasLists: boolean;
  hasQAFormat: boolean;
  hasBrandMention: boolean;
  signalPhrasesCount: number;
  readabilityScore: number;
}

export class ContentProcessor {
  private maxTokensPerBlock: number;
  private brandName: string;

  constructor() {
    this.maxTokensPerBlock = config.get('MAX_TOKENS_PER_BLOCK');
    this.brandName = config.get('WEBSITE_NAME');
  }

  /**
   * Stima approssimativa dei token (1 token ≈ 4 caratteri in italiano)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Conta le parole
   */
  countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Estrae testo pulito da HTML
   */
  htmlToText(html: string): string {
    const $ = cheerio.load(html);

    // Rimuovi script e style
    $('script, style, noscript').remove();

    // Sostituisci br con newline
    $('br').replaceWith('\n');

    // Aggiungi newline dopo blocchi
    $('p, div, h1, h2, h3, h4, h5, h6, li').after('\n');

    return $.text()
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Elabora contenuto HTML completo
   */
  processHTML(html: string): ProcessedContent {
    const $ = cheerio.load(html);

    // Estrai headings
    const headings: ProcessedContent['headings'] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      headings.push({
        level: parseInt(el.tagName.replace('h', '')),
        text: $(el).text().trim(),
      });
    });

    // Estrai link
    const links: ProcessedContent['links'] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      links.push({
        href,
        text: $(el).text().trim(),
        isExternal: href.startsWith('http') && !href.includes(this.brandName.toLowerCase()),
      });
    });

    // Estrai immagini
    const images: ProcessedContent['images'] = [];
    $('img').each((_, el) => {
      const alt = $(el).attr('alt') || '';
      images.push({
        src: $(el).attr('src') || '',
        alt,
        hasAlt: alt.length > 0,
      });
    });

    // Estrai liste
    const lists: ProcessedContent['lists'] = [];
    $('ul, ol').each((_, el) => {
      const items: string[] = [];
      $(el).find('li').each((_, li) => {
        items.push($(li).text().trim());
      });
      lists.push({
        type: el.tagName.toLowerCase() as 'ul' | 'ol',
        items,
      });
    });

    // Conta tabelle
    const tables = $('table').length;

    // Estrai paragrafi
    const paragraphs: string[] = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
    });

    const plainText = this.htmlToText(html);

    // Crea blocchi per GEO
    const blocks = this.createContentBlocks(html);

    return {
      plainText,
      html,
      wordCount: this.countWords(plainText),
      tokenEstimate: this.estimateTokens(plainText),
      headings,
      links,
      images,
      lists,
      tables,
      paragraphs,
      blocks,
    };
  }

  /**
   * Crea blocchi di contenuto ottimizzati per GEO
   */
  createContentBlocks(html: string): ContentBlock[] {
    const $ = cheerio.load(html);
    const blocks: ContentBlock[] = [];
    let blockId = 0;

    // Processa sezioni basate su headings
    const sections: { heading: string; content: string[] }[] = [];
    let currentSection: { heading: string; content: string[] } = { heading: '', content: [] };

    $('body').children().each((_, el) => {
      const tagName = el.tagName.toLowerCase();
      const text = $(el).text().trim();

      if (['h1', 'h2', 'h3'].includes(tagName)) {
        if (currentSection.content.length > 0) {
          sections.push({ ...currentSection });
        }
        currentSection = { heading: text, content: [] };
      } else if (text.length > 0) {
        currentSection.content.push(text);
      }
    });

    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }

    // Crea blocchi da sezioni
    for (const section of sections) {
      const fullContent = section.heading
        ? `## ${section.heading}\n\n${section.content.join('\n\n')}`
        : section.content.join('\n\n');

      const tokens = this.estimateTokens(fullContent);

      if (tokens <= this.maxTokensPerBlock) {
        // Blocco singolo
        blocks.push({
          id: `block_${blockId++}`,
          content: fullContent,
          tokenEstimate: tokens,
          type: this.classifyBlockType(fullContent, blockId === 1),
          isStandalone: this.isStandalone(fullContent),
        });
      } else {
        // Dividi in blocchi più piccoli
        const subBlocks = this.splitIntoBlocks(fullContent);
        blocks.push(...subBlocks.map((content, i) => ({
          id: `block_${blockId++}`,
          content,
          tokenEstimate: this.estimateTokens(content),
          type: this.classifyBlockType(content, blockId === 1) as ContentBlock['type'],
          isStandalone: this.isStandalone(content),
        })));
      }
    }

    return blocks;
  }

  /**
   * Divide contenuto lungo in blocchi
   */
  private splitIntoBlocks(content: string): string[] {
    const blocks: string[] = [];
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);

    let currentBlock = '';

    for (const para of paragraphs) {
      const combined = currentBlock ? `${currentBlock}\n\n${para}` : para;

      if (this.estimateTokens(combined) <= this.maxTokensPerBlock) {
        currentBlock = combined;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = para;
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  /**
   * Classifica il tipo di blocco
   */
  private classifyBlockType(content: string, isFirst: boolean): ContentBlock['type'] {
    const lower = content.toLowerCase();

    if (isFirst) return 'intro';
    if (lower.includes('in conclusione') || lower.includes('in sintesi') || lower.includes('riassumendo')) {
      return 'conclusion';
    }
    if (content.startsWith('#')) return 'heading';
    if (content.includes('- ') || content.includes('• ') || /^\d+\.\s/.test(content)) {
      return 'list';
    }
    return 'paragraph';
  }

  /**
   * Verifica se un blocco è auto-contenuto
   */
  private isStandalone(content: string): boolean {
    // Un blocco è standalone se:
    // 1. Ha almeno 50 parole
    // 2. Non inizia con pronomi/riferimenti
    // 3. Contiene un soggetto chiaro

    const words = this.countWords(content);
    if (words < 50) return false;

    const startsWithReference = /^(questo|questa|questi|queste|esso|essa|essi|esse|ciò|il che|la quale|i quali)/i.test(content.trim());
    if (startsWithReference) return false;

    return true;
  }

  /**
   * Calcola metriche SEO
   */
  calculateSEOMetrics(
    content: ProcessedContent,
    meta: {
      title?: string;
      description?: string;
      canonical?: string;
      ogTags?: Record<string, string>;
      twitterCards?: Record<string, string>;
      schema?: any;
    },
    targetKeywords: string[] = []
  ): SEOMetrics {
    const keywordDensity: Record<string, number> = {};
    const textLower = content.plainText.toLowerCase();
    const totalWords = content.wordCount;

    for (const keyword of targetKeywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = textLower.match(regex) || [];
      keywordDensity[keyword] = (matches.length / totalWords) * 100;
    }

    const internalLinks = content.links.filter(l => !l.isExternal).length;
    const externalLinks = content.links.filter(l => l.isExternal).length;
    const imagesWithAlt = content.images.filter(i => i.hasAlt).length;

    return {
      titleLength: meta.title?.length || 0,
      descriptionLength: meta.description?.length || 0,
      h1Count: content.headings.filter(h => h.level === 1).length,
      h2Count: content.headings.filter(h => h.level === 2).length,
      keywordDensity,
      hasCanonical: !!meta.canonical,
      hasOgTags: !!meta.ogTags && Object.keys(meta.ogTags).length >= 4,
      hasTwitterCards: !!meta.twitterCards && Object.keys(meta.twitterCards).length >= 3,
      hasSchema: !!meta.schema,
      imageAltCoverage: content.images.length > 0 ? (imagesWithAlt / content.images.length) * 100 : 100,
      internalLinks,
      externalLinks,
    };
  }

  /**
   * Calcola metriche GEO
   */
  calculateGEOMetrics(content: ProcessedContent): GEOMetrics {
    const blocks = content.blocks;
    const blockSizes = blocks.map(b => b.tokenEstimate);
    const avgBlockSize = blockSizes.reduce((a, b) => a + b, 0) / (blocks.length || 1);
    const maxBlockSize = Math.max(...blockSizes, 0);
    const standaloneBlocks = blocks.filter(b => b.isStandalone).length;

    const text = content.plainText;
    const hasStatistics = /\d+%|\d+\s*(euro|€|dollari|\$|milioni|miliardi)/i.test(text);
    const hasCitations = /secondo|fonte:|studio|ricerca|report|dati/i.test(text);
    const hasLists = content.lists.length > 0;
    const hasQAFormat = /\?[\s\n]+[A-Z]/g.test(text) || content.headings.some(h => h.text.includes('?'));
    const hasBrandMention = text.toLowerCase().includes(this.brandName.toLowerCase());

    // Conta frasi segnale
    const signalPhrases = [
      'in sintesi', 'in conclusione', 'i punti chiave', 'la risposta è',
      'ecco cosa', 'in breve', 'riassumendo', 'per concludere',
    ];
    const signalPhrasesCount = signalPhrases.filter(p => text.toLowerCase().includes(p)).length;

    // Score di leggibilità semplificato (Gulpease index approximation)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = content.wordCount / (sentences || 1);
    const readabilityScore = Math.max(0, Math.min(100, 89 - (avgWordsPerSentence * 1.5)));

    return {
      avgBlockSize,
      maxBlockSize,
      standaloneBlocks,
      hasStatistics,
      hasCitations,
      hasLists,
      hasQAFormat,
      hasBrandMention,
      signalPhrasesCount,
      readabilityScore,
    };
  }

  /**
   * Estrae keywords candidate dal contenuto
   */
  extractKeywords(content: ProcessedContent, limit: number = 10): string[] {
    const text = content.plainText.toLowerCase();
    const words = text.split(/\s+/);

    // Stopwords italiane comuni
    const stopwords = new Set([
      'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con',
      'su', 'per', 'tra', 'fra', 'e', 'o', 'ma', 'se', 'perché', 'come', 'quando', 'dove',
      'che', 'chi', 'cui', 'quale', 'quanto', 'questo', 'quello', 'suo', 'loro', 'nostro',
      'vostro', 'essere', 'avere', 'fare', 'dire', 'potere', 'volere', 'dovere', 'è', 'sono',
      'ha', 'hanno', 'nel', 'nella', 'nei', 'nelle', 'del', 'della', 'dei', 'delle', 'al',
      'alla', 'ai', 'alle', 'dal', 'dalla', 'dai', 'dalle', 'sul', 'sulla', 'sui', 'sulle',
      'non', 'più', 'molto', 'anche', 'solo', 'già', 'ancora', 'sempre', 'mai', 'tutto',
    ]);

    // Conta frequenze
    const freq: Record<string, number> = {};
    for (const word of words) {
      const clean = word.replace(/[^a-zàèéìòù]/g, '');
      if (clean.length > 3 && !stopwords.has(clean)) {
        freq[clean] = (freq[clean] || 0) + 1;
      }
    }

    // Ordina per frequenza
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }
}

export const contentProcessor = new ContentProcessor();
