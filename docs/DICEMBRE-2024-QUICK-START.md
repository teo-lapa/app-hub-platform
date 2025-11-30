# DICEMBRE 2024 - QUICK START

**Per chi ha fretta**: Comandi pronti da eseguire

---

## LEGGI PRIMA (2 minuti)

**Problema**: Dicembre 2024 ha differenze di CHF 415K tra Odoo e banca
**Causa principale**: Movimento errato di CHF 132,834 su konto 1026
**Soluzione**: Eliminare movimento + investigare altre differenze

**Saldi al 31/12/2024**:
- Konto 1024 UBS CHF: ODOO 133K vs BANCA 182K (**mancano 48K**)
- Konto 1025 UBS EUR: ODOO 108K vs BANCA 128K (**mancano 20K EUR**)
- Konto 1026 Credit Suisse: ODOO 371K vs BANCA 25K (**eccesso 346K**)

---

## SETUP (1 volta)

```bash
# Vai nella directory del progetto
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"

# Verifica variabili ambiente
cat .env.local | grep ODOO

# Dovresti vedere:
# ODOO_URL=https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
# ODOO_DB=lapadevadmin-lapa-v2-main-7268478
# ODOO_ADMIN_EMAIL=apphubplatform@lapa.ch
# ODOO_ADMIN_PASSWORD=apphubplatform2025
```

---

## COMANDI ANALISI (Read-Only, sicuri)

### 1. Analisi completa dicembre 2024
```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
set -a && source .env.local && set +a
python scripts/analizza-dicembre-2024-dettaglio.py
```

**Output**:
- `REPORT-DICEMBRE-2024.json` (354 KB, 605 righe)
- Stampa console con saldi e differenze

**Tempo**: ~30 secondi

---

### 2. Trova duplicati konto 1026
```bash
python scripts/trova-duplicati-1026.py
```

**Output**:
- `DUPLICATI-1026-ANALISI.json`
- `scripts/elimina-duplicati-1026.py` (auto-generato)

**Risultato**: Solo 4 duplicati trovati (CHF 5,301)

**Tempo**: ~20 secondi

---

### 3. Analisi saldo apertura konto 1026
```bash
python scripts/analizza-saldo-apertura-1026.py
```

**Output**: Stampa console con:
- Evoluzione mensile saldo 2024
- Movimenti > CHF 50,000
- **Identificazione problema: movimento 03/06/2024**

**Tempo**: ~25 secondi

---

### 4. Dettaglio movimento errato
```bash
python scripts/dettaglio-movimento-azzeramento.py
```

**Output**:
- `MOVIMENTO-AZZERAMENTO-2023.json`
- Stampa dettagli move_id 58103

**Tempo**: ~10 secondi

---

## COMANDI CORREZIONE (ATTENZIONE!)

### CRITICO: Elimina movimento errato

**PRIMA DI ESEGUIRE**:
1. Approvazione commercialista
2. Backup database Odoo
3. Verifica move_id 58103 e corretto

```bash
python scripts/elimina-movimento-azzeramento-1026.py
```

**Conferme richieste**:
1. Digita: `ELIMINA`
2. Digita: `SI CONFERMO`

**Impatto**:
- Elimina move_id 58103 (BNK3/2024/00867)
- Corregge saldo konto 1026 di -CHF 132,834.54
- Saldo passa da CHF 371,454 a CHF 238,619
- **Non reversibile!**

**Tempo**: ~15 secondi

---

### Elimina duplicati (opzionale)

Solo 4 righe duplicate (CHF 5,301), impatto minore.

```bash
python scripts/elimina-duplicati-1026.py
```

**Conferma richiesta**: `SI`

**Tempo**: ~10 secondi

---

## WORKFLOW CONSIGLIATO

