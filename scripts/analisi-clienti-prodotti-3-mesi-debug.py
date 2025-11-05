#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANALISI CLIENTI E PRODOTTI - ULTIMI 3 MESI (VERSIONE DEBUG)
"""

import sys
import io
import xmlrpc.client
import ssl
from datetime import datetime, timedelta
from collections import defaultdict
import json
import os

# Fix encoding su Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-main-7268478"
ODOO_USERNAME = "apphubplatform@lapa.ch"
ODOO_PASSWORD = "apphubplatform2025"

def main():
    print("=" * 60)
    print("INIZIO ANALISI - DEBUG")
    print("=" * 60)

    try:
        # Calcola periodo (solo ultimi 3 mesi)
        oggi = datetime.now()
        tre_mesi_fa = oggi - timedelta(days=90)

        print(f"\nPeriodo: {tre_mesi_fa.strftime('%Y-%m-%d')} -> {oggi.strftime('%Y-%m-%d')}")

        # Connessione Odoo
        print("\n[1/5] Connessione a Odoo...")
        context = ssl._create_unverified_context()

        common = xmlrpc.client.ServerProxy(
            f'{ODOO_URL}/xmlrpc/2/common',
            context=context
        )

        print(f"   Autenticazione...")
        uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

        if not uid:
            print("   ERRORE: Autenticazione fallita!")
            return

        print(f"   OK - UID: {uid}")

        models = xmlrpc.client.ServerProxy(
            f'{ODOO_URL}/xmlrpc/2/object',
            context=context
        )

        # Estrai ordini
        print("\n[2/5] Ricerca ordini confermati...")
        ordini = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'sale.order', 'search_read',
            [[
                ('state', 'in', ['sale', 'done']),
                ('date_order', '>=', tre_mesi_fa.strftime('%Y-%m-%d')),
                ('date_order', '<=', oggi.strftime('%Y-%m-%d'))
            ]],
            {
                'fields': ['id', 'name', 'partner_id', 'date_order',
                          'amount_total', 'picking_ids', 'order_line'],
                'limit': 1000  # Limita per debug
            }
        )

        print(f"   Trovati {len(ordini)} ordini")

        if not ordini:
            print("   ATTENZIONE: Nessun ordine trovato!")
            return

        # Filtra ordini consegnati
        print("\n[3/5] Verifica consegne completate...")
        ordini_consegnati = []

        for idx, ordine in enumerate(ordini):
            if idx % 50 == 0:
                print(f"   Processati {idx}/{len(ordini)} ordini...")

            if ordine.get('picking_ids'):
                picking_ids = ordine['picking_ids']

                try:
                    pickings = models.execute_kw(
                        ODOO_DB, uid, ODOO_PASSWORD,
                        'stock.picking', 'search_read',
                        [[('id', 'in', picking_ids)]],
                        {'fields': ['state']}
                    )

                    consegnate = sum(1 for p in pickings if p['state'] == 'done')
                    if consegnate > 0:
                        ordini_consegnati.append(ordine)
                except Exception as e:
                    print(f"   ERRORE picking {picking_ids}: {e}")
                    continue

        print(f"   OK - {len(ordini_consegnati)} ordini consegnati")

        if not ordini_consegnati:
            print("   ATTENZIONE: Nessun ordine consegnato trovato!")
            return

        # Estrai dettagli prodotti
        print("\n[4/5] Estrazione dettagli prodotti...")
        dettagli = []

        for idx, ordine in enumerate(ordini_consegnati):
            if idx % 20 == 0:
                print(f"   Processati {idx}/{len(ordini_consegnati)} ordini...")

            order_line_ids = ordine.get('order_line', [])
            if not order_line_ids:
                continue

            try:
                righe = models.execute_kw(
                    ODOO_DB, uid, ODOO_PASSWORD,
                    'sale.order.line', 'search_read',
                    [[('id', 'in', order_line_ids)]],
                    {
                        'fields': ['product_id', 'price_subtotal', 'qty_delivered']
                    }
                )

                for riga in righe:
                    if riga.get('qty_delivered', 0) > 0:
                        dettagli.append({
                            'cliente_id': ordine['partner_id'][0] if ordine['partner_id'] else None,
                            'cliente_name': ordine['partner_id'][1] if ordine['partner_id'] else 'Sconosciuto',
                            'data_ordine': ordine['date_order'][:10],
                            'prodotto_id': riga['product_id'][0] if riga['product_id'] else None,
                            'prodotto_name': riga['product_id'][1] if riga['product_id'] else 'Sconosciuto',
                            'totale': riga['price_subtotal']
                        })
            except Exception as e:
                print(f"   ERRORE righe ordine {order_line_ids}: {e}")
                continue

        print(f"   OK - {len(dettagli)} righe prodotto estratte")

        if not dettagli:
            print("   ATTENZIONE: Nessun dettaglio prodotto trovato!")
            return

        # Analisi semplificata
        print("\n[5/5] Analisi dati...")

        # Clienti per fatturato
        vendite_clienti = defaultdict(float)
        for d in dettagli:
            vendite_clienti[d['cliente_name']] += d['totale']

        clienti_ordinati = sorted(vendite_clienti.items(), key=lambda x: x[1])

        print(f"\n   Totale clienti attivi: {len(vendite_clienti)}")
        print(f"\n   TOP 20 CLIENTI CHE HANNO COMPRATO MENO:")
        for i, (cliente, totale) in enumerate(clienti_ordinati[:20], 1):
            print(f"      {i:2}. {cliente[:50]:50} EUR {totale:12,.2f}")

        # Prodotti per fatturato
        vendite_prodotti = defaultdict(float)
        for d in dettagli:
            vendite_prodotti[d['prodotto_name']] += d['totale']

        prodotti_ordinati = sorted(vendite_prodotti.items(), key=lambda x: x[1])

        print(f"\n   Totale prodotti venduti: {len(vendite_prodotti)}")
        print(f"\n   TOP 20 PRODOTTI CON MINOR FATTURATO:")
        for i, (prodotto, totale) in enumerate(prodotti_ordinati[:20], 1):
            print(f"      {i:2}. {prodotto[:50]:50} EUR {totale:12,.2f}")

        # Salva risultati
        output_dir = os.path.join(os.path.dirname(__file__), '..', 'analisi-output')
        os.makedirs(output_dir, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'analisi-debug-{timestamp}.json'
        filepath = os.path.join(output_dir, filename)

        risultati = {
            'timestamp': datetime.now().isoformat(),
            'periodo': {
                'inizio': tre_mesi_fa.strftime('%Y-%m-%d'),
                'fine': oggi.strftime('%Y-%m-%d')
            },
            'statistiche': {
                'ordini_totali': len(ordini),
                'ordini_consegnati': len(ordini_consegnati),
                'righe_prodotto': len(dettagli),
                'clienti_unici': len(vendite_clienti),
                'prodotti_unici': len(vendite_prodotti)
            },
            'top_20_clienti_meno': [(c, float(v)) for c, v in clienti_ordinati[:20]],
            'top_20_prodotti_meno': [(p, float(v)) for p, v in prodotti_ordinati[:20]]
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(risultati, f, indent=2, ensure_ascii=False)

        print(f"\n\nRisultati salvati in: {filepath}")
        print("\n" + "=" * 60)
        print("ANALISI COMPLETATA CON SUCCESSO!")
        print("=" * 60)

    except Exception as e:
        print(f"\nERRORE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
