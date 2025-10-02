import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// WebSocket proxy endpoint for OpenAI Real-Time API
export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
    return NextResponse.json({
      error: 'OpenAI API key not configured'
    }, { status: 500 });
  }

  // This endpoint provides connection details for the frontend
  return NextResponse.json({
    success: true,
    websocket_url: 'wss://api.openai.com/v1/realtime',
    model: 'gpt-4o-realtime-preview-2024-10-01',
    instructions: 'Stella Real-Time API endpoint ready'
  });
}

export async function POST(request: NextRequest) {
  try {
    const { action, userContext, taskId } = await request.json();

    // Check API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured'
      }, { status: 500 });
    }

    // Get user data from Odoo if needed
    let userData = null;
    let companyData = null;
    if (userContext?.email) {
      try {
        // Step 1: Get the logged-in partner (could be company or contact)
        const odooResponse = await fetch(`${request.nextUrl.origin}/api/odoo/rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'res.partner',
            method: 'search_read',
            args: [
              [['email', '=', userContext.email]],
              ['id', 'name', 'phone', 'mobile', 'email', 'parent_id', 'is_company', 'total_invoiced', 'street', 'city', 'vat', 'ref']
            ],
            kwargs: { limit: 1 }
          })
        });

        if (odooResponse.ok) {
          const data = await odooResponse.json();
          userData = data.result?.[0] || null;

          // Step 2: If user is a contact (has parent_id), load the company data
          if (userData && userData.parent_id && userData.parent_id[0]) {
            console.log(`👤 Contatto rilevato: ${userData.name} - Carico dati azienda padre ID: ${userData.parent_id[0]}`);

            const companyResponse = await fetch(`${request.nextUrl.origin}/api/odoo/rpc`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'res.partner',
                method: 'read',
                args: [
                  [userData.parent_id[0]],
                  ['name', 'phone', 'email', 'total_invoiced', 'street', 'city', 'vat', 'ref']
                ]
              })
            });

            if (companyResponse.ok) {
              const companyDataResponse = await companyResponse.json();
              companyData = companyDataResponse.result?.[0] || null;
              console.log(`🏢 Dati azienda padre caricati: ${companyData?.name}`);
            }
          } else {
            console.log(`🏢 Azienda principale rilevata: ${userData?.name}`);
            // If user is the company itself, use userData as companyData
            companyData = userData;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch user data from Odoo:', error);
      }
    }

    // Build system instructions for Stella based on context
    let instructions = `Sei Stella, assistente vocale AI di LAPA. Parli in italiano con un tono cordiale e professionale.

IMPORTANTE: Questa è una conversazione VOCALE in tempo reale. Parla come se fossi al telefono con il cliente.

PROFILO UTENTE:`;

    if (userData) {
      // Check if user is a contact (has parent company) or the company itself
      const isContact = userData.parent_id && userData.parent_id[0];

      instructions += `
- Nome contatto: ${userData.name}
- Email: ${userData.email}
- Telefono: ${userData.phone || userData.mobile || 'non disponibile'}`;

      if (isContact && companyData) {
        instructions += `
- Tipo: Contatto di azienda
- AZIENDA: ${companyData.name}
- P.IVA Azienda: ${companyData.vat || 'non disponibile'}
- Codice Cliente: ${companyData.ref || 'non disponibile'}
- Fatturato totale azienda: €${companyData.total_invoiced?.toFixed(2) || '0.00'}
- Indirizzo azienda: ${companyData.street || 'non disponibile'}${companyData.city ? `, ${companyData.city}` : ''}

IMPORTANTE: Quando parli, saluta ${userData.name} per nome, ma fai riferimento ai dati dell'azienda "${companyData.name}" per ordini, fatturato e informazioni commerciali.`;
      } else {
        instructions += `
- Tipo: Azienda principale
- Azienda: ${userData.name}
- P.IVA: ${userData.vat || 'non disponibile'}
- Codice Cliente: ${userData.ref || 'non disponibile'}
- Fatturato totale: €${userData.total_invoiced?.toFixed(2) || '0.00'}
- Indirizzo: ${userData.street || 'non disponibile'}${userData.city ? `, ${userData.city}` : ''}`;
      }
    } else {
      instructions += `
- Utente non identificato o guest`;
    }

    // Add action-specific context from Odoo tasks
    if (action && action.id) {
      try {
        // Carica prompt dal task Odoo
        const taskResponse = await fetch(`${request.nextUrl.origin}/api/stella/tasks?action_id=${action.id}`);

        if (taskResponse.ok) {
          const taskData = await taskResponse.json();
          if (taskData.success && taskData.prompt) {
            console.log(`✅ Prompt vocale caricato da task Odoo: ${taskData.task_name}`);
            instructions += `

ISTRUZIONI SPECIFICHE PER ${taskData.task_name.toUpperCase()}:
${taskData.prompt}

- Task ID Odoo: ${taskData.task_id || 'N/A'}
- Progetto: 108`;
          } else {
            console.log(`⚠️ Fallback a prompt statico per azione: ${action.id}`);
            // Fallback agli switch case originali se il task non è trovato
            instructions += `

CONTESTO ${action.title?.toUpperCase()}:
- Task ID: ${taskId || '108'}`;
          }
        }
      } catch (error) {
        console.warn('Errore caricamento prompt da task Odoo:', error);
        // Fallback silenzioso
        instructions += `

CONTESTO ${action.title?.toUpperCase()}:
- Task ID: ${taskId || '108'}`;
      }
    }

    instructions += `

STILE CONVERSAZIONE:
- Saluta sempre calorosamente chiamando per nome
- Parla come se fosse una telefonata
- Sii concisa ma completa
- Conferma sempre quello che hai capito
- Chiedi chiarimenti se qualcosa non è chiaro
- Mantieni un tono umano e naturale`;

    // Create ephemeral token for secure Real-Time API access
    // This token is temporary and can be safely sent to the client
    let ephemeralToken = null;
    try {
      const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy'
        })
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        ephemeralToken = tokenData.client_secret?.value;
        console.log('✅ Ephemeral token created for secure Real-Time connection');
      } else {
        console.error('❌ Failed to create ephemeral token:', await tokenResponse.text());
      }
    } catch (error) {
      console.error('❌ Error creating ephemeral token:', error);
    }

    return NextResponse.json({
      success: true,
      instructions,
      userData,
      client_secret: ephemeralToken, // Secure ephemeral token (NOT the API key!)
      voice: 'alloy', // Stella's voice
      temperature: 0.8,
      max_response_output_tokens: 4096
    });

  } catch (error) {
    console.error('❌ Error in Stella Real-Time setup:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup Real-Time session'
    }, { status: 500 });
  }
}