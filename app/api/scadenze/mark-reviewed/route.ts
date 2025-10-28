import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';
import { MarkAsReviewedRequest, MarkAsReviewedResponse } from '@/lib/types/expiry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Path per il file JSON di fallback
const JSON_BACKUP_PATH = path.join('/tmp', 'expiry_reviews.json');

/**
 * POST /api/scadenze/mark-reviewed
 * Marca un prodotto come verificato fisicamente
 *
 * Strategia:
 * 1. Prova ad usare Postgres (crea tabella se non esiste)
 * 2. Se Postgres non è disponibile, usa file JSON in /tmp
 */
export async function POST(request: NextRequest) {
  try {
    const body: MarkAsReviewedRequest = await request.json();

    // Validazione input
    if (!body.productId || !body.lotId || !body.locationId || !body.reviewedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campi obbligatori mancanti: productId, lotId, locationId, reviewedBy'
        } as MarkAsReviewedResponse,
        { status: 400 }
      );
    }

    console.log('📝 Salvataggio review prodotto:', {
      productId: body.productId,
      lotId: body.lotId,
      locationId: body.locationId,
      reviewedBy: body.reviewedBy,
      note: body.note
    });

    // Prova prima con Postgres
    try {
      const reviewId = await saveToPostgres(body);

      console.log('✅ Review salvata in Postgres:', reviewId);

      return NextResponse.json({
        success: true,
        reviewId,
        message: 'Review salvata con successo in database'
      } as MarkAsReviewedResponse);

    } catch (pgError: any) {
      console.warn('⚠️ Postgres non disponibile, uso fallback JSON:', pgError.message);

      // Fallback: salva su file JSON
      const reviewId = await saveToJsonFile(body);

      console.log('✅ Review salvata in file JSON:', reviewId);

      return NextResponse.json({
        success: true,
        reviewId,
        message: 'Review salvata con successo in file locale'
      } as MarkAsReviewedResponse);
    }

  } catch (error: any) {
    console.error('❌ Errore salvataggio review:', error);
    console.error('Stack trace:', error.stack);

    return NextResponse.json(
      {
        success: false,
        error: 'Errore durante il salvataggio della review',
        details: error.message
      } as MarkAsReviewedResponse,
      { status: 500 }
    );
  }
}

/**
 * Salva la review in Postgres
 * Crea la tabella se non esiste
 */
async function saveToPostgres(data: MarkAsReviewedRequest): Promise<number> {
  // 1. Crea tabella se non esiste
  await sql`
    CREATE TABLE IF NOT EXISTS expiry_reviews (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      lot_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      reviewed_at TIMESTAMP DEFAULT NOW(),
      reviewed_by VARCHAR(255) NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // 2. Crea indici per performance (se non esistono)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_expiry_reviews_product
    ON expiry_reviews(product_id, lot_id, location_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_expiry_reviews_date
    ON expiry_reviews(reviewed_at DESC)
  `;

  // 3. Inserisci record
  const result = await sql`
    INSERT INTO expiry_reviews (
      product_id,
      lot_id,
      location_id,
      reviewed_by,
      note
    ) VALUES (
      ${data.productId},
      ${data.lotId},
      ${data.locationId},
      ${data.reviewedBy},
      ${data.note || null}
    )
    RETURNING id
  `;

  return result.rows[0].id;
}

/**
 * Salva la review in file JSON (fallback)
 */
