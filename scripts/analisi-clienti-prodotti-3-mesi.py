#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANALISI CLIENTI E PRODOTTI - ULTIMI 3 MESI
==========================================
Analisi dettagliata degli ordini consegnati per:
1. Clienti che hanno comprato meno (analisi settimanale e mensile)
2. Prodotti che hanno diminuito il fatturato (analisi settimanale e mensile)

Richiede: xmlrpc, pandas, matplotlib, numpy
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

# ========================================
# CONFIGURAZIONE ODOO
# ========================================
ODOO_URL = "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-main-7268478"
ODOO_USERNAME = "apphubplatform@lapa.ch"
ODOO_PASSWORD = "apphubplatform2025"

# ========================================
# PERIODI DI ANALISI
# ========================================
def calcola_periodi():
    """Calcola i periodi per l'analisi degli ultimi 3 mesi"""
    oggi = datetime.now()
    tre_mesi_fa = oggi - timedelta(days=90)

    # Analisi settimanale
    settimane = []
    for i in range(12):  # 12 settimane = ~3 mesi
        fine_settimana = oggi - timedelta(weeks=i)
        inizio_settimana = fine_settimana - timedelta(days=7)
        settimane.append({
            'nome': f'Settimana {12-i}',
            'inizio': inizio_settimana.strftime('%Y-%m-%d'),
            'fine': fine_settimana.strftime('%Y-%m-%d')
        })

    # Analisi mensile
    mesi = []
    for i in range(3):
        fine_mese = oggi - timedelta(days=30*i)
        inizio_mese = fine_mese - timedelta(days=30)
        mesi.append({
            'nome': f'Mese {3-i}',
            'inizio': inizio_mese.strftime('%Y-%m-%d'),
            'fine': fine_mese.strftime('%Y-%m-%d')
        })

    return {
        'settimane': list(reversed(settimane)),
        'mesi': list(reversed(mesi)),
        'inizio_totale': tre_mesi_fa.strftime('%Y-%m-%d'),
        'fine_totale': oggi.strftime('%Y-%m-%d')
    }


# ========================================
# CONNESSIONE ODOO
# ========================================
def connetti_odoo():
    """Stabilisce la connessione con Odoo"""
    print("\n" + "="*60)
    print("🔌 CONNESSIONE AD ODOO")
    print("="*60)
    print(f"URL: {ODOO_URL}")
    print(f"DB:  {ODOO_DB}")
    print(f"User: {ODOO_USERNAME}")

    # Ignora SSL warnings per connessioni di sviluppo
    context = ssl._create_unverified_context()

    common = xmlrpc.client.ServerProxy(
        f'{ODOO_URL}/xmlrpc/2/common',
        context=context
    )

    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("❌ Autenticazione fallita!")

    print(f"✅ Autenticato con UID: {uid}")

    models = xmlrpc.client.ServerProxy(
        f'{ODOO_URL}/xmlrpc/2/object',
        context=context
    )

    return uid, models


# ========================================
# ESTRAZIONE DATI ORDINI CONSEGNATI
# ========================================
def estrai_ordini_consegnati(uid, models, data_inizio, data_fine):
    """Estrae tutti gli ordini consegnati nel periodo specificato"""
    print(f"\n📦 Estrazione ordini consegnati dal {data_inizio} al {data_fine}")

    # Cerca ordini di vendita confermati
    ordini = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'sale.order', 'search_read',
        [[
            ('state', 'in', ['sale', 'done']),  # Ordini confermati o completati
            ('date_order', '>=', data_inizio),
            ('date_order', '<=', data_fine)
        ]],
        {
            'fields': ['id', 'name', 'partner_id', 'date_order',
                      'amount_total', 'amount_untaxed', 'state',
                      'picking_ids', 'order_line']
        }
    )

    print(f"   Trovati {len(ordini)} ordini confermati")

    # Filtra solo ordini con consegne completate
    ordini_consegnati = []
    for ordine in ordini:
        if ordine.get('picking_ids'):
            # Verifica stato consegne
            picking_ids = ordine['picking_ids']
            pickings = models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                'stock.picking', 'search_read',
                [[('id', 'in', picking_ids)]],
                {'fields': ['state', 'date_done']}
            )

            # Conta quante consegne sono completate
            consegnate = sum(1 for p in pickings if p['state'] == 'done')
            if consegnate > 0:  # Almeno una consegna completata
                ordini_consegnati.append(ordine)

    print(f"   ✅ {len(ordini_consegnati)} ordini con consegne completate")
    return ordini_consegnati


