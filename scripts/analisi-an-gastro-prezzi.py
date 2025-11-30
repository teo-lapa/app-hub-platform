#!/usr/bin/env python3
"""
Analisi Ordini e Prezzi per AN Gastro GmbH
=========================================

Estrae tutti gli ordini di vendita dal 1° gennaio 2025 ad oggi per il cliente
"AN Gastro GmbH", analizza le variazioni di prezzo dei prodotti e calcola
l'impatto di possibili variazioni di prezzo.

Output:
- Excel report con 3 sheet (Dettaglio Prodotti, Ordini, Simulazione Impatti)
- Riepilogo analitico in console
"""

import xmlrpc.client
import os
from datetime import datetime
from collections import defaultdict
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils.dataframe import dataframe_to_rows

# ============================================================================
# CONFIGURAZIONE ODOO
# ============================================================================
# Usa ambiente Staging (production non raggiungibile)
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Cliente da analizzare
TARGET_CUSTOMER = "AN Gastro GmbH"

# Periodo di analisi: dal 1° gennaio 2025 ad oggi
DATA_INIZIO = "2025-01-01"
DATA_FINE = datetime.now().strftime("%Y-%m-%d")

# Directory per report
REPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

print("=" * 80)
print(f"ANALISI ORDINI E PREZZI: {TARGET_CUSTOMER}")
print("=" * 80)
print(f"Periodo: {DATA_INIZIO} -> {DATA_FINE}")
print(f"Odoo: {ODOO_URL}")
print(f"Database: {ODOO_DB}")
print()

# ============================================================================
# CONNESSIONE ODOO
# ============================================================================
print("[1/7] Connessione a Odoo...")
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Autenticazione
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
if not uid:
    print("[ERROR] ERRORE: Autenticazione fallita!")
    exit(1)

print(f"[OK] Autenticato con successo (UID: {uid})")
print()

# ============================================================================
# RICERCA CLIENTE
# ============================================================================
print(f"[2/7] Ricerca cliente '{TARGET_CUSTOMER}'...")
partners = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'res.partner', 'search_read',
    [[['name', '=', TARGET_CUSTOMER]]],
    {'fields': ['id', 'name', 'customer_rank', 'email', 'phone', 'city']}
)

if not partners:
    print(f"[ERROR] ERRORE: Cliente '{TARGET_CUSTOMER}' non trovato!")
    exit(1)

partner = partners[0]
partner_id = partner['id']
print(f"[OK] Cliente trovato:")
print(f"  ID: {partner_id}")
print(f"  Nome: {partner['name']}")
print(f"  Email: {partner.get('email', 'N/A')}")
print(f"  Telefono: {partner.get('phone', 'N/A')}")
print(f"  Città: {partner.get('city', 'N/A')}")
print(f"  Customer Rank: {partner.get('customer_rank', 0)}")
print()

# ============================================================================
# ESTRAZIONE ORDINI DI VENDITA
# ============================================================================
print("[3/7] Estrazione ordini di vendita...")
ordini = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'sale.order', 'search_read',
    [[
        ('partner_id', '=', partner_id),
        ('state', 'in', ['sale', 'done']),  # Solo ordini confermati/completati
        ('date_order', '>=', DATA_INIZIO),
        ('date_order', '<=', DATA_FINE)
    ]],
    {
        'fields': [
            'id', 'name', 'date_order', 'commitment_date',
            'amount_total', 'amount_untaxed', 'amount_tax',
            'state', 'order_line', 'user_id', 'pricelist_id'
        ],
        'order': 'date_order asc'
    }
)

if not ordini:
    print(f"[WARN]  Nessun ordine trovato per {TARGET_CUSTOMER} nel periodo {DATA_INIZIO} - {DATA_FINE}")
    exit(0)

print(f"[OK] Trovati {len(ordini)} ordini nel periodo")
totale_complessivo = sum(o['amount_total'] for o in ordini)
print(f"  Totale complessivo ordinato: CHF {totale_complessivo:,.2f}")
print()

# ============================================================================
# ESTRAZIONE RIGHE ORDINI
# ============================================================================
print("[4/7] Estrazione righe ordini e prodotti...")
line_ids = []
for ordine in ordini:
    if ordine['order_line']:
        line_ids.extend(ordine['order_line'])

if not line_ids:
    print("[WARN]  Nessuna riga ordine trovata!")
    exit(0)

righe_ordini = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    'sale.order.line', 'search_read',
    [[('id', 'in', line_ids)]],
    {
        'fields': [
            'id', 'order_id', 'product_id', 'name',
            'product_uom_qty', 'qty_delivered', 'qty_invoiced',
            'price_unit', 'discount', 'price_subtotal', 'price_total',
            'tax_id'
        ]
    }
)

print(f"[OK] Trovate {len(righe_ordini)} righe ordini")
print(f"  Prodotti unici: ", end="")

# Mappa order_id -> data ordine
order_date_map = {o['id']: o['date_order'] for o in ordini}

