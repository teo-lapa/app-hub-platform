import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';
import { verifyCassaforteAuth } from '@/lib/registro-cassaforte/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'hr.employee';

/**
 * GET /api/registro-cassaforte/face-embeddings
 * Legge gli embedding dai record hr.employee (campo custom x_face_embedding).
 */
export async function GET(request: NextRequest) {
  const authError = verifyCassaforteAuth(request);
  if (authError) return authError;

  try {
    const client = await getOdooClient();
    const rows = await client.searchReadKw(
      MODEL,
      [['x_face_embedding', '!=', false]],
      ['id', 'name', 'x_face_embedding'],
      { limit: 500 }
    );

    const embeddings = (rows || [])
      .map((r: any) => {
        let arr: number[] = [];
        try { arr = JSON.parse(r.x_face_embedding || '[]'); } catch { arr = []; }
        if (!Array.isArray(arr) || arr.length !== 128) return null;
        return {
          employee_id: r.id,
          employee_name: r.name,
          embedding: arr,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, embeddings });
  } catch (error: any) {
    console.error('Get face embeddings error:', error);
    return NextResponse.json({ success: false, error: error.message, embeddings: [] });
  }
}

/**
 * POST /api/registro-cassaforte/face-embeddings
 * Scrive l'embedding sul campo x_face_embedding del dipendente.
 */
export async function POST(request: NextRequest) {
  const authError = verifyCassaforteAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { employee_id, employee_name, embedding } = body;

    if (!employee_id || !embedding) {
      return NextResponse.json({ success: false, error: 'Missing required fields: employee_id, embedding' }, { status: 400 });
    }
    if (!Array.isArray(embedding) || embedding.length !== 128) {
      return NextResponse.json({ success: false, error: 'Invalid embedding: must be array of 128 numbers' }, { status: 400 });
    }

    const client = await getOdooClient();
    const ok = await client.write(MODEL, [employee_id], { x_face_embedding: JSON.stringify(embedding) });
    if (!ok) throw new Error('Write to hr.employee failed');

    console.log(`✅ Face embedding saved on hr.employee ${employee_id} (${employee_name})`);
    return NextResponse.json({ success: true, message: 'Face embedding saved' });
  } catch (error: any) {
    console.error('Save face embedding error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/registro-cassaforte/face-embeddings?employee_id=X
 */
export async function DELETE(request: NextRequest) {
  const authError = verifyCassaforteAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Missing employee_id parameter' }, { status: 400 });
    }

    const client = await getOdooClient();
    await client.write(MODEL, [parseInt(employeeId)], { x_face_embedding: false });

    return NextResponse.json({ success: true, message: 'Face embedding deleted' });
  } catch (error: any) {
    console.error('Delete face embedding error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
