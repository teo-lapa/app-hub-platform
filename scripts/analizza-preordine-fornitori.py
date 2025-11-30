#!/usr/bin/env python3
"""
Script per analizzare i prodotti PRE-ORDINE raggruppati per fornitore
"""

import xmlrpc.client
import json
from collections import defaultdict
from datetime import datetime

# ============================================================================
# CONFIGURAZIONE ODOO
# ============================================================================

ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com'
ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478'
ODOO_USERNAME = 'apphubplatform@lapa.ch'
ODOO_PASSWORD = 'apphubplatform2025'

# ID Tag PRE-ORDINE
PRE_ORDINE_TAG_ID = 314

# ============================================================================
# AUTENTICAZIONE
# ============================================================================

def authenticate():
    """Autentica con Odoo e ritorna UID"""
    print("Autenticazione in corso...")
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})

    if not uid:
        raise Exception("Autenticazione fallita")

    print(f"✓ Autenticato con UID: {uid}")
    return uid, xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# ============================================================================
# RICERCA PRODOTTI PRE-ORDINE
# ============================================================================

def get_preordine_products(models, uid):
    """Ottieni tutti i prodotti con tag PRE-ORDINE"""
    print(f"\nCerco prodotti con tag ID {PRE_ORDINE_TAG_ID}...")

    products = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'product.product', 'search_read',
        [[('categ_id', '=', PRE_ORDINE_TAG_ID)]],
        {
            'fields': [
                'id',
                'name',
                'default_code',
                'seller_ids',
                'list_price',
                'standard_price',
                'qty_available',
                'virtual_available',
                'uom_id'
            ],
            'limit': 2000  # Aumenta se hai più di 2000 prodotti
        }
    )

    print(f"✓ Trovati {len(products)} prodotti PRE-ORDINE")
    return products

# ============================================================================
# OTTIENI INFO FORNITORI
# ============================================================================

def get_supplier_info(models, uid, seller_ids):
    """Ottieni informazioni sui fornitori per una lista di seller_ids"""
    if not seller_ids:
        return []

    supplier_infos = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'product.supplierinfo', 'read',
        [seller_ids],
        {'fields': ['partner_id', 'price', 'min_qty', 'delay', 'product_code']}
    )

    return supplier_infos

# ============================================================================
# ANALIZZA E RAGGRUPPA
# ============================================================================

def analyze_by_supplier(models, uid, products):
    """Raggruppa prodotti per fornitore e calcola statistiche"""
    print("\nRaggruppamento per fornitore in corso...")

    suppliers_map = defaultdict(lambda: {
        'products': [],
        'total_products': 0,
        'total_value': 0,
        'total_stock': 0,
        'avg_price': 0
    })

    products_without_supplier = []

    for product in products:
        # Estrai info base prodotto
        product_info = {
            'id': product['id'],
            'name': product['name'],
            'sku': product['default_code'] or 'N/A',
            'list_price': product['list_price'],
            'cost_price': product['standard_price'],
            'qty_available': product['qty_available'],
            'virtual_available': product['virtual_available'],
            'uom': product['uom_id'][1] if product['uom_id'] else 'Unità'
        }

        # Se ha fornitori configurati
        if product['seller_ids']:
            supplier_infos = get_supplier_info(models, uid, product['seller_ids'])

            for supplier_info in supplier_infos:
                supplier_name = supplier_info['partner_id'][1]
                supplier_id = supplier_info['partner_id'][0]

                # Aggiungi info fornitore al prodotto
                product_with_supplier = product_info.copy()
                product_with_supplier.update({
                    'supplier_price': supplier_info['price'],
                    'min_qty': supplier_info['min_qty'],
                    'lead_time': supplier_info['delay'],
                    'supplier_code': supplier_info.get('product_code', 'N/A')
                })

                # Aggiungi al fornitore
                suppliers_map[supplier_name]['products'].append(product_with_supplier)
                suppliers_map[supplier_name]['total_products'] += 1
                suppliers_map[supplier_name]['total_value'] += product['list_price'] * product['qty_available']
                suppliers_map[supplier_name]['total_stock'] += product['qty_available']
                suppliers_map[supplier_name]['supplier_id'] = supplier_id
        else:
            # Nessun fornitore configurato
            products_without_supplier.append(product_info)

    # Calcola media prezzi per fornitore
    for supplier_name, data in suppliers_map.items():
        if data['total_products'] > 0:
            data['avg_price'] = sum(p['list_price'] for p in data['products']) / data['total_products']

    print(f"✓ Trovati {len(suppliers_map)} fornitori")
    print(f"✓ Prodotti senza fornitore: {len(products_without_supplier)}")

    return suppliers_map, products_without_supplier

# ============================================================================
# STAMPA REPORT
# ============================================================================

