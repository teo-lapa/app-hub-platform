import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';

/**
 * Fallback: estrae dati contatto da testo usando regex
 * Usato quando il Jetson non restituisce dati strutturati
 */
function extractContactFromText(text: string): any {
  const emailRegex = /([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex = /(?:Tel|Telefono|Phone|Mobile|Cellulare)[:\s]*(\+?[\d\s-]+)/gi;
  const vatRegex = /(?:P\.?IVA|VAT|Partita\s+IVA)[:\s]*([A-Z]{0,2}\s*\d{8,11})/i;
  const websiteRegex = /((?:www\.|https?:\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

  // Estrai prima riga come nome (di solito il nome è la prima riga)
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const name = lines[0]?.trim() || '';

  // Email
  const emailMatch = text.match(emailRegex);
  const email = emailMatch ? emailMatch[1] : '';

  // Telefoni
  const phones: string[] = [];
  let match;
  while ((match = phoneRegex.exec(text)) !== null) {
    phones.push(match[1].trim());
  }

  // P.IVA
  const vatMatch = text.match(vatRegex);
  const vat = vatMatch ? vatMatch[1].replace(/\s/g, '') : '';

  // Website
  const websiteMatch = text.match(websiteRegex);
  const website = websiteMatch ? websiteMatch[1] : '';

  // Cerca azienda (di solito dopo CEO, o riga 2-3)
  const companyKeywords = ['S.r.l.', 'S.p.A.', 'Corporation', 'Inc.', 'Ltd', 'GmbH'];
  let company_name = '';
  for (const line of lines) {
    if (companyKeywords.some(kw => line.includes(kw))) {
      company_name = line.trim();
      break;
    }
  }

  // Cerca indirizzo (di solito contiene Via, Street, o numeri civici)
  const addressRegex = /(Via|Viale|Piazza|Street|Avenue|Road)[^\n]+/i;
  const addressMatch = text.match(addressRegex);
  const street = addressMatch ? addressMatch[0].trim() : '';

  // CAP e città
  const cityRegex = /(\d{5})\s+([A-Za-zàèéìòù\s]+)/;
  const cityMatch = text.match(cityRegex);
  const zip = cityMatch ? cityMatch[1] : '';
  const city = cityMatch ? cityMatch[2].trim() : '';

  return {
    name,
    email,
    phone: phones[0] || '',
    mobile: phones[1] || phones[0] || '',
    company_name,
    street,
    zip,
    city,
    country: city.toLowerCase().includes('italia') || city.toLowerCase().includes('italy') ? 'Italia' : '',
    website,
    vat,
    function: '',
    comment: `Estratto automaticamente con regex fallback. Testo OCR:\n${text.substring(0, 500)}`
  };
}

/**
 * POST /api/scan-contatto
 *
 * Scansiona un biglietto da visita o documento contenente informazioni di contatto
 * ed estrae i dati strutturati per creare/aggiornare un partner in Odoo.
 *
 * Questo endpoint è un proxy leggero che chiama il Jetson OCR service
 * per evitare di includere l'Anthropic SDK pesante nelle Serverless Functions.
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

// Runtime configuration for Next.js - lightweight proxy
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

    // ========== CALL JETSON OCR SERVICE ==========
    console.log(`🔍 [SCAN-CONTATTO] Request ${requestId} - Calling Jetson for contact extraction...`);

    const jetsonUrl = process.env.JETSON_OCR_URL || 'http://10.0.0.108:3100';

    // Create form data for Jetson
    const jetsonFormData = new FormData();
    jetsonFormData.append('file', file);
    jetsonFormData.append('mode', 'auto');
    jetsonFormData.append('language', language);

    let jetsonResponse;

    const jetsonSecret = process.env.JETSON_WEBHOOK_SECRET || 'jetson-ocr-secret-2025';

    try {
      jetsonResponse = await fetch(`${jetsonUrl}/api/v1/extract-contact`, {
        method: 'POST',
        headers: {
          'X-API-Key': jetsonSecret,
        },
        body: jetsonFormData,
      });

      if (!jetsonResponse.ok) {
        throw new Error(`Jetson returned ${jetsonResponse.status}: ${jetsonResponse.statusText}`);
      }

      const jetsonData = await jetsonResponse.json();

      console.log(`✅ [SCAN-CONTATTO] Request ${requestId} - Jetson extraction completed`);
      console.log('🔍 [DEBUG] Jetson raw response:', JSON.stringify(jetsonData, null, 2));

      // ========== MAP CONTACT DATA ==========
      // Handle both old (buggy) and new Jetson response formats
      let contactData = jetsonData.contact;

      // Fallback: if contact is undefined/null but jetsonData has contact fields directly
      if (!contactData && jetsonData.displayName) {
        console.log('⚠️  [SCAN-CONTATTO] Contact is undefined, using jetsonData fields directly');
        contactData = {
          name: jetsonData.displayName || '',
          email: jetsonData.emails?.[0]?.value || '',
          phone: jetsonData.phones?.find((p: any) => p.type === 'landline')?.value || '',
          mobile: jetsonData.phones?.find((p: any) => p.type === 'mobile')?.value || '',
          street: jetsonData.address?.street || '',
          zip: jetsonData.address?.postalCode || '',
          city: jetsonData.address?.city || '',
          country: jetsonData.address?.country || '',
          company_name: jetsonData.companyName || '',
          website: jetsonData.website || '',
          vat: jetsonData.taxIdentifiers?.vatId || '',
          function: jetsonData.jobTitle || '',
          comment: ''
        };
      } else if (contactData) {
        // Map Jetson format to our ContactData format
        contactData = {
          name: contactData.displayName || contactData.name || '',
          email: contactData.emails?.[0]?.value || contactData.email || '',
          phone: contactData.phones?.find((p: any) => p.type === 'landline')?.value || contactData.phone || '',
          mobile: contactData.phones?.find((p: any) => p.type === 'mobile')?.value || contactData.mobile || '',
          street: contactData.address?.street || contactData.street || '',
          zip: contactData.address?.postalCode || contactData.zip || '',
          city: contactData.address?.city || contactData.city || '',
          country: contactData.address?.country || contactData.country || '',
          company_name: contactData.companyName || contactData.company_name || '',
          website: contactData.website || '',
          vat: contactData.taxIdentifiers?.vatId || contactData.vat || '',
          function: contactData.jobTitle || contactData.function || '',
          comment: contactData.comment || ''
        };
      }

      // Fallback finale: se contact è undefined ma abbiamo rawText, proviamo regex extraction
      if (!contactData && jetsonData.rawText) {
        console.log('⚠️  [SCAN-CONTATTO] Contact undefined, tentativo regex extraction da rawText');
        contactData = extractContactFromText(jetsonData.rawText);
      }

      if (!contactData || !contactData.name) {
        console.error('❌ [SCAN-CONTATTO] No contact data found in response');
        throw new Error('Nessun dato contatto estratto dall\'immagine');
      }

      console.log('✅ [SCAN-CONTATTO] Mapped contact data:', contactData);

      // ========== CALCULATE METRICS ==========
      const duration = Date.now() - startTime;

      // ========== RETURN SUCCESS RESPONSE ==========
      return NextResponse.json(
        {
          success: true,
          data: {
            contact: contactData,
            rawText: jetsonData.rawText,
            confidence: jetsonData.confidence,
            extractionMethod: jetsonData.extractionMethod,
            duration: jetsonData.duration
          },
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
    } catch (scanError) {
      console.error(`❌ [SCAN-CONTATTO] Request ${requestId} - Jetson call failed:`, scanError);

      const errorMessage = scanError instanceof Error
        ? scanError.message
        : 'Errore durante la scansione del contatto';

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'JETSON_ERROR',
          requestId,
          timestamp: new Date().toISOString(),
          details: scanError instanceof Error ? scanError.stack : undefined
        },
        { status: 500 }
      );
    }

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
