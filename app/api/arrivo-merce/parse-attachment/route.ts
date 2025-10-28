import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import Anthropic from '@anthropic-ai/sdk';
import { loadSkill, logSkillInfo } from '@/lib/ai/skills-loader';
import { PDFDocument } from 'pdf-lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large PDFs

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Split PDF into individual pages
 * Returns array of base64-encoded single-page PDFs
 */
async function splitPDFPages(base64PDF: string): Promise<string[]> {
  try {
    // Decode base64 to buffer
    const pdfBytes = Buffer.from(base64PDF, 'base64');

    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    console.log(`📄 PDF ha ${pageCount} pagine, splitting...`);

    const pages: string[] = [];

    // Create a separate PDF for each page
    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);

      // Save as base64
      const pdfBytesPage = await newPdf.save();
      const base64Page = Buffer.from(pdfBytesPage).toString('base64');
      pages.push(base64Page);

      console.log(`  ✅ Pagina ${i + 1}/${pageCount} estratta (${(pdfBytesPage.length / 1024).toFixed(1)} KB)`);
    }

    return pages;
  } catch (error: any) {
    console.error('❌ Errore split PDF:', error.message);
    throw new Error(`Impossibile splittare PDF: ${error.message}`);
  }
}

/**
 * Parse a single page with Claude + Skill
 */
