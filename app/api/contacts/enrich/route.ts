/**
 * Contact Enrichment API Route
 *
 * POST /api/contacts/enrich
 * Arricchisce contatti con dati da ricerca online via Claude API
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getContactEnricher,
  EnrichmentRequest,
  ContactEnrichmentError,
  ApiRateLimitError,
  InvalidInputError,
} from '@/lib/ai/contact-enricher';

/**
 * Validazione request body
 */
function validateRequest(body: any): EnrichmentRequest {
  if (!body || typeof body !== 'object') {
    throw new InvalidInputError('Request body must be a valid JSON object');
  }

  const { companyName, country, website, email, phone, contacts } = body;

  if (typeof companyName !== 'string' || companyName.trim().length === 0) {
    throw new InvalidInputError('companyName is required and must be a non-empty string');
  }

  const request: EnrichmentRequest = { companyName };

  if (country && typeof country === 'string') {
    request.country = country;
  }

  if (website && typeof website === 'string') {
    request.website = website;
  }

  if (email && typeof email === 'string') {
    request.email = email;
  }

  if (phone && typeof phone === 'string') {
    request.phone = phone;
  }

  if (Array.isArray(contacts)) {
    request.contacts = contacts.filter(
      c => c && typeof c === 'object'
    );
  }

  return request;
}

/**
 * POST /api/contacts/enrich
 * Entra contatto con dati ricercati
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // Validazione
    const enrichmentRequest = validateRequest(body);

    // Ottieni enricher
    const enricher = getContactEnricher();

    // Misura tempo di esecuzione
    const startTime = Date.now();

    // Arricchisci contatto
    const enriched = await enricher.enrichContact(enrichmentRequest);

    const processingTime = Date.now() - startTime;

    // Scarica logo se website disponibile
    let logoData = null;
    if (enriched.company.website) {
      try {
        const logo = await enricher.fetchCompanyLogo(enriched.company.website);
        if (logo) {
          logoData = {
            format: logo.format,
            source: logo.source,
            // Note: base64 non è incluso nella risposta iniziale per performance
            // Client può richiedere separatamente se necessario
          };
        }
      } catch (error) {
        // Log error ma non interrompere enrichment
        console.warn('Failed to fetch logo:', error);
      }
    }

    // Risposta success
    return NextResponse.json(
      {
        success: true,
        data: {
          company: enriched.company,
          social: enriched.social,
          contacts: enriched.contacts,
          logo: logoData,
          emailValid: enriched.emailValid,
          phoneValid: enriched.phoneValid,
          verificationScore: enriched.verificationScore,
          lastUpdated: enriched.lastUpdated,
          sources: enriched.sources,
        },
        metadata: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
          model: 'claude-sonnet-4-5-20250929',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Gestisci errori specifici
    if (error instanceof InvalidInputError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    if (error instanceof ApiRateLimitError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          retryAfter: 60, // secondi
        },
        { status: 429 }
      );
    }

    if (error instanceof ContactEnrichmentError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    // Errore generico
    console.error('Contact enrichment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to enrich contact',
        message:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contacts/enrich (informazioni API)
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Contact Enrichment API',
    endpoint: 'POST /api/contacts/enrich',
    description:
      'Enrich company contact information with data from online sources',
    requestBody: {
      companyName: 'string (required) - Company name to enrich',
      country: 'string (optional) - Country (e.g., "Italy", "United States")',
      website: 'string (optional) - Company website URL',
      email: 'string (optional) - Contact email to verify',
      phone: 'string (optional) - Contact phone to verify',
      contacts:
        'array (optional) - Pre-existing contact information to supplement',
    },
    responseExample: {
      success: true,
      data: {
        company: {
          legalName: 'Apple Inc',
          piva: 'IT12345678901',
          sector: 'Technology',
          employees: 164000,
          website: 'https://apple.com',
          country: 'United States',
          foundedYear: 1976,
        },
        social: {
          linkedin: 'https://linkedin.com/company/apple',
          facebook: 'https://facebook.com/Apple',
          twitter: 'https://twitter.com/Apple',
        },
        contacts: [
          {
            name: 'Tim Cook',
            email: 'tim.cook@apple.com',
            role: 'CEO',
            linkedinProfile: 'https://linkedin.com/in/tim-cook',
          },
        ],
        verificationScore: 85,
        emailValid: true,
        phoneValid: true,
      },
      metadata: {
        processingTimeMs: 2500,
        timestamp: '2024-11-17T10:30:00.000Z',
      },
    },
  });
}
