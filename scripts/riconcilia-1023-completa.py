#!/usr/bin/env python3
"""
RICONCILIAZIONE COMPLETA KONTO 1023 - OUTSTANDING PAYMENTS
Commercialista Svizzero - Approccio Sistematico Riga per Riga
"""

import xmlrpc.client
from datetime import datetime
from collections import defaultdict
import json

# Configurazione Odoo
URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
USERNAME = "paul@lapa.ch"
PASSWORD = "lapa201180"

def connect_odoo():
    """Connessione a Odoo"""
    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
    uid = common.authenticate(DB, USERNAME, PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')
    return uid, models

def get_account_id(models, uid, code):
    """Ottieni ID account da codice"""
    account_ids = models.execute_kw(DB, uid, PASSWORD,
        'account.account', 'search',
        [[['code', '=', code]]])
    return account_ids[0] if account_ids else None

def get_unreconciled_lines(models, uid, account_id):
    """Estrai tutte le righe NON riconciliate dal konto"""
    lines = models.execute_kw(DB, uid, PASSWORD,
        'account.move.line', 'search_read',
        [[
            ['account_id', '=', account_id],
            ['reconciled', '=', False],
            ['parent_state', '=', 'posted']
        ]],
        {
            'fields': [
                'id', 'name', 'ref', 'date', 'debit', 'credit',
                'balance', 'partner_id', 'move_id', 'currency_id',
                'amount_currency', 'reconcile_model_id', 'matching_number'
            ],
            'order': 'date asc'
        }
    )
    return lines

def find_matching_line(line, all_lines):
    """
    Trova la riga opposta per riconciliazione
    Criteri: stessa data, importo opposto, stesso partner
    """
    target_balance = -line['balance']

    for candidate in all_lines:
        if candidate['id'] == line['id']:
            continue

        # Stesso importo opposto
        if abs(candidate['balance'] - target_balance) < 0.01:
            # Stessa data
            if candidate['date'] == line['date']:
                # Stesso partner (se entrambi hanno partner)
                if line['partner_id'] and candidate['partner_id']:
                    if line['partner_id'][0] == candidate['partner_id'][0]:
                        return candidate
                # Se uno non ha partner, accetta comunque
                elif not line['partner_id'] or not candidate['partner_id']:
                    return candidate

    return None

def find_cross_account_match(models, uid, line, account_codes):
    """
    Cerca contropartita in altri konti
    Tipicamente: 1023 <-> 1022, 1023 <-> 1001, ecc.
    """
    target_balance = -line['balance']

    for code in account_codes:
        account_id = get_account_id(models, uid, code)
        if not account_id:
            continue

        # Cerca righe simili in questo konto
        candidates = models.execute_kw(DB, uid, PASSWORD,
            'account.move.line', 'search_read',
            [[
                ['account_id', '=', account_id],
                ['reconciled', '=', False],
                ['date', '=', line['date']],
                ['parent_state', '=', 'posted']
            ]],
            {
                'fields': ['id', 'name', 'balance', 'partner_id', 'account_id'],
                'limit': 50
            }
        )

        for candidate in candidates:
            if abs(candidate['balance'] - target_balance) < 0.01:
                # Stesso partner se disponibile
                if line['partner_id'] and candidate['partner_id']:
                    if line['partner_id'][0] == candidate['partner_id'][0]:
                        return candidate, code
                elif not line['partner_id'] or not candidate['partner_id']:
                    return candidate, code

    return None, None

def reconcile_lines(models, uid, line_ids):
    """Riconcilia un set di righe"""
    try:
        # Usa il metodo reconcile dell'API Odoo
        result = models.execute_kw(DB, uid, PASSWORD,
            'account.move.line', 'reconcile',
            [line_ids])
        return True, result
    except Exception as e:
        return False, str(e)

def analyze_problematic_line(line):
    """Analizza perché una riga non è riconciliabile"""
    issues = []

    # Verifica importo strano
    if abs(line['balance']) < 0.01:
        issues.append("IMPORTO_QUASI_ZERO")

    # Verifica se molto vecchia
    line_date = datetime.strptime(line['date'], '%Y-%m-%d')
    days_old = (datetime.now() - line_date).days
    if days_old > 365:
        issues.append(f"RIGA_VECCHIA_{days_old}_GIORNI")

    # Verifica se manca partner
    if not line['partner_id']:
        issues.append("MANCA_PARTNER")

    # Verifica se ha riferimento
    if not line['ref'] and not line['name']:
        issues.append("MANCA_RIFERIMENTO")

    return issues

def main():
    print("=" * 80)
    print("RICONCILIAZIONE COMPLETA KONTO 1023 - OUTSTANDING PAYMENTS")
    print("Commercialista Svizzero - Approccio Sistematico")
    print("=" * 80)
    print()

    # Connessione
    print("1. Connessione a Odoo...")
    uid, models = connect_odoo()
    print(f"   OK Connesso come UID {uid}")
    print()

    # Ottieni account 1023
    print("2. Caricamento konto 1023...")
    account_1023_id = get_account_id(models, uid, '1023')
    if not account_1023_id:
        print("   ERRORE: Konto 1023 non trovato!")
        return
    print(f"   OK Konto 1023 ID: {account_1023_id}")
    print()

    # Estrai tutte le righe non riconciliate
    print("3. Estrazione righe NON riconciliate...")
    lines = get_unreconciled_lines(models, uid, account_1023_id)
    total_balance = sum(line['balance'] for line in lines)
    print(f"   OK Trovate {len(lines)} righe non riconciliate")
    print(f"   OK Saldo totale: CHF {total_balance:,.2f}")
    print()

    # Statistiche iniziali
    debit_lines = [l for l in lines if l['debit'] > 0]
    credit_lines = [l for l in lines if l['credit'] > 0]
    print(f"   - Righe DARE (debit):  {len(debit_lines)} righe, CHF {sum(l['debit'] for l in debit_lines):,.2f}")
    print(f"   - Righe AVERE (credit): {len(credit_lines)} righe, CHF {sum(l['credit'] for l in credit_lines):,.2f}")
    print()

    # RICONCILIAZIONE RIGA PER RIGA
    print("4. RICONCILIAZIONE SISTEMATICA RIGA PER RIGA")
    print("-" * 80)

    reconciled_count = 0
    cross_account_count = 0
    problematic_lines = []

    # Konti da controllare per cross-account matching
    cross_accounts = ['1022', '1001', '1000', '1099', '2000', '2001']

    processed_ids = set()

    for i, line in enumerate(lines, 1):
        if line['id'] in processed_ids:
            continue

        print(f"\n[{i}/{len(lines)}] Riga ID {line['id']} - {line['date']} - CHF {line['balance']:,.2f}")
        print(f"          {line['name']} (Ref: {line['ref']})")

        # STRATEGIA 1: Cerca match nello stesso konto 1023
        match = find_matching_line(line, lines)

        if match:
            print(f"   OK MATCH TROVATO nello stesso konto!")
            print(f"     Riga {match['id']} - {match['date']} - CHF {match['balance']:,.2f}")

            # Riconcilia
            success, result = reconcile_lines(models, uid, [line['id'], match['id']])

            if success:
                print(f"   OK RICONCILIATO con successo!")
                reconciled_count += 1
                processed_ids.add(line['id'])
                processed_ids.add(match['id'])
            else:
                print(f"   ERRORE riconciliazione: {result}")
                problematic_lines.append({
                    'line': line,
                    'match': match,
                    'error': result,
                    'type': 'RECONCILIATION_ERROR'
                })
            continue

        # STRATEGIA 2: Cerca in altri konti
        print(f"   -> Nessun match in 1023, cerco in altri konti...")
        cross_match, cross_account_code = find_cross_account_match(models, uid, line, cross_accounts)

        if cross_match:
            print(f"   OK MATCH CROSS-ACCOUNT trovato in konto {cross_account_code}!")
            print(f"     Riga {cross_match['id']} - CHF {cross_match['balance']:,.2f}")

            # Riconcilia
            success, result = reconcile_lines(models, uid, [line['id'], cross_match['id']])

            if success:
                print(f"   OK RICONCILIATO cross-account!")
                reconciled_count += 1
                cross_account_count += 1
                processed_ids.add(line['id'])
            else:
                print(f"   ERRORE riconciliazione: {result}")
                problematic_lines.append({
                    'line': line,
                    'match': cross_match,
                    'error': result,
                    'type': 'CROSS_ACCOUNT_ERROR',
                    'cross_account': cross_account_code
                })
            continue

        # STRATEGIA 3: Nessun match trovato - analizza
        print(f"   NESSUN MATCH TROVATO")
        issues = analyze_problematic_line(line)
        print(f"     Problemi rilevati: {', '.join(issues) if issues else 'NESSUN_PATTERN_RICONOSCIUTO'}")

        problematic_lines.append({
            'line': line,
            'match': None,
            'error': 'NO_MATCH_FOUND',
            'type': 'UNMATCHED',
            'issues': issues
        })

    # REPORT FINALE
    print("\n" + "=" * 80)
    print("REPORT FINALE RICONCILIAZIONE KONTO 1023")
    print("=" * 80)

    # Ricalcola saldo finale
    final_lines = get_unreconciled_lines(models, uid, account_1023_id)
    final_balance = sum(line['balance'] for line in final_lines)

    print(f"\nSTATISTICHE:")
    print(f"   - Righe iniziali non riconciliate:  {len(lines)}")
    print(f"   - Righe riconciliate con successo:  {reconciled_count} coppie")
    print(f"   - Di cui cross-account:             {cross_account_count}")
    print(f"   - Righe residue non riconciliate:   {len(final_lines)}")
    print(f"   - Righe problematiche:              {len(problematic_lines)}")
    print()
    print(f"SALDI:")
    print(f"   - Saldo iniziale:  CHF {total_balance:>15,.2f}")
    print(f"   - Saldo finale:    CHF {final_balance:>15,.2f}")
    print(f"   - Riduzione:       CHF {total_balance - final_balance:>15,.2f}")
    print()

    # Dettaglio righe problematiche
    if problematic_lines:
        print(f"\nRIGHE PROBLEMATICHE ({len(problematic_lines)}):")
        print("-" * 80)

        # Raggruppa per tipo
        by_type = defaultdict(list)
        for item in problematic_lines:
            by_type[item['type']].append(item)

        for prob_type, items in sorted(by_type.items()):
            print(f"\n{prob_type} ({len(items)} righe):")
            for item in items[:10]:  # Mostra prime 10 per tipo
                line = item['line']
                print(f"  - ID {line['id']} - {line['date']} - CHF {line['balance']:>10,.2f} - {line['name'][:50]}")
                if item.get('issues'):
                    print(f"    Problemi: {', '.join(item['issues'])}")
                if item.get('error'):
                    print(f"    Errore: {item['error']}")

            if len(items) > 10:
                print(f"  ... e altre {len(items) - 10} righe")

    # Salva report dettagliato
    report = {
        'timestamp': datetime.now().isoformat(),
        'initial_lines': len(lines),
        'initial_balance': total_balance,
        'reconciled_pairs': reconciled_count,
        'cross_account_reconciled': cross_account_count,
        'final_lines': len(final_lines),
        'final_balance': final_balance,
        'problematic_lines': problematic_lines
    }

    report_file = f'reconciliation-1023-report-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\nReport dettagliato salvato: {report_file}")

    # Raccomandazioni finali
    print("\n" + "=" * 80)
    print("RACCOMANDAZIONI COMMERCIALISTA")
    print("=" * 80)

    if final_balance == 0:
        print("ECCELLENTE! Konto 1023 completamente riconciliato (saldo = 0)")
    elif abs(final_balance) < 1:
        print(f"QUASI PERFETTO! Saldo residuo {final_balance:.2f} < CHF 1 (differenze arrotondamento)")
    elif len(final_lines) == 0:
        print("TUTTE LE RIGHE RICONCILIATE (verifica il saldo comunque)")
    else:
        print(f"ATTENZIONE: Rimangono {len(final_lines)} righe non riconciliate")
        print(f"   Saldo residuo: CHF {final_balance:,.2f}")
        print("\n   AZIONI SUGGERITE:")

        # Analizza i pattern delle righe residue
        old_lines = [l for l in final_lines if (datetime.now() - datetime.strptime(l['date'], '%Y-%m-%d')).days > 365]
        no_partner = [l for l in final_lines if not l['partner_id']]
        small_amounts = [l for l in final_lines if abs(l['balance']) < 1]

        if old_lines:
            print(f"   1. Verifica {len(old_lines)} righe vecchie >1 anno (possibile storno)")
        if no_partner:
            print(f"   2. Assegna partner a {len(no_partner)} righe senza controparte")
        if small_amounts:
            print(f"   3. Valuta storno {len(small_amounts)} righe con importo < CHF 1")

        print(f"   4. Controlla manualmente le righe in {report_file}")

    print("\n" + "=" * 80)
    print("RICONCILIAZIONE COMPLETATA")
    print("=" * 80)

if __name__ == '__main__':
    main()
