import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    // Determine MIME type for Gemini
    let mimeType = file.type;
    if (!mimeType) {
      // Fallback based on file extension
      if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (file.name.endsWith('.png')) mimeType = 'image/png';
      else if (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (file.name.endsWith('.webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg'; // default
    }

    console.log('📄 Parsing invoice with Gemini AI...');
    console.log('📎 File type:', mimeType, '| Size:', (file.size / 1024).toFixed(2), 'KB');

    // Use Gemini Pro Vision for document parsing with vision capabilities
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `Analizza questa fattura e estrai TUTTI i prodotti presenti.

Per ogni prodotto, estrai:
- nome: il nome completo del prodotto
- codice: codice prodotto/SKU/EAN se presente
- quantita: quantità ordinata (numero)
- prezzo_unitario: prezzo unitario di acquisto (numero decimale)
- prezzo_totale: prezzo totale della riga (numero decimale)
- unita_misura: unità di misura (es: PZ, KG, LT, CF, etc)
- note: eventuali note o specifiche del prodotto

IMPORTANTE:
- Estrai TUTTI i prodotti dalla fattura, anche se sono molti
- Se un campo non è presente, usa null
- Per i numeri, usa il formato decimale (es: 10.50 non "10,50")
- Rispondi SOLO con un JSON valido nel seguente formato:

{
  "fornitore": "nome fornitore dalla fattura",
  "numero_fattura": "numero fattura",
  "data_fattura": "data fattura in formato YYYY-MM-DD",
  "prodotti": [
    {
      "nome": "...",
      "codice": "..." o null,
      "quantita": 0,
      "prezzo_unitario": 0.00,
      "prezzo_totale": 0.00,
      "unita_misura": "..." o null,
      "note": "..." o null
    }
  ]
}

NON aggiungere testo prima o dopo il JSON. SOLO il JSON.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64,
        },
      },
    ]);

    const response = await result.response;
    const responseText = response.text();

    console.log('📝 Gemini response:', responseText.substring(0, 500) + '...');

    // Parse JSON from response (handle markdown code blocks)
    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      jsonMatch = responseText.match(/```\n([\s\S]*?)\n```/);
    }

    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
    const parsedData = JSON.parse(jsonStr.trim());

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
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il parsing della fattura'
      },
      { status: 500 }
    );
  }
}
