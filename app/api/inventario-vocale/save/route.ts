import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'lapa-hub-secret-key-2024';

interface ExtractedProduct {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'food' | 'non_food';
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * POST /api/inventario-vocale/save
 *
 * Save inventory session to database
 *
 * Request: JSON
 * {
 *   location?: string,
 *   transcription?: string,
 *   products: ExtractedProduct[],
 *   audio_duration?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from JWT token
    const token = request.cookies.get('token')?.value;
    let userId: number | null = null;
    let userName: string | null = null;
    let companyName: string | null = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.odooUserId || decoded.id;
        userName = decoded.name;
        companyName = decoded.azienda;
      } catch (e) {
        console.warn('[VOICE-INVENTORY] Invalid token:', e);
      }
    }

    const body = await request.json();
    const { location, transcription, products, audio_duration } = body;

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({
        success: false,
        error: 'Lista prodotti mancante o non valida'
      }, { status: 400 });
    }

    console.log('[VOICE-INVENTORY] Saving inventory:', {
      userId,
      userName,
      companyName,
      location,
      productsCount: products.length,
      audioDuration: audio_duration
    });

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS voice_inventory_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER,
        user_name TEXT,
        company_name TEXT,
        location TEXT,
        transcription TEXT,
        products JSONB NOT NULL DEFAULT '[]',
        audio_duration INTEGER,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create index if not exists
    await sql`
      CREATE INDEX IF NOT EXISTS idx_voice_inventory_user ON voice_inventory_sessions(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_voice_inventory_created ON voice_inventory_sessions(created_at DESC)
    `;

    // Insert session
    const result = await sql`
      INSERT INTO voice_inventory_sessions (
        user_id,
        user_name,
        company_name,
        location,
        transcription,
        products,
        audio_duration,
        status
      ) VALUES (
        ${userId},
        ${userName},
        ${companyName},
        ${location || null},
        ${transcription || null},
        ${JSON.stringify(products)}::jsonb,
        ${audio_duration || null},
        'completed'
      )
      RETURNING id, created_at
    `;

    const sessionId = result.rows[0].id;
    const createdAt = result.rows[0].created_at;

    console.log('[VOICE-INVENTORY] Session saved:', sessionId);

    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        created_at: createdAt,
        location,
        products_count: products.length
      }
    });

  } catch (error) {
    console.error('[VOICE-INVENTORY] Save error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore durante il salvataggio';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
