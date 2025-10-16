import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ParsedProduct {
  article_code?: string;
  description: string;
  quantity: number;
  unit: string;
  lot_number?: string;
  expiry_date?: string;
  variant?: string;
}

interface OdooMoveLine {
  id: number;
  product_id: number[];
  product_name: string;
  product_code: string;
  product_uom_qty: number;
  qty_done: number;
  lot_id: any;
  lot_name: string | false;
  expiry_date: string | false;
  move_id: number[];
  variant_ids: number[];
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, move_lines, parsed_products } = body;

    if (!picking_id || !move_lines || !parsed_products) {
      return NextResponse.json({
        error: 'Parametri mancanti: picking_id, move_lines, parsed_products richiesti'
      }, { status: 400 });
    }

    console.log('🔄 Inizio processamento ricezione ID:', picking_id);
    console.log('📦 Prodotti da fattura:', parsed_products.length);
    console.log('📋 Righe Odoo:', move_lines.length);

    // Usa Claude per fare il matching intelligente tra prodotti fattura e righe Odoo
    const matchingPrompt = `Sei un sistema di matching tra prodotti di fattura e righe di un sistema gestionale.

PRODOTTI DALLA FATTURA:
${JSON.stringify(parsed_products, null, 2)}

RIGHE DEL SISTEMA ODOO:
${JSON.stringify(move_lines, null, 2)}

Il tuo compito è fare il MATCHING PERFETTO tra ogni prodotto della fattura e la corrispondente riga Odoo.

REGOLE IMPORTANTISSIME:
1. Confronta descrizioni, codici articolo, e varianti
2. Le varianti possono essere scritte diversamente (es: "Quadrato, Verde, 250gr" vs "QUADRATO RICOTTA/SPINACI VERDE GR.250")
3. Se un prodotto ha più lotti diversi, DEVI creare righe separate
4. Ogni riga deve avere: move_line_id, quantity, lot_number, expiry_date
5. Se non c'è match, segnalalo come "no_match"

Rispondi SOLO con un JSON array in questo formato esatto:

[
  {
    "move_line_id": 123,
    "invoice_product_index": 0,
    "quantity": 5.0,
    "lot_number": "LOTTO123",
    "expiry_date": "2025-12-31",
    "match_confidence": 0.95,
    "match_reason": "Match esatto su codice articolo e variante",
    "action": "update"
  },
  {
    "move_line_id": 124,
    "invoice_product_index": 0,
    "quantity": 3.0,
    "lot_number": "LOTTO456",
    "expiry_date": "2025-11-30",
    "match_confidence": 0.95,
    "match_reason": "Stesso prodotto, lotto diverso",
    "action": "create_new_line"
  },
  {
    "move_line_id": null,
    "invoice_product_index": 5,
    "quantity": 0,
    "lot_number": null,
    "expiry_date": null,
    "match_confidence": 0.0,
    "match_reason": "Prodotto non trovato in Odoo",
    "action": "no_match"
  }
]

IMPORTANTE:
- Se un prodotto dalla fattura ha QUANTITÀ TOTALE che va distribuita su più lotti, CREA PIÙ RIGHE
- Ogni riga con lotto diverso deve essere una riga separata
- Usa "create_new_line" quando serve aggiungere una nuova riga per lo stesso prodotto ma lotto diverso
- Usa "update" quando aggiorni una riga esistente
- Usa "no_match" quando non trovi corrispondenza

NON aggiungere testo. SOLO il JSON array.`;

    console.log('🤖 Invio a Claude per matching intelligente...');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: matchingPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    console.log('📥 Risposta Claude matching:', responseText.substring(0, 300) + '...');

    let matches;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matches = JSON.parse(jsonMatch[0]);
      } else {
        matches = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('❌ Errore parsing matching:', parseError);
      return NextResponse.json({
        error: 'Errore nel parsing del matching AI',
        details: responseText
      }, { status: 500 });
    }

    console.log('✅ Matches trovati:', matches.length);

    // Traccia le righe Odoo che sono state usate (aggiornate o riferite per creare nuove righe)
    const usedMoveLineIds = new Set<number>();

    // Ora esegui le operazioni su Odoo
    const results = {
      updated: 0,
      created: 0,
      no_match: 0,
      set_to_zero: 0,
      errors: [] as string[],
      details: [] as any[]
    };

    for (const match of matches) {
      try {
        if (match.action === 'no_match') {
          results.no_match++;
          results.details.push({
            action: 'no_match',
            product: parsed_products[match.invoice_product_index],
            reason: match.match_reason
          });
          continue;
        }

        if (match.action === 'update') {
          // Segna questa riga come usata
          usedMoveLineIds.add(match.move_line_id);

          // Aggiorna la riga esistente
          const updateData: any = {
            qty_done: match.quantity
          };

          if (match.lot_number) {
            updateData.lot_name = match.lot_number;
          }

          if (match.expiry_date) {
            // Converti la data in formato datetime per Odoo (YYYY-MM-DD HH:MM:SS)
            updateData.expiration_date = `${match.expiry_date} 00:00:00`;
          }

          // Aggiorna la move line
          await callOdoo(cookies, 'stock.move.line', 'write', [
            [match.move_line_id],
            updateData
          ]);

          // Trova il prodotto per aggiungere il nome nei dettagli
          const moveLine = move_lines.find((ml: OdooMoveLine) => ml.id === match.move_line_id);
          const productName = moveLine ? moveLine.product_name : `Riga ${match.move_line_id}`;

          results.updated++;
          results.details.push({
            action: 'updated',
            move_line_id: match.move_line_id,
            product_name: productName,
            quantity: match.quantity,
            lot: match.lot_number || 'N/A',
            expiry: match.expiry_date || 'N/A'
          });

          console.log(`✅ Aggiornata riga ${match.move_line_id}: qty=${match.quantity}, lotto=${match.lot_number}`);

        } else if (match.action === 'create_new_line') {
          // Segna la riga originale come usata (da cui prendiamo i dati per creare la nuova)
          if (match.move_line_id) {
            usedMoveLineIds.add(match.move_line_id);
          }

          // Crea una nuova riga per lo stesso prodotto ma con lotto diverso
          const originalLine = move_lines.find((ml: OdooMoveLine) => ml.id === match.move_line_id);

          if (!originalLine) {
            results.errors.push(`Riga originale ${match.move_line_id} non trovata`);
            continue;
          }

          const newLineData: any = {
            picking_id: picking_id,
            product_id: originalLine.product_id[0],
            product_uom_id: originalLine.product_uom_id ? originalLine.product_uom_id[0] : false,
            location_id: originalLine.location_id ? originalLine.location_id[0] : false,
            location_dest_id: originalLine.location_dest_id ? originalLine.location_dest_id[0] : false,
            move_id: originalLine.move_id[0],
            product_uom_qty: 0,
            qty_done: match.quantity,
          };

          if (match.lot_number) {
            newLineData.lot_name = match.lot_number;
          }

          if (match.expiry_date) {
            // Converti la data in formato datetime per Odoo (YYYY-MM-DD HH:MM:SS)
            newLineData.expiration_date = `${match.expiry_date} 00:00:00`;
          }

          const newLineId = await callOdoo(cookies, 'stock.move.line', 'create', [newLineData]);

          results.created++;
          results.details.push({
            action: 'created',
            move_line_id: newLineId,
            product_name: originalLine.product_name,
            quantity: match.quantity,
            lot: match.lot_number || 'N/A',
            expiry: match.expiry_date || 'N/A'
          });

          console.log(`✅ Creata nuova riga ${newLineId}: qty=${match.quantity}, lotto=${match.lot_number}`);
        }

      } catch (error: any) {
        console.error('❌ Errore processamento match:', error);
        results.errors.push(`Errore su riga: ${error.message}`);
      }
    }

    // ✨ NUOVA LOGICA: Metti a ZERO tutte le righe Odoo che NON sono state usate
    console.log('🔍 Verifico righe Odoo non utilizzate...');
    for (const moveLine of move_lines) {
      if (!usedMoveLineIds.has(moveLine.id)) {
        try {
          // Questa riga non è stata usata, metti quantità a 0
          await callOdoo(cookies, 'stock.move.line', 'write', [
            [moveLine.id],
            { qty_done: 0 }
          ]);

          results.set_to_zero++;
          results.details.push({
            action: 'set_to_zero',
            move_line_id: moveLine.id,
            product_name: moveLine.product_name,
            quantity: 0,
            lot: 'N/A',
            expiry: 'N/A',
            reason: 'Riga non trovata nella fattura, impostata a zero'
          });

          console.log(`⚠️ Riga ${moveLine.id} (${moveLine.product_name}) impostata a qty_done=0`);
        } catch (error: any) {
          console.error(`❌ Errore impostazione a zero riga ${moveLine.id}:`, error);
          results.errors.push(`Errore impostazione a zero riga ${moveLine.id}: ${error.message}`);
        }
      }
    }

    console.log('📊 Risultati:', results);

    return NextResponse.json({
      success: true,
      picking_id,
      results,
      tokens_used: message.usage
    });

  } catch (error: any) {
    console.error('❌ Errore process-reception:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il processamento della ricezione',
      details: error.toString()
    }, { status: 500 });
  }
}
