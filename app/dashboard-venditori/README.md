# 📊 Dashboard Venditori - LAPA

App completa per la gestione e analisi dei clienti di vendita, trasformata da HTML a TSX con integrazione Odoo.

## 🎯 Funzionalità Principali

### 1. **Selezione Team Vendite**
- Dropdown per selezionare team specifici
- Visualizzazione membri, target e fatturato team
- Sistema di permessi per utenti e team

### 2. **Dashboard Statistiche**
- Card con metriche in tempo reale:
  - Totale clienti
  - Fatturato settimanale
  - Ordini totali
  - Allerte clienti inattivi

### 3. **Lista Clienti Filtrata**
- Grid responsiva con card clienti
- Filtri disponibili:
  - 🔄 Tutti
  - ✅ Attivi
  - ⚠️ Attenzione
  - ❌ Inattivi
  - 📉 Non Attivi 5 Settimane
  - 📉 In Calo 5 Settimane
- Ricerca per nome, email, indirizzo
- Health Score visualizzato per ogni cliente
- Grafici settimanali trend

### 4. **Popup Dettaglio Cliente**
- Health Score cliente
- Metriche dettagliate (fatturato, ordini, media, ultimo ordine)
- Suggerimenti AI
- Quick Actions:
  - 📞 Chiama
  - 💬 WhatsApp
  - 📧 Email
  - 📍 Google Maps
  - 📊 Dashboard Dettagliata
  - 💰 Analisi Finanziaria

### 5. **Dashboard Avanzata**
- Grafici settimanali:
  - Andamento valore ordini
  - Andamento numero ordini
- Top prodotti ultimi 30 giorni
- Confronto con altri clienti del team
- Analisi AI con:
  - Insights intelligenti
  - Raccomandazioni strategiche
  - Opportunità di business
- Sistema di note cliente

### 6. **Dashboard Finanziaria**
- Panoramica finanziaria:
  - Fatture pagate
  - In sospeso (non scadute)
  - Scadute non pagate
- Indicatori di rischio:
  - Score solvibilità
  - Giorni medi ritardo
  - Percentuale pagamenti in ritardo
- Grafico andamento pagamenti ultimi 6 mesi
- Lista ultime 5 fatture con stato

## 🔒 Sistema di Sicurezza e Permessi

### Controllo Accessi

L'app implementa un sistema di permessi robusto basato su utenti Odoo:

```typescript
const USER_TEAM_PERMISSIONS = {
  407: [1],    // Domingos Ferreira → I Maestri del Sapore
  14: [12],    // Mihai Nita → I Custodi della Tradizione
  121: [9],    // Alessandro Motta → I Campioni del Gusto
  7: 'ALL',    // Paul Teodorescu → SUPER ADMIN
  8: 'ALL',    // Laura Teodorescu → SUPER ADMIN
  249: 'ALL'   // Gregorio Buccolieri → SUPER ADMIN
};
```

### Regole di Accesso

1. **Utenti Standard**: Possono vedere solo i team assegnati
2. **Super Admin ('ALL')**: Possono vedere tutti i team
3. **Utenti Non Autorizzati**: Ricevono un errore e non possono accedere

### Filtri di Sicurezza

- ✅ Filtro per `team_id` su aziende
- ✅ Solo aziende MADRE (`parent_id = false`)
- ✅ Solo clienti (`customer_rank > 0`)
- ✅ Solo ordini confermati (`state in ['sale', 'done']`)

## 🚀 Performance e Caching

### Sistema di Cache

```typescript
const performanceCache = {
  ttl: 5 * 60 * 1000, // 5 minuti
  set(key, value),
  get(key),
  clear()
};
```

- Cache degli ordini per team (5 minuti)
- Riduce chiamate API a Odoo
- Migliora significativamente le performance

## 📋 Struttura File

