# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
Verifica Riconciliazione Konto 1023
====================================

Dopo l'esecuzione degli script di riconciliazione,
questo script verifica:

1. Saldo finale conto 1023
2. Numero righe non riconciliate rimanenti
3. Full reconcile IDs creati
4. Report finale per stakeholder
"""

import sys
import io

# Fix encoding per Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import xmlrpc.client
import ssl
import pandas as pd
from datetime import datetime
from typing import Dict, List

ODOO_CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

def connect():
    """Connetti a Odoo"""
    ssl_context = ssl._create_unverified_context()
    common = xmlrpc.client.ServerProxy(f"{ODOO_CONFIG['url']}/xmlrpc/2/common", context=ssl_context)
    uid = common.authenticate(ODOO_CONFIG['db'], ODOO_CONFIG['username'], ODOO_CONFIG['password'], {})
    models = xmlrpc.client.ServerProxy(f"{ODOO_CONFIG['url']}/xmlrpc/2/object", context=ssl_context)
    return uid, models

def get_account_1023(uid, models) -> int:
    """Trova conto 1023"""
    account_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.account', 'search',
        [[['code', '=', '1023']]]
    )
    return account_ids[0] if account_ids else None

def verify_balance(uid, models, account_id: int) -> Dict:
    """Verifica saldo finale"""
    print(f"\n{'='*70}")
    print("VERIFICA SALDO FINALE KONTO 1023")
    print(f"{'='*70}\n")

    # Tutte le righe (riconciliate + non)
    all_line_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'search',
        [[['account_id', '=', account_id], ['parent_state', '=', 'posted']]]
    )

    all_lines = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'read',
        [all_line_ids],
        {'fields': ['id', 'reconciled', 'balance', 'full_reconcile_id']}
    )

    # Statistiche
    total_lines = len(all_lines)
    reconciled_lines = [l for l in all_lines if l['reconciled']]
    unreconciled_lines = [l for l in all_lines if not l['reconciled']]

    total_balance = sum(l['balance'] for l in all_lines)
    reconciled_balance = sum(l['balance'] for l in reconciled_lines)
    unreconciled_balance = sum(l['balance'] for l in unreconciled_lines)

    print(f"TOTALE RIGHE: {total_lines}")
    print(f"  Riconciliate: {len(reconciled_lines)} ({len(reconciled_lines)/total_lines*100:.1f}%)")
    print(f"  Non riconciliate: {len(unreconciled_lines)} ({len(unreconciled_lines)/total_lines*100:.1f}%)\n")

    print(f"SALDI:")
    print(f"  Saldo totale: CHF {total_balance:,.2f}")
    print(f"  Saldo riconciliato: CHF {reconciled_balance:,.2f}")
    print(f"  Saldo non riconciliato: CHF {unreconciled_balance:,.2f}\n")

    # Status
    if abs(unreconciled_balance) < 0.01:
        print("✓ OBIETTIVO RAGGIUNTO: Saldo non riconciliato = CHF 0.00")
        status = 'SUCCESS'
    elif len(unreconciled_lines) < 50:
        print(f"⚠ QUASI COMPLETO: Rimangono {len(unreconciled_lines)} righe da riconciliare")
        status = 'PARTIAL'
    else:
        print(f"✗ ATTENZIONE: Rimangono {len(unreconciled_lines)} righe non riconciliate")
        status = 'INCOMPLETE'

    print(f"\n{'='*70}\n")

    return {
        'status': status,
        'total_lines': total_lines,
        'reconciled_count': len(reconciled_lines),
        'unreconciled_count': len(unreconciled_lines),
        'total_balance': total_balance,
        'unreconciled_balance': unreconciled_balance
    }

def analyze_reconciliations(uid, models, account_id: int) -> List[Dict]:
    """Analizza riconciliazioni create"""
    print(f"{'='*70}")
    print("ANALISI RICONCILIAZIONI CREATE")
    print(f"{'='*70}\n")

    # Trova full reconcile creati oggi
    today = datetime.now().strftime('%Y-%m-%d')

    reconcile_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.full.reconcile', 'search',
        [[['create_date', '>=', f'{today} 00:00:00']]]
    )

    if not reconcile_ids:
        print("Nessuna riconciliazione trovata oggi.\n")
        return []

    reconciles = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.full.reconcile', 'read',
        [reconcile_ids],
        {'fields': ['id', 'name', 'create_date', 'reconciled_line_ids']}
    )

    print(f"Riconciliazioni create oggi: {len(reconciles)}\n")

    # Dettagli
    details = []
    for rec in reconciles[:10]:  # Mostra prime 10
        line_ids = rec['reconciled_line_ids']

        lines = models.execute_kw(
            ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
            'account.move.line', 'read',
            [line_ids],
            {'fields': ['id', 'move_id', 'partner_id', 'debit', 'credit']}
        )

        total_amount = sum(l['debit'] for l in lines)
        partner = lines[0]['partner_id'][1] if lines[0]['partner_id'] else 'NO PARTNER'

        details.append({
            'reconcile_id': rec['id'],
            'name': rec['name'],
            'partner': partner,
            'amount': total_amount,
            'num_lines': len(lines),
            'create_date': rec['create_date']
        })

        print(f"  {rec['name']}: {len(lines)} righe, CHF {total_amount:,.2f} - {partner}")

    print(f"\n{'='*70}\n")

    return details

def analyze_unreconciled_remaining(uid, models, account_id: int) -> List[Dict]:
    """Analizza righe non riconciliate rimanenti"""
    print(f"{'='*70}")
    print("RIGHE NON RICONCILIATE RIMANENTI")
    print(f"{'='*70}\n")

    unreconciled_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_id],
            ['reconciled', '=', False],
            ['parent_state', '=', 'posted']
        ]]
    )

    if not unreconciled_ids:
        print("✓ Nessuna riga non riconciliata rimanente!\n")
        return []

    unreconciled = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'read',
        [unreconciled_ids],
        {
            'fields': [
                'id', 'name', 'date', 'debit', 'credit', 'balance',
                'partner_id', 'move_id', 'ref'
            ]
        }
    )

    print(f"Totale righe rimanenti: {len(unreconciled)}\n")

    # Raggruppa per motivo
    no_partner = [l for l in unreconciled if not l['partner_id']]
    small_amounts = [l for l in unreconciled if abs(l['balance']) < 10]
    old_lines = [l for l in unreconciled if l['date'] < '2024-01-01']

    print(f"CATEGORIZZAZIONE:")
    print(f"  Senza partner: {len(no_partner)}")
    print(f"  Importi piccoli (<CHF 10): {len(small_amounts)}")
    print(f"  Righe vecchie (pre-2024): {len(old_lines)}\n")

    # Top 10 rimanenti
    print(f"TOP 10 RIMANENTI (per importo):")
    sorted_lines = sorted(unreconciled, key=lambda x: abs(x['balance']), reverse=True)

    print(f"  {'ID':<10} {'Partner':<30} {'Date':<12} {'Balance':<12}")
    print(f"  {'-'*70}")

    for line in sorted_lines[:10]:
        partner = line['partner_id'][1] if line['partner_id'] else 'NO PARTNER'
        print(f"  {line['id']:<10} {partner[:28]:<30} {line['date']:<12} {line['balance']:>10.2f}")

    print(f"\n{'='*70}\n")

    return unreconciled

def generate_final_report(verify_result: Dict, reconciliations: List[Dict], remaining: List[Dict]) -> None:
    """Genera report finale Excel"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"verifica_finale_1023_{timestamp}.xlsx"
    filepath = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\{filename}"

    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        # Sheet 1: Summary
        summary = pd.DataFrame([
            ['STATUS', verify_result['status']],
            ['', ''],
            ['Totale righe conto 1023', verify_result['total_lines']],
            ['Righe riconciliate', verify_result['reconciled_count']],
            ['Righe non riconciliate', verify_result['unreconciled_count']],
            ['', ''],
            ['Saldo totale (CHF)', f"{verify_result['total_balance']:,.2f}"],
            ['Saldo non riconciliato (CHF)', f"{verify_result['unreconciled_balance']:,.2f}"],
            ['', ''],
            ['Riconciliazioni create', len(reconciliations)],
            ['', ''],
            ['Data verifica', datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
        ], columns=['Metrica', 'Valore'])
        summary.to_excel(writer, sheet_name='Summary', index=False)

        # Sheet 2: Riconciliazioni
        if reconciliations:
            df_rec = pd.DataFrame(reconciliations)
            df_rec.to_excel(writer, sheet_name='Riconciliazioni', index=False)

        # Sheet 3: Rimanenti
        if remaining:
            df_rem = pd.DataFrame([
                {
                    'ID': l['id'],
                    'Partner': l['partner_id'][1] if l['partner_id'] else 'NO PARTNER',
                    'Date': l['date'],
                    'Debit': l['debit'],
                    'Credit': l['credit'],
                    'Balance': l['balance'],
                    'Move': l['move_id'][1],
                    'Ref': l.get('ref', '')
                }
                for l in remaining
            ])
            df_rem.to_excel(writer, sheet_name='Rimanenti', index=False)

    print(f"✓ Report finale generato: {filename}\n")

def print_stakeholder_summary(verify_result: Dict) -> None:
    """Summary per stakeholder (CFO, Controller)"""
    print(f"\n{'='*70}")
    print("SUMMARY PER STAKEHOLDER")
    print(f"{'='*70}\n")

    print("RICONCILIAZIONE KONTO 1023 - OUTSTANDING PAYMENTS")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

    print(f"STATUS: {verify_result['status']}\n")

    print("RISULTATI:")
    print(f"  • Totale righe processate: {verify_result['total_lines']}")
    print(f"  • Riconciliate: {verify_result['reconciled_count']} "
          f"({verify_result['reconciled_count']/verify_result['total_lines']*100:.1f}%)")
    print(f"  • Rimanenti: {verify_result['unreconciled_count']}\n")

    print("IMPATTO BILANCIO:")
    print(f"  • Saldo conto 1023: CHF {verify_result['total_balance']:,.2f}")
    print(f"  • Saldo non riconciliato: CHF {verify_result['unreconciled_balance']:,.2f}\n")

    if verify_result['status'] == 'SUCCESS':
        print("✓ AZIONE RICHIESTA: Nessuna - processo completato con successo")
    elif verify_result['status'] == 'PARTIAL':
        print("⚠ AZIONE RICHIESTA: Revisione manuale righe rimanenti")
    else:
        print("✗ AZIONE RICHIESTA: Analisi approfondita necessaria")

    print(f"\n{'='*70}\n")

def main():
    """Main execution"""
    print("""
    ╔════════════════════════════════════════════════════════════════════╗
    ║  VERIFICA FINALE RICONCILIAZIONE KONTO 1023                       ║
    ╚════════════════════════════════════════════════════════════════════╝
    """)

    # Connetti
    print("Connessione a Odoo...")
    uid, models = connect()
    print(f"✓ Connesso (UID: {uid})\n")

    # Trova conto
    account_id = get_account_1023(uid, models)
    if not account_id:
        print("ERRORE: Conto 1023 non trovato!")
        return

    # 1. Verifica saldo
    verify_result = verify_balance(uid, models, account_id)

    # 2. Analizza riconciliazioni
    reconciliations = analyze_reconciliations(uid, models, account_id)

    # 3. Analizza rimanenti
    remaining = analyze_unreconciled_remaining(uid, models, account_id)

    # 4. Report Excel
    generate_final_report(verify_result, reconciliations, remaining)

    # 5. Summary stakeholder
    print_stakeholder_summary(verify_result)

    print("✓ Verifica completata!\n")

if __name__ == "__main__":
    main()
