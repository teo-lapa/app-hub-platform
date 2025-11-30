# Soluzione Sincronizzazione Facebook → Odoo

## 📋 Sommario Esecutivo

**Problema**: I post Facebook non si sincronizzavano in Odoo da gennaio 2025 (10+ mesi).

**Causa Root**: Token Facebook Page Access scaduto (validità 60 giorni) + assenza di auto-sync configurato.

**Soluzione Implementata**:
- ✅ Account Facebook riconnesso (token rinnovato)
- ✅ Scheduled Action Odoo creata per auto-sync ogni ora
- ✅ Vercel Cron endpoint alternativo implementato
- ✅ Script di monitoraggio token creati
- ✅ Documentazione e procedure di manutenzione

---

## 🔧 Script Disponibili

Tutti gli script sono nella root del progetto:

### 1. **fix-facebook-sync.js** - Diagnosi Completa
```bash
node fix-facebook-sync.js
```

**Cosa fa:**
- Verifica stato account Facebook in Odoo
- Controlla ultimi post sincronizzati
- Verifica stream configurati
- Controlla scheduled actions attive
- Fornisce diagnosi e istruzioni per risoluzione

**Quando usarlo:**
- Per diagnosticare problemi di sincronizzazione
- Prima di riconnettere account
- Per verificare che tutto funzioni correttamente

---

### 2. **create-facebook-auto-sync.js** - Crea Auto-Sync Odoo
```bash
node create-facebook-auto-sync.js
```

**Cosa fa:**
- Crea uno Scheduled Action in Odoo
- Configura sincronizzazione automatica ogni 1 ora
- Verifica che il cron sia attivo

**Quando usarlo:**
- Solo UNA volta per configurare l'auto-sync
- Se il cron viene disattivato accidentalmente
- Dopo un reset di Odoo

**Nota:** ✅ Già eseguito! Il cron ID 199 è attivo.

---

### 3. **monitor-facebook-token.js** - Monitoraggio Token
```bash
node monitor-facebook-token.js
```

**Cosa fa:**
- Verifica scadenza token di tutti gli account social
- Calcola giorni rimanenti prima della scadenza
- Avvisa se token in scadenza o scaduti
- Exit code: 0 = OK, 1 = scaduti, 2 = in scadenza

**Quando usarlo:**
- **Settimanalmente** per monitoraggio preventivo
- Quando i post smettono di sincronizzarsi
- Prima di andare in vacanza (per assicurarsi che tutto sia OK)

**Best Practice:** Automatizza con cron o GitHub Actions

---

### 4. **force-sync-facebook-now.js** - Sync Manuale Immediata
```bash
node force-sync-facebook-now.js
```

**Cosa fa:**
- Forza sincronizzazione immediata (senza aspettare il cron)
- Conta post prima e dopo
- Mostra nuovi post sincronizzati

**Quando usarlo:**
- Per testare subito dopo riconnessione
- Se serve sincronizzare urgentemente
- Per debug quando il cron non sembra funzionare

---

### 5. **test-social-stream-sync-cron.js** - Test Vercel Cron
```bash
node test-social-stream-sync-cron.js
```

**Cosa fa:**
- Testa l'endpoint Vercel Cron `/api/cron/social-stream-sync`
- Simula esecuzione del cron
- Mostra risultati e errori

**Quando usarlo:**
- Per testare l'Opzione B (Vercel Cron)
- Durante development
- Prima di deploy in production

**Prerequisito:** App Next.js deve essere running (`npm run dev`)

---

## 🚀 Soluzioni Implementate

### Opzione A: Scheduled Action Odoo (CONSIGLIATA)

**Status:** ✅ Attiva

**Come funziona:**
- Cron job interno a Odoo (ID: 199)
- Esecuzione: Ogni 1 ora
- Prossima: Visibile in Odoo → Impostazioni → Tecnico → Scheduled Actions

**Pro:**
- Tutto gestito internamente in Odoo
- Nessuna dipendenza esterna
- Esecuzione garantita se Odoo è online

**Contro:**
- Nessun log centralizzato esterno
- Difficile debug se Odoo ha problemi

