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
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Formatta le informazioni Google Search per il Chatter come tabella HTML
 */
function formatGoogleSearchMessage(webSearchData: any, extractedData: any): string {
  const parts: string[] = [];

  parts.push('<h3>📍 Informazioni da Google (non ufficiali)</h3>');
  parts.push('<p><i>Dati trovati automaticamente su Internet - potrebbero non essere ufficiali o aggiornati.</i></p>');

  parts.push('<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">');
  parts.push('<tbody>');

  // Nome azienda
  if (webSearchData.legalName) {
    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold; width: 30%;">Nome</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${webSearchData.legalName}</td>`);
    parts.push('</tr>');
  }

  // Sito web
  if (webSearchData.website) {
    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Sito web</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;"><a href="${webSearchData.website}" target="_blank">${webSearchData.website}</a></td>`);
    parts.push('</tr>');
  }

  // Telefono
  if (webSearchData.phone) {
    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Telefono</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${webSearchData.phone}</td>`);
    parts.push('</tr>');
  }

  // Indirizzo completo
  if (webSearchData.address) {
    const addressParts: string[] = [];
    if (webSearchData.address.street) addressParts.push(webSearchData.address.street);
    if (webSearchData.address.zip) addressParts.push(webSearchData.address.zip);
    if (webSearchData.address.city) addressParts.push(webSearchData.address.city);
    if (webSearchData.address.country) addressParts.push(webSearchData.address.country);

    const fullAddress = webSearchData.address.formatted || addressParts.join(', ');

    if (fullAddress) {
      parts.push('<tr>');
      parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Indirizzo</td>');
      parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${fullAddress}</td>`);
      parts.push('</tr>');
    }

    // CAP separato se disponibile
    if (webSearchData.address.zip) {
      parts.push('<tr>');
      parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">CAP</td>');
      parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${webSearchData.address.zip}</td>`);
      parts.push('</tr>');
    }
  }

  // Rating e recensioni
  if (webSearchData.rating || webSearchData.totalRatings) {
    const ratingText = webSearchData.rating
      ? `⭐ ${webSearchData.rating}/5`
      : '';
    const reviewsText = webSearchData.totalRatings
      ? `(${webSearchData.totalRatings} recensioni)`
      : '';
    const fullRating = [ratingText, reviewsText].filter(Boolean).join(' ');

    if (fullRating) {
      parts.push('<tr>');
      parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Valutazione</td>');
      parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${fullRating}</td>`);
      parts.push('</tr>');
    }
  }

  // Tipo di attività
  if (webSearchData.businessTypes && webSearchData.businessTypes.length > 0) {
    // Traduci tipi comuni
    const typeTranslations: Record<string, string> = {
      'restaurant': 'Ristorante',
      'food': 'Cibo',
      'store': 'Negozio',
      'supermarket': 'Supermercato',
      'point_of_interest': 'Punto di interesse',
      'establishment': 'Attività commerciale',
      'cafe': 'Caffetteria',
      'bar': 'Bar'
    };

    const translatedTypes = webSearchData.businessTypes
      .slice(0, 3) // Primi 3 tipi
      .map((type: string) => typeTranslations[type] || type)
      .join(', ');

    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Tipo attività</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${translatedTypes}</td>`);
    parts.push('</tr>');
  }

  // Fascia di prezzo
  if (webSearchData.priceLevel !== undefined) {
    const priceSymbols = '€'.repeat(webSearchData.priceLevel || 1);
    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Fascia prezzo</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${priceSymbols}</td>`);
    parts.push('</tr>');
  }

  // Orari di apertura
  if (webSearchData.openingHours && webSearchData.openingHours.length > 0) {
    const hoursHtml = webSearchData.openingHours.join('<br/>');
    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold; vertical-align: top;">Orari apertura</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${hoursHtml}</td>`);
    parts.push('</tr>');
  }

  // UID/P.IVA
  if (webSearchData.uid) {
    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">UID/P.IVA</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;">${webSearchData.uid}</td>`);
    parts.push('</tr>');
  }

  // Coordinate GPS (utili per mappe)
  if (webSearchData.coordinates) {
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${webSearchData.coordinates.lat},${webSearchData.coordinates.lng}`;
    parts.push('<tr>');
    parts.push('<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Posizione GPS</td>');
    parts.push(`<td style="padding: 8px; border: 1px solid #ddd;"><a href="${mapsLink}" target="_blank">Vedi su Google Maps</a></td>`);
    parts.push('</tr>');
  }

  parts.push('</tbody>');
  parts.push('</table>');

  // Aggiungi fonte
  const sourceLabels: Record<string, string> = {
    'google_places': 'Google Places API',
    'google_custom_search': 'Google Custom Search',
    'tavily': 'Tavily Search'
  };
  const sourceLabel = sourceLabels[webSearchData.source] || webSearchData.source;

  parts.push(`<p style="margin-top: 10px;"><small><strong>Fonte:</strong> ${sourceLabel}</small></p>`);

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
    // ============================================
    // DETECT INPUT TYPE: File Upload vs Voice Data
    // ============================================
    const contentType = req.headers.get('content-type') || '';
    const isVoiceData = contentType.includes('application/json');

    let extractedData: any;
    let contactType: string;
    let ocrDuration = 0;
    let isFromVoice = false;

    if (isVoiceData) {
      // ============================================
      // VOICE INPUT MODE: Clean raw voice data with Claude AI
      // ============================================
      console.log('[Scan Complete] 🎤 Mode: VOICE INPUT');

      const voiceData = await req.json();
      contactType = 'person'; // Voice contacts are always persons
      isFromVoice = true;

      console.log('[Voice Clean] Raw voice data:', voiceData);

      // STEP 1: Clean voice data with Claude AI
      console.log('[Step 1/3] 🤖 Cleaning voice data with Claude AI...');
      const cleanStart = Date.now();

      const cleaningPrompt = `Sei un assistente AI specializzato nella normalizzazione e pulizia di dati di contatto raccolti tramite voice input.

I dati seguenti sono stati raccolti tramite domande vocali e potrebbero contenere:
- Errori di trascrizione vocale
- Formati non standardizzati (telefoni, email, indirizzi)
- Informazioni incomplete o ambigue
- Typos o abbreviazioni

DATI GREZZI:
${JSON.stringify(voiceData, null, 2)}

COMPITO:
1. Pulisci e normalizza tutti i campi
2. Formatta correttamente:
   - Numeri di telefono (formato svizzero/italiano: +41 91 123 45 67 oppure +39 02 1234567)
   - Email (lowercase, validazione formato)
   - Indirizzi (capitalizzazione corretta)
   - CAP (validazione formato)
   - Nome (capitalizzazione corretta di nome e cognome)
3. Identifica eventuali errori o ambiguità
4. Valuta il livello di confidenza dei dati (high/medium/low)

REGOLE IMPORTANTI:
- Se un campo è vuoto o contiene solo spazi, restituisci stringa vuota ""
- Non inventare dati: se non sei sicuro, lascia vuoto
- I numeri di telefono devono includere prefisso internazionale se possibile
- Le email devono essere lowercase e valide
- Il nome è OBBLIGATORIO - se manca o è invalido, segnala errore critico
- Normalizza il paese: "Svizzera" → "Switzerland", "Italia" → "Italy"
- Normalizza lo stato: "TI" → "Ticino", "ZH" → "Zürich", etc.

FORMATO OUTPUT (restituisci SOLO il JSON, nessun testo prima o dopo):
{
  "name": "Mario Rossi",
  "email": "mario.rossi@example.com",
  "phone": "+41 91 123 45 67",
  "mobile": "+41 79 123 45 67",
  "street": "Via Roma 10",
  "zip": "6900",
  "city": "Lugano",
  "state": "Ticino",
  "country": "Switzerland",
  "function": "",
  "comment": "Cliente VIP. Note: [eventuali note aggiuntive]",
  "companyName": "",
  "website": "",
  "vat": "",
  "confidence": "high",
  "warnings": ["Il numero di telefono potrebbe essere incompleto"],
  "suggestions": ["Verificare email con il cliente"]
}`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{ role: 'user', content: cleaningPrompt }],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      console.log('[Voice Clean] 🤖 Claude AI response:', responseText);

      // Parse Claude's response
      let aiResponse: any;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in Claude response');
        }
        aiResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('[Voice Clean] ❌ Failed to parse AI response:', parseError);
        throw new Error('AI response parsing failed');
      }

      // Store AI analysis metadata
      const aiConfidence = aiResponse.confidence || 'medium';
      const aiWarnings = aiResponse.warnings || [];
      const aiSuggestions = aiResponse.suggestions || [];

      warnings.push(...aiWarnings);

      console.log('[Voice Clean] ✅ Data cleaned');
      console.log('[Voice Clean] 📊 Confidence:', aiConfidence);
      console.log('[Voice Clean] ⚠️  Warnings:', aiWarnings);
      console.log('[Voice Clean] 💡 Suggestions:', aiSuggestions);

      // Extract cleaned data
      extractedData = {
        name: aiResponse.name || voiceData.name,
        email: aiResponse.email || '',
        phone: aiResponse.phone || '',
        mobile: aiResponse.mobile || '',
        street: aiResponse.street || '',
        zip: aiResponse.zip || '',
        city: aiResponse.city || '',
        state: aiResponse.state || '',
        country: aiResponse.country || '',
        function: aiResponse.function || '',
        comment: [
          aiResponse.comment || voiceData.comment || '',
          '',
          '---',
          '🎤 Contatto creato tramite Voice Input',
          `📊 Confidenza AI: ${aiConfidence}`,
          aiWarnings.length > 0 ? `⚠️ ${aiWarnings.join(', ')}` : '',
          aiSuggestions.length > 0 ? `💡 ${aiSuggestions.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
        companyName: aiResponse.companyName || '',
        website: aiResponse.website || '',
        vat: aiResponse.vat || '',
      };

      ocrDuration = Date.now() - cleanStart;
      console.log(`[Step 1/3] ✓ Voice cleaning completed in ${ocrDuration}ms`);

    } else {
      // ============================================
      // FILE UPLOAD MODE: Original OCR flow
      // ============================================
      console.log('[Scan Complete] 📄 Mode: FILE UPLOAD (OCR)');

      const formData = await req.formData();
      const file = formData.get('file') as File;
      contactType = formData.get('contactType') as string || 'company';

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
      extractedData = await extractContactDataFromImage(buffer, file.type);

      ocrDuration = Date.now() - ocrStart;
      console.log(`[Step 1/3] ✓ OCR completed in ${ocrDuration}ms`);
      console.log('[OCR Result]', extractedData);
    }

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

      // ============================================
      // NUOVO: Team di Vendita (basato sul venditore)
      // ============================================
      if (currentUserId) {
        try {
          // Mappa user_id -> team_id (stessa logica di dashboard-venditori)
          const USER_TO_TEAM: Record<number, number> = {
            407: 1,   // Domingos Ferreira → I Maestri del Sapore
            14: 12,   // Mihai Nita → I Custodi della Tradizione
            121: 9,   // Alessandro Motta → I Campioni del Gusto
            7: 5,     // Paul Teodorescu → Team Ticino (default)
            8: 5,     // Laura Teodorescu → Team Ticino (default)
            249: 5,   // Gregorio Buccolieri → Team Ticino (default)
            1: 5,     // LapaBot → Team Ticino (default)
          };

          // Se l'utente ha un team mappato, usa quello
          if (USER_TO_TEAM[currentUserId]) {
            partnerData.team_id = USER_TO_TEAM[currentUserId];
            console.log(`[Team] Assigned team ${USER_TO_TEAM[currentUserId]} for user ${currentUserId}`);
          } else {
            // Altrimenti cerca il team dell'utente in Odoo
            const userTeams = await searchReadOdoo('crm.team', [
              ['member_ids', 'in', [currentUserId]]
            ], ['id', 'name'], 1);

            if (userTeams && userTeams.length > 0) {
              partnerData.team_id = userTeams[0].id;
              console.log(`[Team] Found team ${userTeams[0].name} (ID: ${userTeams[0].id}) for user ${currentUserId}`);
            }
          }
        } catch (teamError) {
          console.warn('[Team] Could not assign team:', teamError);
        }
      }

      // ============================================
      // NUOVO: Posizione Fiscale (Svizzera/Liechtenstein)
      // ============================================
      try {
        // Per clienti svizzeri con partita IVA, cerca posizione fiscale appropriata
        const fiscalPositions = await searchReadOdoo('account.fiscal.position', [
          ['country_id', '=', 43] // Svizzera
        ], ['id', 'name'], 1);

        if (fiscalPositions && fiscalPositions.length > 0) {
          partnerData.property_account_position_id = fiscalPositions[0].id;
          console.log(`[Fiscal] Assigned fiscal position: ${fiscalPositions[0].name}`);
        }
      } catch (fiscalError) {
        console.warn('[Fiscal] Could not assign fiscal position:', fiscalError);
      }

      // ============================================
      // NUOVO: Limite Credito (5000 CHF default per aziende)
      // ============================================
      if (contactType === 'company') {
        partnerData.credit_limit = 5000;
        console.log('[Credit] Set credit limit to 5000 CHF');
      }

      // ============================================
      // NUOVO: Settore/Industry (basato su businessActivity o webSearchData)
      // ============================================
      if (contactType === 'company' && (finalData.businessActivity || webSearchData?.businessTypes?.length)) {
        try {
          // Mappa attività comuni -> settori Odoo
          const INDUSTRY_MAP: Record<string, string> = {
            // Gastronomia
            'restaurant': 'Food Services',
            'ristorante': 'Food Services',
            'gastronomia': 'Food Services',
            'gastro': 'Food Services',
            'bar': 'Food Services',
            'café': 'Food Services',
            'cafe': 'Food Services',
            'pizzeria': 'Food Services',
            'trattoria': 'Food Services',
            'osteria': 'Food Services',
            'hotel': 'Hotels',
            'albergo': 'Hotels',
            'catering': 'Food Services',
            'pasticceria': 'Food Services',
            'bakery': 'Food Services',
            'panetteria': 'Food Services',
            // Retail
            'negozio': 'Retail',
            'shop': 'Retail',
            'store': 'Retail',
            'supermarket': 'Retail',
            'supermercato': 'Retail',
            'alimentari': 'Retail',
            // Altro
            'import': 'Wholesale',
            'export': 'Wholesale',
            'distribuzione': 'Wholesale',
            'distribution': 'Wholesale',
            'grossista': 'Wholesale',
          };

          const activityLower = (finalData.businessActivity || '').toLowerCase();
          const businessTypes = webSearchData?.businessTypes || [];
          let matchedIndustry: string | null = null;

          // Prima cerca nell'attività
          for (const [keyword, industry] of Object.entries(INDUSTRY_MAP)) {
            if (activityLower.includes(keyword)) {
              matchedIndustry = industry;
              break;
            }
          }

          // Se non trovato, cerca nei businessTypes
          if (!matchedIndustry && businessTypes.length > 0) {
            for (const bType of businessTypes) {
              const bTypeLower = bType.toLowerCase();
              for (const [keyword, industry] of Object.entries(INDUSTRY_MAP)) {
                if (bTypeLower.includes(keyword)) {
                  matchedIndustry = industry;
                  break;
                }
              }
              if (matchedIndustry) break;
            }
          }

          // Cerca il settore in Odoo
          if (matchedIndustry) {
            const industries = await searchReadOdoo('res.partner.industry', [
              ['name', 'ilike', matchedIndustry]
            ], ['id', 'name'], 1);

            if (industries && industries.length > 0) {
              partnerData.industry_id = industries[0].id;
              console.log(`[Industry] Assigned industry: ${industries[0].name}`);
            } else {
              console.log(`[Industry] Industry "${matchedIndustry}" not found in Odoo, skipping`);
            }
          }
        } catch (industryError) {
          console.warn('[Industry] Could not assign industry:', industryError);
        }
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
      let deliveryAddressId: number | null = null;
      let invoiceAddressId: number | null = null;

      if (contactType === 'company' && partnerId) {
        console.log('[Step 3.1] Creating delivery and invoice addresses for company...');

        try {
          // Get company name for address labels
          const companyName = partnerData.name || finalData.name || 'Azienda';

          // Indirizzo di consegna (delivery)
          if (partnerData.street || partnerData.city || partnerData.zip) {
            const deliveryAddress: Record<string, any> = {
              parent_id: partnerId,
              type: 'delivery',
              name: `${companyName} - Indirizzo di consegna`,
              street: partnerData.street || '',
              city: partnerData.city || '',
              zip: partnerData.zip || '',
              country_id: partnerData.country_id || 43 // Default Switzerland
            };
            // Aggiungi provincia se presente
            if (partnerData.state_id) {
              deliveryAddress.state_id = partnerData.state_id;
            }
            deliveryAddressId = await createOdoo('res.partner', deliveryAddress);
            console.log(`[Step 3.1] ✓ Created delivery address ID: ${deliveryAddressId}`);
          }

          // Indirizzo di fatturazione (invoice)
          if (partnerData.street || partnerData.city || partnerData.zip) {
            const invoiceAddress: Record<string, any> = {
              parent_id: partnerId,
              type: 'invoice',
              name: `${companyName} - Indirizzo di fatturazione`,
              street: partnerData.street || '',
              city: partnerData.city || '',
              zip: partnerData.zip || '',
              country_id: partnerData.country_id || 43 // Default Switzerland
            };
            // Aggiungi provincia se presente
            if (partnerData.state_id) {
              invoiceAddress.state_id = partnerData.state_id;
            }
            invoiceAddressId = await createOdoo('res.partner', invoiceAddress);
            console.log(`[Step 3.1] ✓ Created invoice address ID: ${invoiceAddressId}`);
          }

          if (!deliveryAddressId && !invoiceAddressId) {
            console.log('[Step 3.1] ⊘ No address data available, skipping address creation');
          }

        } catch (addressError: any) {
          // Non bloccare il flusso se la creazione degli indirizzi fallisce
          console.warn('[Step 3.1] ⚠ Address creation error (non-blocking):', addressError.message);
          warnings.push(`Creazione indirizzi fallita: ${addressError.message}`);
        }
      }

      // ============================================
      // STEP 3.2: METODO DI CONSEGNA (GIRO basato su zona geografica)
      // ============================================
      if (contactType === 'company' && partnerId) {
        console.log('[Step 3.2] Assigning delivery method based on geographic zone...');

        try {
          const { writeOdoo } = await import('@/lib/odoo/odoo-helper');

          // Mappa CAP/Città/Cantone -> GIRO di consegna
          // Basata sui GIRO esistenti nel sistema
          const DELIVERY_ZONES: Record<string, { keywords: string[], zipRanges?: [number, number][] }> = {
            'GIRO ZURIGO CENTRO': {
              keywords: ['zürich', 'zurich', 'zuerich'],
              zipRanges: [[8000, 8099]]
            },
            'GIRO ZURIGO EST': {
              keywords: ['dübendorf', 'wallisellen', 'dietlikon', 'uster', 'wetzikon'],
              zipRanges: [[8600, 8699], [8610, 8620]]
            },
            'GIRO LAGO SUD': {
              keywords: ['thalwil', 'horgen', 'wädenswil', 'richterswil', 'lachen', 'rapperswil', 'jona'],
              zipRanges: [[8800, 8899], [8640, 8645], [8853, 8858]]
            },
            'GIRO TURGOVIA-SANGALLO': {
              keywords: ['winterthur', 'frauenfeld', 'st. gallen', 'st.gallen', 'san gallo', 'wil', 'kreuzlingen'],
              zipRanges: [[8400, 8499], [8500, 8599], [9000, 9099], [9200, 9299]]
            },
            'GIRO ARGOVIA': {
              keywords: ['baden', 'aarau', 'brugg', 'lenzburg', 'zofingen', 'wohlen'],
              zipRanges: [[5000, 5099], [5200, 5299], [5400, 5499], [5600, 5699]]
            },
            'GIRO GINEVRA': {
              keywords: ['genève', 'geneva', 'genf', 'carouge', 'vernier', 'lancy'],
              zipRanges: [[1200, 1299]]
            },
            'GIRO LOSANNA': {
              keywords: ['lausanne', 'vevey', 'montreux', 'nyon', 'morges', 'renens'],
              zipRanges: [[1000, 1199], [1800, 1899]]
            },
            'GIRO LUCERNA': {
              keywords: ['luzern', 'lucerne', 'lucerna', 'zug', 'emmen', 'kriens'],
              zipRanges: [[6000, 6099], [6300, 6399]]
            },
            'GIRO BASILEA': {
              keywords: ['basel', 'basilea', 'bâle', 'riehen', 'allschwil', 'muttenz'],
              zipRanges: [[4000, 4099], [4100, 4199]]
            },
            'GIRO GLARUS': {
              keywords: ['glarus', 'glarona', 'näfels', 'mollis'],
              zipRanges: [[8750, 8779]]
            },
            'GIRO TICINO': {
              keywords: ['lugano', 'bellinzona', 'locarno', 'mendrisio', 'chiasso', 'ascona', 'ticino'],
              zipRanges: [[6500, 6999]]
            }
          };

          const cityLower = (finalData.city || '').toLowerCase();
          const zip = parseInt(finalData.zip || '0', 10);
          let matchedGiro: string | null = null;

          // Prima cerca per keyword (città)
          for (const [giroName, config] of Object.entries(DELIVERY_ZONES)) {
            if (config.keywords.some(kw => cityLower.includes(kw))) {
              matchedGiro = giroName;
              break;
            }
          }

          // Se non trovato, cerca per range CAP
          if (!matchedGiro && zip > 0) {
            for (const [giroName, config] of Object.entries(DELIVERY_ZONES)) {
              if (config.zipRanges) {
                for (const [min, max] of config.zipRanges) {
                  if (zip >= min && zip <= max) {
                    matchedGiro = giroName;
                    break;
                  }
                }
              }
              if (matchedGiro) break;
            }
          }

          // Se trovato un GIRO, cerca l'ID del delivery.carrier in Odoo
          if (matchedGiro) {
            const carriers = await searchReadOdoo('delivery.carrier', [
              ['name', 'ilike', matchedGiro]
            ], ['id', 'name'], 1);

            if (carriers && carriers.length > 0) {
              // Aggiorna il partner con il metodo di consegna
              await writeOdoo('res.partner', [partnerId], {
                property_delivery_carrier_id: carriers[0].id
              });
              console.log(`[Step 3.2] ✓ Assigned delivery method: ${carriers[0].name} (ID: ${carriers[0].id})`);
            } else {
              console.warn(`[Step 3.2] ⚠ Delivery carrier "${matchedGiro}" not found in Odoo`);
              warnings.push(`Metodo consegna "${matchedGiro}" non trovato`);
            }
          } else {
            console.log('[Step 3.2] ⊘ No matching delivery zone for address');
          }
        } catch (deliveryError: any) {
          console.warn('[Step 3.2] ⚠ Delivery method assignment error:', deliveryError.message);
          warnings.push(`Assegnazione metodo consegna fallita: ${deliveryError.message}`);
        }
      }

      // ============================================
      // STEP 3.3: GEOLOCALIZZAZIONE (attiva coordinate)
      // ============================================
      if (partnerId) {
        console.log('[Step 3.3] Activating geolocation for partner...');

        try {
          const { callOdoo } = await import('@/lib/odoo/odoo-helper');

          // Chiama il metodo geo_localize di Odoo che calcola lat/lng dall'indirizzo
          await callOdoo('res.partner', 'geo_localize', [[partnerId]]);
          console.log('[Step 3.3] ✓ Geolocation activated for partner');
        } catch (geoError: any) {
          console.warn('[Step 3.3] ⚠ Geolocation activation error:', geoError.message);
          warnings.push(`Attivazione geolocalizzazione fallita: ${geoError.message}`);
        }
      }

      // ============================================
      // STEP 3.4: ETICHETTE PARTNER (category_id)
      // ============================================
      if (partnerId) {
        console.log('[Step 3.4] Adding partner tags...');

        try {
          const { writeOdoo } = await import('@/lib/odoo/odoo-helper');

          // Helper per cercare o creare un tag
          const getOrCreateTag = async (tagName: string): Promise<number | null> => {
            const existingTags = await searchReadOdoo('res.partner.category', [
              ['name', '=', tagName]
            ], ['id'], 1);

            if (existingTags && existingTags.length > 0) {
              return existingTags[0].id;
            } else {
              try {
                const newTagId = await createOdoo('res.partner.category', {
                  name: tagName,
                  active: true
                });
                console.log(`[Step 3.4] Created new tag: ${tagName} (ID: ${newTagId})`);
                return newTagId;
              } catch (createTagError) {
                console.warn(`[Step 3.4] Could not create tag ${tagName}:`, createTagError);
                return null;
              }
            }
          };

          // 1. Etichetta "Cliente" per il partner principale
          const clienteTagId = await getOrCreateTag('Cliente');
          if (clienteTagId) {
            await writeOdoo('res.partner', [partnerId], {
              category_id: [[6, 0, [clienteTagId]]]
            });
            console.log(`[Step 3.4] ✓ Assigned "Cliente" tag to main partner`);
          }

          // 2. Etichetta "Indirizzo di consegna" per l'indirizzo consegna
          if (deliveryAddressId) {
            const consegnaTagId = await getOrCreateTag('Indirizzo di consegna');
            if (consegnaTagId) {
              await writeOdoo('res.partner', [deliveryAddressId], {
                category_id: [[6, 0, [consegnaTagId]]]
              });
              console.log(`[Step 3.4] ✓ Assigned "Indirizzo di consegna" tag to delivery address`);
            }
          }

          // 3. Etichetta "Indirizzo di fatturazione" per l'indirizzo fatturazione
          if (invoiceAddressId) {
            const fatturazioneTagId = await getOrCreateTag('Indirizzo di fatturazione');
            if (fatturazioneTagId) {
              await writeOdoo('res.partner', [invoiceAddressId], {
                category_id: [[6, 0, [fatturazioneTagId]]]
              });
              console.log(`[Step 3.4] ✓ Assigned "Indirizzo di fatturazione" tag to invoice address`);
            }
          }

        } catch (tagError: any) {
          console.warn('[Step 3.4] ⚠ Tag assignment error:', tagError.message);
          warnings.push(`Assegnazione etichette fallita: ${tagError.message}`);
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
