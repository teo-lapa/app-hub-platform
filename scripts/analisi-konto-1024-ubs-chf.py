#!/usr/bin/env python3
"""
Analisi Dettagliata Konto 1024 UBS CHF
Commercialista Svizzero - Verifica Riga per Riga

Author: Backend Specialist
Date: 2025-11-16
"""

import xmlrpc.client
from datetime import datetime
from collections import defaultdict
import json

# Odoo Configuration
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Account 1024 UBS CHF
ACCOUNT_ID = 176
SALDO_ATTESO = 182573.56

class OdooClient:
    """Client XML-RPC per Odoo con error handling"""

    def __init__(self):
        self.common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        self.uid = None

    def authenticate(self):
        """Authenticate con Odoo"""
        try:
            self.uid = self.common.authenticate(
                ODOO_DB,
                ODOO_USERNAME,
                ODOO_PASSWORD,
                {}
            )
            print(f"[OK] Autenticato come UID: {self.uid}")
            return self.uid
        except Exception as e:
            print(f"[ERROR] Errore autenticazione: {e}")
            raise

    def execute_kw(self, model, method, args=None, kwargs=None):
        """Execute Odoo method con error handling"""
        try:
            if args is None:
                args = []
            if kwargs is None:
                kwargs = {}

            return self.models.execute_kw(
                ODOO_DB,
                self.uid,
                ODOO_PASSWORD,
                model,
                method,
                args,
                kwargs
            )
        except Exception as e:
            print(f"[ERROR] Errore execute {model}.{method}: {e}")
            raise


