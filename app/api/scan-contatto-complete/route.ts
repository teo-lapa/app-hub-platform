/**
 * API: /api/scan-contatto-complete
 *
 * PIPELINE AI COMPLETA:
 * 1. Gemini Vision OCR → Estrae dati dal documento
 * 2. Claude Agent Web Search → Cerca azienda su Internet
 * 3. Claude Agent Odoo → Crea contatto in Odoo (XML-RPC)
 *
 * Input: Qualsiasi documento aziendale (biglietto, fattura, scontrino)
 * Output: Contatto completo creato in Odoo con dati arricchiti
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractContactDataFromImage } from '@/lib/services/gemini-vision';

/**
 * Formatta le informazioni Google Search per il Chatter
 */
function formatGoogleSearchMessage(webSearchData: any, extractedData: any): string {
  const parts: string[] = [];

  parts.push('<h3>📍 Informazioni da Google Search (non ufficiali)</h3>');
  parts.push('<p><i>Queste informazioni sono state trovate automaticamente su Internet e potrebbero non essere ufficiali o aggiornate.</i></p>');
  parts.push('<ul>');

  if (webSearchData.legalName) {
    parts.push(`<li><strong>Nome trovato:</strong> ${webSearchData.legalName}</li>`);
  }

  if (webSearchData.website) {
    parts.push(`<li><strong>Sito web:</strong> <a href="${webSearchData.website}" target="_blank">${webSearchData.website}</a></li>`);
  }

  if (webSearchData.address) {
    const addressParts: string[] = [];
    if (webSearchData.address.street) addressParts.push(webSearchData.address.street);
    if (webSearchData.address.zip) addressParts.push(webSearchData.address.zip);
    if (webSearchData.address.city) addressParts.push(webSearchData.address.city);
    if (webSearchData.address.state) addressParts.push(webSearchData.address.state);
    if (webSearchData.address.country) addressParts.push(webSearchData.address.country);

    if (addressParts.length > 0) {
      parts.push(`<li><strong>Indirizzo:</strong> ${addressParts.join(', ')}</li>`);
    }
  }

  if (webSearchData.uid) {
    parts.push(`<li><strong>UID/P.IVA:</strong> ${webSearchData.uid}</li>`);
  }

  if (webSearchData.businessActivity) {
    parts.push(`<li><strong>Attività:</strong> ${webSearchData.businessActivity}</li>`);
  }

  if (webSearchData.companyType) {
    parts.push(`<li><strong>Tipo azienda:</strong> ${webSearchData.companyType}</li>`);
  }

  if (webSearchData.creditInfo) {
    parts.push(`<li><strong>Info creditizie:</strong> ${webSearchData.creditInfo}</li>`);
  }

  parts.push('</ul>');

  // Aggiungi fonte
  parts.push(`<p><small><strong>Fonte:</strong> ${webSearchData.source} | <strong>Query:</strong> ${webSearchData.searchQuery}</strong></small></p>`);

  return parts.join('\n');
}

interface EnrichmentResult {
  // Dati OCR
  extractedData: any;

  // Dati web search
  webSearchData: any;

  // Contatto Odoo
  odooContact: any;

  // Metadati
  processing: {
    ocrDuration: number;
    webSearchDuration: number;
    odooDuration: number;
    totalDuration: number;
  };

  success: boolean;
  warnings?: string[];
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const contactType = formData.get('contactType') as string || 'company'; // 'company' or 'person'

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log('[Scan Complete] Processing:', file.name, `(${file.size} bytes)`, `Type: ${contactType}`);

    // ============================================
    // STEP 1: GEMINI VISION OCR
    // ============================================
    console.log('[Step 1/3] Running Gemini Vision OCR...');
    const ocrStart = Date.now();

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedData = await extractContactDataFromImage(buffer, file.type);

    const ocrDuration = Date.now() - ocrStart;
    console.log(`[Step 1/3] ✓ OCR completed in ${ocrDuration}ms`);
    console.log('[OCR Result]', extractedData);