# ========================================
# ESTRAZIONE DETTAGLI PRODOTTI
# ========================================
def estrai_dettagli_ordini(uid, models, ordini):
    """Estrae i dettagli delle righe ordine per ogni ordine"""
    print(f"\n📋 Estrazione dettagli prodotti da {len(ordini)} ordini")

    dettagli = []
    for idx, ordine in enumerate(ordini, 1):
        if idx % 10 == 0:
            print(f"   Processati {idx}/{len(ordini)} ordini...")

        order_line_ids = ordine.get('order_line', [])
        if not order_line_ids:
            continue

        # Leggi le righe ordine
        righe = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'sale.order.line', 'search_read',
            [[('id', 'in', order_line_ids)]],
            {
                'fields': ['product_id', 'product_uom_qty', 'price_unit',
                          'price_subtotal', 'qty_delivered']
            }
        )

        for riga in righe:
            if riga.get('qty_delivered', 0) > 0:  # Solo prodotti consegnati
                dettagli.append({
                    'ordine_id': ordine['id'],
                    'ordine_name': ordine['name'],
                    'cliente_id': ordine['partner_id'][0] if ordine['partner_id'] else None,
                    'cliente_name': ordine['partner_id'][1] if ordine['partner_id'] else 'Sconosciuto',
                    'data_ordine': ordine['date_order'],
                    'prodotto_id': riga['product_id'][0] if riga['product_id'] else None,
                    'prodotto_name': riga['product_id'][1] if riga['product_id'] else 'Sconosciuto',
                    'quantita': riga['qty_delivered'],
                    'prezzo_unitario': riga['price_unit'],
                    'totale': riga['price_subtotal']
                })

    print(f"   ✅ Estratti {len(dettagli)} righe prodotti consegnati")
    return dettagli


# ========================================
# ANALISI CLIENTI
# ========================================
def analizza_clienti_per_periodo(dettagli, periodi):
    """Analizza i clienti che hanno comprato meno per ogni periodo"""
    print("\n" + "="*60)
    print("👥 ANALISI CLIENTI PER PERIODO")
    print("="*60)

    risultati = {
        'settimanale': [],
        'mensile': [],
        'confronto_globale': {}
    }

    # Analizza per settimana
    print("\n📊 Analisi Settimanale:")
    for settimana in periodi['settimane']:
        vendite_clienti = defaultdict(float)

        for d in dettagli:
            data = d['data_ordine'][:10]
            if settimana['inizio'] <= data <= settimana['fine']:
                vendite_clienti[d['cliente_name']] += d['totale']

        # Ordina per fatturato crescente (chi ha comprato meno)
        clienti_ordinati = sorted(vendite_clienti.items(), key=lambda x: x[1])

        risultati['settimanale'].append({
            'periodo': settimana['nome'],
            'date': f"{settimana['inizio']} / {settimana['fine']}",
            'top_10_meno': clienti_ordinati[:10],
            'totale_clienti': len(vendite_clienti)
        })

        print(f"\n   {settimana['nome']} ({settimana['inizio']} / {settimana['fine']})")
        print(f"   Totale clienti attivi: {len(vendite_clienti)}")
        if clienti_ordinati:
            print(f"   Top 3 che hanno comprato meno:")
            for i, (cliente, totale) in enumerate(clienti_ordinati[:3], 1):
                print(f"      {i}. {cliente}: €{totale:,.2f}")

    # Analizza per mese
    print("\n📊 Analisi Mensile:")
    for mese in periodi['mesi']:
        vendite_clienti = defaultdict(float)

        for d in dettagli:
            data = d['data_ordine'][:10]
            if mese['inizio'] <= data <= mese['fine']:
                vendite_clienti[d['cliente_name']] += d['totale']

        # Ordina per fatturato crescente (chi ha comprato meno)
        clienti_ordinati = sorted(vendite_clienti.items(), key=lambda x: x[1])

        risultati['mensile'].append({
            'periodo': mese['nome'],
            'date': f"{mese['inizio']} / {mese['fine']}",
            'top_10_meno': clienti_ordinati[:10],
            'totale_clienti': len(vendite_clienti)
        })

        print(f"\n   {mese['nome']} ({mese['inizio']} / {mese['fine']})")
        print(f"   Totale clienti attivi: {len(vendite_clienti)}")
        if clienti_ordinati:
            print(f"   Top 5 che hanno comprato meno:")
            for i, (cliente, totale) in enumerate(clienti_ordinati[:5], 1):
                print(f"      {i}. {cliente}: €{totale:,.2f}")

    # Confronto globale: chi ha comprato meno in media
    vendite_totali = defaultdict(float)
    for d in dettagli:
        vendite_totali[d['cliente_name']] += d['totale']

    clienti_ordinati = sorted(vendite_totali.items(), key=lambda x: x[1])
    risultati['confronto_globale'] = {
        'top_20_meno': clienti_ordinati[:20],
        'totale_clienti': len(vendite_totali)
    }

    print(f"\n📊 Confronto Globale (3 mesi):")
    print(f"   Totale clienti attivi: {len(vendite_totali)}")
    print(f"   Top 10 che hanno comprato meno:")
    for i, (cliente, totale) in enumerate(clienti_ordinati[:10], 1):
        print(f"      {i}. {cliente}: €{totale:,.2f}")

    return risultati


