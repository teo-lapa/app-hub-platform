# INDEX - RICONCILIAZIONE IVA 2024

Tutti i file generati dall'analisi IVA 2024 completa.

---

## START HERE

**Per iniziare subito:** Leggi questi 2 file nell'ordine:

1. **IVA-2024-EXECUTIVE-SUMMARY.md** (1 pagina)
   - Riepilogo generale
   - Numeri chiave
   - Azioni immediate

2. **QUICK-ACTIONS-IVA-2024.md** (guida pratica)
   - Cosa fare passo-passo
   - Come correggere errori
   - Checklist finale

---

## FILE PRINCIPALI

### 1. Report Excel (DA APRIRE SUBITO!)
```
RICONCILIAZIONE-IVA-2024.xlsx (510 KB)
```
**Fogli:**
- Riepilogo Generale
- IVA Vendite Mensile
- IVA Acquisti Mensile
- Quadratura Trimestrale
- **ERRORI IVA** (5,314 righe - IMPORTANTE!)
- Dettaglio Vendite (3,857 movimenti)
- Dettaglio Acquisti (3,104 movimenti)

### 2. Dati JSON
```
riconciliazione-iva-2024.json (1.4 MB)
```
Dati completi in formato JSON per analisi ulteriori.

---

## DOCUMENTAZIONE

### Executive Reports (Leggere prima)

1. **IVA-2024-EXECUTIVE-SUMMARY.md**
   - 1 pagina riepilogo
   - Quadratura generale
   - Top 3 problemi
   - Next steps

2. **README-RICONCILIAZIONE-IVA-2024.md**
   - Report completo dettagliato
   - Analisi mensile
   - Breakdown per trimestre
   - Spiegazione errori

### Guide Pratiche

3. **QUICK-ACTIONS-IVA-2024.md**
   - Top 3 problemi da risolvere
   - Come trovare movimenti in Odoo
   - SQL queries utili
   - Checklist finale

4. **ERRORI-CRITICI-IVA-2024.md**
   - Analisi 155 errori critici
   - Pattern identificati
   - Azioni correttive
   - Script Python per correzione

---

## SCRIPT PYTHON

### Script principale
```bash
python scripts/riconciliazione-iva-2024.py
```

**Cosa fa:**
1. Estrae IVA vendite da conti 2200-2299
2. Estrae IVA acquisti da conti 1170-1179
3. Calcola quadratura mensile e trimestrale
4. Identifica 5,314 errori
5. Genera Excel e JSON

**Quando eseguirlo:**
- Dopo ogni correzione in Odoo
- Per verificare progressi
- Prima della dichiarazione IVA finale

---

## NUMERI CHIAVE

| Metrica | Valore |
|---------|--------|
| Movimenti analizzati | 6,961 |
| IVA Vendite 2024 | CHF 141,495.28 |
| IVA Acquisti 2024 | CHF 165,492.98 |
| **Saldo IVA** | **CHF -23,997.70** |
| **Stato** | **A CREDITO** |
| Errori totali | 5,314 |
| Errori critici | **155** |

---

## ROADMAP CORREZIONI

### Settimana 1 (QUESTA SETTIMANA)
- [ ] Correggere 155 errori critici
  - [ ] Versamenti ESTV (~10 movimenti)
  - [ ] Contributi Reservesuisse (~130 movimenti)
  - [ ] Errori manuali (~15 movimenti)
- [ ] Verificare Febbraio 2024 (IVA vendite negativa)
- [ ] Verificare Dicembre 2024 (acquisti doppi)

### Settimana 2
- [ ] Ricalcolare dopo correzioni
- [ ] Verificare che errori critici = 0
- [ ] Controllare i 63 possibili duplicati
- [ ] Confrontare con dichiarazioni IVA trimestrali

### Settimana 3
- [ ] Preparare dichiarazione IVA annuale
- [ ] Decidere su rimborso credito CHF 23,997.70
- [ ] Chiusura IVA 2024

---

## STRUTTURA FILE

```
app-hub-platform/
|
|-- RICONCILIAZIONE-IVA-2024.xlsx          # EXCEL PRINCIPALE
|-- riconciliazione-iva-2024.json          # Dati JSON
|
|-- INDEX-RICONCILIAZIONE-IVA-2024.md      # Questo file
|-- IVA-2024-EXECUTIVE-SUMMARY.md          # 1-pager
|-- README-RICONCILIAZIONE-IVA-2024.md     # Report completo
|-- QUICK-ACTIONS-IVA-2024.md              # Guida pratica
|-- ERRORI-CRITICI-IVA-2024.md             # Analisi errori
|
|-- scripts/
    |-- riconciliazione-iva-2024.py        # Script Python
```

---

## CONNESSIONE ODOO

```
URL:      https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
Database: lapadevadmin-lapa-v2-staging-2406-25408900
User:     paul@lapa.ch
Password: lapa201180
```

**Per trovare un movimento:**
1. Vai in: Contabilita > Voci di Giornale
2. Cerca per Move ID (es. 72921)
3. Apri e modifica

---

## ERRORI COMUNI

### "Perche IVA vendite febbraio e negativa?"
- Note di credito molto alte
- Verificare se sono reali o errori di data
- Vedi foglio Excel "Dettaglio Vendite" filtrato per 2024-02

### "Perche dicembre ha acquisti cosi alti?"
- Acquisti straordinari (macchinari?)
- Fatture duplicate?
- Fatture gennaio 2025 in dicembre 2024?
- Verificare top 10 acquisti dicembre

### "Cosa sono le aliquote 8.09%, 8.10%?"
- Formula IVA imprecisa (arrotondamenti)
- NON critico, solo imprecisioni di calcolo
- Le aliquote svizzere sono: 7.7%, 2.5%, 3.7%

### "Perche 155 errori critici?"
- Versamenti IVA registrati come fatture IVA
- Contributi Reservesuisse con IVA (errore!)
- Movimenti manuali incompleti
- **DA CORREGGERE SUBITO**

---

## FAQ

**Q: Posso chiudere la contabilita 2024 cosi?**
A: NO! Prima devi correggere i 155 errori critici.

**Q: Come faccio a correggere gli errori?**
A: Vedi QUICK-ACTIONS-IVA-2024.md, sezione "Top 3 problemi"

**Q: Quanto tempo ci vuole?**
A: ~2-3 giorni per correggere tutti i 155 errori

**Q: Posso automatizzare le correzioni?**
A: Sconsigliato. Meglio correggere manualmente per sicurezza.

**Q: Cosa faccio con il credito IVA di CHF 23,997?**
A: Puoi:
  1. Richiedere rimborso all'ESTV
  2. Compensare con trimestri futuri 2025
  3. Chiedere al commercialista

**Q: I totali sono corretti?**
A: Dopo correzioni bisogna ricalcolare. Totali attuali includono errori.

---

## SUPPORTO

**Per domande tecniche:**
- Riesegui: `python scripts/riconciliazione-iva-2024.py`
- Controlla Excel foglio "ERRORI IVA"

**Per correzioni contabili:**
- Apri Odoo
- Trova movimento per Move ID
- Modifica e salva

**Per consulenza:**
- Contatta commercialista
- Mostra IVA-2024-EXECUTIVE-SUMMARY.md

---

**GENERATO DA:** Claude Code - Data Analyst
**DATA ANALISI:** 2024-11-16
**VERSIONE:** 1.0
**PROSSIMO UPDATE:** Dopo correzioni errori critici
