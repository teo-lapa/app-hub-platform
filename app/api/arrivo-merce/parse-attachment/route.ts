import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large PDFs

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * PARSE ATTACHMENT FROM ODOO - VERSIONE SEMPLICE
 *
 * Scarica un allegato da Odoo e lo parsea con SOLO Gemini 2.5 Flash
 * (identico al test locale funzionante)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { attachment_id } = body;

    if (!attachment_id) {
      return NextResponse.json({
        error: 'attachment_id richiesto'
      }, { status: 400 });
    }

    console.log('📥 [PARSE-ATTACHMENT-SIMPLE] Scarico allegato ID:', attachment_id);
    console.log('🔐 Session UID:', uid);

    // Scarica allegato da Odoo
    const attachments = await callOdoo(cookies, 'ir.attachment', 'read', [
      [attachment_id],
      ['id', 'name', 'mimetype', 'datas', 'file_size']
    ]);

    if (attachments.length === 0) {
      return NextResponse.json({
        error: 'Allegato non trovato'
      }, { status: 404 });
    }

    const attachment = attachments[0];
    console.log('📄 Allegato:', attachment.name, `(${attachment.mimetype}, ${(attachment.file_size / 1024).toFixed(2)} KB)`);

    // Valida dimensione file
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (attachment.file_size > maxSize) {
      return NextResponse.json({
        error: `File troppo grande (${(attachment.file_size / 1024 / 1024).toFixed(2)} MB). Dimensione massima: 10 MB.`
      }, { status: 400 });
    }

    // Il campo 'datas' è già in base64
    const base64 = attachment.datas;

    if (!base64) {
      return NextResponse.json({
        error: 'Contenuto file non disponibile'
      }, { status: 400 });
    }

    console.log('📦 File scaricato, dimensione base64:', base64.length, 'chars');

    // Determina media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';

    if (attachment.mimetype === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (attachment.mimetype === 'image/jpeg' || attachment.mimetype === 'image/jpg') {
      mediaType = 'image/jpeg';
    } else if (attachment.mimetype === 'image/png') {
      mediaType = 'image/png';
    } else if (attachment.mimetype === 'image/gif') {
      mediaType = 'image/gif';
    } else if (attachment.mimetype === 'image/webp') {
      mediaType = 'image/webp';
    } else {
      return NextResponse.json({
        error: `Formato file non supportato: ${attachment.mimetype}. Usa PDF o immagini (JPG, PNG, GIF, WEBP)`
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
- Se è una FATTURA: cerca la tabella con prodotti, quantità, lotti, scadenze
- Se è una PACKING LIST: cerca la tabella con Nr., Descrizione, UM, Qty, Net Weight, Lot, Best before date

UNITÀ DI MISURA SUPPORTATE:
- CT = Cartoni
- KG = Chilogrammi
- PZ = Pezzi
- LT = Litri
- NR = Numero
- GR = Grammi

ESTRAZIONE QUANTITÀ:
1. Cerca colonna "Quantity" o "Qty" o "Piece Qty"
2. Cerca colonna "Net Weight" (peso netto in KG)
3. Usa il valore numerico che trovi
4. Se trovi sia Piece Qty che Net Weight, usa Net Weight per prodotti venduti a peso (KG)

ESEMPI:

Esempio FATTURA:
A0334SG | 25233 | ARAN DI RISO SUGO 25 g | CT | 18 | KG 5 | 29,51 | 25,0 10,0 | 358,55 | 12/02/27 | 69
→ quantity: 18, unit: "CT"

Esempio PACKING LIST:
A01498 | ASIAGO DOP FRESCO/MASO CARTONE | CT | 4,0 | 50,37 | L68S25T1 | 24/02/26
→ quantity: 50.37, unit: "KG" (usa Net Weight per formaggi)

A04359 | DELIZIA GR 150 PF | CT | 1,0 | 2,25 | 1.55E25 | 26/12/25
→ quantity: 2.25, unit: "KG"

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
    console.error('❌ Errore parsing allegato:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing dell\'allegato',
      debug: {
        error_type: error.constructor.name,
        error_message: error.message,
        error_stack: error.stack?.substring(0, 500)
      }
    }, { status: 500 });
  }
}
