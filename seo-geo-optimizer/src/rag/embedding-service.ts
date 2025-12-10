/**
 * Embedding Service
 * Gestione embeddings per RAG locale usando OpenAI
 */

import OpenAI from 'openai';
import { config } from '../utils/config.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface EmbeddingRecord {
  id: string;
  type: 'article' | 'product' | 'category' | 'page';
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private model: string;
  private dimensions: number;
  private embeddings: Map<string, EmbeddingRecord> = new Map();
  private indexPath: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.get('OPENAI_API_KEY'),
    });
    this.model = config.get('EMBEDDING_MODEL');
    this.dimensions = config.get('EMBEDDING_DIMENSIONS');
    this.indexPath = resolve(config.getEmbeddingsDir(), 'index.json');
    this.loadIndex();
  }

  /**
   * Carica l'indice esistente
   */
  private loadIndex() {
    const dir = config.getEmbeddingsDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(this.indexPath)) {
      try {
        const data = JSON.parse(readFileSync(this.indexPath, 'utf-8'));
        for (const record of data) {
          this.embeddings.set(record.id, record);
        }
        console.log(`Caricati ${this.embeddings.size} embeddings dall'indice`);
      } catch (error) {
        console.error('Errore nel caricamento indice:', error);
      }
    }
  }

  /**
   * Salva l'indice
   */
  private saveIndex() {
    const data = Array.from(this.embeddings.values());
    writeFileSync(this.indexPath, JSON.stringify(data, null, 2));
  }

  /**
   * Genera embedding per un testo
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text.slice(0, 8000), // Limite input
      dimensions: this.dimensions,
    });

    return response.data[0].embedding;
  }

  /**
   * Calcola similarità coseno tra due vettori
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Aggiunge o aggiorna un contenuto nell'indice
   */
  async upsert(
    id: string,
    type: 'article' | 'product' | 'category' | 'page',
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const existing = this.embeddings.get(id);
    const now = new Date().toISOString();

    // Genera embedding solo se il contenuto è cambiato
    if (existing && existing.content === content) {
      return;
    }

    const embedding = await this.generateEmbedding(content);

    const record: EmbeddingRecord = {
      id,
      type,
      content,
      metadata,
      embedding,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.embeddings.set(id, record);
    this.saveIndex();
  }

  /**
   * Ricerca per similarità
   */
  async search(
    query: string,
    options: {
      type?: 'article' | 'product' | 'category' | 'page';
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const { type, limit = 10, threshold = config.get('SIMILARITY_THRESHOLD') } = options;

    const queryEmbedding = await this.generateEmbedding(query);
    const results: SearchResult[] = [];

    for (const record of this.embeddings.values()) {
      // Filtra per tipo se specificato
      if (type && record.type !== type) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, record.embedding);

      if (similarity >= threshold) {
        results.push({
          id: record.id,
          type: record.type,
          content: record.content,
          metadata: record.metadata,
          similarity,
        });
      }
    }

    // Ordina per similarità decrescente
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  /**
   * Trova contenuti simili a uno specifico
   */
  async findSimilar(
    id: string,
    options: {
      limit?: number;
      threshold?: number;
      sameTypeOnly?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const record = this.embeddings.get(id);
    if (!record) {
      throw new Error(`Record non trovato: ${id}`);
    }

    const { limit = 5, threshold = 0.7, sameTypeOnly = false } = options;
    const results: SearchResult[] = [];

    for (const other of this.embeddings.values()) {
      if (other.id === id) continue;
      if (sameTypeOnly && other.type !== record.type) continue;

      const similarity = this.cosineSimilarity(record.embedding, other.embedding);

      if (similarity >= threshold) {
        results.push({
          id: other.id,
          type: other.type,
          content: other.content,
          metadata: other.metadata,
          similarity,
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Rimuove un contenuto dall'indice
   */
  remove(id: string): boolean {
    const deleted = this.embeddings.delete(id);
    if (deleted) {
      this.saveIndex();
    }
    return deleted;
  }

  /**
   * Ottiene statistiche sull'indice
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    lastUpdated: string | null;
  } {
    const byType: Record<string, number> = {};
    let lastUpdated: string | null = null;

    for (const record of this.embeddings.values()) {
      byType[record.type] = (byType[record.type] || 0) + 1;
      if (!lastUpdated || record.updatedAt > lastUpdated) {
        lastUpdated = record.updatedAt;
      }
    }

    return {
      total: this.embeddings.size,
      byType,
      lastUpdated,
    };
  }

  /**
   * Cerca contenuti che rispondono a una domanda
   */
  async findAnswers(
    question: string,
    options: {
      limit?: number;
      types?: ('article' | 'product' | 'category' | 'page')[];
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 5, types } = options;

    // Arricchisci la query per cercare risposte
    const enrichedQuery = `Domanda: ${question}\nRisposta:`;
    const queryEmbedding = await this.generateEmbedding(enrichedQuery);

    const results: SearchResult[] = [];

    for (const record of this.embeddings.values()) {
      if (types && !types.includes(record.type)) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, record.embedding);

      results.push({
        id: record.id,
        type: record.type,
        content: record.content,
        metadata: record.metadata,
        similarity,
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Bulk upsert
   */
  async bulkUpsert(
    items: Array<{
      id: string;
      type: 'article' | 'product' | 'category' | 'page';
      content: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await this.upsert(item.id, item.type, item.content, item.metadata);
        success++;
      } catch (error) {
        console.error(`Errore upsert ${item.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
}

export const embeddingService = new EmbeddingService();
