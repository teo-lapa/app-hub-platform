# OTTOBRE 2024 - Quick Start Guide

**Per chi ha fretta** - Tutti i comandi e file essenziali in una pagina.

---

## 🚀 Quick Access Files

```bash
# Report Executive (5 min read)
VERIFICA-OTTOBRE-2024-RIEPILOGO.md

# Excel per analisi visuale
REPORT-OTTOBRE-2024.xlsx

# JSON per analisi programmatica
REPORT-OTTOBRE-2024.json

# Index completo con spiegazioni
OTTOBRE-2024-INDEX.md
```

---

## 📊 Numeri Chiave (TL;DR)

| Metrica | Valore |
|---------|--------|
| **Periodo** | 01-31 Ottobre 2024 |
| **Konti analizzati** | 3 (1024, 1025, 1026) |
| **Movimenti totali** | 613 |
| **Differenze trovate** | 0.00 (ZERO) ✅ |
| **Status** | TUTTO QUADRA |

**Saldi finali 31/10/2024**:
- UBS CHF (1024): CHF 64,756.50
- UBS EUR (1025): EUR 91,704.46
- Credit Suisse (1026): CHF 357,335.35

---

## ⚡ Comandi Rapidi

### Rigenera Report Completo
```bash
# 1. Analisi Odoo + JSON
python scripts/verifica-ottobre-2024-odoo.py

# 2. Excel formattato
python scripts/crea-excel-ottobre-2024.py

# Entrambi in sequenza
python scripts/verifica-ottobre-2024-odoo.py && python scripts/crea-excel-ottobre-2024.py
```

### Analisi Avanzata
```bash
# Output su console
python scripts/analizza-transazioni-ottobre.py

# Salva in file
python scripts/analizza-transazioni-ottobre.py > analisi-dettagliata.txt
```

---

## 📂 Struttura File

```
app-hub-platform/
├── OTTOBRE-2024-INDEX.md                    ← Index completo
├── OTTOBRE-2024-QUICK-START.md              ← Questa guida
├── VERIFICA-OTTOBRE-2024-RIEPILOGO.md       ← Executive summary
├── REPORT-OTTOBRE-2024.json                 ← Dati raw JSON
├── REPORT-OTTOBRE-2024.xlsx                 ← Excel 5 sheets
│
└── scripts/
    ├── verifica-ottobre-2024-odoo.py        ← Estrazione Odoo
    ├── crea-excel-ottobre-2024.py           ← Generazione Excel
    └── analizza-transazioni-ottobre.py      ← Analisi avanzata
```

---

## 🔍 Trova Informazioni Velocemente

### Saldo di un konto specifico?
```bash
# Nel JSON
grep -A5 '"1024"' REPORT-OTTOBRE-2024.json | grep balance

# Nel Markdown
grep "Saldo al 31/10" VERIFICA-OTTOBRE-2024-RIEPILOGO.md
```

### Transazioni di un giorno specifico?
```bash
# Esempio: 15 ottobre
grep "2024-10-15" REPORT-OTTOBRE-2024.json
```

### Movimenti di un partner?
```bash
# Esempio: ALIGRO
grep -i "aligro" REPORT-OTTOBRE-2024.json
```

---

## 📈 Excel Quick Tips

### Sheet Summary
- **Usala per**: Panoramica rapida tutti i konti
- **Filtri utili**: Status, Num Movimenti
- **Pivot**: Somma variazioni per valuta

### Sheet 1024/1025/1026
- **Usala per**: Dettaglio transazioni
- **Filtri utili**: Partner, Data, Importo >1000
- **Ordinamenti**: Per data, per importo

### Sheet Daily-Analysis
- **Usala per**: Pattern temporali
- **Grafici**: Linee per visualizzare andamento giornaliero
- **Pivot**: Somma per giorno della settimana

---

## 🔧 Setup Ambiente (Prima Esecuzione)

```bash
# 1. Installa dipendenze
pip install python-dotenv pandas xlsxwriter openpyxl

# 2. Configura .env.local
# Assicurati che contenga:
ODOO_URL=https://...
ODOO_DB=...
ODOO_ADMIN_EMAIL=...
ODOO_ADMIN_PASSWORD=...

# 3. Test connessione
python -c "from dotenv import load_dotenv; load_dotenv('.env.local'); import os; print(os.getenv('ODOO_URL'))"

# 4. Esegui primo report
python scripts/verifica-ottobre-2024-odoo.py
```

---

## ❓ FAQ

### Q: Quanto tempo ci vuole?
**A**: Script Odoo ~30s, Excel ~5s. Totale <1 minuto.

### Q: Posso analizzare un altro mese?
**A**: Sì, modifica `START_DATE` e `END_DATE` negli script.

### Q: I dati sono sicuri?
**A**: Gli script leggono solo da Odoo, non modificano nulla.

### Q: Serve connessione Odoo?
**A**: Solo per `verifica-ottobre-2024-odoo.py`. Gli altri script usano il JSON già generato.

### Q: Posso automatizzare?
**A**: Sì, esempio cronjob:
```bash
# Ogni 1° del mese alle 8:00
0 8 1 * * cd /path && python scripts/verifica-ottobre-2024-odoo.py && python scripts/crea-excel-ottobre-2024.py
```

---

## 🎯 Checklist Post-Analisi

- [ ] Aprire Excel e verificare totali sheet Summary
- [ ] Controllare che Status = "OK" per tutti i konti
- [ ] Confrontare saldi con estratti conto bancari (se disponibili)
- [ ] Condividere Excel con commercialista
- [ ] Archiviare JSON come backup
- [ ] Aggiornare dashboard/report mensili

---

## 🚨 Troubleshooting

### Errore: "ODOO_PASSWORD not found"
```bash
# Verifica .env.local
cat .env.local | grep ODOO

# Se manca, aggiungila:
echo 'ODOO_ADMIN_PASSWORD=your_password' >> .env.local
```

### Errore: "Account not found"
```bash
# Verifica che i konti esistano in Odoo:
# 1024, 1025, 1026

# Se diversi, modifica KONTI dict negli script
```

### Excel non si apre
```bash
# Reinstalla xlsxwriter
pip install --upgrade xlsxwriter

# Oppure usa LibreOffice invece di Excel
```

---

## 📞 Supporto Rapido

**Problema**: Script non trova file JSON
**Soluzione**: Esegui prima `verifica-ottobre-2024-odoo.py`

**Problema**: Differenze >0.00 trovate
**Soluzione**: Verifica che tutti i movimenti siano confermati (posted) in Odoo

**Problema**: Troppi movimenti / timeout
**Soluzione**: Aggiungi `limit` parameter nella query Odoo

---

## 📚 Prossimi Step Suggeriti

1. **Ora**: Leggi `VERIFICA-OTTOBRE-2024-RIEPILOGO.md` (5 min)
2. **Poi**: Apri `REPORT-OTTOBRE-2024.xlsx` e esplora i dati
3. **Infine**: Condividi con stakeholders

Per dettagli completi: `OTTOBRE-2024-INDEX.md`

---

**Creato**: 16 Novembre 2025
**Valido per**: Ottobre 2024
**Ultima verifica**: ✅ Tutti i konti quadrano
