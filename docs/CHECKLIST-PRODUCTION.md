# CHECKLIST OPERATIVA - Chiusura Contabile 2024 Production

**Stampa questo documento e spunta ogni task manualmente durante l'esecuzione.**

---

## PRE-EXECUTION (Prima di Iniziare)

### Preparazione Ambiente

- [ ] Backup database production scaricato
- [ ] Backup salvato in: `_______________________________` (path)
- [ ] Timestamp backup: `_______________________________`
- [ ] Backup verificato (re-import test): OK / FAIL
- [ ] Python 3.x installato e funzionante
- [ ] Node.js installato (se usi script .ts)
- [ ] Accesso Odoo production verificato

### Credenziali e Accessi

- [ ] User: paul@lapa.ch - Password: verificata
- [ ] Diritti utente: Accounting / Advisor (verificato in Odoo UI)
- [ ] API XML-RPC attiva (test connection OK)
- [ ] VPN/Network: connessione stabile

### Dati Input

- [ ] Estratti conto 2024 - PostFinance CHF
- [ ] Estratti conto 2024 - UBS CHF
- [ ] Estratti conto 2024 - UBS EUR
- [ ] Estratti conto 2024 - UBS USD
- [ ] Estratti conto 2024 - Raiffeisen CHF
- [ ] Estratti conto 2024 - Credit Suisse CHF
- [ ] Estratti conto 2024 - PostFinance EUR
- [ ] Estratti conto 2024 - PostFinance USD
- [ ] Tutti i file salvati in: `data/bank-statements/2024/`

### Team e Contatti

- [ ] Contabile Senior: disponibile
- [ ] Developer: disponibile
- [ ] Commercialista: in CC (informato)
- [ ] Numeri emergenza annotati

### Timing

- [ ] Finestra manutenzione confermata: dalle `_____` alle `_____`
- [ ] Nessuna operazione critica Odoo in corso
- [ ] Utenti informati (sistema in manutenzione)

---

## EXECUTION (Durante Esecuzione)

### STEP 1: Verifica Stato Iniziale

**Tempo Stimato**: 15 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `verifica-rapida-conti-chiave.py` eseguito
- [ ] Saldo 1099 iniziale: `______________ CHF`
- [ ] Saldo 10901 iniziale: `______________ CHF`
- [ ] Saldo 1022 iniziale: `______________ CHF`
- [ ] Saldo 1023 iniziale: `______________ CHF`
- [ ] Saldo 1001 iniziale: `______________ CHF`
- [ ] File `report-stato-iniziale-prod.txt` salvato
- [ ] Trial Balance iniziale esportato
- [ ] Nessuna discrepanza critica (> CHF 10K): SI / NO
- [ ] **STOP POINT**: Se NO, FERMA QUI → Analisi

**Note/Anomalie**:
```


```

---

### STEP 2: Import Estratti Conto

**Tempo Stimato**: 30 min | **Inizio**: `_____` | **Fine**: `_____`

#### PostFinance CHF (1002)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO → Se SI: `___________________`

#### UBS CHF (1003)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO

#### UBS EUR (1004)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO

#### UBS USD (1011)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO

#### Raiffeisen CHF (1005)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO

#### Credit Suisse CHF (1006)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO

#### PostFinance EUR (1010)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO

#### PostFinance USD (1012)
- [ ] File caricato: `_______________________________`
- [ ] Movimenti importati: `_______` righe
- [ ] Errori import: SI / NO

**Totale Movimenti Importati**: `_______` righe

**Verifica**:
- [ ] Nessun file skippato
- [ ] Tutti i conti bancari coperti (8/8)
- [ ] Nessun errore critico import

**Note/Problemi**:
```


```

---

### STEP 3: Riclassificazioni FX

**Tempo Stimato**: 15 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `ALLINEA-10901-FX-RICLASSIFICA.py` eseguito
- [ ] Movimenti FX identificati: `_______`
- [ ] Journal entries create: `_______`
- [ ] IDs journal entries: `_______________________________`
- [ ] Konto 10901 saldo dopo FX: `______________ CHF`
- [ ] Errori script: SI / NO → Se SI: `___________________`

**Verifica**:
- [ ] Saldo 10901 ridotto rispetto a STEP 1
- [ ] Tutte le JE in stato "Posted" (non Draft)
- [ ] Importi ragionevoli (< CHF 1000 per FX)

**Note**:
```


```

---

### STEP 4: Riclassificazioni Credit Card

**Tempo Stimato**: 10 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `ALLINEA-10901-CREDITCARD-RICLASSIFICA.py` eseguito
- [ ] Pagamenti carta identificati: `_______`
- [ ] Journal entries create: `_______`
- [ ] IDs journal entries: `_______________________________`
- [ ] Konto 10901 saldo dopo Card: `______________ CHF`
- [ ] Errori script: SI / NO