async function saveToJsonFile(data: MarkAsReviewedRequest): Promise<number> {
  try {
    // Assicurati che /tmp esista (su Windows usa TEMP)
    const tmpDir = process.platform === 'win32'
      ? process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp'
      : '/tmp';

    const jsonPath = path.join(tmpDir, 'expiry_reviews.json');

    // Leggi reviews esistenti o inizializza array vuoto
    let reviews: any[] = [];

    if (fs.existsSync(jsonPath)) {
      try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        reviews = JSON.parse(content);

        // Assicurati che sia un array
        if (!Array.isArray(reviews)) {
          reviews = [];
        }
      } catch (parseError) {
        console.warn('⚠️ File JSON corrotto, reinizializzo:', parseError);
        reviews = [];
      }
    }

    // Genera ID incrementale
    const newId = reviews.length > 0
      ? Math.max(...reviews.map(r => r.id || 0)) + 1
      : 1;

    // Crea nuovo record
    const newReview = {
      id: newId,
      product_id: data.productId,
      lot_id: data.lotId,
      location_id: data.locationId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: data.reviewedBy,
      note: data.note || null,
      created_at: new Date().toISOString()
    };

    // Aggiungi alla lista
    reviews.push(newReview);

    // Salva su file con gestione errori
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(reviews, null, 2), 'utf-8');
    } catch (writeError: any) {
      // Se fallisce scrittura, prova path alternativo
      const altPath = path.join(process.cwd(), 'tmp', 'expiry_reviews.json');

      // Crea directory se non esiste
      const altDir = path.dirname(altPath);
      if (!fs.existsSync(altDir)) {
        fs.mkdirSync(altDir, { recursive: true });
      }

      fs.writeFileSync(altPath, JSON.stringify(reviews, null, 2), 'utf-8');
      console.log('📁 Review salvata in path alternativo:', altPath);
    }

    return newId;

  } catch (error: any) {
    console.error('❌ Errore scrittura JSON:', error);
    throw new Error(`Impossibile salvare review su file: ${error.message}`);
  }
}

/**
 * GET /api/scadenze/mark-reviewed
 * Recupera le reviews salvate
 *
 * Query params:
 * - product_id: filtra per prodotto
 * - lot_id: filtra per lotto
 * - location_id: filtra per ubicazione
 * - limit: numero massimo di risultati (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    const lotId = searchParams.get('lot_id');
    const locationId = searchParams.get('location_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Prova prima con Postgres
    try {
      const reviews = await getFromPostgres({ productId, lotId, locationId, limit });

      return NextResponse.json({
        success: true,
        reviews,
        count: reviews.length,
        source: 'postgres'
      });

    } catch (pgError) {
      console.warn('⚠️ Postgres non disponibile, uso fallback JSON');

      // Fallback: leggi da file JSON
      const reviews = await getFromJsonFile({ productId, lotId, locationId, limit });

      return NextResponse.json({
        success: true,
        reviews,
        count: reviews.length,
        source: 'json_file'
      });
    }

  } catch (error: any) {
    console.error('❌ Errore recupero reviews:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Errore durante il recupero delle reviews',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Recupera reviews da Postgres
 */
async function getFromPostgres(filters: {
  productId: string | null;
  lotId: string | null;
  locationId: string | null;
  limit: number;
}): Promise<any[]> {
  // Build conditions array
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.productId) {
    conditions.push(`product_id = ${parseInt(filters.productId)}`);
  }
  if (filters.lotId) {
    conditions.push(`lot_id = ${parseInt(filters.lotId)}`);
  }
  if (filters.locationId) {
    conditions.push(`location_id = ${parseInt(filters.locationId)}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await sql.query(
    `SELECT * FROM expiry_reviews ${whereClause} ORDER BY reviewed_at DESC LIMIT ${filters.limit}`
  );

  return result.rows;
}

/**
 * Recupera reviews da file JSON
 */
async function getFromJsonFile(filters: {
  productId: string | null;
  lotId: string | null;
  locationId: string | null;
  limit: number;
}): Promise<any[]> {
  const tmpDir = process.platform === 'win32'
    ? process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp'
    : '/tmp';

  const jsonPath = path.join(tmpDir, 'expiry_reviews.json');

  // Se file non esiste, ritorna array vuoto
  if (!fs.existsSync(jsonPath)) {
    return [];
  }

  // Leggi e filtra
  const content = fs.readFileSync(jsonPath, 'utf-8');
  let reviews = JSON.parse(content);

  if (!Array.isArray(reviews)) {
    return [];
  }

  // Applica filtri
  if (filters.productId) {
    reviews = reviews.filter((r: any) => r.product_id === parseInt(filters.productId!));
  }
  if (filters.lotId) {
    reviews = reviews.filter((r: any) => r.lot_id === parseInt(filters.lotId!));
  }
  if (filters.locationId) {
    reviews = reviews.filter((r: any) => r.location_id === parseInt(filters.locationId!));
  }

  // Ordina per data (più recenti prima) e limita
  reviews.sort((a: any, b: any) =>
    new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
  );

  return reviews.slice(0, filters.limit);
}
