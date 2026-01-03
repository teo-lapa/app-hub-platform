import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Jetson Nano configuration
const JETSON_URL = process.env.JETSON_OCR_URL || process.env.JETSON_URL || 'http://192.168.1.171:3100';
const JETSON_SECRET = process.env.JETSON_WEBHOOK_SECRET || 'jetson-ocr-secret-2025';

/**
 * POST /api/registro-cassaforte/face-recognize
 * Riconosce un dipendente dalla foto del volto usando Jetson Nano
 *
 * Request: multipart/form-data with 'image' field
 * Response: { recognized: boolean, employee_id?: number, employee_name?: string, confidence?: number }
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

    console.log(`👤 Riconoscimento facciale - Size: ${Math.round(arrayBuffer.byteLength / 1024)}KB`);

    // Call Jetson face recognition endpoint
    try {
      const jetsonResponse = await fetch(`${JETSON_URL}/api/v1/face/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': JETSON_SECRET,
        },
        body: JSON.stringify({
          image: base64Image,
          threshold: 0.6, // Minimum confidence for match
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (jetsonResponse.ok) {
        const result = await jetsonResponse.json();
        console.log('✅ Jetson face recognition response:', result);

        if (result.recognized && result.employee_id) {
          return NextResponse.json({
            success: true,
            recognized: true,
            employee_id: result.employee_id,
            employee_name: result.employee_name || result.name,
            confidence: result.confidence || 0.9,
          });
        } else {
          return NextResponse.json({
            success: true,
            recognized: false,
            message: 'Volto non riconosciuto. Effettua la registrazione.',
          });
        }
      } else {
        const errorData = await jetsonResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Jetson error: ${jetsonResponse.status}`);
      }
    } catch (jetsonError: any) {
      console.warn('⚠️ Jetson non raggiungibile:', jetsonError.message);

      // Return unrecognized if Jetson is not available
      return NextResponse.json({
        success: true,
        recognized: false,
        message: 'Servizio riconoscimento facciale non disponibile. Seleziona manualmente il tuo nome.',
        fallback: true,
      });
    }

  } catch (error: any) {
    console.error('❌ Errore riconoscimento facciale:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il riconoscimento',
    }, { status: 500 });
  }
}