async function parsePage(
  pageBase64: string,
  pageNumber: number,
  totalPages: number,
  mediaType: string,
  skill: any,
  errorCollector?: Array<{page: number, error: string, response?: string}>
): Promise<any | null> {
  const isPDF = mediaType === 'application/pdf';

  const contentBlock: any = isPDF ? {
    type: 'document',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: pageBase64,
    },
  } : {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: pageBase64,
    },
  };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let responseText = '';
    try {
      console.log(`🤖 Tentativo ${attempt}/${maxAttempts} per pagina ${pageNumber}/${totalPages}...`);

      const message = await anthropic.messages.create({
        model: skill.metadata.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 8192, // Originale - ogni pagina ha meno prodotti
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              {
                type: 'text',
                text: `${skill.content}\n\n---\n\nAnalizza questa pagina di fattura ed estrai i prodotti. Questa è la pagina ${pageNumber} di ${totalPages}.`,
              },
            ],
          },
        ],
      });

      // Extract JSON from response
      const firstContent = message.content[0];
      responseText = firstContent && firstContent.type === 'text' ? firstContent.text : '';

      // Log response for debugging
      console.log(`📄 Response pagina ${pageNumber} (primi 1500 chars):`, responseText.substring(0, 1500));
      console.log(`📊 Response type:`, firstContent?.type);
      console.log(`📏 Response length:`, responseText.length, 'chars');

      // Try to parse JSON
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          parsedData = JSON.parse(codeBlockMatch[1]);
        } else {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Nessun JSON valido trovato');
          }
        }
      }

      // Validate basic structure
      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('JSON non valido');
      }

      console.log(`✅ Pagina ${pageNumber} parsata: ${parsedData.products?.length || 0} prodotti trovati`);

      return {
        data: parsedData,
        tokens: message.usage,
      };

    } catch (error: any) {
      console.error(`❌ Errore pagina ${pageNumber}, tentativo ${attempt}:`, error.message);
      console.error(`🔍 Error stack:`, error.stack);

      if (error.message.includes('Nessun JSON valido trovato') && responseText) {
        console.error(`📄 Full response text (for debugging):`, responseText);
        console.error(`📄 Response text length:`, responseText.length);

        // Try to find any JSON-like structure
        const possibleJson = responseText.match(/\{[\s\S]*\}/g);
        if (possibleJson) {
          console.error(`🔍 Found ${possibleJson.length} potential JSON structures:`);
          possibleJson.forEach((json, idx) => {
            console.error(`  ${idx + 1}. First 200 chars:`, json.substring(0, 200));
          });
        } else {
          console.error(`❌ No JSON-like structures found in response`);
        }
      }

      if (attempt === maxAttempts) {
        console.error(`⚠️ Pagina ${pageNumber} saltata dopo ${maxAttempts} tentativi`);
        console.error(`📄 Ultima response salvata per debug`);

        // Save error details to collector
        if (errorCollector) {
          const existingError = errorCollector.find(e => e.page === pageNumber);
          if (existingError) {
            existingError.error = error.message;
            existingError.response = responseText.substring(0, 2000); // First 2000 chars
          }
        }

        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return null;
}

/**
 * Merge results from multiple pages
 * Consolidates duplicate products
 */
function mergePages(pageResults: any[]): any {
  if (pageResults.length === 0) {
    throw new Error('Nessuna pagina processata con successo');
  }

  // Take supplier info from first page
  const mergedData: any = {
    supplier_name: pageResults[0].supplier_name,
    supplier_vat: pageResults[0].supplier_vat,
    document_number: pageResults[0].document_number,
    document_date: pageResults[0].document_date,
    products: [],
  };

  // Collect all products
  const allProducts: any[] = [];
  for (const page of pageResults) {
    if (page.products && Array.isArray(page.products)) {
      allProducts.push(...page.products);
    }
  }

  console.log(`📦 Totale prodotti da tutte le pagine: ${allProducts.length}`);

  // Consolidate duplicates (same code + lot + expiry + unit)
  const productMap = new Map<string, any>();

  for (const product of allProducts) {
    const key = `${product.article_code || 'NO_CODE'}_${product.lot_number || 'NO_LOT'}_${product.expiry_date || 'NO_EXP'}_${product.unit}`;

    if (productMap.has(key)) {
      // Duplicate found - sum quantities
      const existing = productMap.get(key);
      existing.quantity += product.quantity;
      console.log(`🔄 Consolidato: ${product.article_code} (${existing.quantity})`);
    } else {
      // New product
      productMap.set(key, { ...product });
    }
  }

  mergedData.products = Array.from(productMap.values());

  // Add parsing summary
  mergedData.parsing_summary = {
    total_lines_in_invoice: allProducts.length,
    unique_products_after_consolidation: mergedData.products.length,
    duplicates_found: allProducts.length - mergedData.products.length,
  };

  console.log(`✅ Dopo consolidamento: ${mergedData.products.length} prodotti unici`);
  console.log(`📊 Parsing summary:`, mergedData.parsing_summary);

  return mergedData;
}

/**
 * PARSE ATTACHMENT FROM ODOO
 *
 * Scarica un allegato da Odoo e lo parsea con AI
 * Per PDF multi-pagina, splitta e processa ogni pagina separatamente
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

    console.log('📥 [PARSE-ATTACHMENT] Scarico allegato ID:', attachment_id);
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

    // 🆕 CARICA LO SKILL PER INVOICE PARSING
    // Skip cache to always get the latest version
    const skill = loadSkill('document-processing/invoice-parsing', { skipCache: true });
    logSkillInfo('document-processing/invoice-parsing');
    console.log(`📚 Usando skill: ${skill.metadata.name} v${skill.metadata.version} (model: ${skill.metadata.model})`);

    // 🆕 SPLIT STRATEGY FOR MULTI-PAGE PDFs
    let pagesToProcess: string[] = [];
    const isPDF = mediaType === 'application/pdf';

    if (isPDF) {
      try {
        pagesToProcess = await splitPDFPages(base64);
      } catch (splitError: any) {
        console.error('⚠️ Impossibile splittare PDF, uso PDF intero:', splitError.message);
        pagesToProcess = [base64]; // Fallback
      }
    } else {
      pagesToProcess = [base64]; // Images: no split
    }

    console.log(`\n🚀 Inizio processamento di ${pagesToProcess.length} pagina/e...\n`);

    // Process each page
    const pageResults: any[] = [];
    let totalTokensUsed = { input_tokens: 0, output_tokens: 0 };

    const parseErrors: Array<{page: number, error: string, response?: string}> = [];
    for (let i = 0; i < pagesToProcess.length; i++) {
      // Pre-populate error entry
      const errorEntry = {
        page: i + 1,
        error: `Pagina ${i + 1} non parsata`,
        response: undefined
      };
      parseErrors.push(errorEntry);

      const result = await parsePage(
        pagesToProcess[i],
        i + 1,
        pagesToProcess.length,
        mediaType,
        skill,
        parseErrors
      );

      if (result) {
        pageResults.push(result.data);
        totalTokensUsed.input_tokens += result.tokens.input_tokens;
        totalTokensUsed.output_tokens += result.tokens.output_tokens;
        // Remove error entry if successful
        parseErrors.pop();
      }
    }

    if (pageResults.length === 0) {
      console.error('❌ Nessuna pagina processata con successo');
      console.error('📋 Errori:', parseErrors);
      console.error('📄 Allegato:', attachment.name, attachment.mimetype);
      console.error('📏 Dimensione:', (attachment.file_size / 1024).toFixed(2), 'KB');

      return NextResponse.json({
        error: 'Nessuna pagina processata con successo. Il PDF potrebbe essere danneggiato o troppo complesso.',
        hint: 'Prova a ricaricarlo o convertirlo in un formato più semplice.',
        debug: {
          attachment_name: attachment.name,
          pages_total: pagesToProcess.length,
          pages_failed: parseErrors.length,
          errors: parseErrors,
          // Add first page response for debugging
          first_page_response: parseErrors[0]?.response || 'No response captured'
        }
      }, { status: 500 });
    }

    console.log(`\n✅ ${pageResults.length}/${pagesToProcess.length} pagine processate con successo`);

    // Merge all pages
    const mergedData = mergePages(pageResults);

    console.log('\n✅ COMPLETATO:', {
      supplier: mergedData.supplier_name,
      products: mergedData.products.length,
      parsing_summary: mergedData.parsing_summary,
    });

    return NextResponse.json({
      success: true,
      data: mergedData,
      source: {
        type: 'odoo_attachment',
        attachment_id: attachment.id,
        attachment_name: attachment.name,
        mimetype: attachment.mimetype,
        pages_processed: pageResults.length,
        pages_total: pagesToProcess.length,
      },
      tokens_used: totalTokensUsed
    });

  } catch (error: any) {
    console.error('❌ [PARSE-ATTACHMENT] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing dell\'allegato',
      details: error.toString()
    }, { status: 500 });
  }
}
