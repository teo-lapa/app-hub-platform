import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// File-based storage for face embeddings (simple, no database required)
const DATA_DIR = path.join(process.cwd(), 'data');
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'face-embeddings.json');

interface FaceEmbedding {
  employee_id: number;
  employee_name: string;
  embedding: number[];
  created_at: string;
}

/**
 * Load embeddings from file
 */
async function loadEmbeddings(): Promise<FaceEmbedding[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(EMBEDDINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save embeddings to file
 */
async function saveEmbeddings(embeddings: FaceEmbedding[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));
}

/**
 * GET /api/registro-cassaforte/face-embeddings
 * Get all enrolled face embeddings
 */
export async function GET() {
  try {
    const embeddings = await loadEmbeddings();

    return NextResponse.json({
      success: true,
      embeddings,
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

    // Load existing embeddings
    const embeddings = await loadEmbeddings();

    // Remove existing embedding for this employee (if any)
    const filteredEmbeddings = embeddings.filter(e => e.employee_id !== employee_id);

    // Add new embedding
    const newEmbedding: FaceEmbedding = {
      employee_id,
      employee_name,
      embedding,
      created_at: new Date().toISOString(),
    };

    filteredEmbeddings.push(newEmbedding);

    // Save to file
    await saveEmbeddings(filteredEmbeddings);

    console.log(`✅ Face embedding saved for ${employee_name} (ID: ${employee_id})`);

    return NextResponse.json({
      success: true,
      message: 'Face embedding saved',
      data: newEmbedding,
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

    // Load existing embeddings
    const embeddings = await loadEmbeddings();

    // Filter out the employee
    const filteredEmbeddings = embeddings.filter(e => e.employee_id !== parseInt(employeeId));

    // Save back
    await saveEmbeddings(filteredEmbeddings);

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
