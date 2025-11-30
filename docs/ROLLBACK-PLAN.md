# ROLLBACK PLAN - Chiusura Contabile 2024 Production

**Documento**: Piano di Rollback Emergenza
**Versione**: 1.0
**Data**: 16 Novembre 2025
**Criticità**: MASSIMA

---

## QUANDO FARE ROLLBACK

### Trigger Automatici (FERMA IMMEDIATAMENTE)

**ROLLBACK OBBLIGATORIO** se si verifica uno di questi:

1. **Errore Python Non Gestito**
   - Exception non caught che blocca script
   - Errore di connessione Odoo persistente (> 3 retry)
   - Corruzione dati (integrity error)

2. **Trial Balance Sbilanciato**
   - Differenza DARE - AVERE > CHF 1.00
   - Impossibile identificare causa sbilancio
   - Quadratura peggiora invece di migliorare

3. **Journal Entry Non Postabile**
   - Odoo rifiuta di postare JE (validation error)
   - Errore "Account not allowed" o simili
   - JE creata ma non postabile

4. **Discrepanze Maggiori**
   - Saldi conti > CHF 10,000 fuori range atteso
   - Saldi bancari con delta > CHF 1,000
   - Cash (1001) negativo oltre -CHF 10,000

5. **Cancellazione Dati Critici**
   - Movimenti contabili cancellati per errore
   - Invoices/Bills marcate come deleted
   - Bank statements persi

### Trigger Manuali (Valuta Caso per Caso)

**ROLLBACK RACCOMANDATO** se:

