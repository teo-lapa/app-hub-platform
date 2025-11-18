/**
 * API Route: POST /api/contacts/extract
 * Extract contact information from OCR text or document
 * Uses Llama 3.2 3B via Ollama (local, on Jetson)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getContactExtractionService } from '@/lib/services/contact-extraction-service';
import { ExtractedContact } from '@/lib/types/contact-scan';

interface ExtractRequest {
  /** OCR-extracted text or document content */
  text: string;

  /** Optional: source document identifier */
  documentId?: string;

  /** Optional: document filename */
  filename?: string;

  /** Optional: document type (pdf, image, text) */
  documentType?: 'pdf' | 'image' | 'text';

  /** Optional: extract for Odoo partner creation */
  forOdoo?: boolean;
}

interface ExtractResponse {
  success: boolean;
  contact?: ExtractedContact;
  odooData?: Record<string, any>;
  duration: number;
  confidence: number;
  extractedFields: string[];
  error?: string;
  message?: string;
}

/**
 * POST /api/contacts/extract
 * Extract contact information from text
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: ExtractRequest = await request.json();

    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'text field is required and must be a string',
          duration: Date.now() - startTime,
          confidence: 0,
          extractedFields: []
        },
        { status: 400 }
      );
    }

    // Validate text length
    if (body.text.length > 10000) {
      return NextResponse.json(
        {
          success: false,
          error: 'text must be less than 10000 characters',
          duration: Date.now() - startTime,
          confidence: 0,
          extractedFields: []
        },
        { status: 400 }
      );
    }

    // Get extraction service
    const extractionService = await getContactExtractionService();

    // Check if service is available
    const isAvailable = await extractionService.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contact extraction service not available. Make sure Ollama is running with llama3.2:3b model.',
          duration: Date.now() - startTime,
          confidence: 0,
          extractedFields: [],
          message: 'Fallback extraction may be available. Retry request or check Ollama status.'
        },
        { status: 503 }
      );
    }

    // Extract contact information
    const contact = await extractionService.extractContact(body.text);

    // If forOdoo requested, also extract Odoo format
    let odooData: Record<string, any> | undefined;
    if (body.forOdoo) {
      odooData = await extractionService.extractForOdoo(body.text);
    }

    const duration = Date.now() - startTime;

    // Return successful response
    return NextResponse.json(
      {
        success: true,
        contact,
        odooData,
        duration,
        confidence: contact.displayName ? 80 : 0,
        extractedFields: contact.displayName ? ['displayName', 'emails', 'phones'] : [],
        message: `Successfully extracted contact information in ${duration}ms`
      },
      { status: 200 }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Contact extraction error:', error);

    // Determine if this is a service availability issue
    const isServiceError = errorMessage.includes('Ollama') ||
      errorMessage.includes('Service not initialized') ||
      errorMessage.includes('not available');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        duration,
        confidence: 0,
        extractedFields: [],
        message: isServiceError
          ? 'Contact extraction service unavailable. Check Ollama status.'
          : 'Failed to extract contact information.'
      },
      { status: isServiceError ? 503 : 500 }
    );
  }
}

/**
 * OPTIONS /api/contacts/extract
 * Handle CORS preflight
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}

/**
 * Usage Examples:
 *
 * 1. Basic extraction:
 *    POST /api/contacts/extract
 *    { "text": "..." }
 *
 * 2. Extract for Odoo:
 *    POST /api/contacts/extract
 *    {
 *      "text": "...",
 *      "forOdoo": true,
 *      "documentId": "doc-123"
 *    }
 *
 * Response format:
 * {
 *   "success": true,
 *   "contact": {
 *     "displayName": "Marco Rossi",
 *     "firstName": "Marco",
 *     "lastName": "Rossi",
 *     "companyName": "ACME S.r.l.",
 *     "emails": [...],
 *     "phones": [...],
 *     "address": {...},
 *     "taxIdentifier": {...},
 *     "extractedAt": "2025-01-15T10:30:00Z"
 *   },
 *   "odooData": {
 *     "name": "ACME S.r.l.",
 *     "email": "marco.rossi@acme.it",
 *     "phone": "02 1234 5678",
 *     "mobile": "+39 334 123 4567",
 *     "vat": "01234567890",
 *     ...
 *   },
 *   "duration": 2345,
 *   "confidence": 95,
 *   "extractedFields": ["displayName", "companyName", "emails", "phones", "address"],
 *   "message": "Successfully extracted contact information in 2345ms"
 * }
 */
