import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ✅ CREA TICKET IN ODOO USANDO CREDENZIALI ADMIN (NON IL CLIENTE)
// Il cliente NON ha permessi per creare task, quindi usiamo le credenziali server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, actionType, actionTitle, userEmail } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun messaggio da salvare'
      }, { status: 400 });
    }

    console.log('💾 Richiesta salvataggio conversazione Stella');
    console.log('📧 Cliente:', userEmail);
    console.log('🎯 Azione:', actionTitle);
    console.log('💬 Messaggi:', messages.length);

    // 1. AUTENTICAZIONE ADMIN SU ODOO
    const odooUrl = process.env.ODOO_URL;
    const odooDb = process.env.ODOO_DB;
    const odooUsername = process.env.ODOO_USERNAME;
    const odooPassword = process.env.ODOO_PASSWORD;

    if (!odooUrl || !odooDb || !odooUsername || !odooPassword) {
      console.error('❌ Credenziali Odoo mancanti nel server');
      return NextResponse.json({
        success: false,
        error: 'Configurazione server non completa'
      }, { status: 500 });
    }

    console.log('🔐 Autenticazione ADMIN su Odoo:', odooUsername);

    // Login come ADMIN
    console.log('📡 Chiamata a:', `${odooUrl}/web/session/authenticate`);

    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        params: {
          db: odooDb,
          login: odooUsername,
          password: odooPassword,
        }
      })
    });

    console.log('📡 Risposta status:', authResponse.status);

    // Estrai il session_id dal cookie Set-Cookie
    const setCookieHeader = authResponse.headers.get('set-cookie');
    let sessionId = null;

    if (setCookieHeader) {
      const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
      if (sessionMatch) {
        sessionId = sessionMatch[1];
        console.log('🍪 Session ID estratto dal cookie:', sessionId.substring(0, 20) + '...');
      }
    }

    const authData = await authResponse.json();
    console.log('📋 Dati autenticazione:', JSON.stringify(authData).substring(0, 200));

    if (authData.error || !authData.result || !authData.result.uid) {
      console.error('❌ Errore autenticazione admin Odoo:', authData.error || 'Nessun UID ricevuto');
      console.error('❌ Risposta completa:', JSON.stringify(authData));
      return NextResponse.json({
        success: false,
        error: 'Errore autenticazione Odoo',
        details: authData.error?.data?.message || 'Login fallito'
      }, { status: 500 });
    }

    const adminUid = authData.result.uid;

    if (!sessionId) {
      console.error('❌ Session ID non trovato nei cookie');
      return NextResponse.json({
        success: false,
        error: 'Session ID non trovato'
      }, { status: 500 });
    }

    console.log('✅ Admin autenticato - UID:', adminUid);

    // 2. CERCA IL CLIENTE (RES.PARTNER) DAL SUO EMAIL
    let partnerId = null;

    if (userEmail) {
      console.log('🔍 Ricerca cliente con email:', userEmail);

      const searchPartnerResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          params: {
            model: 'res.partner',
            method: 'search_read',
            args: [
              [['email', '=', userEmail]],
              ['id', 'name']
            ],
            kwargs: {}
          }
        })
      });

      const partnerData = await searchPartnerResponse.json();

      if (partnerData.result && partnerData.result.length > 0) {
        partnerId = partnerData.result[0].id;
        console.log('✅ Cliente trovato - ID:', partnerId, 'Nome:', partnerData.result[0].name);
      } else {
        console.log('⚠️ Cliente non trovato con email:', userEmail);
      }
    }

    // 3. FORMATTA LA CONVERSAZIONE PER IL TICKET
    const conversationText = messages
      .filter((msg: any) => !msg.isSystemPrompt) // Escludi prompt sistema
      .map((msg: any) => {
        const sender = msg.isUser ? '👤 Cliente' : '🌟 Stella';
        const time = new Date(msg.timestamp).toLocaleTimeString('it-IT');
        return `[${time}] ${sender}: ${msg.text}`;
      })
      .join('\n\n');

    // 4. CERCA SE ESISTE GIÀ UN TASK DI OGGI PER QUESTO CLIENTE
    const projectId = 108; // ID del progetto "Stella - Assistenza Clienti"
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('🔍 Cerco task esistente per oggi:', today, '- Cliente ID:', partnerId);

    let existingTaskId = null;
    let existingDescription = '';

    // Cerca task creati oggi per questo cliente
    const searchTaskResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        params: {
          model: 'project.task',
          method: 'search_read',
          args: [
            [
              ['project_id', '=', projectId],
              ['partner_id', '=', partnerId || false],
              ['create_date', '>=', today + ' 00:00:00'],
              ['create_date', '<=', today + ' 23:59:59']
            ],
            ['id', 'name', 'description']
          ],
          kwargs: {}
        }
      })
    });

    const searchTaskData = await searchTaskResponse.json();

    if (searchTaskData.result && searchTaskData.result.length > 0) {
      existingTaskId = searchTaskData.result[0].id;
      existingDescription = searchTaskData.result[0].description || '';
      console.log('✅ Task esistente trovato - ID:', existingTaskId);
    } else {
      console.log('📝 Nessun task trovato per oggi, ne creo uno nuovo');
    }

    // Formatta la nuova conversazione da aggiungere
    const now = new Date();
    const conversationEntry = `
=== CONVERSAZIONE #${existingTaskId ? 'AGGIUNTA' : '1'} - ${now.toLocaleTimeString('it-IT')} ===

🎯 Azione: ${actionTitle}
💬 Messaggi: ${messages.filter((m: any) => !m.isSystemPrompt).length}

${conversationText}

---
`;

    let taskId: number;

    if (existingTaskId) {
      // AGGIORNA IL TASK ESISTENTE
      console.log('📝 Aggiorno task esistente con nuova conversazione...');

      const updatedDescription = existingDescription + '\n\n' + conversationEntry;

      const updateTaskResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          params: {
            model: 'project.task',
            method: 'write',
            args: [
              [existingTaskId],
              {
                description: updatedDescription
              }
            ],
            kwargs: {}
          }
        })
      });

      const updateData = await updateTaskResponse.json();

      if (updateData.error) {
        console.error('❌ Errore aggiornamento task:', updateData.error);
        return NextResponse.json({
          success: false,
          error: 'Errore aggiornamento task in Odoo',
          details: updateData.error.data?.message || updateData.error.message
        }, { status: 500 });
      }

      taskId = existingTaskId;
      console.log('✅ Task aggiornato con successo - ID:', taskId);

    } else {
      // CREA NUOVO TASK
      const taskName = `Conversazioni Stella - ${now.toLocaleDateString('it-IT')} - ${userEmail || 'Cliente sconosciuto'}`;
      const taskDescription = `
📅 Data: ${now.toLocaleDateString('it-IT')}
📧 Cliente: ${userEmail || 'Non specificato'}

${conversationEntry}

✅ Task creato automaticamente dal sistema Stella Assistant
      `.trim();

      console.log('📝 Creazione nuovo task in Odoo...');
      console.log('   Progetto ID:', projectId);
      console.log('   Nome task:', taskName);
      console.log('   Partner ID:', partnerId || 'N/D');

      console.log('📡 Invio richiesta creazione task...');
      const createTaskResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          params: {
            model: 'project.task',
            method: 'create',
            args: [{
              name: taskName,
              project_id: projectId,
              description: taskDescription,
              partner_id: partnerId, // Collega al cliente se trovato
              priority: '1', // Normale
              tag_ids: [[6, 0, []]] // Puoi aggiungere tag se vuoi
            }],
            kwargs: {}
          }
        })
      });

      console.log('📡 Risposta ricevuta, status:', createTaskResponse.status);
      const taskData = await createTaskResponse.json();
      console.log('📋 Dati task:', JSON.stringify(taskData).substring(0, 300));

      if (taskData.error) {
        console.error('❌ Errore creazione task Odoo:', taskData.error);
        return NextResponse.json({
          success: false,
          error: 'Errore creazione ticket in Odoo',
          details: taskData.error.data?.message || taskData.error.message
        }, { status: 500 });
      }

      taskId = taskData.result;

      console.log('✅ Task creato con successo - ID:', taskId);
    }

    // 5. RITORNA SUCCESSO
    return NextResponse.json({
      success: true,
      message: 'Conversazione salvata con successo',
      taskId: taskId,
      taskUrl: `${odooUrl}/web#id=${taskId}&model=project.task&view_type=form`,
      wasUpdated: !!existingTaskId
    });

  } catch (error) {
    console.error('❌ Errore salvataggio conversazione:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}
