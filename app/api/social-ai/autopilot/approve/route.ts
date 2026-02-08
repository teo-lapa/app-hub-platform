import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/social-ai/autopilot/approve
 *
 * Approves and publishes a post from the autopilot queue.
 * Reuses the existing publish-to-odoo endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post, action = 'publish_now' } = body;
    // action: 'publish_now' | 'schedule'

    if (!post || !post.result) {
      return NextResponse.json({ error: 'Post con risultato generato richiesto' }, { status: 400 });
    }

    const { result, scheduledFor } = post;

    if (action === 'publish_now' || action === 'schedule') {
      // Publish via existing Odoo route
      const publishResponse = await fetch(
        `${request.nextUrl.origin}/api/social-ai/publish-to-odoo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            caption: result.copywriting?.caption || '',
            hashtags: result.copywriting?.hashtags || [],
            cta: result.copywriting?.cta || '',
            imageDataUrl: result.image?.dataUrl || null,
            videoDataUrl: result.video?.dataUrl || null,
            platform: post.platform,
            scheduledDate: action === 'schedule' ? scheduledFor : undefined,
          }),
        }
      );

      const publishData = await publishResponse.json();

      if (!publishResponse.ok) {
        return NextResponse.json(
          { error: publishData.error || 'Errore durante pubblicazione' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          postId: post.id,
          action,
          publishResult: publishData,
        }
      });
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });

  } catch (error: any) {
    console.error('[AutopilotApprove] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante approvazione' },
      { status: 500 }
    );
  }
}
