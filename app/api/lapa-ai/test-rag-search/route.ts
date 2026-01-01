/**
 * API Endpoint: Test RAG Search
 *
 * GET /api/lapa-ai/test-rag-search?q=porchetta
 *
 * Tests the RAG semantic search for a product
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || 'porchetta';

  const results: any = {
    query,
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Check if product exists in RAG DB (text search)
  try {
    const textSearch = await sql`
      SELECT product_id, product_name
      FROM product_embeddings
      WHERE LOWER(product_name) LIKE ${`%${query.toLowerCase()}%`}
      ORDER BY product_name
      LIMIT 20
    `;

    results.tests.push({
      test: 'Text search in RAG DB',
      success: textSearch.rows.length > 0,
      found: textSearch.rows.length,
      products: textSearch.rows.map(r => ({ id: r.product_id, name: r.product_name }))
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Text search in RAG DB',
      success: false,
      error: e.message
    });
  }

  // Test 2: Count total embeddings
  try {
    const count = await sql`SELECT COUNT(*) as total FROM product_embeddings`;
    results.tests.push({
      test: 'Total embeddings count',
      success: true,
      total: parseInt(count.rows[0].total)
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Total embeddings count',
      success: false,
      error: e.message
    });
  }

  // Test 3: Semantic search (vector similarity)
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const embResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float'
    });

    const queryEmbedding = embResponse.data[0].embedding;
    const embeddingVector = `[${queryEmbedding.join(',')}]`;

    const semanticResult = await sql`
      SELECT
        product_id,
        product_name,
        1 - (embedding <=> ${embeddingVector}::vector) as similarity
      FROM product_embeddings
      WHERE 1 - (embedding <=> ${embeddingVector}::vector) > 0.3
      ORDER BY similarity DESC
      LIMIT 10
    `;

    results.tests.push({
      test: 'Semantic search (vector)',
      success: semanticResult.rows.length > 0,
      found: semanticResult.rows.length,
      products: semanticResult.rows.map(r => ({
        id: r.product_id,
        name: r.product_name,
        similarity: parseFloat(r.similarity).toFixed(3)
      }))
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Semantic search (vector)',
      success: false,
      error: e.message
    });
  }

  // Test 4: Check specific product IDs (porchetta IDs from Odoo)
  const porchettaIds = [12892, 12755, 19452]; // IDs from Odoo search
  try {
    const specificSearch = await sql`
      SELECT product_id, product_name
      FROM product_embeddings
      WHERE product_id = ANY(${porchettaIds})
    `;

    results.tests.push({
      test: 'Check specific porchetta IDs in RAG',
      success: specificSearch.rows.length > 0,
      expectedIds: porchettaIds,
      found: specificSearch.rows.length,
      products: specificSearch.rows.map(r => ({ id: r.product_id, name: r.product_name }))
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Check specific porchetta IDs in RAG',
      success: false,
      error: e.message
    });
  }

  // Test 5: Sample of what IS in the database
  try {
    const sample = await sql`
      SELECT product_id, product_name
      FROM product_embeddings
      ORDER BY RANDOM()
      LIMIT 5
    `;

    results.tests.push({
      test: 'Random sample from RAG DB',
      success: true,
      products: sample.rows.map(r => ({ id: r.product_id, name: r.product_name }))
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Random sample from RAG DB',
      success: false,
      error: e.message
    });
  }

  // Summary
  const allPassed = results.tests.every((t: any) => t.success);
  results.summary = {
    allTestsPassed: allPassed,
    passedCount: results.tests.filter((t: any) => t.success).length,
    totalTests: results.tests.length
  };

  return NextResponse.json(results);
}
