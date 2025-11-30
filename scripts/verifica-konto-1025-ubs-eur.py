#!/usr/bin/env python3
"""
VERIFICA COMMERCIALISTA KONTO 1025 UBS EUR
Analisi riga per riga con precisione svizzera
"""

import xmlrpc.client
from datetime import datetime
from collections import defaultdict
import json

# Odoo connection
url = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
db = 'lapadevadmin-lapa-v2-staging-2406-25408900'
username = 'paul@lapa.ch'
password = 'lapa201180'

print("=" * 80)
print("VERIFICA KONTO 1025 UBS EUR - COMMERCIALISTA SVIZZERO")
print("=" * 80)
print(f"Data verifica: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Odoo: {url}")
print(f"Database: {db}")
print()

# Connect
common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
uid = common.authenticate(db, username, password, {})

if not uid:
    print("ERRORE: Autenticazione fallita!")
    exit(1)

print(f"[OK] Connesso come UID: {uid}")
print()

models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

# Step 1: Find account 1025
print("STEP 1: Ricerca conto 1025 UBS EUR")
print("-" * 80)

accounts = models.execute_kw(db, uid, password,
    'account.account', 'search_read',
    [[['code', '=', '1025']]],
    {'fields': ['id', 'name', 'code', 'currency_id', 'reconcile']}
)

if not accounts:
    print("ERRORE: Conto 1025 non trovato!")
    exit(1)

account = accounts[0]
print(f"Conto ID: {account['id']}")
print(f"Nome: {account['name']}")
print(f"Codice: {account['code']}")
print(f"Valuta: {account.get('currency_id', 'Non impostata')}")
print(f"Riconciliabile: {account.get('reconcile', False)}")
print()

# Get EUR currency
currencies = models.execute_kw(db, uid, password,
    'res.currency', 'search_read',
    [[['name', '=', 'EUR']]],
    {'fields': ['id', 'name', 'symbol']}
)
eur_currency_id = currencies[0]['id'] if currencies else None
print(f"EUR Currency ID: {eur_currency_id}")
print()

# Step 2: Get ALL move lines for account 1025
print("STEP 2: Estrazione TUTTE le righe del conto 1025")
print("-" * 80)

move_lines = models.execute_kw(db, uid, password,
    'account.move.line', 'search_read',
    [[['account_id', '=', account['id']]]],
    {
        'fields': [
            'id', 'date', 'move_id', 'move_name', 'name',
            'debit', 'credit', 'balance', 'amount_currency',
            'currency_id', 'partner_id', 'ref', 'journal_id',
            'reconciled', 'full_reconcile_id', 'matching_number',
            'payment_id', 'statement_line_id'
        ],
        'order': 'date asc, id asc'
    }
)

print(f"Totale righe trovate: {len(move_lines)}")
print()

# Step 3: Analyze EVERY line
print("STEP 3: Analisi RIGA PER RIGA")
print("-" * 80)
print()

running_balance_chf = 0.0
running_balance_eur = 0.0
anomalie = []
righe_per_data = defaultdict(list)
righe_per_importo = defaultdict(list)
partner_stats = defaultdict(lambda: {'count': 0, 'debit': 0, 'credit': 0})

print(f"{'ID':<10} {'Data':<12} {'Dare CHF':<15} {'Avere CHF':<15} {'Saldo CHF':<15} {'EUR':<15} {'Partner':<30}")
print("-" * 120)

for idx, line in enumerate(move_lines, 1):
    line_id = line['id']
    date = line['date']
    debit = line['debit']
    credit = line['credit']
    balance_line = line['balance']
    amount_currency = line.get('amount_currency', 0)
    currency_id = line.get('currency_id')
    partner = line.get('partner_id', [False, 'N/A'])
    partner_name = partner[1] if partner and partner[0] else 'N/A'

    # Update running balance
    running_balance_chf += debit - credit

    # Track EUR amounts
    if currency_id and currency_id[0] == eur_currency_id:
        running_balance_eur += amount_currency

    # Print line
    print(f"{line_id:<10} {date:<12} {debit:>14,.2f} {credit:>14,.2f} {running_balance_chf:>14,.2f} {amount_currency:>14,.2f} {partner_name[:29]:<30}")

    # Group by date for duplicate detection
    righe_per_data[date].append(line)

    # Group by amount for duplicate detection
    amount_key = f"{debit}_{credit}_{amount_currency}"
    righe_per_importo[amount_key].append(line)

    # Partner statistics
    if partner and partner[0]:
        partner_stats[partner_name]['count'] += 1
        partner_stats[partner_name]['debit'] += debit
        partner_stats[partner_name]['credit'] += credit

    # ANOMALY CHECKS

    # 1. Currency check
    if currency_id:
        if currency_id[0] != eur_currency_id:
            anomalie.append({
                'tipo': 'CURRENCY_ERRATA',
                'gravita': 'ALTA',
                'riga_id': line_id,
                'data': date,
                'descrizione': f"Valuta errata: {currency_id[1]} invece di EUR",
                'importo': f"CHF {debit - credit:.2f}"
            })
    else:
        if amount_currency != 0:
            anomalie.append({
                'tipo': 'CURRENCY_MANCANTE',
                'gravita': 'ALTA',
                'riga_id': line_id,
                'data': date,
                'descrizione': f"Amount currency {amount_currency:.2f} ma currency_id non impostato",
                'importo': f"CHF {debit - credit:.2f}"
            })

    # 2. Zero amount check
    if debit == 0 and credit == 0:
        anomalie.append({
            'tipo': 'IMPORTO_ZERO',
            'gravita': 'MEDIA',
            'riga_id': line_id,
            'data': date,
            'descrizione': "Riga con importo zero",
            'importo': "CHF 0.00"
        })

    # 3. Huge amount check (> 50000 CHF)
    if abs(debit - credit) > 50000:
        anomalie.append({
            'tipo': 'IMPORTO_ELEVATO',
            'gravita': 'MEDIA',
            'riga_id': line_id,
            'data': date,
            'descrizione': f"Importo molto elevato: CHF {abs(debit - credit):,.2f}",
            'importo': f"CHF {debit - credit:.2f}"
        })

