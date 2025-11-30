#!/usr/bin/env python3
"""
AGENTE FEBBRAIO 2024 - Verifica Completa Riga per Riga
Analizza movimenti bancari di FEBBRAIO 2024 per konti:
- 1024 (UBS CHF)
- 1025 (UBS EUR)
- 1026 (Credit Suisse)
"""

import json
import os
from datetime import datetime
from collections import defaultdict
from decimal import Decimal

# Percorsi file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UBS_EUR_TRANSACTIONS = os.path.join(BASE_DIR, 'data-estratti', 'UBS-EUR-2024-TRANSACTIONS.json')
OUTPUT_FILE = os.path.join(BASE_DIR, 'REPORT-FEBBRAIO-2024.json')

def analyze_february_2024():
    """Analizza FEBBRAIO 2024 riga per riga"""

    print("=" * 80)
    print("AGENTE FEBBRAIO 2024 - Verifica Completa Riga per Riga")
    print("=" * 80)
    print()

    # Carica transazioni UBS EUR
    print("[*] Caricamento transazioni UBS EUR...")
    with open(UBS_EUR_TRANSACTIONS, 'r', encoding='utf-8') as f:
        ubs_eur_data = json.load(f)

    # Trova transazioni FEBBRAIO 2024
    feb_transactions = []
    for tx in ubs_eur_data.get('transactions', []):
        date_str = tx.get('date', '')
        if date_str.startswith('2024-02'):
            feb_transactions.append(tx)

    print(f"[OK] Trovate {len(feb_transactions)} transazioni FEBBRAIO 2024")
    print()

    # Analisi dettagliata
    report = {
        "periodo": "FEBBRAIO 2024",
        "date_from": "2024-02-01",
        "date_to": "2024-02-29",
        "analysis_timestamp": datetime.now().isoformat(),
        "konti_analizzati": [
            {"code": "1024", "description": "UBS CHF", "status": "NON DISPONIBILE - Richiede CSV raw"},
            {"code": "1025", "description": "UBS EUR", "status": "ANALIZZATO"},
            {"code": "1026", "description": "Credit Suisse", "status": "NON DISPONIBILE - Richiede CSV raw"}
        ],
        "konto_1025_ubs_eur": analyze_ubs_eur_february(feb_transactions),
        "summary": {}
    }

    # Calcola summary
    ubs_eur = report.get('konto_1025_ubs_eur', {})
    opening = ubs_eur.get('opening_balance', 0)
    closing = ubs_eur.get('closing_balance', 0)
    net_change = sum(Decimal(str(tx.get('amount', 0))) for tx in feb_transactions)

    report["summary"] = {
        "total_transactions": len(feb_transactions),
        "total_debit": float(sum(abs(Decimal(str(tx.get('debit', 0)))) for tx in feb_transactions)),
        "total_credit": float(sum(Decimal(str(tx.get('credit', 0))) for tx in feb_transactions)),
        "net_change": float(net_change),
        "opening_balance_konto_1025": opening,
        "closing_balance_konto_1025": closing,
        "calculated_change": closing - opening,
        "balance_matches": abs((closing - opening) - float(net_change)) < 0.01
    }

    # Salva report
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # Stampa summary
    print_report_summary(report)

    print()
    print(f"[OK] Report salvato in: {OUTPUT_FILE}")
    print()

    return report

