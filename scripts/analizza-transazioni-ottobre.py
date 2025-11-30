#!/usr/bin/env python3
"""
Analizza transazioni interessanti di Ottobre 2024
- Top 10 entrate/uscite per konto
- Transazioni anomale
- Pattern interessanti
"""

import json
import sys
from collections import defaultdict

# Fix Windows encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def load_report():
    """Carica report JSON"""
    with open('c:/Users/lapa/Desktop/Claude Code/app-hub-platform/REPORT-OTTOBRE-2024.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def get_top_transactions(transactions, n=10, transaction_type='debit'):
    """Ottieni top N transazioni per importo"""
    sorted_txns = sorted(
        transactions,
        key=lambda x: x[transaction_type],
        reverse=True
    )
    return sorted_txns[:n]

def analyze_konto_transactions(konto_code, result):
    """Analizza transazioni di un konto"""
    print(f"\n{'=' * 80}")
    print(f"Konto {konto_code} - {result['name']}")
    print(f"{'=' * 80}")

    txns = result.get('transactions', [])
    if not txns:
        print("Nessuna transazione trovata")
        return

    currency = result['currency']

    # Top 10 entrate
    print(f"\nTOP 10 ENTRATE (Dare):")
    print("-" * 80)
    top_debit = get_top_transactions(txns, 10, 'debit')
    for i, txn in enumerate(top_debit, 1):
        if txn['debit'] > 0:
            print(f"{i:2d}. {txn['date']} | {currency} {txn['debit']:>12,.2f} | {txn['name'][:60]}")
            if txn['ref']:
                print(f"    Ref: {txn['ref']}")

    # Top 10 uscite
    print(f"\nTOP 10 USCITE (Avere):")
    print("-" * 80)
    top_credit = get_top_transactions(txns, 10, 'credit')
    for i, txn in enumerate(top_credit, 1):
        if txn['credit'] > 0:
            print(f"{i:2d}. {txn['date']} | {currency} {txn['credit']:>12,.2f} | {txn['name'][:60]}")
            if txn['ref']:
                print(f"    Ref: {txn['ref']}")

    # Statistiche
    print(f"\nSTATISTICHE:")
    print("-" * 80)

    debits = [t['debit'] for t in txns if t['debit'] > 0]
    credits = [t['credit'] for t in txns if t['credit'] > 0]

    if debits:
        print(f"Entrate:")
        print(f"  Media:      {currency} {sum(debits)/len(debits):>12,.2f}")
        print(f"  Mediana:    {currency} {sorted(debits)[len(debits)//2]:>12,.2f}")
        print(f"  Max:        {currency} {max(debits):>12,.2f}")
        print(f"  Min:        {currency} {min(debits):>12,.2f}")

    if credits:
        print(f"\nUscite:")
        print(f"  Media:      {currency} {sum(credits)/len(credits):>12,.2f}")
        print(f"  Mediana:    {currency} {sorted(credits)[len(credits)//2]:>12,.2f}")
        print(f"  Max:        {currency} {max(credits):>12,.2f}")
        print(f"  Min:        {currency} {min(credits):>12,.2f}")

    # Partner più frequenti
    print(f"\nPARTNER PIU' FREQUENTI:")
    print("-" * 80)
    partner_counts = defaultdict(int)
    partner_amounts = defaultdict(float)

    for txn in txns:
        partner = txn.get('partner', '').strip()
        if partner and partner != 'False':
            partner_counts[partner] += 1
            partner_amounts[partner] += abs(txn['debit'] - txn['credit'])

    top_partners = sorted(
        partner_counts.items(),
        key=lambda x: x[1],
        reverse=True
    )[:10]

    for partner, count in top_partners:
        total = partner_amounts[partner]
        print(f"  {partner[:50]:50s} | {count:3d} txn | {currency} {total:>12,.2f}")

def find_anomalies(report):
    """Trova transazioni potenzialmente anomale"""
    print(f"\n{'=' * 80}")
    print("ANALISI ANOMALIE")
    print(f"{'=' * 80}")

    for konto_code, result in report['results'].items():
        if 'transactions' not in result:
            continue

        txns = result['transactions']
        currency = result['currency']
        name = result['name']

        # Calcola soglie anomalie (3 deviazioni standard)
        debits = [t['debit'] for t in txns if t['debit'] > 0]
        credits = [t['credit'] for t in txns if t['credit'] > 0]

        if debits:
            avg_debit = sum(debits) / len(debits)
            std_debit = (sum((x - avg_debit)**2 for x in debits) / len(debits)) ** 0.5
            threshold_debit = avg_debit + (3 * std_debit)

            anomaly_debits = [t for t in txns if t['debit'] > threshold_debit]
            if anomaly_debits:
                print(f"\n{name} - Entrate anomale (>{currency} {threshold_debit:,.2f}):")
                for txn in anomaly_debits[:5]:  # Max 5
                    print(f"  {txn['date']} | {currency} {txn['debit']:>12,.2f} | {txn['name'][:50]}")

        if credits:
            avg_credit = sum(credits) / len(credits)
            std_credit = (sum((x - avg_credit)**2 for x in credits) / len(credits)) ** 0.5
            threshold_credit = avg_credit + (3 * std_credit)

            anomaly_credits = [t for t in txns if t['credit'] > threshold_credit]
            if anomaly_credits:
                print(f"\n{name} - Uscite anomale (>{currency} {threshold_credit:,.2f}):")
                for txn in anomaly_credits[:5]:  # Max 5
                    print(f"  {txn['date']} | {currency} {txn['credit']:>12,.2f} | {txn['name'][:50]}")

def main():
    print("=" * 80)
    print("ANALISI TRANSAZIONI OTTOBRE 2024")
    print("=" * 80)

    report = load_report()

    # Analizza ogni konto
    for konto_code in sorted(report['results'].keys()):
        result = report['results'][konto_code]
        if 'error' not in result:
            analyze_konto_transactions(konto_code, result)

    # Trova anomalie
    find_anomalies(report)

    print("\n" + "=" * 80)
    print("Fine analisi")
    print("=" * 80)

if __name__ == '__main__':
    main()
