#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANALISI COMPLETA DOCUMENTI CHIUSURA 2024
Analizza TUTTI i documenti bancari e crea un report completo
"""

import sys
import io
import os
from datetime import datetime

# Fix encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

print("=" * 120)
print("ANALISI COMPLETA DOCUMENTI BANCARI 2024")
print("=" * 120)

# Base folder
base_folder = r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024'

# Tutti i CSV disponibili
csv_files = [
    # UBS CHF - 4 trimestri
    ('UBS CHF', 'Q1 2024', r'UBS CHF\UBS CHF 1.1-31.3.2024.csv', '01/01/2024', '31/03/2024'),
    ('UBS CHF', 'Q2 2024', r'UBS CHF\UBS CHF 1.4-30.6.2024.csv', '01/04/2024', '30/06/2024'),
    ('UBS CHF', 'Q3 2024', r'UBS CHF\UBS CHF 1.7-30.9.2024.csv', '01/07/2024', '30/09/2024'),
    ('UBS CHF', 'Q4 2024', r'UBS CHF\UBS CHF 1.10-31.12.2024.csv', '01/10/2024', '31/12/2024'),
    # UBS EUR - 2 semestri
    ('UBS EUR', 'H1 2024', r'UBS EUR\UBS EUR 1.1-30.6.2024.csv', '01/01/2024', '30/06/2024'),
    ('UBS EUR', 'H2 2024', r'UBS EUR\UBS EUR 1.7-31.12.2024.csv', '01/07/2024', '31/12/2024'),
]

def extract_balance_from_csv(filepath):
    """Estrae saldi iniziale e finale da CSV UBS"""
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()

            anfangssaldo = None
            schlusssaldo = None
            num_transactions = 0

            # Cerca i saldi nelle prime righe (header)
            for line in lines[:20]:  # Prime 20 righe per trovare header
                if line.startswith('Anfangssaldo:'):
                    parts = line.split(';')
                    if len(parts) >= 2:
                        try:
                            anfangssaldo = float(parts[1].replace("'", "").replace(",", "").strip())
                        except:
                            pass

                if line.startswith('Schlusssaldo:'):
                    parts = line.split(';')
                    if len(parts) >= 2:
                        try:
                            schlusssaldo = float(parts[1].replace("'", "").replace(",", "").strip())
                        except:
                            pass

            # Conta le transazioni (righe dati)
            # Le righe dati iniziano dopo "Buchungsdatum" o simile
            in_data_section = False
            for line in lines:
                if 'Buchungsdatum' in line or 'Valutadatum' in line:
                    in_data_section = True
                    continue

                if in_data_section:
                    # Salta righe vuote e righe di summary
                    if line.strip() and not line.startswith('Anfangssaldo') and not line.startswith('Schlusssaldo'):
                        num_transactions += 1

            return {
                'anfangssaldo': anfangssaldo,
                'schlusssaldo': schlusssaldo,
                'num_transactions': num_transactions
            }

    except Exception as e:
        print(f"ERRORE leggendo {filepath}: {str(e)}")
        return None

print("\n" + "=" * 120)
print("STEP 1: ANALISI TUTTI I CSV BANCARI")
print("=" * 120)

all_accounts = {}
total_transactions = 0

for bank_name, period, rel_path, date_from, date_to in csv_files:
    full_path = os.path.join(base_folder, rel_path)

    print(f"\n{bank_name} - {period}")
    print(f"  File: {rel_path}")
    print(f"  Periodo: {date_from} → {date_to}")

    if not os.path.exists(full_path):
        print(f"  ❌ FILE NON TROVATO")
        continue

    data = extract_balance_from_csv(full_path)

    if data:
        anfang = data['anfangssaldo']
        schluss = data['schlusssaldo']
        trans = data['num_transactions']

        currency = 'CHF' if 'CHF' in bank_name else 'EUR'

        if anfang is not None:
            print(f"  Saldo INIZIALE: {currency} {anfang:>15,.2f}")
        else:
            print(f"  Saldo INIZIALE: Non trovato")

        if schluss is not None:
            print(f"  Saldo FINALE:   {currency} {schluss:>15,.2f}")
        else:
            print(f"  Saldo FINALE:   Non trovato")

        print(f"  Transazioni:    {trans:>15,}")

        total_transactions += trans

        # Salva i dati
        if bank_name not in all_accounts:
            all_accounts[bank_name] = {
                'currency': currency,
                'periods': []
            }

        all_accounts[bank_name]['periods'].append({
            'period': period,
            'date_from': date_from,
            'date_to': date_to,
            'anfangssaldo': anfang,
            'schlusssaldo': schluss,
            'transactions': trans,
            'file': rel_path
        })
    else:
        print(f"  ❌ ERRORE estrazione dati")

print("\n" + "=" * 120)
print("STEP 2: RIEPILOGO PER BANCA")
print("=" * 120)

for bank_name, bank_data in sorted(all_accounts.items()):
    currency = bank_data['currency']
    periods = bank_data['periods']

    print(f"\n{'='*120}")
    print(f"{bank_name} ({currency})")
    print(f"{'='*120}")

    # Ordina per data
    periods.sort(key=lambda x: x['date_from'])

    print(f"\n{'PERIODO':<15} {'DATA INIZIO':>12} {'DATA FINE':>12} {'SALDO INIZIALE':>20} {'SALDO FINALE':>20} {'TRANSAZIONI':>15}")
    print("-" * 120)

    for p in periods:
        anfang = f"{currency} {p['anfangssaldo']:,.2f}" if p['anfangssaldo'] is not None else "N/A"
        schluss = f"{currency} {p['schlusssaldo']:,.2f}" if p['schlusssaldo'] is not None else "N/A"
        trans = f"{p['transactions']:,}" if p['transactions'] else "0"

        print(f"{p['period']:<15} {p['date_from']:>12} {p['date_to']:>12} {anfang:>20} {schluss:>20} {trans:>15}")

    # Calcola saldi anno completo
    if len(periods) > 0:
        first_period = periods[0]
        last_period = periods[-1]

        saldo_inizio_anno = first_period['anfangssaldo']
        saldo_fine_anno = last_period['schlusssaldo']
        total_trans = sum(p['transactions'] for p in periods if p['transactions'])

        print("-" * 120)
        print(f"{'ANNO 2024':<15} {'01/01/2024':>12} {'31/12/2024':>12}", end='')

        if saldo_inizio_anno is not None:
            print(f" {currency} {saldo_inizio_anno:>17,.2f}", end='')
        else:
            print(f" {'N/A':>20}", end='')

        if saldo_fine_anno is not None:
            print(f" {currency} {saldo_fine_anno:>17,.2f}", end='')
        else:
            print(f" {'N/A':>20}", end='')

        print(f" {total_trans:>15,}")

        # Calcola variazione
        if saldo_inizio_anno is not None and saldo_fine_anno is not None:
            variazione = saldo_fine_anno - saldo_inizio_anno
            print(f"\n  VARIAZIONE ANNO: {currency} {variazione:+,.2f}")

print("\n" + "=" * 120)
print("STEP 3: SUMMARY TOTALE")
print("=" * 120)

print(f"\nBANCHE ANALIZZATE: {len(all_accounts)}")
for bank_name in sorted(all_accounts.keys()):
    num_periods = len(all_accounts[bank_name]['periods'])
    print(f"  - {bank_name}: {num_periods} periodi")

print(f"\nTOTALE TRANSAZIONI ANALIZZATE: {total_transactions:,}")

print("\n" + "=" * 120)
print("STEP 4: SALDI FINALI AL 31/12/2024")
print("=" * 120)

print(f"\n{'BANCA':<20} {'VALUTA':<10} {'SALDO FINALE 31/12/2024':>30}")
print("-" * 120)

total_chf = 0
total_eur = 0

for bank_name, bank_data in sorted(all_accounts.items()):
    currency = bank_data['currency']
    periods = bank_data['periods']

    # Trova l'ultimo periodo
    last_period = max(periods, key=lambda x: x['date_to'])
    saldo_finale = last_period['schlusssaldo']

    if saldo_finale is not None:
        print(f"{bank_name:<20} {currency:<10} {currency} {saldo_finale:>24,.2f}")

        if currency == 'CHF':
            total_chf += saldo_finale
        elif currency == 'EUR':
            total_eur += saldo_finale

print("-" * 120)
print(f"{'TOTALE CHF':<20} {'CHF':<10} CHF {total_chf:>24,.2f}")
print(f"{'TOTALE EUR':<20} {'EUR':<10} EUR {total_eur:>24,.2f}")
print(f"{'TOTALE EUR in CHF (rate 0.93)':<20} {'CHF':<10} CHF {total_eur * 0.93:>24,.2f}")
print("-" * 120)
print(f"{'TOTALE GENERALE (CHF)':<20} {'CHF':<10} CHF {total_chf + (total_eur * 0.93):>24,.2f}")

print("\n" + "=" * 120)
print("STEP 5: ALTRI DOCUMENTI DA VERIFICARE")
print("=" * 120)

print("""
DOCUMENTI PDF/IMG TROVATI (da analizzare manualmente):

