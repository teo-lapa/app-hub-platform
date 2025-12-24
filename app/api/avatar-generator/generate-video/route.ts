import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';

// D-ID API Configuration
const DID_API_URL = 'https://api.d-id.com';
const DID_API_KEY = process.env.DID_API_KEY || '';

// Job type definition
interface VideoJob {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  step?: string;
  videoUrl?: string;
  error?: string;
  createdAt: number;
  didTalkId?: string;
}

// Helper functions for KV storage
async function getJob(jobId: string): Promise<VideoJob | null> {
  try {
    return await kv.get<VideoJob>(`avatar-job:${jobId}`);
  } catch (error) {
    console.error(`Error getting job ${jobId}:`, error);
    return null;
  }
}

async function setJob(jobId: string, job: VideoJob): Promise<void> {
  try {
    await kv.set(`avatar-job:${jobId}`, job, { ex: 3600 });
  } catch (error) {
    console.error(`Error setting job ${jobId}:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photoUrl, photoBase64, script, voice = 'it-IT-IsabellaNeural' } = body;

    // Validate
    if (!photoUrl && !photoBase64) {
      return NextResponse.json(
        { success: false, error: 'Foto mancante' },
        { status: 400 }
      );
    }

    if (!script || script.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Testo mancante' },
        { status: 400 }
      );
    }

    if (!DID_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'D-ID API key non configurata' },
        { status: 500 }
      );
    }

    const jobId = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log(`🎬 Starting D-ID video generation: ${jobId}`);

    // Initialize job
    await setJob(jobId, {
      status: 'queued',
      progress: 0,
      step: 'Inizializzazione...',
      createdAt: Date.now()
    });

    // Prepare image URL
    let imageUrl = photoUrl;
    if (photoBase64 && !photoUrl) {
      const imageBuffer = Buffer.from(photoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const blob = await put(`avatar-photo-${jobId}.png`, imageBuffer, {
        access: 'public',
        contentType: 'image/png',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: true,
      });
      imageUrl = blob.url;
    }

    // Update progress
    await setJob(jobId, {
      status: 'processing',
      progress: 20,
      step: 'Creazione video con D-ID...',
      createdAt: Date.now()
    });

    // Create talk with D-ID
    const createResponse = await fetch(`${DID_API_URL}/talks`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_url: imageUrl,
        script: {
          type: 'text',
          input: script,
          provider: {
            type: 'microsoft',
            voice_id: voice
          }
        },
        config: {
          stitch: true,
          result_format: 'mp4'
        }
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      console.error('D-ID create error:', errorData);

      await setJob(jobId, {
        status: 'failed',
        error: errorData.message || `Errore D-ID: ${createResponse.status}`,
        createdAt: Date.now()
      });

      return NextResponse.json({
        success: false,
        error: errorData.message || 'Errore nella creazione del video'
      }, { status: 500 });
    }

    const createData = await createResponse.json();
    const talkId = createData.id;

    console.log(`✅ D-ID talk created: ${talkId}`);

    // Save talk ID for polling
    await setJob(jobId, {
      status: 'processing',
      progress: 40,
      step: 'Generazione video in corso...',
      createdAt: Date.now(),
      didTalkId: talkId
    });

    // Start polling in background
    pollDIDStatus(jobId, talkId);

    return NextResponse.json({
      success: true,
      jobId,
      status: 'processing',
      message: 'Video in generazione'
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}

async function pollDIDStatus(jobId: string, talkId: string) {
  const maxAttempts = 60; // 5 minutes
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const response = await fetch(`${DID_API_URL}/talks/${talkId}`, {
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
        }
      });

      const data = await response.json();

      console.log(`📊 D-ID status for ${talkId}: ${data.status}`);

      if (data.status === 'done' && data.result_url) {
        // Download and save to blob
        const videoResponse = await fetch(data.result_url);
        const videoBuffer = await videoResponse.arrayBuffer();

        const blob = await put(`avatar-video-${jobId}.mp4`, Buffer.from(videoBuffer), {
          access: 'public',
          contentType: 'video/mp4',
          token: process.env.BLOB_READ_WRITE_TOKEN,
          addRandomSuffix: true,
        });

        await setJob(jobId, {
          status: 'completed',
          progress: 100,
          step: 'Completato!',
          videoUrl: blob.url,
          createdAt: Date.now(),
          didTalkId: talkId
        });

        console.log(`✅ Video completed: ${blob.url}`);
        return;
      }

      if (data.status === 'error' || data.status === 'rejected') {
        await setJob(jobId, {
          status: 'failed',
          error: data.error?.message || 'Generazione video fallita',
          createdAt: Date.now(),
          didTalkId: talkId
        });
        return;
      }

      // Update progress
      const progress = Math.min(90, 40 + attempts * 2);
      await setJob(jobId, {
        status: 'processing',
        progress,
        step: `Elaborazione... (${attempts * 5}s)`,
        createdAt: Date.now(),
        didTalkId: talkId
      });

      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.error('Polling error:', error);
    }
  }

  // Timeout
  await setJob(jobId, {
    status: 'failed',
    error: 'Timeout - il video sta impiegando troppo tempo',
    createdAt: Date.now(),
    didTalkId: talkId
  });
}

// GET endpoint for status
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID mancante' },
        { status: 400 }
      );
    }

    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      status: job.status,
      progress: job.progress,
      step: job.step,
      videoUrl: job.videoUrl,
      error: job.error
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
