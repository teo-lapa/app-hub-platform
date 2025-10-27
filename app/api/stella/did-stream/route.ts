import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/stella/did-stream
 *
 * Crea uno streaming video di Stella animata con D-ID
 * Sincronizza lip-sync con audio OpenAI Realtime
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎬 [DID-STREAM] Creazione stream Stella animata');

    const { audioUrl, text } = await request.json();

    if (!audioUrl && !text) {
      return NextResponse.json({
        success: false,
        error: 'audioUrl o text richiesto'
      }, { status: 400 });
    }

    const DID_API_KEY = process.env.DID_API_KEY;
    if (!DID_API_KEY) {
      console.error('❌ [DID-STREAM] DID_API_KEY non configurata');
      return NextResponse.json({
        success: false,
        error: 'DID API not configured'
      }, { status: 500 });
    }

    // Crea streaming session con D-ID
    const createStreamResponse = await fetch('https://api.d-id.com/talks/streams', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_url: 'https://app-hub-platform.vercel.app/videos/stella.mp4', // Video Stella
        driver_url: 'bank://lively', // Driver animazione naturale
      })
    });

    if (!createStreamResponse.ok) {
      const error = await createStreamResponse.text();
      console.error('❌ [DID-STREAM] Errore creazione stream:', error);
      throw new Error(`DID API error: ${createStreamResponse.status}`);
    }

    const streamData = await createStreamResponse.json();
    console.log('✅ [DID-STREAM] Stream creato:', streamData.id);

    return NextResponse.json({
      success: true,
      data: {
        streamId: streamData.id,
        sessionId: streamData.session_id,
        offer: streamData.offer,
        iceServers: streamData.ice_servers
      }
    });

  } catch (error: any) {
    console.error('❌ [DID-STREAM] Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/stella/did-stream
 *
 * Termina streaming session
 */
export async function DELETE(request: NextRequest) {
  try {
    const { streamId, sessionId } = await request.json();

    const DID_API_KEY = process.env.DID_API_KEY;

    await fetch(`https://api.d-id.com/talks/streams/${streamId}/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`
      }
    });

    console.log('✅ [DID-STREAM] Stream chiuso:', streamId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ [DID-STREAM] Errore chiusura stream:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
