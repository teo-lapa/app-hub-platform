import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}

export async function HEAD(req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}