**Monitoraggio:**
```bash
# Verifica che il cron sia attivo
node fix-facebook-sync.js

# Guarda la sezione "5️⃣ Controllo scheduled actions"
# Dovresti vedere: "Social: Refresh Stream Posts"
```

---

### Opzione B: Vercel Cron (ALTERNATIVA)

**Status:** ⚠️ Configurata ma non attiva

**Come funziona:**
- Endpoint: `/api/cron/social-stream-sync`
- Trigger: Vercel Cron ogni ora
- Configurazione: `vercel.json` → crons array

**Pro:**
- Indipendente da Odoo
- Log centralizzati in Vercel
- Più facile debug
- Può gestire retry e fallback

**Contro:**
- Richiede deploy su Vercel
- Dipende da Vercel uptime
- Credenziali Odoo in env variables

**Attivazione:**
1. Deploy app su Vercel
2. Configura env variables:
   ```
   ODOO_URL=https://...
   ODOO_DB=...
   ODOO_USERNAME=...
   ODOO_PASSWORD=...
   CRON_SECRET=your-secret-here
   ```
3. Il cron parte automaticamente

**Test Locale:**
```bash
npm run dev
node test-social-stream-sync-cron.js
```

---

## 📅 Procedura Riconnessione Account Facebook

**Quando:** Ogni 60 giorni o quando lo script di monitoraggio segnala scadenza

**Passi:**

1. **Vai su Odoo**
   - URL: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
   - Login: paul@lapa.ch

2. **Naviga a Configurazione Social**
   - Menu: Marketing Sociale → Configurazione → Social Media
   - Oppure: Apps → Social Marketing → Configuration

3. **Seleziona Facebook**
   - Clicca su "Facebook" nella lista dei social media

4. **Trova Account da Rinnovare**
   - Cerca: "LAPA - finest italian food"
   - Controlla status: se "Disconnesso" o vecchio

5. **Riconnetti**
   - Clicca "Modifica"
   - Clicca "Riconnetti" o "Disconnetti" → "Connetti"
   - Autorizza accesso Facebook
   - Conferma permessi richiesti

6. **Verifica**
   ```bash
   node fix-facebook-sync.js
   ```
   - Controlla che "write_date" sia aggiornato
   - Verifica che "is_media_disconnected" = false

7. **Forza Sync (Opzionale)**
   ```bash
   node force-sync-facebook-now.js
   ```

---

## 🔐 Token Facebook: Durata e Scadenza

### Tipi di Token

| Tipo | Durata | Uso |
|------|--------|-----|
| Short-lived | 1-2 ore | OAuth initial |
| Long-lived | 60 giorni | Normal usage |
| Never-expiring | Manuale renewal | Advanced setup |

### Odoo usa Long-Lived Token (60 giorni)

**Timeline:**
```
Giorno 0:    Connessione account → Token creato
Giorno 53:   ⚠️ Warning (7 giorni rimanenti)
Giorno 60:   🔴 Token scaduto
Giorno 60+:  Sincronizzazione bloccata
```

### Come Monitorare

**Script Automatico:**
```bash
# Esegui settimanalmente
node monitor-facebook-token.js

# Exit codes:
# 0 = Tutto OK
# 1 = Token scaduti (critico)
# 2 = Token in scadenza (warning)
```

**Automatizzare con Cron (Linux/Mac):**
```bash
# Aggiungi a crontab
0 9 * * 1 cd /path/to/project && node monitor-facebook-token.js
# Esegue ogni lunedì alle 9:00
```

**Automatizzare con Task Scheduler (Windows):**
- Crea task settimanale
- Azione: `node C:\path\to\monitor-facebook-token.js`
- Trigger: Lunedì 9:00

---

## ⚙️ Configurazione Vercel Cron

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/social-stream-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Schedule Syntax:**
```
0 * * * *
│ │ │ │ │
│ │ │ │ └─ Giorno settimana (0-6, 0=Domenica)
│ │ │ └─── Mese (1-12)
│ │ └───── Giorno (1-31)
│ └─────── Ora (0-23)
└───────── Minuto (0-59)
```

