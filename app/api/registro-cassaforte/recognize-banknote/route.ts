import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Jetson Nano configuration
const JETSON_URL = process.env.JETSON_OCR_URL || process.env.JETSON_URL || 'http://192.168.1.171:3100';

// CHF Banknote denominations
const VALID_DENOMINATIONS = [10, 20, 50, 100, 200, 1000];

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/registro-cassaforte/recognize-banknote
 * Riconosce una banconota CHF dall'immagine usando Jetson Nano + Ollama LLaVA
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

    // Try Jetson first
    try {
      const jetsonResponse = await fetch(`${JETSON_URL}/api/v1/banknote/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          method: 'vision', // Use Ollama LLaVA
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (jetsonResponse.ok) {
        const result = await jetsonResponse.json();
        console.log('✅ Jetson response:', result);

        if (result.denomination && VALID_DENOMINATIONS.includes(result.denomination)) {
          return NextResponse.json({
            success: true,
            denomination: result.denomination,
            confidence: result.confidence || 0.9,
            currency: 'CHF',
            method: 'jetson',
          });
        }
      }
    } catch (jetsonError) {
      console.warn('⚠️ Jetson non raggiungibile, uso fallback Ollama locale');
    }

    // Fallback: Use local Ollama if available
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

      const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llava:7b',
          prompt: `Analyze this image of a banknote. This should be a Swiss Franc (CHF) banknote.
                   Identify the denomination. Valid CHF denominations are: 10, 20, 50, 100, 200, 1000.

                   Look for:
                   - The number printed on the banknote
                   - The color (10=yellow, 20=red, 50=green, 100=blue, 200=brown, 1000=purple)
                   - The size and design elements

                   Respond ONLY with valid JSON in this exact format:
                   {"denomination": 100, "confidence": 0.95}

                   If this is not a CHF banknote or you cannot identify it:
                   {"denomination": 0, "confidence": 0, "error": "Cannot identify banknote"}`,
          images: [base64Image],
          stream: false,
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout for Ollama
      });

      if (ollamaResponse.ok) {
        const ollamaData = await ollamaResponse.json();
        console.log('📝 Ollama raw response:', ollamaData.response);

        // Parse JSON from response
        const jsonMatch = ollamaData.response?.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          if (parsed.denomination && VALID_DENOMINATIONS.includes(parsed.denomination)) {
            return NextResponse.json({
              success: true,
              denomination: parsed.denomination,
              confidence: parsed.confidence || 0.8,
              currency: 'CHF',
              method: 'ollama_local',
            });
          }
        }
      }
    } catch (ollamaError) {
      console.warn('⚠️ Ollama locale non disponibile');
    }

    // Fallback 2: Use OpenAI GPT-4 Vision
    try {
      console.log('🤖 Trying OpenAI GPT-4 Vision...');

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image of a banknote. This should be a Swiss Franc (CHF) banknote.

Identify the denomination. Valid CHF denominations are: 10, 20, 50, 100, 200, 1000.

Color guide for Swiss banknotes:
- 10 CHF = Yellow/golden
- 20 CHF = Red
- 50 CHF = Green
- 100 CHF = Blue
- 200 CHF = Brown
- 1000 CHF = Purple

Look at the large number printed on the note and the dominant color.

Respond ONLY with valid JSON: {"denomination": 100, "confidence": 0.95}
If not a CHF banknote: {"denomination": 0, "confidence": 0, "error": "Not a CHF banknote"}`,
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
        max_tokens: 100,
      });

      const gptResponse = response.choices[0]?.message?.content || '';
      console.log('📝 GPT-4 Vision response:', gptResponse);

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
    } catch (openaiError: any) {
      console.warn('⚠️ OpenAI Vision error:', openaiError.message);
    }

    // If all else fails, return unrecognized
    return NextResponse.json({
      success: false,
      error: 'Banconota non riconosciuta. Riprova posizionando meglio la banconota.',
      denomination: 0,
      confidence: 0,
    });

  } catch (error: any) {
    console.error('❌ Errore riconoscimento banconota:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il riconoscimento',
    }, { status: 500 });
  }
}
