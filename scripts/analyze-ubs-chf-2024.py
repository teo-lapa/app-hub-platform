#!/usr/bin/env python3
"""
Analizza tutti i file CSV UBS CHF per l'anno 2024
Estrae saldi mensili, saldi trimestrali e statistiche
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

# Percorsi dei file CSV
BASE_PATH = r"C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF"
CSV_FILES = [
    "UBS CHF 1.1-31.3.2024.csv",
    "UBS CHF 1.4-30.6.2024.csv",
    "UBS CHF 1.7-30.9.2024.csv",
    "UBS CHF 1.10-31.12.2024.csv"
]

OUTPUT_FILE = r"C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data-estratti\UBS-CHF-2024-CLEAN.json"

def parse_date(date_str: str) -> datetime:
    """Parse date in DD/MM/YYYY format"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        return datetime.strptime(date_str.strip(), '%d/%m/%Y')
    except:
        return None

def parse_amount(amount_str: str) -> float:
    """Parse amount string to float"""
    if not amount_str or amount_str.strip() == '':
        return 0.0
    try:
        # Remove spaces and convert comma to dot if needed
        clean = amount_str.strip().replace(' ', '')
        return float(clean)
    except:
        return 0.0

def extract_metadata(file_path: str) -> Dict[str, Any]:
    """Extract metadata from CSV header"""
    metadata = {}

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        for i in range(9):  # First 9 lines are metadata
            line = f.readline()
            parts = line.strip().split(';')

            if len(parts) >= 2:
                key = parts[0].strip()
                value = parts[1].strip()

                if 'Kontonummer' in key:
                    metadata['account'] = value
                elif 'IBAN' in key:
                    metadata['iban'] = value
                elif 'Von' in key:
                    metadata['date_from'] = value
                elif 'Bis' in key:
                    metadata['date_to'] = value
                elif 'Anfangssaldo' in key:
                    metadata['opening_balance'] = parse_amount(value)
                elif 'Schlusssaldo' in key:
                    metadata['closing_balance'] = parse_amount(value)
                elif 'Bewertet in' in key:
                    metadata['currency'] = value
                elif 'Anzahl Transaktionen' in key:
                    metadata['transactions'] = int(value) if value.isdigit() else 0

    return metadata

def extract_transactions(file_path: str) -> List[Dict[str, Any]]:
    """Extract all transactions from CSV"""
    transactions = []

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        # Skip metadata lines (first 9 lines)
        for _ in range(9):
            f.readline()

        # Read header
        header_line = f.readline()

        # Read transactions
        reader = csv.reader(f, delimiter=';')
        for row in reader:
            if len(row) < 10:
                continue

            # Skip empty rows
            if not row[0] or row[0].strip() == '':
                continue

            closing_date = parse_date(row[0])
            if not closing_date:
                continue

            # Get balance (column 8)
            balance = parse_amount(row[8]) if len(row) > 8 else 0.0

            transactions.append({
                'date': closing_date.strftime('%Y-%m-%d'),
                'balance': balance
            })

    return transactions

def calculate_monthly_balances(all_transactions: List[Dict[str, Any]], quarters: List[Dict[str, Any]]) -> Dict[str, float]:
    """Calculate end-of-month balances for each month"""
    monthly_balances = {}

    # Group transactions by month
    by_month = defaultdict(list)
    for tx in all_transactions:
        date = datetime.strptime(tx['date'], '%Y-%m-%d')
        month_key = date.strftime('%Y-%m')
        by_month[month_key].append(tx)

    # For each month, get the last transaction's balance
    for month in sorted(by_month.keys()):
        transactions = by_month[month]
        # Sort by date to get the last one
        transactions.sort(key=lambda x: x['date'])
        last_balance = transactions[-1]['balance']
        monthly_balances[month] = last_balance

    # Override end of quarter months with official closing balance from metadata
    # This handles cases where last transaction date != actual closing date
    quarter_end_months = {
        '2024-03': ('Q1', quarters),  # March = end Q1
        '2024-06': ('Q2', quarters),  # June = end Q2
        '2024-09': ('Q3', quarters),  # September = end Q3
        '2024-12': ('Q4', quarters),  # December = end Q4
    }

    for month, (period, quarters_list) in quarter_end_months.items():
        for q in quarters_list:
            if q['period'] == period and month in monthly_balances:
                # Use official closing balance from quarter metadata
                monthly_balances[month] = q['closing']
                break

    return monthly_balances

