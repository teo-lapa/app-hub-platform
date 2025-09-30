import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Task definitions for Stella actions
const STELLA_TASKS = [
  {
    id: 'order',
    name: 'Voglio Fare un Ordine',
    description: `Prompt per Stella quando il cliente vuole fare un ordine:

Ciao! Sono Stella e ti aiuterò a fare il tuo ordine.

COSA DEVI FARE:
1. Chiedi che tipo di prodotti sta cercando
2. Cerca nel catalogo Odoo con search_read sui prodotti
3. Mostra i prodotti disponibili con prezzi e disponibilità
4. Gestisci le quantità richieste
5. Crea una bozza di ordine di vendita
6. Conferma tutti i dettagli prima di finalizzare

TONO: Professionale, utile, orientato alle vendite
OBIETTIVO: Completare l'ordine del cliente con successo`
  },
  {
    id: 'complaint',
    name: 'Lamentele',
    description: `Prompt per Stella quando il cliente ha una lamentela:

Ciao! Mi dispiace per il disagio. Sono qui per aiutarti a risolvere il problema.

COSA DEVI FARE:
1. Ascolta il problema con empatia
2. Raccogli tutti i dettagli: quando, dove, cosa è successo
3. Chiedi numero ordine se applicabile
4. Classifica il tipo di problema
5. Proponi soluzioni immediate se possibile
6. Crea un ticket di supporto se necessario
7. Rassicura il cliente sui tempi di risoluzione

TONO: Empatico, professionale, orientato alla risoluzione
OBIETTIVO: Risolvere il problema e mantenere il cliente soddisfatto`
  },
  {
    id: 'search',
    name: 'Ricerca Prodotto',
    description: `Prompt per Stella quando il cliente cerca prodotti:

Ciao! Sono Stella e ti aiuterò a trovare quello che cerchi.

COSA DEVI FARE:
1. Chiedi specifiche del prodotto (nome, tipo, caratteristiche)
2. Usa search_read per cercare prodotti in Odoo
3. Filtra per disponibilità e categoria
4. Mostra risultati con: nome, prezzo, disponibilità, descrizione
5. Suggerisci prodotti alternativi se necessario
6. Fornisci dettagli tecnici se richiesti
7. Proponi di procedere con l'ordine se interessato

TONO: Esperto, utile, orientato alla consulenza
OBIETTIVO: Aiutare il cliente a trovare il prodotto perfetto`
  },
  {
    id: 'intervention',
    name: 'Richiesta di Intervento',
    description: `Prompt per Stella quando il cliente richiede un intervento tecnico:

Ciao! Sono qui per organizzare il tuo intervento tecnico.

COSA DEVI FARE:
1. Identifica il tipo di problema tecnico
2. Raccogli informazioni su: ubicazione, urgenza, orari preferiti
3. Verifica disponibilità tecnici nella zona
4. Classifica l'intervento (manutenzione, riparazione, installazione)
5. Proponi date e orari disponibili
6. Conferma i dettagli dell'appuntamento
7. Crea il task di intervento in Odoo con tutti i dettagli

TONO: Tecnico ma accessibile, efficiente, organizzato
OBIETTIVO: Programmare l'intervento nel minor tempo possibile`
  },
  {
    id: 'other',
    name: 'Altre Richieste',
    description: `Prompt per Stella per richieste generiche:

Ciao! Sono Stella, il tuo assistente personale. Dimmi pure di cosa hai bisogno!

COSA DEVI FARE:
1. Ascolta attentamente la richiesta
2. Classifica il tipo di richiesta
3. Se è correlata ai nostri servizi, fornisci informazioni dettagliate
4. Se serve supporto tecnico, indirizza verso l'intervento
5. Per info prodotti, indirizza verso la ricerca
6. Per problemi, gestisci come reclamo
7. Sii sempre utile e cordiale

TONO: Amichevole, versatile, sempre disponibile
OBIETTIVO: Assistere il cliente in qualsiasi sua necessità`
  }
];

// Create Stella tasks in Odoo project 108
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Creazione task Stella in progetto 108...');

    const results = [];

    for (const task of STELLA_TASKS) {
      try {
        // Create task in Odoo project 108
        const odooResponse = await fetch(`${request.nextUrl.origin}/api/odoo/rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'project.task',
            method: 'create',
            args: [{
              name: task.name,
              description: task.description,
              project_id: 108, // Project ID 108
              tag_ids: [[6, 0, []]], // Empty tags for now
              priority: '1', // Normal priority
            }],
            kwargs: {}
          })
        });

        if (odooResponse.ok) {
          const data = await odooResponse.json();
          if (data.result) {
            results.push({
              action_id: task.id,
              task_id: data.result,
              name: task.name,
              success: true
            });
            console.log(`✅ Task creato: ${task.name} (ID: ${data.result})`);
          } else {
            results.push({
              action_id: task.id,
              name: task.name,
              success: false,
              error: 'Nessun risultato da Odoo'
            });
          }
        } else {
          const errorData = await odooResponse.json();
          results.push({
            action_id: task.id,
            name: task.name,
            success: false,
            error: errorData.error || `HTTP ${odooResponse.status}`
          });
        }

      } catch (taskError) {
        console.error(`❌ Errore creazione task ${task.name}:`, taskError);
        results.push({
          action_id: task.id,
          name: task.name,
          success: false,
          error: taskError instanceof Error ? taskError.message : 'Errore sconosciuto'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Task creati: ${successCount}/${STELLA_TASKS.length}`);

    return NextResponse.json({
      success: successCount > 0,
      message: `Creati ${successCount} task su ${STELLA_TASKS.length}`,
      results
    });

  } catch (error) {
    console.error('❌ Errore generale creazione task:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella creazione dei task',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}

// Get Stella task prompts from Odoo
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const actionId = searchParams.get('action_id');

    if (!actionId) {
      return NextResponse.json({
        success: false,
        error: 'action_id parameter required'
      }, { status: 400 });
    }

    // Search for task by name in project 108
    const taskName = STELLA_TASKS.find(t => t.id === actionId)?.name;
    if (!taskName) {
      return NextResponse.json({
        success: false,
        error: 'Action ID non valido'
      }, { status: 400 });
    }

    const odooResponse = await fetch(`${request.nextUrl.origin}/api/odoo/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'project.task',
        method: 'search_read',
        args: [
          [
            ['project_id', '=', 108],
            ['name', '=', taskName]
          ],
          ['id', 'name', 'description', 'stage_id', 'priority']
        ],
        kwargs: { limit: 1 }
      })
    });

    if (!odooResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Errore ricerca task in Odoo'
      }, { status: 500 });
    }

    const data = await odooResponse.json();

    if (data.result && data.result.length > 0) {
      const task = data.result[0];
      return NextResponse.json({
        success: true,
        task_id: task.id,
        prompt: task.description || `Ciao! Come posso aiutarti con: ${task.name}`,
        task_name: task.name,
        stage: task.stage_id?.[1] || 'Unknown',
        priority: task.priority || '1'
      });
    } else {
      // Fallback to default prompts
      const defaultTask = STELLA_TASKS.find(t => t.id === actionId);
      return NextResponse.json({
        success: true,
        task_id: null,
        prompt: defaultTask?.description || 'Ciao! Come posso aiutarti?',
        task_name: defaultTask?.name || 'Richiesta generica',
        stage: 'Default',
        priority: '1',
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ Errore ricerca prompt:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella ricerca del prompt'
    }, { status: 500 });
  }
}