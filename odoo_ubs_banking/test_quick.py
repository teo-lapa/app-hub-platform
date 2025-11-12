# -*- coding: utf-8 -*-
"""Test connessione minimale"""
import xmlrpc.client
import ssl
import config

# Connessione
context = ssl._create_unverified_context()
common = xmlrpc.client.ServerProxy(f"{config.ODOO_URL}/xmlrpc/2/common", context=context)
uid = common.authenticate(config.ODOO_DB, config.ODOO_USERNAME, config.ODOO_PASSWORD, {})

print(f"\n[OK] Connesso come UID {uid}\n")

# Test giornali bancari
models = xmlrpc.client.ServerProxy(f"{config.ODOO_URL}/xmlrpc/2/object", context=context)

# Usa search e read separati invece di search_read
print("Cercando giornali bancari...")
journal_ids = models.execute_kw(
    config.ODOO_DB, uid, config.ODOO_PASSWORD,
    'account.journal', 'search',
    [[('type', '=', 'bank')]],
    {'limit': 100}
)

print(f"Trovati {len(journal_ids)} giornali\n")

journals = models.execute_kw(
    config.ODOO_DB, uid, config.ODOO_PASSWORD,
    'account.journal', 'read',
    [journal_ids],
    {'fields': ['id', 'name', 'code', 'type']}
)

for j in journals:
    is_ubs = 'UBS' in j['name'].upper()
    prefix = ">>> UBS >>>" if is_ubs else "           "
    print(f"{prefix} [{j['id']:3d}] {j['name']}")

print("\n[OK] Test completato!")
