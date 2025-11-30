# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
Analisi Pattern Konto 1023
===========================

Prima di eseguire la riconciliazione, analizza i pattern delle righe
per determinare la strategia migliore.

Output:
- Distribuzione importi
- Partner più frequenti
- Pattern temporali
- Suggerimenti strategia
"""

import sys
import io

# Fix encoding per Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import xmlrpc.client
import ssl
import pandas as pd
from collections import Counter, defaultdict
from datetime import datetime
import matplotlib.pyplot as plt

# Config
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

def get_unreconciled_lines(uid, models):
    """Estrai righe non riconciliate"""
    # Trova conto 1023
    account_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.account', 'search',
        [[['code', '=', '1023']]]
    )

    if not account_ids:
        return []

    # Righe non riconciliate
    line_ids = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'search',
        [[
            ['account_id', '=', account_ids[0]],
            ['reconciled', '=', False],
            ['parent_state', '=', 'posted']
        ]]
    )

    # Leggi dettagli
    lines = models.execute_kw(
        ODOO_CONFIG['db'], uid, ODOO_CONFIG['password'],
        'account.move.line', 'read',
        [line_ids],
        {
            'fields': [
                'id', 'name', 'date', 'debit', 'credit', 'balance',
                'partner_id', 'move_id', 'payment_id', 'ref'
            ]
        }
    )

    return lines

def analyze_patterns(lines):
    """Analizza pattern delle righe"""
    print(f"\n{'='*70}")
    print("ANALISI PATTERN KONTO 1023")
    print(f"{'='*70}\n")

    # Separa payments e invoices
    payments = [l for l in lines if l['debit'] > 0]
    invoices = [l for l in lines if l['credit'] > 0]

    print(f"DISTRIBUZIONE TIPO:")
    print(f"  Payments (debit): {len(payments)}")
    print(f"  Invoices (credit): {len(invoices)}")
    print(f"  Totale: {len(lines)}\n")

    # Importi
    print(f"IMPORTI:")
    total_debit = sum(l['debit'] for l in lines)
    total_credit = sum(l['credit'] for l in lines)
    total_balance = sum(l['balance'] for l in lines)

    print(f"  Dare totale: CHF {total_debit:,.2f}")
    print(f"  Avere totale: CHF {total_credit:,.2f}")
    print(f"  Saldo: CHF {total_balance:,.2f}\n")

    # Partner analysis
    print(f"TOP 10 PARTNER (per numero righe):")
    partner_counter = Counter()
    partner_amounts = defaultdict(float)

    for line in lines:
        if line['partner_id']:
            partner = line['partner_id'][1]
            amount = line['debit'] if line['debit'] > 0 else line['credit']
            partner_counter[partner] += 1
            partner_amounts[partner] += amount

    for partner, count in partner_counter.most_common(10):
        amount = partner_amounts[partner]
        print(f"  {partner[:40]:<40} Righe: {count:>3} | Importo: CHF {amount:>10,.2f}")

    print()

    # Partner senza nome
    no_partner = [l for l in lines if not l['partner_id']]
    if no_partner:
        print(f"⚠ RIGHE SENZA PARTNER: {len(no_partner)}")
        print(f"  Importo totale: CHF {sum(l['balance'] for l in no_partner):,.2f}\n")

    # Distribuzione importi
    print(f"DISTRIBUZIONE IMPORTI (payments):")
    if payments:
        amounts = [p['debit'] for p in payments]
        print(f"  Min: CHF {min(amounts):,.2f}")
        print(f"  Max: CHF {max(amounts):,.2f}")
        print(f"  Media: CHF {sum(amounts)/len(amounts):,.2f}")
        print(f"  Mediana: CHF {sorted(amounts)[len(amounts)//2]:,.2f}\n")

    # Range importi
    print(f"RANGE IMPORTI (payments):")
    ranges = {
        '0-100': 0,
        '100-500': 0,
        '500-1000': 0,
        '1000-5000': 0,
        '5000+': 0
    }

    for p in payments:
        amount = p['debit']
        if amount < 100:
            ranges['0-100'] += 1
        elif amount < 500:
            ranges['100-500'] += 1
        elif amount < 1000:
            ranges['500-1000'] += 1
        elif amount < 5000:
            ranges['1000-5000'] += 1
        else:
            ranges['5000+'] += 1

    for range_name, count in ranges.items():
        pct = (count / len(payments) * 100) if payments else 0
        print(f"  CHF {range_name:<15} {count:>4} righe ({pct:>5.1f}%)")

    print()

    # Pattern temporali
    print(f"DISTRIBUZIONE TEMPORALE:")
    dates = [datetime.strptime(l['date'], '%Y-%m-%d') for l in lines]
    oldest = min(dates)
    newest = max(dates)

    print(f"  Più vecchia: {oldest.strftime('%Y-%m-%d')}")
    print(f"  Più recente: {newest.strftime('%Y-%m-%d')}")
    print(f"  Range: {(newest - oldest).days} giorni\n")

    # Raggruppa per mese
    by_month = defaultdict(int)
    for date in dates:
        month_key = date.strftime('%Y-%m')
        by_month[month_key] += 1

    print(f"  Righe per mese (ultimi 12 mesi):")
    for month in sorted(by_month.keys())[-12:]:
        count = by_month[month]
        bar = '█' * (count // 10)
        print(f"    {month}: {count:>3} {bar}")

    print()

    # Potential matches
    print(f"POTENTIAL MATCHES (exact amount):")
    payment_amounts = defaultdict(list)
    invoice_amounts = defaultdict(list)

    for p in payments:
        if p['partner_id']:
            key = (p['partner_id'][0], round(p['debit'], 2))
            payment_amounts[key].append(p)

    for i in invoices:
        if i['partner_id']:
            key = (i['partner_id'][0], round(i['credit'], 2))
            invoice_amounts[key].append(i)

    # Trova matches
    exact_matches = 0
    for key in payment_amounts:
        if key in invoice_amounts:
            exact_matches += min(len(payment_amounts[key]), len(invoice_amounts[key]))

    print(f"  Exact matches trovati: {exact_matches}")
    print(f"  Percentuale matchable: {(exact_matches / len(lines) * 100):.1f}%\n")

    # Suggerimenti
    print(f"{'='*70}")
    print("SUGGERIMENTI STRATEGIA:")
    print(f"{'='*70}\n")

    if exact_matches > len(lines) * 0.7:
        print("✓ RACCOMANDATO: Script BASE (riconcilia-konto-1023.py)")
        print("  Motivo: >70% righe hanno exact match\n")
    else:
        print("✓ RACCOMANDATO: Script ADVANCED (riconcilia-konto-1023-advanced.py)")
        print("  Motivo: Molti pagamenti parziali o multipli\n")

    if no_partner:
        print("⚠ ATTENZIONE: Righe senza partner richiedono revisione manuale")
        print(f"  Affetta {len(no_partner)} righe ({len(no_partner)/len(lines)*100:.1f}%)\n")

    # Stima tempo
    estimated_time = len(lines) * 0.5  # 0.5 sec per riga
    print(f"Tempo stimato esecuzione: {estimated_time/60:.1f} minuti\n")

def generate_csv_report(lines):
    """Genera CSV per analisi"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"analisi_pattern_1023_{timestamp}.csv"
    filepath = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\{filename}"

    data = []
    for line in lines:
        data.append({
            'ID': line['id'],
            'Date': line['date'],
            'Partner': line['partner_id'][1] if line['partner_id'] else 'NO PARTNER',
            'Partner_ID': line['partner_id'][0] if line['partner_id'] else None,
            'Debit': line['debit'],
            'Credit': line['credit'],
            'Balance': line['balance'],
            'Move': line['move_id'][1],
            'Ref': line.get('ref', '')
        })

    df = pd.DataFrame(data)
    df.to_csv(filepath, index=False, encoding='utf-8-sig')

    print(f"✓ Report CSV generato: {filename}\n")

def main():
    """Main execution"""
    print("""
    ╔════════════════════════════════════════════════════════════════════╗
    ║  ANALISI PATTERN KONTO 1023 - Outstanding Payments                ║
    ╚════════════════════════════════════════════════════════════════════╝
    """)

    # Connetti
    print("Connessione a Odoo...")
    uid, models = connect()
    print(f"✓ Connesso (UID: {uid})\n")

    # Estrai righe
    print("Estrazione righe non riconciliate...")
    lines = get_unreconciled_lines(uid, models)

    if not lines:
        print("Nessuna riga non riconciliata trovata!")
        return

    print(f"✓ Trovate {len(lines)} righe\n")

    # Analizza
    analyze_patterns(lines)

    # Report CSV
    generate_csv_report(lines)

    print("✓ Analisi completata!\n")

if __name__ == "__main__":
    main()
