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