- Tempo esecuzione > 5 ore (troppo lungo, c'è problema)
- Più di 3 script falliscono in sequenza
- Commercialista segnala anomalie gravi
- Developer non riesce a debuggare errore in < 30 min
- Ti senti insicuro o "qualcosa non quadra"

**Regola d'oro**: **In dubbio, fai rollback**. È sempre meglio fermarsi e rianalizzare che procedere e creare danni peggiori.

---

## OPZIONI DI ROLLBACK

### Opzione 1: ROLLBACK COMPLETO (Database Restore)

**Quando usare**:
- Errori gravi/multipli
- Dati corrotti
- Trial Balance irrecuperabile
- Situazione fuori controllo

**Vantaggi**:
- Ritorna a stato 100% pre-intervento
- Zero rischio dati residui corrotti
- Semplice e sicuro

**Svantaggi**:
- Perde TUTTO il lavoro fatto (devi rifare da zero)
- Tempo: ~30 minuti restore
- Richiede backup valido

**Processo**:

```bash
# 1. STOP tutte le operazioni Odoo
# 2. Via Odoo Cloud Dashboard:
Settings > Database Manager > Restore

# 3. Scegli backup file
# File: backup-pre-chiusura-2024-TIMESTAMP.zip

# 4. Conferma restore
# WARNING: Questo sovrascrive il database corrente!

# 5. Attendi restore (10-30 min)

# 6. Verifica post-restore
python scripts/verifica-rapida-conti-chiave.py --env production
```

**Checklist Post-Restore**:
- [ ] Database restored con successo
- [ ] Login Odoo funziona
- [ ] Saldi conti = saldi pre-intervento
- [ ] Nessuna JE creata durante intervento presente
- [ ] Data ultimo movimento contabile = prima intervento
- [ ] **STATO: Tornato a T0**

---

### Opzione 2: ROLLBACK PARZIALE (Reverse Entries)

**Quando usare**:
- Errore in uno step specifico
- Trial Balance ancora corretto
- Solo alcune JE da annullare (< 50)
- Vuoi salvare il lavoro fatto negli step precedenti

**Vantaggi**:
- Più veloce (~10 min)
- Salva lavoro step già completati OK
- Più granulare

**Svantaggi**:
- Deve essere fatto correttamente (rischio errori)
- Non recupera import bank statements (va rifatto manuale)
- Richiede know-how tecnico

**Processo**:

#### Via Script Automatico

```bash
# Reverse tutte le JE create oggi
python scripts/reverse-journal-entries.py --date 2025-11-16 --env production

# Oppure reverse solo specifici IDs
python scripts/reverse-journal-entries.py --move-ids "12345,12346,12347" --env production

# Output:
# - XX journal entries reversed
# - Reverse entries created with date = today
# - Stato conti verificato
```

#### Via Odoo UI (Manuale)

```
1. Login Odoo Production
2. Accounting > Journal Entries
3. Filtri:
   - Posting Date = [Data intervento]
   - State = Posted
   - Journal != Bank/Cash (solo JE di chiusura)
4. Seleziona tutte le entries create
5. Actions > Reverse Entry
6. Modal:
   - Reversal Date: [Oggi]
   - Reason: "Rollback chiusura 2024"
   - Use Specific Journal: [Stesso journal dell'entry]
7. Conferma reverse (una per volta o bulk)
8. Verifica entries reversate (stato "Reversed")
```

**Checklist Post-Reverse**:
- [ ] Tutte le JE reversate
- [ ] Reverse entries in stato Posted
- [ ] Saldi conti verificati (tornati a pre-intervento)
- [ ] Trial Balance ri-quadrato
- [ ] Nessuna entry orphan (senza reverse)

---

### Opzione 3: ROLLBACK MANUALE (Chirurgico)

**Quando usare**:
- Errore molto specifico (1-2 JE)
- Sai esattamente cosa è andato storto
- Vuoi massima precisione

**Processo**:

```
1. Identifica JE problema (ID)
2. Odoo > Accounting > Journal Entries > [Search ID]
3. Click entry
4. Button "Reverse Entry"
5. Scegli date reverse = oggi
6. Conferma
7. Verifica saldo conto interessato
```

**Checklist**:
- [ ] Entry problema identificata
- [ ] Entry reversata correttamente
- [ ] Saldo conto OK
- [ ] Nessun side-effect su altri conti

---

## PROCEDURA ROLLBACK PASSO-PASSO

### FASE 1: IDENTIFICAZIONE PROBLEMA

**STOP EXECUTION**

1. **Nota ora esatta**: `_________`
2. **Nota step in corso**: `_________`
3. **Descrivi errore**:
   ```



   ```

4. **Screenshot errore**: Salva in `rollback/screenshots/`
5. **Copia log completo**: `rollback/logs/error-TIMESTAMP.log`

---

### FASE 2: VALUTAZIONE DANNO

**Domande chiave**:

1. **Trial Balance è ancora OK?**
   ```bash
   python scripts/check-trial-balance.py
   ```
   - [ ] SI → Trial Balance quadra
   - [ ] NO → Trial Balance sbilanciato di CHF `_______`

2. **Quante JE sono state create?**
   ```bash
   python scripts/count-journal-entries.py --date today
   ```
   - [ ] Risposta: `_______` journal entries

3. **Ci sono dati cancellati?**
   - [ ] SI → Cosa: `_______________________________`
   - [ ] NO

4. **Lo stato è recuperabile?**
   - [ ] SI → Procedi Rollback Parziale
   - [ ] NO → Procedi Rollback Completo

---

### FASE 3: SCELTA METODO ROLLBACK

**Decision Tree**:

```
Dati cancellati?
  ├─ SI → ROLLBACK COMPLETO
  └─ NO
      ├─ Trial Balance OK?
      │   ├─ SI → ROLLBACK PARZIALE
      │   └─ NO → ROLLBACK COMPLETO
      └─ JE < 50?
          ├─ SI → ROLLBACK PARZIALE o MANUALE
          └─ NO → ROLLBACK COMPLETO
```

**Metodo scelto**: `_________________________`

**Motivazione**:
```


```

---

### FASE 4: ESECUZIONE ROLLBACK

#### Se ROLLBACK COMPLETO

**Tempo stimato**: 30-45 minuti

1. **Identifica backup**
   - [ ] File: `backup-pre-chiusura-2024-TIMESTAMP.zip`
   - [ ] Location: `_______________________________`
   - [ ] Timestamp: `_______________________________`
   - [ ] Verificato integro: SI / NO

2. **Restore Database**
   - [ ] Odoo Dashboard > Database Manager > Restore
   - [ ] File upload completato
   - [ ] Restore in progress... (attendi)
   - [ ] Restore completed: ORA `_______`

3. **Verifica Post-Restore**
   ```bash
   python scripts/verifica-rapida-conti-chiave.py --env production
   ```
   - [ ] Konto 1099: `_______` (= valore pre-intervento?)
   - [ ] Konto 10901: `_______`
   - [ ] Konto 1022: `_______`
   - [ ] Konto 1023: `_______`
   - [ ] Konto 1001: `_______`
   - [ ] **TUTTI I VALORI = PRE-INTERVENTO**: SI / NO

4. **Conferma Rollback OK**
   - [ ] Login Odoo funziona
   - [ ] Nessuna JE dell'intervento presente
   - [ ] Trial Balance = pre-intervento
   - [ ] **ROLLBACK COMPLETO OK** ✓

---

#### Se ROLLBACK PARZIALE

**Tempo stimato**: 10-20 minuti

1. **Lista JE da Reversare**
   ```bash
   python scripts/list-journal-entries.py --date today --env production
   ```
   - [ ] Output salvato: `rollback/entries-to-reverse.txt`
   - [ ] Numero JE: `_______`

2. **Dry-Run Reverse**
   ```bash
   python scripts/reverse-journal-entries.py --date today --dry-run
   ```
   - [ ] Preview verificata: OK / PROBLEMI
   - [ ] Impatto stimato verificato

3. **Esegui Reverse**
   ```bash
   python scripts/reverse-journal-entries.py --date today --execute
   ```
   - [ ] Script completato: OK / ERRORI
   - [ ] Reverse entries create: `_______`
   - [ ] IDs reverse entries: `_______________________________`

4. **Verifica Post-Reverse**
   ```bash
   python scripts/verifica-rapida-conti-chiave.py --env production
   ```
   - [ ] Saldi conti = pre-intervento: SI / NO
   - [ ] Trial Balance quadrato: SI / NO
   - [ ] **ROLLBACK PARZIALE OK** ✓

---

#### Se ROLLBACK MANUALE

**Tempo stimato**: 5-15 minuti

1. **Identifica JE Problema**
   - [ ] Journal Entry ID: `_______`
   - [ ] Conto impattato: `_______`
   - [ ] Importo errato: CHF `_______`

2. **Reverse via Odoo UI**
   - [ ] Entry trovata in Odoo
   - [ ] Button "Reverse Entry" cliccato
   - [ ] Reverse date: `_______`
   - [ ] Reverse reason: `_______________________________`
   - [ ] Reverse entry creata: ID `_______`

3. **Verifica Saldo Conto**
   ```bash
   python scripts/check-account-balance.py --account [CODE] --env production
   ```
   - [ ] Saldo post-reverse: CHF `_______`
   - [ ] Saldo atteso: CHF `_______`
   - [ ] **MATCH**: SI / NO

4. **Conferma Rollback OK**
   - [ ] Entry problema reversata
   - [ ] Saldo conto OK
   - [ ] Nessun side-effect
   - [ ] **ROLLBACK MANUALE OK** ✓

---

### FASE 5: POST-ROLLBACK

1. **Documentazione**
   - [ ] Salva tutti i log: `rollback/logs/`
   - [ ] Salva screenshots: `rollback/screenshots/`
   - [ ] Compila "Rollback Report": `rollback/ROLLBACK-REPORT-TIMESTAMP.md`
   - [ ] Questa checklist compilata salvata

2. **Analisi Causa Errore**

   **Cosa è andato storto?**
   ```



   ```

   **Root cause**:
   ```



   ```

   **Come prevenire in futuro?**
   ```



   ```

3. **Fix e Re-Test**
   - [ ] Bug fixato in script/processo
   - [ ] Fix testato in ambiente dev/staging
   - [ ] Staging test completamente OK
   - [ ] Staging verification document salvato
   - [ ] **READY TO RETRY PRODUCTION**: SI / NO

4. **Comunicazione**

   **Persone da informare del rollback**:
   - [ ] Contabile Senior
   - [ ] Developer team
   - [ ] CFO / Owner
   - [ ] Commercialista (se già informato dell'intervento)

   **Template Email**:
   ```
   Oggetto: Rollback Chiusura Contabile 2024 - Production

   Team,

   Vi informo che abbiamo effettuato un rollback dell'intervento di chiusura
   contabile 2024 in production.

   MOTIVO: [Descrizione errore]

   STATO ATTUALE:
   - Database restored/reversato a stato pre-intervento
   - Nessun dato perso
   - Contabilità tornata a situazione di partenza

   PROSSIMI PASSI:
   - Analisi root cause completata
   - Fix applicato e testato in staging
   - Nuovo tentativo production pianificato per: [DATA]

   Rimango a disposizione per chiarimenti.

   [Nome]
   ```

5. **Planning Retry**

   **Nuova data intervento**: `_________________________`

   **Cosa fare diversamente**:
   ```



   ```

   **Prerequisiti aggiuntivi**:
   ```



   ```

---

## SCRIPT DI ROLLBACK

### reverse-journal-entries.py

```python
#!/usr/bin/env python3
"""
Reverse journal entries create durante intervento
"""
import xmlrpc.client
import sys
from datetime import datetime

def reverse_entries(date_filter=None, move_ids=None, dry_run=True):
    # Connessione Odoo
    # ... (codice connessione)

    # Cerca entries da reversare
    domain = [('state', '=', 'posted')]
    if date_filter:
        domain.append(('date', '=', date_filter))
    if move_ids:
        domain.append(('id', 'in', move_ids))

    entries = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'search_read',
        [domain],
        {'fields': ['name', 'date', 'amount_total']}
    )

    print(f"Trovate {len(entries)} entries da reversare")

    if dry_run:
        print("DRY RUN - Nessuna modifica effettuata")
        for entry in entries:
            print(f"  - {entry['name']}: CHF {entry['amount_total']}")
        return

    # Reverse entries
    for entry in entries:
        reverse_id = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            'account.move', 'action_reverse',
            [[entry['id']]],
            {'date': datetime.now().strftime('%Y-%m-%d'),
             'reason': 'Rollback chiusura 2024'}
        )
        print(f"✓ Reversata entry {entry['name']}")

    print(f"\n{len(entries)} entries reversate con successo")

if __name__ == '__main__':
    # Parse args
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', help='Filter by date (YYYY-MM-DD)')
    parser.add_argument('--move-ids', help='Comma-separated move IDs')
    parser.add_argument('--dry-run', action='store_true', default=False)
    parser.add_argument('--execute', action='store_true', default=False)

    args = parser.parse_args()

    move_ids = None
    if args.move_ids:
        move_ids = [int(x) for x in args.move_ids.split(',')]

    dry_run = not args.execute

    reverse_entries(
        date_filter=args.date,
        move_ids=move_ids,
        dry_run=dry_run
    )
```

**Usage**:
```bash
# Dry run (preview)
python reverse-journal-entries.py --date 2025-11-16 --dry-run

# Execute
python reverse-journal-entries.py --date 2025-11-16 --execute

# Specific IDs
python reverse-journal-entries.py --move-ids "123,456,789" --execute
```

---

## ROLLBACK REPORT TEMPLATE

Dopo ogni rollback, compila questo report:

```markdown
# ROLLBACK REPORT - Chiusura Contabile 2024

**Data Rollback**: _______________
**Ora Rollback**: _______________
**Eseguito da**: _______________

## SITUAZIONE PRE-ROLLBACK

**Step raggiunto**: _______________
**Tempo esecuzione**: _______________
**JE create**: _______________

**Errore riscontrato**:
[Descrizione]

**Screenshot/Log**:
[Allegati]

## DECISIONE ROLLBACK

**Metodo scelto**: COMPLETO / PARZIALE / MANUALE
**Motivazione**: [...]

## ESECUZIONE ROLLBACK

**Azioni eseguite**:
1. [...]
2. [...]
3. [...]

**Tempo rollback**: _______________

## VERIFICA POST-ROLLBACK

**Saldi conti chiave**:
- 1099: CHF _______
- 10901: CHF _______
- 1022: CHF _______
- 1023: CHF _______
- 1001: CHF _______

**Trial Balance**: OK / PROBLEMI

**Stato finale**: TORNATO A T0 / PARZIALE

## ROOT CAUSE ANALYSIS

**Cosa è andato storto**: [...]

**Perché**: [...]

**Come prevenire**: [...]

## PROSSIMI PASSI

**Fix applicato**: [...]

**Re-test staging**: DATA _______

**Retry production**: DATA _______

## FIRMA

Rollback eseguito da: _______________
Verificato da: _______________
Approvato da: _______________
```

---

## CONTATTI EMERGENZA

**In caso di problemi durante rollback**:

| Ruolo | Nome | Tel | Email | Disponibilità |
|-------|------|-----|-------|---------------|
| Odoo Support | Odoo SA | - | support@odoo.com | 24/7 ticket |
| Developer Senior | [Nome] | [Tel] | [Email] | On-call |
| Contabile Senior | [Nome] | [Tel] | [Email] | Ore ufficio |
| Commercialista | [Nome] | [Tel] | [Email] | Appuntamento |
| System Admin | [Nome] | [Tel] | [Email] | On-call |

**Escalation Path**:
1. Developer (primo contatto)
2. Contabile Senior (se problema contabile)
3. Odoo Support (se problema tecnico Odoo)
4. System Admin (se problema infrastruttura)

---

## LESSONS LEARNED

**Dopo ogni rollback, documenta**:

1. **Cosa abbiamo imparato?**
2. **Cosa migliorare nel processo?**
3. **Quali check aggiuntivi servono?**
4. **Come evitare questo errore in futuro?**

**Template**:
```markdown
### Rollback [DATA]

**Errore**: [...]
**Lesson Learned**: [...]
**Action Item**: [...]
**Owner**: [...]
**Deadline**: [...]
```

---

## FINAL NOTES

1. **Rollback non è un fallimento** - È una misura di sicurezza intelligente
2. **Better safe than sorry** - In dubbio, rollback
3. **Documenta tutto** - Ogni rollback è una learning opportunity
4. **Test, test, test** - Staging deve catturare 99% errori PRIMA di production

---

**END OF ROLLBACK PLAN**

**Questo documento deve essere letto PRIMA di iniziare l'intervento production.**

**In caso di emergenza, seguire questo piano passo-passo.**