    // ============================================
    // STEP 2: WEB SEARCH
    // ============================================
    console.log('[Step 2/3] Web search: Searching company info...');
    const webSearchStart = Date.now();

    let webSearchData: any = null;

    try {
      // Importa servizio web search
      const { searchCompanyInfo } = await import('@/lib/services/web-search');

      // Cerca solo se è un'azienda (non persona privata)
      if (contactType === 'company' && extractedData.companyName) {
        const searchResult = await searchCompanyInfo(
          extractedData.companyName,
          extractedData.city || extractedData.zip
        );

        if (searchResult.found) {
          webSearchData = searchResult;
          console.log('[Step 2/3] ✓ Company found:', searchResult.legalName);
        } else {
          console.log('[Step 2/3] ⚠ Company not found in web search');
          warnings.push(`Azienda "${extractedData.companyName}" non trovata su web`);
        }
      } else {
        console.log('[Step 2/3] ⊘ Skipping web search (not a company or no company name)');
      }
    } catch (error: any) {
      console.warn('[Step 2/3] ⚠ Web search error:', error.message);
      warnings.push(`Web search fallito: ${error.message}`);
    }

    const webSearchDuration = Date.now() - webSearchStart;

    // ============================================
    // STEP 3: CLAUDE AGENT - ODOO CREATION
    // ============================================
    console.log('[Step 3/3] Claude Agent: Creating contact in Odoo...');
    const odooStart = Date.now();

    let odooContact: any = null;

