import { NextRequest, NextResponse } from 'next/server';

// This route retrieves video URLs from the main generate-video endpoint
// In production, use Vercel KV or database for shared state

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('videoId');
    const jobId = searchParams.get('jobId');

    // Support both videoId and jobId parameters
    const id = videoId || jobId;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Video ID o Job ID mancante. Fornire ?videoId=xxx o ?jobId=xxx' },
        { status: 400 }
      );
    }

    console.log(`📥 Download request for ID: ${id}`);

    // Get video status from generate-video endpoint
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const statusResponse = await fetch(`${baseUrl}/api/avatar-generator/generate-video?jobId=${id}`);
    const job = await statusResponse.json();

    if (!job.success) {
      return NextResponse.json(
        {
          success: false,
          error: job.error || 'Video non trovato'
        },
        { status: 404 }
      );
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        {
          success: false,
          error: `Video non ancora pronto. Status: ${job.status}`,
          status: job.status,
          progress: job.progress
        },
        { status: 425 } // Too Early
      );
    }

    if (!job.videoUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL video non disponibile'
        },
        { status: 404 }
      );
    }

    // Check if we should stream or redirect
    const download = searchParams.get('download') === 'true';
    const stream = searchParams.get('stream') === 'true';

    if (stream) {
      // Stream the video
      console.log(`📺 Streaming video from: ${job.videoUrl}`);

      const videoResponse = await fetch(job.videoUrl);

      if (!videoResponse.ok) {
        throw new Error('Impossibile recuperare il video');
      }

      const videoBlob = await videoResponse.blob();

      return new NextResponse(videoBlob, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoBlob.size.toString(),
          'Cache-Control': 'public, max-age=3600',
          ...(download && {
            'Content-Disposition': `attachment; filename="avatar-video-${id}.mp4"`
          })
        }
      });

    } else {
      // Return the video URL
      console.log(`🔗 Returning video URL: ${job.videoUrl}`);

      return NextResponse.json({
        success: true,
        videoUrl: job.videoUrl,
        videoId: id,
        message: 'Video disponibile al URL fornito'
      });
    }

  } catch (error: any) {
    console.error('❌ Error downloading video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il download del video'
      },
      { status: 500 }
    );
  }
}

// POST endpoint for downloading multiple videos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoIds } = body;

    if (!videoIds || !Array.isArray(videoIds)) {
      return NextResponse.json(
        { success: false, error: 'Array videoIds mancante' },
        { status: 400 }
      );
    }

    if (videoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Array videoIds vuoto' },
        { status: 400 }
      );
    }

    if (videoIds.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Massimo 20 video IDs per richiesta' },
        { status: 400 }
      );
    }

    console.log(`📥 Batch download request for ${videoIds.length} videos`);

    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Get video status for each ID
    const results = await Promise.all(
      videoIds.map(async (videoId) => {
        try {
          const response = await fetch(`${baseUrl}/api/avatar-generator/generate-video?jobId=${videoId}`);
          const job = await response.json();

          if (!job.success) {
            return {
              videoId,
              success: false,
              error: job.error || 'Video non trovato'
            };
          }

          if (job.status !== 'completed') {
            return {
              videoId,
              success: false,
              error: `Video non pronto. Status: ${job.status}`,
              status: job.status,
              progress: job.progress
            };
          }

          if (!job.videoUrl) {
            return {
              videoId,
              success: false,
              error: 'URL video non disponibile'
            };
          }

          return {
            videoId,
            success: true,
            videoUrl: job.videoUrl
          };
        } catch (error: any) {
          return {
            videoId,
            success: false,
            error: error.message || 'Errore nel recupero'
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      results: results,
      total: videoIds.length,
      successful: results.filter(r => r.success).length
    });

  } catch (error: any) {
    console.error('❌ Error in batch download:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il download batch'
      },
      { status: 500 }
    );
  }
}
