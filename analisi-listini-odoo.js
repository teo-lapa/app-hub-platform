#!/usr/bin/env node

/**
 * ANALISI COMPLETA STRUTTURA LISTINI PREZZI ODOO
 *
 * Questo script analizza:
 * 1. Modello product.pricelist e suoi campi
 * 2. Modello product.pricelist.item (regole di prezzo)
 * 3. Collegamenti con res.partner
 * 4. Collegamenti con sale.order.line
 * 5. Esempi reali di calcolo prezzi
 */

const odoo = require('./odoo-staging-connect');

async function analizzaListiniCompleto() {
    console.log('='.repeat(80));
    console.log('ANALISI COMPLETA STRUTTURA LISTINI PREZZI ODOO');
    console.log('='.repeat(80));

    const risultati = {
        timestamp: new Date().toISOString(),
        modelli: {},
        esempi: {},
        relazioni: {},
        logica_calcolo: {}
    };

    try {
        await odoo.connect();
        console.log('\n✓ Connesso a Odoo staging\n');

        // ====================================================================
        // 1. ANALISI MODELLO product.pricelist
        // ====================================================================
        console.log('\n' + '='.repeat(80));
        console.log('1. ANALISI MODELLO product.pricelist');
        console.log('='.repeat(80));

        // Ottieni tutti i campi del modello pricelist
        const pricelistFields = await odoo.execute_kw(
            'ir.model.fields',
            'search_read',
            [[['model', '=', 'product.pricelist']]],
            { fields: ['name', 'field_description', 'ttype', 'relation', 'required', 'readonly', 'help'] }
        );

        console.log(`\nTrovati ${pricelistFields.length} campi nel modello product.pricelist:`);
        risultati.modelli.product_pricelist = {
            totale_campi: pricelistFields.length,
            campi: pricelistFields.map(f => ({
                nome: f.name,
                descrizione: f.field_description,
                tipo: f.ttype,
                relazione: f.relation || null,
                richiesto: f.required,
                readonly: f.readonly,
                help: f.help || null
            }))
        };

        // Stampa i campi più importanti
        console.log('\nCAMPI PRINCIPALI:');
        pricelistFields
            .filter(f => ['name', 'active', 'currency_id', 'company_id', 'item_ids', 'discount_policy'].includes(f.name))
            .forEach(f => {
                console.log(`  - ${f.name} (${f.ttype})${f.relation ? ` -> ${f.relation}` : ''}: ${f.field_description}`);
            });

        // Leggi tutti i listini esistenti
        const pricelists = await odoo.execute_kw(
            'product.pricelist',
            'search_read',
            [[]],
            {
                fields: ['name', 'active', 'currency_id', 'company_id', 'item_ids', 'discount_policy'],
                limit: 100
            }
        );

        console.log(`\n\nLISTINI ESISTENTI (${pricelists.length}):`);
        pricelists.forEach(pl => {
            console.log(`\n  ID: ${pl.id} - ${pl.name}`);
            console.log(`    Active: ${pl.active}`);
            console.log(`    Currency: ${pl.currency_id ? pl.currency_id[1] : 'N/A'}`);
            console.log(`    Company: ${pl.company_id ? pl.company_id[1] : 'N/A'}`);
            console.log(`    Regole: ${pl.item_ids ? pl.item_ids.length : 0}`);
            console.log(`    Discount Policy: ${pl.discount_policy || 'N/A'}`);
        });

        risultati.esempi.listini_esistenti = pricelists;

        // ====================================================================
        // 2. ANALISI MODELLO product.pricelist.item (REGOLE)
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('2. ANALISI MODELLO product.pricelist.item (REGOLE DI PREZZO)');
        console.log('='.repeat(80));

        const pricelistItemFields = await odoo.execute_kw(
            'ir.model.fields',
            'search_read',
            [[['model', '=', 'product.pricelist.item']]],
            { fields: ['name', 'field_description', 'ttype', 'relation', 'required', 'readonly', 'help'] }
        );

        console.log(`\nTrovati ${pricelistItemFields.length} campi nel modello product.pricelist.item:`);
        risultati.modelli.product_pricelist_item = {
            totale_campi: pricelistItemFields.length,
            campi: pricelistItemFields.map(f => ({
                nome: f.name,
                descrizione: f.field_description,
                tipo: f.ttype,
                relazione: f.relation || null,
                richiesto: f.required,
                readonly: f.readonly,
                help: f.help || null
            }))
        };

        console.log('\nCAMPI PRINCIPALI DELLE REGOLE:');
        pricelistItemFields
            .filter(f => [
                'pricelist_id', 'product_tmpl_id', 'product_id', 'categ_id',
                'min_quantity', 'applied_on', 'compute_price', 'fixed_price',
                'percent_price', 'price_discount', 'price_surcharge', 'price_min_margin',
                'price_max_margin', 'date_start', 'date_end', 'base'
            ].includes(f.name))
            .forEach(f => {
                console.log(`  - ${f.name} (${f.ttype})${f.relation ? ` -> ${f.relation}` : ''}: ${f.field_description}`);
                if (f.help) console.log(`    HELP: ${f.help}`);
            });

        // Leggi esempi di regole
        const pricelistItems = await odoo.execute_kw(
            'product.pricelist.item',
            'search_read',
            [[]],
            {
                fields: [
                    'pricelist_id', 'product_tmpl_id', 'product_id', 'categ_id',
                    'min_quantity', 'applied_on', 'compute_price', 'fixed_price',
                    'percent_price', 'price_discount', 'price_surcharge',
                    'date_start', 'date_end', 'base', 'price_min_margin', 'price_max_margin'
                ],
                limit: 50
            }
        );

        console.log(`\n\nREGOLE DI PREZZO ESISTENTI (${pricelistItems.length} esempi):`);
        pricelistItems.slice(0, 10).forEach(item => {
            console.log(`\n  ID: ${item.id}`);
            console.log(`    Listino: ${item.pricelist_id ? item.pricelist_id[1] : 'N/A'}`);
            console.log(`    Applied On: ${item.applied_on}`);
            console.log(`    Compute Price: ${item.compute_price}`);
            console.log(`    Min Quantity: ${item.min_quantity}`);

            if (item.product_id) console.log(`    Prodotto: ${item.product_id[1]}`);
            if (item.product_tmpl_id) console.log(`    Template: ${item.product_tmpl_id[1]}`);
            if (item.categ_id) console.log(`    Categoria: ${item.categ_id[1]}`);

            if (item.fixed_price) console.log(`    Prezzo Fisso: ${item.fixed_price}`);
            if (item.percent_price) console.log(`    Percentuale: ${item.percent_price}%`);
            if (item.price_discount) console.log(`    Sconto: ${item.price_discount}%`);
            if (item.price_surcharge) console.log(`    Sovrapprezzo: ${item.price_surcharge}`);
            if (item.base) console.log(`    Base: ${item.base}`);
            if (item.date_start) console.log(`    Data Inizio: ${item.date_start}`);
            if (item.date_end) console.log(`    Data Fine: ${item.date_end}`);
        });

        risultati.esempi.regole_prezzo = pricelistItems;

        // ====================================================================
        // 3. COLLEGAMENTO res.partner -> LISTINO
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('3. ANALISI COLLEGAMENTO res.partner -> LISTINO');
        console.log('='.repeat(80));

        // Verifica il campo property_product_pricelist
        const partnerFields = await odoo.execute_kw(
            'ir.model.fields',
            'search_read',
            [[['model', '=', 'res.partner'], ['name', 'in', ['property_product_pricelist', 'property_payment_term_id', 'property_supplier_payment_term_id']]]],
            { fields: ['name', 'field_description', 'ttype', 'relation', 'help'] }
        );

        console.log('\nCAMPI PARTNER PER LISTINI:');
        partnerFields.forEach(f => {
            console.log(`  - ${f.name} (${f.ttype})${f.relation ? ` -> ${f.relation}` : ''}: ${f.field_description}`);
            if (f.help) console.log(`    ${f.help}`);
        });

        risultati.relazioni.partner_pricelist = partnerFields;

        // Prendi esempi di partner con listino
        const partners = await odoo.execute_kw(
            'res.partner',
            'search_read',
            [[['property_product_pricelist', '!=', false]]],
            {
                fields: ['name', 'property_product_pricelist', 'customer_rank', 'supplier_rank'],
                limit: 20
            }
        );

        console.log(`\n\nPARTNER CON LISTINO ASSEGNATO (${partners.length} esempi):`);
        partners.slice(0, 10).forEach(p => {
            console.log(`  - ${p.name}: ${p.property_product_pricelist ? p.property_product_pricelist[1] : 'N/A'}`);
        });

        risultati.esempi.partner_con_listino = partners;

        // ====================================================================
        // 4. ANALISI sale.order.line E PREZZI
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('4. ANALISI sale.order.line E GESTIONE PREZZI');
        console.log('='.repeat(80));

        const saleLineFields = await odoo.execute_kw(
            'ir.model.fields',
            'search_read',
            [[['model', '=', 'sale.order.line'], ['name', 'in', [
                'price_unit', 'price_subtotal', 'price_total', 'price_reduce',
                'discount', 'product_id', 'product_uom_qty', 'order_id'
            ]]]],
            { fields: ['name', 'field_description', 'ttype', 'relation', 'help'] }
        );

        console.log('\nCAMPI PREZZO IN sale.order.line:');
        saleLineFields.forEach(f => {
            console.log(`  - ${f.name} (${f.ttype})${f.relation ? ` -> ${f.relation}` : ''}: ${f.field_description}`);
            if (f.help) console.log(`    ${f.help}`);
        });

        risultati.modelli.sale_order_line_prezzi = saleLineFields;

        // Prendi esempi di righe ordine
        const saleLines = await odoo.execute_kw(
            'sale.order.line',
            'search_read',
            [[]],
            {
                fields: [
                    'order_id', 'product_id', 'product_uom_qty', 'price_unit',
                    'discount', 'price_subtotal', 'price_total'
                ],
                limit: 20,
                order: 'id desc'
            }
        );

        console.log(`\n\nESEMPI RIGHE ORDINE (${saleLines.length}):`);
        saleLines.slice(0, 10).forEach(line => {
            console.log(`\n  Ordine: ${line.order_id ? line.order_id[1] : 'N/A'}`);
            console.log(`    Prodotto: ${line.product_id ? line.product_id[1] : 'N/A'}`);
            console.log(`    Quantità: ${line.product_uom_qty}`);
            console.log(`    Prezzo Unitario: ${line.price_unit}`);
            console.log(`    Sconto: ${line.discount}%`);
            console.log(`    Subtotale: ${line.price_subtotal}`);
            console.log(`    Totale: ${line.price_total}`);
        });

        risultati.esempi.sale_order_lines = saleLines;

        // ====================================================================
        // 5. VERIFICA METODI E FUNZIONI DISPONIBILI
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('5. RICERCA METODI CALCOLO PREZZO');
        console.log('='.repeat(80));

        // Cerca metodi nel modello pricelist
        try {
            const methods = await odoo.execute_kw(
                'ir.model',
                'search_read',
                [[['model', '=', 'product.pricelist']]],
                { fields: ['name', 'model', 'info'] }
            );

            console.log('\nModello product.pricelist trovato:', methods);
            risultati.modelli.metodi_pricelist = methods;
        } catch (err) {
            console.log('Impossibile recuperare metodi:', err.message);
        }

        // ====================================================================
        // 6. ANALISI SELEZIONI (SELECTION FIELDS)
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('6. ANALISI CAMPI SELECTION (OPZIONI)');
        console.log('='.repeat(80));

        // applied_on
        const appliedOnField = pricelistItemFields.find(f => f.name === 'applied_on');
        console.log('\napplied_on (dove si applica la regola):');
        console.log('  Tipo:', appliedOnField?.ttype);

        // compute_price
        const computePriceField = pricelistItemFields.find(f => f.name === 'compute_price');
        console.log('\ncompute_price (come calcolare il prezzo):');
        console.log('  Tipo:', computePriceField?.ttype);

        // base
        const baseField = pricelistItemFields.find(f => f.name === 'base');
        console.log('\nbase (base di calcolo):');
        console.log('  Tipo:', baseField?.ttype);

        // discount_policy
        const discountPolicyField = pricelistFields.find(f => f.name === 'discount_policy');
        console.log('\ndiscount_policy:');
        console.log('  Tipo:', discountPolicyField?.ttype);

        // ====================================================================
        // 7. ESEMPIO PRATICO: CALCOLO PREZZO
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('7. ESEMPIO PRATICO CALCOLO PREZZO');
        console.log('='.repeat(80));

        if (pricelists.length > 0 && pricelistItems.length > 0) {
            const listino = pricelists[0];
            const regole = pricelistItems.filter(r => r.pricelist_id && r.pricelist_id[0] === listino.id);

            console.log(`\nListino: ${listino.name} (ID: ${listino.id})`);
            console.log(`Numero regole: ${regole.length}`);

            if (regole.length > 0) {
                console.log('\nREGOLE ATTIVE:');
                regole.forEach((r, idx) => {
                    console.log(`\n  Regola ${idx + 1}:`);
                    console.log(`    Applied on: ${r.applied_on}`);
                    console.log(`    Compute: ${r.compute_price}`);
                    console.log(`    Min Qty: ${r.min_quantity}`);
                    if (r.product_id) console.log(`    Prodotto: ${r.product_id[1]}`);
                    if (r.fixed_price) console.log(`    Prezzo fisso: ${r.fixed_price}`);
                    if (r.percent_price) console.log(`    Percentuale: ${r.percent_price}%`);
                    if (r.price_discount) console.log(`    Sconto: ${r.price_discount}%`);
                });
            }

            risultati.logica_calcolo.esempio_listino = {
                listino: listino,
                regole: regole
            };
        }

        // ====================================================================
        // 8. VERIFICA CAMPI COMPUTED E RELATED
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('8. CAMPI COMPUTED E RELATED');
        console.log('='.repeat(80));

        const computedFields = pricelistItemFields.filter(f =>
            f.name.includes('compute') || f.readonly
        );

        console.log('\nCAMPI COMPUTED/READONLY in pricelist.item:');
        computedFields.forEach(f => {
            console.log(`  - ${f.name}: ${f.field_description} (readonly: ${f.readonly})`);
        });

        // ====================================================================
        // SALVA RISULTATI
        // ====================================================================
        const fs = require('fs').promises;
        await fs.writeFile(
            'c:\\Users\\lapa\\OneDrive\\Desktop\\Claude Code\\ANALISI_LISTINI_ODOO.json',
            JSON.stringify(risultati, null, 2)
        );

        console.log('\n\n' + '='.repeat(80));
        console.log('ANALISI COMPLETATA');
        console.log('='.repeat(80));
        console.log('\nFile salvato: ANALISI_LISTINI_ODOO.json');
        console.log(`\nStatistiche:`);
        console.log(`  - Listini trovati: ${pricelists.length}`);
        console.log(`  - Regole trovate: ${pricelistItems.length}`);
        console.log(`  - Partner con listino: ${partners.length}`);
        console.log(`  - Campi product.pricelist: ${pricelistFields.length}`);
        console.log(`  - Campi product.pricelist.item: ${pricelistItemFields.length}`);

        return risultati;

    } catch (error) {
        console.error('\n❌ ERRORE durante l\'analisi:', error);
        throw error;
    }
}

// Esegui
analizzaListiniCompleto()
    .then(() => {
        console.log('\n✓ Analisi completata con successo');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Errore:', err.message);
        process.exit(1);
    });
