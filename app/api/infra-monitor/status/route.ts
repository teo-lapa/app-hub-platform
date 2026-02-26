import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InfraStatus {
  timestamp: string;
  receivedAt: string;
  devices: any[];
  agents: any[];
  odoo: any;
  summary: any;
}

export async function GET(request: NextRequest) {
  try {
    const status = await kv.get<InfraStatus>('infra:status');

    if (!status) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No infrastructure data available yet. Collector not running.',
      });
    }

    // Calculate freshness
    const receivedAt = new Date(status.receivedAt || status.timestamp);
    const ageMs = Date.now() - receivedAt.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);
    const isStale = ageMinutes > 5;

    return NextResponse.json({
      success: true,
      data: status,
      meta: {
        ageMinutes,
        isStale,
        lastUpdate: status.receivedAt || status.timestamp,
      },
    });
  } catch (error: any) {
    console.error('[Infra Monitor] Status read error:', error);
    return NextResponse.json(
      { error: 'Failed to read infrastructure status', details: error.message },
      { status: 500 }
    );
  }
}

// Also support getting history
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'history') {
      const history = await kv.lrange('infra:history', 0, 49);
      return NextResponse.json({ success: true, data: history });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Infra Monitor] History error:', error);
    return NextResponse.json(
      { error: 'Failed to read history', details: error.message },
      { status: 500 }
    );
  }
}
