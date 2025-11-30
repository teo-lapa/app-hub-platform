#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RICONCILIAZIONE KONTO 1022 - V2
Approccio corretto: Outstanding Receipts sono TRANSITORI
Vanno riconciliati con fatture clienti (invoices) non con altri conti
"""

import sys
import io
import xmlrpc.client
from datetime import datetime, timedelta
from collections import defaultdict
import json

# Fix encoding per Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "lapa201180"

def connect_odoo():
    """Connessione a Odoo"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def get_account_id(models, uid, code):
    """Ottieni ID account da codice"""
    account_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.account', 'search',
        [[['code', '=', code]]]
    )
    return account_ids[0] if account_ids else None

def get_unreconciled_lines(models, uid, account_id):
    """Estrai tutte le righe non riconciliate del konto 1022"""
    print(f"\n{'='*80}")
    print(f"ESTRAZIONE RIGHE NON RICONCILIATE - KONTO 1022")
    print(f"{'='*80}\n")

    line_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_id],
            ['reconciled', '=', False],
            ['parent_state', '=', 'posted']
        ]]
    )

    if not line_ids:
        print("✓ Nessuna riga non riconciliata trovata - Konto già riconciliato!")
        return []

    lines = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move.line', 'read',
        [line_ids],
        {
            'fields': [
                'id', 'name', 'ref', 'date', 'move_id', 'move_name',
                'debit', 'credit', 'balance', 'amount_currency',
                'partner_id', 'account_id', 'journal_id',
                'reconciled', 'full_reconcile_id', 'matching_number'
            ]
        }
    )

    print(f"Trovate {len(lines)} righe non riconciliate\n")

    total_debit = sum(line['debit'] for line in lines)
    total_credit = sum(line['credit'] for line in lines)
    balance = total_debit - total_credit

    print(f"SALDO KONTO 1022:")
    print(f"  Dare:   CHF {total_debit:,.2f}")
    print(f"  Avere:  CHF {total_credit:,.2f}")
    print(f"  Saldo:  CHF {balance:,.2f}")
    print(f"{'-'*80}\n")

    return lines

def classify_line(line):
    """
    Classifica riga Outstanding Receipts:
    - PAYMENT: Pagamento cliente (dare > 0)
    - REFUND: Rimborso fornitore (dare > 0)
    - CLOSING: Chiusura contabile (movimenti 31/12)
    - ADJUSTMENT: Rettifica/storno
    """
    name = line['name'].lower()
    date = line['date']

    # Chiusure 31/12
    if date.endswith('-12-31'):
        return 'CLOSING'

    # Pagamenti clienti
    if 'pagamento cliente' in name or 'customer payment' in name:
        return 'PAYMENT'

    # Rimborsi fornitori
    if 'rimborso fornitore' in name:
        return 'REFUND'

    # Rettifiche
    if 'chiusura' in name or 'rettifica' in name or 'storno' in name:
        return 'ADJUSTMENT'

    return 'UNKNOWN'

def find_related_invoice(models, uid, line):
    """
    Trova fattura correlata a un pagamento Outstanding Receipts
    """
    if not line['partner_id']:
        return None

    partner_id = line['partner_id'][0]
    amount = line['debit'] if line['debit'] > 0 else line['credit']

    # Range date (±7 giorni)
    line_date = datetime.strptime(line['date'], '%Y-%m-%d')
    date_from = (line_date - timedelta(days=7)).strftime('%Y-%m-%d')
    date_to = (line_date + timedelta(days=7)).strftime('%Y-%m-%d')

    # Cerca fatture clienti non riconciliate
    domain = [
        ['partner_id', '=', partner_id],
        ['state', '=', 'posted'],
        ['payment_state', 'in', ['not_paid', 'partial']],
        ['invoice_date', '>=', date_from],
        ['invoice_date', '<=', date_to],
        ['amount_total', '>=', amount * 0.95],  # Tolleranza 5%
        ['amount_total', '<=', amount * 1.05],
    ]

    invoice_ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move', 'search',
        [domain],
        {'limit': 1}
    )

    if not invoice_ids:
        return None

    invoices = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'account.move', 'read',
        [invoice_ids],
        {'fields': ['id', 'name', 'invoice_date', 'amount_total', 'payment_state']}
    )

    return invoices[0] if invoices else None

