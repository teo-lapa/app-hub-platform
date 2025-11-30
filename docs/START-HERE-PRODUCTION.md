# START HERE - Chiusura Contabile 2024 Production

**LEGGI QUESTO DOCUMENTO PER PRIMO**

---

## COSA HO DAVANTI?

Hai **4 documenti chiave** pronti per replicare in **PRODUCTION** la chiusura contabile 2024:

1. **START-HERE-PRODUCTION.md** ← **SEI QUI** (questo documento)
2. **PIANO-PRODUCTION-2024.md** - Piano step-by-step completo
3. **CHECKLIST-PRODUCTION.md** - Checklist operativa da stampare
4. **ROLLBACK-PLAN.md** - Piano emergenza rollback
5. **SCRIPTS-PRODUCTION-README.md** - Guida tecnica scripts

---

## EXECUTIVE SUMMARY

### Cosa Facciamo

Chiudiamo la contabilità 2024 in production, esattamente come fatto in staging:

- **Chiudere conti sospesi**: 1099, 10901, 1022, 1023
- **Riconciliare banche**: 8 conti bancari
- **Quadrare trial balance**: DARE = AVERE
- **Preparare deliverable commercialista**

### Perché Adesso

- Fine anno 2024 → chiusura fiscale
- Commercialista aspetta documentazione
- Dati già testati e verificati in **STAGING**

### Quanto Tempo

- **Tempo stimato**: 2-3 ore
- **Con contingenza**: fino a 4 ore
- **Finestra consigliata**: Sabato/Domenica mattina

### Chi Serve

- **Contabile Senior**: verifica e approval
- **Developer**: esecuzione tecnica
- **Commercialista**: in CC, non necessario presente

---

## PREREQUISITI CRITICI

### PRIMA DI INIZIARE, HAI:

- [ ] **BACKUP DATABASE** production scaricato? (OBBLIGATORIO!)
- [ ] Estratti conto bancari 2024 (tutti e 8)?
- [ ] Credenziali Odoo production verificate?
- [ ] Python 3.x installato?
- [ ] Letto il PIANO-PRODUCTION-2024.md?
- [ ] Stampato la CHECKLIST-PRODUCTION.md?
- [ ] Rollback plan chiaro?
- [ ] Finestra manutenzione confermata?

**Se anche solo UNA risposta è NO → FERMA, completa prerequisito**

---

## WORKFLOW IN 3 PASSI

### PASSO 1: PREPARAZIONE (30 min)

**Cosa fare**:
1. Scarica backup database production
2. Prepara estratti conto in `data/bank-statements/2024/`
3. Stampa CHECKLIST-PRODUCTION.md
4. Test connessione Odoo

**Comandi**:
```bash
# Test connessione
python scripts/test-odoo-connection.py

# Verifica stato iniziale
python scripts/verifica-rapida-conti-chiave.py
```

**Output atteso**:
```
Konto 1099: CHF [valore iniziale]
Konto 10901: CHF [valore iniziale]
Konto 1022: CHF [valore iniziale]
Konto 1023: CHF [valore iniziale]
Konto 1001: CHF [valore iniziale]
```

**Annota questi valori** → Li confronterai alla fine.

---

### PASSO 2: ESECUZIONE (2 ore)

**Segui il PIANO-PRODUCTION-2024.md step-by-step**:

1. **STEP 1-2**: Import bank statements (30 min)
2. **STEP 3-5**: Chiusura Konto 10901 (30 min)
3. **STEP 6-7**: Riconciliazione 1022 e 1023 (30 min)
4. **STEP 8-9**: Chiusura 1099 e verifica Cash (20 min)
5. **STEP 10**: Verifica finale (10 min)

**Durante esecuzione**:
- ✓ Spunta ogni task sulla CHECKLIST stampata
- ✓ Salva log di ogni comando
- ✓ Ferma se errori → Consulta ROLLBACK-PLAN

---

### PASSO 3: VERIFICA E CONSEGNA (30 min)

**Verifica Finale**:
```bash
# Verifica completa
python scripts/verifica-finale-staging-completa.py

# Genera report Excel
python scripts/genera-excel-chiusura-2024.py

# Genera PDF per commercialista
python scripts/genera-pdf-chiusura-2024.py
```

