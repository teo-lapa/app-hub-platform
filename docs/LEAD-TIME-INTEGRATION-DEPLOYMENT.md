# Lead Time Integration - Deployment & Rollback Guide

## 📋 Cosa è stato deployato

**Branch**: `staging`
**Commit**: `ea8e711`
**Data**: 2025-11-21
**Ambiente**: Staging (https://app-hub-platform-staging.vercel.app)

### Modifiche implementate

1. **Smart Ordering API** - Query `product.supplierinfo` per lead time REALE
2. **Supplier Sync** - Calcola lead time da campo `delay` invece di frequenza ordini
3. **Coverage Days** - Calcolo dinamico: `leadTime + buffer` (non più fisso)
4. **Prediction Engine** - Usa lead time reale nei calcoli

---

## 🧪 Come Testare su Staging

### 1. Test Smart Ordering con Lead Time Reali

**URL**: https://app-hub-platform-staging.vercel.app/smart-ordering-v2

**Cosa controllare**:
- Apri Developer Console (F12)
- Cerca nel log: `🚚 Caricamento lead time reali da product.supplierinfo...`
- Verifica che il log mostri: `✅ Lead time reali caricati per X templates da Odoo`
- Controlla che i fornitori abbiano lead time DIVERSI (non più tutti 3 giorni)

**Esempio log atteso**:
```
🚚 Caricamento lead time reali da product.supplierinfo...
✅ Lead time reali caricati per 250 templates da Odoo
📊 Prodotto X (Nome): Stock 10 + In arrivo 5 = 15
✅ [SUPPLIER SYNC] Fornitore ABC: Cadenza 7gg, Lead time 14gg (12 ordini)
```

### 2. Verifica Lead Time nei Suggerimenti Ordini

**Controlla una card fornitore**:
- Lead time dovrebbe essere SPECIFICO del fornitore (non generico)
- Coverage days dovrebbe essere VARIABILE:
  - CRITICAL: leadTime + 2 giorni
  - HIGH: leadTime + 4 giorni
  - MEDIUM: leadTime + 7 giorni

**Esempio**:
```
Fornitore: LATTICINI MOLISANI
Lead Time: 7 giorni (da Odoo)
Prodotto CRITICAL: Coverage 9 giorni (7 lead + 2 buffer)
Prodotto MEDIUM: Coverage 14 giorni (7 lead + 7 buffer)
```

### 3. Test con Fornitori Specifici

**Fornitori da testare** (con lead time diversi):

1. **Fornitore con lead time CORTO (1-2 giorni)**:
   - Verifica coverage days ridotti
   - Es: CRITICAL = 3gg (1 lead + 2 buffer)

2. **Fornitore con lead time LUNGO (20-30 giorni)**:
   - Verifica coverage days alti
   - Es: MEDIUM = 37gg (30 lead + 7 buffer)

3. **Fornitore con lead time STANDARD (5-7 giorni)**:
   - Verifica coverage medio
   - Es: HIGH = 11gg (7 lead + 4 buffer)

### 4. Esegui Script di Validazione

**Da terminale locale** (con connessione Vercel Postgres staging):

```bash
npx tsx scripts/test-lead-time-integration.ts
```

**Output atteso**:
- Tabella confronto lead time Odoo vs DB
- Fornitori con lead time estremi (≤2gg, ≥10gg)
- Calcoli coverage days dinamici

---

## ❌ Problemi da Controllare

### 1. Lead Time Non Caricati

**Sintomo**: Log `✅ Lead time reali caricati per 0 templates da Odoo`

**Cause possibili**:
- Prodotti non hanno `seller_ids` in Odoo
- Query `product.supplierinfo` fallita
- Session Odoo scaduta

**Fix**:
- Controlla log errori
- Riprova login Odoo
- Verifica che prodotti abbiano fornitori configurati

### 2. Coverage Days Troppo Alti/Bassi

**Sintomo**: Coverage days irrealistici (es. 50+ giorni, o <3 giorni)

**Cause possibili**:
- Lead time da Odoo errato (delay field sbagliato)
- Fallback a default 7 giorni non funziona
- Buffer calculation errato

**Fix**:
- Verifica delay field in Odoo manualmente
- Controlla log prediction engine
- Valuta se regolare formule buffer

### 3. Performance Degradation

**Sintomo**: API lenta (>10 secondi)

**Cause possibili**:
- Query `product.supplierinfo` troppo lenta
- Troppi seller_ids da processare

**Fix**:
- Monitora execution time nel log
- Valuta aggiungere indice in Odoo
- Considera caching lead times

---

## 🔄 ROLLBACK - Come Tornare Indietro

### Opzione A: Rollback Git (VELOCE - 2 minuti)

**Se l'integrazione non funziona o causa problemi**:

```bash
# 1. Torna al branch di backup
git checkout backup-pre-lead-time-integration

# 2. Force push su staging (⚠️ ATTENZIONE!)
git push origin backup-pre-lead-time-integration:staging --force

# 3. Vercel farà auto-deploy del backup
# Deploy completo in ~2-3 minuti
```

**Effetto**: Sistema torna ESATTAMENTE come era prima dell'integrazione lead time.

### Opzione B: Revert Commit (PIÙ SICURO)

**Se vuoi mantenere storico git pulito**:

```bash
# 1. Torna su staging
git checkout staging

# 2. Crea commit di revert
git revert ea8e711

# 3. Push (normale, non force)
git push origin staging
```

**Effetto**: Crea un nuovo commit che annulla le modifiche, mantenendo storico.

### Opzione C: Cherry-pick Fix (SE SOLO PARTE DA FIXARE)

**Se il problema è in un singolo file**:

```bash
# 1. Fix il file problematico
git checkout backup-pre-lead-time-integration -- lib/smart-ordering/config.ts

# 2. Commit il fix
git commit -m "fix: Revert config.ts to stable version"

# 3. Push
git push origin staging
```

---

## 📊 Metriche di Successo

**L'integrazione è RIUSCITA se**:

✅ Lead time caricati per >80% dei prodotti
✅ Lead time DIVERSI tra fornitori (non tutti 3gg)
✅ Coverage days VARIABILI per urgency level
✅ Nessun errore nella console
✅ Execution time <8 secondi
✅ Suggerimenti ordini ragionevoli (no quantità assurde)

**L'integrazione ha PROBLEMI se**:

❌ Lead time tutti uguali (tutti 3gg o tutti 7gg)
❌ Coverage days sempre fissi (sempre 5, 7, 10, 13)
❌ Errori nella query product.supplierinfo
❌ API timeout (>15 secondi)
❌ Quantità suggerite irrealistiche (es. 1000x prodotto lento)

---

## 🚀 Prossimi Step (se test OK)

1. **Resync Fornitori** per aggiornare DB con lead time reali:
   ```
   GET /api/suppliers/sync
   ```

2. **Monitora per 24-48h** su staging

3. **Se stabile** → Merge su `main` per deploy production:
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```

4. **Se problemi** → Rollback con Opzione A sopra

---

## 📞 Supporto

**In caso di problemi gravi**:
1. Esegui rollback Opzione A (2 minuti)
2. Sistema torna stabile
3. Analizza log errori
4. Fix problemi
5. Ri-deploy quando pronto

**Branch disponibili**:
- `staging` - Versione con lead time integration (ATTUALE)
- `backup-pre-lead-time-integration` - Versione stabile PRE-integration
- `main` - Production (non toccato)

---

**Deployment completato**: 2025-11-21
**Vercel Staging URL**: https://app-hub-platform-staging.vercel.app
**Rollback disponibile**: ✅ Branch `backup-pre-lead-time-integration`
