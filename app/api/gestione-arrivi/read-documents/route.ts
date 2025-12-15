import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildGeminiPrompt } from '@/lib/arrivo-merce/gemini-prompt';
import { ClassificationResult } from '@/app/gestione-arrivi/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti per documenti multipli

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// MIME types supportati
const SUPPORTED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

// URL base per chiamate interne
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return 'http://localhost:3000';
};

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
 * READ DOCUMENTS - USANDO GEMINI (come arrivo-merce)
 *
 * Legge TUTTI gli allegati di un picking usando Gemini 2.5 Flash
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
    const { picking_id, attachment_ids, skip_classification } = body;

    if (!picking_id && !attachment_ids) {
      return NextResponse.json({
        error: 'Fornire picking_id o attachment_ids'
      }, { status: 400 });
    }

    console.log(`📖 [READ-DOCS] Inizio lettura documenti...`);

    // ===== FASE 1: CLASSIFICAZIONE DOCUMENTI =====
    // Se non viene passato skip_classification, classifichiamo prima i documenti
    let validAttachmentIds: number[] = [];
    let classification: ClassificationResult | null = null;

    if (!skip_classification) {
      console.log(`🔍 [READ-DOCS] Fase 1: Classificazione documenti...`);

      try {
        // Importa dinamicamente per evitare circular dependency
        const { POST: classifyDocuments } = await import('../classify-documents/route');

        // Crea una nuova request per classify-documents
        const classifyRequest = new NextRequest(
          new URL('/api/gestione-arrivi/classify-documents', getBaseUrl()),
          {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify({ picking_id, attachment_ids })
          }
        );

        const classifyResponse = await classifyDocuments(classifyRequest);
        classification = await classifyResponse.json() as ClassificationResult;

        if (!classification.success) {
          console.error(`❌ [READ-DOCS] Classificazione fallita: ${classification.error}`);
          return NextResponse.json({
            success: false,
            error: classification.error || 'Errore durante la classificazione',
            classification
          }, { status: 400 });
        }

        // Verifica se ci sono documenti validi
        if (!classification.has_valid_documents) {
          console.warn(`⚠️ [READ-DOCS] Nessun documento valido trovato`);
          return NextResponse.json({
            success: false,
            error: 'Nessun documento valido per arrivo merce',
            error_code: 'NO_VALID_DOCUMENTS',
            classification,
            message: classification.summary,
            documents_found: classification.documents
          }, { status: 400 });
        }

        validAttachmentIds = classification.valid_attachment_ids;
        console.log(`✅ [READ-DOCS] Classificazione completata: ${validAttachmentIds.length} documenti validi`);

      } catch (classifyError: any) {
        console.error(`❌ [READ-DOCS] Errore classificazione:`, classifyError);
        // Se la classificazione fallisce, continuiamo con tutti gli allegati (fallback)
        console.warn(`⚠️ [READ-DOCS] Fallback: processo tutti gli allegati senza classificazione`);
      }
    }

    // ===== FASE 2: RECUPERA ALLEGATI =====
    let attachments: any[] = [];

    if (validAttachmentIds.length > 0) {
      // Usa solo gli allegati validi dalla classificazione
      attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
        [['id', 'in', validAttachmentIds]],
        ['id', 'name', 'mimetype', 'datas', 'file_size']
      ]);
      console.log(`📎 Usando ${attachments.length} allegati validi dalla classificazione`);
    } else if (attachment_ids && attachment_ids.length > 0) {
      // Allegati specifici (skip_classification o fallback)
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
        error: 'Nessun allegato trovato',
        classification
      }, { status: 404 });
    }

    console.log(`📎 Trovati ${attachments.length} allegati da processare`);

    // Valida dimensione totale
    const totalSize = attachments.reduce((sum: number, a: any) => sum + (a.file_size || 0), 0);
    const maxSize = 20 * 1024 * 1024; // 20 MB totale

    if (totalSize > maxSize) {
      return NextResponse.json({
        success: false,
        error: `File troppo grandi (${(totalSize / 1024 / 1024).toFixed(2)} MB totale). Dimensione massima: 20 MB.`
      }, { status: 400 });
    }

    // Prepara array di parti per Gemini
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
        success: false,
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

    // Usa il prompt condiviso (passa il numero di documenti)
    const prompt = buildGeminiPrompt(parts.length);

    // Aggiungi il prompt alla fine
    parts.push(prompt);

    const result = await model.generateContent(parts);

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const json = JSON.parse(cleaned);

    console.log(`✅ Gemini: completato - ${json.products?.length || 0} prodotti estratti da ${parts.length - 1} documenti`);

    // Mappa i prodotti al formato ExtractedLine
    const lines: ExtractedLine[] = (json.products || []).map((p: any) => ({
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

    // Costruisci risposta nel formato atteso
    const extractedDocuments: ExtractedDocument[] = [{
      attachment_id: attachments[0]?.id || 0,
      filename: attachments.map(a => a.name).join(', '),
      document_type: detectDocumentType(attachments[0]?.name || ''),
      supplier: {
        name: json.supplier_name || 'Sconosciuto',
        vat: json.supplier_vat || null,
      },
      document_info: {
        number: json.document_number || '',
        date: json.document_date || '',
        total: json.total_amount || null,
        subtotal: json.subtotal_amount || null,
        tax: json.tax_amount || null,
      },
      lines,
      raw_response: text,
    }];

    const processingTime = Date.now() - startTime;

    console.log(`✅ [READ-DOCS] Completato in ${processingTime}ms`);
    console.log(`📊 Totale: ${lines.length} righe estratte`);

    return NextResponse.json({
      success: true,
      documents: extractedDocuments,
      combined_lines: lines,
      supplier: {
        name: json.supplier_name || 'Sconosciuto',
        vat: json.supplier_vat || null,
      },
      invoice_info: {
        number: json.document_number || '',
        date: json.document_date || '',
        total: json.total_amount || null,
      },
      // Aggiungi parsed_products per compatibilità con process-reception
      parsed_products: json.products || [],
      processing_time_ms: processingTime,
      // Includi risultato classificazione se disponibile
      classification: classification || undefined
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
