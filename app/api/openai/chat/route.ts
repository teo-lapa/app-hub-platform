import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { message, action, userContext } = await request.json();

    console.log(`🤖 [Stella API] Chat request:`, { message, action, userContext });

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured',
        response: 'Mi dispiace, ma al momento non posso elaborare la tua richiesta perché le mie funzionalità AI non sono ancora configurate. Puoi comunque utilizzare i pulsanti di azione per iniziare una conversazione! 🤖'
      }, { status: 200 });
    }

    // Build system prompt based on action context
    let systemPrompt = `Sei Stella, un'assistente AI femminile, professionale ma amichevole, che lavora per LAPA.
Sei specializzata nell'aiutare clienti e dipendenti con le loro richieste.
Rispondi sempre in italiano in modo cordiale e utile.
Il tuo obiettivo è fornire assistenza eccellente e risolvere i problemi dei clienti.`;

    // Add specific context based on action
    if (action) {
      switch (action.id) {
        case 'order':
          systemPrompt += `\n\nSTAI AIUTANDO CON UN ORDINE:
- Hai accesso al catalogo prodotti LAPA
- Puoi mostrare offerte attive
- Guidare nella selezione prodotti
- Calcolare prezzi e disponibilità
- Finalizzare l'ordine con Odoo`;
          break;
        case 'complaint':
          systemPrompt += `\n\nSTAI GESTENDO UNA LAMENTELA:
- Ascolta con empatia il problema
- Raccogli tutti i dettagli necessari
- Proponi soluzioni concrete
- Escalation se necessario
- Segui il cliente fino alla risoluzione`;
          break;
        case 'search':
          systemPrompt += `\n\nSTAI AIUTANDO NELLA RICERCA PRODOTTI:
- Accesso completo al catalogo LAPA
- Filtri per categoria, prezzo, disponibilità
- Suggerimenti basati su storico cliente
- Informazioni tecniche dettagliate`;
          break;
        case 'intervention':
          systemPrompt += `\n\nSTAI ORGANIZZANDO UN INTERVENTO TECNICO:
- Raccogli dettagli del problema tecnico
- Determina urgenza dell'intervento
- Coordina con il team tecnico
- Programma appuntamento
- Fornisci istruzioni preparatorie`;
          break;
        default:
          systemPrompt += `\n\nASSISTENZA GENERALE:
- Aiuta con qualsiasi richiesta del cliente
- Reindirizza verso servizi specializzati se necessario
- Mantieni sempre un tono professionale e utile`;
      }
    }

    // Add user context if available
    if (userContext?.email) {
      systemPrompt += `\n\nCONTESTO UTENTE:
- Email: ${userContext.email}
- Cliente identificato nel sistema
- Accesso allo storico ordini e preferenze`;
    }

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('❌ OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await openaiResponse.json();
    const stellaResponse = data.choices[0]?.message?.content || 'Mi dispiace, non sono riuscita a elaborare una risposta.';

    console.log(`✅ [Stella API] Response generated successfully`);

    return NextResponse.json({
      success: true,
      response: stellaResponse,
      tokens_used: data.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('❌ Errore Stella Chat API:', error);

    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      response: 'Mi dispiace, ho riscontrato un problema tecnico. Puoi riprovare tra poco o contattare il supporto se il problema persiste. 😅',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}