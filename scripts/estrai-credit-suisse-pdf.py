#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Estrai dati da PDF Credit Suisse usando pdfplumber
"""

import sys
import io
import json

# Fix encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import pdfplumber
except ImportError:
    print("Installing pdfplumber...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pdfplumber"])
    import pdfplumber

# PDF files to process
pdf_files = [
    {
        'path': r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\CREDIT SUISSE\ESTRATTO CONTO CREDIT SUISSE CONTO CARTE 1.1.-30.6.2024.pdf',
        'period': 'H1 2024',
        'date_from': '01/01/2024',
        'date_to': '30/06/2024'
    },
    {
        'path': r'C:\Users\lapa\Downloads\CHIUSURA 2024\CHIUSURA 2024\CREDIT SUISSE\ESTRATTO CONTO CREDIT SUISSE CONTO CARTE 1.7-31.12.2024.pdf',
        'period': 'H2 2024',
        'date_from': '01/07/2024',
        'date_to': '31/12/2024'
    }
]

print("=" * 100)
print("ESTRAZIONE DATI CREDIT SUISSE PDF - ESTRATTI CONTO CARTE")
print("=" * 100)

all_data = {
    'bank': 'Credit Suisse',
    'account_type': 'Carte di Credito',
    'year': 2024,
    'periods': []
}

for pdf_info in pdf_files:
    print(f"\n{'='*100}")
    print(f"Elaborando: {pdf_info['period']}")
    print(f"File: {pdf_info['path']}")
    print(f"{'='*100}")

    try:
        with pdfplumber.open(pdf_info['path']) as pdf:
            print(f"Numero pagine: {len(pdf.pages)}")

            period_data = {
                'period': pdf_info['period'],
                'date_from': pdf_info['date_from'],
                'date_to': pdf_info['date_to'],
                'pages': len(pdf.pages),
                'text_extracted': []
            }

            # Estrai testo dalle prime 5 e ultime 5 pagine per trovare i saldi
            pages_to_extract = []
            total_pages = len(pdf.pages)

            # Prime 5 pagine
            for i in range(min(5, total_pages)):
                pages_to_extract.append(i)

            # Ultime 5 pagine
            for i in range(max(0, total_pages - 5), total_pages):
                if i not in pages_to_extract:
                    pages_to_extract.append(i)

            print(f"\nEstraendo testo da {len(pages_to_extract)} pagine...")

            for page_num in pages_to_extract:
                page = pdf.pages[page_num]
                text = page.extract_text()

                if text:
                    period_data['text_extracted'].append({
                        'page': page_num + 1,
                        'text': text[:2000]  # Prime 2000 caratteri
                    })

                    # Cerca saldi, numeri conto, etc.
                    if 'saldo' in text.lower() or 'balance' in text.lower():
                        print(f"\n  Pagina {page_num + 1}: Trovato riferimento a saldo")
                        print(f"  Estratto: {text[:500]}...")

                    if 'conto' in text.lower() or 'account' in text.lower():
                        print(f"\n  Pagina {page_num + 1}: Trovato riferimento a conto")

            all_data['periods'].append(period_data)

            print(f"\n✓ {pdf_info['period']} processato: {len(period_data['text_extracted'])} pagine estratte")

    except Exception as e:
        print(f"\n❌ ERRORE processando {pdf_info['period']}: {str(e)}")
        import traceback
        traceback.print_exc()

# Salva risultati
output_file = r'C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data-estratti\CREDIT-SUISSE-PDF-EXTRACTED.json'

print(f"\n{'='*100}")
print(f"Salvando risultati in: {output_file}")
print(f"{'='*100}")

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(all_data, f, indent=2, ensure_ascii=False)

print(f"\n✓ File JSON creato con successo")
print(f"\nPeriodi estratti: {len(all_data['periods'])}")

# Crea anche un file di testo leggibile
txt_file = r'C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data-estratti\CREDIT-SUISSE-PDF-EXTRACTED.txt'

with open(txt_file, 'w', encoding='utf-8') as f:
    f.write("ESTRATTI CONTO CREDIT SUISSE - CARTE DI CREDITO 2024\n")
    f.write("=" * 100 + "\n\n")

    for period in all_data['periods']:
        f.write(f"\n{period['period']} ({period['date_from']} - {period['date_to']})\n")
        f.write("-" * 100 + "\n")
        f.write(f"Pagine totali: {period['pages']}\n")
        f.write(f"Pagine estratte: {len(period['text_extracted'])}\n\n")

        for page_data in period['text_extracted']:
            f.write(f"\n--- Pagina {page_data['page']} ---\n")
            f.write(page_data['text'])
            f.write("\n\n")

print(f"✓ File TXT creato: {txt_file}")

print("\n" + "=" * 100)
print("ESTRAZIONE COMPLETATA")
print("=" * 100)
