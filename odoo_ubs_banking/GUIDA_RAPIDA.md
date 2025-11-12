# GUIDA RAPIDA - Importazione Movimenti Bancari UBS

## Sistema completato e testato!

La connessione a Odoo funziona correttamente. Ho trovato i tuoi giornali bancari UBS:

- **[9] UBS CHF 701J** - Giornale principale CHF
- **[11] UBS EUR 08760A** - Giornale EUR

## Come usare il sistema

### 1. Esporta CSV dalla UBS

1. Entra in UBS e-banking
2. Vai su "Accounts and Cards" → "Overview"
3. Seleziona il conto UBS (701J o 08760A)
4. Click "Transactions"
5. Click icona Excel/CSV
6. Scarica il file (es. `movimenti_ubs.csv`)

### 2. Testa la connessione (PRIMA VOLTA)

```bash
cd "C:\Users\lapa\OneDrive\Desktop\Claude Code\odoo_ubs_banking"
python test_quick.py
```

Deve mostrare:
```
[OK] Connesso come UID 7
Trovati 22 giornali
>>> UBS >>> [  9] UBS CHF 701J
>>> UBS >>> [ 11] UBS EUR 08760A
```

### 3. Simula importazione (CONSIGLIATO)

```bash
python ubs_csv_importer.py movimenti_ubs.csv
```

Questo:
- Legge il CSV
- Mostra anteprima movimenti
- NON salva nulla in Odoo

### 4. Importa realmente

```bash
python ubs_csv_importer.py movimenti_ubs.csv --save
```

Questo:
- Importa i movimenti in Odoo
- Li trovi in: Contabilità → Riconciliazione bancaria

## File creati

```
odoo_ubs_banking/
├── config.py                 # Credenziali Odoo (GIÀ CONFIGURATO)
├── odoo_connector.py         # Connessione Odoo
├── ubs_csv_importer.py       # Importatore CSV → Odoo
├── test_quick.py             # Test veloce connessione
├── esempio_ubs.csv           # File CSV esempio per test
├── GUIDA_RAPIDA.md           # Questa guida
└── README.md                 # Documentazione completa
```

## Esempio CSV

Ho creato `esempio_ubs.csv` con 5 movimenti di test.

Per testare:
```bash
python ubs_csv_importer.py esempio_ubs.csv --save
```

## Verifica in Odoo

1. Apri Odoo: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
2. Vai in **Contabilità**
3. Click **Riconciliazione bancaria**
4. Seleziona **UBS CHF 701J**
5. Vedi i movimenti importati

## Problemi?

### Errore connessione
```bash
python test_quick.py
```
Se non funziona, verifica credenziali in `config.py`

### CSV non valido
Assicurati che il CSV sia esportato da UBS con:
- Separatore: punto e virgola (;)
- Colonne: Buchungsdatum, Valuta, Belastung, Gutschrift

### Emoji/encoding
Gli script funzionano anche senza emoji. Usa `test_quick.py` invece di `test_connection.py`.

## Prossimi passi

1. **Prova con CSV reale UBS** - Esporta movimenti e importali
2. **Riconciliazione** - In Odoo, riconcilia movimenti con fatture
3. **Automatizza** - Crea task schedulato per import automatico
4. **Crea APP Odoo** - Interfaccia web per upload CSV

## Note tecniche

- **Connessione testata**: UID 7
- **Giornale default**: UBS CHF 701J (ID 9)
- **Formato date**: DD.MM.YYYY → YYYY-MM-DD
- **Formato importi**: 1'234,56 → 1234.56
- **Encoding**: UTF-8 e Windows-1252 supportati

---

**Sistema pronto all'uso!**

Per domande, vedi [README.md](README.md) completo.
