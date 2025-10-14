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

    console.log('🤖 Invio a Claude per analisi...');

    // Call Claude API with vision
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analizza questa fattura/documento di trasporto e estrai TUTTE le informazioni con MASSIMA PRECISIONE.

IMPORTANTE:
- Estrai TUTTI i prodotti, anche se sono tanti
- Per ogni prodotto, estrai TUTTE le varianti (forma, colore, grammatura, ecc.)
- Cerca i lotti e le date di scadenza se presenti
- Sii ESTREMAMENTE preciso nei numeri e nelle quantità
- **FONDAMENTALE**: Cerca la PARTITA IVA del fornitore (P.IVA, VAT, Partita IVA, ecc.)

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
      "lot_number": "numero lotto se presente",
      "expiry_date": "data scadenza in formato YYYY-MM-DD se presente",
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
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
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
