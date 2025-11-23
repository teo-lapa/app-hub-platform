/**
 * API: Review Manager - Initialize Database
 * POST /api/review-manager/init-db - Crea le tabelle nel database
 *
 * ATTENZIONE: Eseguire solo una volta per setup iniziale!
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    // Verifica autorizzazione (solo in dev o con secret)
    const authHeader = request.headers.get('authorization');
    const initSecret = process.env.INIT_DB_SECRET || 'review-manager-init-2024';

    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${initSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[INIT-DB] Inizializzazione database Review Manager...');

    // Crea le tabelle
    await sql`
      -- Table 1: Businesses (Clienti/Ristoranti)
      CREATE TABLE IF NOT EXISTS rm_businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        owner_name VARCHAR(255),
        owner_email VARCHAR(255),
        owner_phone VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(50) DEFAULT 'IT',
        logo_url TEXT,
        response_mode VARCHAR(20) DEFAULT 'manual' CHECK (response_mode IN ('auto', 'manual')),
        response_tone VARCHAR(50) DEFAULT 'friendly' CHECK (response_tone IN ('friendly', 'elegant', 'professional', 'casual')),
        response_languages TEXT[] DEFAULT ARRAY['IT'],
        is_active BOOLEAN DEFAULT true,
        subscription_plan VARCHAR(50) DEFAULT 'basic',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      -- Table 2: Platform Credentials
      CREATE TABLE IF NOT EXISTS rm_platform_credentials (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES rm_businesses(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL CHECK (platform IN ('google', 'instagram', 'tiktok', 'facebook', 'trustpilot')),
        platform_account_id VARCHAR(255),
        platform_account_name VARCHAR(255),
        platform_page_id VARCHAR(255),
        google_place_id VARCHAR(255),
        google_location_id VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        api_key TEXT,
        api_secret TEXT,
        is_connected BOOLEAN DEFAULT false,
        last_sync_at TIMESTAMP,
        sync_error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(business_id, platform)
      )
    `;

    await sql`
      -- Table 3: Reviews
      CREATE TABLE IF NOT EXISTS rm_reviews (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES rm_businesses(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL CHECK (platform IN ('google', 'instagram', 'tiktok', 'facebook', 'trustpilot')),
        platform_review_id VARCHAR(255),
        platform_url TEXT,
        reviewer_name VARCHAR(255),
        reviewer_profile_url TEXT,
        reviewer_photo_url TEXT,
        reviewer_is_local_guide BOOLEAN DEFAULT false,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(500),
        content TEXT,
        language VARCHAR(10) DEFAULT 'it',
        sentiment_score DECIMAL(3,2),
        sentiment_label VARCHAR(20),
        key_topics TEXT[],
        response_status VARCHAR(30) DEFAULT 'pending' CHECK (response_status IN (
          'pending', 'ai_generated', 'approved', 'published', 'rejected', 'failed'
        )),
        ai_suggested_response TEXT,
        final_response TEXT,
        responded_at TIMESTAMP,
        response_error TEXT,
        review_date TIMESTAMP,
        fetched_at TIMESTAMP DEFAULT NOW(),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(business_id, platform, platform_review_id)
      )
    `;

    await sql`
      -- Table 4: Response Templates
      CREATE TABLE IF NOT EXISTS rm_response_templates (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES rm_businesses(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN (
          'positive_5star', 'positive_4star', 'neutral_3star',
          'negative_2star', 'negative_1star', 'generic'
        )),
        language VARCHAR(10) DEFAULT 'it',
        template_text TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      -- Table 5: Sync Logs
      CREATE TABLE IF NOT EXISTS rm_sync_logs (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES rm_businesses(id) ON DELETE CASCADE,
        platform VARCHAR(50),
        sync_type VARCHAR(30) CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
        status VARCHAR(20) CHECK (status IN ('started', 'completed', 'failed')),
        reviews_fetched INTEGER DEFAULT 0,
        reviews_new INTEGER DEFAULT 0,
        responses_published INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `;

    await sql`
      -- Table 6: Business Metrics
      CREATE TABLE IF NOT EXISTS rm_business_metrics (
        id SERIAL PRIMARY KEY,
        business_id INTEGER UNIQUE NOT NULL REFERENCES rm_businesses(id) ON DELETE CASCADE,
        total_reviews INTEGER DEFAULT 0,
        average_rating DECIMAL(3,2),
        google_reviews INTEGER DEFAULT 0,
        google_rating DECIMAL(3,2),
        instagram_comments INTEGER DEFAULT 0,
        tiktok_comments INTEGER DEFAULT 0,
        facebook_reviews INTEGER DEFAULT 0,
        facebook_rating DECIMAL(3,2),
        rating_5_count INTEGER DEFAULT 0,
        rating_4_count INTEGER DEFAULT 0,
        rating_3_count INTEGER DEFAULT 0,
        rating_2_count INTEGER DEFAULT 0,
        rating_1_count INTEGER DEFAULT 0,
        positive_count INTEGER DEFAULT 0,
        neutral_count INTEGER DEFAULT 0,
        negative_count INTEGER DEFAULT 0,
        avg_sentiment DECIMAL(3,2),
        total_responses INTEGER DEFAULT 0,
        response_rate DECIMAL(5,2),
        avg_response_time_hours INTEGER,
        last_review_date TIMESTAMP,
        last_calculated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Crea indici
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_businesses_slug ON rm_businesses(slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_businesses_active ON rm_businesses(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_credentials_business ON rm_platform_credentials(business_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_credentials_platform ON rm_platform_credentials(platform)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_reviews_business ON rm_reviews(business_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_reviews_platform ON rm_reviews(platform)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_reviews_status ON rm_reviews(response_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_reviews_rating ON rm_reviews(rating)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_reviews_date ON rm_reviews(review_date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rm_sync_logs_business ON rm_sync_logs(business_id)`;

    // Inserisci template di default (se non esistono)
    await sql`
      INSERT INTO rm_response_templates (business_id, name, category, language, template_text)
      SELECT NULL, 'Risposta 5 stelle IT', 'positive_5star', 'it',
        'Grazie mille per la fantastica recensione! Siamo felicissimi che la tua esperienza sia stata eccellente. Ti aspettiamo presto!'
      WHERE NOT EXISTS (SELECT 1 FROM rm_response_templates WHERE name = 'Risposta 5 stelle IT')
    `;

    await sql`
      INSERT INTO rm_response_templates (business_id, name, category, language, template_text)
      SELECT NULL, 'Risposta 1 stella IT', 'negative_1star', 'it',
        'Ci scusiamo sinceramente per la tua esperienza negativa. Prendiamo molto seriamente il tuo feedback. Ti preghiamo di contattarci direttamente per risolvere la situazione.'
      WHERE NOT EXISTS (SELECT 1 FROM rm_response_templates WHERE name = 'Risposta 1 stella IT')
    `;

    console.log('[INIT-DB] Database inizializzato con successo!');

    return NextResponse.json({
      success: true,
      message: 'Database Review Manager inizializzato con successo!',
      tables: [
        'rm_businesses',
        'rm_platform_credentials',
        'rm_reviews',
        'rm_response_templates',
        'rm_sync_logs',
        'rm_business_metrics'
      ]
    });

  } catch (error) {
    console.error('[INIT-DB] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore inizializzazione database'
      },
      { status: 500 }
    );
  }
}

// GET per verificare stato
export async function GET() {
  try {
    // Verifica se le tabelle esistono
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'rm_%'
    `;

    return NextResponse.json({
      success: true,
      initialized: result.rows.length > 0,
      tables: result.rows.map(r => r.table_name)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      initialized: false,
      error: error instanceof Error ? error.message : 'Errore verifica'
    });
  }
}
