# 🚀 App Hub Platform - Deployment Guide

## 📌 Quick Start

Questo progetto utilizza un workflow **Staging → Production** per garantire deployments sicuri.

---

## 🌍 Ambienti

| Ambiente | Branch | URL | Auto-Deploy |
|----------|--------|-----|-------------|
| **Production** | `main` | [hub.lapa.ch](https://hub.lapa.ch) | ✅ Vercel |
| **Staging** | `staging` | [staging URL](https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app) | ✅ Vercel |
| **Development** | `development` | Auto-generated | ✅ Vercel |

---

## ⚡ Script Rapidi

Nella cartella `scripts/` trovi script pronti all'uso:

### 1. Deploy su Staging
```bash
cd scripts
deploy-to-staging.bat
```
**Cosa fa:**
- Switcha su branch staging
- Pull delle ultime modifiche
- Ti chiede il commit message
- Commit e push automatico
- Vercel deploya automaticamente

### 2. Controllo Stato Progetto
```bash
cd scripts
check-status.bat
```
**Cosa fa:**
- Mostra branch corrente
- Mostra stato repository
- Mostra commit non pushati
- Mostra differenze staging vs main
- Mostra ultimi deployment Vercel

### 3. Sincronizza Staging da Main
```bash
cd scripts
sync-staging-from-main.bat
```
**Cosa fa:**
- Merge di main in staging (dopo hotfix)
- Push automatico
- Vercel deploya automaticamente

---

## 📖 Documentazione Completa

- **[Workflow Staging → Production](./WORKFLOW_STAGING_PRODUCTION.md)** - Guida completa
- **[GitHub Branch Protection](./GITHUB_BRANCH_PROTECTION_SETUP.md)** - Configurazione protezioni

---

## 🔄 Workflow Standard

### Sviluppo Normale
```bash
# 1. Lavora su staging
git checkout staging
git pull origin staging

# 2. Fai modifiche e commit
git add .
git commit -m "Feature: descrizione"
git push origin staging

# 3. Testa su staging URL
# https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app

# 4. Se OK, crea Pull Request su GitHub: staging → main

# 5. Mergi la PR

# 6. hub.lapa.ch si aggiorna automaticamente!
```

### Hotfix Urgente
```bash
# 1. Crea branch hotfix da main
git checkout main
git pull origin main
git checkout -b hotfix/descrizione

# 2. Fix e push
git add .
git commit -m "Hotfix: descrizione"
git push origin hotfix/descrizione

# 3. Crea PR: hotfix/descrizione → main

# 4. Mergi la PR

# 5. Sincronizza staging
cd scripts
sync-staging-from-main.bat
```

---

## 🔒 Protezioni

- ✅ Branch `main` è **PROTETTO** - Solo merge tramite Pull Request
- ✅ Vercel fa auto-deploy su ogni branch
- ✅ Ogni push su staging crea deployment automatico
- ✅ Ogni merge su main aggiorna hub.lapa.ch

---

## 🆘 Troubleshooting

### Non riesco a pushare su main
✅ Normale! main è protetto. Usa Pull Request da GitHub.

### Il deployment è fallito
1. Vai su [Vercel Dashboard](https://vercel.com/teo-lapas-projects)
2. Clicca sul deployment fallito
3. Leggi i log
4. Fixa l'errore e riprova

### Staging e main sono divergenti
```bash
cd scripts
sync-staging-from-main.bat
```

---

## 📞 Link Utili

- **GitHub Repo:** https://github.com/teo-lapa/app-hub-platform
- **Vercel Dashboard:** https://vercel.com/teo-lapas-projects
- **Production:** https://hub.lapa.ch
- **Staging:** https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app

---

## 🎯 Best Practices

✅ **DO:**
- Lavora sempre su staging
- Testa su staging prima di mergiare su main
- Usa commit messages chiari
- Fai pull prima di iniziare a lavorare

❌ **DON'T:**
- Non pushare direttamente su main
- Non mergiare su main senza testare
- Non fare force push
- Non committare file sensibili (.env, passwords)

---

**Setup completato il:** 21 Ottobre 2025
**Creato da:** Claude Code
**Versione:** 1.0
