import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for multiple large PDFs

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * PARSE MULTIPLE ATTACHMENTS FROM ODOO
 *
 * Scarica più allegati da Odoo e li parsea insieme con Gemini 2.5 Flash
 * Gemini riceve tutti i PDF/immagini e li processa come un'unica fattura/packing list
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { attachment_ids } = body;

    if (!attachment_ids || !Array.isArray(attachment_ids) || attachment_ids.length === 0) {
      return NextResponse.json({
        error: 'attachment_ids richiesto (array di IDs)'
      }, { status: 400 });
    }

    console.log('📥 [PARSE-MULTIPLE-ATTACHMENTS] Scarico', attachment_ids.length, 'allegati');
    console.log('🔐 Session UID:', uid);

    // Scarica tutti gli allegati da Odoo
    const attachments = await callOdoo(cookies, 'ir.attachment', 'read', [
      attachment_ids,
      ['id', 'name', 'mimetype', 'datas', 'file_size']
    ]);

    if (attachments.length === 0) {
      return NextResponse.json({
        error: 'Nessun allegato trovato'
      }, { status: 404 });
    }

    console.log('📄 Allegati scaricati:', attachments.map((a: any) =>
      `${a.name} (${a.mimetype}, ${(a.file_size / 1024).toFixed(2)} KB)`
    ));

    // Valida dimensione totale
    const totalSize = attachments.reduce((sum: number, a: any) => sum + a.file_size, 0);
    const maxSize = 20 * 1024 * 1024; // 20 MB totale

    if (totalSize > maxSize) {
      return NextResponse.json({
        error: `File troppo grandi (${(totalSize / 1024 / 1024).toFixed(2)} MB totale). Dimensione massima: 20 MB.`
      }, { status: 400 });
    }

    // Prepara array di parti per Gemini (alternanza PDF/immagini + prompt)
    const parts: any[] = [];

    for (const attachment of attachments) {
      const base64 = attachment.datas;

      if (!base64) {
        console.warn(`⚠️ Allegato ${attachment.name} senza contenuto, skip`);
        continue;
      }

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
        console.warn(`⚠️ Formato non supportato: ${attachment.mimetype}, skip`);
        continue;
      }

      // Aggiungi documento all'array
      parts.push({
        inlineData: {
          mimeType: mediaType,
          data: base64
        }
      });

      console.log(`📦 Aggiunto ${attachment.name} (${mediaType})`);
    }

    if (parts.length === 0) {
      return NextResponse.json({
        error: 'Nessun allegato valido da processare'
      }, { status: 400 });
    }

    console.log(`🤖 Chiamata Gemini 2.5 Flash con ${parts.length} documenti...`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `Estrai i dati dalla fattura o packing list.

IMPORTANTE: Ti ho inviato ${parts.length} documento/i. Analizzali TUTTI insieme.

🔴 PRIORITÀ DATI (FONDAMENTALE):
1. **QUANTITÀ e DESCRIZIONE**: Prendi SEMPRE dalla FATTURA (documento principale con prezzi)
2. **LOTTO e SCADENZA**: Se NON presenti nella FATTURA, cercali nel Packing List

REGOLE:
- Se vedi una FATTURA + Packing List: usa quantità/descrizione dalla FATTURA
- Se il Packing List ha lotti/scadenze che mancano nella FATTURA, integra solo quelli
- NON sostituire le quantità della fattura con quelle del packing list
- Le quantità del packing list (Net Weight KG) sono solo di trasporto, NON di vendita

UNITÀ DI MISURA SUPPORTATE:
- CT = Cartoni (unità di vendita principale)
- KG = Chilogrammi
- PZ = Pezzi
- LT = Litri
- NR = Numero
- GR = Grammi

ESTRAZIONE QUANTITÀ:
1. PRIORITÀ ASSOLUTA: Colonna "Quantity" o "Qty" dalla FATTURA
2. Se è l'unico documento e hai solo Packing List: usa "Net Weight" (KG)
3. NON mescolare quantità fattura con pesi packing list

ESEMPI:

Esempio 1 - SOLO FATTURA:
FATTURA: A0334SG | ARAN DI RISO | Qty: 18 CT | Lotto: 25233 | Scad: 12/02/27
→ quantity: 18, unit: "CT", lot: "25233", expiry: "2027-02-12"

Esempio 2 - SOLO PACKING LIST:
PACKING LIST: A01498 | ASIAGO DOP | Qty: 4 CT | Net Weight: 50,37 KG | Lotto: L68S25T1
→ quantity: 50.37, unit: "KG", lot: "L68S25T1"
(Se è l'unico documento, usa Net Weight)

Esempio 3 - FATTURA + PACKING LIST (CASO CRITICO):
FATTURA: A01498 | ASIAGO DOP FRESCO | Qty: 4 CT | Prezzo: €120
PACKING LIST: A01498 | ASIAGO DOP | Net Weight: 50,37 KG | Lotto: L68S25T1 | Scad: 24/02/26
→ ✅ CORRETTO: quantity: 4, unit: "CT", lot: "L68S25T1", expiry: "2026-02-24"
   (Quantità dalla FATTURA, lotto/scadenza dal Packing List)
→ ❌ SBAGLIATO: quantity: 50.37, unit: "KG"
   (NON usare i KG del packing list se c'è la fattura!)

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

    // Aggiungi il prompt alla fine
    parts.push(prompt);

    const result = await model.generateContent(parts);

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const json = JSON.parse(cleaned);

    console.log(`✅ Gemini: completato - ${json.products?.length || 0} prodotti estratti da ${parts.length - 1} documenti`);

    return NextResponse.json({
      success: true,
      data: json,
      debug: {
        documents_processed: parts.length - 1,
        total_products: json.products?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ Errore parsing multiplo:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing degli allegati',
      debug: {
        error_type: error.constructor.name,
        error_message: error.message,
        error_stack: error.stack?.substring(0, 500)
      }
    }, { status: 500 });
  }
}
