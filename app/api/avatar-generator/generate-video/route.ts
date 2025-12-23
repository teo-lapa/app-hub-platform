import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { put } from '@vercel/blob';
import { sql } from '@vercel/postgres';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Initialize database table if not exists
async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS avatar_video_jobs (
        job_id VARCHAR(100) PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        progress INTEGER DEFAULT 0,
        step TEXT,
        video_url TEXT,
        error TEXT,
        provider VARCHAR(10),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
        CHECK (provider IS NULL OR provider IN ('sora', 'veo'))
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_avatar_jobs_created_at ON avatar_video_jobs(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_avatar_jobs_status ON avatar_video_jobs(status)`;
  } catch (error) {
    console.error('Database initialization error (may already exist):', error);
  }
}

// Database helpers for job persistence
async function getJob(jobId: string) {
  const result = await sql`
    SELECT * FROM avatar_video_jobs WHERE job_id = ${jobId}
  `;
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    status: row.status,
    progress: row.progress,
    step: row.step,
    videoUrl: row.video_url,
    error: row.error,
    createdAt: row.created_at,
    provider: row.provider,
  };
}

async function setJob(jobId: string, data: {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  step?: string;
  videoUrl?: string;
  error?: string;
  createdAt?: number;
  provider?: 'sora' | 'veo';
}) {
  const now = Date.now();
  await sql`
    INSERT INTO avatar_video_jobs (
      job_id, status, progress, step, video_url, error, provider, created_at, updated_at
    ) VALUES (
      ${jobId},
      ${data.status},
      ${data.progress || 0},
      ${data.step || null},
      ${data.videoUrl || null},
      ${data.error || null},
      ${data.provider || null},
      ${data.createdAt || now},
      ${now}
    )
    ON CONFLICT (job_id) DO UPDATE SET
      status = EXCLUDED.status,
      progress = EXCLUDED.progress,
      step = EXCLUDED.step,
      video_url = EXCLUDED.video_url,
      error = EXCLUDED.error,
      provider = EXCLUDED.provider,
      updated_at = EXCLUDED.updated_at
  `;
}

// Pricing info (USD per second)
const PRICING = {
  sora2: { standard: 0.10, pro: 0.30 },
  veo31: { standard: 0.40, withAudio: 0.75 }
};

export async function POST(request: NextRequest) {
  try {
    // Ensure database table exists
    await initDatabase();

    const body = await request.json();
    const { photoUrl, photoBase64, script, outfit, background, voice = 'alloy', provider = 'sora' } = body;

    // Validate required fields
    if (!photoUrl && !photoBase64) {
      return NextResponse.json(
        { success: false, error: 'Foto mancante (URL o base64)' },
        { status: 400 }
      );
    }

    if (!script || script.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Script mancante' },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Estimate video duration and cost
    const wordCount = script.split(/\s+/).length;
    const estimatedSeconds = Math.ceil(wordCount / 2.5); // ~150 words per minute = 2.5 words per second
    const estimatedCost = provider === 'sora'
      ? estimatedSeconds * PRICING.sora2.standard
      : estimatedSeconds * PRICING.veo31.withAudio;

    console.log(`🎬 Starting avatar video generation job: ${jobId}`);
    console.log(`   Provider: ${provider}`);
    console.log(`   Script: ${script.substring(0, 100)}...`);
    console.log(`   Estimated duration: ${estimatedSeconds}s`);
    console.log(`   Estimated cost: $${estimatedCost.toFixed(2)}`);

    // Initialize job status
    await setJob(jobId, {
      status: 'queued',
      progress: 0,
      step: 'Inizializzazione...',
      createdAt: Date.now(),
      provider: provider as 'sora' | 'veo'
    });

    // Start async video generation
    generateAvatarVideoAsync(jobId, {
      photoUrl,
      photoBase64,
      script,
      outfit,
      background,
      voice,
      provider
    }).catch(async error => {
      console.error(`❌ Error in async video generation for job ${jobId}:`, error);
      await setJob(jobId, {
        status: 'failed',
        error: error.message || 'Errore durante la generazione del video',
        createdAt: Date.now()
      });
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued',
      estimatedDuration: estimatedSeconds,
      estimatedCost: estimatedCost.toFixed(2),
      message: 'Generazione avatar video avviata'
    });

  } catch (error: any) {
    console.error('❌ Error starting video generation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'avvio della generazione video'
      },
      { status: 500 }
    );
  }
}

async function generateAvatarVideoAsync(
  jobId: string,
  params: {
    photoUrl?: string;
    photoBase64?: string;
    script: string;
    outfit?: string;
    background?: string;
    voice?: string;
    provider?: string;
  }
) {
  const { photoUrl, photoBase64, script, outfit, background, voice = 'alloy', provider = 'sora' } = params;

  try {
    // Step 1: Prepare photo
    await updateJobProgress(jobId, 5, 'Elaborazione foto...', provider as 'sora' | 'veo');

    let imageUrl = photoUrl;
    if (photoBase64 && !photoUrl) {
      // Upload base64 to Vercel Blob
      const imageBuffer = Buffer.from(photoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const blob = await put(`avatar-photo-${jobId}.png`, imageBuffer, {
        access: 'public',
        contentType: 'image/png',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      imageUrl = blob.url;
    }

    // Step 2: Generate audio with OpenAI TTS
    await updateJobProgress(jobId, 15, 'Generazione voce AI...', provider as 'sora' | 'veo');

    const audioResponse = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: script,
      response_format: 'mp3',
      speed: 1.0,
    });

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const audioBlob = await put(`avatar-audio-${jobId}.mp3`, audioBuffer, {
      access: 'public',
      contentType: 'audio/mpeg',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log(`✅ Audio generated: ${audioBlob.url}`);

    // Step 3: Build optimized prompt for realistic avatar
    await updateJobProgress(jobId, 30, 'Preparazione prompt video...', provider as 'sora' | 'veo');

    const videoPrompt = buildRealisticAvatarPrompt(script, outfit, background);

    // Step 4: Generate video based on provider
    await updateJobProgress(jobId, 40, `Generazione video con ${provider === 'sora' ? 'OpenAI Sora 2' : 'Google Veo 3.1'}...`, provider as 'sora' | 'veo');

    let videoUrl: string;

    if (provider === 'sora') {
      videoUrl = await generateWithSora2(jobId, imageUrl!, audioBlob.url, videoPrompt);
    } else {
      videoUrl = await generateWithVeo31(jobId, imageUrl!, audioBlob.url, videoPrompt);
    }

    // Step 5: Finalize
    await updateJobProgress(jobId, 100, 'Video completato!', provider as 'sora' | 'veo');

    await setJob(jobId, {
      status: 'completed',
      progress: 100,
      step: 'Completato',
      videoUrl,
      createdAt: Date.now(),
      provider: provider as 'sora' | 'veo'
    });

    console.log(`✅ Avatar video generated successfully: ${videoUrl}`);

  } catch (error: any) {
    console.error(`❌ Failed to generate video for job ${jobId}:`, error);

    // Try fallback provider
    if (params.provider === 'sora') {
      console.log(`🔄 Trying fallback with Veo 3.1...`);
      try {
        await generateAvatarVideoAsync(jobId, { ...params, provider: 'veo' });
        return;
      } catch (fallbackError) {
        console.error(`❌ Fallback also failed:`, fallbackError);
      }
    }

    await setJob(jobId, {
      status: 'failed',
      error: error.message || 'Errore durante la generazione del video',
      createdAt: Date.now()
    });
  }
}

function buildRealisticAvatarPrompt(script: string, outfit?: string, background?: string): string {
  // Build prompt optimized for realistic talking avatar
  // Based on Sora 2 and Veo 3.1 best practices

  let prompt = `REALISTIC TALKING AVATAR VIDEO:

A professional video of a real person speaking directly to camera with natural, lifelike movements.

PERSON DESCRIPTION:
- Looking directly at the camera with confident, engaging eye contact
- Natural facial expressions that match the emotional tone of speech
- Subtle head movements and natural blinking
- Smooth, realistic lip sync perfectly matching the dialogue

`;

  if (outfit) {
    const outfitDescriptions: Record<string, string> = {
      business: 'Wearing a professional business suit with a crisp white shirt, looking polished and corporate',
      casual: 'Wearing a comfortable casual outfit - clean polo shirt or smart casual attire',
      chef: 'Wearing a professional white chef coat with LAPA branding, looking like an expert culinary professional',
      elegante: 'Wearing elegant formal attire, sophisticated and refined appearance',
      custom: outfit
    };
    prompt += `ATTIRE: ${outfitDescriptions[outfit] || outfit}\n\n`;
  }

  if (background) {
    const backgroundDescriptions: Record<string, string> = {
      office: 'Modern office environment with soft natural lighting, blurred background with subtle professional decor',
      ristorante: 'Warm, inviting restaurant setting with ambient lighting, bokeh background showing elegant dining area',
      cucina: 'Professional kitchen environment with stainless steel equipment visible in soft focus behind',
      neutro: 'Clean, neutral gradient background with professional studio lighting',
      custom: background
    };
    prompt += `SETTING: ${backgroundDescriptions[background] || background}\n\n`;
  }

  prompt += `DIALOGUE TO SPEAK:
"${script.substring(0, 500)}"

TECHNICAL REQUIREMENTS:
- Frame-perfect lip synchronization with audio
- 1080p high definition quality
- Stable, professional camera framing (medium shot, head and shoulders)
- Natural, warm lighting that flatters the subject
- Consistent character appearance throughout
- No uncanny valley effects - must look completely natural and human
`;

  return prompt;
}

async function generateWithSora2(
  jobId: string,
  imageUrl: string,
  audioUrl: string,
  prompt: string
): Promise<string> {
  await updateJobProgress(jobId, 50, 'Connessione a OpenAI Sora 2...', 'sora');

  try {
    // OpenAI Sora 2 API structure (based on official docs)
    // Note: API endpoint may vary - this is the expected structure

    const response = await fetch('https://api.openai.com/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora-2',
        prompt: prompt,
        image: imageUrl,
        audio: audioUrl,
        size: '1920x1080',
        duration: 'auto', // Let Sora determine duration based on audio
        style: 'photorealistic',
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check if Sora API is not yet available
      if (response.status === 404 || response.status === 400) {
        throw new Error('Sora 2 API non ancora disponibile pubblicamente. Provo con Veo 3.1...');
      }

      throw new Error(errorData.error?.message || `Sora API error: ${response.status}`);
    }

    const data = await response.json();

    await updateJobProgress(jobId, 70, 'Video in elaborazione da Sora 2...', 'sora');

    // Poll for completion if async
    if (data.id && data.status === 'processing') {
      return await pollSoraVideoStatus(jobId, data.id);
    }

    // Direct response
    if (data.video_url || data.url) {
      const videoUrl = data.video_url || data.url;
      return await saveVideoToBlob(jobId, videoUrl);
    }

    throw new Error('Risposta Sora non valida');

  } catch (error: any) {
    console.error('Sora 2 generation failed:', error);
    throw error;
  }
}

async function pollSoraVideoStatus(jobId: string, videoId: string): Promise<string> {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      }
    });

    const data = await response.json();

    if (data.status === 'completed' && data.video_url) {
      return await saveVideoToBlob(jobId, data.video_url);
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Generazione video fallita');
    }

    // Update progress
    const progress = 70 + Math.min(25, attempts * 0.5);
    await updateJobProgress(jobId, progress, `Elaborazione Sora 2... (${attempts * 5}s)`, 'sora');

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Timeout generazione video Sora 2');
}

async function generateWithVeo31(
  jobId: string,
  imageUrl: string,
  audioUrl: string,
  prompt: string
): Promise<string> {
  await updateJobProgress(jobId, 50, 'Connessione a Google Veo 3.1...', 'veo');

  try {
    // Fetch image as base64
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

    // Google Veo 3.1 API via Gemini
    // Using the generativelanguage API endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{
            prompt: prompt,
            image: {
              bytesBase64Encoded: imageBase64,
              mimeType: mimeType
            }
          }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '16:9',
            personGeneration: 'allow_all', // Allow generating people
            durationSeconds: 8, // Max 8 seconds per clip
            enhancePrompt: true
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Veo API error: ${response.status}`);
    }

    const data = await response.json();

    await updateJobProgress(jobId, 70, 'Video in elaborazione da Veo 3.1...', 'veo');

    // Veo returns a long-running operation
    if (data.name) {
      return await pollVeoOperationStatus(jobId, data.name);
    }

    // Direct response (if available)
    if (data.predictions?.[0]?.video?.uri) {
      return await saveVideoToBlob(jobId, data.predictions[0].video.uri);
    }

    throw new Error('Risposta Veo non valida');

  } catch (error: any) {
    console.error('Veo 3.1 generation failed:', error);
    throw error;
  }
}

