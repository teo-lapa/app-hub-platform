# 🚀 QUICK START GUIDE - Sistema Multi-Agente

## ⚡ Avvio Rapido (3 minuti)

### 1️⃣ Verifica API Key

```bash
# Controlla che l'API key sia configurata
cat .env.local | grep ANTHROPIC_API_KEY
```

Se non c'è, aggiungi:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE" >> .env.local
```

### 2️⃣ Avvia Server

```bash
npm run dev
```

### 3️⃣ Apri Dashboard

Vai su: **http://localhost:3000/agent-dashboard**

### 4️⃣ Inizializza Sistema

1. Clicca il bottone **"Initialize"** in alto a destra
2. Aspetta 10-30 secondi mentre il sistema:
   - 🔍 Scopre tutte le tue app
   - 🏭 Crea agenti specializzati
   - ✅ Si prepara a ricevere comandi

### 5️⃣ Primo Comando!

1. Vai sulla tab **"Chat"**
2. Scrivi un comando, ad esempio:

```
Analizza tutte le app e dimmi quali sono le più complesse
```

3. Premi **Enter** o clicca **Send**
4. Guarda l'agente lavorare! 🎉

---

## 🎮 Comandi di Esempio

### Per Iniziare

```
Mostrami tutte le app disponibili
```

```
Quali agenti sono attivi?
```

### Analisi

```
Analizza l'app inventario e dimmi cosa fa
```

```
Trova tutti i bug potenziali nell'app delivery
```

```
Calcola la complessità delle app magazzino
```

### Modifiche Codice

```
Aggiungi commenti JSDoc all'app pick-residui
```

```
Refactora i componenti dell'app prelievo-zone
```

```
Ottimizza le performance dell'app ordini-fornitori
```

### Multi-App

```
Crea un hook comune per tutte le app magazzino
```

```
Implementa error handling consistente in tutte le app
```

---

## 📊 Dashboard Overview

### Overview Tab

- **Agent Status**: Vedi quanti agenti sono idle/busy/error
- **Top Performers**: Agenti con più task completati
- **Stats Cards**: Metriche globali del sistema

### Agents Tab

Grid con card per ogni agente:

- 📦 **Icona categoria** (magazzino, vendite, etc)
- ✅ **Status** (idle/busy/error)
- 📈 **Stats**: Task completati, in progress, success rate
- 🎯 **Capabilities**: Cosa può fare l'agente

### Chat Tab

Interfaccia chat interattiva:

- 💬 Scrivi comandi in linguaggio naturale
- 🤖 L'orchestratore risponde con risultati
- 📝 Storia completa della conversazione
- ⚡ Feedback in tempo reale

---

## 🔧 Troubleshooting Rapido

### Il sistema non parte

```bash
# 1. Verifica API key
echo $ANTHROPIC_API_KEY

# 2. Reinstalla dipendenze
npm install

# 3. Riavvia server
npm run dev
```

### Nessun agente visibile

```bash
# Dashboard → Clicca "Discover Apps"
# Aspetta 20-30 secondi
# Refresh pagina
```

### Task non parte

```bash
# 1. Verifica status nel terminale server
# 2. Controlla logs nella Chat tab
# 3. Prova comando più specifico
```

---

## 💡 Tips & Tricks

### ✅ DO

- Sii specifico: "Fix bug nel filtro data in inventario"
- Specifica l'app: "Nell'app delivery aggiungi..."
- Una cosa alla volta per task semplici

### ❌ DON'T

- "Fixxa tutto" (troppo vago)
- Comandi ambigui senza contesto
- Task troppo complessi in un solo comando

---

## 🎯 Workflow Consigliato

### 1. Analisi

```
Analizza l'app [nome-app] e dimmi cosa può essere migliorato
```

### 2. Piano

```
Crea un piano per implementare [feature] in [app]
```

### 3. Implementazione

```
Implementa [feature] nell'app [nome-app]
```

### 4. Test

```
Controlla se ci sono errori nell'app [nome-app]
```

### 5. Review

Controlla i file modificati nella risposta dell'agente

---

## 📱 Mobile Friendly

La dashboard è responsive! Puoi:

- 📱 Usarla da mobile/tablet
- 💻 Desktop per esperienza completa
- 🔄 Pull-to-refresh su mobile

---

## 🚨 Limiti & Aspettative

### Il Sistema PUÒ:

- ✅ Analizzare codice
- ✅ Suggerire miglioramenti
- ✅ Generare codice
- ✅ Refactorare
- ✅ Documentare
- ✅ Trovare bug

### Il Sistema NON PUÒ (ancora):

- ❌ Eseguire modifiche senza conferma
- ❌ Fare git commit automatici
- ❌ Deployare in produzione
- ❌ Modificare database direttamente

---

## 🎓 Prossimi Passi

Una volta che hai familiarizzato:

1. Leggi [AGENT_SYSTEM_README.md](./AGENT_SYSTEM_README.md) per dettagli completi
2. Esplora il codice in `lib/agents/` per capire l'architettura
3. Personalizza gli agenti per le tue esigenze
4. Aggiungi nuovi tool custom

---

## 🆘 Supporto

### Logs del Server

```bash
# Nel terminale dove hai fatto npm run dev
# Vedi tutti i log degli agenti in tempo reale
```

### Logs della Dashboard

```bash
# F12 → Console
# Vedi log del frontend
```

### Debug Mode

```typescript
// In .env.local
NODE_ENV=development  # Abilita log dettagliati
```

---

## 🎉 Hai Finito!

Ora sei pronto per usare il sistema multi-agente!

**Ricorda:**

- 🔄 Inizializza con "Initialize"
- 💬 Usa la Chat per comandi
- 📊 Monitora progresso nella Dashboard
- 🔍 Usa "Discover Apps" per nuove app

---

**Buon divertimento con i tuoi AI Agents! 🤖✨**
