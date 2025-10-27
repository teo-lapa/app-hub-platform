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

    console.log('🤖 Invio a Claude per analisi...', 'Format:', mediaType);

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

    // 🔍 STEP 1: Detect supplier to decide which parsing approach to use
    console.log('🔍 Detecting supplier from document...');
    const detectionSkill = loadSkill('document-processing/invoice-parsing');

    const detectionMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: 'Analizza questo documento e rispondi SOLO con un JSON nel formato: {"supplier_name": "Nome fornitore esatto come appare nel documento"}',
            },
          ],
        },
      ],
    });

    const detectionText = detectionMessage.content[0]?.type === 'text' ? detectionMessage.content[0].text : '';
    let supplierName = '';
    try {
      const detectionJson = JSON.parse(detectionText.match(/\{[\s\S]*\}/)?.[0] || '{}');
      supplierName = detectionJson.supplier_name || '';
      console.log('✅ Fornitore rilevato:', supplierName);
    } catch {
      console.warn('⚠️ Non riuscito a rilevare fornitore, uso parsing standard');
    }

    // 🧀 Check if it's Auricchio
    const isAuricchio = supplierName.toLowerCase().includes('auricchio');

    let parsedData;
    let message: any = null;

    if (isAuricchio && isPDF) {
      // 🧀 AURICCHIO: Use 4-agent approach for PERFECTION
      console.log('🧀 Documento Auricchio rilevato - Uso sistema 4-agenti per la perfezione!');

      // 🤖 AGENT 1: Extract lots table from page 1
      console.log('🤖 AGENT 1: Estrazione tabella lotti (pagina 1)...');
      const skill1 = loadSkill('document-processing/auricchio/extract-lots-table');
      const message1 = await anthropic.messages.create({
        model: skill1.metadata.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              { type: 'text', text: skill1.content },
            ],
          },
        ],
      });
      const lotsText = message1.content[0]?.type === 'text' ? message1.content[0].text : '';
      const lotsJson = JSON.parse(lotsText.match(/\{[\s\S]*\}/)?.[0] || '{}');
      console.log('✅ AGENT 1: Lotti estratti:', Object.keys(lotsJson.lots_map || {}).length);

      // 🤖 AGENT 2: Extract quantities from FATTURATA column (pages 2-3)
      console.log('🤖 AGENT 2: Estrazione quantità colonna FATTURATA (pagine 2-3)...');
      const skill2 = loadSkill('document-processing/auricchio/extract-invoice-quantities');
      const message2 = await anthropic.messages.create({
        model: skill2.metadata.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              { type: 'text', text: skill2.content },
            ],
          },
        ],
      });
      const quantitiesText = message2.content[0]?.type === 'text' ? message2.content[0].text : '';
      const quantitiesJson = JSON.parse(quantitiesText.match(/\{[\s\S]*\}/)?.[0] || '{}');
      console.log('✅ AGENT 2: Quantità estratte:', Object.keys(quantitiesJson.quantities_map || {}).length);

      // 🧀 Combina i risultati di Agent 1 e Agent 2
      console.log('🧀 Combinazione dati lotti + quantità...');

      // Merge lots_map and quantities_map by product code
      const productsMap = new Map();

      // Add quantities first
      for (const [code, qtyData] of Object.entries(quantitiesJson.quantities_map || {})) {
        productsMap.set(code, {
          article_code: code,
          description: (qtyData as any).description || '',
          quantity: (qtyData as any).quantity || 0,
          unit: (qtyData as any).unit || 'KG',
        });
      }

      // Add lots info
      for (const [code, lotData] of Object.entries(lotsJson.lots_map || {})) {
        const existing = productsMap.get(code) || { article_code: code, description: '', quantity: 0, unit: 'KG' };
        productsMap.set(code, {
          ...existing,
          lot_number: (lotData as any).lot_number,
          expiry_date: (lotData as any).expiry_date,
        });
      }

      parsedData = {
        supplier_name: 'AURICCHIO FORMAGGI SPA',
        supplier_vat: '',
        document_number: 'AURICCHIO-DOC',
        document_date: new Date().toISOString().split('T')[0],
        products: Array.from(productsMap.values()),
      };

      console.log('🧀✨ AURICCHIO: Parsing 2-agenti completato con successo!');
      console.log('📦 Prodotti Auricchio estratti:', parsedData.products.length);

    } else {
      // 📄 STANDARD: Use single skill for all other suppliers
      console.log('📄 Fornitore standard - Uso parsing skill singolo');

      const skill = loadSkill('document-processing/invoice-parsing');
      logSkillInfo('document-processing/invoice-parsing');
      console.log(`📚 Usando skill: ${skill.metadata.name} v${skill.metadata.version}`);

      // Call Claude API with vision/document - RETRY LOGIC
      let message;
      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        attempt++;
        console.log(`🤖 Tentativo ${attempt}/${maxAttempts} - Invio a Claude...`);

        try {
          message = await anthropic.messages.create({
            model: skill.metadata.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 8192,
            temperature: 0,
            messages: [
              {
                role: 'user',
                content: [
                  contentBlock,
                  {
                    type: 'text',
                    text: `${skill.content}\n\n---\n\nAnalizza questo documento e estrai i dati secondo le regole sopra.`,
                  },
                ],
              },
            ],
          });

          // If successful, break the loop
          break;
        } catch (apiError: any) {
          console.error(`❌ Tentativo ${attempt} fallito:`, apiError.message);

          if (attempt === maxAttempts) {
            throw new Error(`Parsing fallito dopo ${maxAttempts} tentativi. Il file potrebbe essere troppo complesso o danneggiato.`);
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!message) {
        throw new Error('Impossibile processare il documento dopo tutti i tentativi');
      }

      // Extract JSON from response
      const firstContent = message.content[0];
      const responseText = firstContent && firstContent.type === 'text' ? firstContent.text : '';
      console.log('📥 Risposta Claude (primi 300 char):', responseText.substring(0, 300));

      // Parse JSON response - ROBUST PARSING
      try {
        // Method 1: Try direct JSON parse
        try {
          parsedData = JSON.parse(responseText);
          console.log('✅ Metodo 1: JSON diretto - successo');
        } catch {
          // Method 2: Extract JSON from markdown code blocks
          const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch) {
            parsedData = JSON.parse(codeBlockMatch[1]);
            console.log('✅ Metodo 2: JSON da code block - successo');
          } else {
            // Method 3: Find first { to last }
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedData = JSON.parse(jsonMatch[0]);
              console.log('✅ Metodo 3: Estrazione { } - successo');
            } else {
              throw new Error('Nessun JSON valido trovato nella risposta');
            }
          }
        }

        // Validate parsed data structure
        if (!parsedData || typeof parsedData !== 'object') {
          throw new Error('Risposta non è un oggetto JSON valido');
        }

        if (!parsedData.supplier_name || !parsedData.document_number || !parsedData.products) {
          throw new Error('JSON mancante di campi obbligatori (supplier_name, document_number, products)');
        }

        if (!Array.isArray(parsedData.products)) {
          throw new Error('Il campo products deve essere un array');
        }

        console.log('✅ Validazione JSON completata');

      } catch (parseError: any) {
        console.error('❌ Errore parsing JSON:', parseError.message);
        console.error('❌ Response text completo:', responseText);

        return NextResponse.json({
          error: 'Errore nel parsing della risposta AI. Il documento potrebbe essere troppo complesso o in un formato non supportato.',
          details: parseError.message,
          hint: 'Prova a convertire il PDF in un formato più semplice o a ridurre il numero di pagine.'
        }, { status: 500 });
      }
    }

    // Validate final parsed data structure (common for both paths)
    if (!parsedData || typeof parsedData !== 'object') {
      throw new Error('Risposta non è un oggetto JSON valido');
    }

    if (!parsedData.supplier_name || !parsedData.document_number || !parsedData.products) {
      throw new Error('JSON mancante di campi obbligatori (supplier_name, document_number, products)');
    }

    if (!Array.isArray(parsedData.products)) {
      throw new Error('Il campo products deve essere un array');
    }

    console.log('✅ Dati estratti:', {
      supplier: parsedData.supplier_name,
      products: parsedData.products?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: parsedData,
      tokens_used: message?.usage
    });

  } catch (error: any) {
    console.error('❌ Errore parse-invoice:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing della fattura',
      details: error.toString()
    }, { status: 500 });
  }
}
