import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
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
   b) Codice articolo (es: "AZCOM051", "P09956")
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
    }

    // STEP 2: Confronto Intelligente con Claude
    console.log('🧠 [ANALYZE-COMPARE] Step 2: Smart comparison...');

    const comparisonMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `Sei un esperto contabile. Confronta FATTURA DEFINITIVA vs FATTURA BOZZA e trova TUTTE le differenze.

📄 FATTURA DEFINITIVA (PDF del fornitore):
${JSON.stringify(parsedInvoice, null, 2)}

📋 FATTURA BOZZA ODOO:
Nome: ${draft_invoice.name}
Fornitore: ${draft_invoice.partner_id[1]}
Data: ${draft_invoice.invoice_date || 'N/A'}
Imponibile: €${draft_invoice.amount_untaxed}
IVA: €${draft_invoice.amount_tax}
TOTALE: €${draft_invoice.amount_total}

RIGHE BOZZA:
${JSON.stringify(enrichedLines.map((line: any) => ({
  id: line.id,
  product: line.product_id ? line.product_id[1] : 'N/A',
  supplier_code: line.default_code || null,
  description: line.name,
  quantity: line.quantity,
  unit_price: line.price_unit,
  subtotal: line.price_subtotal,
  total: line.price_total
})), null, 2)}

🎯 METODO DI CONFRONTO:

⚠️ **SEI UN CONTABILE, NON UN MAGAZZINIERE!**

🔄 STEP 0 - AGGREGAZIONE CONTABILE (CRITICO!):
**PRIMA** di fare qualsiasi matching, AGGREGA le righe PDF con STESSO product_code:

**REGOLA FONDAMENTALE:**
Se nel PDF ci sono 2+ righe con STESSO product_code ma lotti diversi:
→ **SOMMA LE QUANTITÀ** e **SOMMA I SUBTOTAL**
→ Considera come **UNA SOLA RIGA** per il confronto contabile
→ **IGNORA completamente i lotti** (non siamo in magazzino!)

**ESEMPIO REALE:**
PDF fattura fornitore:
```
009014 CARCIOFI LOTTO LR248 qty=30 subtotal=276.00
009014 CARCIOFI LOTTO LR248 qty=6  subtotal=55.20
```
AGGREGAZIONE CONTABILE:
```
009014 CARCIOFI qty=36 (30+6) subtotal=331.20 (276+55.20)
```
Bozza Odoo:
```
009014 CARCIOFI qty=36 subtotal=331.20
```
**RISULTATO:** MATCH PERFETTO! ✅ Nessuna correzione necessaria!

**ALTRO ESEMPIO:**
PDF:
```
001507 POMODORI LOTTO A qty=24 subtotal=165.60
001507 POMODORI LOTTO B qty=18 subtotal=124.20
```
DOPO AGGREGAZIONE:
```
001507 POMODORI qty=42 (24+18) subtotal=289.80 (165.60+124.20)
```
Se Bozza ha: `001507 POMODORI qty=42 subtotal=289.80` → MATCH! ✅

**IMPORTANTE:**
- Aggregazione si fa SOLO su righe con STESSO product_code
- Se product_code diverso → righe separate
- Se product_code null → usa description per aggregare
- Alla fine del processo, confronta TOTALI AGGREGATI vs BOZZA

STEP 1 - MATCHING INTELLIGENTE (su righe AGGREGATE):
Per ogni riga PDF, trova la riga Bozza corrispondente:
a) PRIORITÀ 1: Matcha product_code PDF con supplier_code Bozza (es: "009014" → "009014")
b) PRIORITÀ 2: Se supplier_code non matcha, usa SOMIGLIANZA SEMANTICA:
   - "MORTADELLA C/P 3.5KG" = "Mortadella 3,5kg" = "[MORT35] Mortadella"
   - "P.COTTO BLU COATI" = "Prosciutto Cotto Blu"
   - "SALAME VENTRICINA" = "Ventricina" = "Salame Vent."
c) Se stesso prodotto → confronta SUBTOTAL (totale riga)
d) Se SUBTOTAL diverso → confronta prezzo e quantità

STEP 2 - VERIFICA MATEMATICA DEL SUBTOTAL:
Per ogni match trovato, verifica:
- SUBTOTAL_PDF = quantity_pdf × unit_price_pdf
- SUBTOTAL_BOZZA = quantity_bozza × unit_price_bozza
- Se SUBTOTAL_PDF ≠ SUBTOTAL_BOZZA → trova cosa correggere

⚠️ UNITÀ DI MISURA DIVERSE - PROBLEMA CRITICO:
Molti fornitori vendono in KG, ma nel sistema registriamo in PZ (pezzi/vaschette).
ESEMPI REALI:
- Fornitore: "Mortadella 3.5kg" q.tà 9.97kg → 9.97kg effettivi
- Sistema: "[MORT35] Mortadella" 3 PZ → registrato come 3 pezzi da 3.5kg
- SOLUZIONE: Controlla SUBTOTAL! Se subtotal PDF = subtotal BOZZA → OK!
  Se diverso → correggi quantity e/o price_unit

STEP 3 - GENERA CORREZIONI:
Per ogni differenza trovata:

A) PREZZO DIVERSO + QUANTITÀ OK:
   → action: "update", changes: {"price_unit": prezzo_da_pdf}

B) QUANTITÀ DIVERSA + PREZZO OK:
   → action: "update", changes: {"quantity": quantità_da_pdf}

C) PREZZO E QUANTITÀ DIVERSI:
   → action: "update", changes: {"price_unit": prezzo_pdf, "quantity": quantità_pdf}

D) PRODOTTO MANCANTE IN BOZZA:
   → action: "create", requires_user_approval: true, parsed_line: {...dati_da_pdf}

E) PRODOTTO EXTRA IN BOZZA (non in PDF):
   → action: "delete", requires_user_approval: false

🎯 OBIETTIVO FINALE:
Dopo le correzioni, il totale bozza DEVE essere = totale PDF ± €0.02

ESEMPIO CONCRETO:
PDF: "MORTADELLA C/P 3.5KG" q.tà=9.97 prezzo=4.70 subtotal=46.86
BOZZA: "Mortadella" id=123 q.tà=3 prezzo=4.70 subtotal=14.10
ANALISI:
- Stesso prodotto (matching OK)
- Prezzo OK (4.70 = 4.70)
- Subtotal DIVERSO (46.86 ≠ 14.10)
- Differenza causata da quantità (9.97 ≠ 3)
CORREZIONE:
{"action": "update", "line_id": 123, "changes": {"quantity": 9.97}, "reason": "Quantità reale: 9.97kg (non 3 pezzi)"}

⚠️ IMPORTANTE:
- NON correggere descrizioni
- FOCUS ASSOLUTO: far tornare i NUMERI (prezzo × quantità = subtotal)
- Se subtotal bozza = subtotal PDF → NON correggere anche se quantità/prezzo diversi!

🔢 GESTIONE ARROTONDAMENTI E CENTESIMI:
Se tutte le righe sono corrette MA il totale finale ha differenza > €0.02:
1. NON modificare le righe esistenti!
2. Crea una NUOVA riga di aggiustamento visibile:
   - action: "create"
   - name: "Aggiustamento arrotondamento"
   - quantity: 1
   - price_unit: [differenza] (può essere negativo se bozza > PDF, positivo se bozza < PDF)
   - account_id: usa lo stesso account_id della prima riga prodotto
3. Aggiungi reason: "Riga di aggiustamento arrotondamento: differenza €X tra PDF e totale calcolato"
4. requires_user_approval: false (correzione automatica per arrotondamenti)

ESEMPIO ARROTONDAMENTO:
Tutte le righe OK individualmente, ma somma totale:
- Bozza: €2056.24
- PDF: €2056.17
- Differenza: -€0.07 (bozza ha €0.07 in più, serve aggiustamento NEGATIVO)
SOLUZIONE:
{
  "action": "create",
  "new_line": {
    "name": "Aggiustamento arrotondamento",
    "quantity": 1,
    "price_unit": -0.07,
    "account_id": [copia account_id dalla prima riga prodotto della bozza]
  },
  "reason": "Riga di aggiustamento arrotondamento: differenza -€0.07 tra PDF (€2056.17) e bozza (€2056.24)",
  "requires_user_approval": false
}

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

    // 🔍 DEBUG: Log tutte le correzioni in dettaglio per diagnostica
    console.log('🔍 [ANALYZE-COMPARE] Detailed corrections:');
    comparisonResult.corrections_needed.forEach((correction: any, index: number) => {
      console.log(`  ${index + 1}. ${correction.action} line ${correction.line_id || 'N/A'}:`, JSON.stringify(correction.changes || correction.new_line));
      console.log(`     Reason: ${correction.reason}`);
    });

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
 
