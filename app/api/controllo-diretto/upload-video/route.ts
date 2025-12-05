import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

// Maximum duration for serverless function
export const maxDuration = 60;

/**
 * This endpoint handles client-side uploads to Vercel Blob.
 * The client uploads directly to Vercel Blob, bypassing the 4.5MB serverless limit.
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json() as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the upload request
        console.log(`📹 [UPLOAD-VIDEO] Generating token for: ${pathname}`);
        return {
          allowedContentTypes: ['video/webm', 'video/mp4', 'video/quicktime'],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB max
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This is called after the upload is complete
        console.log(`✅ [UPLOAD-VIDEO] Upload completato: ${blob.url}`);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error('❌ [UPLOAD-VIDEO] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore upload video' },
      { status: 500 }
    );
  }
}

/**
 * Endpoint to notify the server after a successful client-side upload.
 * This posts the video link to the Odoo chatter.
 */
export async function PUT(request: NextRequest) {
  try {
    // Get user session
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const { blobUrl, batchId, duration, operatorName, sizeMb } = await request.json();

    if (!blobUrl || !batchId) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    console.log(`📹 [UPLOAD-VIDEO] Notifica upload per batch ${batchId}, URL: ${blobUrl}`);

    // Format duration for display
    const durationSecs = parseInt(duration) || 0;
    const durationFormatted = `${Math.floor(durationSecs / 60)}:${(durationSecs % 60).toString().padStart(2, '0')}`;

    // Create message for Odoo chatter
    const now = new Date();
    const dateFormatted = now.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Use plain text format for easier parsing (with link still in HTML for Odoo to render)
    const messagePlain = `📹 VIDEO CONTROLLO DIRETTO
Durata: ${durationFormatted}
Data: ${dateFormatted}
${operatorName ? `Operatore: ${operatorName}` : ''}
Dimensione: ${sizeMb || '?'} MB
👉 <a href="${blobUrl}" target="_blank">Clicca qui per guardare il video</a>`;

    // Post message to batch chatter
    try {
      await callOdoo(
        cookies,
        'stock.picking.batch',
        'message_post',
        [[parseInt(batchId)]],
        {
          body: messagePlain,
          message_type: 'comment',
          subtype_xmlid: 'mail.mt_note'
        }
      );

      console.log(`✅ [UPLOAD-VIDEO] Messaggio postato nel chatter del batch ${batchId}`);
    } catch (chatterError: any) {
      console.error('⚠️ [UPLOAD-VIDEO] Errore post chatter:', chatterError.message);
      // Return error since this is the main purpose of this endpoint
      return NextResponse.json({ error: 'Errore salvataggio su Odoo' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      blob_url: blobUrl,
      duration: durationFormatted
    });

  } catch (error: any) {
    console.error('❌ [UPLOAD-VIDEO] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore notifica upload' },
      { status: 500 }
    );
  }
}
