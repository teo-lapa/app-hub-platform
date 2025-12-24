import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import OpenAI from 'openai';
import Replicate from 'replicate';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Job type
interface VideoJob {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  step?: string;
  videoUrl?: string;
  error?: string;
  createdAt: number;
}

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
    const { photoUrl, photoBase64, script, voice = 'onyx' } = body;

    // Validate
    if (!photoUrl && !photoBase64) {
      return NextResponse.json({ success: false, error: 'Foto mancante' }, { status: 400 });
    }

    if (!script || script.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Testo mancante' }, { status: 400 });
    }

    const jobId = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`🎬 Starting avatar generation: ${jobId}`);

    // Initialize job
    await setJob(jobId, {
      status: 'queued',
      progress: 0,
      step: 'Inizializzazione...',
      createdAt: Date.now()
    });

    // Start async generation
    generateVideoAsync(jobId, { photoUrl, photoBase64, script, voice });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'processing',
      message: 'Generazione avviata'
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function generateVideoAsync(
  jobId: string,
  params: { photoUrl?: string; photoBase64?: string; script: string; voice: string }
) {
  const { photoUrl, photoBase64, script, voice } = params;

  try {
    // Step 1: Upload photo
    await setJob(jobId, { status: 'processing', progress: 10, step: 'Caricamento foto...', createdAt: Date.now() });

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

    console.log(`✅ Photo ready: ${imageUrl}`);

    // Step 2: Generate audio with OpenAI TTS
    await setJob(jobId, { status: 'processing', progress: 30, step: 'Generazione voce...', createdAt: Date.now() });

    const audioResponse = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: script,
      response_format: 'mp3',
    });

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const audioBlob = await put(`avatar-audio-${jobId}.mp3`, audioBuffer, {
      access: 'public',
      contentType: 'audio/mpeg',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });

    console.log(`✅ Audio ready: ${audioBlob.url}`);

    // Step 3: Generate video with SadTalker on Replicate
    await setJob(jobId, { status: 'processing', progress: 50, step: 'Generazione video con AI...', createdAt: Date.now() });

    console.log('🎥 Starting SadTalker...');

    const output = await replicate.run(
      "cjwbw/sadtalker:a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3",
      {
        input: {
          source_image: imageUrl,
          driven_audio: audioBlob.url,
          preprocess: "crop",
          still_mode: true,
          use_enhancer: true,
          use_eyeblink: true,
          size_of_image: 512,
          pose_style: 0,
          expression_scale: 1.0,
        }
      }
    );

    console.log('✅ SadTalker output:', output);

    // Step 4: Save video to blob
    await setJob(jobId, { status: 'processing', progress: 90, step: 'Salvataggio video...', createdAt: Date.now() });

    const videoUrl = output as unknown as string;
    const videoResponse = await fetch(videoUrl);
    const videoBuffer = await videoResponse.arrayBuffer();

    const videoBlob = await put(`avatar-video-${jobId}.mp4`, Buffer.from(videoBuffer), {
      access: 'public',
      contentType: 'video/mp4',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });

    console.log(`✅ Video saved: ${videoBlob.url}`);

    // Done!
    await setJob(jobId, {
      status: 'completed',
      progress: 100,
      step: 'Completato!',
      videoUrl: videoBlob.url,
      createdAt: Date.now()
    });

  } catch (error: any) {
    console.error(`❌ Generation failed for ${jobId}:`, error);
    await setJob(jobId, {
      status: 'failed',
      error: error.message || 'Errore durante la generazione',
      createdAt: Date.now()
    });
  }
}

// GET for status polling
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Job ID mancante' }, { status: 400 });
    }

    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job non trovato' }, { status: 404 });
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
