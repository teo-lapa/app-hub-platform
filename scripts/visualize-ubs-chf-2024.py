#!/usr/bin/env python3
"""
Crea visualizzazioni grafiche dei saldi mensili UBS CHF 2024
"""

import json
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from pathlib import Path

# File JSON con i dati
JSON_FILE = r"C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data-estratti\UBS-CHF-2024-CLEAN.json"
OUTPUT_DIR = r"C:\Users\lapa\Desktop\Claude Code\app-hub-platform\data-estratti"

def load_data():
    """Load data from JSON file"""
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_monthly_balance_chart(data):
    """Create line chart of monthly balances"""
    monthly = data['monthly_balances']

    # Prepare data for plotting
    months = []
    balances = []

    for month in sorted(monthly.keys()):
        # Convert to datetime for better x-axis formatting
        date = datetime.strptime(month + '-01', '%Y-%m-%d')
        months.append(date)
        balances.append(monthly[month]['ending_balance'])

    # Create figure
    fig, ax = plt.subplots(figsize=(14, 7))

    # Plot line chart
    ax.plot(months, balances, marker='o', linewidth=2, markersize=8,
            color='#2E86AB', label='Saldo Fine Mese')

    # Add horizontal line for year opening
    ax.axhline(y=data['saldo_inizio_anno'], color='green', linestyle='--',
               linewidth=1.5, alpha=0.7, label=f"Saldo Inizio Anno ({data['saldo_inizio_anno']:,.0f} CHF)")

    # Add horizontal line for year closing
    ax.axhline(y=data['saldo_fine_anno'], color='red', linestyle='--',
               linewidth=1.5, alpha=0.7, label=f"Saldo Fine Anno ({data['saldo_fine_anno']:,.0f} CHF)")

    # Formatting
    ax.set_xlabel('Mese', fontsize=12, fontweight='bold')
    ax.set_ylabel('Saldo (CHF)', fontsize=12, fontweight='bold')
    ax.set_title(f'Andamento Saldi Mensili - UBS CHF {data["account"]}\nAnno 2024',
                 fontsize=14, fontweight='bold', pad=20)

    # Format x-axis
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b'))
    ax.xaxis.set_major_locator(mdates.MonthLocator())

    # Format y-axis with thousands separator
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:,.0f}'))

    # Add grid
    ax.grid(True, alpha=0.3, linestyle='--')

    # Add legend
    ax.legend(loc='best', fontsize=10)

    # Rotate x-axis labels
    plt.xticks(rotation=45)

    # Tight layout
    plt.tight_layout()

    # Save
    output_file = Path(OUTPUT_DIR) / 'UBS-CHF-2024-Monthly-Balances.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"[OK] Grafico saldi mensili salvato: {output_file}")

    plt.close()

def create_quarterly_comparison(data):
    """Create bar chart comparing quarterly performance"""
    quarters = data['quarters']

    # Prepare data
    labels = [q['period'] for q in quarters]
    openings = [q['opening'] for q in quarters]
    closings = [q['closing'] for q in quarters]
    variations = [q['closing'] - q['opening'] for q in quarters]

    # Create figure with two subplots
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    # Subplot 1: Opening vs Closing
    x = range(len(labels))
    width = 0.35

    bars1 = ax1.bar([i - width/2 for i in x], openings, width,
                     label='Saldo Iniziale', color='#A23E48', alpha=0.8)
    bars2 = ax1.bar([i + width/2 for i in x], closings, width,
                     label='Saldo Finale', color='#2E86AB', alpha=0.8)

    ax1.set_xlabel('Trimestre', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Saldo (CHF)', fontsize=12, fontweight='bold')
    ax1.set_title('Saldi Iniziali vs Finali per Trimestre', fontsize=13, fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels)
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:,.0f}'))
    ax1.legend()
    ax1.grid(True, alpha=0.3, axis='y')

    # Add value labels on bars
    for bar in bars1:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:,.0f}', ha='center', va='bottom', fontsize=9)

    for bar in bars2:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:,.0f}', ha='center', va='bottom', fontsize=9)

    # Subplot 2: Variations
    colors = ['green' if v > 0 else 'red' for v in variations]
    bars3 = ax2.bar(labels, variations, color=colors, alpha=0.7)

    ax2.set_xlabel('Trimestre', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Variazione (CHF)', fontsize=12, fontweight='bold')
    ax2.set_title('Variazione Netta per Trimestre', fontsize=13, fontweight='bold')
    ax2.axhline(y=0, color='black', linestyle='-', linewidth=0.8)
    ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:+,.0f}'))
    ax2.grid(True, alpha=0.3, axis='y')

    # Add value labels
    for bar in bars3:
        height = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:+,.0f}', ha='center',
                va='bottom' if height > 0 else 'top', fontsize=10, fontweight='bold')

    # Overall title
    fig.suptitle(f'Analisi Trimestrale - UBS CHF {data["account"]} - Anno 2024',
                 fontsize=14, fontweight='bold', y=0.98)

    # Tight layout
    plt.tight_layout()

    # Save
    output_file = Path(OUTPUT_DIR) / 'UBS-CHF-2024-Quarterly-Analysis.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"[OK] Grafico analisi trimestrale salvato: {output_file}")

    plt.close()

def create_transaction_distribution(data):
    """Create pie chart of transaction distribution by quarter"""
    quarters = data['quarters']

    # Prepare data
    labels = [f"{q['period']}\n({q['transactions']} tx)" for q in quarters]
    sizes = [q['transactions'] for q in quarters]
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
    explode = (0.05, 0.05, 0.05, 0.05)

    # Create figure
    fig, ax = plt.subplots(figsize=(10, 8))

    wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels,
                                        colors=colors, autopct='%1.1f%%',
                                        shadow=True, startangle=90,
                                        textprops={'fontsize': 11, 'fontweight': 'bold'})

    # Make percentage text bold and white
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')
        autotext.set_fontsize(12)

    ax.set_title(f'Distribuzione Transazioni per Trimestre\nTotale: {sum(sizes):,} transazioni - Anno 2024',
                 fontsize=14, fontweight='bold', pad=20)

    # Equal aspect ratio ensures pie is circular
    ax.axis('equal')

    # Save
    output_file = Path(OUTPUT_DIR) / 'UBS-CHF-2024-Transactions-Distribution.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"[OK] Grafico distribuzione transazioni salvato: {output_file}")

    plt.close()

def main():
    print("=" * 80)
    print("CREAZIONE VISUALIZZAZIONI GRAFICHE - UBS CHF 2024")
    print("=" * 80)

    # Load data
    print(f"\nCaricando dati da: {JSON_FILE}")
    data = load_data()

    print(f"Conto: {data['account']}")
    print(f"Anno: {data['year']}")
    print(f"Valuta: {data['currency']}")

    # Create visualizations
    print("\nCreando grafici...")

    try:
        create_monthly_balance_chart(data)
        create_quarterly_comparison(data)
        create_transaction_distribution(data)

        print("\n" + "=" * 80)
        print("[OK] Tutte le visualizzazioni sono state create con successo!")
        print("=" * 80)
        print(f"\nFile salvati in: {OUTPUT_DIR}")
        print("  - UBS-CHF-2024-Monthly-Balances.png")
        print("  - UBS-CHF-2024-Quarterly-Analysis.png")
        print("  - UBS-CHF-2024-Transactions-Distribution.png")

    except Exception as e:
        print(f"\n[ERROR] Errore durante la creazione dei grafici: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
