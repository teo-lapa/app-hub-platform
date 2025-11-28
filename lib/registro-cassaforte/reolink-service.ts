/**
 * Reolink Camera Service
 * Gestisce la registrazione video dalla telecamera IP Reolink
 */

export interface ReolinkConfig {
  ip: string;
  username: string;
  password: string;
  channel?: number;
}

export interface RecordingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'stopped' | 'error';
  filePath?: string;
}

// Default configuration (can be overridden via env vars)
const DEFAULT_CONFIG: ReolinkConfig = {
  ip: process.env.REOLINK_IP || '10.0.0.50',
  username: process.env.REOLINK_USERNAME || 'admin',
  password: process.env.REOLINK_PASSWORD || 'admin',
  channel: 0,
};

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rec_${timestamp}_${random}`;
}

/**
 * Make an API call to the Reolink camera
 */
async function reolinkApiCall(
  config: ReolinkConfig,
  command: string,
  params: Record<string, any> = {}
): Promise<any> {
  const url = `http://${config.ip}/api.cgi`;

  const body = {
    cmd: command,
    action: 0,
    param: params,
  };

  // Reolink uses token-based auth
  const authUrl = `${url}?cmd=Login`;
  const authBody = [{
    cmd: 'Login',
    action: 0,
    param: {
      User: {
        userName: config.username,
        password: config.password,
      },
    },
  }];

  try {
    // First, get token
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authBody),
    });

    const authData = await authResponse.json();
    const token = authData[0]?.value?.Token?.name;

    if (!token) {
      throw new Error('Failed to get Reolink auth token');
    }

    // Then make the actual call
    const apiUrl = `${url}?cmd=${command}&token=${token}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([body]),
    });

    return await response.json();

  } catch (error: any) {
    console.error('Reolink API error:', error);
    throw error;
  }
}

/**
 * Start recording on the Reolink camera
 */
export async function startRecording(
  config: ReolinkConfig = DEFAULT_CONFIG
): Promise<RecordingSession> {
  const sessionId = generateSessionId();

  console.log(`📹 Starting Reolink recording - Session: ${sessionId}`);

  try {
    // Start manual recording
    const result = await reolinkApiCall(config, 'StartRec', {
      Rec: {
        channel: config.channel || 0,
      },
    });

    console.log('Reolink StartRec response:', result);

    return {
      id: sessionId,
      startTime: new Date(),
      status: 'recording',
    };

  } catch (error: any) {
    console.error('Failed to start Reolink recording:', error);

    return {
      id: sessionId,
      startTime: new Date(),
      status: 'error',
    };
  }
}

/**
 * Stop recording on the Reolink camera
 */
export async function stopRecording(
  sessionId: string,
  config: ReolinkConfig = DEFAULT_CONFIG
): Promise<RecordingSession> {
  console.log(`📹 Stopping Reolink recording - Session: ${sessionId}`);

  try {
    // Stop manual recording
    const result = await reolinkApiCall(config, 'StopRec', {
      Rec: {
        channel: config.channel || 0,
      },
    });

    console.log('Reolink StopRec response:', result);

    // The file will be saved on the camera's SD card
    // We can later retrieve it via FTP or the Reolink API

    return {
      id: sessionId,
      startTime: new Date(), // This should be passed from start
      endTime: new Date(),
      status: 'stopped',
      filePath: `/recordings/${sessionId}.mp4`, // Path on camera
    };

  } catch (error: any) {
    console.error('Failed to stop Reolink recording:', error);

    return {
      id: sessionId,
      startTime: new Date(),
      endTime: new Date(),
      status: 'error',
    };
  }
}

/**
 * Get RTSP stream URL for the camera
 */
export function getRtspUrl(config: ReolinkConfig = DEFAULT_CONFIG): string {
  return `rtsp://${config.username}:${config.password}@${config.ip}:554/h264Preview_01_main`;
}

/**
 * Get snapshot from the camera
 */
export async function getSnapshot(
  config: ReolinkConfig = DEFAULT_CONFIG
): Promise<Buffer | null> {
  try {
    const result = await reolinkApiCall(config, 'Snap', {
      Snap: {
        channel: config.channel || 0,
      },
    });

    // The snapshot might be returned as base64 or we need to fetch it separately
    if (result[0]?.value?.Snap?.fileName) {
      const snapshotUrl = `http://${config.ip}${result[0].value.Snap.fileName}`;
      const response = await fetch(snapshotUrl);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return null;

  } catch (error) {
    console.error('Failed to get Reolink snapshot:', error);
    return null;
  }
}

/**
 * Check if camera is online and accessible
 */
export async function checkCameraStatus(
  config: ReolinkConfig = DEFAULT_CONFIG
): Promise<{ online: boolean; recording: boolean }> {
  try {
    const result = await reolinkApiCall(config, 'GetDevInfo', {});

    return {
      online: true,
      recording: false, // Would need to check recording status
    };

  } catch (error) {
    return {
      online: false,
      recording: false,
    };
  }
}

export default {
  startRecording,
  stopRecording,
  getRtspUrl,
  getSnapshot,
  checkCameraStatus,
};