async function pollVeoOperationStatus(jobId: string, operationName: string): Promise<string> {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${process.env.GEMINI_API_KEY}`
    );

    const data = await response.json();

    if (data.done && data.response?.predictions?.[0]?.video) {
      const videoData = data.response.predictions[0].video;

      if (videoData.uri) {
        return await saveVideoToBlob(jobId, videoData.uri);
      }

      if (videoData.bytesBase64Encoded) {
        // Save base64 video to blob
        const videoBuffer = Buffer.from(videoData.bytesBase64Encoded, 'base64');
        const blob = await put(`avatar-video-${jobId}.mp4`, videoBuffer, {
          access: 'public',
          contentType: 'video/mp4',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        return blob.url;
      }
    }

    if (data.error) {
      throw new Error(data.error.message || 'Generazione video Veo fallita');
    }

    // Update progress based on metadata if available
    const progress = 70 + Math.min(25, attempts * 0.5);
    await updateJobProgress(jobId, progress, `Elaborazione Veo 3.1... (${attempts * 5}s)`, 'veo');

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Timeout generazione video Veo 3.1');
}

async function saveVideoToBlob(jobId: string, videoUrl: string): Promise<string> {
  await updateJobProgress(jobId, 95, 'Salvataggio video...', 'sora');

  const videoResponse = await fetch(videoUrl);
  const videoBuffer = await videoResponse.arrayBuffer();

  const blob = await put(`avatar-video-${jobId}.mp4`, Buffer.from(videoBuffer), {
    access: 'public',
    contentType: 'video/mp4',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return blob.url;
}

async function updateJobProgress(jobId: string, progress: number, step: string, provider?: 'sora' | 'veo') {
  const currentJob = await getJob(jobId);
  await setJob(jobId, {
    status: 'processing',
    progress,
    step,
    createdAt: currentJob?.createdAt || Date.now(),
    provider: provider || currentJob?.provider
  });
}

// GET endpoint to retrieve job status
export async function GET(request: NextRequest) {
  try {
    // Ensure database table exists
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

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
      error: job.error,
      provider: job.provider
    });

  } catch (error: any) {
    console.error('❌ Error retrieving job status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il recupero dello stato del job'
      },
      { status: 500 }
    );
  }
}
