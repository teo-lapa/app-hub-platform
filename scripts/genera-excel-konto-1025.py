#!/usr/bin/env python3
"""
Genera Excel Report per Konto 1025 UBS EUR
"""

import json
from datetime import datetime

# Load report data
with open('report-verifica-1025-ubs-eur-20251116-174603.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Generate CSV for Excel import
output = []

# Header
output.append("REPORT KONTO 1025 UBS EUR - VERIFICA COMMERCIALISTA")
output.append(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
output.append("")

# Summary
output.append("RIEPILOGO")
output.append("Metrica,Valore,Note")
output.append(f"Totale righe,{data['summary']['total_lines']},")
output.append(f"Saldo CHF,{data['summary']['balance_chf']:.2f},NEGATIVO!")
output.append(f"Saldo EUR,{data['summary']['balance_eur']:.2f},NEGATIVO!")
output.append(f"Saldo atteso EUR,{data['summary']['expected_eur']:.2f},")
output.append(f"GAP EUR,{data['summary']['gap_eur']:.2f},CRITICO!")
output.append("")

# Anomalie
output.append("ANOMALIE PER GRAVITA")
output.append("Tipo,Gravita,Riga ID,Data,Descrizione,Importo")
for a in data['anomalie']:
    riga_id = str(a.get('riga_id', 'N/A'))
    if isinstance(riga_id, list):
        riga_id = '; '.join(map(str, riga_id))
    data_str = a.get('data', 'N/A') or 'N/A'
    importo = a.get('importo', 'N/A')
    descrizione = a['descrizione'].replace(',', ';')  # Escape commas for CSV

    output.append(f"{a['tipo']},{a['gravita']},{riga_id},{data_str},{descrizione},{importo}")

output.append("")

# Monthly stats
output.append("EVOLUZIONE MENSILE")
output.append("Mese,Righe,Dare CHF,Avere CHF,Saldo Mensile,Saldo Cumulativo")
running = 0
for month in sorted(data['monthly_stats'].keys()):
    stats = data['monthly_stats'][month]
    month_balance = stats['debit'] - stats['credit']
    running += month_balance
    output.append(f"{month},{stats['count']},{stats['debit']:.2f},{stats['credit']:.2f},{month_balance:.2f},{running:.2f}")

output.append("")

# Top partners
output.append("TOP PARTNER")
output.append("Partner,Righe,Dare,Avere,Netto")
sorted_partners = sorted(
    data['partner_stats'].items(),
    key=lambda x: abs(x[1]['debit'] - x[1]['credit']),
    reverse=True
)[:30]

for partner, stats in sorted_partners:
    partner_clean = partner.replace(',', ';')
    netto = stats['debit'] - stats['credit']
    output.append(f"{partner_clean},{stats['count']},{stats['debit']:.2f},{stats['credit']:.2f},{netto:.2f}")

output.append("")

# Duplicates detail
output.append("DUPLICATI IDENTIFICATI")
output.append("Data,Numero Righe,IDs,Importo")
for dup in data['duplicati']:
    ids_str = '; '.join(map(str, dup['righe']))
    output.append(f"{dup['data']},{dup['count']},{ids_str},{dup['importo']:.2f}")

output.append("")

# Raccomandazioni
output.append("RACCOMANDAZIONI")
output.append("N,Raccomandazione")
for i, racc in enumerate(data['raccomandazioni'], 1):
    racc_clean = racc.replace(',', ';').replace('\n', ' ')
    output.append(f"{i},{racc_clean}")

# Write to CSV
csv_file = f"konto-1025-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
with open(csv_file, 'w', encoding='utf-8-sig') as f:  # BOM for Excel
    f.write('\n'.join(output))

print(f"Report CSV generato: {csv_file}")
print("Aprire con Excel per formattazione completa")
