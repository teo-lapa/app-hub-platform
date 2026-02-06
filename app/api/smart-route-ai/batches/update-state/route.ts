import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface ExpiredProduct {
  moveLineId: number;
  pickingId: number;
  pickingName: string;
  productId: number;
  productName: string;
  lotId: number;
  lotName: string;
  expirationDate: string;
  quantity: number;
}

/**
 * POST /api/smart-route-ai/batches/update-state
 * Update batch state: draft -> in_progress -> done
 *
 * Body: {
 *   batchId: number,
 *   forceExpired?: boolean,        // If true, proceed with expired products
 *   skipExpiredLines?: number[]    // Move line IDs to skip (proceed without them)
 * }
 *
 * Returns expiredProducts array if action_done fails due to expired products
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('odoo_session_id');

  try {
    const { batchId, forceExpired, skipExpiredLines, checkOnlyExpired } = await request.json();

    if (!batchId) {
      return NextResponse.json({
        success: false,
        error: 'batchId required'
      }, { status: 400 });
    }

    console.log(`[Smart Route AI] ${checkOnlyExpired ? 'Checking expired products in' : 'Advancing state for'} batch ${batchId}`);

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'No Odoo session'
      }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);

    // Test connection
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to Odoo');
    }

    // First read the current state
    const batches = await rpcClient.callKw(
      'stock.picking.batch',
      'read',
      [[batchId], ['id', 'name', 'state']]
    );

    if (!batches || batches.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found'
      }, { status: 404 });
    }

    const batch = batches[0];
    const currentState = batch.state;

    console.log(`[Smart Route AI] Current batch state: ${currentState}`);

    // If checkOnlyExpired flag is set, just check for expired products and return
    if (checkOnlyExpired) {
      console.log(`[Smart Route AI] Checking for expired products in batch ${batchId}...`);
      const expiredProducts = await fetchExpiredProductsInBatch(rpcClient, batchId);

      if (expiredProducts.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Prodotti scaduti trovati',
          errorType: 'EXPIRY_ERROR',
          expiredProducts,
          batchId,
          batchName: batch.name
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'No expired products found',
        expiredProducts: []
      });
    }

    // Determine next state and action
    let newState: string;
    let actionMethod: string | null = null;

    if (currentState === 'draft') {
      // draft -> in_progress (call action_confirm method to start batch)
      newState = 'in_progress';
      actionMethod = 'action_confirm';
    } else if (currentState === 'in_progress') {
      // in_progress -> done (call action_done method to complete batch)
      newState = 'done';
      actionMethod = 'action_done';
    } else {
      return NextResponse.json({
        success: false,
        error: `Cannot advance from state: ${currentState}`,
        currentState
      }, { status: 400 });
    }

    console.log(`[Smart Route AI] Advancing from ${currentState} to ${newState} using method: ${actionMethod}`);

    // If skipExpiredLines is provided, set qty_done to 0 for those lines first
    if (skipExpiredLines && skipExpiredLines.length > 0) {
      console.log(`[Smart Route AI] Skipping ${skipExpiredLines.length} expired move lines...`);
      try {
        for (const lineId of skipExpiredLines) {
          await rpcClient.callKw('stock.move.line', 'write', [[lineId], { qty_done: 0 }]);
        }
        console.log(`[Smart Route AI] Set qty_done=0 for expired lines`);
      } catch (skipError: any) {
        console.error(`[Smart Route AI] Error skipping expired lines:`, skipError.message);
      }
    }

    // Call the action method to transition state
    if (actionMethod) {
      try {
        const result = await rpcClient.callKw(
          'stock.picking.batch',
          actionMethod,
          [[batchId]]
        );

        // Check if Odoo returned a wizard/action (confirmation dialog)
        if (result && typeof result === 'object' && result.type === 'ir.actions.act_window') {
          console.log(`[Smart Route AI] Odoo returned a wizard: ${result.res_model}`);

          // This is typically an expiry confirmation wizard
          if (result.res_model && result.res_model.includes('expiry')) {
            const expiredProducts = await fetchExpiredProductsInBatch(rpcClient, batchId);

            return NextResponse.json({
              success: false,
              error: 'Prodotti scaduti richiedono conferma',
              errorType: 'EXPIRY_WIZARD',
              wizardModel: result.res_model,
              wizardId: result.res_id,
              expiredProducts,
              batchId,
              batchName: batch.name
            }, { status: 400 });
          }
        }

        // If forceExpired is set and we got here with a wizard, try to confirm it
        if (forceExpired && result && typeof result === 'object' && result.res_id) {
          console.log(`[Smart Route AI] Force confirming wizard ${result.res_model}...`);
          try {
            await rpcClient.callKw(result.res_model, 'process', [[result.res_id]]);
          } catch (wizardError: any) {
            console.log(`[Smart Route AI] Wizard confirmation method 'process' failed, trying 'action_confirm'...`);
            try {
              await rpcClient.callKw(result.res_model, 'action_confirm', [[result.res_id]]);
            } catch {
              // Ignore - wizard might have already been processed
            }
          }
        }

      } catch (actionError: any) {
        const errorMessage = actionError.message || '';
        console.error(`[Smart Route AI] Action ${actionMethod} failed:`, errorMessage);

        // Check if error is related to expired products
        // Odoo errors for expiry usually contain: "scadut", "expired", "expiration", "scadenza"
        const isExpiryError = /scadut|expired|expiration|scadenza|lot.*date|consegnare.*prodotto/i.test(errorMessage);

        if (isExpiryError && actionMethod === 'action_done') {
          console.log(`[Smart Route AI] Detected expiry error, fetching expired products...`);

          // Fetch expired products in this batch
          const expiredProducts = await fetchExpiredProductsInBatch(rpcClient, batchId);

          return NextResponse.json({
            success: false,
            error: errorMessage,
            errorType: 'EXPIRY_ERROR',
            expiredProducts,
            batchId,
            batchName: batch.name
          }, { status: 400 });
        }

        // Check if error might be due to mixed move states in batch pickings
        // This happens when some stock.move lines are in different states (confirmed, partially_available vs assigned)
        // Odoo 17 batch validation can't handle backorders collectively with mixed states
        if (actionMethod === 'action_done') {
          console.log(`[Smart Route AI] action_done failed, checking for mixed move states in batch...`);
          const fallbackResult = await handleMixedStatesBatch(rpcClient, batchId);

          if (fallbackResult.success) {
            console.log(`[Smart Route AI] Mixed states fallback succeeded: ${fallbackResult.message}`);
            return NextResponse.json({
              success: true,
              message: fallbackResult.message,
              newState: 'done',
              fallback: true,
              details: fallbackResult.details
            });
          }
          console.log(`[Smart Route AI] Mixed states fallback did not apply: ${fallbackResult.error}`);
        }

        // Re-throw other errors
        throw actionError;
      }
    }

    console.log(`[Smart Route AI] Successfully advanced batch ${batchId} to ${newState}`);

    return NextResponse.json({
      success: true,
      message: `Batch state updated to ${newState}`,
      newState
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Error updating batch state:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error updating batch state'
    }, { status: 500 });
  }
}

/**
 * Handle batch validation failure due to mixed move states.
 * When some stock.move lines within a batch's pickings are in different states
 * (confirmed, partially_available vs assigned), Odoo 17 batch action_done fails.
 *
 * This function:
 * 1. Identifies pickings with non-assigned move lines
 * 2. Removes them from the batch
 * 3. Validates the batch with the remaining clean pickings
 * 4. Validates the extracted pickings individually (creating backorders as needed)
 * 5. If batch validation still fails, restores the pickings to the batch
 */