def main():
    print("=" * 80)
    print("ANALISI FILE CSV UBS CHF 2024")
    print("=" * 80)

    quarters = []
    all_transactions = []
    account_number = None
    currency = None
    year_opening = None
    year_closing = None

    # Process each quarterly file
    for idx, filename in enumerate(CSV_FILES, 1):
        file_path = Path(BASE_PATH) / filename

        if not file_path.exists():
            print(f"[ERROR] File non trovato: {file_path}")
            continue

        print(f"\n[Q{idx}] Analizzando: {filename}")

        # Extract metadata
        metadata = extract_metadata(str(file_path))

        if idx == 1:
            account_number = metadata.get('account')
            currency = metadata.get('currency')
            year_opening = metadata.get('opening_balance')

        if idx == 4:
            year_closing = metadata.get('closing_balance')

        # Extract transactions
        transactions = extract_transactions(str(file_path))
        all_transactions.extend(transactions)

        # Add quarter info
        quarter_info = {
            'period': f'Q{idx}',
            'file': filename,
            'date_from': metadata.get('date_from'),
            'date_to': metadata.get('date_to'),
            'opening': metadata.get('opening_balance'),
            'closing': metadata.get('closing_balance'),
            'transactions': metadata.get('transactions', 0)
        }
        quarters.append(quarter_info)

        print(f"   Saldo iniziale: {quarter_info['opening']:,.2f} {currency}")
        print(f"   Saldo finale:   {quarter_info['closing']:,.2f} {currency}")
        print(f"   Transazioni:    {quarter_info['transactions']}")

    # Calculate monthly balances
    print(f"\nCalcolando saldi mensili...")
    monthly_balances = calculate_monthly_balances(all_transactions, quarters)

    # Format monthly balances
    monthly_data = {}
    for month in sorted(monthly_balances.keys()):
        monthly_data[month] = {
            'ending_balance': monthly_balances[month]
        }

    # Create final output
    output = {
        'account': account_number,
        'iban': metadata.get('iban'),
        'currency': currency,
        'year': 2024,
        'saldo_inizio_anno': year_opening,
        'saldo_fine_anno': year_closing,
        'monthly_balances': monthly_data,
        'quarters': quarters
    }

    # Ensure output directory exists
    output_path = Path(OUTPUT_FILE)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write JSON output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] File JSON creato: {OUTPUT_FILE}")

    # Print summary
    print("\n" + "=" * 80)
    print("RIEPILOGO ANNO 2024")
    print("=" * 80)
    print(f"Conto:              {account_number}")
    print(f"Valuta:             {currency}")
    print(f"Saldo 01/01/2024:   {year_opening:,.2f} {currency}")
    print(f"Saldo 31/12/2024:   {year_closing:,.2f} {currency}")
    print(f"Variazione:         {year_closing - year_opening:+,.2f} {currency}")
    print(f"Totale transazioni: {sum(q['transactions'] for q in quarters)}")

    print("\nSALDI FINE MESE:")
    print("-" * 80)
    for month in sorted(monthly_data.keys()):
        balance = monthly_data[month]['ending_balance']
        month_name = datetime.strptime(month, '%Y-%m').strftime('%B %Y')
        print(f"  {month_name:20s}: {balance:>15,.2f} {currency}")

    print("\n" + "=" * 80)
    print("[OK] Analisi completata!")
    print("=" * 80)

if __name__ == '__main__':
    main()
