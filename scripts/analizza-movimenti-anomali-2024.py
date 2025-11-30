#!/usr/bin/env python3
"""
ANALISI MOVIMENTI ANOMALI 2024

Identifica pattern sospetti nei movimenti contabili per i conti:
- 1001, 1022, 1023, 10901, 1099

Pattern analizzati:
1. Duplicati (stesso importo, data, partner, description)
2. Importi anomali (> 50K, arrotondati, negativi)
3. Pattern sospetti (rettifiche manuali, movimenti senza partner)
4. Timing anomalo (retroattivi, batch identici)
"""

import xmlrpc.client
from datetime import datetime, timedelta
from collections import defaultdict
import json
from decimal import Decimal

# Configurazione Odoo
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Conti da analizzare
CONTI_TARGET = ['1001', '1022', '1023', '10901', '1099']

# Soglie anomalie
SOGLIA_IMPORTO_ALTO = 50000.0
SOGLIA_ARROTONDATO = 0.01  # Per identificare importi esattamente arrotondati


class OdooAnalyzer:
    def __init__(self):
        self.common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        self.uid = None
        self.anomalie = {
            'duplicati': [],
            'importi_anomali': [],
            'rettifiche_manuali': [],
            'movimenti_senza_partner': [],
            'timing_anomalo': [],
            'pattern_sospetti': []
        }

    def authenticate(self):
        """Autentica con Odoo"""
        print("[*] Autenticazione con Odoo...")
        self.uid = self.common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
        if self.uid:
            print(f"[OK] Autenticato con successo (UID: {self.uid})")
            return True
        else:
            print("[ERROR] Autenticazione fallita")
            return False

    def execute_odoo(self, model, method, domain, fields=None, limit=None, order=None):
        """Esegue chiamata Odoo con error handling"""
        try:
            kwargs = {}
            if fields:
                kwargs['fields'] = fields
            if limit:
                kwargs['limit'] = limit
            if order:
                kwargs['order'] = order

            return self.models.execute_kw(
                ODOO_DB, self.uid, ODOO_PASSWORD,
                model, method, [domain], kwargs
            )
        except Exception as e:
            print(f"❌ Errore chiamata Odoo: {e}")
            return []

    def get_account_ids(self):
        """Ottiene gli ID dei conti target"""
        print(f"\n📊 Cerco conti: {', '.join(CONTI_TARGET)}")

        accounts = self.execute_odoo(
            'account.account',
            'search_read',
            [['code', 'in', CONTI_TARGET]],
            fields=['id', 'code', 'name']
        )

        print(f"✅ Trovati {len(accounts)} conti:")
        for acc in accounts:
            print(f"   - {acc['code']} - {acc['name']}")

        return {acc['code']: acc['id'] for acc in accounts}

    def get_move_lines_by_month(self, account_ids, year=2024):
        """Ottiene tutti i movimenti per mese"""
        print(f"\n📅 Recupero movimenti per {year}...")

        all_moves = []

        for month in range(1, 13):
            # Calcola date range per il mese
            date_start = f"{year}-{month:02d}-01"
            if month == 12:
                date_end = f"{year}-12-31"
            else:
                next_month = datetime(year, month, 1) + timedelta(days=32)
                date_end = datetime(year, month + 1, 1) - timedelta(days=1)
                date_end = date_end.strftime("%Y-%m-%d")

            print(f"\n  📆 Mese {month:02d}/{year} ({date_start} - {date_end})")

            # Query movimenti del mese
            domain = [
                ['account_id', 'in', account_ids],
                ['date', '>=', date_start],
                ['date', '<=', date_end],
                ['parent_state', '=', 'posted']  # Solo movimenti validati
            ]

            moves = self.execute_odoo(
                'account.move.line',
                'search_read',
                domain,
                fields=[
                    'id', 'date', 'name', 'ref', 'debit', 'credit', 'balance',
                    'account_id', 'partner_id', 'move_id', 'journal_id',
                    'create_date', 'write_date'
                ]
            )

            print(f"     Trovati {len(moves)} movimenti")

            # Aggiungi mese ai movimenti
            for move in moves:
                move['month'] = month
                all_moves.append(move)

        print(f"\n✅ Totale movimenti 2024: {len(all_moves)}")
        return all_moves

    def find_duplicates(self, moves):
        """Identifica duplicati esatti"""
        print("\n🔍 Analisi DUPLICATI...")

        # Raggruppa per (date, debit, credit, partner_id, name)
        groups = defaultdict(list)

        for move in moves:
            key = (
                move['date'],
                round(move['debit'], 2),
                round(move['credit'], 2),
                move['partner_id'][0] if move['partner_id'] else None,
                move['name'] or ''
            )
            groups[key].append(move)

        # Trova gruppi con più di un elemento
        duplicates = []
        for key, group in groups.items():
            if len(group) > 1:
                duplicates.append({
                    'count': len(group),
                    'date': key[0],
                    'debit': key[1],
                    'credit': key[2],
                    'partner_id': key[3],
                    'description': key[4],
                    'move_ids': [m['id'] for m in group],
                    'moves': group
                })

        # Ordina per data e count
        duplicates.sort(key=lambda x: (x['date'], -x['count']))

        print(f"   ⚠️  Trovati {len(duplicates)} gruppi di duplicati")
        print(f"   📊 Totale movimenti duplicati: {sum(d['count'] for d in duplicates)}")

        self.anomalie['duplicati'] = duplicates
        return duplicates

    def find_anomalous_amounts(self, moves):
        """Identifica importi anomali"""
        print("\n🔍 Analisi IMPORTI ANOMALI...")

        anomalies = {
            'importi_alti': [],
            'arrotondati': [],
            'negativi_sospetti': []
        }

        for move in moves:
            amount = move['debit'] if move['debit'] > 0 else move['credit']

            # Importi > 50K
            if amount > SOGLIA_IMPORTO_ALTO:
                anomalies['importi_alti'].append({
                    'move_id': move['id'],
                    'date': move['date'],
                    'month': move['month'],
                    'amount': amount,
                    'type': 'debit' if move['debit'] > 0 else 'credit',
                    'description': move['name'],
                    'partner': move['partner_id'][1] if move['partner_id'] else 'N/A'
                })

            # Importi esattamente arrotondati (es. 10000.00)
            if amount > 1000 and amount % 1000 == 0:
                anomalies['arrotondati'].append({
                    'move_id': move['id'],
                    'date': move['date'],
                    'month': move['month'],
                    'amount': amount,
                    'description': move['name'],
                    'partner': move['partner_id'][1] if move['partner_id'] else 'N/A'
                })

            # Balance negativi sospetti (per conti che dovrebbero essere sempre positivi)
            if move['balance'] < -1000:  # Soglia -1000
                anomalies['negativi_sospetti'].append({
                    'move_id': move['id'],
                    'date': move['date'],
                    'month': move['month'],
                    'balance': move['balance'],
                    'description': move['name'],
                    'account': move['account_id'][1] if move['account_id'] else 'N/A'
                })

        print(f"   💰 Importi > {SOGLIA_IMPORTO_ALTO}: {len(anomalies['importi_alti'])}")
        print(f"   🎯 Importi arrotondati: {len(anomalies['arrotondati'])}")
        print(f"   ⚠️  Balance negativi: {len(anomalies['negativi_sospetti'])}")

        self.anomalie['importi_anomali'] = anomalies
        return anomalies

    def find_manual_adjustments(self, moves):
        """Identifica rettifiche manuali"""
        print("\n🔍 Analisi RETTIFICHE MANUALI...")

        adjustments = []

        # Pattern per identificare rettifiche manuali
        manual_patterns = [
            'rettifica', 'correzione', 'aggiustamento', 'adjustment',
            'manual', 'manuale', 'fix', 'errore'
        ]

        for move in moves:
            name_lower = (move['name'] or '').lower()
            ref_lower = (move['ref'] or '').lower()

            # Check se contiene pattern di rettifica
            is_manual = any(
                pattern in name_lower or pattern in ref_lower
                for pattern in manual_patterns
            )

            if is_manual:
                adjustments.append({
                    'move_id': move['id'],
                    'date': move['date'],
                    'month': move['month'],
                    'debit': move['debit'],
                    'credit': move['credit'],
                    'description': move['name'],
                    'ref': move['ref'],
                    'journal': move['journal_id'][1] if move['journal_id'] else 'N/A'
                })

        print(f"   🔧 Trovate {len(adjustments)} rettifiche manuali")

        self.anomalie['rettifiche_manuali'] = adjustments
        return adjustments

    def find_moves_without_partner(self, moves):
        """Identifica movimenti senza partner"""
        print("\n🔍 Analisi MOVIMENTI SENZA PARTNER...")

        no_partner = []

        for move in moves:
            if not move['partner_id']:
                no_partner.append({
                    'move_id': move['id'],
                    'date': move['date'],
                    'month': move['month'],
                    'debit': move['debit'],
                    'credit': move['credit'],
                    'description': move['name'],
                    'ref': move['ref'],
                    'journal': move['journal_id'][1] if move['journal_id'] else 'N/A'
                })

        print(f"   👤 Trovati {len(no_partner)} movimenti senza partner")

        # Raggruppa per description
        by_description = defaultdict(list)
        for move in no_partner:
            by_description[move['description']].append(move)

        print(f"\n   📊 Top descrizioni senza partner:")
        for desc, items in sorted(by_description.items(), key=lambda x: -len(x[1]))[:10]:
            print(f"      - '{desc}': {len(items)} occorrenze")

        self.anomalie['movimenti_senza_partner'] = no_partner
        return no_partner

    def find_timing_anomalies(self, moves):
        """Identifica anomalie di timing"""
        print("\n🔍 Analisi TIMING ANOMALO...")

        timing_issues = {
            'retroattivi': [],
            'batch_identici': [],
            'fine_anno': []
        }

        for move in moves:
            # Parse date
            move_date = datetime.strptime(move['date'], '%Y-%m-%d')
            create_date = datetime.strptime(move['create_date'], '%Y-%m-%d %H:%M:%S')

            # Movimenti retroattivi (creati > 30 giorni dopo la data del movimento)
            days_diff = (create_date - move_date).days
            if days_diff > 30:
                timing_issues['retroattivi'].append({
                    'move_id': move['id'],
                    'date': move['date'],
                    'create_date': move['create_date'],
                    'days_diff': days_diff,
                    'description': move['name'],
                    'amount': move['debit'] if move['debit'] > 0 else move['credit']
                })

            # Movimenti di fine anno (ultimi 3 giorni)
            if move_date.month == 12 and move_date.day >= 29:
                timing_issues['fine_anno'].append({
                    'move_id': move['id'],
                    'date': move['date'],
                    'debit': move['debit'],
                    'credit': move['credit'],
                    'description': move['name']
                })

        # Batch identici (stesso create_date, stesso importo)
        create_groups = defaultdict(list)
        for move in moves:
            create_date = move['create_date'][:19]  # Senza secondi
            amount = move['debit'] if move['debit'] > 0 else move['credit']
            key = (create_date, round(amount, 2))
            create_groups[key].append(move)

        for key, group in create_groups.items():
            if len(group) >= 3:  # Almeno 3 movimenti identici
                timing_issues['batch_identici'].append({
                    'create_date': key[0],
                    'amount': key[1],
                    'count': len(group),
                    'move_ids': [m['id'] for m in group]
                })

        print(f"   ⏰ Movimenti retroattivi (>30 giorni): {len(timing_issues['retroattivi'])}")
        print(f"   📦 Batch identici: {len(timing_issues['batch_identici'])}")
        print(f"   🎄 Movimenti fine anno: {len(timing_issues['fine_anno'])}")

        self.anomalie['timing_anomalo'] = timing_issues
        return timing_issues

    def generate_report(self):
        """Genera report markdown delle anomalie"""
        print("\n📝 Generazione report...")

        report = f"""# MOVIMENTI ANOMALI 2024 - ANALISI PATTERN

**Data analisi**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Conti analizzati**: {', '.join(CONTI_TARGET)}
**Periodo**: 01.01.2024 - 31.12.2024

---

## 📊 EXECUTIVE SUMMARY

| Categoria | Count | Gravità |
|-----------|-------|---------|
| Duplicati | {len(self.anomalie['duplicati'])} gruppi | 🔴 ALTA |
| Importi > CHF 50K | {len(self.anomalie['importi_anomali']['importi_alti'])} | 🟡 MEDIA |
| Importi arrotondati | {len(self.anomalie['importi_anomali']['arrotondati'])} | 🟡 MEDIA |
| Balance negativi | {len(self.anomalie['importi_anomali']['negativi_sospetti'])} | 🔴 ALTA |
| Rettifiche manuali | {len(self.anomalie['rettifiche_manuali'])} | 🟡 MEDIA |
| Senza partner | {len(self.anomalie['movimenti_senza_partner'])} | 🟢 BASSA |
| Retroattivi | {len(self.anomalie['timing_anomalo']['retroattivi'])} | 🔴 ALTA |
| Batch identici | {len(self.anomalie['timing_anomalo']['batch_identici'])} | 🟡 MEDIA |

---

## 🔴 DUPLICATI TROVATI

"""

        if self.anomalie['duplicati']:
            report += "| Mese | Data | Debit | Credit | Partner | Description | Count | Move IDs |\n"
            report += "|------|------|-------|--------|---------|-------------|-------|----------|\n"

            for dup in self.anomalie['duplicati'][:50]:  # Top 50
                date_obj = datetime.strptime(dup['date'], '%Y-%m-%d')
                month = date_obj.strftime('%Y-%m')
                partner = f"ID: {dup['partner_id']}" if dup['partner_id'] else "N/A"

                report += f"| {month} | {dup['date']} | {dup['debit']:.2f} | {dup['credit']:.2f} | "
                report += f"{partner} | {dup['description'][:40]} | {dup['count']} | "
                report += f"{', '.join(map(str, dup['move_ids'][:3]))}... |\n"
        else:
            report += "✅ Nessun duplicato trovato.\n"

        report += "\n---\n\n## 💰 IMPORTI ANOMALI\n\n"

        # Importi alti
        report += "### Importi > CHF 50,000\n\n"
        if self.anomalie['importi_anomali']['importi_alti']:
            report += "| Mese | Data | Importo | Tipo | Description | Partner |\n"
            report += "|------|------|---------|------|-------------|----------|\n"

            for item in sorted(self.anomalie['importi_anomali']['importi_alti'],
                             key=lambda x: -x['amount'])[:30]:
                report += f"| {item['month']:02d} | {item['date']} | "
                report += f"CHF {item['amount']:,.2f} | {item['type']} | "
                report += f"{item['description'][:40]} | {item['partner'][:30]} |\n"
        else:
            report += "✅ Nessun importo anomalo.\n"

        # Arrotondati
        report += "\n### Importi Arrotondati (multipli di 1000)\n\n"
        if self.anomalie['importi_anomali']['arrotondati']:
            report += f"**Totale**: {len(self.anomalie['importi_anomali']['arrotondati'])} movimenti\n\n"

            # Raggruppa per importo
            by_amount = defaultdict(list)
            for item in self.anomalie['importi_anomali']['arrotondati']:
                by_amount[item['amount']].append(item)

            report += "| Importo | Occorrenze | Date esempio |\n"
            report += "|---------|------------|---------------|\n"

            for amount, items in sorted(by_amount.items(), key=lambda x: -x[0])[:20]:
                dates = ', '.join([i['date'] for i in items[:3]])
                report += f"| CHF {amount:,.2f} | {len(items)} | {dates} |\n"

        # Balance negativi
        report += "\n### Balance Negativi Sospetti\n\n"
        if self.anomalie['importi_anomali']['negativi_sospetti']:
            report += "| Mese | Data | Balance | Account | Description |\n"
            report += "|------|------|---------|---------|-------------|\n"

            for item in sorted(self.anomalie['importi_anomali']['negativi_sospetti'],
                             key=lambda x: x['balance'])[:30]:
                report += f"| {item['month']:02d} | {item['date']} | "
                report += f"CHF {item['balance']:,.2f} | {item['account'][:20]} | "
                report += f"{item['description'][:40]} |\n"

        report += "\n---\n\n## 🔧 RETTIFICHE MANUALI\n\n"

        if self.anomalie['rettifiche_manuali']:
            # Raggruppa per mese
            by_month = defaultdict(list)
            for item in self.anomalie['rettifiche_manuali']:
                by_month[item['month']].append(item)

            report += "### Per Mese\n\n"
            for month in sorted(by_month.keys()):
                items = by_month[month]
                total_debit = sum(i['debit'] for i in items)
                total_credit = sum(i['credit'] for i in items)

                report += f"\n#### Mese {month:02d}/2024 - {len(items)} rettifiche\n\n"
                report += f"- **Totale Debit**: CHF {total_debit:,.2f}\n"
                report += f"- **Totale Credit**: CHF {total_credit:,.2f}\n\n"

                report += "| Data | Debit | Credit | Description | Journal |\n"
                report += "|------|-------|--------|-------------|----------|\n"

                for item in items[:10]:  # Top 10 per mese
                    report += f"| {item['date']} | {item['debit']:.2f} | {item['credit']:.2f} | "
                    report += f"{item['description'][:40]} | {item['journal'][:20]} |\n"
        else:
            report += "✅ Nessuna rettifica manuale trovata.\n"

        report += "\n---\n\n## 👤 MOVIMENTI SENZA PARTNER\n\n"

        if self.anomalie['movimenti_senza_partner']:
            # Raggruppa per description
            by_desc = defaultdict(list)
            for item in self.anomalie['movimenti_senza_partner']:
                by_desc[item['description']].append(item)

            report += f"**Totale**: {len(self.anomalie['movimenti_senza_partner'])} movimenti\n\n"
            report += "### Top Descrizioni\n\n"
            report += "| Description | Count | Totale Debit | Totale Credit |\n"
            report += "|-------------|-------|--------------|---------------|\n"

            for desc, items in sorted(by_desc.items(), key=lambda x: -len(x[1]))[:20]:
                total_debit = sum(i['debit'] for i in items)
                total_credit = sum(i['credit'] for i in items)

                report += f"| {desc[:50]} | {len(items)} | "
                report += f"CHF {total_debit:,.2f} | CHF {total_credit:,.2f} |\n"
        else:
            report += "✅ Tutti i movimenti hanno un partner.\n"

        report += "\n---\n\n## ⏰ TIMING ANOMALO\n\n"

        # Retroattivi
        report += "### Movimenti Retroattivi (>30 giorni)\n\n"
        if self.anomalie['timing_anomalo']['retroattivi']:
            report += "| Data Movimento | Data Creazione | Giorni Diff | Importo | Description |\n"
            report += "|----------------|----------------|-------------|---------|-------------|\n"

            for item in sorted(self.anomalie['timing_anomalo']['retroattivi'],
                             key=lambda x: -x['days_diff'])[:30]:
                report += f"| {item['date']} | {item['create_date'][:10]} | "
                report += f"{item['days_diff']} | CHF {item['amount']:,.2f} | "
                report += f"{item['description'][:40]} |\n"
        else:
            report += "✅ Nessun movimento retroattivo.\n"

        # Batch identici
        report += "\n### Batch Identici\n\n"
        if self.anomalie['timing_anomalo']['batch_identici']:
            report += "| Data Creazione | Importo | Count | Move IDs |\n"
            report += "|----------------|---------|-------|----------|\n"

            for item in sorted(self.anomalie['timing_anomalo']['batch_identici'],
                             key=lambda x: -x['count'])[:20]:
                report += f"| {item['create_date']} | CHF {item['amount']:,.2f} | "
                report += f"{item['count']} | {', '.join(map(str, item['move_ids'][:3]))}... |\n"

        # Fine anno
        report += "\n### Movimenti Fine Anno (29-31 Dicembre)\n\n"
        if self.anomalie['timing_anomalo']['fine_anno']:
            report += f"**Totale**: {len(self.anomalie['timing_anomalo']['fine_anno'])} movimenti\n\n"

            total_debit = sum(i['debit'] for i in self.anomalie['timing_anomalo']['fine_anno'])
            total_credit = sum(i['credit'] for i in self.anomalie['timing_anomalo']['fine_anno'])

            report += f"- **Totale Debit**: CHF {total_debit:,.2f}\n"
            report += f"- **Totale Credit**: CHF {total_credit:,.2f}\n"

        report += "\n---\n\n## 🎯 RACCOMANDAZIONI CORREZIONE\n\n"

        recommendations = []

        if self.anomalie['duplicati']:
            recommendations.append({
                'priority': '🔴 ALTA',
                'issue': 'Duplicati',
                'action': 'Verificare manualmente ogni gruppo di duplicati e eliminare le registrazioni duplicate',
                'impact': f"~{sum(d['count'] - 1 for d in self.anomalie['duplicati'])} movimenti da rimuovere"
            })

        if self.anomalie['importi_anomali']['negativi_sospetti']:
            recommendations.append({
                'priority': '🔴 ALTA',
                'issue': 'Balance negativi',
                'action': 'Investigare i balance negativi e creare rettifiche per portarli a zero',
                'impact': f"{len(self.anomalie['importi_anomali']['negativi_sospetti'])} conti da correggere"
            })

        if self.anomalie['timing_anomalo']['retroattivi']:
            recommendations.append({
                'priority': '🔴 ALTA',
                'issue': 'Movimenti retroattivi',
                'action': 'Verificare la correttezza delle date e documentare le ragioni delle registrazioni tardive',
                'impact': f"{len(self.anomalie['timing_anomalo']['retroattivi'])} movimenti da verificare"
            })

        if self.anomalie['importi_anomali']['importi_alti']:
            recommendations.append({
                'priority': '🟡 MEDIA',
                'issue': 'Importi elevati',
                'action': 'Verificare documentazione e giustificazione per importi > CHF 50K',
                'impact': f"{len(self.anomalie['importi_anomali']['importi_alti'])} movimenti da documentare"
            })

        if self.anomalie['movimenti_senza_partner']:
            recommendations.append({
                'priority': '🟢 BASSA',
                'issue': 'Movimenti senza partner',
                'action': 'Assegnare partner ai movimenti dove applicabile',
                'impact': f"{len(self.anomalie['movimenti_senza_partner'])} movimenti da completare"
            })

        if recommendations:
            report += "| Priorità | Issue | Azione Raccomandata | Impatto |\n"
            report += "|----------|-------|---------------------|----------|\n"

            for rec in sorted(recommendations, key=lambda x: x['priority']):
                report += f"| {rec['priority']} | {rec['issue']} | {rec['action']} | {rec['impact']} |\n"
        else:
            report += "✅ Nessuna anomalia critica trovata!\n"

        report += "\n---\n\n## 📌 NOTE TECNICHE\n\n"
        report += f"- **Tool**: Odoo XML-RPC API\n"
        report += f"- **Database**: {ODOO_DB}\n"
        report += f"- **Conti analizzati**: {', '.join(CONTI_TARGET)}\n"
        report += f"- **Query eseguite**: account.move.line con filtri per mese\n"
        report += f"- **Stato movimenti**: Solo 'posted' (validati)\n"

        return report

    def run_analysis(self):
        """Esegue l'analisi completa"""
        print("\n" + "="*80)
        print("[*] ANALISI MOVIMENTI ANOMALI 2024")
        print("="*80)

        if not self.authenticate():
            return

        # 1. Get account IDs
        account_map = self.get_account_ids()
        if not account_map:
            print("[X] Nessun conto trovato")
            return

        account_ids = list(account_map.values())

        # 2. Get all moves by month
        moves = self.get_move_lines_by_month(account_ids, 2024)
        if not moves:
            print("[X] Nessun movimento trovato")
            return

        # 3. Analizza anomalie
        print("\n" + "="*80)
        print("[*] ANALISI PATTERN ANOMALI")
        print("="*80)

        self.find_duplicates(moves)
        self.find_anomalous_amounts(moves)
        self.find_manual_adjustments(moves)
        self.find_moves_without_partner(moves)
        self.find_timing_anomalies(moves)

        # 4. Genera report
        report = self.generate_report()

        # 5. Salva report
        report_file = f"c:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\MOVIMENTI_ANOMALI_2024_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)

        print(f"\n✅ Report salvato: {report_file}")

        # 6. Salva anche JSON raw
        json_file = report_file.replace('.md', '.json')
        with open(json_file, 'w', encoding='utf-8') as f:
            # Convert datetime objects to strings for JSON
            json_data = {
                'anomalie': self.anomalie,
                'summary': {
                    'duplicati_count': len(self.anomalie['duplicati']),
                    'importi_alti_count': len(self.anomalie['importi_anomali']['importi_alti']),
                    'rettifiche_count': len(self.anomalie['rettifiche_manuali']),
                    'senza_partner_count': len(self.anomalie['movimenti_senza_partner']),
                    'retroattivi_count': len(self.anomalie['timing_anomalo']['retroattivi'])
                }
            }
            json.dump(json_data, f, indent=2, ensure_ascii=False, default=str)

        print(f"✅ Dati raw salvati: {json_file}")

        print("\n" + "="*80)
        print("✅ ANALISI COMPLETATA")
        print("="*80)


if __name__ == '__main__':
    analyzer = OdooAnalyzer()
    analyzer.run_analysis()
