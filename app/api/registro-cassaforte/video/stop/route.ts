import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reolink configuration
const REOLINK_IP = process.env.REOLINK_IP || '10.0.0.50';
const REOLINK_USERNAME = process.env.REOLINK_USERNAME || 'admin';
const REOLINK_PASSWORD = process.env.REOLINK_PASSWORD || 'admin';

/**
 * Get authentication token from Reolink
 */
async function getReolinkToken(): Promise<string> {
  const url = `http://${REOLINK_IP}/api.cgi?cmd=Login`;

  const body = [{
    cmd: 'Login',
    action: 0,
    param: {
      User: {
        userName: REOLINK_USERNAME,
        password: REOLINK_PASSWORD,
      },
    },
  }];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json();
  const token = data[0]?.value?.Token?.name;

  if (!token) {
    throw new Error('Failed to get Reolink auth token');
  }

  return token;
}

/**
 * POST /api/registro-cassaforte/video/stop
 * Ferma la registrazione video sulla telecamera Reolink
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { session_id, payment_id } = body;

    console.log(`📹 Stop registrazione video - Session: ${session_id}`);
    if (payment_id) {
      console.log(`   Payment ID: ${payment_id}`);
    }

    try {
      // Get auth token
      const token = await getReolinkToken();

      // Stop manual recording
      const url = `http://${REOLINK_IP}/api.cgi?cmd=StopRec&token=${token}`;
      const stopBody = [{
        cmd: 'StopRec',
        action: 0,
        param: {
          Rec: {
            channel: 0,
          },
        },
      }];

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stopBody),
        signal: AbortSignal.timeout(10000),
      });

      const result = await response.json();
      console.log('📹 Reolink StopRec response:', result);

      // The recording is saved on the camera's SD card
      // Format: /recordings/YYYYMMDD/RecHHMMSS.mp4
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const estimatedPath = `/recordings/${dateStr}/`;

      return NextResponse.json({
        success: true,
        session_id: session_id,
        message: 'Registrazione video terminata',
        recording_path: estimatedPath,
        end_time: now.toISOString(),
      });

    } catch (cameraError: any) {
      console.warn('⚠️ Telecamera non raggiungibile:', cameraError.message);

      return NextResponse.json({
        success: true,
        session_id: session_id,
        message: 'Stop registrazione - telecamera offline',
        camera_offline: true,
      });
    }

  } catch (error: any) {
    console.error('❌ Errore stop registrazione:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante stop registrazione',
    }, { status: 500 });
  }
}
