#!/usr/bin/env python3
"""
ANALISI MENSILE PROGRESSIVA 2024 - Business Analyst
====================================================
Identifica MESE PER MESE dove sono nati gli errori nei 5 conti problematici.

Autore: Business Analyst Agent
Data: 2025-11-15
"""

import xmlrpc.client
from datetime import datetime
from collections import defaultdict
import json

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Conti da analizzare
CONTI_PROBLEMATICI = {
    '1001': 'Cash',
    '1022': 'Outstanding Receipts',
    '1023': 'Outstanding Payments',
    '10901': 'Liquiditätstransfer',
    '1099': 'Transferkonto'
}

# Mesi 2024
MESI_2024 = [
    ('2024-01-01', '2024-01-31', 'GENNAIO 2024'),
    ('2024-02-01', '2024-02-29', 'FEBBRAIO 2024'),
    ('2024-03-01', '2024-03-31', 'MARZO 2024'),
    ('2024-04-01', '2024-04-30', 'APRILE 2024'),
    ('2024-05-01', '2024-05-31', 'MAGGIO 2024'),
    ('2024-06-01', '2024-06-30', 'GIUGNO 2024'),
    ('2024-07-01', '2024-07-31', 'LUGLIO 2024'),
    ('2024-08-01', '2024-08-31', 'AGOSTO 2024'),
    ('2024-09-01', '2024-09-30', 'SETTEMBRE 2024'),
    ('2024-10-01', '2024-10-31', 'OTTOBRE 2024'),
    ('2024-11-01', '2024-11-30', 'NOVEMBRE 2024'),
    ('2024-12-01', '2024-12-31', 'DICEMBRE 2024')
]

class OdooAnalyzer:
    def __init__(self):
        self.common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        self.uid = None

    def connect(self):
        """Connessione a Odoo"""
        print("Connessione a Odoo...")
        self.uid = self.common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
        if self.uid:
            print(f"[OK] Connesso come user ID: {self.uid}\n")
            return True
        else:
            print("[ERRORE] Autenticazione fallita")
            return False

    def execute(self, model, method, *args, **kwargs):
        """Wrapper per chiamate a Odoo"""
        return self.models.execute_kw(
            ODOO_DB, self.uid, ODOO_PASSWORD,
            model, method, args, kwargs
        )

    def get_account_id(self, code):
        """Recupera ID account da codice"""
        accounts = self.execute('account.account', 'search_read',
                               [['code', '=', code]],
                               {'limit': 1})
        return accounts[0]['id'] if accounts else None

    def get_saldo_iniziale(self, account_code, date):
        """Calcola saldo iniziale a una data (movimenti fino al giorno prima)"""
        account_id = self.get_account_id(account_code)
        if not account_id:
            return 0.0

        # Movimenti fino al giorno prima
        moves = self.execute('account.move.line', 'search_read',
            [['account_id', '=', account_id],
             ['date', '<', date],
             ['parent_state', '=', 'posted']],
            {'fields': ['debit', 'credit']})

        debit_total = sum(m['debit'] for m in moves)
        credit_total = sum(m['credit'] for m in moves)

        return debit_total - credit_total

    def get_movimenti_mese(self, account_code, date_from, date_to):
        """Recupera tutti i movimenti di un mese"""
        account_id = self.get_account_id(account_code)
        if not account_id:
            return []

        moves = self.execute('account.move.line', 'search_read',
            [['account_id', '=', account_id],
             ['date', '>=', date_from],
             ['date', '<=', date_to],
             ['parent_state', '=', 'posted']],
            {'fields': ['date', 'name', 'ref', 'debit', 'credit', 'balance',
                       'move_id', 'partner_id', 'amount_currency'],
             'order': 'date asc'})

        return moves

    def analizza_mese(self, account_code, date_from, date_to, nome_mese):
        """Analisi completa di un mese per un conto"""
        print(f"  Analizzando {account_code} - {CONTI_PROBLEMATICI[account_code]}...")

        # 1. Saldo iniziale
        saldo_iniziale = self.get_saldo_iniziale(account_code, date_from)

        # 2. Movimenti del mese
        movimenti = self.get_movimenti_mese(account_code, date_from, date_to)

        # 3. Calcoli
        dare_totale = sum(m['debit'] for m in movimenti)
        avere_totale = sum(m['credit'] for m in movimenti)
        movimento_netto = dare_totale - avere_totale
        saldo_finale = saldo_iniziale + movimento_netto

        # 4. Analizza anomalie
        anomalie = self.trova_anomalie(movimenti, account_code)

        return {
            'account_code': account_code,
            'account_name': CONTI_PROBLEMATICI[account_code],
            'saldo_iniziale': saldo_iniziale,
            'dare_totale': dare_totale,
            'avere_totale': avere_totale,
            'movimento_netto': movimento_netto,
            'saldo_finale': saldo_finale,
            'num_movimenti': len(movimenti),
            'movimenti': movimenti,
            'anomalie': anomalie
        }

    def trova_anomalie(self, movimenti, account_code):
        """Identifica movimenti anomali"""
        anomalie = []

        # 1. Movimenti con importi molto grandi (>50000 CHF)
        for m in movimenti:
            importo = max(m['debit'], m['credit'])
            if importo > 50000:
                anomalie.append({
                    'tipo': 'IMPORTO_ELEVATO',
                    'data': m['date'],
                    'descrizione': m['name'],
                    'importo': importo,
                    'movimento_id': m['move_id'][0] if m['move_id'] else None
                })

        # 2. Duplicati sospetti (stesso importo, stessa data)
        importi_per_data = defaultdict(list)
        for m in movimenti:
            key = f"{m['date']}_{m['debit']}_{m['credit']}"
            importi_per_data[key].append(m)

        for key, moves in importi_per_data.items():
            if len(moves) > 1:
                anomalie.append({
                    'tipo': 'POSSIBILE_DUPLICATO',
                    'data': moves[0]['date'],
                    'descrizione': f"{len(moves)} movimenti identici",
                    'importo': max(moves[0]['debit'], moves[0]['credit']),
                    'count': len(moves)
                })

        # 3. Movimenti sbilanciate (dare != avere in un giorno su conti transfer)
        if account_code in ['10901', '1099']:
            movimenti_per_data = defaultdict(list)
            for m in movimenti:
                movimenti_per_data[m['date']].append(m)

            for data, moves in movimenti_per_data.items():
                dare_giorno = sum(m['debit'] for m in moves)
                avere_giorno = sum(m['credit'] for m in moves)
                diff = abs(dare_giorno - avere_giorno)

                if diff > 0.01:  # Tolleranza arrotondamento
                    anomalie.append({
                        'tipo': 'SBILANCIAMENTO_GIORNALIERO',
                        'data': data,
                        'descrizione': 'Dare != Avere nel giorno',
                        'importo': diff,
                        'dare': dare_giorno,
                        'avere': avere_giorno
                    })

        # 4. Movimenti con riferimento vuoto o sospetto
        for m in movimenti:
            if not m.get('name') or m['name'] == '/':
                anomalie.append({
                    'tipo': 'RIFERIMENTO_MANCANTE',
                    'data': m['date'],
                    'descrizione': 'Movimento senza descrizione',
                    'importo': max(m['debit'], m['credit']),
                    'movimento_id': m['move_id'][0] if m['move_id'] else None
                })

        return anomalie

