import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large PDFs

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper function to validate file size
function validateFileSize(size: number): { valid: boolean; message?: string } {
  const maxSize = 10 * 1024 * 1024; // 10 MB
  const warningSize = 5 * 1024 * 1024; // 5 MB

  if (size > maxSize) {
    return {
      valid: false,
      message: `File troppo grande (${(size / 1024 / 1024).toFixed(2)} MB). Dimensione massima: 10 MB.`
    };
  }

  if (size > warningSize) {
    console.warn(`⚠️ File grande (${(size / 1024 / 1024).toFixed(2)} MB) - il parsing potrebbe richiedere più tempo`);
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    }

    console.log('📄 File ricevuto:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file size
    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      return NextResponse.json({ error: sizeValidation.message }, { status: 400 });
    }

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

    console.log('🤖 Chiamata Gemini 2.5 Flash (SEMPLICE - come test locale)...');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `Estrai i dati dalla fattura o packing list.

IMPORTANTE: Questo documento può essere una FATTURA o una PACKING LIST.

🔴 PRIORITÀ DATI:
- Se è una FATTURA: usa quantità dalla colonna "Qty" o "QUANTITA'" (unità di vendita: CT, PZ, etc.)
- Se è un PACKING LIST SOLO: usa "Net Weight" (KG) solo se non c'è colonna Qty
- Le quantità della FATTURA hanno SEMPRE priorità sulle Net Weight del packing list

UNITÀ DI MISURA SUPPORTATE:
- CT = Cartoni (unità di vendita principale)
- KG = Chilogrammi
- PZ = Pezzi
- LT = Litri
- NR = Numero
- GR = Grammi

STRUTTURA FATTURA:
La tabella prodotti ha queste colonne IN ORDINE (da sinistra a destra):
ARTICOLO | LOTTO | DESCRIZIONE | UM | QUANTITA' | QTA' x CARTONE | PREZZO UNITARIO | % SCONTI | IMPORTO | DT. SCAD. | IVA

ATTENZIONE COLONNA QUANTITA':
- Colonna QUANTITA': contiene SOLO NUMERI (es: 18, 54, 8, 5, 1, 2) ← USA QUESTA!
- Colonna QTA' x CARTONE: contiene TESTO (es: KG 5, PZ 50, CT 30) ← NON questa
- Colonna UM: unità di misura (CT, PZ, KG)

Esempio riga FATTURA:
A0334SG | 25233 | ARAN DI RISO SUGO 25 g | CT | 18 | KG 5 | 29,51 | 25,0 10,0 | 358,55 | 12/02/27 | 69
→ ✅ CORRETTO: quantity: 18, unit: "CT"
→ ❌ SBAGLIATO: quantity: 5, unit: "KG"

Esempio PACKING LIST:
A01498 | ASIAGO DOP | Net Weight: 50,37 KG | Lotto: L68S25T1
→ quantity: 50.37, unit: "KG" (solo se NON c'è fattura)

Output JSON:
{
  "supplier_name": "nome fornitore",
  "document_number": "numero",
  "document_date": "YYYY-MM-DD",
  "products": [
    {
      "article_code": "A0334SG",
      "description": "ARAN DI RISO SUGO 25 g",
      "quantity": 18,
      "unit": "CT",
      "lot_number": "25233",
      "expiry_date": "2027-02-12"
    }
  ]
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mediaType,
          data: base64
        }
      },
      prompt
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const json = JSON.parse(cleaned);

    console.log(`✅ Gemini: completato - ${json.products?.length || 0} prodotti estratti`);

    return NextResponse.json({
      success: true,
      data: json
    });

  } catch (error: any) {
    console.error('❌ Errore parsing:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing del documento'
    }, { status: 500 });
  }
}
