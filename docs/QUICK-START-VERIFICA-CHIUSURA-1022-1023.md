# QUICK START - Verifica Chiusura Konto 1022 e 1023

**Per:** Commercialista Lapa
**Data:** 16 Novembre 2025
**Environment:** STAGING (test sicuro)

---

## IN 30 SECONDI

Entrambi i konti Outstanding sono stati **azzerati a CHF 0.00** con registrazioni al 31.12.2024.

**Verifica rapida:**
1. Konto 1022 Outstanding Receipts → CHF 0.00 ✓
2. Konto 1023 Outstanding Payments → CHF 0.00 ✓
3. Move SLR/2024/12/0013 (chiusura 1022) → POSTED ✓
4. Move SLR/2024/12/0014 (chiusura 1023) → POSTED ✓

---

## COME VERIFICARE IN ODOO (2 minuti)

### Step 1: Accedi a Odoo Staging

**URL:** https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
**User:** paul@lapa.ch
**Password:** lapa201180

### Step 2: Controlla Piano dei Conti

1. Vai a **Contabilità** → **Configurazione** → **Piano dei Conti**

2. Cerca konto **1022**:
   - Saldo attuale deve essere **CHF 0.00**

3. Cerca konto **1023**:
   - Saldo attuale deve essere **CHF 0.00**

4. Cerca konto **3900** (Differences):
   - Saldo attuale: **CHF -40,110.21** (normale, ha assorbito le differenze)

### Step 3: Verifica Registrazioni

1. Vai a **Contabilità** → **Contabilità** → **Registrazioni**

2. Filtra per data **31/12/2024**

3. Cerca questi due move:
   - **SLR/2024/12/0013** (CHIUSURA-1022-STAGING-2024)
   - **SLR/2024/12/0014** (CHIUSURA-1023-STAGING-2024)

4. Clicca su ciascuno e verifica:
   - Stato: **Registrato** (posted)
   - Dare = Avere (quadrato)

---

## VERIFICA AUTOMATICA (10 secondi)

Se hai Python installato:

```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/verifica-chiusura-1022-1023.py
```

**Output atteso:**
```
[SUCCESS] Tutti i check PASSED!

1. Konto 1022: CHF 0.00
2. Konto 1023: CHF 0.00
3. Move 97148: POSTED
4. Move 97149: POSTED

[OK] Chiusura completata correttamente!
```

---

## DETTAGLI REGISTRAZIONI

### Move 1: Chiusura Konto 1022 (ID 97148)

**Data:** 31/12/2024
**Numero:** SLR/2024/12/0013
**Ref:** CHIUSURA-1022-STAGING-2024

| Account | Descrizione | Dare | Avere |
|---------|-------------|------|-------|
| 3900 | Differences | CHF 366,046.52 | - |
| 1022 | Outstanding Receipts | - | CHF 366,046.52 |

**Logica:** Chiusura saldo dare su 1022 imputando differenza a 3900

---

### Move 2: Chiusura Konto 1023 (ID 97149)

**Data:** 31/12/2024
**Numero:** SLR/2024/12/0014
**Ref:** CHIUSURA-1023-STAGING-2024

| Account | Descrizione | Dare | Avere |
|---------|-------------|------|-------|
| 1023 | Outstanding Payments | CHF 893,092.68 | - |
| 3900 | Differences | - | CHF 893,092.68 |

**Logica:** Chiusura saldo avere su 1023 imputando differenza a 3900

---

## DOMANDE FREQUENTI

### Q: Perché i saldi iniziali erano diversi dall'atteso?

**A:** C'erano stati tentativi precedenti errati che avevano raddoppiato i saldi invece di azzerarli. Quei move sono stati cancellati e rifatti correttamente.

### Q: Cosa rappresenta il saldo CHF -40,110.21 su konto 3900?

**A:** E' la differenza netta tra Outstanding Receipts (CHF 366k) e Outstanding Payments (CHF 893k):

```
893,092.68 - 366,046.52 = 527,046.16
```

Questo delta è stato imputato al konto 3900 Differences, che aveva già un saldo pre-esistente di CHF 486,935.95.

Saldo finale 3900: 486,935.95 - 527,046.16 = **-40,110.21 CHF**

### Q: Queste registrazioni vanno nel bilancio 2024?

**A:** Sì, sono datate 31/12/2024 e rappresentano la regolarizzazione finale degli Outstanding per l'anno 2024.

### Q: Posso cancellare questi move se necessario?

**A:** In staging sì, ma in production sarebbe necessario fare un reversal (storno) invece di una cancellazione diretta. Meglio verificare prima con noi.

### Q: E se devo fare modifiche?

**A:** Contatta il team tecnico. Questo è staging, possiamo sperimentare liberamente senza impatto su production.

---

## COSA CONTROLLARE

### Checklist Pre-Approvazione

- [ ] Konto 1022 = CHF 0.00
- [ ] Konto 1023 = CHF 0.00
- [ ] Move SLR/2024/12/0013 posted correttamente
- [ ] Move SLR/2024/12/0014 posted correttamente
- [ ] Saldo konto 3900 coerente con differenze
- [ ] Data registrazioni = 31/12/2024
- [ ] Dare = Avere in entrambi i move

### Se tutto OK

Invia approvazione per replicare in PRODUCTION (se necessario).

### Se qualcosa non va

Contatta team tecnico con:
1. Screenshot saldi konti
2. Numero move che risulta problematico
3. Descrizione anomalia

---

## FILE DI RIFERIMENTO

**Report Completo:**
```
c:\Users\lapa\Desktop\Claude Code\app-hub-platform\CHIUSURA-KONTO-1022-1023-REPORT-FINALE.md
```

**Script Chiusura:**
```
c:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts\chiusura-definitiva-1022-1023.py
```

**Script Verifica:**
```
c:\Users\lapa\Desktop\Claude Code\app-hub-platform\scripts\verifica-chiusura-1022-1023.py
```

---

## CONTATTI

**Per domande tecniche:** Team Development Lapa
**Per domande contabili:** Commercialista di riferimento
**Environment:** STAGING (nessun rischio per production)

---

**Documento creato:** 16 Novembre 2025
**Versione:** 1.0
**Status:** Ready for Review