**Verifica**:
- [ ] Saldo 10901 ulteriormente ridotto
- [ ] Match carta trovati (> 80% dei movimenti)

**Note**:
```


```

---

### STEP 5: Chiusura Konto 10901

**Tempo Stimato**: 15 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `chiusura-konto-10901-finale.py` eseguito
- [ ] Movimenti residui chiusi: `_______`
- [ ] Journal entries create: `_______`
- [ ] IDs journal entries: `_______________________________`
- [ ] **Konto 10901 saldo finale: `______________ CHF`**
- [ ] Errori script: SI / NO

**TARGET**: CHF 0.00 (tolleranza ±CHF 0.01)

**Verifica**:
- [ ] Saldo 10901 = CHF 0.00 ✓
- [ ] Se NO: differenza `__________` → Accettabile? SI / NO
- [ ] Tutti i movimenti classificati

**Note**:
```


```

---

### STEP 6: Riconciliazione Konto 1022

**Tempo Stimato**: 15 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `riconcilia-konto-1022-advanced.py` eseguito
- [ ] Pagamenti riconciliati automaticamente: `_______`
- [ ] Saldo 1022 dopo auto-riconciliazione: `______________ CHF`
- [ ] Errori script: SI / NO

**Se saldo non zero**:
- [ ] Riconciliazione manuale via Odoo UI
- [ ] Movimenti riconciliati manualmente: `_______`
- [ ] **Saldo 1022 finale: `______________ CHF`**

**TARGET**: CHF 0.00 (tolleranza ±CHF 1000)

**Verifica**:
- [ ] Saldo accettabile (< CHF 1000)
- [ ] Movimenti residui documentati

**Note**:
```


```

---

### STEP 7: Riconciliazione Konto 1023

**Tempo Stimato**: 15 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `riconcilia-konto-1023-advanced.py` eseguito
- [ ] Pagamenti riconciliati automaticamente: `_______`
- [ ] Saldo 1023 dopo auto-riconciliazione: `______________ CHF`
- [ ] Errori script: SI / NO

**Se saldo non zero**:
- [ ] Riconciliazione manuale via Odoo UI
- [ ] Movimenti riconciliati manualmente: `_______`
- [ ] **Saldo 1023 finale: `______________ CHF`**

**TARGET**: CHF 0.00 (tolleranza ±CHF 1000)

**Verifica**:
- [ ] Saldo accettabile (< CHF 1000)
- [ ] Movimenti residui documentati

**Note**:
```


```

---

### STEP 8: Chiusura Konto 1099

**Tempo Stimato**: 10 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `chiusura-konto-1099-final.js` eseguito
- [ ] Saldo 1099 prima: `______________ CHF`
- [ ] Journal entry chiusura creato: ID `_______`
- [ ] **Saldo 1099 finale: `______________ CHF`**
- [ ] Errori script: SI / NO

**TARGET**: CHF 0.00

**Verifica**:
- [ ] Saldo 1099 = CHF 0.00 ✓
- [ ] Journal entry posted (data 31/12/2024)

**Note**:
```


```

---

### STEP 9: Verifica Cash 1001

**Tempo Stimato**: 10 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Saldo 1001 attuale: `______________ CHF`
- [ ] Saldo atteso (da contabilità): `______________ CHF`
- [ ] Differenza: `______________ CHF`
- [ ] Differenza accettabile (< CHF 100): SI / NO

**Se differenza significativa**:
- [ ] Script `rettifica-cash-1001.py --dry-run` eseguito
- [ ] Preview rettifica verificata: OK / PROBLEMI
- [ ] Script `rettifica-cash-1001.py --execute` eseguito
- [ ] Saldo 1001 post-rettifica: `______________ CHF`

**STOP POINT**: Se saldo molto anomalo, CONSULTARE commercialista

**Note**:
```


```

---

### STEP 10: Verifica Finale

**Tempo Stimato**: 10 min | **Inizio**: `_____` | **Fine**: `_____`

- [ ] Script `verifica-finale-production-completa.py` eseguito
- [ ] Report JSON generato: `report-verifica-production.json`
- [ ] Script `genera-excel-chiusura-2024.py` eseguito
- [ ] Report Excel generato: `REPORT-FINALE-PRODUCTION-2024.xlsx`

#### Verifica Conti Chiave

- [ ] Konto 1099 finale: `______________` → Target: CHF 0.00
- [ ] Konto 10901 finale: `______________` → Target: CHF 0.00
- [ ] Konto 1022 finale: `______________` → Target: CHF 0.00
- [ ] Konto 1023 finale: `______________` → Target: CHF 0.00
- [ ] Konto 1001 finale: `______________` → Target: ~CHF 80-100K

