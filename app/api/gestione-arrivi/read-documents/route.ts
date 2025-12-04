import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import Anthropic from '@anthropic-ai/sdk';
import { loadSkill } from '@/lib/ai/skills-loader';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti per documenti multipli

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// MIME types supportati
const SUPPORTED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

interface ExtractedLine {
  description: string;
  product_code?: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  subtotal?: number;
  tax_rate?: number;
  lot_number?: string;
  expiry_date?: string;
  discount?: number;
}

interface ExtractedDocument {
  attachment_id: number;
  filename: string;
  document_type: 'invoice' | 'ddt' | 'order' | 'other';
  supplier: {
    name: string;
    vat?: string;
  };
  document_info: {
    number: string;
    date: string;
    total?: number;
    subtotal?: number;
    tax?: number;
  };
  lines: ExtractedLine[];
  raw_response?: string;
}

/**
 * READ DOCUMENTS
 *
 * Legge TUTTI gli allegati di un picking usando Claude Vision
 * Estrae dati strutturati da PDF e immagini
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, attachment_ids } = body;

    if (!picking_id && !attachment_ids) {
      return NextResponse.json({
        error: 'Fornire picking_id o attachment_ids'
      }, { status: 400 });
    }

    console.log(`📖 [READ-DOCS] Inizio lettura documenti...`);

    // Recupera allegati
    let attachments: any[] = [];

    if (attachment_ids && attachment_ids.length > 0) {
      // Allegati specifici
      attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
        [['id', 'in', attachment_ids]],
        ['id', 'name', 'mimetype', 'datas', 'file_size']
      ]);
    } else if (picking_id) {
      // Recupera picking e poi allegati dal P.O.
      const pickings = await callOdoo(cookies, 'stock.picking', 'read', [
        [picking_id],
        ['origin']
      ]);

      if (!pickings || pickings.length === 0) {
        throw new Error('Picking non trovato');
      }

      const origin = pickings[0].origin;
      if (!origin) {
        throw new Error('Picking senza Purchase Order collegato');
      }

      // Trova il P.O.
      const pos = await callOdoo(cookies, 'purchase.order', 'search_read', [
        [['name', '=', origin]],
        ['id', 'name']
      ]);

      if (!pos || pos.length === 0) {
        throw new Error(`Purchase Order ${origin} non trovato`);
      }

      // Recupera allegati del P.O.
      attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
        [
          ['res_model', '=', 'purchase.order'],
          ['res_id', '=', pos[0].id],
          ['mimetype', 'in', SUPPORTED_MIMETYPES]
        ],
        ['id', 'name', 'mimetype', 'datas', 'file_size']
      ]);
    }

    if (attachments.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun allegato trovato'
      }, { status: 404 });
    }

    console.log(`📎 Trovati ${attachments.length} allegati da processare`);

    // Carica la skill di parsing
    let parsingSkill;
    try {
      parsingSkill = loadSkill('document-processing/invoice-parsing');
      console.log(`✅ Skill caricata: ${parsingSkill.metadata.name} v${parsingSkill.metadata.version}`);
    } catch (e) {
      console.warn('⚠️ Skill non trovata, uso prompt generico');
    }

    // Processa ogni allegato
    const extractedDocuments: ExtractedDocument[] = [];
    const errors: string[] = [];

    for (const attachment of attachments) {
      console.log(`📄 Processing: ${attachment.name} (${attachment.mimetype})`);

      try {
        const extracted = await processDocument(
          attachment,
          parsingSkill?.content
        );
        extractedDocuments.push(extracted);
        console.log(`✅ ${attachment.name}: ${extracted.lines.length} righe estratte`);
      } catch (error: any) {
        console.error(`❌ Errore ${attachment.name}:`, error.message);
        errors.push(`${attachment.name}: ${error.message}`);
      }
    }

    // Combina i risultati
    const combinedResult = combineDocuments(extractedDocuments);
    const processingTime = Date.now() - startTime;

    console.log(`✅ [READ-DOCS] Completato in ${processingTime}ms`);
    console.log(`📊 Totale: ${combinedResult.combined_lines.length} righe da ${extractedDocuments.length} documenti`);

    return NextResponse.json({
      success: true,
      documents: extractedDocuments,
      combined_lines: combinedResult.combined_lines,
      supplier: combinedResult.supplier,
      invoice_info: combinedResult.invoice_info,
      errors: errors.length > 0 ? errors : undefined,
      processing_time_ms: processingTime
    });

  } catch (error: any) {
    console.error('❌ [READ-DOCS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la lettura dei documenti'
    }, { status: 500 });
  }
}

/**
 * Processa un singolo documento con Claude Vision
 */
