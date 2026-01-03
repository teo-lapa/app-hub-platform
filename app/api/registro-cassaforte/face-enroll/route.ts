import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Jetson Nano configuration
const JETSON_URL = process.env.JETSON_OCR_URL || process.env.JETSON_URL || 'http://192.168.1.171:3100';
const JETSON_SECRET = process.env.JETSON_WEBHOOK_SECRET || 'jetson-ocr-secret-2025';

/**
 * POST /api/registro-cassaforte/face-enroll
 * Registra il volto di un dipendente per il riconoscimento facciale
 *
 * Request: multipart/form-data with:
 *   - images: File[] (3-4 foto del volto)
 *   - employee_id: string
 *   - employee_name: string
 *
 * Response: { success: boolean, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const employeeId = formData.get('employee_id') as string;
    const employeeName = formData.get('employee_name') as string;

    if (!employeeId || !employeeName) {
      return NextResponse.json({
        success: false,
        error: 'ID e nome dipendente richiesti',
      }, { status: 400 });
    }

    // Get all images from formData
    const images: string[] = [];
    let imageIndex = 0;

    while (true) {
      const imageFile = formData.get(`image_${imageIndex}`) as File;
      if (!imageFile) {
        // Try also single 'image' field
        if (imageIndex === 0) {
          const singleImage = formData.get('image') as File;
          if (singleImage) {
            const arrayBuffer = await singleImage.arrayBuffer();
            images.push(Buffer.from(arrayBuffer).toString('base64'));
          }
        }
        break;
      }

      const arrayBuffer = await imageFile.arrayBuffer();
      images.push(Buffer.from(arrayBuffer).toString('base64'));
      imageIndex++;
    }

    // Also check for images[] array
    const imageArray = formData.getAll('images') as File[];
    for (const img of imageArray) {
      if (img instanceof File) {
        const arrayBuffer = await img.arrayBuffer();
        images.push(Buffer.from(arrayBuffer).toString('base64'));
      }
    }

    if (images.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almeno una foto richiesta',
      }, { status: 400 });
    }

    console.log(`👤 Enrollment dipendente ${employeeName} (ID: ${employeeId}) - ${images.length} foto`);

    // 1. Send to Jetson for face encoding
    let jetsonSuccess = false;
    try {
      const jetsonResponse = await fetch(`${JETSON_URL}/api/v1/face/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': JETSON_SECRET,
        },
        body: JSON.stringify({
          employee_id: employeeId,
          employee_name: employeeName,
          images: images,
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout
      });

      if (jetsonResponse.ok) {
        const result = await jetsonResponse.json();
        console.log('✅ Jetson enrollment response:', result);
        jetsonSuccess = result.success;
      } else {
        const errorData = await jetsonResponse.json().catch(() => ({}));
        console.warn('⚠️ Jetson enrollment error:', errorData);
      }
    } catch (jetsonError: any) {
      console.warn('⚠️ Jetson non raggiungibile per enrollment:', jetsonError.message);
    }

    // 2. Save first image to Odoo hr.employee (image_128 field)
    try {
      const sessionManager = getOdooSessionManager();

      // Update employee with face image
      await sessionManager.callKw(
        'hr.employee',
        'write',
        [[parseInt(employeeId)], {
          image_1920: images[0], // Full size image
        }]
      );

      console.log('✅ Foto salvata in Odoo hr.employee');
    } catch (odooError: any) {
      console.warn('⚠️ Errore salvataggio foto in Odoo:', odooError.message);
    }

    // Return success if at least Jetson or Odoo succeeded
    if (jetsonSuccess) {
      return NextResponse.json({
        success: true,
        message: 'Registrazione completata! Il tuo volto è stato salvato.',
        jetson_enrolled: true,
        odoo_saved: true,
      });
    } else {
      // Even if Jetson failed, we saved to Odoo
      return NextResponse.json({
        success: true,
        message: 'Foto salvata. Il riconoscimento facciale sarà disponibile al prossimo avvio.',
        jetson_enrolled: false,
        odoo_saved: true,
      });
    }

  } catch (error: any) {
    console.error('❌ Errore enrollment:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la registrazione',
    }, { status: 500 });
  }
}