# ========================================
# ANALISI PRODOTTI
# ========================================
def analizza_prodotti_per_periodo(dettagli, periodi):
    """Analizza i prodotti che hanno diminuito il fatturato per ogni periodo"""
    print("\n" + "="*60)
    print("📦 ANALISI PRODOTTI PER PERIODO")
    print("="*60)

    risultati = {
        'settimanale': [],
        'mensile': [],
        'diminuzione_globale': {}
    }

    # Analizza per settimana
    print("\n📊 Analisi Settimanale:")
    vendite_settimanali = defaultdict(lambda: [0] * len(periodi['settimane']))

    for idx, settimana in enumerate(periodi['settimane']):
        for d in dettagli:
            data = d['data_ordine'][:10]
            if settimana['inizio'] <= data <= settimana['fine']:
                vendite_settimanali[d['prodotto_name']][idx] += d['totale']

    # Calcola diminuzione settimana per settimana
    prodotti_in_calo = []
    for prodotto, vendite in vendite_settimanali.items():
        # Calcola trend (differenza tra media prima metà e seconda metà)
        if len(vendite) >= 2:
            meta = len(vendite) // 2
            media_prima = sum(vendite[:meta]) / meta if meta > 0 else 0
            media_dopo = sum(vendite[meta:]) / (len(vendite) - meta) if (len(vendite) - meta) > 0 else 0
            diminuzione = media_prima - media_dopo

            if diminuzione > 0:  # Prodotto in calo
                percentuale = (diminuzione / media_prima * 100) if media_prima > 0 else 0
                prodotti_in_calo.append({
                    'prodotto': prodotto,
                    'diminuzione': diminuzione,
                    'percentuale': percentuale,
                    'vendite': vendite
                })

    # Ordina per diminuzione (maggiore)
    prodotti_in_calo.sort(key=lambda x: x['diminuzione'], reverse=True)
    risultati['settimanale'] = prodotti_in_calo[:30]

    print(f"\n   Top 10 prodotti con maggior calo settimanale:")
    for i, p in enumerate(prodotti_in_calo[:10], 1):
        print(f"      {i}. {p['prodotto']}")
        print(f"         Calo: €{p['diminuzione']:,.2f} (-{p['percentuale']:.1f}%)")

    # Analizza per mese
    print("\n📊 Analisi Mensile:")
    vendite_mensili = defaultdict(lambda: [0] * len(periodi['mesi']))

    for idx, mese in enumerate(periodi['mesi']):
        for d in dettagli:
            data = d['data_ordine'][:10]
            if mese['inizio'] <= data <= mese['fine']:
                vendite_mensili[d['prodotto_name']][idx] += d['totale']

    # Calcola diminuzione mese per mese
    prodotti_in_calo_mensile = []
    for prodotto, vendite in vendite_mensili.items():
        if len(vendite) == 3:
            # Confronta mese 1 con mese 3
            diminuzione = vendite[0] - vendite[2]
            if diminuzione > 0:
                percentuale = (diminuzione / vendite[0] * 100) if vendite[0] > 0 else 0
                prodotti_in_calo_mensile.append({
                    'prodotto': prodotto,
                    'diminuzione': diminuzione,
                    'percentuale': percentuale,
                    'vendite': vendite,
                    'mese_1': vendite[0],
                    'mese_2': vendite[1],
                    'mese_3': vendite[2]
                })

    prodotti_in_calo_mensile.sort(key=lambda x: x['diminuzione'], reverse=True)
    risultati['mensile'] = prodotti_in_calo_mensile[:30]

    print(f"\n   Top 10 prodotti con maggior calo mensile:")
    for i, p in enumerate(prodotti_in_calo_mensile[:10], 1):
        print(f"      {i}. {p['prodotto']}")
        print(f"         Mese 1: €{p['mese_1']:,.2f}")
        print(f"         Mese 2: €{p['mese_2']:,.2f}")
        print(f"         Mese 3: €{p['mese_3']:,.2f}")
        print(f"         Calo totale: €{p['diminuzione']:,.2f} (-{p['percentuale']:.1f}%)")

    return risultati


