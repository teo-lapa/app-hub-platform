import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

interface Location {
  id: string;
  company_id: number;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  qr_secret: string;
  is_active: boolean;
  created_at: string;
}

/**
 * GET /api/time-attendance/locations?company_id=xxx
 * Ottiene tutte le sedi di un'azienda
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'company_id richiesto',
      }, { status: 400 });
    }

    const result = await sql`
      SELECT
        id,
        company_id,
        name,
        address,
        latitude,
        longitude,
        radius_meters,
        qr_secret,
        is_active,
        created_at
      FROM ta_locations
      WHERE company_id = ${parseInt(companyId)}
        AND is_active = true
      ORDER BY name ASC
    `;

    const locations: Location[] = result.rows.map(row => ({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      address: row.address,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      radius_meters: row.radius_meters,
      qr_secret: row.qr_secret,
      is_active: row.is_active,
      created_at: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: locations,
    });

  } catch (error) {
    console.error('Locations GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel recupero delle sedi',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/time-attendance/locations
 * Crea una nuova sede
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, name, address, latitude, longitude, radius_meters = 100 } = body;

    if (!company_id || !name || latitude === undefined || longitude === undefined) {
      return NextResponse.json({
        success: false,
        error: 'company_id, name, latitude e longitude sono richiesti',
      }, { status: 400 });
    }

    // Genera codice segreto univoco per QR
    const qr_secret = crypto.randomBytes(32).toString('hex');

    const result = await sql`
      INSERT INTO ta_locations (
        company_id,
        name,
        address,
        latitude,
        longitude,
        radius_meters,
        qr_secret
      ) VALUES (
        ${company_id},
        ${name},
        ${address || null},
        ${latitude},
        ${longitude},
        ${radius_meters},
        ${qr_secret}
      )
      RETURNING *
    `;

    const location = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        id: location.id,
        company_id: location.company_id,
        name: location.name,
        address: location.address,
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        radius_meters: location.radius_meters,
        qr_secret: location.qr_secret,
        is_active: location.is_active,
      },
      message: 'Sede creata con successo',
    });

  } catch (error) {
    console.error('Locations POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella creazione della sede',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/time-attendance/locations?id=xxx
 * Disattiva una sede (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'id richiesto',
      }, { status: 400 });
    }

    await sql`
      UPDATE ta_locations
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Sede disattivata',
    });

  } catch (error) {
    console.error('Locations DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella disattivazione della sede',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
