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

    const messageHtml = `
      <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
        <h3 style="margin: 0 0 12px 0; color: #0369a1;">📹 VIDEO CONTROLLO DIRETTO</h3>
        <table style="font-size: 14px; line-height: 1.6;">
          <tr>
            <td style="padding-right: 16px; color: #64748b;">Durata:</td>
            <td style="font-weight: 600;">${durationFormatted}</td>
          </tr>
          <tr>
            <td style="padding-right: 16px; color: #64748b;">Data:</td>
            <td>${dateFormatted}</td>
          </tr>
          ${operatorName ? `
          <tr>
            <td style="padding-right: 16px; color: #64748b;">Operatore:</td>
            <td>${operatorName}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding-right: 16px; color: #64748b;">Dimensione:</td>
            <td>${sizeMb || '?'} MB</td>
          </tr>
        </table>
        <p style="margin: 16px 0 0 0;">
          <a href="${blobUrl}" target="_blank" style="display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            ▶️ Guarda Video
          </a>
        </p>
      </div>
    `;

    // Post message to batch chatter
    try {
      await callOdoo(
        cookies,
        'stock.picking.batch',
        'message_post',
        [[parseInt(batchId)]],
        {
          body: messageHtml,
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