### Oggi (30 minuti)
```bash
# 1. Analisi completa
python scripts/analizza-dicembre-2024-dettaglio.py

# 2. Leggi executive summary
cat DICEMBRE-2024-EXECUTIVE-SUMMARY.md

# 3. Verifica movimento errato
python scripts/dettaglio-movimento-azzeramento.py

# 4. Ottieni approvazione commercialista via email/chiamata
# (invia DICEMBRE-2024-EXECUTIVE-SUMMARY.md)

# 5. Backup database (via Odoo UI o script)

# 6. Elimina movimento errato
python scripts/elimina-movimento-azzeramento-1026.py

# 7. Verifica nuovo saldo
python scripts/analizza-dicembre-2024-dettaglio.py
```

### Questa settimana (2-3 ore)
```bash
# 1. Investigare rettifica apertura gennaio
# TODO: Script da creare

# 2. Estrarre CSV dicembre UBS
# Vai su: https://ubs.com (download CSV dicembre 2024)

# 3. Confrontare con Odoo
# TODO: Script da creare

# 4. Importare movimenti mancanti
# TODO: Script da creare
```

### Questo mese (1 settimana)
```bash
# 1. Dashboard riconciliazione
# TODO: Implementare in app-hub-platform

# 2. Training team
# TODO: Documentare processo

# 3. Audit 2024 completo
# TODO: Script per tutti i konti
```

---

## FILE DA LEGGERE (Ordine consigliato)

1. **DICEMBRE-2024-EXECUTIVE-SUMMARY.md** (5 min)
   - Overview, saldi, problema, azioni

2. **INDEX-DICEMBRE-2024.md** (3 min)
   - Navigazione veloce, quick reference

3. **REPORT-DICEMBRE-2024.md** (15 min)
   - Analisi dettagliata tecnica

4. **REPORT-DICEMBRE-2024.json** (consulta al bisogno)
   - Dettaglio 605 righe per audit/verifica

---

## FAQ

**Q: E sicuro eseguire gli script di analisi?**
A: Si, sono read-only. Non modificano nulla in Odoo.

**Q: Cosa succede se elimino il movimento errato?**
A: Il saldo konto 1026 diminuisce di CHF 132,834.54. L'operazione non e reversibile.

**Q: Rimane ancora differenza dopo eliminazione?**
A: Si, rimangono CHF 213K di differenza da investigare (rettifiche apertura + movimenti feb-apr).

**Q: Devo eliminare anche i duplicati?**
A: Opzionale. Sono solo CHF 5,301 (impatto minore). Puoi farlo dopo.

**Q: Come faccio backup Odoo?**
A: Vai su Odoo > Settings > Database Manager > Backup (chiedi admin Odoo)

**Q: Gli script funzionano anche per altri mesi?**
A: Si, `analizza-dicembre-2024-dettaglio.py` puo essere modificato cambiando le date.

**Q: Posso eseguire da Windows/Mac/Linux?**
A: Si, Python funziona su tutti i sistemi. Adatta i path se necessario.

---

## TROUBLESHOOTING

### Errore: "ODOO_PASSWORD mancante"
```bash
# Verifica .env.local
cat .env.local | grep ODOO_ADMIN_PASSWORD

# Se mancante, aggiungi:
echo 'ODOO_ADMIN_PASSWORD=apphubplatform2025' >> .env.local
```

### Errore: "Autenticazione fallita"
```bash
# Verifica credenziali
echo $ODOO_ADMIN_EMAIL
echo $ODOO_ADMIN_PASSWORD

# Prova login manuale su Odoo web UI
```

### Errore: "Move non trovato"
```bash
# Verifica move_id esiste
python -c "
import xmlrpc.client
models = xmlrpc.client.ServerProxy('...')
# ... codice verifica
"
```

### Script troppo lento
```bash
# Connessione lenta? Usa timeout maggiore
# Modifica script: timeout=600 (10 minuti)
```

---

## CONTATTI EMERGENZA

**Problemi script**: Backend Specialist
**Approvazioni contabili**: Commercialista
**Accesso Odoo**: Admin IT
**Backup database**: DevOps

---

**Ultimo aggiornamento**: 16 Novembre 2025
**Versione**: 1.0
**Status**: READY TO EXECUTE