def analyze_ubs_eur_february(transactions):
    """Analizza UBS EUR FEBBRAIO 2024 riga per riga"""

    print("=" * 80)
    print("KONTO 1025 - UBS EUR - FEBBRAIO 2024")
    print("=" * 80)
    print()

    # Ordina per data e line_number
    sorted_txs = sorted(transactions, key=lambda x: (x.get('date', ''), -x.get('line_number', 0)))

    # Calcola saldo iniziale (balance dopo prima tx - amount prima tx)
    if sorted_txs:
        first_tx = sorted_txs[0]
        opening_balance = Decimal(str(first_tx.get('balance', 0))) - Decimal(str(first_tx.get('amount', 0)))
        closing_balance = Decimal(str(sorted_txs[-1].get('balance', 0)))
    else:
        opening_balance = Decimal('0')
        closing_balance = Decimal('0')

    analysis = {
        "konto_code": "1025",
        "konto_description": "UBS EUR (0278 00122087.60)",
        "period": "2024-02-01 → 2024-02-29",
        "opening_balance": float(opening_balance),
        "closing_balance": float(closing_balance),
        "total_transactions": len(sorted_txs),
        "transactions_detail": [],
        "summary_by_type": defaultdict(lambda: {"count": 0, "total": 0.0}),
        "summary_by_partner": defaultdict(lambda: {"count": 0, "total": 0.0}),
        "flags": []
    }

    running_balance = opening_balance

    print(f"Saldo iniziale (31/01/2024): EUR {running_balance:,.2f}")
    print()
    print("=" * 80)
    print()

    for idx, tx in enumerate(sorted_txs, 1):
        date = tx.get('date', 'N/A')
        description = tx.get('description', '').strip()
        partner = tx.get('partner_name', '').strip()

        # Gestisci debit/credit (nota: debit è negativo, credit è positivo in questo formato)
        amount = Decimal(str(tx.get('amount', 0)))
        debit = abs(Decimal(str(tx.get('debit', 0))))
        credit = Decimal(str(tx.get('credit', 0)))

        running_balance += amount

        # Categorizza transazione
        tx_type = categorize_transaction(description, partner)

        # Dettaglio transazione
        tx_detail = {
            "seq": idx,
            "date": date,
            "description": description[:100] if description else partner,
            "debit": float(debit),
            "credit": float(credit),
            "amount": float(amount),
            "balance": float(running_balance),
            "type": tx_type,
            "partner": partner if partner else None
        }

        analysis["transactions_detail"].append(tx_detail)

        # Aggiorna summary
        analysis["summary_by_type"][tx_type]["count"] += 1
        analysis["summary_by_type"][tx_type]["total"] += float(amount)

        if partner:
            analysis["summary_by_partner"][partner]["count"] += 1
            analysis["summary_by_partner"][partner]["total"] += float(amount)

        # Stampa riga
        arrow = "OUT" if amount < 0 else "IN "
        amount_str = f"EUR {abs(amount):>12,.2f}"

        print(f"{idx:3d}. {date} | {arrow} {amount_str} | Saldo: EUR {running_balance:>12,.2f}")
        print(f"     {description[:70]}")
        if tx_type != "OTHER":
            print(f"     [{tx_type}]", end="")
            if partner:
                print(f" > {partner}", end="")
            print()
        print()

    # Verifica finale
    print("=" * 80)
    print()
    print(f"Saldo finale calcolato:  EUR {running_balance:,.2f}")
    print(f"Saldo finale atteso:     EUR {closing_balance:,.2f}")

    diff = abs(running_balance - closing_balance)
    if diff < Decimal('0.01'):
        print("[OK] SALDO VERIFICATO - Match perfetto!")
        analysis["balance_verification"] = "PASS"
    else:
        print(f"[WARNING] DIFFERENZA: EUR {diff:.2f}")
        analysis["balance_verification"] = "FAIL"
        analysis["flags"].append({
            "type": "BALANCE_MISMATCH",
            "expected": float(closing_balance),
            "calculated": float(running_balance),
            "difference": float(diff)
        })

    print()

    # Converti defaultdict a dict normale
    analysis["summary_by_type"] = dict(analysis["summary_by_type"])
    analysis["summary_by_partner"] = dict(analysis["summary_by_partner"])

    return analysis

def categorize_transaction(description, partner):
    """Categorizza la transazione"""
    text = f"{description} {partner}".upper()

    if 'STIPENDIO' in text or 'SALARY' in text or 'SALAIRE' in text:
        return "SALARY"
    elif 'BONIFICO' in text or 'VIREMENT' in text or 'TRANSFER' in text or 'E-BANKING' in text:
        return "BANK_TRANSFER"
    elif 'FATTURA' in text or 'INVOICE' in text or 'FACTURE' in text:
        return "INVOICE_PAYMENT"
    elif 'CARTA' in text or 'CARD' in text or 'CARTE' in text:
        return "CARD_PAYMENT"
    elif 'COMMISSIONE' in text or 'FEE' in text or 'FRAIS' in text or 'KOSTEN' in text:
        return "BANK_FEE"
    elif 'INTERESSE' in text or 'INTEREST' in text or 'INTERET' in text or 'ZINSEN' in text:
        return "INTEREST"
    elif 'CAMBIO' in text or 'EXCHANGE' in text or 'CHANGE' in text or 'DEVISEN' in text:
        return "CURRENCY_EXCHANGE"
    else:
        return "OTHER"

def print_report_summary(report):
    """Stampa summary del report"""

    print()
    print("=" * 80)
    print("SUMMARY FEBBRAIO 2024")
    print("=" * 80)
    print()

    summary = report["summary"]

    print(f"Totale transazioni:     {summary['total_transactions']}")
    print(f"Totale DEBIT (uscite):  EUR {summary['total_debit']:,.2f}")
    print(f"Totale CREDIT (entrate): EUR {summary['total_credit']:,.2f}")
    print(f"Variazione netta:       EUR {summary['net_change']:,.2f}")
    print()
    print(f"Saldo apertura 1025:    EUR {summary['opening_balance_konto_1025']:,.2f}")
    print(f"Saldo chiusura 1025:    EUR {summary['closing_balance_konto_1025']:,.2f}")
    print(f"Variazione calcolata:   EUR {summary['calculated_change']:,.2f}")
    print()

    if summary['balance_matches']:
        print("[OK] VERIFICA SALDO: OK")
    else:
        print("[WARNING] VERIFICA SALDO: DIFFERENZA RILEVATA")

    print()

    # Summary per tipo
    ubs_eur = report.get('konto_1025_ubs_eur', {})
    summary_by_type = ubs_eur.get('summary_by_type', {})

    if summary_by_type:
        print("Distribuzione per tipo:")
        print()
        for tx_type, data in sorted(summary_by_type.items(), key=lambda x: abs(x[1]['total']), reverse=True):
            count = data['count']
            total = data['total']
            avg = total / count if count > 0 else 0
            print(f"  {tx_type:20s}: {count:3d} tx | Tot: EUR {total:>12,.2f} | Media: EUR {avg:>10,.2f}")

    print()

if __name__ == '__main__':
    try:
        analyze_february_2024()
    except Exception as e:
        print(f"[ERROR] Errore: {e}")
        import traceback
        traceback.print_exc()
