import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@vercel/postgres';

// ✅ SALVA IN DUE POSTI:
// 1. Odoo (task/ticket) - usando credenziali ADMIN
// 2. Database Vercel (maestro_conversations) - per storico chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lastMessage, actionType, actionTitle, userEmail } = body;

    if (!lastMessage) {
      return NextResponse.json({
        success: false,
        error: 'Nessun messaggio da salvare'
      }, { status: 400 });
    }

    console.log('💾 Richiesta salvataggio ultimo messaggio Stella');
    console.log('📧 Cliente:', userEmail);
    console.log('🎯 Azione:', actionTitle);
    console.log('💬 Ultimo messaggio:', lastMessage.text?.substring(0, 50) + '...');

    // 1. AUTENTICAZIONE ADMIN SU ODOO
    const odooUrl = process.env.ODOO_URL;
    const odooDb = process.env.ODOO_DB;
    const odooUsername = process.env.ODOO_ADMIN_EMAIL?.trim();
    const odooPassword = process.env.ODOO_ADMIN_PASSWORD?.trim();

    if (!odooUrl || !odooDb || !odooUsername || !odooPassword) {
      console.error('❌ Credenziali Odoo mancanti nel server');
      console.error('❌ ODOO_URL:', !!odooUrl);
      console.error('❌ ODOO_DB:', !!odooDb);
      console.error('❌ ODOO_ADMIN_EMAIL:', !!odooUsername);
      console.error('❌ ODOO_ADMIN_PASSWORD:', !!odooPassword);
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

    // 3. FORMATTA L'ULTIMO MESSAGGIO
    const sender = lastMessage.isUser ? '👤 Cliente' : '🌟 Stella';
    const time = new Date(lastMessage.timestamp).toLocaleTimeString('it-IT');
    const newMessageText = `[${time}] ${sender}: ${lastMessage.text}`;

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

    let taskId: number;

    if (existingTaskId) {
      // AGGIORNA IL TASK ESISTENTE aggiungendo solo il nuovo messaggio
      console.log('📝 Aggiorno task esistente con nuovo messaggio...');

      const updatedDescription = existingDescription + '\n' + newMessageText;

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
      // CREA NUOVO TASK con il primo messaggio
      const now = new Date();
      const taskName = `Conversazioni Stella - ${now.toLocaleDateString('it-IT')} - ${userEmail || 'Cliente sconosciuto'}`;
      const taskDescription = `📅 Data: ${now.toLocaleDateString('it-IT')}
📧 Cliente: ${userEmail || 'Non specificato'}
🎯 Azione: ${actionTitle}

=== CONVERSAZIONE ===
${newMessageText}

---
✅ Task creato automaticamente dal sistema Stella Assistant`;

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

    // 5. SALVA ANCHE NEL DATABASE VERCEL
    let conversationId: number | null = null;
    try {
      console.log('💾 Salvataggio anche nel database Vercel...');

      const userId = userEmail || 'guest';
      const today = new Date().toISOString().split('T')[0];

      // Cerca conversazione esistente per oggi
      const existingConv = await sql`
        SELECT id FROM maestro_conversations
        WHERE user_id = ${userId}
        AND DATE(created_at AT TIME ZONE 'Europe/Rome') = ${today}
        LIMIT 1
      `;

      if (existingConv.rows.length > 0) {
        conversationId = existingConv.rows[0].id;
        console.log('✅ Conversazione esistente trovata - ID:', conversationId);
      } else {
        // Crea nuova conversazione
        const newConv = await sql`
          INSERT INTO maestro_conversations (user_id, title, context)
          VALUES (${userId}, ${actionTitle}, ${JSON.stringify({ actionType, userEmail })})
          RETURNING id
        `;
        conversationId = newConv.rows[0].id;
        console.log('✅ Nuova conversazione creata - ID:', conversationId);
      }

      // Salva il messaggio
      await sql`
        INSERT INTO maestro_interactions (conversation_id, user_id, role, content, metadata)
        VALUES (
          ${conversationId},
          ${userId},
          ${lastMessage.isUser ? 'user' : 'assistant'},
          ${lastMessage.text},
          ${JSON.stringify({ timestamp: lastMessage.timestamp, taskId })}
        )
      `;

      console.log('✅ Messaggio salvato nel database Vercel');

    } catch (dbError) {
      console.error('⚠️ Errore salvataggio database (Odoo OK):', dbError);
      // Non blocchiamo se Odoo è andato bene
    }

    // 6. RITORNA SUCCESSO
    return NextResponse.json({
      success: true,
      message: 'Conversazione salvata con successo',
      taskId: taskId,
      taskUrl: `${odooUrl}/web#id=${taskId}&model=project.task&view_type=form`,
      wasUpdated: !!existingTaskId,
      conversationId: conversationId,
      savedToDatabase: !!conversationId
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
