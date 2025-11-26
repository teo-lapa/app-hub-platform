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
  price_level?: number; // Google price level (0-4)
}

interface SaveLeadsBody {
  places: GooglePlace[];
}

interface SaveResult {
  place_id: string;
  name: string;
  status: 'created' | 'skipped' | 'error';
  lead_id?: number;
  partner_id?: number;
  isArchived?: boolean;
  color?: 'orange' | 'grey' | 'green';
  tags?: string[];
  error?: string;
}

/**
 * Stima dimensione del locale e potenziale fatturato mensile
 * basato su dati Google Places (identica alla funzione frontend)
 */
function estimateBusinessPotential(place: {
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  rating?: number;
}): { size: 'piccolo' | 'medio' | 'grande'; potentialMonthly: number; categories: string[] } {
  const reviews = place.user_ratings_total || 0;
  const priceLevel = place.price_level ?? 2; // Default medio
  const types = place.types || [];

  // Determina dimensione basata sul numero di recensioni
  let size: 'piccolo' | 'medio' | 'grande' = 'piccolo';
  if (reviews >= 500) {
    size = 'grande';
  } else if (reviews >= 100) {
    size = 'medio';
  }

  // Base mensile per dimensione (in CHF)
  const baseBySize = {
    piccolo: 800,   // 800 CHF/mese
    medio: 2500,    // 2500 CHF/mese
    grande: 6000,   // 6000 CHF/mese
  };

  // Moltiplicatore per tipo di locale
  let typeMultiplier = 1.0;
  const categories: string[] = [];

  // Categorie LAPA: Frigo, Secco, Frozen, Non-Food
  if (types.includes('restaurant') || types.includes('meal_delivery')) {
    typeMultiplier = 1.3;
    categories.push('Frigo', 'Secco', 'Frozen');
  }
  if (types.includes('hotel') || types.includes('lodging')) {
    typeMultiplier = 1.5;
    categories.push('Frigo', 'Secco', 'Frozen', 'Non-Food');
  }
  if (types.includes('cafe') || types.includes('bakery')) {
    typeMultiplier = 0.8;
    categories.push('Frigo', 'Secco');
  }
  if (types.includes('bar')) {
    typeMultiplier = 0.6;
    categories.push('Frigo', 'Secco');
  }
  if (types.includes('supermarket') || types.includes('grocery_or_supermarket')) {
    typeMultiplier = 2.0;
    categories.push('Frigo', 'Secco', 'Frozen', 'Non-Food');
  }

  // Moltiplicatore per fascia di prezzo (locale più costoso = più volume)
  const priceMultiplier = 0.7 + (priceLevel * 0.2); // 0.7 a 1.5

  // Calcola potenziale mensile
  const potentialMonthly = Math.round(baseBySize[size] * typeMultiplier * priceMultiplier);

  // Default categories se vuoto
  if (categories.length === 0) {
    categories.push('Frigo', 'Secco');
  }

  return { size, potentialMonthly, categories: Array.from(new Set(categories)) };
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
        // Include both active and archived leads to prevent duplicates
        // IMPORTANTE: usare callKw con context active_test: false per vedere gli archiviati
        const existingLeads = await client.callKw(
          'crm.lead',
          'search_read',
          [[['description', 'ilike', `Place ID: ${place.place_id}`]]],
          {
            fields: ['id', 'name', 'active'],
            limit: 1,
            context: { active_test: false }
          }
        );

        if (existingLeads.length > 0) {
          const lead = existingLeads[0];
          const isArchived = lead.active === false;

          // Recupera i tag del lead per determinare il colore
          let color: 'orange' | 'grey' = 'orange';
          let tagNames: string[] = [];

          try {
            // Recupera il lead completo con i tag (include archiviati)
            const leadFull = await client.callKw(
              'crm.lead',
              'search_read',
              [[['id', '=', lead.id]]],
              {
                fields: ['tag_ids'],
                limit: 1,
                context: { active_test: false }
              }
            );

            if (leadFull.length > 0 && leadFull[0].tag_ids && leadFull[0].tag_ids.length > 0) {
              // Recupera i nomi dei tag
              const tags = await client.searchRead(
                'crm.tag',
                [['id', 'in', leadFull[0].tag_ids]],
                ['name'],
                0
              );
              tagNames = tags.map((t: any) => t.name);

              // Controlla se e' marcato "non in target"
              const NOT_TARGET_TAGS = ['Non in Target', 'Chiuso definitivamente', 'Non interessato', 'non in target', 'chiuso'];
              const isNotTarget = tagNames.some((tag: string) =>
                NOT_TARGET_TAGS.some(notTag => tag.toLowerCase().includes(notTag.toLowerCase()))
              );

              if (isNotTarget) {
                color = 'grey';
              }
            }
          } catch (tagError) {
            console.log(`[SAVE-LEADS] Errore recupero tag per lead ${lead.id}:`, tagError);
          }

          console.log(`[SAVE-LEADS] Lead gia esistente${isArchived ? ' (archiviato)' : ''} per: ${place.name}, color: ${color}`);

          results.push({
            place_id: place.place_id,
            name: place.name,
            status: 'skipped',
            lead_id: lead.id,
            isArchived: isArchived,
            color: color,
            tags: tagNames,
            error: isArchived ? 'Lead archiviato esistente' : undefined
          });
          skippedCount++;
          continue;
        }

        // Check if partner (customer) already exists with this place_id
        // Search in 'comment' field for Google Place ID pattern
        // IMPORTANTE: usare callKw con context active_test: false per vedere gli archiviati
        const existingPartners = await client.callKw(
          'res.partner',
          'search_read',
          [[['comment', 'ilike', `Google Place ID: ${place.place_id}`]]],
          {
            fields: ['id', 'name', 'active'],
            limit: 1,
            context: { active_test: false }
          }
        );

        if (existingPartners.length > 0) {
          const partner = existingPartners[0];
          const isArchived = partner.active === false;

          // I partner (clienti) sono sempre verdi, ma se archiviati sono grigi
          const color: 'green' | 'grey' = isArchived ? 'grey' : 'green';

          console.log(`[SAVE-LEADS] Partner gia esistente${isArchived ? ' (archiviato)' : ''} per: ${place.name}, color: ${color}`);

          results.push({
            place_id: place.place_id,
            name: place.name,
            status: 'skipped',
            partner_id: partner.id,
            isArchived: isArchived,
            color: color,
            error: `Partner${isArchived ? ' archiviato' : ''} gia esistente (ID: ${partner.id})`
          });
          skippedCount++;
          continue;
        }

        // Calculate business potential
        const potential = estimateBusinessPotential({
          user_ratings_total: place.user_ratings_total,
          price_level: place.price_level,
          types: place.types,
          rating: place.rating
        });

        // Build description with all Google data + potential
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

        // Add potential estimation
        descriptionParts.push('');
        descriptionParts.push('=== POTENZIALE STIMATO ===');
        descriptionParts.push('');
        descriptionParts.push(`Dimensione: ${potential.size.toUpperCase()}`);
        descriptionParts.push(`Potenziale mensile: ${potential.potentialMonthly.toLocaleString('it-CH')} CHF`);
        descriptionParts.push(`Categorie prodotti: ${potential.categories.join(', ')}`);

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
