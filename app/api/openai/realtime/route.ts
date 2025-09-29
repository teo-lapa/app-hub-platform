import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

export async function POST(request: NextRequest) {
  try {
    const { action_id } = await request.json();

    console.log('🌟 Creating OpenAI Realtime session for action:', action_id);

    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
      console.error('❌ OpenAI API key not configured');
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured'
      }, { status: 500 });
    }

    // Create ephemeral token for WebRTC connection
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'nova',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create OpenAI session',
        details: error
      }, { status: response.status });
    }

    const session = await response.json();
    console.log('✅ OpenAI Realtime session created');

    return NextResponse.json({
      success: true,
      client_secret: session.client_secret.value,
      expires_at: session.client_secret.expires_at
    });

  } catch (error: any) {
    console.error('❌ Error creating OpenAI session:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}