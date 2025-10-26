import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { loadSkill } from '@/lib/ai/skills-loader';
// TODO: Riabilitare supporto XML FatturaPA quando testato su Vercel
// import { parseFatturaPA, isFatturaPA } from '@/lib/fatturapa-parser';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Consenti fino a 60 secondi per l'analisi AI

/**
 * POST /api/valida-fatture/analyze-and-compare
 *
 * CORE ENGINE: Analizza PDF fattura definitiva e confronta con bozza in Odoo
 * Usa Claude Vision per parsing + Claude per matching intelligente
 */
export async function POST(request: NextRequest) {
  try {
    const { attachment_id, draft_invoice } = await request.json();

    if (!attachment_id || !draft_invoice) {
      return NextResponse.json(
        { error: 'Dati mancanti: attachment_id e draft_invoice richiesti' },
        { status: 400 }
      );
    }

    console.log('🤖 [ANALYZE-COMPARE] Starting AI analysis...');
    console.log(`📄 Invoice: ${draft_invoice.name}, Total: €${draft_invoice.amount_total}`);
    console.log(`📋 Lines in draft: ${draft_invoice.invoice_line_ids?.length || 0}`);
    console.log(`📎 Attachment ID: ${attachment_id}`);

    // Get Odoo session for API calls
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione Odoo non valida' }, { status: 401 });
    }

    // STEP 0.5: Arricchisci righe bozza con default_code (codice fornitore) per matching preciso
    console.log('📚 [ANALYZE-COMPARE] Enriching draft lines with supplier codes...');
    const productIds = draft_invoice.invoice_line_ids
      .filter((line: any) => line.product_id && line.product_id[0])
      .map((line: any) => line.product_id[0]);

    let productData: any[] = [];
    if (productIds.length > 0) {
      productData = await callOdoo(
        cookies,
        'product.product',
        'read',
        [productIds],
        { fields: ['id', 'default_code', 'name'] }
      );
    }

    // Crea mappa product_id → default_code
    const productCodeMap = new Map(
      productData.map((p: any) => [p.id, p.default_code || null])
    );

    // Arricchisci righe con default_code
    const enrichedLines = draft_invoice.invoice_line_ids.map((line: any) => ({
      ...line,
      default_code: line.product_id ? productCodeMap.get(line.product_id[0]) : null
    }));

    console.log(`✅ [ANALYZE-COMPARE] Enriched ${enrichedLines.length} lines with supplier codes`);

    // Scarica il PDF da Odoo usando l'attachment_id

    console.log('📥 [ANALYZE-COMPARE] Downloading PDF from Odoo...');
    const attachments = await callOdoo(
      cookies,
      'ir.attachment',
      'read',
      [[attachment_id]],
      { fields: ['datas', 'mimetype', 'name'] }
    );

    if (!attachments || attachments.length === 0) {
      throw new Error('PDF non trovato in Odoo');
    }

    const pdf_base64 = attachments[0].datas;
    const pdf_mimetype = attachments[0].mimetype;
    console.log(`✅ [ANALYZE-COMPARE] PDF downloaded: ${attachments[0].name}, size: ${(pdf_base64.length / 1024 / 1024).toFixed(2)} MB`);

    // STEP 0: Check formato file
    let parsedInvoice;
    const isXML = pdf_mimetype === 'text/xml' || pdf_mimetype === 'application/xml';

    if (isXML) {
      // TODO: XML FatturaPA support temporaneamente disabilitato per testing Vercel
      console.log('⚠️ [ANALYZE-COMPARE] XML FatturaPA non ancora supportato');
      return NextResponse.json(
        { error: 'Formato XML FatturaPA non ancora supportato. Usa PDF o immagini (JPG/PNG).' },
        { status: 400 }
      );
    } else {
      // STEP 1: Parse PDF/Image con Claude Vision
      console.log('👁️ [ANALYZE-COMPARE] Step 1: Parsing document with Claude Vision...');
      console.log(`📄 [ANALYZE-COMPARE] File type: ${pdf_mimetype}`);

    // Determina il tipo di contenuto basandosi sul mimetype
    const isImage = pdf_mimetype?.startsWith('image/');
    const isPdf = pdf_mimetype === 'application/pdf';

    // Per immagini usiamo 'image', per PDF usiamo 'document'
    const contentType = isImage ? 'image' : 'document';

    // Normalizza il media_type per Claude
    let claudeMediaType = pdf_mimetype;
    if (isPdf) {
      claudeMediaType = 'application/pdf';
    } else if (isImage) {
      // Claude supporta image/jpeg, image/png, image/gif, image/webp
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(pdf_mimetype)) {
        claudeMediaType = 'image/jpeg'; // default per immagini non standard
      }
    }

    const visionMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: contentType as any,
              source: {
                type: 'base64',
                media_type: claudeMediaType,
                data: pdf_base64,
              },
            },
            {
              type: 'text',
              text: `Sei un esperto contabile che deve analizzare una fattura italiana in formato PDF.

🎯 METODO DI LETTURA CRITICO - LEGGI AL CONTRARIO (DA DESTRA A SINISTRA):

Per ogni riga prodotto, segui ESATTAMENTE questo ordine:
1. TROVA IL TOTALE RIGA (colonna destra, es: "IMP.NET.€" o "TOTALE")
2. POI TROVA IL PREZZO UNITARIO (colonna centrale, es: "PR.UNI.€" o "PREZZO")
3. INFINE CALCOLA LA QUANTITÀ: Quantità = Totale Riga ÷ Prezzo Unitario

⚠️ REGOLE CRITICHE:
- NON fidarti della colonna "Q.TA" se i numeri non tornano!
- Il TOTALE RIGA è la verità assoluta
- Se Totale = 46.86€ e Prezzo = 4.70€, allora Q.tà = 46.86 ÷ 4.70 = 9.97 kg (NON 3kg!)
- Molti fornitori scrivono "3 KG" nell'unità di misura ma vendono in quantità diverse
- Le fatture italiane usano virgola (123,45) → converti in punto (123.45)

📋 ESEMPIO CONCRETO DALLA FATTURA:
Se vedi:
"MORTADELLA C/P 3.5KG | 3 KG | 9,970 | 4,700 | 46,86"
Leggi così:
- Totale riga = 46.86€ (VERITÀ)
- Prezzo unitario = 4.70€/kg
- Quantità reale = 46.86 ÷ 4.70 = 9.97 kg ✅
- "3 KG" è solo l'unità di vendita (vaschetta da 3kg), ma ne hanno ordinati 9.97kg!

🔍 COSA ESTRARRE:

1. DATI FORNITORE:
   - Nome completo
   - P.IVA (se presente)

2. DATI FATTURA:
   - Numero fattura (es: "42", "V2/0003329")
   - Data fattura (IMPORTANTE: converti sempre in formato YYYY-MM-DD, es: "15/10/2025" → "2025-10-15")

3. RIGHE PRODOTTI (TUTTE, anche spese trasporto):
   Per OGNI riga:
   a) Descrizione completa (includi codici prodotto se presenti)
   b) Codice articolo - CRITICO PER IL MATCHING!
      - Cerca nella PRIMA COLONNA a sinistra (es: "1TRECCE-SV", "1BRASELLO-SV")
      - O dopo "Articolo" / "Art." / "Cod." (es: "AZCOM051", "P09956")
      - Se manca, lascia null
   c) SUBTOTAL (totale riga) - PRIORITÀ MASSIMA
   d) Prezzo unitario
   e) Quantità = subtotal ÷ unit_price
   f) Aliquota IVA (22%, 10%, 4%, ecc.)
   g) Unità di misura (KG, PZ, LT, ecc.)

4. TOTALI FATTURA:
   - Imponibile totale
   - IVA totale
   - TOTALE DA PAGARE (numero finale in fondo)

⚠️ ATTENZIONE SPECIALE:
- Se vedi "P.Net" o "Peso Netto" ignora, usa il SUBTOTAL
- "TECHNICAL STOP", "LDF SRL", "ASSAGO" = destinazione merce, NON prodotti
- Cerca sempre l'ultima pagina per il TOTALE FATTURA LORDO

⚠️ ATTENZIONE DATE:
- Cerca la data della fattura (es: "DATA DOC", "Data:", ecc.)
- Se vedi "15/10/2025" converti in "2025-10-15"
- Se vedi "15.10.2025" converti in "2025-10-15"
- Formato finale SEMPRE: YYYY-MM-DD

Rispondi SOLO con JSON valido:
{
  "supplier_name": "SALUMIFICIO F.LLI COATI S.P.A.",
  "supplier_vat": "02451960237",
  "invoice_number": "42",
  "invoice_date": "2025-10-15",
  "subtotal_amount": 1685.04,
  "tax_amount": 0.00,
  "total_amount": 1685.04,
  "currency": "EUR",
  "lines": [
    {
      "description": "MORTADELLA C/P 3.5KG 1/2 SV RIF.VS ORD.N°9871",
      "product_code": "AZCOM051",
      "quantity": 9.97,
      "unit_price": 4.70,
      "subtotal": 46.86,
      "tax_rate": 0,
      "unit": "KG"
    }
  ]
}

NUMERI PRECISI: 123,45 → 123.45 (punto decimale), arrotonda a 2 decimali.`
            }
          ]
        }
      ]
    });

    const visionText = visionMessage.content[0].type === 'text' ? visionMessage.content[0].text : '';

    // Estrai JSON dalla risposta
    const jsonMatch = visionText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Claude non ha restituito JSON valido nel parsing');
    }

      parsedInvoice = JSON.parse(jsonMatch[0]);
      console.log('✅ [ANALYZE-COMPARE] PDF/Image parsed:', {
        supplier: parsedInvoice.supplier_name,
        total: parsedInvoice.total_amount,
        lines: parsedInvoice.lines.length
      });

      // 🔍 CRITICAL DEBUG: Log TOTALE da Vision vs Bozza
      console.log('🔍 [CRITICAL] TOTALI COMPARISON:');
      console.log(`   Vision PDF total: €${parsedInvoice.total_amount}`);
      console.log(`   Vision PDF subtotal: €${parsedInvoice.subtotal_amount}`);
      console.log(`   Draft Odoo total: €${draft_invoice.amount_total}`);
      console.log(`   DIFF: €${(parsedInvoice.total_amount - draft_invoice.amount_total).toFixed(2)}`);

      // Verifica somma righe PDF
      const sumPdfLines = parsedInvoice.lines.reduce((sum: number, line: any) => sum + parseFloat(line.subtotal || 0), 0);
      console.log(`   Sum PDF lines: €${sumPdfLines.toFixed(2)}`);
      if (Math.abs(sumPdfLines - parsedInvoice.total_amount) > 0.10) {
        console.error(`   ⚠️ WARNING: Sum of lines (${sumPdfLines}) != total (${parsedInvoice.total_amount})`);
        console.error(`   Vision might be parsing incorrectly!`);
      }
    }

    // STEP 2: Confronto Intelligente con Claude + SKILL
    console.log('🧠 [ANALYZE-COMPARE] Step 2: Smart comparison with invoice-comparison skill...');

    // 🔍 DEBUG: Log dati in ingresso per diagnostica
    console.log('📄 [DEBUG] PDF INVOICE LINES:');
    parsedInvoice.lines.forEach((line: any, idx: number) => {
      console.log(`  ${idx + 1}. ${line.product_code || 'NO-CODE'} | ${line.description} | qty=${line.quantity} | price=${line.unit_price} | subtotal=${line.subtotal}`);
    });
    console.log(`📄 [DEBUG] PDF TOTAL: €${parsedInvoice.total_amount}`);

    console.log('📋 [DEBUG] DRAFT INVOICE LINES:');
    enrichedLines.forEach((line: any, idx: number) => {
      console.log(`  ${idx + 1}. ${line.default_code || 'NO-CODE'} | ${line.product_id?.[1] || line.name} | qty=${line.quantity} | price=${line.price_unit} | subtotal=${line.price_subtotal}`);
    });
    console.log(`📋 [DEBUG] DRAFT TOTAL: €${draft_invoice.amount_total}`);

    // 🔍 DEBUG: Crea mappa subtotal per verificare matching
    const draftSubtotalMap = new Map<number, number>();
    enrichedLines.forEach((line: any) => {
      const subtotal = parseFloat(line.price_subtotal);
      draftSubtotalMap.set(subtotal, (draftSubtotalMap.get(subtotal) || 0) + 1);
    });

    console.log('🔍 [DEBUG] SUBTOTAL MATCHING TEST:');
    parsedInvoice.lines.forEach((pdfLine: any, idx: number) => {
      const pdfSubtotal = parseFloat(pdfLine.subtotal);
      const matchCount = draftSubtotalMap.get(pdfSubtotal) || 0;
      console.log(`  PDF #${idx + 1} subtotal=${pdfSubtotal} → Found ${matchCount} match(es) in draft`);
    });

    // 🎯 PRE-MATCHING: Fai matching subtotal PRIMA di chiamare Claude
    console.log('🎯 [PRE-MATCH] Starting server-side subtotal matching...');

    interface MatchResult {
      pdfLine: any;
      draftLine: any | null;
      matchType: 'exact' | 'price_diff' | 'qty_diff' | 'both_diff' | 'not_found';
      subtotalDiff: number;
    }

    const matches: MatchResult[] = [];
    const usedDraftLines = new Set<number>();

    // Per ogni riga PDF, trova match in bozza
    for (const pdfLine of parsedInvoice.lines) {
      const pdfSubtotal = parseFloat(pdfLine.subtotal);

      // Cerca match ESATTO su subtotal (±0.02€ tolleranza per arrotondamenti)
      let matchedDraft = enrichedLines.find((draft: any, idx: number) => {
        if (usedDraftLines.has(idx)) return false;
        const draftSubtotal = parseFloat(draft.price_subtotal);
        return Math.abs(draftSubtotal - pdfSubtotal) <= 0.02;
      });

      if (matchedDraft) {
        const draftIdx = enrichedLines.indexOf(matchedDraft);
        usedDraftLines.add(draftIdx);
        matches.push({
          pdfLine,
          draftLine: matchedDraft,
          matchType: 'exact',
          subtotalDiff: 0
        });
        console.log(`  ✅ MATCH: ${pdfLine.description.substring(0, 40)} → subtotal ${pdfSubtotal}`);
        continue;
      }

      // Se non trova match esatto, cerca riga simile (stesso prezzo O stessa quantità)
      matchedDraft = enrichedLines.find((draft: any, idx: number) => {
        if (usedDraftLines.has(idx)) return false;
        const priceSimilar = Math.abs(parseFloat(draft.price_unit) - parseFloat(pdfLine.unit_price)) <= 0.02;
        const qtySimilar = Math.abs(parseFloat(draft.quantity) - parseFloat(pdfLine.quantity)) <= 0.1;
        return priceSimilar || qtySimilar;
      });

      if (matchedDraft) {
        const draftIdx = enrichedLines.indexOf(matchedDraft);
        usedDraftLines.add(draftIdx);
        const draftSubtotal = parseFloat(matchedDraft.price_subtotal);
        const diff = pdfSubtotal - draftSubtotal;

        const priceMatch = Math.abs(parseFloat(matchedDraft.price_unit) - parseFloat(pdfLine.unit_price)) <= 0.02;
        const qtyMatch = Math.abs(parseFloat(matchedDraft.quantity) - parseFloat(pdfLine.quantity)) <= 0.1;

        let matchType: 'price_diff' | 'qty_diff' | 'both_diff' = 'both_diff';
        if (priceMatch && !qtyMatch) matchType = 'qty_diff';
        if (!priceMatch && qtyMatch) matchType = 'price_diff';

        matches.push({
          pdfLine,
          draftLine: matchedDraft,
          matchType,
          subtotalDiff: diff
        });
        console.log(`  ⚠️ PARTIAL MATCH: ${pdfLine.description.substring(0, 40)} → ${matchType}, diff €${diff.toFixed(2)}`);
        continue;
      }

      // Nessun match trovato
      matches.push({
        pdfLine,
        draftLine: null,
        matchType: 'not_found',
        subtotalDiff: pdfSubtotal
      });
      console.log(`  ❌ NOT FOUND: ${pdfLine.description.substring(0, 40)} → subtotal ${pdfSubtotal}`);
    }

    console.log(`✅ [PRE-MATCH] Completed: ${matches.filter(m => m.matchType === 'exact').length} exact, ${matches.filter(m => m.matchType !== 'exact' && m.matchType !== 'not_found').length} partial, ${matches.filter(m => m.matchType === 'not_found').length} not found`);

    // 🎯 GENERA CORREZIONI da pre-matching (BYPASSA Claude per righe exact match)
    const corrections: any[] = [];
    const differences: any[] = [];
    let totalDifference = 0;

    for (const match of matches) {
      if (match.matchType === 'exact') {
        // Riga OK, nessuna correzione
        continue;
      }

      if (match.matchType === 'not_found') {
        // Prodotto mancante
        corrections.push({
          action: 'create',
          parsed_line: {
            description: match.pdfLine.description,
            product_code: match.pdfLine.product_code,
            quantity: match.pdfLine.quantity,
            unit_price: match.pdfLine.unit_price,
            subtotal: match.pdfLine.subtotal
          },
          reason: `Prodotto presente in PDF ma non trovato in bozza (€${match.pdfLine.subtotal})`,
          requires_user_approval: true
        });

        differences.push({
          type: 'missing_product',
          severity: 'error',
          draft_line_id: null,
          description: `Prodotto mancante: ${match.pdfLine.description}`,
          expected_value: match.pdfLine.subtotal,
          actual_value: 0,
          amount_difference: match.pdfLine.subtotal
        });

        totalDifference += match.pdfLine.subtotal;
        continue;
      }

      // Prezzo o quantità diversi
      if (match.matchType === 'price_diff') {
        corrections.push({
          action: 'update',
          line_id: match.draftLine.id,
          changes: { price_unit: match.pdfLine.unit_price },
          reason: `Prezzo errato: bozza €${match.draftLine.price_unit}, reale €${match.pdfLine.unit_price} (impatto: €${match.subtotalDiff.toFixed(2)})`,
          requires_user_approval: false
        });

        differences.push({
          type: 'price_mismatch',
          severity: 'warning',
          draft_line_id: match.draftLine.id,
          description: `Prezzo ${match.pdfLine.description}: bozza €${match.draftLine.price_unit}, reale €${match.pdfLine.unit_price}`,
          expected_value: match.pdfLine.unit_price,
          actual_value: match.draftLine.price_unit,
          amount_difference: match.subtotalDiff
        });
      }

      if (match.matchType === 'qty_diff') {
        corrections.push({
          action: 'update',
          line_id: match.draftLine.id,
          changes: { quantity: match.pdfLine.quantity },
          reason: `Quantità errata: bozza ${match.draftLine.quantity}, reale ${match.pdfLine.quantity} (impatto: €${match.subtotalDiff.toFixed(2)})`,
          requires_user_approval: false
        });

        differences.push({
          type: 'quantity_mismatch',
          severity: 'warning',
          draft_line_id: match.draftLine.id,
          description: `Quantità ${match.pdfLine.description}: bozza ${match.draftLine.quantity}, reale ${match.pdfLine.quantity}`,
          expected_value: match.pdfLine.quantity,
          actual_value: match.draftLine.quantity,
          amount_difference: match.subtotalDiff
        });
      }

      if (match.matchType === 'both_diff') {
        corrections.push({
          action: 'update',
          line_id: match.draftLine.id,
          changes: {
            price_unit: match.pdfLine.unit_price,
            quantity: match.pdfLine.quantity
          },
          reason: `Prezzo e quantità errati (impatto: €${match.subtotalDiff.toFixed(2)})`,
          requires_user_approval: false
        });

        differences.push({
          type: 'both_mismatch',
          severity: 'warning',
          draft_line_id: match.draftLine.id,
          description: `Prezzo e quantità ${match.pdfLine.description}`,
          expected_value: match.pdfLine.subtotal,
          actual_value: match.draftLine.price_subtotal,
          amount_difference: match.subtotalDiff
        });
      }

      totalDifference += Math.abs(match.subtotalDiff);
    }

    // Genera risultato finale (BYPASSA Claude!) - per debug
    const bypassedResult = {
      is_valid: corrections.length === 0,
      total_difference: totalDifference,
      draft_total: draft_invoice.amount_total,
      real_total: parsedInvoice.total_amount,
      differences,
      corrections_needed: corrections,
      can_auto_fix: corrections.every((c: any) => !c.requires_user_approval)
    };

    console.log('✅ [SERVER-MATCH] Bypassed Claude, generated corrections directly from TypeScript');
    console.log(`   Exact matches: ${matches.filter(m => m.matchType === 'exact').length}`);
    console.log(`   Corrections: ${corrections.length}`);

    // 🎯 RIPRISTINO chiamata Claude per debug
    const comparisonSkill = loadSkill('document-processing/invoice-comparison');
    console.log(`📚 [ANALYZE-COMPARE] Using skill: ${comparisonSkill.metadata.name} v${comparisonSkill.metadata.version}`);

    const comparisonMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `${comparisonSkill.content}

---

# DATI DA CONFRONTARE:

📄 FATTURA DEFINITIVA (PDF del fornitore):
${JSON.stringify(parsedInvoice, null, 2)}

📋 FATTURA BOZZA ODOO:
Nome: ${draft_invoice.name}
Fornitore: ${draft_invoice.partner_id[1]}
Data: ${draft_invoice.invoice_date || 'N/A'}
Imponibile: €${draft_invoice.amount_untaxed}
IVA: €${draft_invoice.amount_tax}
TOTALE: €${draft_invoice.amount_total}

RIGHE BOZZA (con codici fornitore):
${JSON.stringify(enrichedLines.map((line: any) => ({
  id: line.id,
  product: line.product_id ? line.product_id[1] : 'N/A',
  supplier_code: line.default_code || null,
  description: line.name,
  quantity: line.quantity,
  unit_price: line.price_unit,
  subtotal: line.price_subtotal,
  total: line.price_total
})), null, 2)}`
        }
      ]
    });

    const comparisonText = comparisonMessage.content[0].type === 'text' ? comparisonMessage.content[0].text : '';
    const comparisonJsonMatch = comparisonText.match(/\{[\s\S]*\}/);

    if (!comparisonJsonMatch) {
      throw new Error('Claude non ha restituito JSON valido nel confronto');
    }

    const comparisonResult = JSON.parse(comparisonJsonMatch[0]);

    // 🔒 POST-PROCESSING: FORCE all CREATE actions to require user approval
    // This ensures the product management step is triggered when products are missing
    if (comparisonResult.corrections_needed && Array.isArray(comparisonResult.corrections_needed)) {
      comparisonResult.corrections_needed = comparisonResult.corrections_needed.map((correction: any) => {
        if (correction.action === 'create') {
          console.log('🔒 [ANALYZE-COMPARE] Forcing user approval for CREATE action:', correction.parsed_line?.description || 'Unknown product');
          return {
            ...correction,
            requires_user_approval: true
          };
        }
        return correction;
      });
    }

    // OVERRIDE: Usa risultato Claude invece di server-side per debug
    console.log('🔄 [DEBUG] Using Claude result instead of server-side matching');

    console.log('✅ [ANALYZE-COMPARE] Comparison completed:', {
      is_valid: comparisonResult.is_valid,
      difference: comparisonResult.total_difference,
      corrections: comparisonResult.corrections_needed.length,
      creates_requiring_approval: comparisonResult.corrections_needed.filter((c: any) => c.action === 'create' && c.requires_user_approval).length
    });

    // 🔍 DEBUG: Log tutte le correzioni in dettaglio per diagnostica
    console.log('🔍 [ANALYZE-COMPARE] Detailed corrections:');
    comparisonResult.corrections_needed.forEach((correction: any, index: number) => {
      console.log(`  ${index + 1}. ${correction.action} line ${correction.line_id || 'N/A'}:`, JSON.stringify(correction.changes || correction.new_line || correction.parsed_line));
      console.log(`     Reason: ${correction.reason}`);
    });

    // 🔍 DEBUG: Log anche le differences per capire cosa Claude ha trovato
    if (comparisonResult.differences && Array.isArray(comparisonResult.differences)) {
      console.log('🔍 [ANALYZE-COMPARE] Detailed differences:');
      comparisonResult.differences.forEach((diff: any, index: number) => {
        console.log(`  ${index + 1}. ${diff.type} | ${diff.description}`);
        console.log(`     Severity: ${diff.severity}, Amount: €${diff.amount_difference || 0}`);
      });
    }

    return NextResponse.json({
      success: true,
      parsed_invoice: parsedInvoice,
      comparison: comparisonResult
    });

  } catch (error: any) {
    console.error('❌ [ANALYZE-COMPARE] Error:', error);

    // Gestione errori specifici
    let errorMessage = 'Errore analisi e confronto';

    if (error.message?.includes('JSON')) {
      errorMessage = 'Claude non ha restituito un formato JSON valido. Riprova.';
    } else if (error.message?.includes('API key')) {
      errorMessage = 'Errore configurazione API Anthropic';
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      errorMessage = 'Timeout durante l\'analisi. Il PDF potrebbe essere troppo grande o complesso.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
 