def print_report(suppliers_map, products_without_supplier):
    """Stampa report dettagliato"""
    print("\n" + "="*80)
    print(" REPORT PRODOTTI PRE-ORDINE PER FORNITORE ".center(80, "="))
    print("="*80)
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Totale fornitori: {len(suppliers_map)}")
    print(f"Prodotti senza fornitore: {len(products_without_supplier)}")
    print("="*80)

    # Ordina fornitori per numero prodotti (decrescente)
    sorted_suppliers = sorted(
        suppliers_map.items(),
        key=lambda x: x[1]['total_products'],
        reverse=True
    )

    # TOP 10 FORNITORI
    print("\n" + "-"*80)
    print(" TOP 10 FORNITORI PER NUMERO PRODOTTI ".center(80, "-"))
    print("-"*80)

    for i, (supplier_name, data) in enumerate(sorted_suppliers[:10], 1):
        print(f"\n{i}. {supplier_name}")
        print(f"   Prodotti:      {data['total_products']}")
        print(f"   Prezzo medio:  CHF {data['avg_price']:.2f}")
        print(f"   Valore stock:  CHF {data['total_value']:.2f}")
        print(f"   Stock totale:  {data['total_stock']:.0f} unità")

        # Mostra primi 3 prodotti
        print(f"   Campione prodotti:")
        for product in data['products'][:3]:
            print(f"     - [{product['sku']}] {product['name']}")
            print(f"       Prezzo: CHF {product['list_price']:.2f} | Stock: {product['qty_available']:.0f} {product['uom']}")

        if data['total_products'] > 3:
            print(f"     ... e altri {data['total_products'] - 3} prodotti")

    # TUTTI I FORNITORI (RIEPILOGO)
    print("\n" + "-"*80)
    print(" ELENCO COMPLETO FORNITORI ".center(80, "-"))
    print("-"*80)
    print(f"{'Fornitore':<40} {'Prodotti':>10} {'Prezzo Medio':>15} {'Stock Totale':>15}")
    print("-"*80)

    for supplier_name, data in sorted_suppliers:
        print(f"{supplier_name[:40]:<40} {data['total_products']:>10} CHF {data['avg_price']:>10.2f} {data['total_stock']:>12.0f}")

    # PRODOTTI SENZA FORNITORE
    if products_without_supplier:
        print("\n" + "-"*80)
        print(" PRODOTTI SENZA FORNITORE CONFIGURATO ".center(80, "-"))
        print("-"*80)
        print(f"Totale: {len(products_without_supplier)} prodotti")
        print("\nPrimi 10 prodotti:")

        for product in products_without_supplier[:10]:
            print(f"  - [{product['sku']}] {product['name']}")
            print(f"    Prezzo: CHF {product['list_price']:.2f} | Stock: {product['qty_available']:.0f} {product['uom']}")

        if len(products_without_supplier) > 10:
            print(f"\n  ... e altri {len(products_without_supplier) - 10} prodotti")

    print("\n" + "="*80)

# ============================================================================
# EXPORT JSON
# ============================================================================

def export_json(suppliers_map, products_without_supplier):
    """Esporta risultati in JSON"""
    filename = f"preordine_fornitori_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    # Converti defaultdict in dict normale
    output = {
        'timestamp': datetime.now().isoformat(),
        'total_suppliers': len(suppliers_map),
        'total_products_without_supplier': len(products_without_supplier),
        'suppliers': {
            name: {
                'supplier_id': data['supplier_id'],
                'total_products': data['total_products'],
                'avg_price': data['avg_price'],
                'total_value': data['total_value'],
                'total_stock': data['total_stock'],
                'products': data['products']
            }
            for name, data in suppliers_map.items()
        },
        'products_without_supplier': products_without_supplier
    }

    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Risultati esportati in: {filename}")

# ============================================================================
# EXPORT CSV
# ============================================================================

def export_csv(suppliers_map, products_without_supplier):
    """Esporta risultati in CSV"""
    import csv

    filename = f"preordine_fornitori_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)

        # Header
        writer.writerow([
            'Fornitore',
            'SKU',
            'Nome Prodotto',
            'Prezzo Listino',
            'Prezzo Fornitore',
            'Costo Standard',
            'Stock Disponibile',
            'Stock Virtuale',
            'UdM',
            'Qty Minima',
            'Lead Time (giorni)',
            'Codice Fornitore'
        ])

        # Prodotti con fornitore
        for supplier_name, data in sorted(suppliers_map.items()):
            for product in data['products']:
                writer.writerow([
                    supplier_name,
                    product['sku'],
                    product['name'],
                    f"{product['list_price']:.2f}",
                    f"{product.get('supplier_price', 0):.2f}",
                    f"{product['cost_price']:.2f}",
                    f"{product['qty_available']:.0f}",
                    f"{product['virtual_available']:.0f}",
                    product['uom'],
                    product.get('min_qty', ''),
                    product.get('lead_time', ''),
                    product.get('supplier_code', '')
                ])

        # Prodotti senza fornitore
        for product in products_without_supplier:
            writer.writerow([
                'SENZA FORNITORE',
                product['sku'],
                product['name'],
                f"{product['list_price']:.2f}",
                '',
                f"{product['cost_price']:.2f}",
                f"{product['qty_available']:.0f}",
                f"{product['virtual_available']:.0f}",
                product['uom'],
                '',
                '',
                ''
            ])

    print(f"✓ CSV esportato in: {filename}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Funzione principale"""
    try:
        # Autentica
        uid, models = authenticate()

        # Ottieni prodotti PRE-ORDINE
        products = get_preordine_products(models, uid)

        # Analizza e raggruppa per fornitore
        suppliers_map, products_without_supplier = analyze_by_supplier(models, uid, products)

        # Stampa report
        print_report(suppliers_map, products_without_supplier)

        # Export
        export_json(suppliers_map, products_without_supplier)
        export_csv(suppliers_map, products_without_supplier)

        print("\n✓ Analisi completata!")

    except Exception as e:
        print(f"\n❌ ERRORE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