async function handleMixedStatesBatch(rpcClient: any, batchId: number): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  details?: any;
}> {
  try {
    // 1. Get all active pickings in the batch
    const pickings = await rpcClient.searchRead(
      'stock.picking',
      [['batch_id', '=', batchId], ['state', 'not in', ['done', 'cancel']]],
      ['id', 'name', 'state'],
      100
    );

    if (!pickings || pickings.length === 0) {
      return { success: false, error: 'No active pickings found in batch' };
    }

    const pickingIds = pickings.map((p: any) => p.id);

    // 2. Get all stock.move for these pickings (excluding done/cancel)
    const moves = await rpcClient.searchRead(
      'stock.move',
      [['picking_id', 'in', pickingIds], ['state', 'not in', ['done', 'cancel']]],
      ['id', 'picking_id', 'state', 'product_id'],
      1000
    );

    // 3. Find pickings that have at least one move NOT in 'assigned' state
    const problematicIdSet: Record<number, boolean> = {};
    for (const move of moves) {
      if (move.state !== 'assigned') {
        const pickingId = Array.isArray(move.picking_id) ? move.picking_id[0] : move.picking_id;
        problematicIdSet[pickingId] = true;
      }
    }
    const problematicPickingIdList = Object.keys(problematicIdSet).map(Number);

    if (problematicPickingIdList.length === 0) {
      return { success: false, error: 'No pickings with mixed move states found - error has a different cause' };
    }

    const cleanPickingCount = pickingIds.length - problematicPickingIdList.length;
    const problematicPickingNames = pickings
      .filter((p: any) => problematicIdSet[p.id])
      .map((p: any) => p.name);

    console.log(`[Smart Route AI] Mixed states: ${problematicPickingIdList.length} problematic (${problematicPickingNames.join(', ')}), ${cleanPickingCount} clean`);

    // 4. Remove problematic pickings from batch
    for (let i = 0; i < problematicPickingIdList.length; i++) {
      await rpcClient.callKw('stock.picking', 'write', [[problematicPickingIdList[i]], { batch_id: false }]);
    }
    console.log(`[Smart Route AI] Removed ${problematicPickingIdList.length} pickings from batch`);

    // 5. Validate the batch with remaining clean pickings
    if (cleanPickingCount > 0) {
      try {
        await rpcClient.callKw('stock.picking.batch', 'action_done', [[batchId]]);
        console.log(`[Smart Route AI] Batch validated with ${cleanPickingCount} clean pickings`);
      } catch (batchError: any) {
        // Batch validation still failed - restore pickings and bail
        console.error(`[Smart Route AI] Batch still failed after extraction:`, batchError.message);
        for (let i = 0; i < problematicPickingIdList.length; i++) {
          try {
            await rpcClient.callKw('stock.picking', 'write', [[problematicPickingIdList[i]], { batch_id: batchId }]);
          } catch { /* best effort restore */ }
        }
        return { success: false, error: `Batch validation failed even after extracting problematic pickings: ${batchError.message}` };
      }
    }

    // 6. Validate problematic pickings individually
    const validatedPickings: string[] = [];
    const failedPickings: { name: string; error: string }[] = [];

    for (let i = 0; i < problematicPickingIdList.length; i++) {
      const pickingId = problematicPickingIdList[i];
      const pickingName = pickings.find((p: any) => p.id === pickingId)?.name || `ID ${pickingId}`;
      try {
        const result = await rpcClient.callKw('stock.picking', 'button_validate', [[pickingId]]);

        // If Odoo returns a wizard (e.g. backorder confirmation), try to process it
        if (result && typeof result === 'object' && result.type === 'ir.actions.act_window' && result.res_id) {
          console.log(`[Smart Route AI] Processing wizard for ${pickingName}: ${result.res_model}`);
          try {
            await rpcClient.callKw(result.res_model, 'process', [[result.res_id]]);
          } catch {
            try {
              await rpcClient.callKw(result.res_model, 'process_cancel_backorder', [[result.res_id]]);
            } catch { /* wizard may have auto-processed */ }
          }
        }

        validatedPickings.push(pickingName);
        console.log(`[Smart Route AI] Validated ${pickingName} individually`);
      } catch (pickError: any) {
        console.error(`[Smart Route AI] Failed to validate ${pickingName}:`, pickError.message);
        failedPickings.push({ name: pickingName, error: pickError.message });
      }
    }

    const message = `Batch chiuso con successo. ${problematicPickingIdList.length} picking con stock mancante estratti e validati singolarmente (backorder automatici per prodotti non disponibili).`;

    return {
      success: true,
      message,
      details: {
        extractedPickings: problematicPickingNames,
        validatedIndividually: validatedPickings,
        failedPickings: failedPickings.length > 0 ? failedPickings : undefined
      }
    };
  } catch (err: any) {
    console.error('[Smart Route AI] handleMixedStatesBatch error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all expired products (move lines with expired lots) in a batch
 * Filters ONLY products where is_expired=true OR expiration_date < now
 */
async function fetchExpiredProductsInBatch(rpcClient: any, batchId: number): Promise<ExpiredProduct[]> {
  try {
    // Get all pickings in this batch
    const pickings = await rpcClient.searchRead(
      'stock.picking',
      [['batch_id', '=', batchId]],
      ['id', 'name'],
      100
    );

    if (!pickings || pickings.length === 0) {
      return [];
    }

    const pickingIds = pickings.map((p: any) => p.id);
    const pickingsMap: Record<number, string> = {};
    pickings.forEach((p: any) => {
      pickingsMap[p.id] = p.name;
    });

    // Get all move lines with lot (we'll filter expired ones in JS)
    const moveLines = await rpcClient.searchRead(
      'stock.move.line',
      [
        ['picking_id', 'in', pickingIds],
        ['lot_id', '!=', false]
      ],
      [
        'id', 'picking_id', 'product_id', 'lot_id',
        'expiration_date', 'is_expired', 'quantity'
      ],
      500
    );

    // Get current datetime for comparison
    const now = new Date();

    // Filter ONLY expired products (is_expired=true OR expiration_date < now)
    const expiredMoveLines = moveLines.filter((ml: any) => {
      // Check is_expired flag
      if (ml.is_expired === true) {
        return true;
      }

      // Check expiration_date
      if (ml.expiration_date) {
        const expiryDate = new Date(ml.expiration_date);
        if (expiryDate < now) {
          return true;
        }
      }

      return false;
    });

    console.log(`[Smart Route AI] Found ${expiredMoveLines.length} expired move lines out of ${moveLines.length} total in batch ${batchId}`);

    const expiredProducts: ExpiredProduct[] = expiredMoveLines.map((ml: any) => ({
      moveLineId: ml.id,
      pickingId: ml.picking_id ? ml.picking_id[0] : 0,
      pickingName: ml.picking_id ? pickingsMap[ml.picking_id[0]] || ml.picking_id[1] : 'Unknown',
      productId: ml.product_id ? ml.product_id[0] : 0,
      productName: ml.product_id ? ml.product_id[1] : 'Unknown',
      lotId: ml.lot_id ? ml.lot_id[0] : 0,
      lotName: ml.lot_id ? ml.lot_id[1] : 'Unknown',
      expirationDate: ml.expiration_date || '',
      quantity: ml.quantity || 0
    }));

    return expiredProducts;
  } catch (err) {
    console.error('[Smart Route AI] Error fetching expired products:', err);
    return [];
  }
}