**Controlli Finali**:
- [ ] Konto 1099 = CHF 0.00 ✓
- [ ] Konto 10901 = CHF 0.00 ✓
- [ ] Konto 1022 ≈ CHF 0.00 (±1K) ✓
- [ ] Konto 1023 ≈ CHF 0.00 (±1K) ✓
- [ ] Cash 1001 = saldo realistico (~80-100K) ✓
- [ ] 8 banche: delta < CHF 100 ✓
- [ ] Trial Balance: DARE = AVERE ✓

**Deliverable Commercialista**:
- [ ] `REPORT-FINALE-PRODUCTION-2024.xlsx`
- [ ] `trial-balance-2024-production.pdf`
- [ ] `journal-entries-created.csv`
- [ ] `note-chiusura-2024.md`

**Invia email commercialista** (draft in PIANO-PRODUCTION-2024.md)

---

## COSA PUÒ ANDARE STORTO

### Scenario 1: Script Fallisce

**Sintomi**: Exception Python, errore Odoo, timeout

**Azione**:
1. FERMA esecuzione
2. Salva log errore
3. Consulta ROLLBACK-PLAN.md
4. Valuta: rollback parziale o completo?

**Decisione**:
- Se trial balance OK → Rollback parziale
- Se trial balance NON OK → Rollback completo

---

### Scenario 2: Saldi Conti Anomali

**Sintomi**: Konto 10901 non chiude a zero, Cash negativo, banche con delta > CHF 1K

**Azione**:
1. FERMA prima di procedere
2. Analizza movimenti anomali:
   ```bash
   python scripts/analizza-movimenti-anomali-2024.py --account 10901
   ```
3. Se non capisci causa → **FERMA e consulta contabile**
4. Non procedere "sperando che si risolva"

---

### Scenario 3: Trial Balance Sbilanciato

**Sintomi**: DARE ≠ AVERE, differenza > CHF 1.00

**Azione**:
1. **FERMA IMMEDIATAMENTE**
2. Trova JE sbilanciate:
   ```bash
   python scripts/check-unbalanced-moves.py
   ```
3. **ROLLBACK OBBLIGATORIO** → Vedi ROLLBACK-PLAN.md
4. Analizza causa prima di retry

---

### Scenario 4: Troppo Tempo

**Sintomi**: Esecuzione > 4 ore, bloccato su uno step

**Azione**:
1. Valuta se continuare o rollback
2. Se bloccato > 30 min su uno step → C'è un problema
3. Timeout script? → Aumenta config o splitta operazioni
4. In dubbio → ROLLBACK e rianalizza

---

## DECISION TREE

```
Inizio
  ├─ Backup fatto?
  │   ├─ NO → FERMA, fai backup
  │   └─ SI → Continua
  │
  ├─ Test connessione OK?
  │   ├─ NO → Fix connessione
  │   └─ SI → Continua
  │
  ├─ Esegui STEP 1-10
  │   ├─ Errore? → Vai a ROLLBACK PLAN
  │   └─ OK → Continua
  │
  ├─ Verifica Finale
  │   ├─ Trial Balance OK?
  │   │   ├─ NO → ROLLBACK COMPLETO
  │   │   └─ SI → Continua
  │   │
  │   ├─ Conti chiusi?
  │   │   ├─ NO → Analizza, fix, riprova
  │   │   └─ SI → Continua
  │   │
  │   └─ SUCCESSO → Genera deliverable
  │
  └─ Fine: Consegna a commercialista
```

---

## QUICK REFERENCE

### Documenti da Aprire

**Durante esecuzione, tieni aperti**:
1. **PIANO-PRODUCTION-2024.md** - Segui step-by-step
2. **CHECKLIST-PRODUCTION.md** - Spunta task
3. **ROLLBACK-PLAN.md** - Pronto per emergenza

### Comandi Chiave

```bash
# Verifica stato conti
python scripts/verifica-rapida-conti-chiave.py

# Test connessione
python scripts/test-odoo-connection.py

# Verifica finale
python scripts/verifica-finale-staging-completa.py

# Rollback (emergenza)
python scripts/reverse-journal-entries.py --date today
```

### File Output

**Salva tutto in**: `deliverable-production-2024/`