# ============================================================================
# ANALISI VARIAZIONI PREZZI PER PRODOTTO
# ============================================================================
print("[5/7] Analisi variazioni prezzi per prodotto...")

# Raggruppa righe per prodotto
prodotti_dict = defaultdict(list)
for riga in righe_ordini:
    if not riga['product_id']:
        continue

    product_id, product_name = riga['product_id']
    order_id = riga['order_id'][0]
    data_ordine = order_date_map.get(order_id, '')

    prodotti_dict[product_id].append({
        'product_id': product_id,
        'product_name': product_name,
        'order_id': order_id,
        'order_name': riga['order_id'][1],
        'data_ordine': data_ordine,
        'qty': riga['product_uom_qty'],
        'qty_delivered': riga['qty_delivered'],
        'price_unit': riga['price_unit'],
        'discount': riga['discount'],
        'subtotal': riga['price_subtotal'],
        'total': riga['price_total']
    })

print(f"[OK] {len(prodotti_dict)} prodotti unici trovati")
print()

# ============================================================================
# CALCOLO VARIAZIONI E STATISTICHE
# ============================================================================
print("[6/7] Calcolo variazioni e statistiche...")

prodotti_analisi = []
for product_id, entries in prodotti_dict.items():
    # Ordina per data
    entries_sorted = sorted(entries, key=lambda x: x['data_ordine'])

    # Statistiche prezzi
    prezzi = [e['price_unit'] for e in entries_sorted]
    prezzo_min = min(prezzi)
    prezzo_max = max(prezzi)
    prezzo_medio = sum(prezzi) / len(prezzi)
    prezzo_primo = entries_sorted[0]['price_unit']
    prezzo_ultimo = entries_sorted[-1]['price_unit']

    # Variazioni
    variazioni_prezzo = []
    for i in range(1, len(entries_sorted)):
        prev_price = entries_sorted[i-1]['price_unit']
        curr_price = entries_sorted[i]['price_unit']
        if prev_price != curr_price:
            variazione_pct = ((curr_price - prev_price) / prev_price) * 100
            variazioni_prezzo.append({
                'da_data': entries_sorted[i-1]['data_ordine'],
                'a_data': entries_sorted[i]['data_ordine'],
                'da_prezzo': prev_price,
                'a_prezzo': curr_price,
                'variazione_chf': curr_price - prev_price,
                'variazione_pct': variazione_pct
            })

    # Totali
    qty_totale = sum(e['qty'] for e in entries_sorted)
    subtotale_prodotto = sum(e['subtotal'] for e in entries_sorted)

    prodotti_analisi.append({
        'product_id': product_id,
        'product_name': entries_sorted[0]['product_name'],
        'num_ordini': len(entries_sorted),
        'qty_totale': qty_totale,
        'prezzo_primo': prezzo_primo,
        'prezzo_ultimo': prezzo_ultimo,
        'prezzo_min': prezzo_min,
        'prezzo_max': prezzo_max,
        'prezzo_medio': prezzo_medio,
        'num_variazioni': len(variazioni_prezzo),
        'subtotale': subtotale_prodotto,
        'variazioni': variazioni_prezzo,
        'entries': entries_sorted
    })

# Ordina per subtotale decrescente
prodotti_analisi.sort(key=lambda x: x['subtotale'], reverse=True)

print(f"[OK] Analisi completata per {len(prodotti_analisi)} prodotti")
print(f"  Prodotti con variazioni prezzo: {sum(1 for p in prodotti_analisi if p['num_variazioni'] > 0)}")
print()

# ============================================================================
# GENERAZIONE EXCEL REPORT
# ============================================================================
print("[7/7] Generazione report Excel...")

# Sheet 1: Dettaglio Prodotti e Variazioni Prezzi
df_prodotti = pd.DataFrame([
    {
        'Prodotto ID': p['product_id'],
        'Prodotto': p['product_name'],
        'N° Ordini': p['num_ordini'],
        'Qtà Totale': p['qty_totale'],
        'Prezzo Primo': f"{p['prezzo_primo']:.2f}",
        'Prezzo Ultimo': f"{p['prezzo_ultimo']:.2f}",
        'Prezzo Min': f"{p['prezzo_min']:.2f}",
        'Prezzo Max': f"{p['prezzo_max']:.2f}",
        'Prezzo Medio': f"{p['prezzo_medio']:.2f}",
        'N° Variazioni': p['num_variazioni'],
        'Subtotale CHF': f"{p['subtotale']:.2f}",
        '% sul Totale': f"{(p['subtotale']/totale_complessivo*100):.1f}%"
    }
    for p in prodotti_analisi
])