```
dashboard-venditori/
├── page.tsx                          # Pagina principale
├── components/
│   ├── TeamSelector.tsx              # Selezione team
│   ├── StatsGrid.tsx                 # Grid statistiche
│   ├── ClientFilters.tsx             # Filtri clienti
│   ├── ClientGrid.tsx                # Grid clienti
│   ├── ClientPopup.tsx               # Popup dettaglio cliente
│   ├── AdvancedDashboard.tsx         # Dashboard avanzata
│   └── FinancialDashboard.tsx        # Dashboard finanziaria
├── hooks/
│   └── useOdooData.ts                # Hook gestione dati Odoo
└── README.md                         # Questa documentazione
```

## 🔧 Integrazione Odoo

### Endpoint Utilizzati

1. **Sessione Utente**: `/web/session/get_session_info`
2. **Chiamate RPC**: `/web/dataset/call_kw`

### Modelli Odoo

- `res.partner` - Clienti e aziende
- `crm.team` - Team di vendita
- `sale.order` - Ordini di vendita
- `account.move` - Fatture (futuro)

### Chiamate RPC

```typescript
await callOdoo(
  'crm.team',           // Model
  'search_read',        // Method
  [[['id', 'in', LAPA_TEAM_IDS]]],  // Domain
  { fields: [...] }     // Kwargs
);
```

## 🎨 Styling

- **Framework**: Tailwind CSS
- **Design**: Moderno, pulito, responsivo
- **Colori**:
  - Primary: Blue-600
  - Secondary: Emerald-600
  - Success: Green
  - Warning: Amber
  - Error: Red

## 📱 Responsività

- ✅ Mobile-first design
- ✅ Grid adattativa
- ✅ Touch-friendly
- ✅ Ottimizzato per tablet e desktop

## 🔄 Stati Applicazione

### Loading States
- Spinner durante caricamento
- Skeleton screens per componenti
- Feedback visivo immediato

### Error States
- Messaggi di errore chiari
- Gestione errori di rete
- Fallback per dati mancanti

### Empty States
- Messaggio quando nessun cliente trovato
- Suggerimenti per l'utente

## 🧪 Testing

Per testare l'applicazione:

1. Assicurati di essere autenticato su Odoo
2. Naviga su `/dashboard-venditori`
3. Seleziona un team dal dropdown
4. Verifica che i clienti vengano caricati
5. Testa i filtri e la ricerca
6. Clicca su un cliente per aprire i dettagli
7. Testa le dashboard avanzate

## 📈 Metriche Calcolate

### Health Score
```
Base: 50
+ Ordini (max +20)
+ Fatturato (max +20)
+ Ultimo ordine (max +10)
= Totale (0-100)
```

### Status Cliente
- **Attivo**: Health Score ≥ 70
- **Warning**: Health Score 40-69
- **Inattivo**: Health Score < 40

## 🔮 Sviluppi Futuri

- [ ] Integrazione AI reale per suggerimenti
- [ ] Export report in PDF
- [ ] Sistema di notifiche push
- [ ] Analytics avanzati con grafici Chart.js
- [ ] Pianificazione follow-up automatica
- [ ] Sistema note condiviso tra venditori
- [ ] Dashboard finanziaria con dati reali da account.move
- [ ] Previsioni vendite con ML

## 👥 Team IDs LAPA

```typescript
const LAPA_TEAM_IDS = [5, 9, 12, 8, 1, 11, 14];
```

Questi IDs corrispondono ai team reali configurati in Odoo LAPA.

## 📝 Note Importanti

1. **Sicurezza**: Tutti gli accessi sono verificati lato server via Odoo
2. **Performance**: Sistema di cache per ridurre carico su Odoo
3. **Debug**: Modalità debug attivabile tramite `DEBUG_MODE = true`
4. **Compatibilità**: Testato su Chrome, Firefox, Safari, Edge

## 🆘 Troubleshooting

### Problema: "Utente non ha permessi"
**Soluzione**: Verificare che l'ID utente sia in `USER_TEAM_PERMISSIONS`

### Problema: "Nessun cliente trovato"
**Soluzione**: Verificare che il team abbia aziende con `team_id` corretto

### Problema: "Errore di connessione Odoo"
**Soluzione**: Verificare di essere autenticati su Odoo e che l'endpoint sia raggiungibile

---

**Versione**: 1.0.0
**Data**: Ottobre 2024
**Autore**: LAPA Team
**Licenza**: Proprietaria