print("-" * 120)
print()

# Step 4: Check for duplicates
print("STEP 4: Verifica duplicati")
print("-" * 80)

duplicati_data = []
for date, lines in righe_per_data.items():
    if len(lines) > 1:
        # Check if same amounts on same date
        amounts = {}
        for line in lines:
            key = f"{line['debit']}_{line['credit']}_{line.get('amount_currency', 0)}"
            if key not in amounts:
                amounts[key] = []
            amounts[key].append(line)

        for amount_key, dup_lines in amounts.items():
            if len(dup_lines) > 1:
                duplicati_data.append({
                    'data': date,
                    'count': len(dup_lines),
                    'righe': [l['id'] for l in dup_lines],
                    'importo': dup_lines[0]['debit'] - dup_lines[0]['credit']
                })

if duplicati_data:
    print(f"TROVATI {len(duplicati_data)} gruppi di possibili duplicati:")
    for dup in duplicati_data:
        print(f"  - Data {dup['data']}: {dup['count']} righe con importo {dup['importo']:.2f}")
        print(f"    IDs: {dup['righe']}")

        anomalie.append({
            'tipo': 'POSSIBILE_DUPLICATO',
            'gravita': 'ALTA',
            'riga_id': dup['righe'],
            'data': dup['data'],
            'descrizione': f"{dup['count']} righe con stesso importo nella stessa data",
            'importo': f"CHF {dup['importo']:.2f}"
        })
else:
    print("[OK] Nessun duplicato evidente trovato")

print()

# Step 5: Calculate balances
print("STEP 5: Calcolo saldi")
print("-" * 80)

total_debit = sum(line['debit'] for line in move_lines)
total_credit = sum(line['credit'] for line in move_lines)
balance_chf = total_debit - total_credit

# EUR balance (from amount_currency where currency is EUR)
eur_lines = [l for l in move_lines if l.get('currency_id') and l['currency_id'][0] == eur_currency_id]
balance_eur = sum(l.get('amount_currency', 0) for l in eur_lines)

print(f"Totale Dare CHF:   {total_debit:>20,.2f}")
print(f"Totale Avere CHF:  {total_credit:>20,.2f}")
print(f"Saldo CHF:         {balance_chf:>20,.2f}")
print()
print(f"Righe con EUR:     {len(eur_lines):>20}")
print(f"Saldo EUR:         {balance_eur:>20,.2f}")
print()

# Expected balance
expected_eur = 128860.70
expected_chf_min = 135000  # Approximate range
expected_chf_max = 140000

print(f"Saldo atteso EUR:  {expected_eur:>20,.2f}")
print(f"Gap EUR:           {balance_eur - expected_eur:>20,.2f}")
print()

# Check if in expected range
if balance_chf < expected_chf_min or balance_chf > expected_chf_max:
    print(f"[!] ATTENZIONE: Saldo CHF {balance_chf:,.2f} fuori dal range atteso ({expected_chf_min:,} - {expected_chf_max:,})")
    anomalie.append({
        'tipo': 'SALDO_FUORI_RANGE',
        'gravita': 'CRITICA',
        'riga_id': None,
        'data': None,
        'descrizione': f"Saldo CHF {balance_chf:,.2f} fuori dal range atteso",
        'importo': f"Gap: CHF {balance_chf - ((expected_chf_min + expected_chf_max) / 2):,.2f}"
    })
else:
    print(f"[OK] Saldo CHF nel range atteso")

print()

# Step 6: Partner analysis
print("STEP 6: Analisi per Partner")
print("-" * 80)

print(f"{'Partner':<40} {'Righe':<10} {'Dare':<15} {'Avere':<15}")
print("-" * 80)

for partner_name, stats in sorted(partner_stats.items(), key=lambda x: x[1]['count'], reverse=True):
    print(f"{partner_name[:39]:<40} {stats['count']:<10} {stats['debit']:>14,.2f} {stats['credit']:>14,.2f}")

print()

# Step 7: Monthly analysis
print("STEP 7: Analisi mensile")
print("-" * 80)

