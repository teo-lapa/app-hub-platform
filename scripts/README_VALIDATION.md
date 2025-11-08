# Sistema di Validazione ID App

## 📋 Problema Risolto

Prevenire ID duplicati nel file `lib/data/apps-with-indicators.ts` che causavano:
- Card duplicate nella dashboard
- App non visibili (ID conflittuali)
- Confusione nella gestione delle app

## 🛡️ Sistema di Protezione

### 1. Script di Validazione Manuale

Esegui in qualsiasi momento per verificare gli ID:

```bash
npm run validate-apps
```

oppure

```bash
node scripts/validate-app-ids.js
```

**Output in caso di successo:**
```
✅ VALIDAZIONE SUPERATA!
   Totale app: 45
   Nessun ID duplicato trovato
```

**Output in caso di errore:**
```
❌ VALIDAZIONE FALLITA!

   ID DUPLICATI TROVATI:

   🔴 ID "s27" appare 2 volte
      1. Catalogo Venditori AI [S]
      2. Controllo Consegne [P]
```

### 2. Git Pre-Commit Hook (Automatico)

Il file `.git/hooks/pre-commit` esegue automaticamente la validazione quando:
- Modifichi il file `apps-with-indicators.ts`
- Provi a fare un commit

**Se trova duplicati, il commit viene BLOCCATO.**

## 🔧 Come Funziona

1. Lo script legge `lib/data/apps-with-indicators.ts`
2. Estrae tutti gli ID con regex: `/id:\s*'([^']+)'/g`
3. Conta quante volte appare ogni ID
4. Se un ID appare più di 1 volta → ERRORE
5. Mostra quali app hanno ID duplicati

## 📝 Quando Aggiungere Nuove App

1. Trova il prossimo ID disponibile (es. se l'ultimo è `s38`, usa `s39`)
2. Aggiungi la tua app con ID univoco
3. Esegui `npm run validate-apps` per verificare
4. Se passa la validazione → commit sicuro!

## 🚨 In Caso di Errore

Se il validatore trova duplicati:

1. **Identifica le app coinvolte** (lo script te le mostrerà)
2. **Cambia l'ID** della app più recente (quella aggiunta per ultima)
3. **Usa il prossimo ID disponibile** (es. s39, s40, ecc.)
4. **Ri-esegui la validazione** con `npm run validate-apps`
5. **Commit** solo quando la validazione passa ✅

## 📊 Esempio Pratico

**SBAGLIATO ❌:**
```typescript
{
  id: 's27',  // ← Duplicato!
  name: 'App A',
  ...
},
{
  id: 's27',  // ← Duplicato!
  name: 'App B',
  ...
}
```

**CORRETTO ✅:**
```typescript
{
  id: 's27',
  name: 'App A',
  ...
},
{
  id: 's37',  // ← ID univoco
  name: 'App B',
  ...
}
```

## 🔍 Verifica Stato Attuale

Per vedere tutti gli ID in uso:

```bash
grep "id: 's" lib/data/apps-with-indicators.ts | sort | uniq -c
```

Ogni ID deve apparire **esattamente 1 volta**.

## 📚 File Coinvolti

- `scripts/validate-app-ids.js` - Script di validazione
- `.git/hooks/pre-commit` - Git hook automatico
- `package.json` - Comando npm `validate-apps`
- `lib/data/apps-with-indicators.ts` - File da validare

## ✅ Benefit

- ✅ **Zero duplicati** - Impossibile committare con ID duplicati
- ✅ **Feedback immediato** - Scopri il problema prima del push
- ✅ **Dashboard pulita** - Ogni app appare una sola volta
- ✅ **Facile debugging** - Lo script ti dice esattamente cosa è duplicato
