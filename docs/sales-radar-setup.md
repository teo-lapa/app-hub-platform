# Sales Radar - Configurazione Google Maps API

## Panoramica

Sales Radar (Dashboard Venditori) utilizza le Google Maps API per fornire funzionalità di geolocalizzazione e navigazione verso i clienti. Questo documento fornisce una guida completa alla configurazione delle API necessarie.

## Stato Attuale Configurazione

### Variabili d'Ambiente Configurate

#### File `.env.local`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyDxuQvGkiJQL8vcP2eudQCWP0MninPmucQ"` (Configurata)

#### Vercel Environment Variables
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Configurata su tutti gli ambienti:
  - Production
  - Preview
  - Development

### Utilizzo nel Codice

La API key è utilizzata nei seguenti componenti:

1. **`app/dashboard-venditori/components/ClientPopup.tsx`** (linea 36-40)
   - Genera URL Google Maps per la navigazione verso i clienti
   - Funzionalità: Apre Google Maps con indirizzo del cliente
   - Tipo: Link esterno (non richiede API key)

2. **`app/delivery/components/DeliveryMap.tsx`** (linea 25)
   - Carica Google Maps JavaScript API
   - Utilizzata per mappe interattive delle consegne

3. **`app/portale-clienti/consegne/[id]/page.tsx`** (linea 15, 288-289)
   - Tracking consegne in tempo reale
   - Utilizza componente LoadScript

4. **`app/api/delivery/optimize-route/route.ts`** (linea 3, 40)
   - Ottimizzazione percorsi di consegna
   - Utilizza Directions API

5. **`app/api/delivery/calculate-eta/route.ts`** (linea 3, 19)
   - Calcolo tempi di arrivo stimati
   - Utilizza Directions API

## API Google Cloud da Abilitare

Per il corretto funzionamento di Sales Radar e delle funzionalità di delivery, è necessario abilitare le seguenti API su Google Cloud Console:

### 1. Maps JavaScript API
- **Scopo**: Visualizzazione mappe interattive
- **Utilizzato in**: DeliveryMap, tracking consegne
- **Link**: https://console.cloud.google.com/apis/library/maps-backend.googleapis.com

### 2. Places API (New)
- **Scopo**: Ricerca e dettagli luoghi, autocompletamento indirizzi
- **Utilizzato in**: Potenziale uso futuro per validazione indirizzi clienti
- **Link**: https://console.cloud.google.com/apis/library/places-backend.googleapis.com

### 3. Geocoding API
- **Scopo**: Conversione indirizzi in coordinate GPS e viceversa
- **Utilizzato in**: Geolocalizzazione clienti, ottimizzazione percorsi
- **Link**: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com

### 4. Directions API
- **Scopo**: Calcolo percorsi e tempi di viaggio
- **Utilizzato in**: Ottimizzazione percorsi delivery, calcolo ETA
- **Link**: https://console.cloud.google.com/apis/library/directions-backend.googleapis.com

### 5. Distance Matrix API
- **Scopo**: Calcolo distanze e tempi tra molteplici origini e destinazioni
- **Utilizzato in**: Ottimizzazione multi-consegna
- **Link**: https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com

## Procedura di Configurazione

### Step 1: Creazione/Verifica Progetto Google Cloud

