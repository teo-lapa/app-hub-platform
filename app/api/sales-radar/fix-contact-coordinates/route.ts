import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sales-radar/fix-contact-coordinates
 *
 * Fixes contacts that were converted from leads but don't have coordinates.
 * Finds their linked archived lead and copies the coordinates.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    console.log('[FIX-COORDINATES] Starting coordinate fix for contacts...');

    // 1. Find all archived leads that have partner_id (converted to contacts)
    const convertedLeads = await client.callKw(
      'crm.lead',
      'search_read',
      [[
        ['partner_id', '!=', false],
        ['active', '=', false],
        ['partner_latitude', '!=', false],
        ['partner_longitude', '!=', false]
      ]],
      {
        fields: ['id', 'partner_id', 'partner_name', 'name', 'partner_latitude', 'partner_longitude'],
        context: { active_test: false }
      }
    );

    console.log(`[FIX-COORDINATES] Found ${convertedLeads.length} converted leads with coordinates`);

    let fixedCount = 0;
    let skippedCount = 0;
    const results: any[] = [];

    for (const lead of convertedLeads) {
      try {
        const partnerId = Array.isArray(lead.partner_id) ? lead.partner_id[0] : lead.partner_id;

        // Check if partner already has coordinates
        const partners = await client.searchRead(
          'res.partner',
          [['id', '=', partnerId]],
          ['id', 'name', 'partner_latitude', 'partner_longitude'],
          1
        );

        if (partners.length === 0) {
          console.log(`[FIX-COORDINATES] Partner ${partnerId} not found, skipping`);
          skippedCount++;
          continue;
        }

        const partner = partners[0];

        // Skip if partner already has coordinates
        if (partner.partner_latitude && partner.partner_longitude) {
          console.log(`[FIX-COORDINATES] Partner "${partner.name}" already has coordinates, skipping`);
          skippedCount++;
          results.push({
            partner_id: partnerId,
            partner_name: partner.name,
            status: 'skipped',
            reason: 'Already has coordinates'
          });
          continue;
        }

        // Update partner with coordinates from lead
        await client.callKw(
          'res.partner',
          'write',
          [[partnerId], {
            partner_latitude: lead.partner_latitude,
            partner_longitude: lead.partner_longitude
          }]
        );

        console.log(`✅ [FIX-COORDINATES] Fixed coordinates for "${partner.name}" (ID: ${partnerId})`);
        fixedCount++;

        results.push({
          partner_id: partnerId,
          partner_name: partner.name,
          status: 'fixed',
          latitude: lead.partner_latitude,
          longitude: lead.partner_longitude
        });

      } catch (error) {
        console.error(`❌ [FIX-COORDINATES] Error fixing partner ${lead.partner_id}:`, error);
        results.push({
          partner_id: lead.partner_id,
          partner_name: lead.partner_name || lead.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[FIX-COORDINATES] Complete: ${fixedCount} fixed, ${skippedCount} skipped`);

    return NextResponse.json({
      success: true,
      fixed: fixedCount,
      skipped: skippedCount,
      total: convertedLeads.length,
      results
    });

  } catch (error) {
    console.error('[FIX-COORDINATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il fix delle coordinate',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