**Esempi:**
- `0 * * * *` - Ogni ora al minuto 0
- `*/15 * * * *` - Ogni 15 minuti
- `0 8 * * *` - Ogni giorno alle 8:00
- `0 0 * * 0` - Ogni domenica a mezzanotte

**Modifica Frequenza:**
```json
{
  "path": "/api/cron/social-stream-sync",
  "schedule": "*/30 * * * *"  // Ogni 30 minuti
}
```

---

## 🐛 Troubleshooting

### Problema: "Unauthorized" popup in Odoo

**Sintomi:**
- Popup quando apri Marketing Sociale → Feed
- Account mostra come "Connesso" ma popup appare

**Causa:**
- Token Facebook scaduto
- Odoo non ha rilevato scadenza

**Soluzione:**
```bash
# 1. Verifica token
node monitor-facebook-token.js

# 2. Se scaduto, riconnetti (vedi Procedura sopra)

# 3. Verifica fix
node fix-facebook-sync.js
```

---

### Problema: Post non si sincronizzano

**Sintomi:**
- Ultimo post molto vecchio (>30 giorni)
- Nessun errore visibile

**Diagnosi:**
```bash
node fix-facebook-sync.js
```

**Possibili Cause:**

1. **Token Scaduto**
   - Soluzione: Riconnetti account

2. **Cron Non Attivo**
   - Verifica: Script mostra "Nessun auto-sync configurato"
   - Soluzione: `node create-facebook-auto-sync.js`

3. **Nessun Nuovo Post su Facebook**
   - Verifica: Controlla pagina Facebook manualmente
   - Nessuna azione necessaria

4. **Facebook API Limits**
   - Alcuni post potrebbero essere troppo vecchi per essere recuperati
   - Facebook limita l'accesso a post > X giorni
   - Nessuna soluzione (limitazione di Facebook)

---

### Problema: Cron Odoo non funziona

**Sintomi:**
- Script mostra cron attivo ma post non sincronizzano
- Nessun errore nei log

**Debug:**

1. **Verifica Esecuzione:**
   - Odoo → Impostazioni → Tecnico → Scheduled Actions
   - Trova: "Social: Refresh Stream Posts"
   - Controlla "Ultima esecuzione" e "Prossima esecuzione"

2. **Controlla Log Odoo:**
   - Se hai accesso ai log, cerca errori relativi a "social.stream"

3. **Test Manuale:**
   ```bash
   node force-sync-facebook-now.js
   ```
   - Se funziona: problema è il cron
   - Se non funziona: problema è il metodo di sync

4. **Fallback a Vercel Cron:**
   - Usa Opzione B (Vercel Cron)
   - Deploy su Vercel
   - Configura env variables

---

### Problema: "Invalid field" errori

**Sintomi:**
```
Invalid field 'has_account_token' on model 'social.account'
Invalid field 'account_ids' on model 'social.stream'
```

**Causa:**
- Versione di Odoo diversa
- Modulo Social Marketing version mismatch
- Campi rinominati/rimossi in nuova versione

**Soluzione:**
- Questi errori sono informativi, non critici
- Gli script usano campi alternativi quando disponibili
- Se causano problemi, apri issue su GitHub

---

## 📊 Monitoraggio e Manutenzione

### Checklist Settimanale

- [ ] Esegui `node monitor-facebook-token.js`
- [ ] Verifica exit code (0 = OK, 1/2 = action needed)
- [ ] Se warning, pianifica riconnessione entro 7 giorni

### Checklist Mensile

- [ ] Esegui `node fix-facebook-sync.js`
- [ ] Verifica che ultimi post siano recenti (<7 giorni)
- [ ] Controlla che cron sia attivo
- [ ] Verifica log Vercel Cron (se attivo)

### Checklist Prima di Vacanza

- [ ] Verifica token hanno >14 giorni rimanenti
- [ ] Riconnetti se <14 giorni
- [ ] Testa sync manuale: `node force-sync-facebook-now.js`
- [ ] Verifica cron Odoo è attivo
- [ ] Configura alert (email/Slack) per fallimenti

---

## 🔔 Setup Alert Automatici

### Opzione 1: GitHub Actions (Consigliata)

**File:** `.github/workflows/monitor-facebook-token.yml`

