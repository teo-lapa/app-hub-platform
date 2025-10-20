import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    }

    console.log('📄 File ricevuto:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';

    if (file.type === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      mediaType = 'image/jpeg';
    } else if (file.type === 'image/png') {
      mediaType = 'image/png';
    } else if (file.type === 'image/gif') {
      mediaType = 'image/gif';
    } else if (file.type === 'image/webp') {
      mediaType = 'image/webp';
    } else {
      return NextResponse.json({
        error: 'Formato file non supportato. Usa PDF o immagini (JPG, PNG, GIF, WEBP)'
      }, { status: 400 });
    }

    console.log('🤖 Invio a Claude per analisi...', 'Format:', mediaType);

    // Determine content type based on file format (PDF uses 'document', images use 'image')
    const isPDF = mediaType === 'application/pdf';
    const contentBlock: any = isPDF ? {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    } : {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    };

    // Call Claude API with vision/document
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `Analizza questa fattura/documento di trasporto e estrai TUTTE le informazioni con MASSIMA PRECISIONE.

IMPORTANTE:
- Estrai TUTTI i prodotti, anche se sono tanti
- Per ogni prodotto, estrai TUTTE le varianti (forma, colore, grammatura, ecc.)
- Sii ESTREMAMENTE preciso nei numeri e nelle quantità
- **FONDAMENTALE**: Cerca la PARTITA IVA del fornitore (P.IVA, VAT, Partita IVA, ecc.)

🚨 PRIORITÀ ASSOLUTA - QUANTITÀ CORRETTE:
**CERCA SEMPRE PRIMA IL PACKING LIST** per le quantità esatte!
- Se il documento contiene una pagina "PACKING LIST" (di solito pagina 2 o 3), USA QUELLA per le quantità!
- Nel PACKING LIST cerca la colonna "PESO NETTO" - QUELLE sono le quantità VERE!
- Nella fattura principale le quantità potrebbero essere peso lordo o arrotondate - IGNORA quelle se c'è il packing list
- **FORMATO NUMERI**: I numeri possono avere punti come separatori delle migliaia (es: "83.646" = 83646 KG, "22.502" = 22502 KG)
- Rimuovi i punti/virgole delle migliaia e converti correttamente (es: "83.646 KG" diventa quantity: 83.646)

ESEMPIO MONTEVECCHIO (con PACKING LIST):
Fattura dice: "PROSCIUTTO DI PARMA - Quantità: 10,000 KG"
PACKING LIST dice: "PROSCIUTTO DI PARMA - PESO NETTO: 83.646"
✅ USA: quantity: 83.646 (dal PACKING LIST "PESO NETTO")
❌ NON usare: 10.0 (dalla fattura)

ESEMPIO con più prodotti dal PACKING LIST pagina 3:
| DESCRIZIONE | PESO NETTO | TARA | PESO LORDO |
|-------------|------------|------|------------|
| PROSCIUTTO DI PARMA DOP CLASSICO S/O ADDOBBO PULITO A COLTELLO SV | 83.646 | 5 | |
| GRAN CULATTA PULITA A COLTELLO SV | 22.502 | | |
| FIOR DI FESA LAVATO E SCOTENNATO SV | 57.976 | | |

Output corretto:
[
  { "description": "PROSCIUTTO DI PARMA DOP CLASSICO S/O ADDOBBO PULITO A COLTELLO SV", "quantity": 83.646, "unit": "KG" },
  { "description": "GRAN CULATTA PULITA A COLTELLO SV", "quantity": 22.502, "unit": "KG" },
  { "description": "FIOR DI FESA LAVATO E SCOTENNATO SV", "quantity": 57.976, "unit": "KG" }
]

⚠️ ATTENZIONE AI LOTTI E SCADENZE (PRIORITÀ MASSIMA):
- Cerca le scritte "Lotto/Scadenza:" o "Lotto:" o numeri di lotto espliciti
- Cerca anche nella tabella del PACKING LIST la colonna "NOM. COMBINATA" per i lotti
- Nella fattura principale cerca "Cod. Lotto: XXXXXX"
- Il formato delle date potrebbe essere gg/mm/aaaa (es: 02/11/2025) - converti in YYYY-MM-DD
- **LOTTO - ORDINE DI PRIORITÀ**:
  1. Cerca prima un vero numero di lotto (es: "AQ25030", "CA2500103", "MY2500213", "197040/00", "LOTTO123")
  2. Se NON trovi un lotto esplicito MA c'è "NOMENCLATURA: XXXXXXXX" o "NOM. COMBINATA: XXXXXXXX", usa quel codice come lotto
  3. **SE NON trovi né lotto né nomenclatura MA c'è una scadenza, USA LA DATA DI SCADENZA come lot_number** (es: se scadenza è "2025-11-02", metti lot_number: "2025-11-02")
  4. Solo se non c'è né lotto né nomenclatura né scadenza, metti null per lot_number
- Possono esserci più righe dello stesso prodotto con lotti/scadenze diverse - crea prodotti separati!

ESEMPI DI PARSING CORRETTO:

Esempio 1 - Montevecchio con Cod. Lotto dalla fattura:
Testo fattura pagina 1: "PROSCIUTTO DI PARMA DOP CLASSICO S/O ADDOBBO PULITO A COLTELLO SV
Cod. Lotto: AQ25030
Quantità: 10,000 KG"
PACKING LIST pagina 3: "PESO NETTO: 83.646"
Output: {
  "article_code": "PAR026",
  "description": "PROSCIUTTO DI PARMA DOP CLASSICO S/O ADDOBBO PULITO A COLTELLO SV",
  "quantity": 83.646,  // ← Dal PACKING LIST!
  "unit": "KG",
  "lot_number": "AQ25030",  // ← Dalla fattura!
  "expiry_date": null,
  "variant": ""
}

Esempio 2 - Con nomenclatura:
Testo: "Julienne Taglio Napoli in vasc. da kg 2,5 - Monella
NOMENCLATURA: 04061030
Lotto/Scadenza: 02/11/2025"
Output: {
  "article_code": "VI2500JN1MN",
  "description": "Julienne Taglio Napoli in vasc. da kg 2,5 - Monella",
  "quantity": 330.0,
  "unit": "KG",
  "lot_number": "04061030",  // ← Usa NOMENCLATURA come lotto
  "expiry_date": "2025-11-02",
  "variant": ""
}

Esempio 3 - Solo scadenza (SENZA lotto):
Testo: "Parmigiano Reggiano DOP 24 mesi
Scadenza: 15/06/2026"
Output: {
  "article_code": "PARM24",
  "description": "Parmigiano Reggiano DOP 24 mesi",
  "quantity": 10.0,
  "unit": "KG",
  "lot_number": "2026-06-15",  // ← USA LA SCADENZA come lotto quando manca!
  "expiry_date": "2026-06-15",
  "variant": ""
}

Rispondi SOLO con un JSON valido in questo formato esatto:

{
  "supplier_name": "nome del fornitore",
  "supplier_vat": "partita IVA del fornitore (CERCA CON ATTENZIONE!)",
  "document_number": "numero documento",
  "document_date": "data documento in formato YYYY-MM-DD",
  "products": [
    {
      "article_code": "codice articolo se presente",
      "description": "descrizione completa del prodotto",
      "quantity": numero_quantità,
      "unit": "unità di misura (KG, PZ, ecc.)",
      "lot_number": "numero lotto (o NOMENCLATURA o DATA SCADENZA se lotto manca) oppure null",
      "expiry_date": "YYYY-MM-DD o null",
      "variant": "varianti del prodotto (es: Quadrato, Verde, 250gr)"
    }
  ]
}

NON aggiungere testo prima o dopo il JSON. SOLO il JSON valido.`,
            },
          ],
        },
      ],
    });

    // Extract JSON from response
    const firstContent = message.content[0];
    const responseText = firstContent && firstContent.type === 'text' ? firstContent.text : '';
    console.log('📥 Risposta Claude:', responseText.substring(0, 500) + '...');

    // Parse JSON response
    let parsedData;
    try {
      // Try to extract JSON if there's any text before/after
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('❌ Errore parsing JSON:', parseError);
      console.error('❌ Response text:', responseText);
      return NextResponse.json({
        error: 'Errore nel parsing della risposta AI',
        details: responseText
      }, { status: 500 });
    }

    console.log('✅ Dati estratti:', {
      supplier: parsedData.supplier_name,
      products: parsedData.products?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: parsedData,
      tokens_used: message.usage
    });

  } catch (error: any) {
    console.error('❌ Errore parse-invoice:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing della fattura',
      details: error.toString()
    }, { status: 500 });
  }
}
