import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for video generation

/**
 * POST /api/social-ai/autopilot/generate-post
 *
 * Takes a single autopilot post plan and executes full generation.
 * Reuses the existing generate-marketing endpoint internally.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post } = body;

    if (!post || !post.product) {
      return NextResponse.json({ error: 'Post data richiesto' }, { status: 400 });
    }

    if (!post.product.image) {
      return NextResponse.json({ error: 'Immagine prodotto richiesta' }, { status: 400 });
    }

    // Call the existing generate-marketing endpoint
    const generateResponse = await fetch(
      `${request.nextUrl.origin}/api/social-ai/generate-marketing`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          productImage: post.product.image,
          productName: post.product.name,
          productDescription: `${post.product.category} premium italiano - ${post.product.name}`,
          socialPlatform: post.platform,
          contentType: post.contentType,
          tone: post.tone,
          videoStyle: post.videoStyle || 'cinematic',
          videoDuration: post.videoDuration || 6,
          includeLogo: true,
          companyMotto: 'Zero Pensieri',
          productCategory: post.product.category || 'Food',
          targetCanton: 'Zürich',
        }),
      }
    );

    const generateData = await generateResponse.json();

    if (!generateResponse.ok) {
      return NextResponse.json(
        { error: generateData.error || 'Errore durante generazione contenuto' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        postId: post.id,
        result: generateData.data,
      }
    });

  } catch (error: any) {
    console.error('[AutopilotGenerate] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante generazione post autopilot' },
      { status: 500 }
    );
  }
}
