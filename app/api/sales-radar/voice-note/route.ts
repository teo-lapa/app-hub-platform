import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

// Lazy initialization - creates client only when needed
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY.trim(),
  });
}

/**
 * POST /api/sales-radar/voice-note
 *
 * Record voice note, transcribe with OpenAI Whisper, save to Odoo Lead/Partner
 * OR save a written text note
 *
 * Request: multipart/form-data OR JSON
 * - audio: File (webm/mp3 blob) - optional if text_note provided
 * - lead_id: number
 * - lead_type: 'lead' | 'partner'
 * - text_note: string (optional - for written notes)
 *
 * Response:
 * {
 *   success: true,
 *   transcription: string,
 *   attachment_id?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Get Odoo session from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    // Get user email from JWT token to find author_id
    let authorId: number | undefined;
    const token = request.cookies.get('token')?.value;
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          const userEmail = payload.email;
          if (userEmail) {
            // Find partner by email to use as author
            const partners = await client.searchRead(
              'res.partner',
              [['email', '=', userEmail]],
              ['id'],
              1
            );
            if (partners.length > 0) {
              authorId = partners[0].id;
              console.log(`[VOICE-NOTE] Found author partner ID: ${authorId} for email: ${userEmail}`);
            }
          }
        }
      } catch (e) {
        console.warn('[VOICE-NOTE] Could not extract author from token:', e);
      }
    }

    // Check content type to determine how to parse
    const contentType = request.headers.get('content-type') || '';

    let audioFile: File | null = null;
    let leadIdStr: string | null = null;
    let leadType: 'lead' | 'partner' | null = null;
    let textNote: string | null = null;

    if (contentType.includes('application/json')) {
      // JSON request (for written notes)
      const body = await request.json();
      leadIdStr = body.lead_id?.toString();
      leadType = body.lead_type;
      textNote = body.text_note;
    } else {
      // FormData request (for audio notes)
      const formData = await request.formData();
      audioFile = formData.get('audio') as File | null;
      leadIdStr = formData.get('lead_id') as string | null;
      leadType = formData.get('lead_type') as 'lead' | 'partner' | null;
      textNote = formData.get('text_note') as string | null;
    }

    // Validate required fields
    if (!leadIdStr) {
      return NextResponse.json({
        success: false,
        error: 'lead_id richiesto'
      }, { status: 400 });
    }

    if (!leadType || !['lead', 'partner'].includes(leadType)) {
      return NextResponse.json({
        success: false,
        error: 'lead_type deve essere "lead" o "partner"'
      }, { status: 400 });
    }

    const leadId = parseInt(leadIdStr, 10);
    if (isNaN(leadId) || leadId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'lead_id non valido'
      }, { status: 400 });
    }

    // Costruisci cookies string per callOdoo (come catalogo-venditori)
    const cookies = `session_id=${sessionId}`;

    // Handle written text note
    if (textNote && textNote.trim()) {
      console.log('[VOICE-NOTE] Saving written note to chatter:', leadType, leadId);

      // Post to chatter instead of description/comment
      let messageId: number;
      if (leadType === 'lead') {
        messageId = await postToLeadChatter(cookies, client, leadId, textNote.trim(), 'written', authorId);
      } else {
        messageId = await postToPartnerChatter(cookies, client, leadId, textNote.trim(), 'written', authorId);
      }

      console.log(`[VOICE-NOTE] Written note posted to chatter, message ID: ${messageId}`);

      return NextResponse.json({
        success: true,
        transcription: textNote.trim(),
        note_type: 'written',
        message_id: messageId
      });
    }

    // Handle audio note
    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'Nessun file audio o nota scritta fornita'
      }, { status: 400 });
    }

    // Validate audio file type
    const fileType = audioFile.type || 'audio/webm';

    if (!fileType.startsWith('audio/')) {
      return NextResponse.json({
        success: false,
        error: 'Il file deve essere un audio'
      }, { status: 400 });
    }

    console.log('[VOICE-NOTE] Processing voice note:', {
      audioFile: audioFile.name,
      size: audioFile.size,
      type: fileType,
      leadId,
      leadType
    });

    // 3. Send to OpenAI Whisper API for transcription
    const openai = getOpenAIClient();

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'it', // Italian
      response_format: 'json',
    });

    const transcriptionText = transcription.text;

    console.log('[VOICE-NOTE] Transcription completed:', transcriptionText);

    if (!transcriptionText || transcriptionText.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Trascrizione vuota - nessun audio riconosciuto'
      }, { status: 400 });
    }

    // 4. Save transcription to Odoo chatter
    let messageId: number;
    if (leadType === 'lead') {
      messageId = await postToLeadChatter(cookies, client, leadId, transcriptionText, 'voice', authorId);
    } else {
      messageId = await postToPartnerChatter(cookies, client, leadId, transcriptionText, 'voice', authorId);
    }

    console.log(`[VOICE-NOTE] Transcription posted to ${leadType} chatter, message ID: ${messageId}`);

    const timestamp = new Date().toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    // 5. Save audio file as ir.attachment in Odoo linked to the record
    const attachmentId = await saveAudioAttachment(
      client,
      audioFile,
      leadId,
      leadType,
      timestamp
    );

    console.log(`[VOICE-NOTE] Audio attachment saved with ID: ${attachmentId}`);

    // 6. Return transcription text
    return NextResponse.json({
      success: true,
      transcription: transcriptionText,
      attachment_id: attachmentId,
      message_id: messageId,
      note_type: 'voice'
    });

  } catch (error) {
    console.error('[VOICE-NOTE] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore durante l\'elaborazione della nota';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

/**
 * Generate formatted feedback note for chatter
 * USA HTML con <p> multipli come catalogo-venditori che funziona!
 * NON usare subtype_xmlid che causa escaping dell'HTML
 */