1. CREDIT SUISSE:
   - ESTRATTO CONTO CREDIT SUISSE CONTO CARTE 1.1.-30.6.2024.pdf
   - ESTRATTO CONTO CREDIT SUISSE CONTO CARTE 1.7-31.12.2024.pdf
   - SALDI 31.12.2024 VS REALI.pdf
   - rettifiche ancora da fare x 31.12.2024.pdf

2. CAUZIONI E CARTE CREDITO:
   - Attestato 2024 conto carte ubs (1).jpg
   - ATTESTATO CARTE CREDITO EUR 2024 (1).pdf
   - TRANSAZIONI CARTE DI CREDITO 2024 (1).pdf
   - RAIFFEISENBANK KONTOBEWEGUNGEN UND STEUERAUSWESI 2024.pdf
   - ZKB KONTOBEWEGUNGEN UND STEUERAUSWESI 2024 (x3 files)

3. SALDI FINALI (IMMAGINI):
   - SALDO CONTO CORRENTE CREDIT SUISSE 31.12 (1).png
   - SALDO CONTO CORRENTI UBS 31.12.2024.png

AZIONE RICHIESTA:
-----------------
Questi documenti vanno analizzati manualmente o con OCR per estrarre:
- Saldi finali Credit Suisse
- Transazioni carte di credito
- Conti ZKB e Raiffeisen (se presenti)
""")

print("\n" + "=" * 120)
print("END OF REPORT")
print("=" * 120)