# Sheet 2: Riepilogo Ordini
df_ordini = pd.DataFrame([
    {
        'Ordine': o['name'],
        'Data Ordine': o['date_order'][:10] if o['date_order'] else '',
        'Data Consegna': o['commitment_date'][:10] if o['commitment_date'] else '',
        'Stato': o['state'],
        'N° Righe': len(o['order_line']) if o['order_line'] else 0,
        'Imponibile CHF': f"{o['amount_untaxed']:.2f}",
        'IVA CHF': f"{o['amount_tax']:.2f}",
        'Totale CHF': f"{o['amount_total']:.2f}",
        'Venditore': o['user_id'][1] if o['user_id'] else 'N/A',
        'Listino': o['pricelist_id'][1] if o['pricelist_id'] else 'N/A'
    }
    for o in ordini
])

# Sheet 3: Simulazione Impatto Variazioni Prezzi
scenari = []
percentuali = [-10, -5, 0, 5, 10]
for pct in percentuali:
    nuovo_totale = totale_complessivo * (1 + pct/100)
    differenza = nuovo_totale - totale_complessivo
    scenari.append({
        'Scenario': f"Variazione {pct:+d}%" if pct != 0 else "Situazione Attuale",
        'Percentuale': f"{pct:+d}%",
        'Nuovo Totale CHF': f"{nuovo_totale:.2f}",
        'Differenza CHF': f"{differenza:+,.2f}",
        'Differenza %': f"{pct:+.1f}%"
    })

df_simulazione = pd.DataFrame(scenari)

# Crea file Excel
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
excel_filename = os.path.join(REPORT_DIR, f"an-gastro-analisi-prezzi-{timestamp}.xlsx")

with pd.ExcelWriter(excel_filename, engine='openpyxl') as writer:
    df_prodotti.to_excel(writer, sheet_name='Dettaglio Prodotti', index=False)
    df_ordini.to_excel(writer, sheet_name='Ordini', index=False)
    df_simulazione.to_excel(writer, sheet_name='Simulazione Impatti', index=False)

    # Formattazione
    workbook = writer.book

    # Formatta ogni sheet
    for sheet_name in ['Dettaglio Prodotti', 'Ordini', 'Simulazione Impatti']:
        worksheet = workbook[sheet_name]

        # Header styling
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")

        for cell in worksheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # Auto-size columns
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width

print(f"[OK] Report Excel generato: {excel_filename}")
print()

# ============================================================================
# RIEPILOGO ANALITICO
# ============================================================================
print("=" * 80)
print("RIEPILOGO ANALITICO")
print("=" * 80)
print()

print(f"CLIENTE: {partner['name']}")
print(f"PERIODO ANALISI: {DATA_INIZIO} -> {DATA_FINE}")
print()

print("ORDINI:")
print(f"  Numero ordini: {len(ordini)}")
print(f"  Totale ordinato: CHF {totale_complessivo:,.2f}")
print(f"  Imponibile medio: CHF {sum(o['amount_untaxed'] for o in ordini)/len(ordini):,.2f}")
print()

print("PRODOTTI:")
print(f"  Prodotti unici: {len(prodotti_analisi)}")
print(f"  Righe ordini totali: {len(righe_ordini)}")
print(f"  Prodotti con variazioni prezzo: {sum(1 for p in prodotti_analisi if p['num_variazioni'] > 0)}")
print()

print("TOP 10 PRODOTTI PER VALORE:")
for i, p in enumerate(prodotti_analisi[:10], 1):
    pct_totale = (p['subtotale']/totale_complessivo*100)
    print(f"  {i:2d}. {p['product_name'][:50]:50s} CHF {p['subtotale']:>10,.2f} ({pct_totale:>5.1f}%)")
    if p['num_variazioni'] > 0:
        print(f"      -> {p['num_variazioni']} variazioni di prezzo: "
              f"CHF {p['prezzo_min']:.2f} - {p['prezzo_max']:.2f} "
              f"(ultimo: CHF {p['prezzo_ultimo']:.2f})")
print()

print("PRODOTTI CON PIÙ VARIAZIONI PREZZO:")
prodotti_con_variazioni = [p for p in prodotti_analisi if p['num_variazioni'] > 0]
prodotti_con_variazioni.sort(key=lambda x: x['num_variazioni'], reverse=True)
for i, p in enumerate(prodotti_con_variazioni[:10], 1):
    variazione_totale = ((p['prezzo_ultimo'] - p['prezzo_primo']) / p['prezzo_primo']) * 100
    print(f"  {i:2d}. {p['product_name'][:50]:50s}")
    print(f"      {p['num_variazioni']} variazioni | "
          f"Primo: CHF {p['prezzo_primo']:.2f} -> Ultimo: CHF {p['prezzo_ultimo']:.2f} "
          f"({variazione_totale:+.1f}%)")
print()

print("SIMULAZIONE IMPATTO VARIAZIONI PREZZI:")
print(f"  Totale attuale: CHF {totale_complessivo:,.2f}")
print()
for scenario in scenari:
    if scenario['Percentuale'] != '0%':
        print(f"  Scenario {scenario['Percentuale']:>5s}: "
              f"CHF {scenario['Nuovo Totale CHF']:>12s} "
              f"(differenza: {scenario['Differenza CHF']})")
print()

print("=" * 80)
print(f"Report completo salvato in: {excel_filename}")
print("=" * 80)