function generateFeedbackHtml(noteText: string, noteType: 'voice' | 'written'): string {
  const emoji = noteType === 'voice' ? '🎤' : '✏️';
  const typeLabel = noteType === 'voice' ? 'Nota Vocale' : 'Nota Scritta';
  const timestamp = new Date().toLocaleDateString('it-IT');
  const timeStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  // Formatta la nota con <br> per gli a capo
  const formattedNote = noteText.replace(/\n/g, '<br/>');

  // HTML con <p> multipli come catalogo-venditori
  return `<p><strong>📍 FEEDBACK SALES RADAR</strong></p>
<p>${emoji} ${typeLabel}</p>
<p>📅 ${timestamp} alle ${timeStr}</p>
<p><strong>📝 Nota:</strong></p>
<p>${formattedNote}</p>
<p><em>— Inserita tramite Sales Radar App</em></p>`;
}

/**
 * Post note to CRM Lead chatter (mail.message)
 * USA callOdoo DIRETTAMENTE come catalogo-venditori che funziona!
 */
async function postToLeadChatter(
  cookies: string,
  client: ReturnType<typeof createOdooRPCClient>,
  leadId: number,
  noteText: string,
  noteType: 'voice' | 'written',
  authorId?: number
): Promise<number> {
  // Verify lead exists
  const leads = await client.searchRead(
    'crm.lead',
    [['id', '=', leadId]],
    ['id', 'name'],
    1
  );

  if (leads.length === 0) {
    throw new Error(`Lead non trovato con ID: ${leadId}`);
  }

  // Generate formatted HTML feedback
  const feedbackHtml = generateFeedbackHtml(noteText, noteType);

  // USA callOdoo come catalogo-venditori (SENZA subtype_xmlid che escapa HTML!)
  const messageParams: Record<string, any> = {
    body: feedbackHtml,
    message_type: 'comment'
    // NON usare subtype_xmlid - causa escaping dell'HTML!
  };

  if (authorId) {
    messageParams.author_id = authorId;
  }

  const messageId = await callOdoo(
    cookies,
    'crm.lead',
    'message_post',
    [leadId],
    messageParams
  );

  return messageId;
}

/**
 * Post note to Partner chatter (mail.message)
 * USA callOdoo come catalogo-venditori (SENZA subtype_xmlid!)
 */
async function postToPartnerChatter(
  cookies: string,
  client: ReturnType<typeof createOdooRPCClient>,
  partnerId: number,
  noteText: string,
  noteType: 'voice' | 'written',
  authorId?: number
): Promise<number> {
  // Verify partner exists
  const partners = await client.searchRead(
    'res.partner',
    [['id', '=', partnerId]],
    ['id', 'name'],
    1
  );

  if (partners.length === 0) {
    throw new Error(`Partner non trovato con ID: ${partnerId}`);
  }

  // Generate formatted HTML feedback
  const feedbackHtml = generateFeedbackHtml(noteText, noteType);

  // USA callOdoo come catalogo-venditori (SENZA subtype_xmlid che escapa HTML!)
  const messageParams: Record<string, any> = {
    body: feedbackHtml,
    message_type: 'comment'
    // NON usare subtype_xmlid - causa escaping dell'HTML!
  };

  if (authorId) {
    messageParams.author_id = authorId;
  }

  const messageId = await callOdoo(
    cookies,
    'res.partner',
    'message_post',
    [partnerId],
    messageParams
  );

  return messageId;
}

/**
 * Save audio file as ir.attachment in Odoo
 */
async function saveAudioAttachment(
  client: ReturnType<typeof createOdooRPCClient>,
  audioFile: File,
  recordId: number,
  recordType: 'lead' | 'partner',
  timestamp: string
): Promise<number> {
  // Convert File to base64
  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');

  // Determine model and filename
  const resModel = recordType === 'lead' ? 'crm.lead' : 'res.partner';
  const extension = getFileExtension(audioFile.type);
  const sanitizedTimestamp = timestamp.replace(/[/:]/g, '-').replace(/\s+/g, '_');
  const filename = `nota_vocale_${sanitizedTimestamp}.${extension}`;

  // Create attachment in Odoo
  const attachmentId = await client.callKw('ir.attachment', 'create', [{
    name: filename,
    datas: base64Data,
    res_model: resModel,
    res_id: recordId,
    mimetype: audioFile.type || 'audio/webm',
    description: `Nota vocale registrata il ${timestamp}`
  }]);

  return attachmentId;
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a'
  };

  return mimeToExt[mimeType] || 'webm';
}
