/**
 * Contact Enricher Examples & Usage Guide
 *
 * Esempi di utilizzo del servizio di arricchimento contatti
 */

import {
  ContactEnricher,
  getContactEnricher,
  EnrichmentRequest,
  EnrichedContact,
  ContactEnrichmentError,
  ApiRateLimitError,
} from './contact-enricher';

/**
 * Esempio 1: Arricchimento contatto base
 */
export async function example1_basicEnrichment() {
  const enricher = getContactEnricher();

  const request: EnrichmentRequest = {
    companyName: 'Apple Inc',
    country: 'United States',
    website: 'https://apple.com',
  };

  try {
    const enriched = await enricher.enrichContact(request);

    console.log('Enriched Contact:');
    console.log('Company:', enriched.company);
    console.log('Social Profiles:', enriched.social);
    console.log('Contacts Found:', enriched.contacts.length);
    console.log('Verification Score:', enriched.verificationScore);
  } catch (error) {
    if (error instanceof ContactEnrichmentError) {
      console.error(`Error [${error.code}]:`, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

/**
 * Esempio 2: Arricchimento con verifica email/telefono
 */
export async function example2_emailPhoneVerification() {
  const enricher = getContactEnricher();

  const request: EnrichmentRequest = {
    companyName: 'Tesla Inc',
    country: 'United States',
    email: 'sales@tesla.com',
    phone: '+1-888-518-3752',
  };

  try {
    const enriched = await enricher.enrichContact(request);

    // Verifica email
    const emailVerification = await enricher.verifyEmail('sales@tesla.com');
    console.log('Email Verification:', emailVerification);
    // Output: { valid: true, score: 100 }

    // Verifica telefono
    const phoneVerification = await enricher.verifyPhone('+1-888-518-3752', 'US');
    console.log('Phone Verification:', phoneVerification);
    // Output: { valid: true, score: 95, normalized: '+18885183752' }

    console.log('Company:', enriched.company);
    console.log('Email Valid:', enriched.emailValid);
    console.log('Phone Valid:', enriched.phoneValid);
  } catch (error) {
    console.error('Enrichment failed:', error);
  }
}

/**
 * Esempio 3: Scaricamento logo aziendale
 */
export async function example3_downloadLogo() {
  const enricher = getContactEnricher();

  try {
    // Scarica logo
    const logo = await enricher.fetchCompanyLogo('https://google.com');

    if (logo) {
      console.log('Logo Downloaded:');
      console.log('Format:', logo.format);
      console.log('Size:', logo.base64.length, 'bytes');
      console.log('Data URL (first 100 chars):', logo.base64.substring(0, 100));

      // Puoi usare logo.base64 direttamente in HTML:
      // <img src="${logo.base64}" alt="Company Logo" />
    } else {
      console.log('Logo not found for company');
    }
  } catch (error) {
    console.error('Logo download failed:', error);
  }
}

/**
 * Esempio 4: Arricchimento con contatti multipli
 */
export async function example4_multipleContacts() {
  const enricher = getContactEnricher();

  const request: EnrichmentRequest = {
    companyName: 'Microsoft Corporation',
    country: 'United States',
    website: 'https://microsoft.com',
    contacts: [
      { name: 'Satya Nadella', role: 'CEO' },
      { name: 'Amy Hood', role: 'CFO' },
    ],
  };

  try {
    const enriched = await enricher.enrichContact(request);

    console.log('Company:', enriched.company.legalName);
    console.log('Contacts:');
    enriched.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name}`);
      console.log(`     Role: ${contact.role}`);
      console.log(`     Email: ${contact.email || 'N/A'}`);
      console.log(`     LinkedIn: ${contact.linkedinProfile || 'N/A'}`);
    });
  } catch (error) {
    console.error('Enrichment failed:', error);
  }
}

/**
 * Esempio 5: Export a CSV
 */
export async function example5_exportToCSV() {
  const enricher = getContactEnricher();

  const request: EnrichmentRequest = {
    companyName: 'Amazon.com Inc',
    country: 'United States',
  };

  try {
    const enriched = await enricher.enrichContact(request);

    // Esporta a CSV
    const csv = enricher.exportToCSV(enriched);

    console.log('CSV Export:');
    console.log(csv);

    // Puoi salvare in file:
    // fs.writeFileSync('company_data.csv', csv);
  } catch (error) {
    console.error('Export failed:', error);
  }
}

/**
 * Esempio 6: Gestione errori e retry
 */
export async function example6_errorHandling() {
  const enricher = getContactEnricher();

  try {
    const enriched = await enricher.enrichContact({
      companyName: 'NonExistentCompany12345XYZ',
    });

    // Verifica score per valutare affidabilità
    if (enriched.verificationScore < 30) {
      console.warn(
        'Low verification score. Data may be incomplete or inaccurate.'
      );
    }

    console.log('Enrichment successful with score:', enriched.verificationScore);
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      console.error('Rate limit exceeded. Retry in 60 seconds.');
      // Implementa retry delay
    } else if (error instanceof ContactEnrichmentError) {
      console.error(`Enrichment error [${error.code}]:`, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

/**
 * Esempio 7: Arricchimento batch di aziende italiane
 */
export async function example7_batchEnrichment() {
  const enricher = getContactEnricher();

  const companies = [
    {
      name: 'Fiat Chrysler Automobiles',
      country: 'Italy',
    },
    {
      name: 'Pirelli & C.',
      country: 'Italy',
    },
    {
      name: 'Generali Assicurazioni',
      country: 'Italy',
    },
  ];

  const results: EnrichedContact[] = [];

  for (const company of companies) {
    try {
      console.log(`Enriching ${company.name}...`);

      const enriched = await enricher.enrichContact({
        companyName: company.name,
        country: company.country,
      });

      results.push(enriched);

      console.log(
        `  - P.IVA: ${enriched.company.piva || 'Not found'}`
      );
      console.log(
        `  - Employees: ${enriched.company.employees || 'Not found'}`
      );
      console.log(`  - Score: ${enriched.verificationScore}`);

      // Delay tra richieste per evitare rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`\nSuccessfully enriched ${results.length}/${companies.length} companies`);

  // Esporta tutti i risultati
  const allCSV = results
    .map(r => enricher.exportToCSV(r))
    .join('\n');

  console.log('All companies exported to CSV (first 500 chars):');
  console.log(allCSV.substring(0, 500));
}

/**
 * Esempio 8: Integrazione in API route
 */
export async function example8_apiRouteIntegration() {
  // Codice per: /app/api/contacts/enrich/route.ts

  const enricher = getContactEnricher();

  // Simula richiesta POST
  const requestBody = {
    companyName: 'Netflix Inc',
    country: 'United States',
    website: 'https://netflix.com',
    email: 'contact@netflix.com',
  };

  try {
    // Valida input
    if (!requestBody.companyName) {
      return {
        status: 400,
        body: { error: 'Company name is required' },
      };
    }

    // Arricchisci contatto
    const enriched = await enricher.enrichContact(requestBody);

    // Scarica logo se website disponibile
    let logo = null;
    if (enriched.company.website) {
      logo = await enricher.fetchCompanyLogo(enriched.company.website);
    }

    // Ritorna risposta
    return {
      status: 200,
      body: {
        success: true,
        data: {
          ...enriched,
          logo: logo
            ? { format: logo.format, source: logo.source }
            : null,
          // Logo base64 è nel campo logo.base64 se necessario
        },
        metadata: {
          processingTime: '2.5s',
          source: 'Claude API',
        },
      },
    };
  } catch (error) {
    if (error instanceof ContactEnrichmentError) {
      return {
        status: 400,
        body: {
          error: error.message,
          code: error.code,
        },
      };
    }

    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Esempio 9: Monitoraggio cache
 */
export async function example9_cacheManagement() {
  const enricher = getContactEnricher();

  // Enrich prima richiesta
  await enricher.enrichContact({ companyName: 'Google LLC' });
  await enricher.enrichContact({ companyName: 'Meta Platforms Inc' });

  // Controlla cache stats
  const stats = enricher.getCacheStats();
  console.log('Cache Statistics:');
  console.log('  Entries:', stats.size);
  console.log('  Keys:', stats.entries);

  // Stessa richiesta (da cache)
  console.time('Cached request');
  await enricher.enrichContact({ companyName: 'Google LLC' });
  console.timeEnd('Cached request');
  // Output: Cached request: 0.5ms (molto veloce)

  // Pulisci cache manualmente se necessario
  enricher.clearCache();
  console.log('Cache cleared');
}

/**
 * Esempio 10: Verifica dati con validation score
 */
export async function example10_dataValidation() {
  const enricher = getContactEnricher();

  const enriched = await enricher.enrichContact({
    companyName: 'Intel Corporation',
    country: 'United States',
  });

  // Interpreta verification score
  const score = enriched.verificationScore;

  let confidence = 'Unknown';
  if (score >= 80) confidence = 'Molto Alta';
  else if (score >= 60) confidence = 'Alta';
  else if (score >= 40) confidence = 'Media';
  else if (score >= 20) confidence = 'Bassa';
  else confidence = 'Molto Bassa';

  console.log(`Data Confidence: ${confidence} (${score}/100)`);
  console.log(`Sources: ${enriched.sources.join(', ')}`);
  console.log(`Last Updated: ${enriched.lastUpdated}`);

  // Usa dati solo se score sufficientemente alto
  if (score >= 60) {
    console.log('Safe to use for business operations');
  } else {
    console.log('Recommend manual verification before use');
  }
}

/**
 * Test runner
 */
export async function runAllExamples() {
  console.log('=== Contact Enricher Examples ===\n');

  const examples = [
    { name: 'Basic Enrichment', fn: example1_basicEnrichment },
    { name: 'Email/Phone Verification', fn: example2_emailPhoneVerification },
    { name: 'Download Logo', fn: example3_downloadLogo },
    { name: 'Multiple Contacts', fn: example4_multipleContacts },
    { name: 'Export to CSV', fn: example5_exportToCSV },
    { name: 'Error Handling', fn: example6_errorHandling },
    { name: 'Batch Enrichment', fn: example7_batchEnrichment },
    { name: 'API Route Integration', fn: example8_apiRouteIntegration },
    { name: 'Cache Management', fn: example9_cacheManagement },
    { name: 'Data Validation', fn: example10_dataValidation },
  ];

  for (const example of examples) {
    console.log(`\n--- ${example.name} ---`);
    try {
      await example.fn();
    } catch (error) {
      console.error(`Example failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export per testing
export { ContactEnricher, getContactEnricher };
