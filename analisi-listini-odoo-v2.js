#!/usr/bin/env node

/**
 * ANALISI COMPLETA STRUTTURA LISTINI PREZZI ODOO
 * Versione che non richiede accesso a ir.model.fields
 *
 * Analizza direttamente i dati per capire la struttura
 */

const odoo = require('./odoo-staging-connect');
const fs = require('fs').promises;

async function analizzaListiniCompleto() {
    console.log('='.repeat(80));
    console.log('ANALISI COMPLETA STRUTTURA LISTINI PREZZI ODOO');
    console.log('='.repeat(80));

    const risultati = {
        timestamp: new Date().toISOString(),
        modelli: {},
        esempi: {},
        relazioni: {},
        logica_calcolo: {},
        documentazione: {}
    };

    try {
        await odoo.connect();
        console.log('\n✓ Connesso a Odoo staging\n');

        // ====================================================================
        // 1. ANALISI LISTINI (product.pricelist)
        // ====================================================================
        console.log('\n' + '='.repeat(80));
        console.log('1. ANALISI LISTINI (product.pricelist)');
        console.log('='.repeat(80));

        // Leggi tutti i listini con TUTTI i campi disponibili
        const pricelists = await odoo.execute_kw(
            'product.pricelist',
            'search_read',
            [[]],
            { limit: 100 }  // Senza specificare fields, restituisce tutti i campi
        );

        console.log(`\n✓ Trovati ${pricelists.length} listini`);

        if (pricelists.length > 0) {
            console.log('\nCAMPI DISPONIBILI in product.pricelist:');
            const campiListino = Object.keys(pricelists[0]).sort();
            campiListino.forEach(campo => {
                const valore = pricelists[0][campo];
                const tipo = Array.isArray(valore) ? 'array' : typeof valore;
                console.log(`  - ${campo}: ${tipo}`);
            });

            risultati.modelli.product_pricelist = {
                campi: campiListino,
                esempio: pricelists[0]
            };

            console.log('\n\nDETTAGLIO LISTINI:');
            pricelists.forEach(pl => {
                console.log(`\n  ID: ${pl.id} - ${pl.name}`);
                console.log(`    Active: ${pl.active}`);
                console.log(`    Currency: ${pl.currency_id ? pl.currency_id[1] : 'N/A'}`);
                console.log(`    Company: ${pl.company_id ? pl.company_id[1] : 'N/A'}`);
                console.log(`    Discount Policy: ${pl.discount_policy || 'N/A'}`);
                console.log(`    Item IDs (regole): ${pl.item_ids ? pl.item_ids.length : 0}`);
                if (pl.country_group_ids && pl.country_group_ids.length) {
                    console.log(`    Country Groups: ${pl.country_group_ids.length}`);
                }
            });
        }

        risultati.esempi.listini = pricelists;

        // ====================================================================
        // 2. ANALISI REGOLE DI PREZZO (product.pricelist.item)
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('2. ANALISI REGOLE DI PREZZO (product.pricelist.item)');
        console.log('='.repeat(80));

        const pricelistItems = await odoo.execute_kw(
            'product.pricelist.item',
            'search_read',
            [[]],
            { limit: 100 }
        );

        console.log(`\n✓ Trovate ${pricelistItems.length} regole di prezzo`);

        if (pricelistItems.length > 0) {
            console.log('\nCAMPI DISPONIBILI in product.pricelist.item:');
            const campiRegola = Object.keys(pricelistItems[0]).sort();
            campiRegola.forEach(campo => {
                const valore = pricelistItems[0][campo];
                const tipo = Array.isArray(valore) ? 'array' : typeof valore;
                console.log(`  - ${campo}: ${tipo}`);
            });

            risultati.modelli.product_pricelist_item = {
                campi: campiRegola,
                esempio: pricelistItems[0]
            };

            // Analizza i tipi di regole
            const tipiAppliedOn = [...new Set(pricelistItems.map(i => i.applied_on))];
            const tipiComputePrice = [...new Set(pricelistItems.map(i => i.compute_price))];
            const tipiBase = [...new Set(pricelistItems.filter(i => i.base).map(i => i.base))];

            console.log('\n\nVALORI POSSIBILI:');
            console.log(`  applied_on: ${tipiAppliedOn.join(', ')}`);
            console.log(`  compute_price: ${tipiComputePrice.join(', ')}`);
            console.log(`  base: ${tipiBase.join(', ')}`);

            risultati.documentazione.valori_selection = {
                applied_on: tipiAppliedOn,
                compute_price: tipiComputePrice,
                base: tipiBase
            };

            console.log('\n\nESEMPI DI REGOLE (prime 15):');
            pricelistItems.slice(0, 15).forEach((item, idx) => {
                console.log(`\n  ${idx + 1}. ID: ${item.id}`);
                console.log(`     Listino: ${item.pricelist_id ? item.pricelist_id[1] : 'N/A'}`);
                console.log(`     Applied On: ${item.applied_on}`);
                console.log(`     Compute Price: ${item.compute_price}`);
                console.log(`     Min Quantity: ${item.min_quantity}`);

                if (item.product_id) console.log(`     Prodotto specifico: ${item.product_id[1]}`);
                if (item.product_tmpl_id) console.log(`     Template: ${item.product_tmpl_id[1]}`);
                if (item.categ_id) console.log(`     Categoria: ${item.categ_id[1]}`);

                if (item.base) console.log(`     Base calcolo: ${item.base}`);
                if (item.fixed_price !== false && item.fixed_price !== 0) {
                    console.log(`     Prezzo Fisso: ${item.fixed_price}`);
                }
                if (item.percent_price !== false && item.percent_price !== 0) {
                    console.log(`     Percentuale: ${item.percent_price}%`);
                }
                if (item.price_discount !== false && item.price_discount !== 0) {
                    console.log(`     Sconto: ${item.price_discount}%`);
                }
                if (item.price_surcharge !== false && item.price_surcharge !== 0) {
                    console.log(`     Sovrapprezzo: ${item.price_surcharge}`);
                }
                if (item.price_min_margin !== false && item.price_min_margin !== 0) {
                    console.log(`     Margine Min: ${item.price_min_margin}`);
                }
                if (item.price_max_margin !== false && item.price_max_margin !== 0) {
                    console.log(`     Margine Max: ${item.price_max_margin}`);
                }
                if (item.date_start) console.log(`     Data Inizio: ${item.date_start}`);
                if (item.date_end) console.log(`     Data Fine: ${item.date_end}`);
            });
        }

        risultati.esempi.regole_prezzo = pricelistItems;

        // ====================================================================
        // 3. COLLEGAMENTO PARTNER -> LISTINO
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('3. ANALISI COLLEGAMENTO PARTNER -> LISTINO');
        console.log('='.repeat(80));

        // Cerca partner con listino assegnato
        const partnersConListino = await odoo.execute_kw(
            'res.partner',
            'search_read',
            [[['property_product_pricelist', '!=', false]]],
            { limit: 30 }
        );

        console.log(`\n✓ Trovati ${partnersConListino.length} partner con listino assegnato`);

        if (partnersConListino.length > 0) {
            console.log('\nCAMPI DISPONIBILI in res.partner (esempio):');
            const campiPartner = Object.keys(partnersConListino[0]).sort();
            console.log(campiPartner.join(', '));

            risultati.modelli.res_partner = {
                campi: campiPartner,
                esempio: partnersConListino[0]
            };

            console.log('\n\nPARTNER CON LISTINO (primi 10):');
            partnersConListino.slice(0, 10).forEach(p => {
                console.log(`  - ${p.name}`);
                console.log(`    Listino: ${p.property_product_pricelist ? p.property_product_pricelist[1] : 'N/A'}`);
                console.log(`    Cliente: ${p.customer_rank > 0 ? 'Sì' : 'No'}`);
                console.log(`    Fornitore: ${p.supplier_rank > 0 ? 'Sì' : 'No'}`);
            });
        }

        risultati.esempi.partner_con_listino = partnersConListino;

        // ====================================================================
        // 4. ANALISI ORDINI DI VENDITA (sale.order)
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('4. ANALISI ORDINI DI VENDITA (sale.order)');
        console.log('='.repeat(80));

        const saleOrders = await odoo.execute_kw(
            'sale.order',
            'search_read',
            [[]],
            { limit: 10, order: 'id desc' }
        );

        console.log(`\n✓ Trovati ${saleOrders.length} ordini di vendita (ultimi)`);

        if (saleOrders.length > 0) {
            console.log('\nCAMPI DISPONIBILI in sale.order:');
            const campiOrdine = Object.keys(saleOrders[0]).sort();
            console.log(campiOrdine.join(', '));

            risultati.modelli.sale_order = {
                campi: campiOrdine,
                esempio: saleOrders[0]
            };

            console.log('\n\nDETTAGLIO ORDINI:');
            saleOrders.forEach(order => {
                console.log(`\n  ${order.name} (ID: ${order.id})`);
                console.log(`    Cliente: ${order.partner_id ? order.partner_id[1] : 'N/A'}`);
                console.log(`    Listino: ${order.pricelist_id ? order.pricelist_id[1] : 'N/A'}`);
                console.log(`    Stato: ${order.state}`);
                console.log(`    Totale: ${order.amount_total} ${order.currency_id ? order.currency_id[1] : ''}`);
                console.log(`    Righe: ${order.order_line ? order.order_line.length : 0}`);
            });
        }

        risultati.esempi.sale_orders = saleOrders;

        // ====================================================================
        // 5. ANALISI RIGHE ORDINE (sale.order.line)
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('5. ANALISI RIGHE ORDINE (sale.order.line)');
        console.log('='.repeat(80));

        const saleLines = await odoo.execute_kw(
            'sale.order.line',
            'search_read',
            [[]],
            { limit: 30, order: 'id desc' }
        );

        console.log(`\n✓ Trovate ${saleLines.length} righe ordine (ultime)`);

        if (saleLines.length > 0) {
            console.log('\nCAMPI DISPONIBILI in sale.order.line:');
            const campiRiga = Object.keys(saleLines[0]).sort();
            campiRiga.forEach(campo => {
                const valore = saleLines[0][campo];
                const tipo = Array.isArray(valore) ? 'array' : typeof valore;
                console.log(`  - ${campo}: ${tipo}`);
            });

            risultati.modelli.sale_order_line = {
                campi: campiRiga,
                esempio: saleLines[0]
            };

            console.log('\n\nESEMPI RIGHE ORDINE (prime 10):');
            saleLines.slice(0, 10).forEach(line => {
                console.log(`\n  Ordine: ${line.order_id ? line.order_id[1] : 'N/A'}`);
                console.log(`    Prodotto: ${line.product_id ? line.product_id[1] : 'N/A'}`);
                console.log(`    Quantità: ${line.product_uom_qty} ${line.product_uom ? line.product_uom[1] : ''}`);
                console.log(`    Prezzo Unitario: ${line.price_unit}`);
                console.log(`    Sconto: ${line.discount}%`);
                console.log(`    Subtotale: ${line.price_subtotal}`);
                console.log(`    Totale: ${line.price_total}`);
                if (line.price_reduce !== undefined) {
                    console.log(`    Prezzo Ridotto: ${line.price_reduce}`);
                }
            });
        }

        risultati.esempi.sale_order_lines = saleLines;

        // ====================================================================
        // 6. ANALISI PRODOTTI E PREZZI
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('6. ANALISI PRODOTTI (product.product)');
        console.log('='.repeat(80));

        const products = await odoo.execute_kw(
            'product.product',
            'search_read',
            [[['active', '=', true]]],
            { limit: 20 }
        );

        console.log(`\n✓ Trovati ${products.length} prodotti (esempi)`);

        if (products.length > 0) {
            console.log('\nCAMPI DISPONIBILI in product.product:');
            const campiProdotto = Object.keys(products[0]).sort();
            console.log(campiProdotto.join(', '));

            risultati.modelli.product_product = {
                campi: campiProdotto,
                esempio: products[0]
            };

            console.log('\n\nPRODOTTI CON PREZZI:');
            products.slice(0, 10).forEach(p => {
                console.log(`\n  ${p.name || p.display_name}`);
                console.log(`    ID: ${p.id}`);
                if (p.default_code) console.log(`    Cod: ${p.default_code}`);
                if (p.list_price !== undefined) console.log(`    Prezzo listino: ${p.list_price}`);
                if (p.standard_price !== undefined) console.log(`    Costo: ${p.standard_price}`);
                if (p.lst_price !== undefined) console.log(`    Prezzo pubblico: ${p.lst_price}`);
            });
        }

        risultati.esempi.products = products;

        // ====================================================================
        // 7. ESEMPIO PRATICO: REGOLE PER UN LISTINO SPECIFICO
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('7. ESEMPIO PRATICO: REGOLE PER LISTINO');
        console.log('='.repeat(80));

        if (pricelists.length > 0) {
            for (let i = 0; i < Math.min(3, pricelists.length); i++) {
                const listino = pricelists[i];
                const regoleListino = pricelistItems.filter(
                    r => r.pricelist_id && r.pricelist_id[0] === listino.id
                );

                console.log(`\n\nListino: ${listino.name} (ID: ${listino.id})`);
                console.log(`Discount Policy: ${listino.discount_policy}`);
                console.log(`Regole totali: ${regoleListino.length}`);

                if (regoleListino.length > 0) {
                    console.log('\nREGOLE ATTIVE (ordinate per priorità):');

                    // Ordina per min_quantity (regole specifiche per quantità)
                    const regoleOrdinate = [...regoleListino].sort((a, b) => {
                        // Prima per applied_on (prodotto specifico > categoria > globale)
                        if (a.applied_on !== b.applied_on) {
                            const priorita = { '0_product_variant': 3, '1_product': 2, '2_product_category': 1, '3_global': 0 };
                            return (priorita[b.applied_on] || 0) - (priorita[a.applied_on] || 0);
                        }
                        // Poi per min_quantity
                        return (b.min_quantity || 0) - (a.min_quantity || 0);
                    });

                    regoleOrdinate.slice(0, 10).forEach((r, idx) => {
                        console.log(`\n  ${idx + 1}. ID ${r.id} - Applied: ${r.applied_on}`);
                        if (r.product_id) console.log(`     Prodotto: ${r.product_id[1]}`);
                        if (r.categ_id) console.log(`     Categoria: ${r.categ_id[1]}`);
                        console.log(`     Min Qty: ${r.min_quantity}`);
                        console.log(`     Compute: ${r.compute_price}`);
                        if (r.base) console.log(`     Base: ${r.base}`);
                        if (r.fixed_price) console.log(`     → Prezzo fisso: ${r.fixed_price}`);
                        if (r.percent_price) console.log(`     → Percentuale: ${r.percent_price}%`);
                        if (r.price_discount) console.log(`     → Sconto: ${r.price_discount}%`);
                        if (r.price_surcharge) console.log(`     → Sovrapprezzo: ${r.price_surcharge}`);
                        if (r.date_start || r.date_end) {
                            console.log(`     Periodo: ${r.date_start || '∞'} → ${r.date_end || '∞'}`);
                        }
                    });
                }

                risultati.logica_calcolo[`esempio_listino_${listino.id}`] = {
                    listino: listino,
                    regole: regoleListino
                };
            }
        }

        // ====================================================================
        // 8. DOCUMENTAZIONE LOGICA
        // ====================================================================
        console.log('\n\n' + '='.repeat(80));
        console.log('8. DOCUMENTAZIONE LOGICA PREZZI');
        console.log('='.repeat(80));

        risultati.documentazione.logica_applicazione = {
            descrizione: "Come Odoo calcola i prezzi con i listini",
            passi: [
                "1. Identifica il listino del partner (res.partner.property_product_pricelist)",
                "2. Trova tutte le regole attive per quel listino (product.pricelist.item)",
                "3. Filtra le regole applicabili:",
                "   - Verifica il campo 'applied_on' (prodotto specifico, categoria, globale)",
                "   - Verifica 'min_quantity' (quantità ordinata >= min_quantity)",
                "   - Verifica date_start e date_end se presenti",
                "4. Ordina le regole per priorità:",
                "   - Prima: prodotto specifico (0_product_variant)",
                "   - Poi: template prodotto (1_product)",
                "   - Poi: categoria (2_product_category)",
                "   - Infine: globale (3_global)",
                "   - A parità di applied_on, usa min_quantity più alta",
                "5. Applica la prima regola che corrisponde",
                "6. Calcola il prezzo in base a 'compute_price':",
                "   - 'fixed': usa fixed_price",
                "   - 'percentage': applica percent_price sul prezzo base",
                "   - 'formula': applica price_discount + price_surcharge",
                "7. Verifica margini min/max se configurati",
                "8. Applica discount_policy del listino"
            ],
            campi_chiave: {
                "applied_on": "Dove si applica: 0_product_variant, 1_product, 2_product_category, 3_global",
                "compute_price": "Come calcolare: fixed, percentage, formula",
                "base": "Base di calcolo: list_price, standard_price, pricelist (altro listino)",
                "min_quantity": "Quantità minima per attivare la regola",
                "fixed_price": "Prezzo fisso (se compute_price=fixed)",
                "percent_price": "Percentuale da applicare (se compute_price=percentage)",
                "price_discount": "Sconto percentuale (se compute_price=formula)",
                "price_surcharge": "Sovrapprezzo fisso (se compute_price=formula)",
                "price_min_margin": "Margine minimo richiesto",
                "price_max_margin": "Margine massimo consentito",
                "discount_policy": "Politica sconto: with_discount, without_discount"
            }
        };

        console.log('\nLOGICA DI CALCOLO PREZZI:');
        console.log(JSON.stringify(risultati.documentazione.logica_applicazione, null, 2));

        // ====================================================================
        // 9. CODICE ESEMPIO API
        // ====================================================================
        risultati.documentazione.esempi_codice = {
            "ottenere_listino_cliente": {
                descrizione: "Ottiene il listino assegnato a un cliente",
                codice: `
const partner = await odoo.execute_kw(
    'res.partner',
    'read',
    [[partnerId]],
    { fields: ['property_product_pricelist'] }
);
const pricelistId = partner[0].property_product_pricelist[0];
`
            },
            "ottenere_regole_listino": {
                descrizione: "Ottiene tutte le regole di un listino",
                codice: `
const items = await odoo.execute_kw(
    'product.pricelist.item',
    'search_read',
    [[['pricelist_id', '=', pricelistId]]],
    {
        fields: [
            'applied_on', 'product_id', 'product_tmpl_id', 'categ_id',
            'min_quantity', 'compute_price', 'base',
            'fixed_price', 'percent_price', 'price_discount', 'price_surcharge',
            'date_start', 'date_end'
        ]
    }
);
`
            },
            "calcolare_prezzo_prodotto": {
                descrizione: "Calcola il prezzo di un prodotto con un listino",
                codice: `
// Metodo 1: Usa il metodo get_product_price di Odoo
const prezzo = await odoo.execute_kw(
    'product.pricelist',
    'get_product_price',
    [pricelistId, productId, quantity, partnerId]
);

// Metodo 2: price_get (più flessibile)
const prezzi = await odoo.execute_kw(
    'product.pricelist',
    'price_get',
    [productId, quantity],
    {
        pricelist_id: pricelistId,
        partner_id: partnerId
    }
);
`
            },
            "creare_riga_ordine_con_prezzo_corretto": {
                descrizione: "Crea una riga ordine con il prezzo del listino",
                codice: `
const lineId = await odoo.execute_kw(
    'sale.order.line',
    'create',
    [{
        order_id: orderId,
        product_id: productId,
        product_uom_qty: quantity,
        // Il prezzo viene calcolato automaticamente dal listino dell'ordine
        // Oppure puoi specificarlo manualmente:
        price_unit: prezzoCalcolato,
        discount: scontoPercentuale
    }]
);
`
            }
        };

        console.log('\n\nESEMPI CODICE API salvati nella documentazione');

        // ====================================================================
        // SALVA RISULTATI
        // ====================================================================
        await fs.writeFile(
            'c:\\Users\\lapa\\OneDrive\\Desktop\\Claude Code\\ANALISI_LISTINI_ODOO.json',
            JSON.stringify(risultati, null, 2)
        );

        console.log('\n\n' + '='.repeat(80));
        console.log('ANALISI COMPLETATA CON SUCCESSO');
        console.log('='.repeat(80));
        console.log('\n✓ File salvato: ANALISI_LISTINI_ODOO.json');
        console.log(`\nStatistiche:`);
        console.log(`  - Listini trovati: ${pricelists.length}`);
        console.log(`  - Regole di prezzo: ${pricelistItems.length}`);
        console.log(`  - Partner con listino: ${partnersConListino.length}`);
        console.log(`  - Ordini analizzati: ${saleOrders.length}`);
        console.log(`  - Righe ordine analizzate: ${saleLines.length}`);
        console.log(`  - Prodotti analizzati: ${products.length}`);

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
