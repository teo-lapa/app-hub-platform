import { NextRequest, NextResponse } from 'next/server';

// This route just redirects to the GET endpoint on generate-video
// In production, you would use Vercel KV or a database for shared state

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID mancante. Fornire ?jobId=xxx' },
        { status: 400 }
      );
    }

    // Redirect to the main generate-video endpoint for status check
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/avatar-generator/generate-video?jobId=${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('❌ Error checking job status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il controllo dello stato'
      },
      { status: 500 }
    );
  }
}

// Batch status check via POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobIds } = body;

    if (!jobIds || !Array.isArray(jobIds)) {
      return NextResponse.json(
        { success: false, error: 'Array jobIds mancante' },
        { status: 400 }
      );
    }

    if (jobIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Array jobIds vuoto' },
        { status: 400 }
      );
    }

    if (jobIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Massimo 50 job IDs per richiesta' },
        { status: 400 }
      );
    }

    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Check each job in parallel
    const results = await Promise.all(
      jobIds.map(async (jobId) => {
        try {
          const response = await fetch(`${baseUrl}/api/avatar-generator/generate-video?jobId=${jobId}`);
          const data = await response.json();
          return { jobId, ...data };
        } catch (error: any) {
          return {
            jobId,
            success: false,
            error: error.message || 'Errore nel controllo'
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      results,
      total: jobIds.length
    });

  } catch (error: any) {
    console.error('❌ Error checking batch job status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il controllo batch dello stato'
      },
      { status: 500 }
    );
  }
}
