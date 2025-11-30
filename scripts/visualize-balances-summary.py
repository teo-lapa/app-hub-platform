#!/usr/bin/env python3
"""
Visualizza un riepilogo testuale dei saldi bancari 2024
"""

import json
from datetime import datetime

def load_data():
    """Carica i dati dal JSON"""
    json_path = r"C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data-estratti\ODOO-BALANCES-2024-CLEAN.json"
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def print_header():
    """Stampa header"""
    print("\n" + "="*100)
    print(" "*35 + "RIEPILOGO SALDI BANCARI 2024")
    print("="*100 + "\n")

def print_monthly_totals(data):
    """Stampa i totali mensili"""
    print("\nEVOLUZIONE SALDO TOTALE MENSILE:")
    print("-" * 100)
    print(f"{'Mese':<12} {'Saldo (CHF)':>20} {'Variazione':>20} {'N. Movimenti':>20}")
    print("-" * 100)

    months = [
        ("2024-01-31", "Gennaio"),
        ("2024-02-29", "Febbraio"),
        ("2024-03-31", "Marzo"),
        ("2024-04-30", "Aprile"),
        ("2024-05-31", "Maggio"),
        ("2024-06-30", "Giugno"),
        ("2024-07-31", "Luglio"),
        ("2024-08-31", "Agosto"),
        ("2024-09-30", "Settembre"),
        ("2024-10-31", "Ottobre"),
        ("2024-11-30", "Novembre"),
        ("2024-12-31", "Dicembre")
    ]

    prev_total = 0
    for month_end, month_name in months:
        total = sum(
            account['monthly_balances'].get(month_end, {}).get('balance', 0)
            for account in data['accounts']
        )
        movements = sum(
            account['monthly_balances'].get(month_end, {}).get('movements', 0)
            for account in data['accounts']
        )

        variation = total - prev_total if prev_total != 0 else 0
        var_sign = "+" if variation >= 0 else ""
        total_sign = "+" if total >= 0 else ""

        print(f"{month_name:<12} {total_sign}{total:>19,.2f} {var_sign}{variation:>19,.2f} {movements:>20,}")
        prev_total = total

    print("-" * 100)

def print_account_summary(data):
    """Stampa riepilogo per conto"""
    print("\n\nSALDI FINALI PER CONTO (31/12/2024):")
    print("-" * 100)
    print(f"{'Codice':<8} {'Nome Conto':<50} {'Saldo (CHF)':>20} {'Movimenti':>15}")
    print("-" * 100)

    # Ordina per saldo decrescente
    sorted_accounts = sorted(
        data['accounts'],
        key=lambda x: x['monthly_balances'].get('2024-12-31', {}).get('balance', 0),
        reverse=True
    )

    positive_total = 0
    negative_total = 0

    for account in sorted_accounts:
        balance = account['monthly_balances'].get('2024-12-31', {}).get('balance', 0)
        movements = account['monthly_balances'].get('2024-12-31', {}).get('movements', 0)

        sign = "+" if balance >= 0 else ""
        print(f"{account['code']:<8} {account['name'][:50]:<50} {sign}{balance:>19,.2f} {movements:>15,}")

        if balance >= 0:
            positive_total += balance
        else:
            negative_total += balance

    print("-" * 100)
    total = positive_total + negative_total
    total_sign = "+" if total >= 0 else ""
    print(f"{'TOTALE':<58} {total_sign}{total:>19,.2f}")
    print(f"{'Saldi Positivi':<58} +{positive_total:>19,.2f}")
    print(f"{'Saldi Negativi':<58} {negative_total:>19,.2f}")
    print("=" * 100)

