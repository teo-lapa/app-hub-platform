# 🚀 Istruzioni Rapide - Fix Errore 401

## ⚠️ Problema
L'app "Prelievo Zone" dà errore **401 Unauthorized** quando carica i batch.

## ✅ Soluzione (3 passi)

### 1️⃣ LOGOUT
Se sei già loggato nell'app:
1. Clicca sul tuo nome in alto a destra
2. Clicca **"Logout"**

### 2️⃣ LOGIN
1. Vai su `http://localhost:3000`
2. Inserisci le tue credenziali Odoo:
   - **Email**: la tua email Odoo (es. `paul@lapa.ch`)
   - **Password**: la tua password Odoo
3. Clicca **"Accedi"**

⚠️ **IMPORTANTE**: Usa le stesse credenziali che usi per accedere a Odoo!

### 3️⃣ TEST
1. Vai sull'app **"Prelievo Zone"**
2. Verifica che i batch vengano caricati ✅
3. **Non deve più apparire l'errore 401!**

---

## 🔍 Come Verificare che Funziona

Apri il browser console (F12 → Console) e controlla i log:

**✅ SUCCESSO** (tutto ok):
```
🔧 [Picking] RPC Call (via server): stock.picking.batch.search_read
✅ [Picking] RPC Success
✅ [Picking] Trovati 5 batch
```

**❌ ERRORE** (ancora 401):
```
💥 [Picking] RPC Error: Error: HTTP Error: 401
```

---

## 🆘 Se Non Funziona

### Test Rapido Sessione
Apri console browser (F12) e digita:
```javascript
fetch('/api/test-odoo-session').then(r => r.json()).then(d => console.log(d));
```

**Risposta OK**:
```json
{"success": true, "details": {"sessionValid": true, "uid": 2}}
```

**Risposta KO**:
```json
{"success": false, "error": "Nessun session_id trovato"}
```

Se vedi "Nessun session_id trovato", significa che non hai fatto login correttamente.

### Soluzioni Comuni

1. **"Credenziali non valide"**
   - Verifica che l'utente esista su Odoo con quella email
   - Verifica che la password sia corretta

2. **"Sessione non valida"**
   - Fai logout dall'app
   - Riavvia il server: `npm run dev`
   - Fai login di nuovo

3. **Errore 401 persiste**
   - Verifica che il file `.env.local` contenga:
     ```
     ODOO_URL=https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com
     ODOO_DB=lapadevadmin-lapa-v2-staging-2406-24517859
     ```
   - Riavvia il server: `npm run dev`

---

## 📖 Documentazione Completa

Per maggiori dettagli, consulta:
- **`ODOO_LOGIN_GUIDE.md`** - Guida completa login e troubleshooting
- **`ODOO_401_FIX_REPORT.md`** - Report tecnico dettagliato
- **`CHANGES_SUMMARY.md`** - Riepilogo modifiche

---

## ✅ Checklist Rapida

- [ ] Ho fatto logout dall'app
- [ ] Ho fatto login con le mie credenziali Odoo
- [ ] Ho aperto l'app Prelievo Zone
- [ ] I batch si caricano senza errori 401
- [ ] Nei log del browser vedo "✅ [Picking] RPC Success"

**Se tutte le voci sono ✅, il problema è RISOLTO!** 🎉

---

**Supporto**: Se hai problemi, controlla i log del browser (F12 → Console) e verifica `/api/test-odoo-session`
