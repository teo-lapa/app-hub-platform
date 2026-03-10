import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const INFRA_SECRET = process.env.INFRA_MONITOR_SECRET || 'lapa-infra-2026-secret';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${INFRA_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    if (!data || !data.devices) {
      return NextResponse.json({ error: 'Invalid data: missing devices' }, { status: 400 });
    }

    // Store the full status snapshot
    await kv.set('infra:status', {
      ...data,
      receivedAt: new Date().toISOString(),
    });

    // Store history entry (keep last 100)
    const historyKey = 'infra:history';
    const historyEntry = {
      timestamp: data.timestamp || new Date().toISOString(),
      summary: data.summary,
    };
    await kv.lpush(historyKey, historyEntry);
    await kv.ltrim(historyKey, 0, 99);

    return NextResponse.json({
      success: true,
      message: 'Infrastructure status updated',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Infra Monitor] Update error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
