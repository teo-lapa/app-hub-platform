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

🔴 PRIORITÀ DATI:
- Se è una FATTURA: usa quantità dalla colonna "Qty" o "Quantity" (unità di vendita: CT, PZ, etc.)
- Se è un PACKING LIST SOLO: usa "Net Weight" (KG) solo se non c'è colonna Qty
- Le quantità della FATTURA hanno SEMPRE priorità sulle Net Weight del packing list

UNITÀ DI MISURA SUPPORTATE:
- CT = Cartoni (unità di vendita principale)
- KG = Chilogrammi
- PZ = Pezzi
- LT = Litri
- NR = Numero
- GR = Grammi

ESTRAZIONE QUANTITÀ (FONDAMENTALE):
1. PRIORITÀ ASSOLUTA: Colonna "Quantità KG" o "Quantity" o "Qty" dalla FATTURA
2. Se vedi colonne "Quantità KG" + "Um2" (PZ): USA SEMPRE I KG, MAI I PZ
3. La colonna "Um2" o "Quantità PZ" contiene i colli/cartoni di trasporto, NON la quantità venduta
4. ALTERNATIVA: Se NON c'è Qty e hai solo Packing List, usa "Net Weight" (es: 50.37 KG)
5. NON mescolare: se vedi Qty in CT, NON sostituirla con Net Weight in KG

ESEMPIO CRITICO - Fattura con doppia unità di misura:
FATTURA: VI2500JN1MN | Julienne Taglio Napoli | Quantità KG: 250,000 | Um2: 100,000 PZ
→ ✅ CORRETTO: quantity: 250, unit: "KG"
→ ❌ SBAGLIATO: quantity: 100, unit: "PZ" (questa è solo il numero di colli!)

ESEMPI:

Esempio 1 - FATTURA (con Qty):
A0334SG | ARAN DI RISO | Qty: 18 CT | Lotto: 25233 | Scad: 12/02/27
→ quantity: 18, unit: "CT", lot: "25233", expiry: "2027-02-12"

Esempio 2 - PACKING LIST (solo Net Weight):
A01498 | ASIAGO DOP | Net Weight: 50,37 KG | Lotto: L68S25T1 | Scad: 24/02/26
→ quantity: 50.37, unit: "KG", lot: "L68S25T1", expiry: "2026-02-24"

Esempio 3 - FATTURA CON DOPPIA UNITÀ (CASO TAMBURRO):
FATTURA: VI2500JN1MN | Julienne "Taglio Napoli" | Quantità KG: 250,000 | € al Pezzo: 15,2500 | Um2: 100,000 PZ
→ ✅ CORRETTO: quantity: 250, unit: "KG"
   (Usa sempre i KG dalla colonna "Quantità KG", ignora la colonna Um2 con i pezzi)
→ ❌ SBAGLIATO: quantity: 100, unit: "PZ"
   (NON usare Um2! I PZ sono solo colli di trasporto)

Esempio 4 - FATTURA con Qty e Net Weight (CASO CRITICO):
A01498 | ASIAGO DOP | Qty: 4 CT | Net Weight: 50,37 KG
→ ✅ CORRETTO: quantity: 4, unit: "CT"
→ ❌ SBAGLIATO: quantity: 50.37, unit: "KG"

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
