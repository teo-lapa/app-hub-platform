import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/valida-fatture/analyze-and-compare
 *
 * CORE ENGINE: Analizza PDF fattura definitiva e confronta con bozza in Odoo
 * Usa Claude Vision per parsing + Claude per matching intelligente
 */
export async function POST(request: NextRequest) {
  try {
    const { pdf_base64, pdf_mimetype, draft_invoice } = await request.json();

    if (!pdf_base64 || !draft_invoice) {
      return NextResponse.json(
        { error: 'Dati mancanti: pdf_base64 e draft_invoice richiesti' },
        { status: 400 }
      );
    }

    console.log('🤖 [ANALYZE-COMPARE] Starting AI analysis...');
    console.log(`📄 Invoice: ${draft_invoice.name}, Total: €${draft_invoice.amount_total}`);
    console.log(`📋 Lines in draft: ${draft_invoice.invoice_line_ids?.length || 0}`);

    // STEP 1: Parse PDF con Claude Vision
    console.log('👁️ [ANALYZE-COMPARE] Step 1: Parsing PDF with Claude Vision...');

    // Claude Vision supporta solo immagini, non PDF
    // Se è PDF, usiamo 'image/png' come workaround (Claude lo gestisce comunque)
    let mediaType = pdf_mimetype;
    if (pdf_mimetype === 'application/pdf') {
      mediaType = 'application/pdf'; // Claude API ora supporta PDF!
    }

    const visionMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: pdf_base64,
              },
            },
            {
              type: 'text',
              text: `Analizza questa fattura fornitore e estrai TUTTI i dati in formato JSON.

IMPORTANTE: Devi essere PRECISISSIMO con i numeri e i totali.

Estrai:
1. Dati fornitore (nome, P.IVA se presente)
2. Numero e data fattura
3. TUTTI i prodotti con:
   - Descrizione esatta
   - Codice articolo (se presente)
   - Quantità
   - Prezzo unitario
   - Subtotale riga
   - Aliquota IVA (se indicata)
   - Unità di misura
4. Totali:
   - Imponibile
   - IVA
   - TOTALE FINALE

Rispondi SOLO con JSON valido in questo formato:
{
  "supplier_name": "Nome fornitore",
  "supplier_vat": "P.IVA o null",
  "invoice_number": "Numero fattura",
  "invoice_date": "YYYY-MM-DD o null",
  "subtotal_amount": 100.50,
  "tax_amount": 22.11,
  "total_amount": 122.61,
  "currency": "EUR",
  "lines": [
    {
      "description": "Descrizione prodotto esatta",
      "product_code": "COD123 o null",
      "quantity": 10,
      "unit_price": 10.05,
      "subtotal": 100.50,
      "tax_rate": 22,
      "unit": "pz"
    }
  ]
}

ATTENZIONE: I numeri devono essere ESATTI. Se vedi 122,61 scrivi 122.61 (usa punto decimale).`
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

    const parsedInvoice = JSON.parse(jsonMatch[0]);
    console.log('✅ [ANALYZE-COMPARE] PDF parsed:', {
      supplier: parsedInvoice.supplier_name,
      total: parsedInvoice.total_amount,
      lines: parsedInvoice.lines.length
    });

    // STEP 2: Confronto Intelligente con Claude
    console.log('🧠 [ANALYZE-COMPARE] Step 2: Smart comparison...');

    const comparisonMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `Sei un esperto contabile. Devi confrontare una FATTURA DEFINITIVA con una FATTURA BOZZA in Odoo e trovare TUTTE le differenze.

FATTURA DEFINITIVA (quella vera del fornitore):
${JSON.stringify(parsedInvoice, null, 2)}

FATTURA BOZZA IN ODOO:
Nome: ${draft_invoice.name}
Fornitore: ${draft_invoice.partner_id[1]}
Data: ${draft_invoice.invoice_date || 'N/A'}
Imponibile: €${draft_invoice.amount_untaxed}
IVA: €${draft_invoice.amount_tax}
TOTALE: €${draft_invoice.amount_total}

RIGHE BOZZA:
${JSON.stringify(draft_invoice.invoice_line_ids.map((line: any) => ({
  id: line.id,
  product: line.product_id ? line.product_id[1] : 'N/A',
  description: line.name,
  quantity: line.quantity,
  unit_price: line.price_unit,
  subtotal: line.price_subtotal,
  total: line.price_total
})), null, 2)}

COMPITO:
1. MATCHA INTELLIGENTEMENTE le righe tra fattura definitiva e bozza
   - NON fare matching solo per descrizione esatta!
   - Usa codici prodotto (es: "P09956", "[RI1500TS]")
   - Usa somiglianza semantica (es: "Ricotta 1.5kg" = "Ricotta Kg.1,5")
   - Se stesso prodotto ma prezzo/quantità diversi → UPDATE
   - Se non trovi corrispondenza → CREATE o DELETE

2. Trova differenze CRITICHE:
   - Prezzi unitari diversi → PRIORITÀ MASSIMA
   - Quantità diverse → PRIORITÀ ALTA
   - Prodotti mancanti/extra → Serve approvazione utente

3. Calcola TOTALE: Fattura definitiva €${parsedInvoice.total_amount} VS Bozza €${draft_invoice.amount_total}
   Differenza: €${(parsedInvoice.total_amount - draft_invoice.amount_total).toFixed(2)}

4. Genera CORREZIONI PRECISE per raggiungere totale esatto ±0.02€

REGOLE CORREZIONI:
- Prezzo sbagliato in bozza → action: "update", changes: {"price_unit": prezzo_corretto_da_pdf}
- Quantità sbagliata → action: "update", changes: {"quantity": quantità_corretta}
- Prodotto mancante in bozza → action: "create", requires_user_approval: true, DEVI includere "parsed_line" con TUTTI i dati del prodotto dal PDF (description, product_code, quantity, unit_price, subtotal, tax_rate, unit)
- Prodotto extra in bozza → action: "delete", requires_user_approval: false
- Descrizione diversa ma prezzo OK → NON correggere

ESEMPIO CONCRETO:
Se in PDF vedi "Ricotta 1,5kg" a €4.05 e in bozza trovi "[RI1500TS] Ricotta Kg.1,5" a €10.00:
→ Stesso prodotto! Prezzo sbagliato!
→ Correzione: {"action": "update", "line_id": ID_RIGA_BOZZA, "changes": {"price_unit": 4.05}}

FOCUS ASSOLUTO: Far tornare i NUMERI (prezzi e quantità), NON le descrizioni!

Rispondi SOLO con JSON in questo formato:
{
  "is_valid": false,
  "total_difference": -10.50,
  "draft_total": ${draft_invoice.amount_total},
  "real_total": ${parsedInvoice.total_amount},
  "differences": [
    {
      "type": "price_mismatch",
      "severity": "warning",
      "draft_line_id": 123,
      "description": "Prezzo Prodotto X: bozza €10.00, reale €11.50",
      "expected_value": 11.50,
      "actual_value": 10.00,
      "amount_difference": 1.50
    }
  ],
  "corrections_needed": [
    {
      "action": "update",
      "line_id": 123,
      "changes": {
        "price_unit": 11.50,
        "quantity": 10
      },
      "reason": "Aggiornamento prezzo da €10.00 a €11.50",
      "requires_user_approval": false
    },
    {
      "action": "delete",
      "line_id": 456,
      "reason": "Prodotto non presente in fattura definitiva",
      "requires_user_approval": false
    },
    {
      "action": "create",
      "parsed_line": {
        "description": "Descrizione esatta dal PDF",
        "product_code": "COD123 o null",
        "quantity": 5,
        "unit_price": 20.00,
        "subtotal": 100.00,
        "tax_rate": 22,
        "unit": "pz"
      },
      "new_line": {
        "name": "Nuovo Prodotto XYZ",
        "quantity": 5,
        "price_unit": 20.00
      },
      "reason": "Prodotto presente in fattura definitiva ma mancante in bozza",
      "requires_user_approval": true
    }
  ],
  "can_auto_fix": true
}`
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

    console.log('✅ [ANALYZE-COMPARE] Comparison completed:', {
      is_valid: comparisonResult.is_valid,
      difference: comparisonResult.total_difference,
      corrections: comparisonResult.corrections_needed.length,
      creates_requiring_approval: comparisonResult.corrections_needed.filter((c: any) => c.action === 'create' && c.requires_user_approval).length
    });

    return NextResponse.json({
      success: true,
      parsed_invoice: parsedInvoice,
      comparison: comparisonResult
    });

  } catch (error: any) {
    console.error('❌ [ANALYZE-COMPARE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore analisi e confronto' },
      { status: 500 }
    );
  }
}
 
