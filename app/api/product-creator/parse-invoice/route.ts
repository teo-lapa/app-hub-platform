import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Parse invoice API called');

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not found in environment');
      return NextResponse.json(
        { success: false, error: 'Configurazione API non valida' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('invoice') as File;

    if (!file) {
      console.log('❌ No file uploaded');
      return NextResponse.json(
        { success: false, error: 'Nessun file caricato' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Determine media type - Claude supports PDF and images
    let mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'application/pdf';

    if (file.type === 'image/png') {
      mediaType = 'image/png';
    } else if (file.type === 'image/gif') {
      mediaType = 'image/gif';
    } else if (file.type === 'image/webp') {
      mediaType = 'image/webp';
    } else if (file.type.includes('image') || file.type.includes('jpeg') || file.type.includes('jpg')) {
      mediaType = 'image/jpeg';
    }

    console.log('📄 Parsing invoice with Claude Vision...');
    console.log('📎 File type:', mediaType, '| Size:', (file.size / 1024).toFixed(2), 'KB');

    // Use Claude Sonnet with PDF support
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192, // Aumentato per fatture con molti prodotti
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType as any,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analizza questa fattura e estrai TUTTI i prodotti presenti.

Per ogni prodotto, estrai:
- nome: il nome completo del prodotto
- codice: codice prodotto/SKU/EAN se presente
- quantita: quantità ordinata (numero)
- prezzo_unitario: prezzo unitario di acquisto (numero decimale)
- prezzo_totale: prezzo totale della riga (numero decimale)
- unita_misura: unità di misura (es: PZ, KG, LT, CF, etc)
- note: eventuali note o specifiche del prodotto

REGOLE CRITICHE PER IL JSON:
1. Rispondi SOLO con un JSON valido, senza testo prima o dopo
2. NON mettere virgole dopo l'ultimo elemento di array o oggetto
3. Se un campo non è presente, usa null (senza virgolette)
4. Per i numeri decimali usa il punto, non la virgola (es: 10.50 non "10,50")
5. Estrai TUTTI i prodotti, anche se sono molti
6. Assicurati che OGNI oggetto nell'array prodotti sia separato da virgola
7. NON inserire commenti nel JSON

Formato JSON richiesto:
{
  "fornitore": "nome fornitore dalla fattura",
  "numero_fattura": "numero fattura",
  "data_fattura": "data fattura in formato YYYY-MM-DD",
  "prodotti": [
    {
      "nome": "...",
      "codice": null,
      "quantita": 0,
      "prezzo_unitario": 0.00,
      "prezzo_totale": 0.00,
      "unita_misura": null,
      "note": null
    }
  ]
}`,
            },
          ],
        },
      ],
    });

    // Extract JSON from response
    const firstContent = message.content[0];
    const responseText = firstContent && firstContent.type === 'text'
      ? firstContent.text
      : '';

    console.log('📝 Claude response:', responseText.substring(0, 500) + '...');

    // Parse JSON from response (handle markdown code blocks)
    // Prova vari pattern per estrarre il JSON dai code block markdown
    let jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
    }

    // Se non trova backtick, cerca direttamente { } (JSON puro)
    if (!jsonMatch && responseText.includes('{')) {
      const startIdx = responseText.indexOf('{');
      const endIdx = responseText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonMatch = [responseText, responseText.substring(startIdx, endIdx + 1)];
      }
    }

    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr.trim());
    } catch (parseError: any) {
      console.error('❌ Errore parsing JSON da Claude:', parseError.message);
      console.error('❌ JSON string (primi 1000 char):', jsonStr.substring(0, 1000));
      console.error('❌ JSON string (ultimi 500 char):', jsonStr.substring(jsonStr.length - 500));

      // Prova a riparare JSON comune: rimuovi trailing comma
      try {
        const fixedJson = jsonStr
          .replace(/,\s*([\]}])/g, '$1') // Rimuovi virgole prima di ] o }
          .replace(/}\s*{/g, '},{') // Aggiungi virgola tra oggetti
          .replace(/\]\s*\[/g, '],['); // Aggiungi virgola tra array

        console.log('🔧 Tentativo di riparazione JSON...');
        parsedData = JSON.parse(fixedJson.trim());
        console.log('✅ JSON riparato con successo!');
      } catch (fixError) {
        throw new Error(`Risposta AI non valida: ${parseError.message}. La risposta di Claude non è un JSON valido.`);
      }
    }

    // Validate and clean data
    if (!parsedData.prodotti || !Array.isArray(parsedData.prodotti)) {
      throw new Error('Formato risposta non valido: manca array prodotti');
    }

    // Clean and validate product data
    parsedData.prodotti = parsedData.prodotti.map((p: any) => ({
      nome: p.nome || 'Prodotto senza nome',
      codice: p.codice || null,
      quantita: parseFloat(p.quantita) || 0,
      prezzo_unitario: parseFloat(p.prezzo_unitario) || 0,
      prezzo_totale: parseFloat(p.prezzo_totale) || 0,
      unita_misura: p.unita_misura || 'PZ',
      note: p.note || null,
    }));

    console.log('✅ Successfully parsed invoice with', parsedData.prodotti.length, 'products');

    return NextResponse.json({
      success: true,
      data: parsedData,
    });

  } catch (error: any) {
    console.error('❌ Error parsing invoice:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il parsing della fattura',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