def formatta_chf(importo):
    """Formatta importo in CHF"""
    return f"CHF {importo:,.2f}".replace(',', "'")

def genera_report_markdown(analisi_completa):
    """Genera report markdown completo"""

    report = []
    report.append("# ANALISI MENSILE 2024 - CONTI PROBLEMATICI")
    report.append("")
    report.append(f"**Report generato**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"**Commercialista**: Saldi apertura 01.01.2024 CORRETTI ✓")
    report.append("")
    report.append("---")
    report.append("")

    # Statistiche summary
    mesi_ok = 0
    mesi_errori = 0
    totale_anomalie = 0

    # Analisi mese per mese
    for idx, (date_from, date_to, nome_mese) in enumerate(MESI_2024):
        report.append(f"## {nome_mese}")
        report.append("")

        mese_ha_anomalie = False

        # Per ogni conto
        for account_code in CONTI_PROBLEMATICI.keys():
            dati = analisi_completa[idx][account_code]

            report.append(f"### Konto {account_code} - {dati['account_name']}")
            report.append("")
            report.append(f"- **Saldo apertura**: {formatta_chf(dati['saldo_iniziale'])}")
            report.append(f"- **Dare {nome_mese.split()[0].lower()}**: {formatta_chf(dati['dare_totale'])}")
            report.append(f"- **Avere {nome_mese.split()[0].lower()}**: {formatta_chf(dati['avere_totale'])}")
            report.append(f"- **Movimento netto**: {formatta_chf(dati['movimento_netto'])}")
            report.append(f"- **Saldo chiusura**: {formatta_chf(dati['saldo_finale'])}")
            report.append(f"- **Movimenti**: {dati['num_movimenti']}")

            # Anomalie
            if dati['anomalie']:
                mese_ha_anomalie = True
                totale_anomalie += len(dati['anomalie'])

                report.append("")
                report.append(f"#### Anomalie rilevate: {len(dati['anomalie'])}")
                report.append("")

                for i, anomalia in enumerate(dati['anomalie'], 1):
                    report.append(f"{i}. **{anomalia['tipo']}**")
                    report.append(f"   - Data: {anomalia['data']}")
                    report.append(f"   - Descrizione: {anomalia.get('descrizione', 'N/A')}")
                    if 'importo' in anomalia:
                        report.append(f"   - Importo: {formatta_chf(anomalia['importo'])}")
                    if 'dare' in anomalia:
                        report.append(f"   - Dare giorno: {formatta_chf(anomalia['dare'])}")
                        report.append(f"   - Avere giorno: {formatta_chf(anomalia['avere'])}")
                    if 'count' in anomalia:
                        report.append(f"   - Occorrenze: {anomalia['count']}")
                    report.append("")
            else:
                report.append("- **Anomalie**: Nessuna [OK]")

            report.append("")

        if mese_ha_anomalie:
            mesi_errori += 1
        else:
            mesi_ok += 1

        report.append("---")
        report.append("")

    # Summary finale
    report.append("## SUMMARY ANALISI 2024")
    report.append("")
    report.append(f"- **Mesi analizzati**: 12")
    report.append(f"- **Mesi OK**: {mesi_ok}/12")
    report.append(f"- **Mesi con anomalie**: {mesi_errori}/12")
    report.append(f"- **Totale anomalie rilevate**: {totale_anomalie}")
    report.append("")

    # Top anomalie per tipo
    report.append("### Anomalie per Tipo")
    report.append("")

    tipi_anomalie = defaultdict(int)
    for mese_data in analisi_completa:
        for account_code, dati in mese_data.items():
            for anomalia in dati['anomalie']:
                tipi_anomalie[anomalia['tipo']] += 1

    for tipo, count in sorted(tipi_anomalie.items(), key=lambda x: x[1], reverse=True):
        report.append(f"- **{tipo}**: {count}")

    report.append("")

    # Raccomandazioni
    report.append("## AZIONI CORRETTIVE RACCOMANDATE")
    report.append("")

    if totale_anomalie > 0:
        report.append("### Priorita Alta")
        report.append("")
        report.append("1. **Investigare importi elevati (>50K CHF)**: Verificare se sono trasferimenti legittimi o errori di registrazione")
        report.append("2. **Eliminare duplicati**: Controllare movimenti identici nella stessa data")
        report.append("3. **Bilanciare conti transfer**: Assicurarsi che 10901 e 1099 siano bilanciati giornalmente")
        report.append("4. **Aggiungere descrizioni**: Completare movimenti senza riferimento")
        report.append("")

        report.append("### Processo di Rettifica")
        report.append("")
        report.append("1. Partire da GENNAIO 2024 (primo mese con anomalie)")
        report.append("2. Correggere mese per mese in ordine cronologico")
        report.append("3. Verificare che ogni rettifica non crei nuovi sbilanciamenti")
        report.append("4. Riconciliare ogni fine mese prima di passare al successivo")
        report.append("")
    else:
        report.append("Nessuna anomalia rilevata. I conti sono corretti. [OK]")
        report.append("")

    report.append("---")
    report.append("")
    report.append("**Report generato da**: Business Analyst Agent")
    report.append(f"**Data**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    return "\n".join(report)

def main():
    print("=" * 70)
    print("ANALISI MENSILE PROGRESSIVA 2024 - Business Analyst")
    print("=" * 70)
    print("")

    analyzer = OdooAnalyzer()

    if not analyzer.connect():
        return

    # Analisi completa
    analisi_completa = []

    for date_from, date_to, nome_mese in MESI_2024:
        print(f"\n{nome_mese} ({date_from} -> {date_to})")
        print("-" * 70)

        mese_data = {}

        for account_code in CONTI_PROBLEMATICI.keys():
            dati = analyzer.analizza_mese(account_code, date_from, date_to, nome_mese)
            mese_data[account_code] = dati

        analisi_completa.append(mese_data)

        # Progress
        print(f"  [OK] Completato\n")

    # Genera report
    print("\n" + "=" * 70)
    print("GENERAZIONE REPORT...")
    print("=" * 70 + "\n")

    report_md = genera_report_markdown(analisi_completa)

    # Salva report
    output_file = f"ANALISI_MENSILE_2024_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report_md)

    print(f"[OK] Report salvato: {output_file}")

    # Salva anche dati JSON per ulteriori analisi
    json_file = f"ANALISI_MENSILE_2024_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    # Prepara dati JSON (rimuovi oggetti non serializzabili)
    json_data = []
    for idx, mese_data in enumerate(analisi_completa):
        date_from, date_to, nome_mese = MESI_2024[idx]
        mese_json = {
            'periodo': nome_mese,
            'date_from': date_from,
            'date_to': date_to,
            'conti': {}
        }

        for account_code, dati in mese_data.items():
            mese_json['conti'][account_code] = {
                'account_name': dati['account_name'],
                'saldo_iniziale': dati['saldo_iniziale'],
                'dare_totale': dati['dare_totale'],
                'avere_totale': dati['avere_totale'],
                'movimento_netto': dati['movimento_netto'],
                'saldo_finale': dati['saldo_finale'],
                'num_movimenti': dati['num_movimenti'],
                'anomalie': dati['anomalie']
            }

        json_data.append(mese_json)

    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)

    print(f"[OK] Dati JSON salvati: {json_file}")
    print("")
    print("=" * 70)
    print("ANALISI COMPLETATA!")
    print("=" * 70)

if __name__ == "__main__":
    main()