    try {
      // Combina dati OCR + web search
      const finalData = {
        ...extractedData,
        ...(webSearchData?.found ? webSearchData : {})
      };

      const odooPrompt = `
Crea un contatto in Odoo 17 usando questi dati:

DATI ESTRATTI DAL DOCUMENTO:
${JSON.stringify(extractedData, null, 2)}

${webSearchData?.found ? `DATI ARRICCHITI DA WEB:
${JSON.stringify(webSearchData, null, 2)}` : ''}

ISTRUZIONI:
1. Usa XML-RPC per connetterti a Odoo:
   - URL: ${process.env.NEXT_PUBLIC_ODOO_URL || process.env.ODOO_URL}
   - DB: ${process.env.NEXT_PUBLIC_ODOO_DB || process.env.ODOO_DB}
   - Username: ${process.env.ODOO_USERNAME}
   - Password: ${process.env.ODOO_PASSWORD}

2. Se c'è un'azienda, crea:
   - Record azienda (is_company=true)
   - Eventualmente proprietari come child contacts
   - Persona originale del documento come child contact

3. Se è solo una persona, crea solo il contatto persona

4. Ritorna l'ID Odoo creato e i dati completi

Usa il codice TypeScript in lib/odoo-xmlrpc.ts per connetterti.

Rispondi con JSON:
{
  "success": true,
  "company_id": 123 (se azienda),
  "contact_id": 456,
  "created": {...dati contatto creato}
}
`;

      // USA LO STESSO SISTEMA DELLE ALTRE API (smart-ordering, product-creator, etc.)
      // Questo ha autenticazione automatica e gestione sessioni
      const { createOdoo, readOdoo, searchReadOdoo, getCurrentUserId } = await import('@/lib/odoo/odoo-helper');

      // Ottieni l'utente corrente (sales person)
      const currentUserId = await getCurrentUserId();

      // Prepara dati partner
      const partnerData: any = {
        name: finalData.name || finalData.companyName || finalData.legalName || 'Unknown',
        type: 'contact'
      };

      // Determina se è azienda o persona basandosi sul contactType dell'utente
      if (contactType === 'company') {
        partnerData.is_company = true;
        // Se c'è un nome azienda, usa quello come nome del partner
        if (finalData.companyName || finalData.legalName) {
          partnerData.name = finalData.legalName || finalData.companyName;
        }
      } else {
        partnerData.is_company = false;
        // Per privati, usa il nome della persona
        if (finalData.name) {
          partnerData.name = finalData.name;
        }
      }

      // Aggiungi campi disponibili
      if (finalData.email) partnerData.email = finalData.email;
      if (finalData.phone) partnerData.phone = finalData.phone;
      if (finalData.mobile) partnerData.mobile = finalData.mobile;
      if (finalData.website) partnerData.website = finalData.website;
      if (finalData.street || finalData.address?.street) {
        partnerData.street = finalData.street || finalData.address?.street;
      }
      if (finalData.zip || finalData.address?.zip) {
        partnerData.zip = finalData.zip || finalData.address?.zip;
      }
      if (finalData.city || finalData.address?.city) {
        partnerData.city = finalData.city || finalData.address?.city;
      }

      // Provincia (cantone) - cerca in Odoo
      if (finalData.state || finalData.province || finalData.address?.state) {
        const stateName = finalData.state || finalData.province || finalData.address?.state;
        try {
          const states = await searchReadOdoo('res.country.state', [
            ['country_id', '=', 43],
            '|',
            ['name', 'ilike', stateName],
            ['code', 'ilike', stateName]
          ], ['id'], 1);
          if (states && states.length > 0) {
            partnerData.state_id = states[0].id;
          }
        } catch (e) {
          console.warn('[State] Could not find:', stateName);
        }
      }

      if (finalData.companyUID || finalData.uid) {
        // Odoo richiede formato: "CHE-123.456.788 MWST" o "TVA" o "IVA"
        let vat = (finalData.companyUID || finalData.uid).toString().trim();

        // Se il VAT non ha MWST/TVA/IVA alla fine, aggiungi MWST
        if (!vat.includes('MWST') && !vat.includes('TVA') && !vat.includes('IVA')) {
          vat = vat + ' MWST';
        }

        partnerData.vat = vat;
        partnerData.country_id = 43; // Switzerland
      }

      // Lingua - Default Tedesco svizzero, ma rileva regione
      partnerData.lang = 'de_CH';
      const cityLower = (finalData.city || '').toLowerCase();
      const italianCities = ['lugano', 'bellinzona', 'locarno', 'mendrisio', 'chiasso'];
      const frenchCities = ['genève', 'lausanne', 'neuchâtel', 'fribourg', 'sion'];
      if (italianCities.some(c => cityLower.includes(c))) {
        partnerData.lang = 'it_IT';
      } else if (frenchCities.some(c => cityLower.includes(c))) {
        partnerData.lang = 'fr_CH';
      }

      // Sales person (chi ha creato il contatto)
      if (currentUserId) {
        partnerData.user_id = currentUserId;
      }

      // Aggiungi note con info enrichment
      const notes: string[] = [];
      if (finalData.companyType) notes.push(`Tipo: ${finalData.companyType}`);
      if (finalData.businessActivity) notes.push(`Attività: ${finalData.businessActivity}`);
      if (finalData.creditInfo) notes.push(`Credit Info: ${finalData.creditInfo}`);
      if (webSearchData?.source) notes.push(`Fonte dati: ${webSearchData.source}`);

      if (notes.length > 0) {
        partnerData.comment = notes.join('\n');
      }

      console.log('[Odoo] Creating partner with odoo-helper:', partnerData);

      // Crea il partner (stesso metodo di smart-ordering/create-order)
      const partnerId = await createOdoo('res.partner', partnerData);

      console.log('[Odoo] Partner created, ID:', partnerId);

      // Leggi il partner creato
      const createdPartnerArray = await readOdoo(
        'res.partner',
        [partnerId],
        ['id', 'name', 'display_name', 'email', 'phone', 'mobile', 'vat', 'is_company']
      );

      if (!createdPartnerArray || createdPartnerArray.length === 0) {
        throw new Error('Partner created but not found in read');
      }

      odooContact = createdPartnerArray[0];
      console.log('[Step 3/3] ✓ Odoo contact created:', odooContact);

      // ============================================
      // STEP 3.1: CREATE DELIVERY & INVOICE ADDRESSES (solo per aziende)
      // ============================================
      if (contactType === 'company' && partnerId) {
        console.log('[Step 3.1] Creating delivery and invoice addresses for company...');

        try {
          const addressesToCreate = [];

          // Indirizzo di consegna (delivery)
          if (partnerData.street || partnerData.city || partnerData.zip) {
            const deliveryAddress = {
              parent_id: partnerId,
              type: 'delivery',
              name: 'Indirizzo di consegna',
              street: partnerData.street || '',
              city: partnerData.city || '',
              zip: partnerData.zip || '',
              country_id: partnerData.country_id || 43 // Default Switzerland
            };
            addressesToCreate.push(createOdoo('res.partner', deliveryAddress));
          }

          // Indirizzo di fatturazione (invoice)
          if (partnerData.street || partnerData.city || partnerData.zip) {
            const invoiceAddress = {
              parent_id: partnerId,
              type: 'invoice',
              name: 'Indirizzo di fatturazione',
              street: partnerData.street || '',
              city: partnerData.city || '',
              zip: partnerData.zip || '',
              country_id: partnerData.country_id || 43 // Default Switzerland
            };
            addressesToCreate.push(createOdoo('res.partner', invoiceAddress));
          }

          // Crea gli indirizzi in parallelo
          if (addressesToCreate.length > 0) {
            const createdAddressIds = await Promise.all(addressesToCreate);
            console.log(`[Step 3.1] ✓ Created ${createdAddressIds.length} addresses:`, createdAddressIds);
          } else {
            console.log('[Step 3.1] ⊘ No address data available, skipping address creation');
          }

        } catch (addressError: any) {
          // Non bloccare il flusso se la creazione degli indirizzi fallisce
          console.warn('[Step 3.1] ⚠ Address creation error (non-blocking):', addressError.message);
          warnings.push(`Creazione indirizzi fallita: ${addressError.message}`);
        }
      }

      // ============================================
      // STEP 3.5: INVIA INFO GOOGLE SEARCH AL CHATTER
      // ============================================
      if (webSearchData?.found && partnerId) {
        console.log('[Step 3.5] Sending Google Search info to Chatter...');

        try {
          // Formatta il messaggio con le informazioni Google Search
          const chatterMessage = formatGoogleSearchMessage(webSearchData, extractedData);

          // Invia al Chatter usando l'API esistente
          const chatterResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/odoo/post-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'res.partner',
              res_id: partnerId,
              message: chatterMessage
            })
          });

          if (chatterResponse.ok) {
            console.log('[Step 3.5] ✓ Google Search info posted to Chatter');
          } else {
            const errorText = await chatterResponse.text();
            console.warn('[Step 3.5] ⚠ Failed to post to Chatter:', errorText);
            warnings.push('Impossibile inviare info Google Search al Chatter');
          }
        } catch (chatterError: any) {
          console.warn('[Step 3.5] ⚠ Chatter post error:', chatterError.message);
          warnings.push('Errore invio messaggio Chatter');
        }
      }

    } catch (error: any) {
      console.error('[Step 3/3] ✗ Odoo creation error:', error);
      throw new Error(`Odoo creation failed: ${error.message}`);
    }

    const odooDuration = Date.now() - odooStart;
    const totalDuration = Date.now() - startTime;

    console.log(`[Pipeline Complete] Total duration: ${totalDuration}ms`);

    // ============================================
    // RETURN RESULT
    // ============================================

    const result: EnrichmentResult = {
      success: true,
      extractedData,
      webSearchData,
      odooContact,
      processing: {
        ocrDuration,
        webSearchDuration,
        odooDuration,
        totalDuration
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Scan Complete] Pipeline error:', error);

    const totalDuration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        warnings: warnings.length > 0 ? warnings : undefined,
        processing: {
          totalDuration
        }
      },
      { status: 500 }
    );
  }
}
