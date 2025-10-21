# 🚀 Workflow Staging → Production

## 📌 Panoramica

Questo documento spiega come lavorare con il nuovo sistema di staging e production per app-hub-platform.

---

## 🌍 Ambienti Disponibili

### 🔴 PRODUCTION (main)
- **Branch:** `main`
- **URL:** [hub.lapa.ch](https://hub.lapa.ch)
- **Scopo:** Ambiente LIVE usato dai clienti
- **Protezione:** 🔒 PROTETTO - Solo merge tramite Pull Request
- **Auto-deploy:** ✅ Vercel deploya automaticamente ogni merge

### 🟡 STAGING (staging)
- **Branch:** `staging`
- **URL:** [app-hub-platform-git-staging-teo-lapas-projects.vercel.app](https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app)
- **Scopo:** Test finale prima di andare in produzione
- **Protezione:** 🔓 Libero (puoi pushare direttamente)
- **Auto-deploy:** ✅ Vercel deploya automaticamente ogni push

### 🟢 DEVELOPMENT (development)
- **Branch:** `development`
- **URL:** Deployment automatico Vercel
- **Scopo:** Sviluppo e sperimentazione
- **Protezione:** 🔓 Libero
- **Auto-deploy:** ✅ Vercel deploya automaticamente ogni push

---

## 🔄 Workflow Standard

### Scenario 1: Nuova Feature / Modifica

```bash
# 1. SVILUPPO - Lavora su staging
git checkout staging
git pull origin staging  # Assicurati di avere l'ultima versione

# 2. Fai le tue modifiche
# ... modifica file ...

# 3. Commit
git add .
git commit -m "Descrizione chiara della modifica"

# 4. Push su staging
git push origin staging

# 5. Vercel deploya automaticamente!
# Vai su: https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app
# e testa tutto!
```

### Scenario 2: Staging OK → Vai in Produzione

```bash
# 1. Assicurati che staging sia tutto committed
git checkout staging
git status  # Deve essere pulito

# 2. Vai su GitHub
# https://github.com/teo-lapa/app-hub-platform

# 3. Clicca su "Pull requests" → "New pull request"

# 4. Configura:
#    base: main
#    compare: staging

# 5. Scrivi titolo e descrizione

# 6. Clicca "Create pull request"

# 7. Rivedi le modifiche

# 8. Clicca "Merge pull request"

# 9. Vercel aggiorna hub.lapa.ch automaticamente! 🎉
```

### Scenario 3: Hotfix Urgente su Produzione

```bash
# 1. Crea branch hotfix da main
git checkout main
git pull origin main
git checkout -b hotfix/descrizione-urgente

# 2. Fai la modifica urgente
# ... fix ...

# 3. Commit e push
git add .
git commit -m "Hotfix: descrizione problema risolto"
git push origin hotfix/descrizione-urgente

# 4. Vai su GitHub e crea PR:
#    hotfix/descrizione-urgente → main

# 5. Mergi la PR (veloce!)

# 6. IMPORTANTE: Backporta su staging!
git checkout staging
git pull origin staging
git merge main
git push origin staging
```

---

## 🎯 Best Practices

### ✅ DO (Fai Questo)

1. **Lavora sempre su staging** per modifiche normali
2. **Testa SEMPRE su staging** prima di mergiare su main
3. **Usa commit messages chiari**
   - ✅ "Fix: Risolto bug calcolo totale ordini"
   - ✅ "Feature: Aggiunto filtro data nel dashboard"
   - ❌ "fix"
   - ❌ "update"

4. **Fai commit piccoli e frequenti**
   - ✅ Un commit per ogni logica modifica
   - ❌ Un commit gigante con 50 file

5. **Fai pull prima di pushare**
   ```bash
   git pull origin staging  # Prima di iniziare a lavorare
   ```

6. **Testa il deployment su staging**
   - Vai su staging URL
   - Testa tutte le funzionalità modificate
   - Solo dopo → mergi su main

### ❌ DON'T (NON Fare Questo)

1. ❌ **NON pushare direttamente su main**
   ```bash
   git push origin main  # ❌ BLOCCATO dalle protezioni!
   ```

2. ❌ **NON mergiare su main senza testare su staging**

3. ❌ **NON fare commit con file sensibili**
   - `.env` files
   - Passwords
   - API keys

4. ❌ **NON fare force push su staging/main**
   ```bash
   git push --force  # ❌ MAI!
   ```

---

## 🔍 Come Verificare lo Stato

### Vedere su quale branch sei
```bash
git branch
# * staging  ← Sei qui
#   main
#   development
```

### Vedere le differenze tra staging e main
```bash
git checkout staging
git diff main
```

### Vedere i commit non ancora in produzione
```bash
git checkout staging
git log main..staging --oneline
```

### Vedere lo stato dei deployment Vercel
```bash
npx vercel ls
```

---

## 🆘 Troubleshooting

### Problema: "Ho committato sul branch sbagliato!"

```bash
# Sei su main e hai fatto commit (non ancora pushato)
git log -1  # Vedi l'ultimo commit

# Sposta il commit su staging
git checkout staging
git cherry-pick <commit-hash>
git push origin staging

# Torna su main e resetta
git checkout main
git reset --hard origin/main
```

### Problema: "Staging e main sono divergenti!"

```bash
# Allinea staging con main
git checkout staging
git pull origin staging
git merge main
git push origin staging
```

### Problema: "Il deployment su Vercel è fallito!"

1. Vai su [Vercel Dashboard](https://vercel.com/teo-lapas-projects)
2. Clicca sul deployment fallito
3. Leggi i log per vedere l'errore
4. Fixa l'errore localmente
5. Commit e push di nuovo

```bash
# Vedere i deployment
npx vercel ls

# Vedere i log di un deployment specifico
npx vercel logs <deployment-url>
```

### Problema: "Non riesco a pushare su main!"

✅ **È NORMALE!** main è protetto. Devi usare una Pull Request da GitHub.

---

## 📊 Comandi Rapidi

```bash
# Switch a staging e pull
git checkout staging && git pull

# Commit veloce
git add . && git commit -m "Messaggio" && git push

# Vedere differenze
git diff

# Vedere stato
git status

# Vedere log
git log --oneline -10

# Annullare modifiche non committate
git restore <file>
git restore .  # Tutti i file

# Vedere branch remoti
git branch -r

# Sincronizza con remote
git fetch --all
```

---

## 🎓 Flow Completo - Esempio Pratico

**Task:** Aggiungere un nuovo filtro nel dashboard

```bash
# 1. Vai su staging
git checkout staging
git pull origin staging

# 2. Crea modifiche
# ... edita components/Dashboard/Filters.tsx ...

# 3. Test locale
npm run dev
# Testa su http://localhost:3000

# 4. Commit
git add components/Dashboard/Filters.tsx
git commit -m "Feature: Aggiunto filtro per periodo nel dashboard"

# 5. Push su staging
git push origin staging

# 6. Vercel deploya automaticamente (attendi ~1 minuto)

# 7. Vai su staging URL e testa
# https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app

# 8. Se tutto OK, vai su GitHub
# https://github.com/teo-lapa/app-hub-platform/compare/main...staging

# 9. Crea Pull Request: staging → main

# 10. Scrivi descrizione:
# "Aggiunto filtro per periodo nel dashboard
#  - Filtro dropdown per ultimo mese/trimestre/anno
#  - Aggiornamento automatico dei dati
#  - Test completati su staging"

# 11. Clicca "Create pull request"

# 12. Rivedi le modifiche

# 13. Clicca "Merge pull request"

# 14. hub.lapa.ch si aggiorna automaticamente! 🎉

# 15. Verifica su produzione
# https://hub.lapa.ch

# ✅ FATTO!
```

---

## 📞 Supporto

**Repository:** https://github.com/teo-lapa/app-hub-platform
**Vercel Dashboard:** https://vercel.com/teo-lapas-projects

**URLs:**
- Production: https://hub.lapa.ch
- Staging: https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app

---

**Creato da:** Claude Code
**Data:** 21 Ottobre 2025
**Versione:** 1.0
