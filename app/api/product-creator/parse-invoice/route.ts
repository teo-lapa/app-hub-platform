import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('invoice') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nessun file caricato' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Determine media type
    const mediaType = file.type.includes('pdf')
      ? 'application/pdf'
      : file.type.includes('image')
        ? (file.type as any)
        : 'image/jpeg';

    console.log('📄 Parsing invoice with Claude Vision...');

    // Use Claude Vision to extract products from invoice
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analizza questa fattura e estrai TUTTI i prodotti presenti.

Per ogni prodotto, estrai:
- nome: il nome completo del prodotto
- codice: codice prodotto/SKU/EAN se presente
- quantita: quantità ordinata
- prezzo_unitario: prezzo unitario di acquisto
- prezzo_totale: prezzo totale della riga
- unita_misura: unità di misura (es: PZ, KG, LT)
- note: eventuali note o specifiche del prodotto

IMPORTANTE:
- Estrai TUTTI i prodotti dalla fattura, anche se sono molti
- Se un campo non è presente, usa null
- Rispondi SOLO con un JSON valido nel formato:

{
  "fornitore": "nome fornitore dalla fattura",
  "numero_fattura": "numero fattura",
  "data_fattura": "data fattura in formato YYYY-MM-DD",
  "prodotti": [
    {
      "nome": "...",
      "codice": "...",
      "quantita": 0,
      "prezzo_unitario": 0,
      "prezzo_totale": 0,
      "unita_misura": "...",
      "note": "..."
    }
  ]
}`,
            },
          ],
        },
      ],
    });

    // Extract JSON from response
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    console.log('📝 Claude response:', responseText);

    // Parse JSON from response (handle markdown code blocks)
    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      jsonMatch = responseText.match(/```\n([\s\S]*?)\n```/);
    }

    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
    const parsedData = JSON.parse(jsonStr.trim());

    console.log('✅ Successfully parsed invoice with', parsedData.prodotti?.length || 0, 'products');

    return NextResponse.json({
      success: true,
      data: parsedData,
    });

  } catch (error: any) {
    console.error('❌ Error parsing invoice:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il parsing della fattura'
      },
      { status: 500 }
    );
  }
}
