import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CHF Banknote denominations
const VALID_DENOMINATIONS = [10, 20, 50, 100, 200, 1000];

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/registro-cassaforte/recognize-banknote
 * Riconosce una banconota CHF dall'immagine usando OpenAI GPT-4o-mini
 *
 * Request: multipart/form-data with 'image' field
 * Response: { denomination: number, confidence: number, currency: string }
 */
export async function POST(request: NextRequest) {
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

    // Use OpenAI GPT-4o-mini for fast and accurate recognition
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Identify this Swiss Franc (CHF) banknote denomination.

Valid CHF denominations: 10, 20, 50, 100, 200, 1000

Swiss banknote colors:
- 10 CHF = Yellow/golden
- 20 CHF = Red
- 50 CHF = Green
- 100 CHF = Blue
- 200 CHF = Brown/orange
- 1000 CHF = Purple/violet

Look at the large number on the note and the color.

Respond ONLY with JSON: {"denomination": NUMBER, "confidence": 0.95}
If not a CHF banknote or unclear: {"denomination": 0, "confidence": 0}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 50,
      });

      const gptResponse = response.choices[0]?.message?.content || '';
      console.log('📝 GPT-4o-mini response:', gptResponse);

      const jsonMatch = gptResponse.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.denomination && VALID_DENOMINATIONS.includes(parsed.denomination)) {
          return NextResponse.json({
            success: true,
            denomination: parsed.denomination,
            confidence: parsed.confidence || 0.9,
            currency: 'CHF',
            method: 'openai_vision',
          });
        }
      }

      // Not recognized
      return NextResponse.json({
        success: false,
        error: 'Banconota non riconosciuta',
        denomination: 0,
        confidence: 0,
      });

    } catch (openaiError: any) {
      console.error('❌ OpenAI Vision error:', openaiError.message);

      return NextResponse.json({
        success: false,
        error: 'Errore nel riconoscimento. Riprova.',
        denomination: 0,
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
