import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';
import { ContactScanner } from '@/lib/services/contact-scanner';
import type { ContactScanResult } from '@/lib/types/contact-scan';

/**
 * POST /api/scan-contatto
 *
 * Scansiona un biglietto da visita o documento contenente informazioni di contatto
 * ed estrae i dati strutturati per creare/aggiornare un partner in Odoo.
 *
 * Request body (multipart/form-data):
 * - file: File (PDF, PNG, JPG, JPEG) - required
 * - skipEnrichment: boolean (optional) - salta l'enrichment con API esterne
 * - skipValidation: boolean (optional) - salta la validazione dei dati
 * - skipMapping: boolean (optional) - salta il mapping a Odoo
 * - language: string (optional) - lingua del documento (default: 'it')
 *
 * Response:
 * - 200: ContactScanResult JSON con dati estratti e mappati
 * - 400: Parametri mancanti o non validi
 * - 401: Sessione non valida
 * - 413: File troppo grande (max 10MB)
 * - 415: Tipo di file non supportato
 * - 500: Errore interno del server
 */

// Runtime configuration for Next.js
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for OCR + enrichment

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supported file types
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`📇 [SCAN-CONTATTO] Request ${requestId} - Start`);

  try {
    // ========== AUTHENTICATION ==========
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - Unauthorized`);
      return NextResponse.json(
        {
          error: 'Sessione non valida',
          code: 'UNAUTHORIZED',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    console.log(`✅ [SCAN-CONTATTO] Request ${requestId} - Authenticated as UID ${uid}`);

    // ========== PARSE FORM DATA ==========
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch (parseError) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - Failed to parse form data:`, parseError);
      return NextResponse.json(
        {
          error: 'Formato richiesta non valido. Usare multipart/form-data',
          code: 'INVALID_REQUEST_FORMAT',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // ========== EXTRACT FILE ==========
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - No file provided`);
      return NextResponse.json(
        {
          error: 'File obbligatorio',
          code: 'MISSING_FILE',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    console.log(`📄 [SCAN-CONTATTO] Request ${requestId} - File: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);

    // ========== VALIDATE FILE SIZE ==========
    if (file.size > MAX_FILE_SIZE) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - File too large: ${file.size} bytes`);
      return NextResponse.json(
        {
          error: `File troppo grande. Massimo ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          code: 'FILE_TOO_LARGE',
          maxSize: MAX_FILE_SIZE,
          actualSize: file.size,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 413 }
      );
    }

    // ========== VALIDATE FILE TYPE ==========
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - Unsupported file type: ${file.type}`);
      return NextResponse.json(
        {
          error: `Tipo di file non supportato: ${file.type}. Tipi supportati: PDF, PNG, JPG`,
          code: 'UNSUPPORTED_FILE_TYPE',
          supportedTypes: SUPPORTED_MIME_TYPES,
          actualType: file.type,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 415 }
      );
    }

    // ========== EXTRACT OPTIONS ==========
    const skipEnrichment = formData.get('skipEnrichment') === 'true';
    const skipValidation = formData.get('skipValidation') === 'true';
    const skipMapping = formData.get('skipMapping') === 'true';
    const language = (formData.get('language') as string) || 'it';

    console.log(`⚙️ [SCAN-CONTATTO] Request ${requestId} - Options:`, {
      skipEnrichment,
      skipValidation,
      skipMapping,
      language
    });

    // ========== CONVERT FILE TO BUFFER ==========
    let fileBuffer: Buffer;

    try {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log(`✅ [SCAN-CONTATTO] Request ${requestId} - File converted to buffer (${fileBuffer.length} bytes)`);
    } catch (conversionError) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - Failed to convert file to buffer:`, conversionError);
      return NextResponse.json(
        {
          error: 'Errore conversione file',
          code: 'FILE_CONVERSION_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // ========== INITIALIZE CONTACT SCANNER ==========
    const scanner = new ContactScanner();

    // ========== SCAN AND SAVE ==========
    console.log(`🔍 [SCAN-CONTATTO] Request ${requestId} - Starting scan and save...`);

    let result: ContactScanResult;

    try {
      result = await scanner.scanAndSave(fileBuffer, {
        filename: file.name,
        mimeType: file.type as 'application/pdf' | 'image/png' | 'image/jpeg',
        skipEnrichment,
        skipValidation,
        skipMapping,
        language,
        odooCookies: cookies || undefined,
        odooUid: uid
      });

      console.log(`✅ [SCAN-CONTATTO] Request ${requestId} - Scan completed with status: ${result.status}`);
    } catch (scanError) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - Scan failed:`, scanError);

      const errorMessage = scanError instanceof Error
        ? scanError.message
        : 'Errore durante la scansione del contatto';

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'SCAN_ERROR',
          requestId,
          timestamp: new Date().toISOString(),
          details: scanError instanceof Error ? scanError.stack : undefined
        },
        { status: 500 }
      );
    }

    // ========== CALCULATE METRICS ==========
    const duration = Date.now() - startTime;

    console.log(`✅ [SCAN-CONTATTO] Request ${requestId} - Completed in ${duration}ms`);
    console.log(`📊 [SCAN-CONTATTO] Request ${requestId} - Quality Score: ${result.qualityScore}/100`);
    console.log(`📊 [SCAN-CONTATTO] Request ${requestId} - Completeness Score: ${result.completenessScore}/100`);
    console.log(`📊 [SCAN-CONTATTO] Request ${requestId} - Confidence Score: ${result.confidenceScore}/100`);

    if (result.odooSync?.partnerId) {
      console.log(`🔗 [SCAN-CONTATTO] Request ${requestId} - Partner created/updated: ${result.odooSync.partnerId}`);
    }

    // ========== RETURN SUCCESS RESPONSE ==========
    return NextResponse.json(
      {
        success: true,
        data: result,
        meta: {
          requestId,
          duration,
          timestamp: new Date().toISOString()
        }
      },
      {
        status: 200,
        headers: {
          'X-Request-ID': requestId,
          'X-Processing-Time': `${duration}ms`
        }
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - Unexpected error after ${duration}ms:`, error);

    const errorMessage = error instanceof Error
      ? error.message
      : 'Errore interno del server';

    const errorDetails = error instanceof Error
      ? error.stack
      : undefined;

    return NextResponse.json(
      {
        error: errorMessage,
        code: 'INTERNAL_ERROR',
        requestId,
        duration,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      {
        status: 500,
        headers: {
          'X-Request-ID': requestId,
          'X-Processing-Time': `${duration}ms`
        }
      }
    );
  }
}

/**
 * GET /api/scan-contatto
 *
 * Health check endpoint per verificare che il servizio sia attivo
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'Contact Scanner API',
    status: 'healthy',
    version: '1.0.0',
    supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG'],
    maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
    features: {
      ocr: true,
      enrichment: true,
      validation: true,
      odooMapping: true,
      odooSync: true
    },
    timestamp: new Date().toISOString()
  });
}
