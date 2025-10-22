# 🌙 Nightly Customer Avatars Sync - Setup Guide

## Sistema Configurato

Ho configurato un sistema di **sincronizzazione automatica notturna** dei customer avatars da Odoo al database PostgreSQL.

### Come Funziona

- **GitHub Actions** esegue un workflow ogni notte alle **2:00 AM UTC** (3:00-4:00 AM ora italiana)
- Il workflow chiama l'API `/api/maestro/sync/manual` su **staging** e **production**
- L'API è protetta con un secret `CRON_SECRET` per sicurezza
- In caso di errore, il workflow fallisce e puoi vedere i log su GitHub Actions

---

## 📋 STEP 1: Genera un Secret Casuale

Esegui questo comando per generare un secret sicuro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia il risultato (es: `a7f3e9d2c1b5a4e6f8d0c2b4a6e8f0d2c4b6a8e0f2d4c6b8a0e2f4d6c8b0a2e4`)

---

## 📋 STEP 2: Aggiungi Secret su GitHub

1. Vai su: https://github.com/teo-lapa/app-hub-platform/settings/secrets/actions
2. Clicca **"New repository secret"**
3. Nome: `CRON_SECRET`
4. Valore: Incolla il secret generato nello step 1
5. Clicca **"Add secret"**

---

## 📋 STEP 3: Aggiungi Secret su Vercel (Staging)

```bash
cd app-hub-platform
vercel env add CRON_SECRET
```

Quando chiede:
- **Value**: Incolla lo stesso secret dello step 1
- **Environment**: Seleziona **Preview** (staging)

---

## 📋 STEP 4: Aggiungi Secret su Vercel (Production)

```bash
vercel env add CRON_SECRET
```

Quando chiede:
- **Value**: Incolla lo stesso secret dello step 1
- **Environment**: Seleziona **Production**

---

## 📋 STEP 5: Commit e Push

```bash
git add .github/workflows/nightly-sync.yml app/api/maestro/sync/manual/route.ts
git commit -m "Add nightly sync automation with GitHub Actions"
git push origin staging
```

Poi fai il merge su main per abilitare il cron job anche su production.

---

## ✅ Verifica Funzionamento

### Test Manuale del Workflow

1. Vai su: https://github.com/teo-lapa/app-hub-platform/actions/workflows/nightly-sync.yml
2. Clicca **"Run workflow"**
3. Seleziona branch `staging` o `main`
4. Clicca **"Run workflow"**
5. Aspetta 5 minuti e verifica che sia ✅ verde

### Controlla i Log del Sync

```bash
# Staging logs
vercel logs https://staging.hub.lapa.ch --follow | grep SYNC

# Production logs
vercel logs https://hub.lapa.ch --follow | grep SYNC
```

---

## 🔍 Monitoring

### Vedere quando girerà il prossimo sync

Il cron job gira:
- Ogni notte alle **2:00 AM UTC**
- Equivale a **3:00 AM** (ora solare) o **4:00 AM** (ora legale) in Italia

### Vedere la history dei sync

Vai su: https://github.com/teo-lapa/app-hub-platform/actions

Vedrai tutti i run del workflow "Nightly Customer Avatars Sync" con:
- ✅ Success (se tutto ok)
- ❌ Failure (se c'è stato un errore)

---

## 🛠️ Troubleshooting

### Il workflow fallisce con 401 Unauthorized

Problema: Il secret `CRON_SECRET` non è configurato correttamente.

Soluzione:
1. Verifica che il secret sia lo stesso su GitHub, Vercel Staging e Vercel Production
2. Ri-deploya staging e production dopo aver aggiunto il secret su Vercel

### Il workflow fallisce con 500 Internal Server Error

Problema: Il sync ha avuto un errore durante l'esecuzione.

Soluzione:
1. Controlla i log di Vercel per vedere l'errore esatto:
   ```bash
   vercel logs https://staging.hub.lapa.ch --follow | grep "MANUAL SYNC"
   ```
2. Probabilmente è un errore di connessione a Odoo o PostgreSQL

### Voglio cambiare l'orario del sync

Modifica il file `.github/workflows/nightly-sync.yml`:

```yaml
on:
  schedule:
    # Cambia '0 2' con l'ora UTC desiderata (es: '0 1' per 1:00 AM UTC)
    - cron: '0 2 * * *'
```

Poi fai commit e push.

---

## 🎯 Risultato Finale

Dopo questa configurazione, il database PostgreSQL si aggiornerà automaticamente ogni notte con i nuovi clienti da Odoo, senza dover fare nulla manualmente!

✅ Sync automatico notturno
✅ Protetto con secret
✅ Log e monitoring su GitHub Actions
✅ Funziona su staging e production
