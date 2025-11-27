import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const { prompt } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('Generating caption with Gemini...');

    // Use text model for caption generation (faster and cheaper)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      return NextResponse.json({ error: 'No caption generated' }, { status: 500 });
    }

    console.log('Caption generated successfully');

    return NextResponse.json({
      success: true,
      caption: text.trim()
    });

  } catch (error: any) {
    console.error('Gemini caption generation error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate caption'
    }, { status: 500 });
  }
}