def try_auto_reconcile(models, uid, line):
    """
    Tentativo riconciliazione automatica usando API Odoo
    """
    try:
        # Usa l'azione standard di riconciliazione pagamenti
        result = models.execute_kw(
            ODOO_DB, uid, ODOO_PASS,
            'account.move.line', 'action_automatic_entry',
            [[line['id']]],
            {}
        )
        return True, "Auto riconciliato"
    except Exception as e:
        return False, str(e)

def main():
    """Main riconciliazione"""
    print("\n" + "="*80)
    print("RICONCILIAZIONE KONTO 1022 - V2 (APPROCCIO COMMERCIALISTA)")
    print("="*80 + "\n")

    # Connessione
    print("Connessione a Odoo...")
    uid, models = connect_odoo()
    print(f"✓ Connesso come UID: {uid}\n")

    # Get account ID
    account_1022_id = get_account_id(models, uid, '1022')
    if not account_1022_id:
        print("✗ ERRORE: Konto 1022 non trovato!")
        return

    print(f"✓ Konto 1022 ID: {account_1022_id}\n")

    # Estrai righe non riconciliate
    unreconciled = get_unreconciled_lines(models, uid, account_1022_id)

    if not unreconciled:
        return

    # Classifica righe
    classification = defaultdict(list)
    for line in unreconciled:
        category = classify_line(line)
        classification[category].append(line)

    print(f"\n{'='*80}")
    print("CLASSIFICAZIONE RIGHE")
    print(f"{'='*80}\n")

    for category, lines in classification.items():
        total = sum(l['debit'] or -l['credit'] for l in lines)
        print(f"{category:15} {len(lines):4} righe  CHF {total:15,.2f}")

    # Analisi dettagliata per categoria
    print(f"\n{'='*80}")
    print("ANALISI DETTAGLIATA")
    print(f"{'='*80}\n")

    report = {
        'timestamp': datetime.now().isoformat(),
        'konto': '1022',
        'total_lines': len(unreconciled),
        'classification': {},
        'recommendations': []
    }

    # 1. PAYMENTS - Dovrebbero essere riconciliati con fatture clienti
    if 'PAYMENT' in classification:
        print(f"\n1. PAGAMENTI CLIENTI ({len(classification['PAYMENT'])} righe)")
        print("-" * 80)

        for line in classification['PAYMENT'][:10]:  # Mostra primi 10
            print(f"\nRiga {line['id']}: CHF {line['debit']:,.2f}")
            print(f"  Partner: {line['partner_id'][1] if line['partner_id'] else 'N/A'}")
            print(f"  Data: {line['date']}")

            # Cerca fattura correlata
            invoice = find_related_invoice(models, uid, line)
            if invoice:
                print(f"  ✓ Fattura trovata: {invoice['name']} CHF {invoice['amount_total']:,.2f}")
            else:
                print(f"  ✗ Nessuna fattura trovata - POSSIBILE PAGAMENTO NON ALLOCATO")

        report['classification']['PAYMENT'] = {
            'count': len(classification['PAYMENT']),
            'total': sum(l['debit'] for l in classification['PAYMENT'])
        }

    # 2. CLOSING - Chiusure contabili 31/12
    if 'CLOSING' in classification:
        print(f"\n2. CHIUSURE CONTABILI ({len(classification['CLOSING'])} righe)")
        print("-" * 80)

        closing_lines = classification['CLOSING']
        closing_debit = sum(l['debit'] for l in closing_lines)
        closing_credit = sum(l['credit'] for l in closing_lines)

        print(f"\n  Dare totale:  CHF {closing_debit:,.2f}")
        print(f"  Avere totale: CHF {closing_credit:,.2f}")
        print(f"  Bilancio:     CHF {closing_debit - closing_credit:,.2f}")

        print(f"\n  ⚠ ATTENZIONE: Chiusure devono essere gestite manualmente")
        print(f"  Suggerimento: Verificare con commercialista se sono corrette")

        report['classification']['CLOSING'] = {
            'count': len(closing_lines),
            'debit': closing_debit,
            'credit': closing_credit,
            'balance': closing_debit - closing_credit
        }

    # 3. REFUND - Rimborsi fornitori
    if 'REFUND' in classification:
        print(f"\n3. RIMBORSI FORNITORI ({len(classification['REFUND'])} righe)")
        print("-" * 80)

        refund_total = sum(l['debit'] for l in classification['REFUND'])
        print(f"\n  Totale rimborsi: CHF {refund_total:,.2f}")
        print(f"\n  ⚠ ATTENZIONE: Rimborsi dovrebbero essere in konto 2000 Payables")
        print(f"  Suggerimento: Riclassificare da 1022 a 2000")

        report['classification']['REFUND'] = {
            'count': len(classification['REFUND']),
            'total': refund_total
        }

    # 4. ADJUSTMENT - Rettifiche
    if 'ADJUSTMENT' in classification:
        print(f"\n4. RETTIFICHE/STORNI ({len(classification['ADJUSTMENT'])} righe)")
        print("-" * 80)

        for line in classification['ADJUSTMENT'][:5]:
            print(f"\nRiga {line['id']}: CHF {line['debit'] or -line['credit']:,.2f}")
            print(f"  Move: {line['move_name']}")
            print(f"  Descrizione: {line['name']}")

        report['classification']['ADJUSTMENT'] = {
            'count': len(classification['ADJUSTMENT'])
        }

    # 5. UNKNOWN - Da analizzare manualmente
    if 'UNKNOWN' in classification:
        print(f"\n5. DA CLASSIFICARE MANUALMENTE ({len(classification['UNKNOWN'])} righe)")
        print("-" * 80)

        for line in classification['UNKNOWN'][:5]:
            print(f"\nRiga {line['id']}: CHF {line['debit'] or -line['credit']:,.2f}")
            print(f"  Descrizione: {line['name']}")

        report['classification']['UNKNOWN'] = {
            'count': len(classification['UNKNOWN'])
        }

    # RACCOMANDAZIONI FINALI
    print(f"\n\n{'='*80}")
    print("RACCOMANDAZIONI COMMERCIALISTA")
    print(f"{'='*80}\n")

    recommendations = []

    # Check saldo elevato
    total_balance = sum(l['debit'] or -l['credit'] for l in unreconciled)
    if abs(total_balance) > 10000:
        rec = f"⚠ SALDO MOLTO ELEVATO: CHF {total_balance:,.2f} - Richiede analisi approfondita"
        print(f"1. {rec}")
        recommendations.append(rec)

    # Check chiusure
    if 'CLOSING' in classification and len(classification['CLOSING']) > 0:
        rec = "⚠ Presenza chiusure contabili 31/12 - Verificare con commercialista"
        print(f"2. {rec}")
        recommendations.append(rec)

    # Check rimborsi
    if 'REFUND' in classification and len(classification['REFUND']) > 0:
        rec = f"⚠ {len(classification['REFUND'])} rimborsi fornitori in 1022 - Dovrebbero essere in 2000"
        print(f"3. {rec}")
        recommendations.append(rec)

    # Check pagamenti non allocati
    if 'PAYMENT' in classification:
        rec = f"⚠ {len(classification['PAYMENT'])} pagamenti da riconciliare con fatture clienti"
        print(f"4. {rec}")
        recommendations.append(rec)

    report['recommendations'] = recommendations

    # Salva report
    report_file = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\report_1022_analisi_commercialista_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n✓ Report salvato: {report_file}")
    print(f"\n{'='*80}\n")

    # PROSSIMI PASSI
    print("\nPROSSIMI PASSI SUGGERITI:")
    print("="*80)
    print("\n1. Riconciliare manualmente pagamenti con fatture clienti in Odoo")
    print("2. Riclassificare rimborsi fornitori da 1022 a 2000")
    print("3. Verificare chiusure 31/12 con commercialista")
    print("4. Analizzare righe classificate come UNKNOWN")
    print("5. Iterare fino a saldo = 0\n")

if __name__ == '__main__':
    main()
