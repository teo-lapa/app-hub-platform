"""
Configurazione connessione Odoo per importazione movimenti bancari UBS
"""

# Credenziali Odoo Staging
ODOO_URL = "https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com"
ODOO_DB = "lapadevadmin-lapa-v2-staging-2406-25408900"
ODOO_USERNAME = "paul@lapa.ch"
ODOO_PASSWORD = "lapa201180"

# Giornali bancari UBS (da analisi)
GIORNALI_UBS = {
    "UBS_CHF": {
        "id": 9,
        "nome": "UBS CHF 701J",
        "codice": "BNK1",
        "iban": "CH02 0027 8278 1220 8701 J",
        "valuta": "CHF",
        "conto_contabile_id": 198,  # 1024 UBS-CHF
        "conto_sospeso_id": 195  # 1021 Bank Suspense Account
    },
    "UBS_EUR": {
        "id": 11,
        "nome": "UBS EUR 08760A",
        "codice": "BNK2",
        "iban": "CH25 0027 8278 1220 8760 A",
        "valuta": "EUR",
        "conto_contabile_id": 199,  # 1025 EUR-UBS
        "conto_sospeso_id": 195
    }
}

# Giornale predefinito
DEFAULT_JOURNAL_ID = GIORNALI_UBS["UBS_CHF"]["id"]
DEFAULT_JOURNAL_NAME = GIORNALI_UBS["UBS_CHF"]["nome"]
