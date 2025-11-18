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

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log('[Scan Complete] Processing:', file.name, `(${file.size} bytes)`);

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
    // STEP 2: CLAUDE AGENT - WEB SEARCH
    // ============================================
    console.log('[Step 2/3] Claude Agent: Searching web for company info...');
    const webSearchStart = Date.now();

    let webSearchData: any = null;

    if (extractedData.companyName || extractedData.companyUID) {
      try {
        const searchQuery = extractedData.companyName || extractedData.companyUID;
        const searchPrompt = `
Cerca informazioni su questa azienda svizzera e fornisci dati strutturati:

Azienda: ${searchQuery}
${extractedData.companyUID ? `UID/CHE: ${extractedData.companyUID}` : ''}
${extractedData.city ? `Città: ${extractedData.city}` : ''}

Cerca su:
1. Moneyhouse.ch
2. Zefix.ch (Registro commerciale svizzero)
3. Google

Informazioni da trovare:
- Nome legale completo
- Forma giuridica (SA, GmbH, etc.)
- Numero UID/CHE completo (formato CHE-XXX.XXX.XXX)
- Indirizzo sede legale
- Proprietari/amministratori (se disponibili)
- Settore attività
- Rating creditizio o info solvibilità (se disponibili)

Rispondi SOLO con un oggetto JSON valido:
{
  "found": true/false,
  "legalName": "nome legale completo",
  "uid": "CHE-XXX.XXX.XXX",
  "companyType": "SA/GmbH/etc",
  "address": {
    "street": "via",
    "zip": "CAP",
    "city": "città"
  },
  "owners": [{"name": "nome", "role": "ruolo"}],
  "businessActivity": "settore",
  "creditInfo": "informazioni creditizie se disponibili",
  "source": "sito da cui hai preso i dati"
}

Se non trovi l'azienda, rispondi: {"found": false}
`;

        // Dynamic import per ridurre bundle size
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          tools: [
            {
              name: 'web_search',
              description: 'Search the web for information',
              input_schema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query'
                  }
                },
                required: ['query']
              }
            }
          ],
          messages: [
            {
              role: 'user',
              content: searchPrompt
            }
          ]
        });

        // Estrai il JSON dalla risposta
        const textContent = message.content.find(c => c.type === 'text');
        if (textContent && 'text' in textContent) {
          const text = textContent.text;

          // Cerca JSON nella risposta
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            webSearchData = JSON.parse(jsonMatch[0]);
            console.log('[Step 2/3] ✓ Web search completed:', webSearchData);
          } else {
            warnings.push('Claude did not return valid JSON from web search');
          }
        }

      } catch (error: any) {
        warnings.push(`Web search failed: ${error.message}`);
        console.error('[Step 2/3] ⚠ Web search error:', error);
      }
    } else {
      console.log('[Step 2/3] ⊘ No company data to search');
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
      const { createOdoo, readOdoo } = await import('@/lib/odoo/odoo-helper');

      // Prepara dati partner
      const partnerData: any = {
        name: finalData.name || finalData.companyName || finalData.legalName || 'Unknown',
        type: 'contact'
      };

      // Determina se è azienda o persona
      if (finalData.companyName || finalData.legalName) {
        partnerData.is_company = true;
        partnerData.name = finalData.legalName || finalData.companyName;
      } else {
        partnerData.is_company = false;
      }

      // Aggiungi campi disponibili
      if (finalData.email) partnerData.email = finalData.email;
      if (finalData.phone) partnerData.phone = finalData.phone;
      if (finalData.mobile) partnerData.mobile = finalData.mobile;
      if (finalData.street || finalData.address?.street) {
        partnerData.street = finalData.street || finalData.address?.street;
      }
      if (finalData.zip || finalData.address?.zip) {
        partnerData.zip = finalData.zip || finalData.address?.zip;
      }
      if (finalData.city || finalData.address?.city) {
        partnerData.city = finalData.city || finalData.address?.city;
      }
      if (finalData.companyUID || finalData.uid) {
        // ODOO ACCETTA IL FORMATO ORIGINALE SVIZZERO!
        // Verified in database: "CHE-110.576.236 MWST" funziona
        // NON normalizzare - usa il formato estratto da Gemini
        partnerData.vat = (finalData.companyUID || finalData.uid).toString().trim();
      }
      if (finalData.website) partnerData.website = finalData.website;

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
