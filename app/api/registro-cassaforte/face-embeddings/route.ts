import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Get database connection
function getDb() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('Database connection string not found');
  }
  return neon(connectionString);
}

interface FaceEmbedding {
  id?: number;
  employee_id: number;
  employee_name: string;
  embedding: number[];
  created_at?: string;
}

// Initialize table if it doesn't exist
async function ensureTable() {
  const sql = getDb();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS face_embeddings (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL UNIQUE,
        employee_name TEXT NOT NULL,
        embedding DOUBLE PRECISION[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_face_embeddings_employee_id
      ON face_embeddings(employee_id)
    `;
  } catch (error) {
    // Table might already exist, ignore error
    console.log('Table check/creation:', error);
  }
}

/**
 * GET /api/registro-cassaforte/face-embeddings
 * Get all enrolled face embeddings
 */
export async function GET() {
  try {
    await ensureTable();
    const sql = getDb();

    const embeddings = await sql`
      SELECT employee_id, employee_name, embedding, created_at
      FROM face_embeddings
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      embeddings: embeddings || [],
    });

  } catch (error: any) {
    console.error('Get face embeddings error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      embeddings: [],
    });
  }
}

/**
 * POST /api/registro-cassaforte/face-embeddings
 * Save a new face embedding
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id, employee_name, embedding } = body;

    if (!employee_id || !employee_name || !embedding) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: employee_id, employee_name, embedding',
      }, { status: 400 });
    }

    if (!Array.isArray(embedding) || embedding.length !== 128) {
      return NextResponse.json({
        success: false,
        error: 'Invalid embedding: must be array of 128 numbers',
      }, { status: 400 });
    }

    await ensureTable();
    const sql = getDb();

    // Upsert: insert or update if employee_id already exists
    const result = await sql`
      INSERT INTO face_embeddings (employee_id, employee_name, embedding, created_at)
      VALUES (${employee_id}, ${employee_name}, ${embedding}, NOW())
      ON CONFLICT (employee_id)
      DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        embedding = EXCLUDED.embedding,
        created_at = NOW()
      RETURNING *
    `;

    console.log(`✅ Face embedding saved for ${employee_name} (ID: ${employee_id})`);

    return NextResponse.json({
      success: true,
      message: 'Face embedding saved',
      data: result[0],
    });

  } catch (error: any) {
    console.error('Save face embedding error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * DELETE /api/registro-cassaforte/face-embeddings
 * Delete face embedding for an employee
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');

    if (!employeeId) {
      return NextResponse.json({
        success: false,
        error: 'Missing employee_id parameter',
      }, { status: 400 });
    }

    await ensureTable();
    const sql = getDb();

    await sql`
      DELETE FROM face_embeddings
      WHERE employee_id = ${parseInt(employeeId)}
    `;

    console.log(`🗑️ Face embedding deleted for employee ${employeeId}`);

    return NextResponse.json({
      success: true,
      message: 'Face embedding deleted',
    });

  } catch (error: any) {
    console.error('Delete face embedding error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
