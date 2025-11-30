# Quick Start - Chiusura Konto 1099

Guida rapida per chiudere il Konto 1099 Transferkonto (CHF -60,842.41).

## Opzione 1: Automatica (2 minuti)

```bash
# Installa dipendenze
pip install odoorpc

# Esegui script
python scripts/chiusura-konto-1099.py

# Verifica output: "SUCCESSO! Saldo = 0.00"
```

## Opzione 2: Manuale (5 minuti)

1. Login: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
   - User: paul@lapa.ch
   - Password: lapa201180

2. Menu: Contabilità → Registrazioni Contabili → [Crea]

3. Compila:
   - Journal: General
   - Data: 15.11.2025
   - Ref: Chiusura Konto 1099 Transferkonto

4. Righe:
   - Riga 1: Conto 1099 | Dare: 60,842.41
   - Riga 2: Conto 2979* | Avere: 60,842.41

   *Se 2979 non esiste, usa qualsiasi conto Equity

5. Salva → Valida

6. Verifica: Piano dei Conti → 1099 → Saldo = 0.00 ✅

## Verifica Finale

```bash
# Via Python
python -c "
import odoorpc
o = odoorpc.ODOO('lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com', protocol='jsonrpc+ssl', port=443)
o.login('lapadevadmin-lapa-v2-staging-2406-25408900', 'paul@lapa.ch', 'lapa201180')
a = o.env['account.account'].browse(o.env['account.account'].search([('code','=','1099')])[0])
print(f'Saldo: CHF {a.current_balance:.2f}')
"
```

Output atteso: `Saldo: CHF 0.00`

## Documentazione Completa

- Istruzioni dettagliate: `scripts/ISTRUZIONI-CHIUSURA-KONTO-1099.md`
- Deliverable finale: `AUTOMAZIONE-CHIUSURA-KONTO-1099-DELIVERABLE.md`
- README: `scripts/README-CHIUSURA-KONTO-1099.md`

## Supporto

Problema? Leggi la sezione Troubleshooting nel deliverable principale.

---

**Process Automator - 15.11.2025**
