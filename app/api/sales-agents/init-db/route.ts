import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/sales-agents/init-db
 * Inizializza il database con lo schema SQL
 * ATTENZIONE: Eseguire solo una volta! O quando si vuole ricreare le tabelle
 */

export async function POST(request: NextRequest) {
  try {
    // Security: Verifica che sia ambiente di sviluppo o che ci sia un token
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // In produzione, usa un token segreto
    if (process.env.NODE_ENV === 'production' && token !== process.env.DB_INIT_TOKEN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Sales AI Hub] Initializing database...');

    // Leggi schema SQL
    const schemaPath = path.join(process.cwd(), 'lib', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Esegui schema (Vercel Postgres supporta multi-statement queries)
    await sql.query(schema);

    console.log('[Sales AI Hub] Database initialized successfully!');

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      tables: [
        'conversations',
        'conversation_messages',
        'client_interactions',
        'daily_plans'
      ],
      views: [
        'recent_interactions',
        'upcoming_actions'
      ]
    });

  } catch (error) {
    console.error('[Sales AI Hub] Error initializing database:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error initializing database',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sales-agents/init-db
 * Verifica lo stato del database
 */
export async function GET(request: NextRequest) {
  try {
    // Check if tables exist
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('conversations', 'conversation_messages', 'client_interactions', 'daily_plans')
      ORDER BY table_name
    `;

    const existingTables = result.rows.map(r => r.table_name);
    const requiredTables = ['conversations', 'conversation_messages', 'client_interactions', 'daily_plans'];
    const isInitialized = requiredTables.every(t => existingTables.includes(t));

    return NextResponse.json({
      success: true,
      isInitialized,
      existingTables,
      missingTables: requiredTables.filter(t => !existingTables.includes(t)),
      stats: isInitialized ? {
        conversations: await getTableCount('conversations'),
        messages: await getTableCount('conversation_messages'),
        interactions: await getTableCount('client_interactions'),
        daily_plans: await getTableCount('daily_plans')
      } : null
    });

  } catch (error) {
    console.error('[Sales AI Hub] Error checking database:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error checking database',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper: Get row count
async function getTableCount(tableName: string): Promise<number> {
  try {
    const result = await sql.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0]?.count || '0');
  } catch {
    return 0;
  }
}
