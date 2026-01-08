/**
 * API Proxy to Railway Backend
 * Routes all /api/agents/* requests to Railway backend
 */

import { NextRequest, NextResponse } from 'next/server';

const RAILWAY_BACKEND_URL = process.env.LAPA_AGENTS_BACKEND_URL || 'http://localhost:8000';
const RAILWAY_API_SECRET = process.env.LAPA_AGENTS_API_SECRET || '';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');

  try {
    const response = await fetch(`${RAILWAY_BACKEND_URL}/api/${path}`, {
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Railway proxy error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');

  try {
    const body = await request.json();

    const response = await fetch(`${RAILWAY_BACKEND_URL}/api/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Railway proxy error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 502 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');

  try {
    const body = await request.json();

    const response = await fetch(`${RAILWAY_BACKEND_URL}/api/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Railway proxy error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 502 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');

  try {
    const response = await fetch(`${RAILWAY_BACKEND_URL}/api/${path}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Railway proxy error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 502 }
    );
  }
}