monthly = defaultdict(lambda: {'debit': 0, 'credit': 0, 'count': 0})
for line in move_lines:
    month = line['date'][:7]  # YYYY-MM
    monthly[month]['debit'] += line['debit']
    monthly[month]['credit'] += line['credit']
    monthly[month]['count'] += 1

print(f"{'Mese':<10} {'Righe':<10} {'Dare':<15} {'Avere':<15} {'Saldo':<15}")
print("-" * 70)

for month in sorted(monthly.keys()):
    stats = monthly[month]
    balance = stats['debit'] - stats['credit']
    print(f"{month:<10} {stats['count']:<10} {stats['debit']:>14,.2f} {stats['credit']:>14,.2f} {balance:>14,.2f}")

print()

# FINAL REPORT
print("=" * 80)
print("REPORT FINALE - ANOMALIE RILEVATE")
print("=" * 80)
print()

if anomalie:
    # Group by severity
    critiche = [a for a in anomalie if a['gravita'] == 'CRITICA']
    alte = [a for a in anomalie if a['gravita'] == 'ALTA']
    medie = [a for a in anomalie if a['gravita'] == 'MEDIA']

    print(f"Totale anomalie: {len(anomalie)}")
    print(f"  - CRITICHE: {len(critiche)}")
    print(f"  - ALTE:     {len(alte)}")
    print(f"  - MEDIE:    {len(medie)}")
    print()

    if critiche:
        print("ANOMALIE CRITICHE:")
        print("-" * 80)
        for a in critiche:
            print(f"  [{a['tipo']}] {a['descrizione']}")
            if a['riga_id']:
                print(f"    Riga ID: {a['riga_id']}, Data: {a['data']}, Importo: {a['importo']}")
        print()

    if alte:
        print("ANOMALIE ALTE:")
        print("-" * 80)
        for a in alte:
            print(f"  [{a['tipo']}] {a['descrizione']}")
            if a['riga_id']:
                print(f"    Riga ID: {a['riga_id']}, Data: {a['data']}, Importo: {a['importo']}")
        print()

    if medie:
        print("ANOMALIE MEDIE:")
        print("-" * 80)
        for a in medie[:10]:  # Show first 10
            print(f"  [{a['tipo']}] {a['descrizione']}")
            if a['riga_id']:
                print(f"    Riga ID: {a['riga_id']}, Data: {a['data']}, Importo: {a['importo']}")
        if len(medie) > 10:
            print(f"  ... e altre {len(medie) - 10} anomalie medie")
        print()
else:
    print("[OK] Nessuna anomalia rilevata!")
    print()

# RACCOMANDAZIONI
print("=" * 80)
print("RACCOMANDAZIONI COMMERCIALISTA")
print("=" * 80)
print()

raccomandazioni = []

if balance_eur != expected_eur:
    gap = abs(balance_eur - expected_eur)
    if gap > 1:  # > 1 EUR
        raccomandazioni.append(
            f"1. RICONCILIARE GAP EUR: Differenza di EUR {balance_eur - expected_eur:,.2f} "
            f"rispetto al saldo atteso. Verificare estratti conto UBS EUR."
        )

if duplicati_data:
    raccomandazioni.append(
        f"2. VERIFICARE DUPLICATI: Trovati {len(duplicati_data)} gruppi di possibili duplicati. "
        f"Controllare se sono errori di importazione o movimenti legittimi."
    )

currency_errors = [a for a in anomalie if a['tipo'] in ['CURRENCY_ERRATA', 'CURRENCY_MANCANTE']]
if currency_errors:
    raccomandazioni.append(
        f"3. CORREGGERE VALUTE: {len(currency_errors)} righe con problemi di valuta. "
        f"Assicurarsi che tutte le righe abbiano currency_id = EUR."
    )

if len(move_lines) < 50:
    raccomandazioni.append(
        f"4. POCHE MOVIMENTAZIONI: Solo {len(move_lines)} righe trovate. Verificare se mancano "
        f"estratti conto o se il conto è stato poco utilizzato."
    )

if not raccomandazioni:
    raccomandazioni.append("[OK] Il conto 1025 UBS EUR appare corretto. Procedere con chiusura.")

for racc in raccomandazioni:
    print(racc)
    print()

# Save detailed report
report = {
    'timestamp': datetime.now().isoformat(),
    'account': account,
    'summary': {
        'total_lines': len(move_lines),
        'total_debit_chf': total_debit,
        'total_credit_chf': total_credit,
        'balance_chf': balance_chf,
        'balance_eur': balance_eur,
        'expected_eur': expected_eur,
        'gap_eur': balance_eur - expected_eur,
        'eur_lines_count': len(eur_lines)
    },
    'anomalie': anomalie,
    'duplicati': duplicati_data,
    'partner_stats': {k: v for k, v in partner_stats.items()},
    'monthly_stats': {k: v for k, v in monthly.items()},
    'raccomandazioni': raccomandazioni,
    'lines': move_lines
}

report_file = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\report-verifica-1025-ubs-eur-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False, default=str)

print("=" * 80)
print(f"Report salvato in: {report_file}")
print("=" * 80)