# ========================================
# SALVATAGGIO RISULTATI
# ========================================
def salva_risultati(analisi_clienti, analisi_prodotti, periodi):
    """Salva i risultati in un file JSON dettagliato"""

    output_dir = os.path.join(os.path.dirname(__file__), '..', 'analisi-output')
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'analisi-clienti-prodotti-3-mesi-{timestamp}.json'
    filepath = os.path.join(output_dir, filename)

    risultati = {
        'timestamp': datetime.now().isoformat(),
        'periodi': periodi,
        'analisi_clienti': {
            'settimanale': [
                {
                    'periodo': s['periodo'],
                    'date': s['date'],
                    'totale_clienti': s['totale_clienti'],
                    'top_10_meno': [(c, float(v)) for c, v in s['top_10_meno']]
                }
                for s in analisi_clienti['settimanale']
            ],
            'mensile': [
                {
                    'periodo': m['periodo'],
                    'date': m['date'],
                    'totale_clienti': m['totale_clienti'],
                    'top_10_meno': [(c, float(v)) for c, v in m['top_10_meno']]
                }
                for m in analisi_clienti['mensile']
            ],
            'confronto_globale': {
                'totale_clienti': analisi_clienti['confronto_globale']['totale_clienti'],
                'top_20_meno': [(c, float(v)) for c, v in analisi_clienti['confronto_globale']['top_20_meno']]
            }
        },
        'analisi_prodotti': {
            'settimanale': [
                {
                    'prodotto': p['prodotto'],
                    'diminuzione': float(p['diminuzione']),
                    'percentuale': float(p['percentuale']),
                    'vendite_settimanali': [float(v) for v in p['vendite']]
                }
                for p in analisi_prodotti['settimanale']
            ],
            'mensile': [
                {
                    'prodotto': p['prodotto'],
                    'diminuzione': float(p['diminuzione']),
                    'percentuale': float(p['percentuale']),
                    'mese_1': float(p['mese_1']),
                    'mese_2': float(p['mese_2']),
                    'mese_3': float(p['mese_3'])
                }
                for p in analisi_prodotti['mensile']
            ]
        }
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(risultati, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Risultati salvati in: {filepath}")

    # Crea anche un report testuale
    report_filename = f'analisi-clienti-prodotti-3-mesi-{timestamp}.txt'
    report_filepath = os.path.join(output_dir, report_filename)

    with open(report_filepath, 'w', encoding='utf-8') as f:
        f.write("="*80 + "\n")
        f.write("ANALISI CLIENTI E PRODOTTI - ULTIMI 3 MESI\n")
        f.write("="*80 + "\n")
        f.write(f"Generato il: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Periodo: {periodi['inizio_totale']} / {periodi['fine_totale']}\n")
        f.write("\n")

        # CLIENTI
        f.write("="*80 + "\n")
        f.write("ANALISI CLIENTI - CHI HA COMPRATO MENO\n")
        f.write("="*80 + "\n\n")

        f.write("ANALISI MENSILE:\n")
        f.write("-" * 80 + "\n")
        for m in analisi_clienti['mensile']:
            f.write(f"\n{m['periodo']} ({m['date']})\n")
            f.write(f"Totale clienti attivi: {m['totale_clienti']}\n")
            f.write("Top 10 che hanno comprato meno:\n")
            for i, (cliente, totale) in enumerate(m['top_10_meno'], 1):
                f.write(f"   {i:2}. {cliente:50} €{totale:12,.2f}\n")

        f.write("\n" + "="*80 + "\n")
        f.write("CONFRONTO GLOBALE (3 MESI)\n")
        f.write("="*80 + "\n")
        f.write(f"Totale clienti attivi: {analisi_clienti['confronto_globale']['totale_clienti']}\n")
        f.write("Top 20 che hanno comprato meno:\n")
        for i, (cliente, totale) in enumerate(analisi_clienti['confronto_globale']['top_20_meno'], 1):
            f.write(f"   {i:2}. {cliente:50} €{totale:12,.2f}\n")

        # PRODOTTI
        f.write("\n\n" + "="*80 + "\n")
        f.write("ANALISI PRODOTTI - DIMINUZIONE FATTURATO\n")
        f.write("="*80 + "\n\n")

        f.write("ANALISI MENSILE:\n")
        f.write("-" * 80 + "\n")
        f.write("Top 30 prodotti con maggior calo:\n\n")
        for i, p in enumerate(analisi_prodotti['mensile'], 1):
            f.write(f"{i:2}. {p['prodotto']}\n")
            f.write(f"    Mese 1: €{p['mese_1']:10,.2f}\n")
            f.write(f"    Mese 2: €{p['mese_2']:10,.2f}\n")
            f.write(f"    Mese 3: €{p['mese_3']:10,.2f}\n")
            f.write(f"    Calo:   €{p['diminuzione']:10,.2f} (-{p['percentuale']:.1f}%)\n\n")

    print(f"💾 Report testuale salvato in: {report_filepath}")

    return filepath, report_filepath


# ========================================
# FUNZIONE PRINCIPALE
# ========================================
def main():
    """Funzione principale"""
    print("\n" + "="*60)
    print("🚀 ANALISI CLIENTI E PRODOTTI - ULTIMI 3 MESI")
    print("="*60)

    try:
        # 1. Calcola periodi
        periodi = calcola_periodi()
        print(f"\n📅 Periodo analisi: {periodi['inizio_totale']} / {periodi['fine_totale']}")
        print(f"   Settimane da analizzare: {len(periodi['settimane'])}")
        print(f"   Mesi da analizzare: {len(periodi['mesi'])}")

        # 2. Connetti ad Odoo
        uid, models = connetti_odoo()

        # 3. Estrai ordini consegnati
        ordini = estrai_ordini_consegnati(
            uid, models,
            periodi['inizio_totale'],
            periodi['fine_totale']
        )

        if not ordini:
            print("\n⚠️ Nessun ordine consegnato trovato nel periodo!")
            return

        # 4. Estrai dettagli prodotti
        dettagli = estrai_dettagli_ordini(uid, models, ordini)

        if not dettagli:
            print("\n⚠️ Nessun dettaglio prodotto trovato!")
            return

        # 5. Analisi clienti
        analisi_clienti = analizza_clienti_per_periodo(dettagli, periodi)

        # 6. Analisi prodotti
        analisi_prodotti = analizza_prodotti_per_periodo(dettagli, periodi)

        # 7. Salva risultati
        json_file, txt_file = salva_risultati(analisi_clienti, analisi_prodotti, periodi)

        print("\n" + "="*60)
        print("✅ ANALISI COMPLETATA CON SUCCESSO!")
        print("="*60)
        print(f"\n📊 Statistiche:")
        print(f"   • Ordini consegnati analizzati: {len(ordini)}")
        print(f"   • Righe prodotto elaborate: {len(dettagli)}")
        print(f"   • Clienti unici: {analisi_clienti['confronto_globale']['totale_clienti']}")
        print(f"   • Prodotti in calo (settimana): {len(analisi_prodotti['settimanale'])}")
        print(f"   • Prodotti in calo (mese): {len(analisi_prodotti['mensile'])}")
        print(f"\n📁 File generati:")
        print(f"   • JSON: {json_file}")
        print(f"   • TXT:  {txt_file}")

    except Exception as e:
        print(f"\n❌ ERRORE: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
