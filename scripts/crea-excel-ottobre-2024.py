#!/usr/bin/env python3
"""
Crea Excel report da REPORT-OTTOBRE-2024.json
Con sheets: Summary, 1024-Transactions, 1025-Transactions, 1026-Transactions, Daily-Analysis
"""

import json
import pandas as pd
from datetime import datetime
import sys

# Fix Windows encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def load_report():
    """Carica report JSON"""
    with open('c:/Users/lapa/Desktop/Claude Code/app-hub-platform/REPORT-OTTOBRE-2024.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def create_summary_sheet(report):
    """Crea sheet riassuntivo"""
    data = []

    for konto_code, result in report['results'].items():
        if 'error' in result:
            continue

        data.append({
            'Konto': konto_code,
            'Nome': result['name'],
            'Valuta': result['currency'],
            'Saldo Inizio (30/09/2024)': result['balance_start']['balance'],
            'Entrate Ottobre': result['october_movements']['total_debit'],
            'Uscite Ottobre': result['october_movements']['total_credit'],
            'Variazione Netta': result['october_movements']['net_change'],
            'Saldo Fine (31/10/2024)': result['balance_end']['balance'],
            'Num Movimenti': result['october_movements']['num_moves'],
            'Status': result['verification']['status']
        })

    return pd.DataFrame(data)

def create_transactions_sheet(result, konto_code):
    """Crea sheet transazioni per un konto"""
    if 'transactions' not in result:
        return pd.DataFrame()

    txns = result['transactions']
    df = pd.DataFrame(txns)

    # Riordina colonne
    cols = ['date', 'name', 'ref', 'debit', 'credit', 'balance', 'partner', 'move_id', 'id']
    df = df[[c for c in cols if c in df.columns]]

    # Rinomina colonne
    df.columns = ['Data', 'Descrizione', 'Riferimento', 'Dare', 'Avere', 'Saldo', 'Partner', 'Registrazione', 'ID']

    return df

def create_daily_analysis_sheet(report):
    """Crea analisi giornaliera comparata"""
    data = []

    # Raccogli tutti i giorni
    all_dates = set()
    for result in report['results'].values():
        if 'daily_summary' in result:
            all_dates.update(result['daily_summary'].keys())

    all_dates = sorted(all_dates)

    for date in all_dates:
        row = {'Data': date}

        for konto_code, result in report['results'].items():
            if 'daily_summary' not in result:
                continue

            daily = result['daily_summary'].get(date, {})
            konto_name = result['name']

            row[f'{konto_name} - Movimenti'] = daily.get('num_moves', 0)
            row[f'{konto_name} - Dare'] = daily.get('debit', 0)
            row[f'{konto_name} - Avere'] = daily.get('credit', 0)
            row[f'{konto_name} - Netto'] = daily.get('net', 0)

        data.append(row)

    return pd.DataFrame(data)

def format_excel(writer, df, sheet_name):
    """Applica formattazione Excel"""
    df.to_excel(writer, sheet_name=sheet_name, index=False)

    workbook = writer.book
    worksheet = writer.sheets[sheet_name]

    # Formati
    money_fmt = workbook.add_format({'num_format': '#,##0.00'})
    header_fmt = workbook.add_format({
        'bold': True,
        'bg_color': '#4472C4',
        'font_color': 'white',
        'border': 1
    })
    date_fmt = workbook.add_format({'num_format': 'dd/mm/yyyy'})

    # Applica header format
    for col_num, value in enumerate(df.columns.values):
        worksheet.write(0, col_num, value, header_fmt)

    # Auto-width colonne
    for i, col in enumerate(df.columns):
        max_len = max(
            df[col].astype(str).map(len).max(),
            len(str(col))
        ) + 2
        worksheet.set_column(i, i, max_len)

    # Applica formato moneta alle colonne numeriche
    for i, col in enumerate(df.columns):
        if any(keyword in str(col).lower() for keyword in ['dare', 'avere', 'saldo', 'entrate', 'uscite', 'variazione', 'netto']):
            worksheet.set_column(i, i, 15, money_fmt)

    # Formato data
    for i, col in enumerate(df.columns):
        if 'data' in str(col).lower():
            worksheet.set_column(i, i, 12, date_fmt)

def main():
    print("=" * 80)
    print("CREAZIONE EXCEL REPORT OTTOBRE 2024")
    print("=" * 80)

    # 1. Carica report
    print("\nCaricamento report JSON...")
    report = load_report()
    print(f"OK - Report caricato ({len(report['results'])} konti)")

    # 2. Crea Excel
    output_file = 'c:/Users/lapa/Desktop/Claude Code/app-hub-platform/REPORT-OTTOBRE-2024.xlsx'
    print(f"\nCreazione Excel: {output_file}")

    with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
        # Sheet 1: Summary
        print("  - Sheet: Summary")
        df_summary = create_summary_sheet(report)
        format_excel(writer, df_summary, 'Summary')

        # Sheet 2-4: Transazioni per konto
        for konto_code, result in sorted(report['results'].items()):
            if 'error' in result:
                continue

            sheet_name = f"{konto_code}-{result['name'].replace(' ', '-')}"
            print(f"  - Sheet: {sheet_name} ({result['october_movements']['num_moves']} movimenti)")
            df_txns = create_transactions_sheet(result, konto_code)
            format_excel(writer, df_txns, sheet_name)

        # Sheet 5: Daily Analysis
        print("  - Sheet: Daily-Analysis")
        df_daily = create_daily_analysis_sheet(report)
        format_excel(writer, df_daily, 'Daily-Analysis')

    print(f"\nOK - Excel creato: {output_file}")
    print("\n" + "=" * 80)
    print("CONTENUTO EXCEL:")
    print("  1. Summary - Riepilogo konti con saldi e variazioni")
    print("  2. 1024-UBS-CHF - Dettaglio 395 transazioni UBS CHF")
    print("  3. 1025-UBS-EUR - Dettaglio 47 transazioni UBS EUR")
    print("  4. 1026-Credit-Suisse-CHF - Dettaglio 171 transazioni CS CHF")
    print("  5. Daily-Analysis - Analisi giornaliera comparata")
    print("=" * 80)

if __name__ == '__main__':
    main()
