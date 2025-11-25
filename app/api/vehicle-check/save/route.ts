import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { vehicle_id, check_data, photos } = body;

    if (!vehicle_id || !check_data) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    console.log('🚗 [VEHICLE-CHECK] Salvataggio controllo per veicolo:', vehicle_id);
    console.log('📸 [VEHICLE-CHECK] Numero foto da caricare:', photos?.length || 0);

    const attachmentIds: number[] = [];
    const photoMap = new Map<string, number>();

    // 1. Upload ogni foto come ir.attachment
    if (photos && photos.length > 0) {
      console.log('📸 [VEHICLE-CHECK] Caricamento foto come allegati...');

      for (const photo of photos) {
        const { photo_key, data } = photo;

        if (!photo_key || !data) {
          console.warn('⚠️ [VEHICLE-CHECK] Foto senza photo_key o data, skip');
          continue;
        }

        // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
        const photoBase64 = data.includes(',') ? data.split(',')[1] : data;

        // Create ir.attachment
        const attachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
          name: `Vehicle_Check_${vehicle_id}_${photo_key}_${Date.now()}.jpg`,
          datas: photoBase64,
          res_model: 'fleet.vehicle',
          res_id: vehicle_id,
          mimetype: 'image/jpeg',
          description: `Foto controllo veicolo - ${photo_key}`
        }]);

        attachmentIds.push(attachmentId);
        photoMap.set(photo_key, attachmentId);

        console.log(`✅ [VEHICLE-CHECK] Foto ${photo_key} caricata come allegato ID:`, attachmentId);
      }
    }

    // 2. Aggiornare check_data.categories[].items[].photo_ids con attachment IDs
    const updatedCheckData = JSON.parse(JSON.stringify(check_data)); // Deep copy

    if (updatedCheckData.categories) {
      for (const category of updatedCheckData.categories) {
        if (category.items) {
          for (const item of category.items) {
            if (item.photos && item.photos.length > 0) {
              // Map photo_keys to attachment IDs
              item.photo_ids = item.photos
                .map((photoKey: string) => photoMap.get(photoKey))
                .filter((id: number | undefined) => id !== undefined);

              console.log(`✅ [VEHICLE-CHECK] Item ${item.id}: ${item.photo_ids.length} foto mappate`);
            }
          }
        }
      }
    }

    // 3. Genera HTML summary per chatter
    let messageHtml = '<h3>🚗 Controllo Veicolo</h3>';
    messageHtml += `<strong>Data:</strong> ${new Date(updatedCheckData.check_date).toLocaleString('it-IT')}<br/>`;
    messageHtml += `<strong>Autista:</strong> ${updatedCheckData.driver_name}<br/>`;
    messageHtml += `<strong>Chilometraggio:</strong> ${updatedCheckData.odometer || 'N/D'} km<br/>`;
    messageHtml += '<br/>';

    // Summary delle categorie
    let totalIssues = 0;
    let totalOk = 0;

    if (updatedCheckData.categories) {
      messageHtml += '<h4>📋 Risultati Controllo:</h4>';
      messageHtml += '<ul>';

      for (const category of updatedCheckData.categories) {
        const categoryIssues = category.items.filter((item: any) => item.status === 'issue').length;
        const categoryOk = category.items.filter((item: any) => item.status === 'ok').length;

        totalIssues += categoryIssues;
        totalOk += categoryOk;

        if (categoryIssues > 0) {
          messageHtml += `<li><strong>${category.name}:</strong> ⚠️ ${categoryIssues} problema/i, ✅ ${categoryOk} ok</li>`;
        } else {
          messageHtml += `<li><strong>${category.name}:</strong> ✅ Tutto ok (${categoryOk})</li>`;
        }
      }

      messageHtml += '</ul>';
    }

    // Riepilogo problemi
    if (totalIssues > 0) {
      messageHtml += '<br/><h4>⚠️ Problemi Rilevati:</h4>';
      messageHtml += '<ul>';

      for (const category of updatedCheckData.categories) {
        for (const item of category.items) {
          if (item.status === 'issue') {
            messageHtml += `<li><strong>${item.label}</strong>`;
            if (item.note) {
              messageHtml += ` - ${item.note}`;
            }
            if (item.photo_ids && item.photo_ids.length > 0) {
              messageHtml += ` (${item.photo_ids.length} foto)`;
            }
            messageHtml += '</li>';
          }
        }
      }

      messageHtml += '</ul>';
    } else {
      messageHtml += '<br/><p><strong>✅ Nessun problema rilevato - Veicolo in ottime condizioni!</strong></p>';
    }

    // Note generali
    if (updatedCheckData.general_notes) {
      messageHtml += `<br/><strong>Note:</strong> ${updatedCheckData.general_notes}<br/>`;
    }

    // 4. Aggiungi JSON completo in details
    messageHtml += '<br/><details><summary>📊 Dati completi controllo (JSON)</summary>';
    messageHtml += `<pre>VEHICLE_CHECK_DATA:${JSON.stringify(updatedCheckData, null, 2)}</pre>`;
    messageHtml += '</details>';

    // 5. Posta nel chatter di fleet.vehicle
    const checkDate = new Date(updatedCheckData.check_date).toLocaleDateString('it-IT');
    const subject = `Controllo Veicolo - ${checkDate}`;

    const messageId = await callOdoo(cookies, 'mail.message', 'create', [{
      subject: subject,
      body: messageHtml,
      model: 'fleet.vehicle',
      res_id: vehicle_id,
      message_type: 'comment',
      subtype_id: 1,
      attachment_ids: attachmentIds.length > 0 ? [[6, false, attachmentIds]] : false
    }]);

    console.log('✅ [VEHICLE-CHECK] Messaggio chatter creato ID:', messageId);
    console.log('✅ [VEHICLE-CHECK] Totale allegati:', attachmentIds.length);
    console.log('✅ [VEHICLE-CHECK] Problemi rilevati:', totalIssues);

    return NextResponse.json({
      success: true,
      check_id: messageId,
      attachment_ids: attachmentIds,
      summary: {
        total_issues: totalIssues,
        total_ok: totalOk,
        photos_uploaded: attachmentIds.length
      }
    });

  } catch (error: any) {
    console.error('❌ [VEHICLE-CHECK] Errore salvataggio:', error);
    console.error('❌ Stack trace:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Errore salvataggio controllo veicolo' },
      { status: 500 }
    );
  }
}