class Konto1024Analyzer:
    """Analizzatore Konto 1024 UBS CHF"""

    def __init__(self, odoo_client):
        self.odoo = odoo_client
        self.righe = []
        self.anomalie = []
        self.saldo_calcolato = 0.0
        self.stats = defaultdict(int)

    def fetch_righe(self):
        """Fetch TUTTE le righe del konto 1024"""
        print("\n" + "="*80)
        print("STEP 1: FETCH RIGHE KONTO 1024 (account_id = 176)")
        print("="*80)

        # Cerca tutte le righe per account 1024
        domain = [['account_id', '=', ACCOUNT_ID]]

        field_list = [
            'id',
            'move_id',
            'date',
            'name',
            'debit',
            'credit',
            'balance',
            'partner_id',
            'account_id',
            'company_id',
            'currency_id',
            'display_type',
            'parent_state',  # stato del move
            'reconciled',
            'full_reconcile_id',
            'matching_number'
        ]

        print(f"Fetch righe con domain: {domain}")
        # search_read signature: search_read(domain, fields=None, offset=0, limit=None, order=None)
        # execute_kw passa [domain, fields] come args posizionali
        self.righe = self.odoo.execute_kw(
            'account.move.line',
            'search_read',
            [domain, field_list],  # args posizionali
            {'order': 'date asc, id asc'}  # kwargs
        )

        print(f"[OK] Fetched {len(self.righe)} righe")
        return self.righe

    def verifica_riga(self, riga, index):
        """Verifica una singola riga - controlli commercialista"""
        anomalie_riga = []

        riga_id = riga['id']
        date = riga.get('date')
        name = riga.get('name', '')
        debit = riga.get('debit', 0.0)
        credit = riga.get('credit', 0.0)
        balance = riga.get('balance', 0.0)
        partner = riga.get('partner_id')
        move_id = riga.get('move_id')
        state = riga.get('parent_state')

        # 1. Data corretta
        if not date:
            anomalie_riga.append({
                'tipo': 'DATA_MANCANTE',
                'riga_id': riga_id,
                'severita': 'CRITICA',
                'messaggio': 'Data mancante'
            })
        else:
            try:
                date_obj = datetime.strptime(date, '%Y-%m-%d')
                # Verifica date anomale (es. future o troppo vecchie)
                if date_obj.year < 2020:
                    anomalie_riga.append({
                        'tipo': 'DATA_SOSPETTA',
                        'riga_id': riga_id,
                        'severita': 'MEDIA',
                        'messaggio': f'Data molto vecchia: {date}',
                        'data': date
                    })
                if date_obj > datetime.now():
                    anomalie_riga.append({
                        'tipo': 'DATA_FUTURA',
                        'riga_id': riga_id,
                        'severita': 'ALTA',
                        'messaggio': f'Data futura: {date}',
                        'data': date
                    })
            except:
                anomalie_riga.append({
                    'tipo': 'DATA_INVALIDA',
                    'riga_id': riga_id,
                    'severita': 'CRITICA',
                    'messaggio': f'Data non parsabile: {date}',
                    'data': date
                })

        # 2. Importo corretto
        if debit < 0:
            anomalie_riga.append({
                'tipo': 'DEBIT_NEGATIVO',
                'riga_id': riga_id,
                'severita': 'CRITICA',
                'messaggio': f'Debit negativo: {debit}',
                'debit': debit
            })

        if credit < 0:
            anomalie_riga.append({
                'tipo': 'CREDIT_NEGATIVO',
                'riga_id': riga_id,
                'severita': 'CRITICA',
                'messaggio': f'Credit negativo: {credit}',
                'credit': credit
            })

        if debit > 0 and credit > 0:
            anomalie_riga.append({
                'tipo': 'DEBIT_E_CREDIT',
                'riga_id': riga_id,
                'severita': 'ALTA',
                'messaggio': f'Sia debit ({debit}) che credit ({credit}) > 0',
                'debit': debit,
                'credit': credit
            })

        if debit == 0 and credit == 0:
            anomalie_riga.append({
                'tipo': 'IMPORTO_ZERO',
                'riga_id': riga_id,
                'severita': 'MEDIA',
                'messaggio': 'Riga con importo zero',
                'debit': debit,
                'credit': credit
            })

        # Balance check
        expected_balance = debit - credit
        if abs(balance - expected_balance) > 0.01:
            anomalie_riga.append({
                'tipo': 'BALANCE_ERRATO',
                'riga_id': riga_id,
                'severita': 'ALTA',
                'messaggio': f'Balance errato: {balance} vs atteso {expected_balance}',
                'balance': balance,
                'expected_balance': expected_balance
            })

        # 3. Descrizione sensata
        if not name or name.strip() == '':
            anomalie_riga.append({
                'tipo': 'DESCRIZIONE_VUOTA',
                'riga_id': riga_id,
                'severita': 'BASSA',
                'messaggio': 'Descrizione vuota'
            })
        elif name == '/':
            anomalie_riga.append({
                'tipo': 'DESCRIZIONE_SLASH',
                'riga_id': riga_id,
                'severita': 'BASSA',
                'messaggio': 'Descrizione = /'
            })

        # 4. Move esiste e non è draft
        if not move_id:
            anomalie_riga.append({
                'tipo': 'MOVE_MANCANTE',
                'riga_id': riga_id,
                'severita': 'CRITICA',
                'messaggio': 'Move_id mancante'
            })

        if state == 'draft':
            anomalie_riga.append({
                'tipo': 'MOVE_DRAFT',
                'riga_id': riga_id,
                'severita': 'ALTA',
                'messaggio': 'Move in stato draft',
                'move_id': move_id[0] if move_id else None
            })

        # 5. Partner check (warning se mancante su transazioni > 1000)
        if not partner and (debit > 1000 or credit > 1000):
            anomalie_riga.append({
                'tipo': 'PARTNER_MANCANTE_IMPORTO_ALTO',
                'riga_id': riga_id,
                'severita': 'MEDIA',
                'messaggio': f'Partner mancante su importo alto (debit: {debit}, credit: {credit})'
            })

        return anomalie_riga

    def trova_duplicati(self):
        """Trova righe duplicate (stessa data, importo, descrizione)"""
        print("\n" + "="*80)
        print("STEP 3: RICERCA DUPLICATI")
        print("="*80)

        seen = defaultdict(list)

        for riga in self.righe:
            key = (
                riga.get('date'),
                riga.get('debit'),
                riga.get('credit'),
                riga.get('name')
            )
            seen[key].append(riga['id'])

        duplicati = []
        for key, ids in seen.items():
            if len(ids) > 1:
                date, debit, credit, name = key
                duplicati.append({
                    'tipo': 'DUPLICATO',
                    'severita': 'ALTA',
                    'messaggio': f'Righe duplicate: {len(ids)} righe con stessi valori',
                    'riga_ids': ids,
                    'date': date,
                    'debit': debit,
                    'credit': credit,
                    'name': name
                })
                print(f"[WARNING] Duplicati trovati: {len(ids)} righe - Date: {date}, Debit: {debit}, Credit: {credit}")

        print(f"[OK] Trovati {len(duplicati)} gruppi di duplicati")
        return duplicati

    def calcola_saldo(self):
        """Calcola saldo RIGA PER RIGA"""
        print("\n" + "="*80)
        print("STEP 4: CALCOLO SALDO RIGA PER RIGA")
        print("="*80)

        saldo = 0.0
        saldo_per_data = []

        for i, riga in enumerate(self.righe, 1):
            debit = riga.get('debit', 0.0)
            credit = riga.get('credit', 0.0)
            movimento = debit - credit
            saldo += movimento

            saldo_per_data.append({
                'progressivo': i,
                'riga_id': riga['id'],
                'date': riga.get('date'),
                'name': riga.get('name', ''),
                'debit': debit,
                'credit': credit,
                'movimento': movimento,
                'saldo': saldo
            })

            if i <= 10 or i > len(self.righe) - 5:
                print(f"  [{i:4d}] {riga.get('date')} | D: {debit:12.2f} | C: {credit:12.2f} | Saldo: {saldo:15.2f}")

        self.saldo_calcolato = saldo
        print(f"\n{'='*80}")
        print(f"SALDO FINALE CALCOLATO: CHF {saldo:,.2f}")
        print(f"SALDO ATTESO:           CHF {SALDO_ATTESO:,.2f}")
        print(f"GAP:                    CHF {saldo - SALDO_ATTESO:,.2f}")
        print(f"{'='*80}")

        return saldo_per_data

    def analizza(self):
        """Analisi completa del konto 1024"""
        print("\n" + "="*80)
        print("ANALISI KONTO 1024 UBS CHF - COMMERCIALISTA SVIZZERO")
        print("="*80)
        print(f"Account ID: {ACCOUNT_ID}")
        print(f"Saldo Atteso: CHF {SALDO_ATTESO:,.2f}")
        print(f"Data Analisi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)

        # Step 1: Fetch righe
        self.fetch_righe()

        # Step 2: Verifica ogni riga
        print("\n" + "="*80)
        print("STEP 2: VERIFICA RIGA PER RIGA")
        print("="*80)

        for i, riga in enumerate(self.righe, 1):
            anomalie_riga = self.verifica_riga(riga, i)
            self.anomalie.extend(anomalie_riga)

            if anomalie_riga:
                print(f"  [Riga {i}/{len(self.righe)}] ID {riga['id']}: {len(anomalie_riga)} anomalie")

            # Update stats
            self.stats['righe_analizzate'] += 1
            if anomalie_riga:
                self.stats['righe_con_anomalie'] += 1

            state = riga.get('parent_state')
            if state == 'draft':
                self.stats['righe_draft'] += 1
            elif state == 'posted':
                self.stats['righe_posted'] += 1

        print(f"\n[OK] Analizzate {self.stats['righe_analizzate']} righe")
        print(f"  - Righe con anomalie: {self.stats['righe_con_anomalie']}")
        print(f"  - Righe posted: {self.stats['righe_posted']}")
        print(f"  - Righe draft: {self.stats['righe_draft']}")

        # Step 3: Trova duplicati
        duplicati = self.trova_duplicati()
        self.anomalie.extend(duplicati)

        # Step 4: Calcola saldo
        saldo_per_data = self.calcola_saldo()

        # Step 5: Genera report
        self.genera_report(saldo_per_data)

    def genera_report(self, saldo_per_data):
        """Genera report finale"""
        print("\n" + "="*80)
        print("REPORT FINALE ANALISI KONTO 1024 UBS CHF")
        print("="*80)

        gap = self.saldo_calcolato - SALDO_ATTESO

        report = {
            'metadata': {
                'account_id': ACCOUNT_ID,
                'account_name': '1024 UBS CHF',
                'data_analisi': datetime.now().isoformat(),
                'saldo_atteso': SALDO_ATTESO,
                'saldo_calcolato': self.saldo_calcolato,
                'gap': gap,
                'gap_percentuale': (gap / SALDO_ATTESO * 100) if SALDO_ATTESO else 0
            },
            'statistiche': {
                'totale_righe': len(self.righe),
                'righe_con_anomalie': self.stats['righe_con_anomalie'],
                'righe_posted': self.stats['righe_posted'],
                'righe_draft': self.stats['righe_draft'],
                'totale_anomalie': len(self.anomalie),
                'anomalie_critiche': len([a for a in self.anomalie if a.get('severita') == 'CRITICA']),
                'anomalie_alte': len([a for a in self.anomalie if a.get('severita') == 'ALTA']),
                'anomalie_medie': len([a for a in self.anomalie if a.get('severita') == 'MEDIA']),
                'anomalie_basse': len([a for a in self.anomalie if a.get('severita') == 'BASSA'])
            },
            'anomalie': self.anomalie[:50],  # Prime 50 anomalie
            'saldo_progressivo_sample': saldo_per_data[:10] + saldo_per_data[-10:],  # Prime 10 e ultime 10
            'raccomandazioni': self.genera_raccomandazioni(gap)
        }

        # Print summary
        print(f"\n{'='*80}")
        print(f"NUMERO TOTALE RIGHE ANALIZZATE: {report['statistiche']['totale_righe']}")
        print(f"{'='*80}")
        print(f"SALDO CALCOLATO RIGA PER RIGA:  CHF {self.saldo_calcolato:15,.2f}")
        print(f"SALDO ATTESO:                   CHF {SALDO_ATTESO:15,.2f}")
        print(f"GAP:                            CHF {gap:15,.2f} ({report['metadata']['gap_percentuale']:.2f}%)")
        print(f"{'='*80}")

        print(f"\nANOMALIE TROVATE:")
        print(f"  - CRITICHE: {report['statistiche']['anomalie_critiche']}")
        print(f"  - ALTE:     {report['statistiche']['anomalie_alte']}")
        print(f"  - MEDIE:    {report['statistiche']['anomalie_medie']}")
        print(f"  - BASSE:    {report['statistiche']['anomalie_basse']}")
        print(f"  - TOTALE:   {report['statistiche']['totale_anomalie']}")

        # Print top anomalie
        print(f"\n{'='*80}")
        print(f"TOP 50 ANOMALIE (ordinate per severità):")
        print(f"{'='*80}")

        anomalie_sorted = sorted(
            self.anomalie[:50],
            key=lambda x: {'CRITICA': 0, 'ALTA': 1, 'MEDIA': 2, 'BASSA': 3}.get(x.get('severita', 'BASSA'), 4)
        )

        for i, anomalia in enumerate(anomalie_sorted, 1):
            print(f"\n[{i}] {anomalia.get('severita', 'N/A')} - {anomalia.get('tipo', 'N/A')}")
            print(f"    {anomalia.get('messaggio', 'N/A')}")
            if 'riga_id' in anomalia:
                print(f"    Riga ID: {anomalia['riga_id']}")
            if 'riga_ids' in anomalia:
                print(f"    Righe IDs: {anomalia['riga_ids']}")

        # Print raccomandazioni
        print(f"\n{'='*80}")
        print(f"RACCOMANDAZIONI:")
        print(f"{'='*80}")
        for i, racc in enumerate(report['raccomandazioni'], 1):
            print(f"{i}. {racc}")

        # Save to JSON
        filename = f"report-konto-1024-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        filepath = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\{filename}"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)

        print(f"\n[OK] Report salvato: {filename}")

        return report

    def genera_raccomandazioni(self, gap):
        """Genera raccomandazioni specifiche basate su anomalie trovate"""
        raccomandazioni = []

        # Analizza gap
        if abs(gap) > 0.01:
            raccomandazioni.append(
                f"PRIORITÀ ALTA: Gap di CHF {gap:,.2f} tra saldo calcolato e atteso. "
                "Verificare tutte le righe con anomalie critiche e alte."
            )

        # Anomalie critiche
        critiche = [a for a in self.anomalie if a.get('severita') == 'CRITICA']
        if critiche:
            raccomandazioni.append(
                f"Correggere {len(critiche)} anomalie CRITICHE: "
                f"date mancanti/invalide, importi negativi, balance errati, move mancanti."
            )

        # Righe draft
        if self.stats['righe_draft'] > 0:
            raccomandazioni.append(
                f"Postare o eliminare {self.stats['righe_draft']} righe in stato DRAFT. "
                "Le righe draft non dovrebbero esistere in contabilità chiusa."
            )

        # Duplicati
        duplicati = [a for a in self.anomalie if a.get('tipo') == 'DUPLICATO']
        if duplicati:
            raccomandazioni.append(
                f"Verificare {len(duplicati)} gruppi di righe DUPLICATE. "
                "Potrebbero essere doppi inserimenti da eliminare."
            )

        # Importi zero
        zero_lines = [a for a in self.anomalie if a.get('tipo') == 'IMPORTO_ZERO']
        if zero_lines:
            raccomandazioni.append(
                f"Eliminare {len(zero_lines)} righe con importo ZERO. "
                "Non hanno impatto contabile ma sporcano i report."
            )

        # Debit e credit insieme
        debit_credit = [a for a in self.anomalie if a.get('tipo') == 'DEBIT_E_CREDIT']
        if debit_credit:
            raccomandazioni.append(
                f"Correggere {len(debit_credit)} righe con sia DEBIT che CREDIT > 0. "
                "Errore di inserimento: ogni riga deve avere solo debit O credit."
            )

        # Date future
        future_dates = [a for a in self.anomalie if a.get('tipo') == 'DATA_FUTURA']
        if future_dates:
            raccomandazioni.append(
                f"Correggere {len(future_dates)} righe con data FUTURA. "
                "Verificare se sono previsioni da spostare o errori di data entry."
            )

        # Riepilogo finale
        raccomandazioni.append(
            "Dopo le correzioni, ri-eseguire questa analisi per verificare "
            "che gap e anomalie siano risolte."
        )

        return raccomandazioni


def main():
    """Main execution"""
    try:
        # Initialize Odoo client
        odoo = OdooClient()
        odoo.authenticate()

        # Run analysis
        analyzer = Konto1024Analyzer(odoo)
        analyzer.analizza()

        print("\n" + "="*80)
        print("ANALISI COMPLETATA CON SUCCESSO")
        print("="*80)

    except Exception as e:
        print(f"\n[ERROR] ERRORE FATALE: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
