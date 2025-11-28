import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reolink configuration
const REOLINK_IP = process.env.REOLINK_IP || '10.0.0.50';
const REOLINK_USERNAME = process.env.REOLINK_USERNAME || 'admin';
const REOLINK_PASSWORD = process.env.REOLINK_PASSWORD || 'admin';

// Active recording sessions
const activeSessions = new Map<string, { startTime: Date; token: string }>();

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rec_${timestamp}_${random}`;
}

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
 * POST /api/registro-cassaforte/video/start
 * Avvia la registrazione video sulla telecamera Reolink
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { employee_id, employee_name, deposit_type } = body;

    const sessionId = generateSessionId();

    console.log(`📹 Avvio registrazione video - Session: ${sessionId}`);
    console.log(`   Dipendente: ${employee_name} (ID: ${employee_id})`);
    console.log(`   Tipo: ${deposit_type}`);

    try {
      // Get auth token
      const token = await getReolinkToken();

      // Start manual recording
      const url = `http://${REOLINK_IP}/api.cgi?cmd=StartRec&token=${token}`;
      const startBody = [{
        cmd: 'StartRec',
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
        body: JSON.stringify(startBody),
        signal: AbortSignal.timeout(10000),
      });

      const result = await response.json();
      console.log('📹 Reolink StartRec response:', result);

      // Check for success
      const success = result[0]?.code === 0 || result[0]?.value?.rspCode === 200;

      if (success) {
        // Store session
        activeSessions.set(sessionId, {
          startTime: new Date(),
          token: token,
        });

        return NextResponse.json({
          success: true,
          session_id: sessionId,
          message: 'Registrazione video avviata',
          camera_ip: REOLINK_IP,
        });
      } else {
        throw new Error(result[0]?.error?.detail || 'Failed to start recording');
      }

    } catch (cameraError: any) {
      console.warn('⚠️ Telecamera non raggiungibile:', cameraError.message);

      // Return success anyway but mark camera as offline
      // The deposit can still proceed without video
      return NextResponse.json({
        success: true,
        session_id: sessionId,
        message: 'Registrazione video non disponibile - telecamera offline',
        camera_offline: true,
      });
    }

  } catch (error: any) {
    console.error('❌ Errore avvio registrazione:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante avvio registrazione',
    }, { status: 500 });
  }
}
