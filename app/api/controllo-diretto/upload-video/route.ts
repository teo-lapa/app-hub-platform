import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

// Maximum duration for serverless function (video uploads can take time)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const batchId = formData.get('batch_id') as string;
    const batchName = formData.get('batch_name') as string;
    const duration = formData.get('duration') as string;
    const operatorName = formData.get('operator_name') as string;

    if (!videoFile || !batchId) {
      return NextResponse.json({ error: 'Dati mancanti (video o batch_id)' }, { status: 400 });
    }

    console.log(`📹 [UPLOAD-VIDEO] Inizio upload per batch ${batchId}, size: ${(videoFile.size / 1024 / 1024).toFixed(2)} MB`);

    // Format duration for display
    const durationSecs = parseInt(duration) || 0;
    const durationFormatted = `${Math.floor(durationSecs / 60)}:${(durationSecs % 60).toString().padStart(2, '0')}`;

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `controllo-diretto/batch-${batchId}/${timestamp}.webm`;

    // Upload to Vercel Blob
    const blob = await put(filename, videoFile, {
      access: 'public',
      contentType: videoFile.type || 'video/webm'
    });

    console.log(`✅ [UPLOAD-VIDEO] Video caricato su Vercel Blob: ${blob.url}`);

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
            <td>${(videoFile.size / 1024 / 1024).toFixed(2)} MB</td>
          </tr>
        </table>
        <p style="margin: 16px 0 0 0;">
          <a href="${blob.url}" target="_blank" style="display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
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
      console.error('⚠️ [UPLOAD-VIDEO] Errore post chatter (video comunque salvato):', chatterError.message);
      // Video is saved even if chatter post fails
    }

    return NextResponse.json({
      success: true,
      blob_url: blob.url,
      duration: durationFormatted,
      size_mb: (videoFile.size / 1024 / 1024).toFixed(2)
    });

  } catch (error: any) {
    console.error('❌ [UPLOAD-VIDEO] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore upload video' },
      { status: 500 }
    );
  }
}
