import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { loadSkill, logSkillInfo } from '@/lib/ai/skills-loader';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large PDFs

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to compress large PDFs
async function compressPDF(buffer: Buffer): Promise<Buffer> {
  // For now, we'll just return the original buffer
  // In production, you could use pdf-lib or similar to actually compress
  return buffer;
}

// Helper function to validate file size
function validateFileSize(size: number): { valid: boolean; message?: string } {
  const maxSize = 10 * 1024 * 1024; // 10 MB
  const warningSize = 5 * 1024 * 1024; // 5 MB

  if (size > maxSize) {
    return {
      valid: false,
      message: `File troppo grande (${(size / 1024 / 1024).toFixed(2)} MB). Dimensione massima: 10 MB. Prova a ridurre la qualità del PDF o dividerlo in più parti.`
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
    let buffer = Buffer.from(bytes);

    // Compress if needed (for future implementation)
    if (file.size > 5 * 1024 * 1024) {
      console.log('🗜️ File grande, preparazione per processing...');
      buffer = await compressPDF(buffer);
    }

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

    console.log('🤖 Sistema 4-Agenti UNIVERSALE attivato...');

    // Determine content type based on file format (PDF uses 'document', images use 'image')
    const isPDF = mediaType === 'application/pdf';
    const contentBlock: any = isPDF ? {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    } : {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    };

    // Helper function to call Claude and parse JSON
    const callAgent = async (skillPath: string, agentName: string, additionalContext?: string) => {
      console.log(`🤖 ${agentName}...`);
      const skill = loadSkill(skillPath);

      const promptText = additionalContext
        ? `${skill.content}\n\n---\n\n${additionalContext}`
        : skill.content;

      const message = await anthropic.messages.create({
        model: skill.metadata.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              { type: 'text', text: promptText },
            ],
          },
        ],
      });

      const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

      // Parse JSON
      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          json = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`${agentName}: Nessun JSON valido nella risposta`);
        }
      }

      console.log(`✅ ${agentName}: completato`);
      return json;
    };

    // 🤖 AGENT 0: Identify Documents
    const docInfo = await callAgent('document-processing/identify-documents', 'AGENT 0 - Identificazione Documenti');
    console.log('📄 Documento principale identificato:', docInfo.primary_document.type, '- Pagine:', docInfo.primary_document.pages);

    // 🤖 AGENT 1: Extract Products (quantities + descriptions)
    const pagesContext = `IMPORTANTE: Estrai prodotti SOLO dalle pagine ${docInfo.primary_document.pages.join(', ')} che contengono il documento "${docInfo.primary_document.type}". IGNORA tutte le altre pagine!`;
    const productsData = await callAgent('document-processing/extract-products', 'AGENT 1 - Estrazione Prodotti', pagesContext);

    // 🤖 AGENT 2: Extract Lots and Expiry Dates
    const lotsData = await callAgent('document-processing/extract-lots', 'AGENT 2 - Estrazione Lotti', pagesContext);

    // 🤖 AGENT 3: Extract Supplier Info
    const supplierData = await callAgent('document-processing/extract-supplier', 'AGENT 3 - Estrazione Fornitore');

    // 🔗 MERGE: Combine products with lots by article_code
    console.log('🔗 Unione dati prodotti + lotti...');
    const lotsMap = new Map();
    for (const lot of (lotsData.lots || [])) {
      lotsMap.set(lot.article_code, {
        lot_number: lot.lot_number,
        expiry_date: lot.expiry_date,
      });
    }

    const products = (productsData.products || []).map((product: any) => {
      const lotInfo = lotsMap.get(product.article_code) || {};
      return {
        article_code: product.article_code,
        description: product.description,
        quantity: product.quantity,
        unit: product.unit,
        lot_number: lotInfo.lot_number || undefined,
        expiry_date: lotInfo.expiry_date || undefined,
      };
    });

    const parsedData = {
      supplier_name: supplierData.supplier_name,
      supplier_vat: supplierData.supplier_vat || '',
      document_number: supplierData.document_number,
      document_date: supplierData.document_date,
      products: products,
    };

    console.log('✅ Sistema 4-Agenti completato:', {
      documento_usato: docInfo.primary_document.type,
      pagine: docInfo.primary_document.pages,
      supplier: parsedData.supplier_name,
      products: parsedData.products?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: parsedData,
      tokens_used: undefined
    });

  } catch (error: any) {
    console.error('❌ Errore parse-invoice:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing della fattura',
      details: error.toString()
    }, { status: 500 });
  }
}