def print_top_accounts(data):
    """Stampa i conti più attivi"""
    print("\n\nCONTI PIU' ATTIVI (per numero movimenti anno 2024):")
    print("-" * 80)

    # Calcola movimenti totali per ogni conto
    accounts_movements = []
    for account in data['accounts']:
        total_movements = account['monthly_balances'].get('2024-12-31', {}).get('movements', 0)
        accounts_movements.append({
            'code': account['code'],
            'name': account['name'],
            'movements': total_movements
        })

    # Ordina per movimenti
    sorted_by_movements = sorted(accounts_movements, key=lambda x: x['movements'], reverse=True)

    print(f"{'Pos':<5} {'Codice':<8} {'Nome Conto':<45} {'Movimenti':>15}")
    print("-" * 80)

    for i, account in enumerate(sorted_by_movements[:10], 1):
        print(f"{i:<5} {account['code']:<8} {account['name'][:45]:<45} {account['movements']:>15,}")

    print("-" * 80)

def print_key_findings(data):
    """Stampa osservazioni chiave"""
    print("\n\nOSSERVAZIONI CHIAVE:")
    print("-" * 100)

    # 1. Conti con saldo negativo persistente
    negative_accounts = [
        account for account in data['accounts']
        if account['monthly_balances'].get('2024-12-31', {}).get('balance', 0) < -50000
    ]

    if negative_accounts:
        print("\n1. CONTI CON SALDO NEGATIVO SIGNIFICATIVO (< -50,000 CHF):")
        for account in negative_accounts:
            balance = account['monthly_balances'].get('2024-12-31', {}).get('balance', 0)
            print(f"   - {account['code']} ({account['name']}): {balance:,.2f} CHF")

    # 2. Variazione più grande in un mese
    print("\n2. MAGGIORI VARIAZIONI MENSILI:")
    max_increase = {'month': '', 'amount': 0}
    max_decrease = {'month': '', 'amount': 0}

    months = [
        ("2024-01-31", "Gennaio"),
        ("2024-02-29", "Febbraio"),
        ("2024-03-31", "Marzo"),
        ("2024-04-30", "Aprile"),
        ("2024-05-31", "Maggio"),
        ("2024-06-30", "Giugno"),
        ("2024-07-31", "Luglio"),
        ("2024-08-31", "Agosto"),
        ("2024-09-30", "Settembre"),
        ("2024-10-31", "Ottobre"),
        ("2024-11-30", "Novembre"),
        ("2024-12-31", "Dicembre")
    ]

    prev_total = 0
    for month_end, month_name in months:
        total = sum(
            account['monthly_balances'].get(month_end, {}).get('balance', 0)
            for account in data['accounts']
        )

        if prev_total != 0:
            variation = total - prev_total
            if variation > max_increase['amount']:
                max_increase = {'month': month_name, 'amount': variation}
            if variation < max_decrease['amount']:
                max_decrease = {'month': month_name, 'amount': variation}

        prev_total = total

    print(f"   - Maggiore aumento: {max_increase['month']} (+{max_increase['amount']:,.2f} CHF)")
    print(f"   - Maggiore calo: {max_decrease['month']} ({max_decrease['amount']:,.2f} CHF)")

    # 3. Conto principale
    main_account = max(
        data['accounts'],
        key=lambda x: abs(x['monthly_balances'].get('2024-12-31', {}).get('balance', 0))
    )
    main_balance = main_account['monthly_balances'].get('2024-12-31', {}).get('balance', 0)

    print(f"\n3. CONTO CON SALDO PIU' ELEVATO:")
    print(f"   - {main_account['code']} ({main_account['name']}): {main_balance:+,.2f} CHF")

    print("\n" + "="*100)

def main():
    """Funzione principale"""
    try:
        # Carica dati
        data = load_data()

        # Stampa report
        print_header()
        print(f"Data estrazione: {datetime.fromisoformat(data['extraction_date']).strftime('%d/%m/%Y %H:%M')}")
        print(f"Database: {data['odoo_db']}")
        print(f"Conti analizzati: {len(data['accounts'])}")

        print_monthly_totals(data)
        print_account_summary(data)
        print_top_accounts(data)
        print_key_findings(data)

        print("\n")

    except Exception as e:
        print(f"\n[ERRORE]: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
