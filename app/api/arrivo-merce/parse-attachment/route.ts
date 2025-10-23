import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import Anthropic from '@anthropic-ai/sdk';
import { loadSkill, logSkillInfo } from '@/lib/ai/skills-loader';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large PDFs

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * PARSE ATTACHMENT FROM ODOO
 *
 * Scarica un allegato da Odoo e lo parsea con AI
 * Usa lo stesso skill di parse-invoice
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
    console.log('📄 Allegato:', attachment.name, `(${attachment.mimetype}, ${attachment.file_size} bytes)`);

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

    console.log('🤖 Invio a Claude per analisi...', 'Format:', mediaType);

    // 🆕 CARICA LO SKILL PER INVOICE PARSING
    const skill = loadSkill('invoice-parsing');
    logSkillInfo('invoice-parsing');
    console.log(`📚 Usando skill: ${skill.metadata.name} v${skill.metadata.version}`);

    // Determine content type based on file format
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
    let parsedData;
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

    console.log('✅ Dati estratti:', {
      supplier: parsedData.supplier_name,
      products: parsedData.products?.length || 0,
      attachment_name: attachment.name
    });

    return NextResponse.json({
      success: true,
      data: parsedData,
      source: {
        type: 'odoo_attachment',
        attachment_id: attachment.id,
        attachment_name: attachment.name,
        mimetype: attachment.mimetype
      },
      tokens_used: message.usage
    });

  } catch (error: any) {
    console.error('❌ [PARSE-ATTACHMENT] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il parsing dell\'allegato',
      details: error.toString()
    }, { status: 500 });
  }
}
