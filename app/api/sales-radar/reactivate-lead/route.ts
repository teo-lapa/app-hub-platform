import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

// Tag names to remove when reactivating
const NOT_TARGET_TAGS = ['Chiuso definitivamente', 'Non interessato', 'Non in Target'];

interface ReactivateLeadBody {
  lead_id: number;
}

/**
 * POST /api/sales-radar/reactivate-lead
 *
 * Riattiva un Lead precedentemente archiviato/escluso
 * - Rimuove i tag "Non in Target"
 * - Imposta active = true
 *
 * Body:
 * - lead_id: number (obbligatorio) - ID del Lead CRM
 *
 * Risposta:
 * - success: boolean
 * - lead_id: number
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
    const body: ReactivateLeadBody = await request.json();

    // Validate required fields
    if (!body.lead_id) {
      return NextResponse.json({
        success: false,
        error: 'Campo "lead_id" richiesto'
      }, { status: 400 });
    }

    console.log(`[REACTIVATE-LEAD] Lead ID: ${body.lead_id}`);

    // Step 1: Get current lead with tags (include archived leads with active_test: false)
    const leads = await client.callKw(
      'crm.lead',
      'search_read',
      [[['id', '=', body.lead_id]]],
      {
        fields: ['id', 'name', 'tag_ids', 'active'],
        limit: 1,
        context: { active_test: false } // Include archived leads
      }
    );

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Lead con ID ${body.lead_id} non trovato (anche tra gli archiviati)`
      }, { status: 404 });
    }

    const lead = leads[0];
    const currentTagIds: number[] = lead.tag_ids || [];

    // Step 2: Find which tags to remove (the "not target" tags)
    let tagsToRemove: number[] = [];

    if (currentTagIds.length > 0) {
      // Get tag details to check names
      const tags = await client.searchRead(
        'crm.tag',
        [['id', 'in', currentTagIds]],
        ['id', 'name'],
        0
      );

      // Find tags that match our NOT_TARGET_TAGS
      tagsToRemove = tags
        .filter((tag: any) =>
          NOT_TARGET_TAGS.some(notTag =>
            tag.name.toLowerCase().includes(notTag.toLowerCase())
          )
        )
        .map((tag: any) => tag.id);
    }

    // Step 3: Remove "not target" tags and reactivate
    const newTagIds = currentTagIds.filter(id => !tagsToRemove.includes(id));

    await client.callKw(
      'crm.lead',
      'write',
      [[body.lead_id], {
        tag_ids: [[6, 0, newTagIds]], // Replace all tags with filtered list
        active: true // Reactivate the lead
      }]
    );

    console.log(`[REACTIVATE-LEAD] Lead ${body.lead_id} riattivato. Tag rimossi: ${tagsToRemove.length}`);

    return NextResponse.json({
      success: true,
      lead_id: body.lead_id,
      tags_removed: tagsToRemove.length
    });

  } catch (error) {
    console.error('[REACTIVATE-LEAD] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante la riattivazione del Lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