1. Accedi a [Google Cloud Console](https://console.cloud.google.com)
2. Verifica il progetto esistente o creane uno nuovo
3. Assicurati che la fatturazione sia abilitata (richiesto per le API)

### Step 2: Abilitazione API

Per ciascuna API elencata sopra:

1. Vai su **API e Servizi > Libreria**
2. Cerca il nome dell'API (es. "Maps JavaScript API")
3. Clicca sull'API e premi **"Abilita"**
4. Ripeti per tutte le API necessarie

### Step 3: Verifica/Creazione API Key

1. Vai su **API e Servizi > Credenziali**
2. Verifica se esiste già una API key valida
3. Se non esiste, clicca **"Crea credenziali" > "Chiave API"**
4. Copia la chiave generata

### Step 4: Configurazione Restrizioni API Key

#### Restrizioni Applicazione (Consigliato)

**Per ambiente di produzione:**
```
Tipo restrizione: Riferimenti HTTP (siti web)
Domini autorizzati:
- https://app-hub-platform.vercel.app/*
- https://*.vercel.app/*  (per preview deployments)
- http://localhost:3000/* (per sviluppo locale)
```

**Per API backend (optimize-route, calculate-eta):**
- Considerare una chiave separata con restrizione "Indirizzi IP"
- Inserire gli IP dei server Vercel (disponibili nella dashboard Vercel)

#### Restrizioni API

Limitare la chiave alle sole API necessarie:
- Maps JavaScript API
- Places API (New)
- Geocoding API
- Directions API
- Distance Matrix API

### Step 5: Aggiornamento Variabili d'Ambiente

#### Sviluppo Locale (.env.local)
```bash
# Google Maps API Key per Sales Radar e Delivery
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="la-tua-api-key-qui"

# Opzionale: chiave separata per backend
GOOGLE_MAPS_API_KEY="la-tua-api-key-backend-qui"
```

#### Vercel (Production/Preview/Development)
```bash
# Già configurato, ma per aggiornamenti:
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY production preview development
```

## Stima Costi

Google Cloud offre un credito mensile gratuito per le Maps API. Oltre questo credito, i costi sono:

### Credito Gratuito Mensile
- **$200 USD** di utilizzo gratuito ogni mese
- Equivalente a circa:
  - 28.000 caricamenti mappe interattive
  - 40.000 richieste Geocoding
  - 40.000 richieste Directions

### Prezzi per API (dopo credito gratuito)

| API | Costo per 1000 richieste | Stima Mensile* |
|-----|-------------------------|----------------|
| Maps JavaScript API (caricamento mappa) | $7.00 | $0-20 |
| Geocoding API | $5.00 | $0-10 |
| Directions API | $5.00 | $0-15 |
| Distance Matrix API | $5.00 | $0-10 |
| Places API (New) | $17.00 per 1000 | $0-5 |

**Stima totale mensile: $0-60 USD** (per utilizzo medio)

### Ottimizzazione Costi

1. **Caching**: Implementare caching per richieste ripetute
2. **Batch requests**: Utilizzare Distance Matrix per richieste multiple
3. **Client-side**: Preferire Maps JavaScript API (più economica)
4. **Monitoraggio**: Impostare alert su Google Cloud Console

## Monitoraggio Utilizzo

### Dashboard Google Cloud

1. Vai su **API e Servizi > Dashboard**
2. Seleziona l'intervallo di tempo (ultime 24h, 7 giorni, 30 giorni)
3. Visualizza:
   - Richieste per API
   - Errori e latenza
   - Costi stimati

### Alert Budget

1. Vai su **Fatturazione > Budget e avvisi**
2. Crea un nuovo budget:
   - Nome: "Google Maps APIs Budget"
   - Budget mensile: $50 (o il tuo limite)
   - Alert al 50%, 90% e 100% del budget
3. Configura notifiche email

## Troubleshooting

### Errore: "This API key is not authorized..."

**Causa**: Restrizioni troppo stringenti sulla API key

**Soluzione**:
1. Vai su **Credenziali** in Google Cloud Console
2. Modifica la API key
3. Verifica che:
   - Il dominio sia autorizzato correttamente
   - Le API necessarie siano selezionate nelle restrizioni
   - Non ci siano errori di sintassi nei riferimenti HTTP

### Errore: "API key missing or invalid"

**Causa**: Variabile d'ambiente non configurata correttamente

**Soluzione**:
1. Verifica `.env.local`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="..."`
2. Riavvia il server di sviluppo: `npm run dev`
3. Su Vercel: verifica le environment variables nella dashboard

### Le mappe non si caricano

**Causa**: API non abilitata o billing non attivo

**Soluzione**:
1. Verifica che Maps JavaScript API sia abilitata
2. Controlla che la fatturazione sia attiva sul progetto
3. Controlla la console del browser per messaggi di errore specifici

### Costi inaspettatamente alti

**Causa**: Loop infiniti o troppi caricamenti mappa

**Soluzione**:
1. Implementa debouncing per geocoding automatico
2. Limita il re-rendering dei componenti mappa
3. Usa singleton pattern per LoadScript
4. Verifica log API per identificare endpoint costosi

## Riferimenti

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Google Cloud Console](https://console.cloud.google.com)
- [Google Maps Platform Pricing](https://mapsplatform.google.com/pricing/)
- [Best Practices for API Keys](https://developers.google.com/maps/api-security-best-practices)

## Contatti e Supporto

Per problemi di configurazione o domande:
- **Google Cloud Support**: https://cloud.google.com/support
- **Community Stack Overflow**: [google-maps] tag
- **Documentazione progetto**: Vedere altri file in `/docs`

---

**Ultimo aggiornamento**: 2025-11-19
**Versione documento**: 1.0
**Responsabile configurazione**: DevOps Team
