# 🔒 Guida: Configurazione Branch Protection su GitHub

## Obiettivo
Proteggere il branch `main` (produzione) per evitare push accidentali e garantire che tutte le modifiche passino attraverso staging.

---

## 📋 Configurazione Branch Protection per `main`

### 1. Vai su GitHub Repository
Apri: [https://github.com/teo-lapa/app-hub-platform](https://github.com/teo-lapa/app-hub-platform)

### 2. Vai nelle Impostazioni
- Clicca su **Settings** (in alto a destra)
- Nel menu laterale sinistro, clicca su **Branches** (sotto "Code and automation")

### 3. Aggiungi Regola di Protezione per `main`
- Clicca sul pulsante **Add rule** (o **Add branch protection rule**)
- Nel campo **Branch name pattern**, scrivi: `main`

### 4. Configura le Seguenti Opzioni

#### ✅ Opzioni OBBLIGATORIE (Sicurezza Massima)

**Require a pull request before merging**
- ☑️ Attiva questa opzione
- ☑️ **Require approvals**: 0 (puoi aumentare a 1 se vuoi approvazione manuale)
- ☑️ **Dismiss stale pull request approvals when new commits are pushed**

**Require status checks to pass before merging**
- ☑️ Attiva questa opzione (se hai CI/CD configurato)
- Se Vercel è configurato, cerca "Vercel" nella lista e selezionalo

**Do not allow bypassing the above settings**
- ☑️ Attiva questa opzione (nessuno può bypassare, nemmeno gli admin)

#### ✅ Opzioni CONSIGLIATE

**Require linear history**
- ☑️ Attiva (mantiene la history pulita)

**Include administrators**
- ☑️ Attiva (le regole valgono anche per te)

#### ❌ Opzioni da NON attivare (per ora)

**Require signed commits** - Lascia disattivato (troppo complesso)
**Require deployments to succeed** - Lascia disattivato

### 5. Salva
- Scorri in basso e clicca su **Create** (o **Save changes**)

---

## 📋 Configurazione Branch Protection per `staging` (Opzionale)

Ripeti gli stessi passi ma con impostazioni più permissive:

1. Aggiungi nuova regola per pattern: `staging`
2. Attiva solo:
   - ☑️ **Require a pull request before merging** (0 approvals)
   - ☑️ **Require linear history**

---

## ✅ Verifica Configurazione

Dopo aver salvato, dovresti vedere:

**Branch protection rules:**
- `main` - Active (con icona lucchetto 🔒)
- `staging` - Active (opzionale)

---

## 🎯 Risultato Finale

### ❌ NON Puoi Più Fare Questo su `main`:
```bash
git push origin main  # ❌ BLOCCATO!
```

### ✅ DEVI Fare Questo:
```bash
# 1. Lavora su staging
git checkout staging
git add .
git commit -m "Nuova feature"
git push origin staging

# 2. Vai su GitHub e crea Pull Request
# staging → main

# 3. Approva e mergi la PR

# 4. Vercel aggiorna hub.lapa.ch automaticamente!
```

---

## 🚨 In Caso di Emergenza

Se devi fare un hotfix urgente su produzione:

1. Crea branch da `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b hotfix/nome-urgente
   ```

2. Fai la modifica
   ```bash
   git add .
   git commit -m "Hotfix: descrizione"
   git push origin hotfix/nome-urgente
   ```

3. Crea PR immediata: `hotfix/nome-urgente` → `main`

4. Mergi la PR (dopo verifica veloce)

5. Backporta su staging:
   ```bash
   git checkout staging
   git merge main
   git push origin staging
   ```

---

## 📞 Aiuto

Se hai problemi o domande, apri un issue su GitHub o contatta l'amministratore del progetto.

**Repository:** https://github.com/teo-lapa/app-hub-platform
**Vercel Dashboard:** https://vercel.com/teo-lapas-projects

---

**Creato da:** Claude Code
**Data:** 21 Ottobre 2025
