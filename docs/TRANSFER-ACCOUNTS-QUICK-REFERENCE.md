# CHIUSURA KONTI TRASFERIMENTO - QUICK REFERENCE

**AGGIORNAMENTO**: 16 Novembre 2025, ore 16:30

---

## STATUS SNAPSHOT

```
┌─────────────────────────────────────────────────────────────┐
│  KONTI DI TRASFERIMENTO - STATUS CHIUSURA                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  10901  Liquiditätstransfer        CHF         0.00  [OK]   │
│  1021   Bank Suspense Account      CHF     8,363.98  [!!]   │
│  1099   Girokonti                  CHF         0.00  [OK]   │
│                                                              │
│  ────────────────────────────────────────────────────────   │
│  TOTALE RESIDUO:                   CHF     8,363.98         │
│  COMPLETAMENTO:                             66.67%          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## AZIONE RICHIESTA

### PER COMMERCIALISTA

**Verifica necessaria prima della chiusura**:

I seguenti movimenti nel konto 1021 richiedono conferma:

1. **06/03/2024** - Credit Suisse 751000
   - Movimento: CHF -132,834.54
   - Descrizione: "azzeramento 2023"
   - **Domanda**: È corretto? ✓ / ✗

2. **06/03/2024** - Credit Suisse 751000
   - Movimento: CHF -50,000.00
   - Descrizione: "azzerare 2023"
   - **Domanda**: È corretto? ✓ / ✗

**Totale da confermare**: CHF -182,834.54

Una volta confermato, procedo con chiusura automatica del saldo residuo (CHF 8,363.98) a spese straordinarie.

---

## PER PAUL/LAURA

### Dopo conferma commercialista, eseguire:

```bash
# 1. Chiudere konto 1021
cd "c:/Users/lapa/Desktop/Claude Code/app-hub-platform"
python scripts/chiudi_konto_1021.py

# 2. Verificare chiusura
python scripts/verifica_konti_1021_1099.py
```

**Risultato atteso**:
```
[OK] Konto 10901: CHF 0.00 [OK]
[OK] Konto 1021: CHF 0.00 [OK]
[OK] Konto 1099: CHF 0.00 [OK]
```

---

## RIEPILOGO MOVIMENTI

### KONTO 10901 ✅ CHIUSO

**Prima**: CHF 149,164.59
**Dopo**: CHF 0.00
**Come**: 81 riclassificazioni

Movimenti riclassificati:
- CHF 87,570 → 1001 Cash
- CHF 212,200 → Conti bancari
- CHF 6,097,590 → Operazioni FX

**Data chiusura**: 15 Nov 2025
**Move finale**: ID 97144

---

### KONTO 1021 ⚠️ DA CHIUDERE

**Saldo corrente**: CHF 8,363.98
**Movimenti totali**: 777 (su 3 anni)
**Non riconciliati**: 777

**Composizione saldo**:
- 2023: 131 mov → CHF 0.00 (bilanciato)
- 2024: 455 mov → CHF -154,058.18
- 2025: 191 mov → CHF +162,422.16
- **Residuo**: CHF +8,363.98

**Metodo chiusura proposto**:
- DARE 8399 (Extraordinary Expenses): CHF 8,363.98
- AVERE 1021 (Bank Suspense): CHF 8,363.98

**Rationale**: Saldo piccolo su centinaia di transazioni eterogenee (write-offs, FX, duplicati). Più efficiente chiudere che riconciliare singolarmente.

---

### KONTO 1099 ✅ CHIUSO

**Saldo**: CHF 0.00
**Movimenti**: 8 (tutti rettifiche 2023)
**Data chiusura**: 31 Dic 2024
**Come**: Trasferimento a Patrimonio Netto
**Move finale**: ID 97040, CHF 60,842.41

---

## WORKFLOW CHIUSURA 1021

```
┌──────────────────────┐
│ Commercialista       │
│ conferma movimenti   │
│ azzeramento 2023     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Esegui script:       │
│ chiudi_konto_1021.py │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Script crea move:    │
│ DARE 8399 CHF 8,364  │
│ AVERE 1021 CHF 8,364 │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Verifica:            │
│ 1021 = CHF 0.00      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ ✅ COMPLETATO        │
│ Tutti konti a zero   │
└──────────────────────┘
```

---

## FILES CHIAVE

**Da leggere**:
- `TRANSFER-ACCOUNTS-CLOSURE-EXECUTIVE-SUMMARY.md` - Analisi completa
- `TRANSFER-ACCOUNTS-CLOSURE-REPORT.json` - Dati tecnici

**Da eseguire**:
- `scripts/chiudi_konto_1021.py` - Chiusura automatica 1021

**Da verificare dopo**:
- `scripts/verifica_konti_1021_1099.py` - Verifica finale

---

## DOMANDE FREQUENTI

**Q: Perché non riconcilio i 777 movimenti uno per uno?**
A: Saldo residuo piccolo (CHF 8.4k) su transazioni molto eterogenee in 3 anni. Tempo richiesto: giorni. Beneficio: marginale. Chiusura a spese straordinarie è più efficiente.

**Q: È sicuro chiudere a spese straordinarie?**
A: Sì. È pratica contabile standard per saldi residui piccoli in conti temporanei/sospeso. Il conto 8399 è specificamente per questo.

**Q: Cosa succede ai movimenti dopo la chiusura?**
A: Rimangono nel konto 1021 ma il saldo va a zero. Storico conservato per audit.

**Q: Devo chiudere anche in production?**
A: Sì, ma DOPO aver testato in staging e ottenuto OK finale dal commercialista.

**Q: Cosa faccio se lo script fallisce?**
A: Lo script ha controlli di sicurezza. Chiede conferma prima di eseguire. Se fallisce, ferma e segnala errore. Nessun danno ai dati.

---

## TIMELINE STIMATA

| Step | Azione | Tempo | Responsabile |
|------|--------|-------|--------------|
| 1 | Commercialista verifica movimenti | 15 min | Commercialista |
| 2 | Esecuzione script chiusura | 5 min | Paul/Laura |
| 3 | Verifica finale | 10 min | Paul/Laura |
| **TOTALE** | **Chiusura completa** | **30 min** | **Team** |

---

## CONTATTI EMERGENZA

**Problema tecnico script**: Ricontattare Claude Agent
**Dubbio contabile**: Commercialista
**Accesso Odoo**: Paul (paul@lapa.ch)

---

**Ultimo aggiornamento**: 16 Nov 2025, 16:30
**Prossima revisione**: Dopo conferma commercialista