```yaml
name: Monitor Facebook Token

on:
  schedule:
    - cron: '0 9 * * 1'  # Ogni lunedì alle 9:00
  workflow_dispatch:  # Permette esecuzione manuale

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Monitor Token
        run: node monitor-facebook-token.js
        continue-on-error: true
        id: monitor

      - name: Send notification if failed
        if: steps.monitor.outcome == 'failure'
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.gmail.com
          server_port: 465
          username: ${{ secrets.EMAIL_USERNAME }}
          password: ${{ secrets.EMAIL_PASSWORD }}
          subject: ⚠️ Facebook Token Scaduto!
          body: Il token Facebook è scaduto o sta per scadere. Riconnetti l'account.
          to: your-email@example.com
```

### Opzione 2: Vercel Cron + Email

**File:** `app/api/cron/monitor-token/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function GET() {
  // Esegui monitor-facebook-token.js logic
  const tokenStatus = await checkTokenExpiry();

  if (tokenStatus.hasExpired || tokenStatus.willExpireSoon) {
    await sendEmail({
      to: 'your-email@example.com',
      subject: '⚠️ Facebook Token Alert',
      body: `Token status: ${tokenStatus.message}`
    });
  }

  return NextResponse.json({ status: 'ok' });
}
```

**Aggiungi a vercel.json:**
```json
{
  "path": "/api/cron/monitor-token",
  "schedule": "0 9 * * 1"  // Lunedì 9:00
}
```

---

## 📝 File Creati/Modificati

### Script Nuovi
- ✅ `fix-facebook-sync.js` - Diagnosi completa
- ✅ `create-facebook-auto-sync.js` - Setup auto-sync Odoo
- ✅ `monitor-facebook-token.js` - Monitoraggio scadenza
- ✅ `force-sync-facebook-now.js` - Sync manuale immediata
- ✅ `test-social-stream-sync-cron.js` - Test Vercel Cron

### API Routes Nuove
- ✅ `app/api/cron/social-stream-sync/route.ts` - Vercel Cron endpoint

### File Modificati
- ✅ `vercel.json` - Aggiunto cron social-stream-sync

### Documentazione
- ✅ `docs/FACEBOOK-SYNC-SOLUTION.md` - Questo file

---

## 🎯 Prossimi Passi Consigliati

1. **Setup Alert Automatici**
   - Implementa GitHub Actions workflow per monitoraggio settimanale
   - Oppure usa Vercel Cron + email notification

2. **Estendi a Altri Social**
   - Instagram, LinkedIn, Twitter usano stesso sistema
   - Stessi script funzionano (cambiano solo i filtri)

3. **Dashboard Monitoring**
   - Crea pagina in Next.js per visualizzare:
     - Status token di tutti gli account
     - Ultimi sync eseguiti
     - Count post per social network
   - Endpoint: `/admin/social-monitoring`

4. **Backup dei Post**
   - Script per esportare post in JSON/CSV
   - Utile prima di grandi cambiamenti
   - Permette restore in caso di problemi

---

## 📞 Supporto

**Problemi Comuni:**
- Vedi sezione [Troubleshooting](#-troubleshooting)

**Bug o Feature Request:**
- Apri issue su GitHub repository

**Documentazione Odoo:**
- [Social Marketing Module](https://www.odoo.com/documentation/17.0/applications/marketing/social_marketing.html)

**Facebook Graph API:**
- [Page Access Tokens](https://developers.facebook.com/docs/pages/access-tokens)
- [Token Expiration](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived)

---

## ✅ Checklist Pre-Production

Prima di considerare questo sistema "production-ready":

- [x] Account Facebook riconnesso
- [x] Token valido (>50 giorni rimanenti)
- [x] Scheduled Action Odoo creata e attiva
- [x] Vercel Cron configurato (opzionale)
- [ ] Alert automatici configurati
- [ ] Test end-to-end superato
- [ ] Documentazione letta e compresa
- [ ] Piano di manutenzione definito
- [ ] Responsabile manutenzione assegnato

---

**Ultimo aggiornamento:** 30 novembre 2025
**Versione:** 1.0
**Autore:** Claude Code Agent