#### Verifica Conti Bancari (Delta < CHF 100)

- [ ] 1002 PostFinance CHF: Delta `______________`
- [ ] 1003 UBS CHF: Delta `______________`
- [ ] 1004 UBS EUR: Delta `______________`
- [ ] 1005 Raiffeisen CHF: Delta `______________`
- [ ] 1006 Credit Suisse CHF: Delta `______________`
- [ ] 1010 PostFinance EUR: Delta `______________`
- [ ] 1011 UBS USD: Delta `______________`
- [ ] 1012 PostFinance USD: Delta `______________`

#### Trial Balance

- [ ] Trial balance esportato: `trial-balance-2024-production.xlsx`
- [ ] Totale DARE: `______________` CHF
- [ ] Totale AVERE: `______________` CHF
- [ ] Differenza: `______________` CHF
- [ ] **QUADRATURA OK** (diff < CHF 1.00): SI / NO

#### Journal Entries

- [ ] Nessuna JE in stato Draft: verificato
- [ ] Tutte le JE create hanno data 2024: verificato
- [ ] Lista JE create salvata: `journal-entries-created.csv`

**FINAL CHECK - TUTTO OK?**: SI / NO

**Se NO, cosa manca?**:
```


```

---

## POST-EXECUTION (Dopo Esecuzione)

### Documentazione

- [ ] Tutti i report salvati in: `reports/production/2024/`
- [ ] Screenshot Odoo (stato finale conti) salvati
- [ ] Log esecuzione salvato: `execution-log-TIMESTAMP.txt`
- [ ] Questa checklist compilata salvata
- [ ] Backup post-intervento scaricato (sicurezza)

### Review

- [ ] Review contabile (Contabile Senior): NOME `______________` DATA `_____`
- [ ] Verifica tecnica (Developer): NOME `______________` DATA `_____`
- [ ] Approval finale (CFO/Owner): NOME `______________` DATA `_____`

### Deliverable Commercialista

**Prepara cartella**: `deliverable-commercialista-2024/`

- [ ] `REPORT-FINALE-PRODUCTION-2024.xlsx`
- [ ] `trial-balance-2024-production.pdf`
- [ ] `journal-entries-created.csv`
- [ ] `bank-reconciliation-summary.pdf`
- [ ] `note-chiusura-2024.md` (con anomalie documentate)
- [ ] Email draft commercialista preparata
- [ ] Email inviata: DATA `_____` ORA `_____`

### Cleanup

- [ ] Script di test eliminati da production (se eseguiti da server)
- [ ] Credenziali temporanee revocate (se create)
- [ ] Logs sensibili archiviati (non lasciati pubblici)

---

## ROLLBACK (Solo se necessario)

**Questo section si compila SOLO se hai dovuto fare rollback**

### Motivo Rollback

**Errore riscontrato**:
```


```

**Step dove si è verificato**: `_______`

**Decisione**: ROLLBACK COMPLETO / ROLLBACK PARZIALE

### Azioni Rollback

- [ ] Backup pre-intervento identificato: `______________`
- [ ] Restore database eseguito: ORA `_____`
- [ ] Verifica post-restore OK
- [ ] Stato database: tornato a pre-intervento

**OPPURE** (se rollback parziale):

- [ ] Journal entries da reversare: IDs `______________`
- [ ] Script `reverse-journal-entries.py` eseguito
- [ ] Entries reversate: `_______`
- [ ] Stato conti post-reverse verificato

### Post-Rollback

- [ ] Log errore salvato: `error-log-TIMESTAMP.txt`
- [ ] Screenshot errore salvati
- [ ] Causa errore identificata: `_______________________________`
- [ ] Fix applicato in staging
- [ ] Re-test staging OK
- [ ] **DATA RETRY PRODUCTION**: `_____________`

**Persone informate del rollback**:
- [ ] Contabile
- [ ] Developer
- [ ] CFO/Owner
- [ ] Commercialista

---

## FIRMA FINALE

**Esecuzione completata con successo**: SI / NO

**Data**: `_________________`

**Ora fine esecuzione**: `_________________`

**Tempo totale**: `_________________` (hh:mm)

**Firme**:

Contabile: `_______________________________` Data: `_______`

Developer: `_______________________________` Data: `_______`

CFO/Owner: `_______________________________` Data: `_______`

---

## NOTE FINALI / LESSONS LEARNED

```









```

---

**END OF CHECKLIST**

Conservare questo documento per 10 anni (requisiti fiscali).
