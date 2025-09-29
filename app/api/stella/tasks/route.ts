import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

async function authenticateOdoo() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      },
      id: 1
    })
  });

  const data = await response.json();
  if (data.error || !data.result?.uid) {
    throw new Error('Authentication failed');
  }

  const setCookieHeader = response.headers.get('set-cookie');
  let sessionId = null;
  if (setCookieHeader) {
    const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
    sessionId = sessionMatch ? sessionMatch[1] : null;
  }

  return { uid: data.result.uid, sessionId };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🌟 Creating Stella tasks in Odoo project 108...');

    const { uid, sessionId } = await authenticateOdoo();

    const stellaTasks = [
      {
        name: 'Stella - Conversazione Generale',
        description: 'Prompt per conversazioni generali con Stella',
        action_id: 'general',
        project_id: 108,
        prompt_text: "Sei Stella, un'assistente AI amichevole per LAPA. Rispondi in modo naturale e utile in italiano."
      },
      {
        name: 'Stella - Assistente Magazzino',
        description: 'Prompt per assistenza magazzino e inventario',
        action_id: 'inventory',
        project_id: 108,
        prompt_text: "Sei Stella, esperta di gestione magazzino per LAPA. Aiuta con inventario, scorte, movimentazioni e procedure di magazzino."
      },
      {
        name: 'Stella - Assistente Vendite',
        description: 'Prompt per supporto vendite e clienti',
        action_id: 'sales',
        project_id: 108,
        prompt_text: "Sei Stella, assistente vendite LAPA. Aiuta con ordini, gestione clienti, preventivi e attività commerciali."
      },
      {
        name: 'Stella - Supporto Tecnico',
        description: 'Prompt per supporto e risoluzione problemi',
        action_id: 'support',
        project_id: 108,
        prompt_text: "Sei Stella, supporto tecnico LAPA. Risolvi problemi, fornisci assistenza tecnica e guida troubleshooting."
      },
      {
        name: 'Stella - Formazione Team',
        description: 'Prompt per formazione e training aziendale',
        action_id: 'training',
        project_id: 108,
        prompt_text: "Sei Stella, formatrice aziendale LAPA. Aiuta con formazione, procedure aziendali e training del personale."
      }
    ];

    const createdTasks = [];

    for (const task of stellaTasks) {
      const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'project.task',
            method: 'create',
            args: [task],
            kwargs: {}
          },
          id: Math.random()
        })
      });

      const data = await response.json();
      if (data.result) {
        createdTasks.push({ id: data.result, ...task });
        console.log(`✅ Created task: ${task.name} (ID: ${data.result})`);
      } else {
        console.error(`❌ Failed to create task: ${task.name}`, data.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdTasks.length} Stella tasks in project 108`,
      tasks: createdTasks
    });

  } catch (error: any) {
    console.error('❌ Error creating Stella tasks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create tasks',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const actionId = url.searchParams.get('action_id');

    const { uid, sessionId } = await authenticateOdoo();

    // Build domain filter
    let domain = [['project_id', '=', 108]];
    if (actionId) {
      domain.push(['action_id', '=', actionId]);
    }

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'project.task',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: ['id', 'name', 'description', 'action_id', 'prompt_text'],
            order: 'name ASC'
          }
        },
        id: Math.random()
      })
    });

    const data = await response.json();

    if (data.result && Array.isArray(data.result)) {
      if (actionId && data.result.length > 0) {
        // Return specific prompt for action_id
        return NextResponse.json({
          success: true,
          prompt: data.result[0].prompt_text,
          task: data.result[0]
        });
      } else {
        // Return all tasks
        return NextResponse.json({
          success: true,
          tasks: data.result
        });
      }
    }

    return NextResponse.json({
      success: true,
      tasks: [],
      prompt: null
    });

  } catch (error: any) {
    console.error('❌ Error fetching Stella tasks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tasks',
      details: error.message
    }, { status: 500 });
  }
}