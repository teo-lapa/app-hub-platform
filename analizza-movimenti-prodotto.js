/**
 * ANALIZZA MOVIMENTI PRODOTTO
 *
 * Analizza i movimenti IN e OUT di un prodotto per capire:
 * - Quando è arrivato (ultimo carico IN)
 * - Quando è stato venduto (ultimo OUT)
 * - Da quanto tempo è "fermo"
 */

const odoo = require('./odoo-staging-connect');

async function analizzaMovimentiProdotto() {
    try {
        await odoo.connect();

        // Cerca qualsiasi prodotto con movimenti
        // Prima prendiamo gli ID dei prodotti con movimenti recenti
        console.log('🔍 Ricerca prodotti con movimenti recenti...\n');

        const recentMoveIds = await odoo.execute_kw('stock.move', 'search', [[['state', '=', 'done']]], { limit: 1, order: 'date desc' });

        if (recentMoveIds.length === 0) {
            console.log('❌ Nessun movimento trovato');
            return;
        }

        const recentMoves = await odoo.read('stock.move', recentMoveIds, ['product_id']);
        const productId = recentMoves[0].product_id[0];

        const products = await odoo.read('product.product', [productId], ['id', 'name', 'default_code', 'qty_available']);
        const product = products[0];
        console.log(`\n🔍 ANALISI MOVIMENTI PRODOTTO\n`);
        console.log(`📦 Prodotto: ${product.name}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   Codice: ${product.default_code}`);
        console.log(`   Qty Disponibile: ${product.qty_available}`);

        // 2. Cerca TUTTI i movimenti del prodotto (IN e OUT)
        console.log('\n📊 TUTTI I MOVIMENTI (ultimi 10):');
        const moveIds = await odoo.execute_kw('stock.move', 'search', [[['product_id', '=', product.id], ['state', '=', 'done']]], { limit: 10, order: 'date desc' });

        if (moveIds.length === 0) {
            console.log('   ❌ Nessun movimento trovato');
            return;
        }

        const allMoves = await odoo.read('stock.move', moveIds, ['id', 'name', 'product_id', 'date', 'picking_code', 'location_id', 'location_dest_id', 'product_uom_qty', 'picking_id']);

        for (const move of allMoves) {
            console.log(`\n  📌 Move ID: ${move.id}`);
            console.log(`     Data: ${move.date}`);
            console.log(`     Tipo: ${move.picking_code || 'N/A'} (${move.name})`);
            console.log(`     Quantità: ${move.product_uom_qty}`);
            console.log(`     Da: ${move.location_id[1]}`);
            console.log(`     A: ${move.location_dest_id[1]}`);
            console.log(`     Picking: ${move.picking_id ? move.picking_id[1] : 'N/A'}`);
        }

        // 3. Separa movimenti IN (incoming/internal in) e OUT (outgoing)
        console.log('\n\n🔵 MOVIMENTI IN (arrivi, carichi):');
        const incomingMoves = allMoves.filter(m => m.picking_code === 'incoming' || m.picking_code === 'internal');
        if (incomingMoves.length > 0) {
            const lastIn = incomingMoves[0];
            console.log(`   📥 ULTIMO CARICO: ${lastIn.date}`);
            console.log(`      Tipo: ${lastIn.picking_code}`);
            console.log(`      Qty: ${lastIn.product_uom_qty}`);
            console.log(`      Da: ${lastIn.location_id[1]}`);
            console.log(`      A: ${lastIn.location_dest_id[1]}`);
        } else {
            console.log('   ❌ Nessun movimento IN trovato');
        }

        console.log('\n🔴 MOVIMENTI OUT (vendite, uscite):');
        const outgoingMoves = allMoves.filter(m => m.picking_code === 'outgoing');
        if (outgoingMoves.length > 0) {
            const lastOut = outgoingMoves[0];
            console.log(`   📤 ULTIMA VENDITA: ${lastOut.date}`);
            console.log(`      Tipo: ${lastOut.picking_code}`);
            console.log(`      Qty: ${lastOut.product_uom_qty}`);
            console.log(`      Da: ${lastOut.location_id[1]}`);
            console.log(`      A: ${lastOut.location_dest_id[1]}`);
        } else {
            console.log('   ❌ Nessun movimento OUT trovato');
        }

        // 4. Calcola giorni di "fermo"
        console.log('\n\n⏱️  CALCOLO GIORNI DI FERMO:\n');

        const today = new Date();
        let lastMoveDate = null;
        let lastMoveType = null;

        // Prendi il movimento più recente tra IN e OUT
        if (incomingMoves.length > 0 && outgoingMoves.length > 0) {
            const lastInDate = new Date(incomingMoves[0].date);
            const lastOutDate = new Date(outgoingMoves[0].date);

            if (lastInDate > lastOutDate) {
                lastMoveDate = lastInDate;
                lastMoveType = 'IN (carico)';
            } else {
                lastMoveDate = lastOutDate;
                lastMoveType = 'OUT (vendita)';
            }
        } else if (incomingMoves.length > 0) {
            lastMoveDate = new Date(incomingMoves[0].date);
            lastMoveType = 'IN (carico)';
        } else if (outgoingMoves.length > 0) {
            lastMoveDate = new Date(outgoingMoves[0].date);
            lastMoveType = 'OUT (vendita)';
        }

        if (lastMoveDate) {
            const daysSinceLastMove = Math.floor((today - lastMoveDate) / (1000 * 60 * 60 * 24));
            console.log(`   Ultimo movimento: ${lastMoveDate.toISOString().split('T')[0]} (${lastMoveType})`);
            console.log(`   Giorni dall'ultimo movimento: ${daysSinceLastMove} giorni`);

            if (daysSinceLastMove >= 90) {
                console.log(`   ⚠️  FERMO DA 90+ GIORNI`);
            } else if (daysSinceLastMove >= 30) {
                console.log(`   ⚠️  FERMO DA 30-89 GIORNI`);
            } else {
                console.log(`   ✅ Movimento recente (< 30 giorni)`);
            }
        } else {
            console.log(`   ❌ Nessun movimento trovato per questo prodotto`);
        }

        console.log('\n✅ Analisi completata!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    }
}

analizzaMovimentiProdotto();
