import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

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
 *
 * Request: multipart/form-data
 * - audio: File (webm/mp3 blob)
 * - lead_id: number
 * - lead_type: 'lead' | 'partner'
 *
 * Response:
 * {
 *   success: true,
 *   transcription: string,
 *   attachment_id: number
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

    // 2. Receive audio blob from frontend
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const leadIdStr = formData.get('lead_id') as string | null;
    const leadType = formData.get('lead_type') as 'lead' | 'partner' | null;

    // Validate required fields
    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'Nessun file audio fornito'
      }, { status: 400 });
    }

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

    // Validate audio file type
    const validTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
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

    // 4. Save transcription to Odoo based on lead_type
    const timestamp = new Date().toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    const voiceNoteEntry = `\n\n--- Nota Vocale (${timestamp}) ---\n${transcriptionText}`;

    if (leadType === 'lead') {
      // Append to crm.lead description
      await appendToCrmLeadDescription(client, leadId, voiceNoteEntry);
    } else {
      // Append to res.partner comment
      await appendToPartnerComment(client, leadId, voiceNoteEntry);
    }

    console.log(`[VOICE-NOTE] Transcription saved to ${leadType} ID: ${leadId}`);

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
      attachment_id: attachmentId
    });

  } catch (error) {
    console.error('[VOICE-NOTE] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore durante l\'elaborazione della nota vocale';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

/**
 * Append voice note transcription to CRM Lead description
 */
async function appendToCrmLeadDescription(
  client: ReturnType<typeof createOdooRPCClient>,
  leadId: number,
  voiceNoteEntry: string
): Promise<void> {
  // Get current description
  const leads = await client.searchRead(
    'crm.lead',
    [['id', '=', leadId]],
    ['id', 'description'],
    1
  );

  if (leads.length === 0) {
    throw new Error(`Lead non trovato con ID: ${leadId}`);
  }

  const currentDescription = leads[0].description || '';
  const newDescription = currentDescription + voiceNoteEntry;

  // Update the lead description
  await client.callKw('crm.lead', 'write', [[leadId], { description: newDescription }]);
}

/**
 * Append voice note transcription to Partner comment
 */
async function appendToPartnerComment(
  client: ReturnType<typeof createOdooRPCClient>,
  partnerId: number,
  voiceNoteEntry: string
): Promise<void> {
  // Get current comment
  const partners = await client.searchRead(
    'res.partner',
    [['id', '=', partnerId]],
    ['id', 'comment'],
    1
  );

  if (partners.length === 0) {
    throw new Error(`Partner non trovato con ID: ${partnerId}`);
  }

  const currentComment = partners[0].comment || '';
  const newComment = currentComment + voiceNoteEntry;

  // Update the partner comment
  await client.callKw('res.partner', 'write', [[partnerId], { comment: newComment }]);
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
