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
    const { vehicle_id, issue_id, resolved_date } = body;

    if (!vehicle_id || !issue_id) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    console.log('✅ [VEHICLE-CHECK] Risoluzione problema:', { vehicle_id, issue_id });

    // 1. Search dell'ultimo VEHICLE_CHECK_DATA nel chatter
    const messages = await callOdoo(
      cookies,
      'mail.message',
      'search_read',
      [],
      {
        domain: [
          ['model', '=', 'fleet.vehicle'],
          ['res_id', '=', vehicle_id],
          ['body', 'ilike', 'VEHICLE_CHECK_DATA']
        ],
        fields: ['id', 'body', 'date', 'subject'],
        order: 'date DESC',
        limit: 1
      }
    );

    if (messages.length === 0) {
      console.error('❌ [VEHICLE-CHECK] Nessun controllo trovato nel chatter');
      return NextResponse.json(
        { error: 'Nessun controllo veicolo trovato' },
        { status: 404 }
      );
    }

    const lastMessage = messages[0];
    console.log('✅ [VEHICLE-CHECK] Ultimo controllo trovato, ID:', lastMessage.id);

    // 2. Parsare il JSON
    let checkData;
    try {
      const body = lastMessage.body;
      const jsonMatch = body.match(/VEHICLE_CHECK_DATA:([\s\S]*?)(?:<\/|$)/);

      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('JSON non trovato nel body del messaggio');
      }

      checkData = JSON.parse(jsonMatch[1].trim());
      console.log('✅ [VEHICLE-CHECK] JSON parsato correttamente');
    } catch (parseError: any) {
      console.error('❌ [VEHICLE-CHECK] Errore parsing JSON:', parseError);
      return NextResponse.json(
        { error: 'Errore parsing dati controllo veicolo' },
        { status: 500 }
      );
    }

    // 3. Trovare l'issue e settare resolved: true, resolved_date
    // issue_id format: "category_id_item_id"
    const [categoryId, itemId] = issue_id.split('_');

    let issueFound = false;
    let itemLabel = '';
    let categoryName = '';

    if (checkData.categories) {
      for (const category of checkData.categories) {
        if (category.id === categoryId) {
          categoryName = category.name;

          if (category.items) {
            for (const item of category.items) {
              if (item.id === itemId) {
                item.resolved = true;
                item.resolved_date = resolved_date || new Date().toISOString();
                itemLabel = item.label;
                issueFound = true;
                console.log('✅ [VEHICLE-CHECK] Problema risolto:', itemLabel);
                break;
              }
            }
          }
        }

        if (issueFound) break;
      }
    }

    if (!issueFound) {
      console.error('❌ [VEHICLE-CHECK] Problema non trovato:', issue_id);
      return NextResponse.json(
        { error: 'Problema non trovato nel controllo' },
        { status: 404 }
      );
    }

    // 4. Rigenerare HTML summary con dati aggiornati
    let updatedHtml = '<h3>🚗 Controllo Veicolo (Aggiornato)</h3>';
    updatedHtml += `<strong>Data:</strong> ${new Date(checkData.check_date).toLocaleString('it-IT')}<br/>`;
    updatedHtml += `<strong>Autista:</strong> ${checkData.driver_name}<br/>`;
    updatedHtml += `<strong>Chilometraggio:</strong> ${checkData.odometer || 'N/D'} km<br/>`;
    updatedHtml += '<br/>';

    // Summary delle categorie
    let totalIssues = 0;
    let totalOk = 0;
    let totalResolved = 0;

    if (checkData.categories) {
      updatedHtml += '<h4>📋 Risultati Controllo:</h4>';
      updatedHtml += '<ul>';

      for (const category of checkData.categories) {
        const categoryIssues = category.items.filter((item: any) =>
          item.status === 'issue' && !item.resolved
        ).length;
        const categoryResolved = category.items.filter((item: any) =>
          item.status === 'issue' && item.resolved
        ).length;
        const categoryOk = category.items.filter((item: any) => item.status === 'ok').length;

        totalIssues += categoryIssues;
        totalOk += categoryOk;
        totalResolved += categoryResolved;

        if (categoryIssues > 0 || categoryResolved > 0) {
          updatedHtml += `<li><strong>${category.name}:</strong> `;
          if (categoryIssues > 0) {
            updatedHtml += `⚠️ ${categoryIssues} problema/i, `;
          }
          if (categoryResolved > 0) {
            updatedHtml += `✅ ${categoryResolved} risolto/i, `;
          }
          updatedHtml += `${categoryOk} ok</li>`;
        } else {
          updatedHtml += `<li><strong>${category.name}:</strong> ✅ Tutto ok (${categoryOk})</li>`;
        }
      }

      updatedHtml += '</ul>';
    }

    // Problemi ancora aperti
    if (totalIssues > 0) {
      updatedHtml += '<br/><h4>⚠️ Problemi Aperti:</h4>';
      updatedHtml += '<ul>';

      for (const category of checkData.categories) {
        for (const item of category.items) {
          if (item.status === 'issue' && !item.resolved) {
            updatedHtml += `<li><strong>${item.label}</strong>`;
            if (item.note) {
              updatedHtml += ` - ${item.note}`;
            }
            updatedHtml += '</li>';
          }
        }
      }

      updatedHtml += '</ul>';
    }

    // Problemi risolti
    if (totalResolved > 0) {
      updatedHtml += '<br/><h4>✅ Problemi Risolti:</h4>';
      updatedHtml += '<ul>';

      for (const category of checkData.categories) {
        for (const item of category.items) {
          if (item.status === 'issue' && item.resolved) {
            updatedHtml += `<li><strong>${item.label}</strong>`;
            if (item.resolved_date) {
              const resolvedDate = new Date(item.resolved_date).toLocaleDateString('it-IT');
              updatedHtml += ` - Risolto il ${resolvedDate}`;
            }
            updatedHtml += '</li>';
          }
        }
      }

      updatedHtml += '</ul>';
    }

    if (totalIssues === 0 && totalResolved === 0) {
      updatedHtml += '<br/><p><strong>✅ Nessun problema rilevato - Veicolo in ottime condizioni!</strong></p>';
    }

    // Note generali
    if (checkData.general_notes) {
      updatedHtml += `<br/><strong>Note:</strong> ${checkData.general_notes}<br/>`;
    }

    // JSON aggiornato
    updatedHtml += '<br/><details><summary>📊 Dati completi controllo (JSON)</summary>';
    updatedHtml += `<pre>VEHICLE_CHECK_DATA:${JSON.stringify(checkData, null, 2)}</pre>`;
    updatedHtml += '</details>';

    // 5. Aggiorna il messaggio esistente nel chatter con i dati aggiornati
    await callOdoo(cookies, 'mail.message', 'write', [
      [lastMessage.id],
      { body: updatedHtml }
    ]);

    console.log('✅ [VEHICLE-CHECK] Messaggio chatter aggiornato, ID:', lastMessage.id);

    // 6. Posta nuovo messaggio di notifica risoluzione
    const notificationHtml = `<p><strong>✅ Problema risolto: ${itemLabel}</strong></p>` +
      `<p><strong>Categoria:</strong> ${categoryName}<br/>` +
      `<strong>Data risoluzione:</strong> ${new Date(resolved_date || new Date()).toLocaleString('it-IT')}</p>`;

    await callOdoo(cookies, 'mail.message', 'create', [{
      body: notificationHtml,
      model: 'fleet.vehicle',
      res_id: vehicle_id,
      message_type: 'comment',
      subtype_id: 1
    }]);

    console.log('✅ [VEHICLE-CHECK] Notifica risoluzione postata');

    return NextResponse.json({
      success: true,
      resolved_issue: {
        category: categoryName,
        item: itemLabel,
        resolved_date: resolved_date || new Date().toISOString()
      },
      summary: {
        total_issues: totalIssues,
        total_resolved: totalResolved,
        total_ok: totalOk
      }
    });

  } catch (error: any) {
    console.error('❌ [VEHICLE-CHECK] Errore risoluzione problema:', error);
    console.error('❌ Stack trace:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Errore risoluzione problema' },
      { status: 500 }
    );
  }
}
