import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildClassifyPrompt } from '@/lib/arrivo-merce/gemini-classify-prompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minuti per classificazione

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// MIME types supportati
const SUPPORTED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

export interface ClassifiedDocument {
  document_index: number;
  document_type: 'fattura_fornitore' | 'ddt_fornitore' | 'packing_list' | 'scontrino' | 'ordine_interno' | 'conferma_ordine' | 'altro';
  is_valid_for_arrival: boolean;
  emittente: string;
  numero_documento: string;
  description: string;
  attachment_id?: number;
  filename?: string;
}

export interface ClassificationResult {
  success: boolean;
  documents: ClassifiedDocument[];
  valid_document_indices: number[];
  valid_attachment_ids: number[];
  has_valid_documents: boolean;
  summary: string;
  purchase_order_id?: number;
  purchase_order_name?: string;
  chatter_message_id?: number;
  error?: string;
}

/**
 * CLASSIFY DOCUMENTS - Classificazione documenti con Gemini
 *
 * Analizza gli allegati e classifica il tipo di documento.
 * Identifica quali sono validi per fare un arrivo merce.
 * Salva un messaggio nel chatter del Purchase Order.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ClassificationResult>> {
  const startTime = Date.now();

  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({
        success: false,
        documents: [],
        valid_document_indices: [],
        valid_attachment_ids: [],
        has_valid_documents: false,
        summary: '',
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, attachment_ids, skip_chatter } = body;

    if (!picking_id && !attachment_ids) {
      return NextResponse.json({
        success: false,
        documents: [],
        valid_document_indices: [],
        valid_attachment_ids: [],
        has_valid_documents: false,
        summary: '',
        error: 'Fornire picking_id o attachment_ids'
      }, { status: 400 });
    }

    console.log(`🔍 [CLASSIFY-DOCS] Inizio classificazione documenti...`);

    // Recupera allegati e info P.O.
    let attachments: any[] = [];
    let purchaseOrderId: number | null = null;
    let purchaseOrderName: string | null = null;
    let supplierName: string | null = null;

    if (attachment_ids && attachment_ids.length > 0) {
      // Allegati specifici
      attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
        [['id', 'in', attachment_ids]],
        ['id', 'name', 'mimetype', 'datas', 'file_size', 'res_model', 'res_id']
      ]);

      // Cerca il P.O. dal primo allegato
      const firstAttachment = attachments[0];
      if (firstAttachment?.res_model === 'purchase.order' && firstAttachment?.res_id) {
        purchaseOrderId = firstAttachment.res_id;
        const pos = await callOdoo(cookies, 'purchase.order', 'read', [
          [purchaseOrderId],
          ['name', 'partner_id']
        ]);
        if (pos && pos.length > 0) {
          purchaseOrderName = pos[0].name;
          supplierName = pos[0].partner_id?.[1] || null;
        }
      }
    } else if (picking_id) {
      // Recupera picking e poi allegati dal P.O.
      const pickings = await callOdoo(cookies, 'stock.picking', 'read', [
        [picking_id],
        ['origin', 'partner_id']
      ]);

      if (!pickings || pickings.length === 0) {
        throw new Error('Picking non trovato');
      }

      const origin = pickings[0].origin;
      supplierName = pickings[0].partner_id?.[1] || null;

      if (!origin) {
        throw new Error('Picking senza Purchase Order collegato');
      }

      // Trova il P.O.
      const pos = await callOdoo(cookies, 'purchase.order', 'search_read', [
        [['name', '=', origin]],
        ['id', 'name', 'partner_id']
      ]);

      if (!pos || pos.length === 0) {
        throw new Error(`Purchase Order ${origin} non trovato`);
      }

      purchaseOrderId = pos[0].id;
      purchaseOrderName = pos[0].name;
      supplierName = pos[0].partner_id?.[1] || supplierName;

      // Recupera allegati del P.O.
      attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
        [
          ['res_model', '=', 'purchase.order'],
          ['res_id', '=', purchaseOrderId],
          ['mimetype', 'in', SUPPORTED_MIMETYPES]
        ],
        ['id', 'name', 'mimetype', 'datas', 'file_size']
      ]);
    }

    if (attachments.length === 0) {
      const result: ClassificationResult = {
        success: false,
        documents: [],
        valid_document_indices: [],
        valid_attachment_ids: [],
        has_valid_documents: false,
        summary: 'Nessun allegato trovato',
        purchase_order_id: purchaseOrderId || undefined,
        purchase_order_name: purchaseOrderName || undefined,
        error: 'Nessun allegato trovato'
      };

      return NextResponse.json(result, { status: 404 });
    }

    console.log(`📎 Trovati ${attachments.length} allegati da classificare`);

    // Valida dimensione totale
    const totalSize = attachments.reduce((sum: number, a: any) => sum + (a.file_size || 0), 0);
    const maxSize = 20 * 1024 * 1024; // 20 MB totale

    if (totalSize > maxSize) {
      return NextResponse.json({
        success: false,
        documents: [],
        valid_document_indices: [],
        valid_attachment_ids: [],
        has_valid_documents: false,
        summary: '',
        error: `File troppo grandi (${(totalSize / 1024 / 1024).toFixed(2)} MB). Max: 20 MB.`
      }, { status: 400 });
    }

    // Prepara array di parti per Gemini
    const parts: any[] = [];
    const attachmentMap: { index: number; attachment: any }[] = [];

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
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

      attachmentMap.push({ index: parts.length - 1, attachment });
      console.log(`📦 Aggiunto per classificazione: ${attachment.name} (${mediaType})`);
    }

    if (parts.length === 0) {
      return NextResponse.json({
        success: false,
        documents: [],
        valid_document_indices: [],
        valid_attachment_ids: [],
        has_valid_documents: false,
        summary: '',
        error: 'Nessun allegato valido da classificare'
      }, { status: 400 });
    }

    console.log(`🤖 Chiamata Gemini 2.5 Flash per classificazione (${parts.length} documenti)...`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });

    // Usa il prompt di classificazione
    const prompt = buildClassifyPrompt(parts.length);
    parts.push(prompt);

    const result = await model.generateContent(parts);

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const json = JSON.parse(cleaned);

    console.log(`✅ Gemini classificazione completata`);
    console.log(`📊 Documenti: ${json.documents?.length || 0}, Validi: ${json.valid_document_indices?.length || 0}`);

    // Arricchisci i documenti con attachment_id e filename
    const enrichedDocuments: ClassifiedDocument[] = (json.documents || []).map((doc: any, idx: number) => {
      const mappedAttachment = attachmentMap[doc.document_index];
      return {
        ...doc,
        attachment_id: mappedAttachment?.attachment?.id || null,
        filename: mappedAttachment?.attachment?.name || null
      };
    });

    // Calcola valid_attachment_ids
    const validAttachmentIds = (json.valid_document_indices || [])
      .map((idx: number) => attachmentMap[idx]?.attachment?.id)
      .filter((id: number | undefined) => id !== undefined);

    const processingTime = Date.now() - startTime;

    // Salva messaggio nel chatter del P.O.
    let chatterMessageId: number | null = null;

    console.log(`💬 [CLASSIFY-DOCS] purchaseOrderId: ${purchaseOrderId}, skip_chatter: ${skip_chatter}`);

    if (purchaseOrderId && !skip_chatter) {
      try {
        const validDocs = enrichedDocuments.filter((d: ClassifiedDocument) => d.is_valid_for_arrival);
        const invalidDocs = enrichedDocuments.filter((d: ClassifiedDocument) => !d.is_valid_for_arrival);

        console.log(`💬 [CLASSIFY-DOCS] Preparando messaggio chatter per P.O. ID: ${purchaseOrderId}`);

        let chatterMessage = `<p><strong>📋 Classificazione Documenti Automatica</strong></p>`;
        chatterMessage += `<p>Documenti analizzati: ${enrichedDocuments.length}</p>`;

        if (validDocs.length > 0) {
          chatterMessage += `<p>✅ <strong>Validi per arrivo:</strong> ${validDocs.length}</p><ul>`;
          for (const doc of validDocs) {
            const typeLabel = getDocumentTypeLabel(doc.document_type);
            chatterMessage += `<li>${typeLabel}: ${doc.emittente} ${doc.numero_documento ? `(${doc.numero_documento})` : ''}</li>`;
          }
          chatterMessage += `</ul>`;
        }

        if (invalidDocs.length > 0) {
          chatterMessage += `<p>❌ <strong>Non validi (ignorati):</strong> ${invalidDocs.length}</p><ul>`;
          for (const doc of invalidDocs) {
            const typeLabel = getDocumentTypeLabel(doc.document_type);
            chatterMessage += `<li>${typeLabel}: ${doc.filename || doc.numero_documento || 'documento'}</li>`;
          }
          chatterMessage += `</ul>`;
        }

        if (!json.has_valid_documents) {
          chatterMessage += `<p><strong>⚠️ Azione richiesta:</strong> Caricare fattura o DDT di ${supplierName || 'fornitore'}</p>`;
        } else {
          chatterMessage += `<p>→ Pronto per processare l'arrivo</p>`;
        }

        console.log(`💬 [CLASSIFY-DOCS] Chiamando message_post su P.O. ID: ${purchaseOrderId}`);
        console.log(`💬 [CLASSIFY-DOCS] Messaggio: ${chatterMessage.substring(0, 100)}...`);

        // IMPORTANTE: callOdoo vuole args e kwargs SEPARATI come 4° e 5° parametro
        const messageResult = await callOdoo(
          cookies,
          'purchase.order',
          'message_post',
          [[purchaseOrderId]],  // args: array di IDs
          {                     // kwargs: parametri del messaggio
            body: chatterMessage,
            message_type: 'comment',
            subtype_xmlid: 'mail.mt_note'
          }
        );

        console.log(`💬 [CLASSIFY-DOCS] message_post result: ${JSON.stringify(messageResult)}`);

        chatterMessageId = messageResult;
        console.log(`💬 Messaggio salvato nel chatter P.O. (ID: ${chatterMessageId})`);
      } catch (chatterError: any) {
        console.warn(`⚠️ Impossibile salvare messaggio nel chatter: ${chatterError.message}`);
      }
    }

    console.log(`✅ [CLASSIFY-DOCS] Completato in ${processingTime}ms`);

    const response: ClassificationResult = {
      success: true,
      documents: enrichedDocuments,
      valid_document_indices: json.valid_document_indices || [],
      valid_attachment_ids: validAttachmentIds,
      has_valid_documents: json.has_valid_documents || false,
      summary: json.summary || '',
      purchase_order_id: purchaseOrderId || undefined,
      purchase_order_name: purchaseOrderName || undefined,
      chatter_message_id: chatterMessageId || undefined
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [CLASSIFY-DOCS] Error:', error);
    return NextResponse.json({
      success: false,
      documents: [],
      valid_document_indices: [],
      valid_attachment_ids: [],
      has_valid_documents: false,
      summary: '',
      error: error.message || 'Errore durante la classificazione dei documenti'
    }, { status: 500 });
  }
}

/**
 * Traduce il tipo documento in etichetta leggibile
 */
function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'fattura_fornitore': 'Fattura',
    'ddt_fornitore': 'DDT',
    'packing_list': 'Packing List',
    'scontrino': 'Scontrino',
    'ordine_interno': 'Ordine interno',
    'conferma_ordine': 'Conferma ordine',
    'altro': 'Altro documento'
  };
  return labels[type] || type;
}
