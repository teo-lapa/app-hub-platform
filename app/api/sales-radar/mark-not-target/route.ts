import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

interface MarkNotTargetBody {
  lead_id: number;
  reason: 'closed' | 'not_interested' | 'other';
  note?: string; // Optional note for 'other' reason
}

// Tag configuration mapping reason to tag name and color
const TAG_CONFIG: Record<string, { name: string; color: number }> = {
  closed: { name: 'Chiuso definitivamente', color: 1 },        // 1 = red
  not_interested: { name: 'Non interessato', color: 2 },       // 2 = orange
  other: { name: 'Non in Target', color: 4 }                   // 4 = grey
};

// All "not target" tag names - used for identification
const NOT_TARGET_TAGS = ['Chiuso definitivamente', 'Non interessato', 'Non in Target'];

/**
 * POST /api/sales-radar/mark-not-target
 *
 * Marca un Lead come "Non in Target" con una ragione specifica
 *
 * Body:
 * - lead_id: number (obbligatorio) - ID del Lead CRM
 * - reason: 'closed' | 'not_interested' | 'other' (obbligatorio)
 * - note: string (opzionale) - Nota aggiuntiva, specialmente per 'other'
 *
 * Risposta:
 * - success: boolean
 * - lead_id: number
 * - tag_added: string - Nome del tag aggiunto
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
    const body: MarkNotTargetBody = await request.json();

    // Validate required fields
    if (!body.lead_id) {
      return NextResponse.json({
        success: false,
        error: 'Campo "lead_id" richiesto'
      }, { status: 400 });
    }

    if (!body.reason || !['closed', 'not_interested', 'other'].includes(body.reason)) {
      return NextResponse.json({
        success: false,
        error: 'Campo "reason" richiesto (valori: closed, not_interested, other)'
      }, { status: 400 });
    }

    console.log(`[MARK-NOT-TARGET] Lead ID: ${body.lead_id}, Reason: ${body.reason}`);

    // Get tag configuration
    const tagConfig = TAG_CONFIG[body.reason];

    // Step 1: Search for existing tag or create it
    let tagId: number;

    const existingTags = await client.searchRead(
      'crm.tag',
      [['name', '=', tagConfig.name]],
      ['id', 'name', 'color'],
      1
    );

    if (existingTags.length > 0) {
      tagId = existingTags[0].id;
      console.log(`[MARK-NOT-TARGET] Tag esistente trovato: ${tagConfig.name} (ID: ${tagId})`);
    } else {
      // Create new tag
      tagId = await client.callKw(
        'crm.tag',
        'create',
        [{
          name: tagConfig.name,
          color: tagConfig.color
        }]
      );
      console.log(`[MARK-NOT-TARGET] Tag creato: ${tagConfig.name} (ID: ${tagId})`);
    }

    // Step 2: Get current lead to retrieve existing tags and description
    const leads = await client.searchRead(
      'crm.lead',
      [['id', '=', body.lead_id]],
      ['id', 'name', 'tag_ids', 'description'],
      1
    );

    if (leads.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Lead con ID ${body.lead_id} non trovato`
      }, { status: 404 });
    }

    const lead = leads[0];
    const currentTagIds: number[] = lead.tag_ids || [];

    // Step 3: Add the tag to the lead (if not already present)
    if (!currentTagIds.includes(tagId)) {
      const updatedTagIds = [...currentTagIds, tagId];

      // Prepare update values
      const updateValues: Record<string, any> = {
        tag_ids: [[6, 0, updatedTagIds]] // Replace all tags with new list
      };

      // Step 4: If note provided, append to description
      if (body.note) {
        const currentDescription = lead.description || '';
        const noteTimestamp = new Date().toLocaleString('it-IT');
        const appendedNote = `\n\n--- Non in Target (${noteTimestamp}) ---\nMotivo: ${tagConfig.name}\nNota: ${body.note}`;
        updateValues.description = currentDescription + appendedNote;
      }

      // Step 5: Optionally set lead as inactive/lost
      // Setting active = false marks the lead as archived/lost
      updateValues.active = false;

      // Update the lead
      await client.callKw(
        'crm.lead',
        'write',
        [[body.lead_id], updateValues]
      );

      console.log(`[MARK-NOT-TARGET] Lead ${body.lead_id} aggiornato con tag: ${tagConfig.name}`);
    } else {
      console.log(`[MARK-NOT-TARGET] Tag ${tagConfig.name} gia presente sul Lead ${body.lead_id}`);
    }

    return NextResponse.json({
      success: true,
      lead_id: body.lead_id,
      tag_added: tagConfig.name
    });

  } catch (error) {
    console.error('[MARK-NOT-TARGET] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante l\'aggiornamento del Lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
