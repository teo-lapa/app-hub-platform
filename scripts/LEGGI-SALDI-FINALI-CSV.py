#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LETTURA SALDI FINALI DA TUTTI I CSV BANCARI
"""
import sys
import io

# Fix encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

csv_files = [
    ('UBS CHF Q1', r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.1-31.3.2024.csv'),
    ('UBS CHF Q2', r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.4-30.6.2024.csv'),
    ('UBS CHF Q3', r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.7-30.9.2024.csv'),
    ('UBS CHF Q4', r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS CHF\UBS CHF 1.10-31.12.2024.csv'),
    ('UBS EUR H1', r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS EUR\UBS EUR 1.1-30.6.2024.csv'),
    ('UBS EUR H2', r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\UBS EUR\UBS EUR 1.7-31.12.2024.csv'),
]

print("=" * 100)
print("LETTURA SALDI FINALI DA CSV BANCARI")
print("=" * 100)

for name, filepath in csv_files:
    print(f"\n{name}: {filepath}")
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()

            # Print last 5 non-empty lines
            non_empty = [l for l in lines if l.strip()]
            print(f"  Righe totali: {len(lines)}")
            print(f"  Ultime 3 righe:")
            for line in non_empty[-3:]:
                parts = line.strip().split(';')
                if len(parts) >= 10:
                    # Format: date;;date;date;currency;debit;credit;?;?;balance;transaction_id;description;...
                    date = parts[0] if parts[0] else parts[2]
                    currency = parts[4]
                    debit = parts[5]
                    credit = parts[6]
                    balance = parts[9]
                    description = parts[11] if len(parts) > 11 else ''
                    print(f"    {date} | {currency} | Balance: {balance} | {description[:60]}")

    except Exception as e:
        print(f"  ERRORE: {str(e)}")

print("\n" + "=" * 100)
