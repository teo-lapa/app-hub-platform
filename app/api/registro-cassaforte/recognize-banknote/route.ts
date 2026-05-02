import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyCassaforteAuth } from '@/lib/registro-cassaforte/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple rate limiting: track last request time per IP
const rateLimitMap = new Map<string, number>();

// CHF Banknote denominations
const VALID_DENOMINATIONS = [10, 20, 50, 100, 200, 1000];

// Initialize OpenAI client (conditionally - may not be available during build)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

/**
 * POST /api/registro-cassaforte/recognize-banknote
 * Riconosce una banconota CHF dall'immagine usando OpenAI GPT-4o-mini
 * Estrae: denominazione e numero di serie
 *
 * Request: multipart/form-data with 'image' field
 * Response: { denomination: number, serial_number: string, confidence: number, currency: string }
 */
export async function POST(request: NextRequest) {
  const authError = verifyCassaforteAuth(request);
  if (authError) return authError;

  // Rate limit: max 3 req/s per IP (permette scansione rapida senza floodare)
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip);
  if (lastRequest && now - lastRequest < 300) {
    return NextResponse.json({ success: false, error: 'Troppo veloce, riprova.' }, { status: 429 });
  }
  rateLimitMap.set(ip, now);

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({
        success: false,
        error: 'Immagine non fornita',
      }, { status: 400 });
    }

    // Convert to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    console.log(`📸 Riconoscimento banconota - Size: ${Math.round(arrayBuffer.byteLength / 1024)}KB`);

    // Check if OpenAI is available
    if (!openai) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key non configurata',
      }, { status: 503 });
    }

    // Use OpenAI GPT-4o-mini for fast and accurate recognition
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Swiss Franc (CHF) banknote. Return JSON with denomination, serial_number, confidence.

denomination: READ the printed number on the banknote FIRST. Valid values: 10|20|50|100|200|1000. Then verify color matches (10=yellow, 20=red, 50=green, 100=blue, 200=brown, 1000=purple). The PRINTED NUMBER is the source of truth — do NOT guess from color alone (50 green and 100 blue can look similar in low light). If you cannot clearly read the number, return 0. If not CHF: 0.

serial_number: EXACTLY 10 chars = 2 digits + 1 letter + 7 digits (e.g. "18C4545167"). Read ALL 10 or return null. Never guess missing chars.

Example: {"denomination":100,"serial_number":"18C4545167","confidence":0.95}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 60,
      });

      const gptResponse = response.choices[0]?.message?.content || '';
      console.log('📝 GPT-4o-mini response:', gptResponse);

      try {
        const parsed = JSON.parse(gptResponse);

        if (parsed.denomination && VALID_DENOMINATIONS.includes(parsed.denomination)) {
          return NextResponse.json({
            success: true,
            denomination: parsed.denomination,
            serial_number: parsed.serial_number || null,
            confidence: parsed.confidence || 0.9,
            currency: 'CHF',
            method: 'openai_vision',
          });
        }
      } catch {
        // JSON parse fallito, passa al fallback sotto
      }

      // Not recognized
      return NextResponse.json({
        success: false,
        error: 'Banconota non riconosciuta',
        denomination: 0,
        serial_number: null,
        confidence: 0,
      });

    } catch (openaiError: any) {
      console.error('❌ OpenAI Vision error:', openaiError.message);

      return NextResponse.json({
        success: false,
        error: 'Errore nel riconoscimento. Riprova.',
        denomination: 0,
        serial_number: null,
        confidence: 0,
      });
    }

  } catch (error: any) {
    console.error('❌ Errore riconoscimento banconota:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il riconoscimento',
    }, { status: 500 });
  }
}