async function processDocument(
  attachment: any,
  skillPrompt?: string
): Promise<ExtractedDocument> {
  const { id, name, mimetype, datas } = attachment;

  if (!datas) {
    throw new Error('Contenuto allegato non disponibile');
  }

  // Determina il tipo di content block
  const isImage = mimetype.startsWith('image/');
  const contentType = isImage ? 'image' : 'document';

  // Prepara il prompt
  const prompt = skillPrompt || getDefaultPrompt();

  // Chiama Claude Vision
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: contentType as any,
            source: {
              type: 'base64',
              media_type: mimetype,
              data: datas,
            },
          },
          { type: 'text', text: prompt }
        ]
      }
    ]
  });

  // Estrai JSON dalla risposta
  const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

  // Trova il JSON nella risposta
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Nessun JSON valido nella risposta AI');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('JSON non valido nella risposta AI');
  }

  // Determina il tipo di documento dal nome
  const documentType = detectDocumentType(name);

  // Mappa i dati estratti
  const lines: ExtractedLine[] = (parsed.products || []).map((p: any) => ({
    description: p.description || '',
    product_code: p.article_code || null,
    quantity: parseFloat(p.quantity) || 0,
    unit: p.unit || 'NR',
    unit_price: p.unit_price || null,
    subtotal: p.subtotal || null,
    tax_rate: p.tax_rate || null,
    lot_number: p.lot_number || null,
    expiry_date: p.expiry_date || null,
    discount: p.discount || null,
  }));

  return {
    attachment_id: id,
    filename: name,
    document_type: documentType,
    supplier: {
      name: parsed.supplier_name || 'Sconosciuto',
      vat: parsed.supplier_vat || null,
    },
    document_info: {
      number: parsed.document_number || '',
      date: parsed.document_date || '',
      total: parsed.total_amount || null,
      subtotal: parsed.subtotal_amount || null,
      tax: parsed.tax_amount || null,
    },
    lines,
    raw_response: responseText,
  };
}

/**
 * Rileva il tipo di documento dal nome file
 */
function detectDocumentType(filename: string): 'invoice' | 'ddt' | 'order' | 'other' {
  const lower = filename.toLowerCase();

  if (lower.includes('fattura') || lower.includes('invoice') || lower.includes('fatt')) {
    return 'invoice';
  }
  if (lower.includes('ddt') || lower.includes('trasporto') || lower.includes('delivery')) {
    return 'ddt';
  }
  if (lower.includes('ordine') || lower.includes('order') || lower.includes('po')) {
    return 'order';
  }

  return 'other';
}

/**
 * Combina i risultati di più documenti
 */
function combineDocuments(documents: ExtractedDocument[]) {
  // Prendi il fornitore dalla fattura o dal primo documento
  const invoiceDoc = documents.find(d => d.document_type === 'invoice');
  const primaryDoc = invoiceDoc || documents[0];

  const supplier = primaryDoc?.supplier || { name: 'Sconosciuto' };
  const invoice_info = primaryDoc?.document_info || { number: '', date: '' };

  // Combina tutte le righe (preferendo quelle dalla fattura)
  const allLines: ExtractedLine[] = [];
  const seenKeys = new Set<string>();

  // Prima aggiungi righe dalla fattura
  for (const doc of documents) {
    for (const line of doc.lines) {
      // Crea chiave unica per deduplicazione
      const key = `${line.product_code || ''}-${line.description}-${line.lot_number || ''}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allLines.push(line);
      } else if (doc.document_type === 'invoice') {
        // Se è dalla fattura, sovrascrivi (ha più info come prezzi)
        const idx = allLines.findIndex(l =>
          `${l.product_code || ''}-${l.description}-${l.lot_number || ''}` === key
        );
        if (idx >= 0) {
          allLines[idx] = { ...allLines[idx], ...line };
        }
      }
    }
  }

  return {
    combined_lines: allLines,
    supplier,
    invoice_info,
  };
}

/**
 * Prompt di default se la skill non è disponibile
 */
function getDefaultPrompt(): string {
  return `Analizza questo documento (fattura, DDT o ordine) ed estrai i dati in formato JSON.

ESTRAI:
1. Fornitore: nome e P.IVA
2. Numero e data documento
3. Lista prodotti con: descrizione, codice, quantità, unità, prezzo, lotto, scadenza

FORMATO OUTPUT (JSON valido):
{
  "supplier_name": "Nome Fornitore",
  "supplier_vat": "12345678901",
  "document_number": "FAT/2025/001",
  "document_date": "2025-12-04",
  "total_amount": 1250.50,
  "products": [
    {
      "article_code": "COD123",
      "description": "Nome Prodotto",
      "quantity": 10.0,
      "unit": "KG",
      "unit_price": 5.50,
      "lot_number": "L12345",
      "expiry_date": "2025-06-30"
    }
  ]
}

REGOLE:
- Quantità: usa peso NETTO, non lordo
- Date: formato YYYY-MM-DD
- Numeri: usa punto decimale (5.5 non 5,5)
- Se manca un dato, usa null

Rispondi SOLO con JSON valido.`;
}
