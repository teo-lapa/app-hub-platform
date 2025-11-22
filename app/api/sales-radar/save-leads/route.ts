import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

interface GooglePlace {
  place_id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  latitude: number;
  longitude: number;
  google_maps_url?: string;
}

interface SaveLeadsBody {
  places: GooglePlace[];
}

interface SaveResult {
  place_id: string;
  name: string;
  status: 'created' | 'skipped' | 'error';
  lead_id?: number;
  error?: string;
}

/**
 * POST /api/sales-radar/save-leads
 *
 * Salva i risultati di Google Places come Lead in Odoo CRM (crm.lead)
 *
 * Body:
 * - places: Array di oggetti Google Place
 *   - place_id: string (obbligatorio) - Google Place ID
 *   - name: string (obbligatorio) - Nome attivita
 *   - address: string (obbligatorio) - Indirizzo completo
 *   - phone: string - Telefono
 *   - website: string - Sito web
 *   - rating: number - Rating Google
 *   - user_ratings_total: number - Numero recensioni
 *   - types: string[] - Tipi Google Places
 *   - latitude: number (obbligatorio) - Latitudine
 *   - longitude: number (obbligatorio) - Longitudine
 *   - google_maps_url: string - URL Google Maps
 *
 * Risposta:
 * - success: boolean
 * - saved: number - Numero lead creati
 * - skipped: number - Numero lead gia esistenti
 * - errors: number - Numero errori
 * - results: Array con dettaglio per ogni place
 */
export async function POST(request: NextRequest) {
  try {
    // Get odoo_session_id from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    // Parse request body
    const body: SaveLeadsBody = await request.json();

    if (!body.places || !Array.isArray(body.places) || body.places.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Campo "places" richiesto e deve essere un array non vuoto'
      }, { status: 400 });
    }

    console.log(`[SAVE-LEADS] Inizio salvataggio ${body.places.length} lead`);

    // Step 1: Search or create "Sales Radar" tag in crm.tag
    let salesRadarTagId: number | null = null;

    try {
      // Search for existing tag
      const existingTags = await client.searchRead(
        'crm.tag',
        [['name', '=', 'Sales Radar']],
        ['id', 'name'],
        1
      );

      if (existingTags.length > 0) {
        salesRadarTagId = existingTags[0].id;
        console.log(`[SAVE-LEADS] Tag "Sales Radar" trovato: ID ${salesRadarTagId}`);
      } else {
        // Create new tag
        salesRadarTagId = await client.callKw(
          'crm.tag',
          'create',
          [{ name: 'Sales Radar', color: 5 }] // color 5 = purple
        );
        console.log(`[SAVE-LEADS] Tag "Sales Radar" creato: ID ${salesRadarTagId}`);
      }
    } catch (error) {
      console.warn('[SAVE-LEADS] Errore gestione tag:', error);
      // Continue without tag if it fails
    }

    // Step 2: Process each place
    const results: SaveResult[] = [];
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const place of body.places) {
      try {
        // Validate required fields
        if (!place.place_id || !place.name) {
          results.push({
            place_id: place.place_id || 'unknown',
            name: place.name || 'unknown',
            status: 'error',
            error: 'Campi obbligatori mancanti (place_id, name)'
          });
          errorCount++;
          continue;
        }

        // Check if lead already exists (search for place_id in description)
        const existingLeads = await client.searchRead(
          'crm.lead',
          [['description', 'ilike', `Place ID: ${place.place_id}`]],
          ['id', 'name'],
          1
        );

        if (existingLeads.length > 0) {
          console.log(`[SAVE-LEADS] Lead gia esistente per: ${place.name}`);
          results.push({
            place_id: place.place_id,
            name: place.name,
            status: 'skipped',
            lead_id: existingLeads[0].id
          });
          skippedCount++;
          continue;
        }

        // Build description with all Google data
        const descriptionParts: string[] = [
          '=== DATI GOOGLE PLACES ===',
          '',
          `Place ID: ${place.place_id}`,
          `Nome: ${place.name}`,
          `Indirizzo: ${place.address}`,
        ];

        if (place.phone) {
          descriptionParts.push(`Telefono: ${place.phone}`);
        }

        if (place.website) {
          descriptionParts.push(`Sito web: ${place.website}`);
        }

        if (place.rating !== undefined) {
          descriptionParts.push(`Rating: ${place.rating}/5`);
        }

        if (place.user_ratings_total !== undefined) {
          descriptionParts.push(`Numero recensioni: ${place.user_ratings_total}`);
        }

        if (place.types && place.types.length > 0) {
          descriptionParts.push(`Tipo attivita: ${place.types.join(', ')}`);
        }

        descriptionParts.push(`Coordinate: ${place.latitude}, ${place.longitude}`);

        if (place.google_maps_url) {
          descriptionParts.push(`Google Maps: ${place.google_maps_url}`);
        }

        descriptionParts.push('');
        descriptionParts.push(`Importato da Sales Radar il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`);

        const description = descriptionParts.join('\n');

        // Prepare lead values
        const leadValues: Record<string, unknown> = {
          name: place.name,
          type: 'lead', // Lead, not opportunity
          description: description,
          street: place.address,
          phone: place.phone || false,
          website: place.website || false,
          partner_latitude: place.latitude,
          partner_longitude: place.longitude,
        };

        // Add tag if available
        if (salesRadarTagId) {
          leadValues.tag_ids = [[6, 0, [salesRadarTagId]]]; // Set tags using Odoo (6, 0, ids) syntax
        }

        // Remove false values (Odoo doesn't want them)
        Object.keys(leadValues).forEach(key => {
          if (leadValues[key] === false) {
            delete leadValues[key];
          }
        });

        // Create lead in Odoo
        const newLeadId = await client.callKw(
          'crm.lead',
          'create',
          [leadValues]
        );

        if (!newLeadId) {
          throw new Error('Creazione lead fallita - nessun ID ritornato');
        }

        console.log(`[SAVE-LEADS] Lead creato: ${place.name} (ID: ${newLeadId})`);

        results.push({
          place_id: place.place_id,
          name: place.name,
          status: 'created',
          lead_id: newLeadId
        });
        savedCount++;

      } catch (error) {
        console.error(`[SAVE-LEADS] Errore per ${place.name}:`, error);
        results.push({
          place_id: place.place_id,
          name: place.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Errore sconosciuto'
        });
        errorCount++;
      }
    }

    console.log(`[SAVE-LEADS] Completato: ${savedCount} salvati, ${skippedCount} saltati, ${errorCount} errori`);

    return NextResponse.json({
      success: true,
      saved: savedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: body.places.length,
      tag_id: salesRadarTagId,
      results: results
    });

  } catch (error) {
    console.error('[SAVE-LEADS] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il salvataggio dei lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
