import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOdooSession } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const workerKey = request.headers.get('X-Worker-Key');
    if (workerKey !== process.env.CATALOGO_WORKER_KEY) {
      const userCookies = request.headers.get('cookie');
      const { uid } = await getOdooSession(userCookies || undefined);
      if (!uid) {
        return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    let result;
    if (status) {
      result = await sql`
        SELECT * FROM catalog_photo_jobs
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT * FROM catalog_photo_jobs
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { operator_name, notes, photo_urls } = await request.json();

    if (!operator_name || !photo_urls?.length) {
      return NextResponse.json({ success: false, error: 'operator_name e photo_urls richiesti' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO catalog_photo_jobs (operator_name, notes, photo_urls, photo_count)
      VALUES (${operator_name}, ${notes || null}, ${JSON.stringify(photo_urls)}::jsonb, ${photo_urls.length})
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
