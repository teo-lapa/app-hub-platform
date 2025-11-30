# QUICK ACTIONS - RICONCILIAZIONE IVA 2024

## APRI SUBITO

1. **File Excel principale:**
   ```
   RICONCILIAZIONE-IVA-2024.xlsx
   ```

2. **Vai al foglio "ERRORI IVA"** - contiene tutti i 5,314 errori

---

## TOP 3 PROBLEMI DA RISOLVERE

### 1. IVA SENZA BASE IMPONIBILE (155 errori) - CRITICO!

**COSA FARE:**
1. Apri Excel > Foglio "ERRORI IVA"
2. Filtra colonna "Tipo Errore" = "IVA_SENZA_BASE_IMPONIBILE"
3. Per ogni riga:
   - Prendi il "Move ID"
   - Vai in Odoo > Contabilita > Voci di Giornale
   - Cerca il movimento con quell'ID
   - CORREGGI: Aggiungi la base imponibile o rimuovi l'IVA

**PERCHE E CRITICO:**
- IVA senza base imponibile = errore nella dichiarazione IVA
- AFC (ufficio imposte) rifiutera la dichiarazione
- Rischio sanzioni

---

### 2. FEBBRAIO 2024: IVA VENDITE NEGATIVA (CHF -4,727)

**COSA FARE:**
1. Apri Excel > Foglio "Dettaglio Vendite"
2. Filtra colonna "Mese" = "2024-02"
3. Ordina per colonna "IVA" (dal piu negativo)
4. Identifica le note di credito piu grandi
5. Verifica in Odoo se sono corrette

**POSSIBILI CAUSE:**
- Note di credito molto alte (normali?)
- Errore di data (fattura di gennaio registrata a febbraio?)
- Storno sbagliato

---

### 3. DICEMBRE 2024: ACQUISTI IVA DOPPI (CHF 34,017)

**COSA FARE:**
1. Apri Excel > Foglio "Dettaglio Acquisti"
2. Filtra colonna "Mese" = "2024-12"
3. Ordina per colonna "IVA" (dal piu alto)
4. Identifica i 10 acquisti piu grandi
5. Verifica se sono reali o duplicati

**POSSIBILI CAUSE:**
- Acquisto straordinario (macchinari, investimenti) - OK se reale
- Fatture duplicate
- Fatture di gennaio 2025 registrate in dicembre 2024

---

## FOGLIO EXCEL "ERRORI IVA" - GUIDA RAPIDA

### Colonne:
- **Tipo Errore:** Categoria errore
- **Data:** Data movimento
- **Descrizione:** Descrizione fattura
- **Dettagli:** Info aggiuntive (aliquota, importi)
- **Move ID:** ID movimento in Odoo (per trovarlo)

### Tipi di errore:

#### ALIQUOTA_NON_STANDARD (2,402 vendite)
- Aliquote tipo 8.09%, 8.10%, 8.11%
- CAUSA: Formula IVA sbagliata
- NON urgente (solo arrotondamenti)

#### ALIQUOTA_NON_STANDARD_ACQUISTI (2,694 acquisti)
- Stesso problema negli acquisti
- NON urgente

#### IVA_SENZA_BASE_IMPONIBILE (155)
- **CRITICO - Risolvere subito!**
- Movimento ha IVA ma base = 0
- Correggere in Odoo

#### POSSIBILE_DUPLICATO (63)
- Fatture con stesso importo IVA nello stesso giorno
- Verificare manualmente

---

## COME TROVARE UN MOVIMENTO IN ODOO

1. Prendi il "Move ID" dal foglio Excel
2. Vai in Odoo:
   ```
   Contabilita > Contabilita > Voci di Giornale
   ```
3. Cerca per ID (es. se Move ID = 12345):
   ```
   Filtri > Avanzati > ID = 12345
   ```
4. Apri il movimento
5. Clicca "Modifica" (se non e bloccato)
6. Correggi i dati

---

## VERIFICA RAPIDA QUADRATURA

### Totali da confrontare:

| Voce | Importo (CHF) | Dove verificare |
|------|---------------|-----------------|
| IVA Vendite 2024 | 141,495.28 | Odoo > Report > IVA Vendite |
| IVA Acquisti 2024 | 165,492.98 | Odoo > Report > IVA Acquisti |
| Saldo IVA | -23,997.70 | Differenza |

### In Odoo:
1. Vai in: **Contabilita > Report > Dichiarazione imposte**
2. Seleziona periodo: **01/01/2024 - 31/12/2024**
3. Confronta con i totali sopra
4. Se NON coincidono = errore!

---

## SQL QUERIES UTILI (se hai accesso DB)

### 1. Trova movimenti IVA senza base imponibile
```sql
SELECT
  aml.id,
  aml.date,
  aml.name,
  aml.debit,
  aml.credit,
  aml.tax_base_amount,
  am.name as move_name
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code >= '2200' AND aa.code < '2300'
  AND aml.date >= '2024-01-01' AND aml.date <= '2024-12-31'
  AND am.state = 'posted'
  AND (aml.debit != 0 OR aml.credit != 0)
  AND (aml.tax_base_amount = 0 OR aml.tax_base_amount IS NULL);
```

### 2. Top 10 acquisti dicembre 2024
```sql
SELECT
  aml.date,
  aml.name,
  rp.name as partner,
  aml.debit,
  aml.tax_base_amount,
  am.name as move_name
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_account aa ON aml.account_id = aa.id
LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE aa.code >= '1170' AND aa.code < '1180'
  AND aml.date >= '2024-12-01' AND aml.date <= '2024-12-31'
  AND am.state = 'posted'
ORDER BY aml.debit DESC
LIMIT 10;
```

---

## CHECKLIST FINALE

Prima di chiudere la riconciliazione IVA 2024:

- [ ] Corretti tutti i 155 errori "IVA_SENZA_BASE_IMPONIBILE"
- [ ] Verificato febbraio 2024 (IVA vendite negativa)
- [ ] Verificato dicembre 2024 (acquisti doppi)
- [ ] Controllati i 63 possibili duplicati
- [ ] Rieseguito script: `python scripts/riconciliazione-iva-2024.py`
- [ ] Verificato che errori critici = 0
- [ ] Confrontato totali con dichiarazioni IVA trimestrali
- [ ] Saldo IVA confermato: CHF -23,997.70 (A CREDITO)

---

## CONTATTI

**Per domande tecniche:**
- Script: `scripts/riconciliazione-iva-2024.py`
- README completo: `README-RICONCILIAZIONE-IVA-2024.md`

**Per correzioni Odoo:**
- URL: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
- User: paul@lapa.ch

---

**IMPORTANTE:** Dopo ogni correzione in Odoo, riesegui lo script per verificare che l'errore sia sparito!