```
deliverable-production-2024/
├── REPORT-FINALE-PRODUCTION-2024.xlsx
├── trial-balance-2024-production.pdf
├── journal-entries-created.csv
├── bank-reconciliation-summary.pdf
├── note-chiusura-2024.md
├── logs/
│   ├── execution-log-TIMESTAMP.txt
│   └── [altri logs]
└── CHECKLIST-PRODUCTION.md (compilata)
```

---

## TIMELINE ESEMPIO

**Esecuzione tipo (tutto OK)**:

| Ora | Attività | Durata |
|-----|----------|--------|
| 09:00 | Preparazione, backup, setup | 30 min |
| 09:30 | STEP 1-2: Import statements | 30 min |
| 10:00 | STEP 3-5: Chiusura 10901 | 30 min |
| 10:30 | STEP 6-7: Riconcilia 1022/1023 | 30 min |
| 11:00 | STEP 8-9: Chiudi 1099, verifica Cash | 20 min |
| 11:20 | STEP 10: Verifica finale | 10 min |
| 11:30 | Report, deliverable, email | 20 min |
| 11:50 | Backup post-intervento, cleanup | 10 min |
| 12:00 | **FINE** ✓ |

**Totale**: 3 ore

---

## STATO STAGING (Riferimento)

**Al 16 Nov 2025, in STAGING abbiamo**:

- ✓ Konto 1099: CHF 0.00 (CHIUSO)
- ⚠ Konto 10901: CHF 256K (DA CHIUDERE - in progress altri agent)
- ⚠ Konto 1022: CHF -165K (DA CHIUDERE - in progress)
- ⚠ Konto 1023: CHF 568K (DA CHIUDERE - in progress)
- ⚠ Konto 1001: CHF -9K (ANOMALO - da verificare)

**NOTA**: Gli altri agent stanno completando la chiusura di 10901/1022/1023 in staging. Quando finiranno, avremo TUTTI i conti a zero e potremo procedere in production con sicurezza.

**Production dovrà replicare gli stessi step** per ottenere gli stessi risultati.

---

## PROSSIMI PASSI (OGGI)

1. **Ora**: Attendi completamento altri agent in staging
2. **Quando staging OK**: Genera REPORT-FINALE-STAGING-2024.xlsx
3. **Confronta staging vs production**: Identifica differenze
4. **Plan production execution**: Scegli data/ora finestra manutenzione
5. **Brief team**: Contabile + Developer allineati
6. **GO PRODUCTION**: Esegui seguendo questo piano

---

## CONTATTI

**In caso di problemi durante esecuzione**:

| Ruolo | Azione |
|-------|--------|
| **Errore tecnico script** | Developer on-call |
| **Dubbio contabile** | Contabile Senior |
| **Problema Odoo** | support@odoo.com |
| **Decisione rollback** | Contabile + Developer insieme |
| **Approval finale** | CFO/Owner |

---

## FINAL CHECKLIST (Before Starting)

**Prima di digitare il primo comando**:

- [ ] Ho letto **tutto** PIANO-PRODUCTION-2024.md
- [ ] Backup database scaricato e verificato
- [ ] Estratti conto pronti (8 file)
- [ ] Credenziali production OK
- [ ] Team disponibile (Contabile + Developer)
- [ ] Finestra manutenzione confermata
- [ ] Checklist stampata
- [ ] Rollback plan chiaro
- [ ] Log directory created
- [ ] **Sono pronto!**

**Se tutte le checkbox sono ✓ → VAI con PIANO-PRODUCTION-2024.md STEP 1**

**Se anche solo una NO → FERMA, completa prerequisito**

---

## MOTIVATIONAL NOTE

**Questa chiusura è importante ma gestibile.**

- ✓ Hai tutto testato in staging
- ✓ Hai backup (safety net)
- ✓ Hai rollback plan (se serve)
- ✓ Hai team support

**Procedi con calma, segui il piano, verifica ogni step.**

**In caso di dubbio → FERMA e chiedi. Better safe than sorry.**

---

## NEXT DOCUMENT

**→ Vai a PIANO-PRODUCTION-2024.md e inizia da STEP 1**

**Buona chiusura contabile! 🚀**

---

**END OF START-HERE DOCUMENT**

Questo documento è la tua guida rapida. Per i dettagli, consulta i documenti linkati.
