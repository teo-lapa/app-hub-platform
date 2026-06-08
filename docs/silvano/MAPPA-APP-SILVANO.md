# MAPPA APP — Silvano Barbera (Venditore Plurimandatario)

Area dedicata dentro hub.lapa.ch: **`/silvano`** (già predisposta come "Area Agente Commerciale" nel middleware).
Obiettivo: dare a Silvano tutto ciò che gli serve per vendere — catalogo con margine, creazione preventivi, clienti, ordini, dashboard provvigioni, mappa — riusando il massimo dell'infrastruttura venditori già presente.

Start operativo previsto: ~20 giorni (fine giugno 2026). Deploy: **staging** (`staging.hub.lapa.ch`).

---

## 1. Concetto chiave — Il MARGINE di Silvano

Per ogni prodotto, partendo dal **listino del cliente** (il pricelist già assegnato al cliente in Odoo, es. 5-10m / 10-20m):

```
costo            = product.standard_price            (merce + dazio)
base             = prezzo del listino del cliente     (product.pricelist.get_product_price)
quota_silvano    = SHARE × (base − costo)             SHARE = 0.20 (20% del margine LAPA, ~32% medio)
floor            = base − quota_silvano               (prezzo minimo: sotto non può scendere)
margine(prezzo)  = prezzo − floor                     (mostrato live mentre cambia il prezzo)
```

- Vendendo **a listino** → margine = `quota_silvano` (la sua fetta piena).
- **Scende** col prezzo → il margine scende; a `floor` il margine è **0** e non può andare oltre (LAPA tiene il suo 80%).
- **Sale** sopra il listino → guadagna di più (margine cresce).
- Guardia: se `base ≤ costo` → `floor = costo`, `quota = 0`, badge "prezzo anomalo".
- **SHARE è un parametro unico** in `lib/silvano/config.ts`, modificabile (Paul: "la percentuale la si può sempre giocare").

La **provvigione** di Silvano = somma dei suoi margini sulle righe degli ordini. La dashboard mostra le provvigioni maturate per periodo.

---

## 2. Identità venditore (chi sono "i suoi" clienti/ordini)

- Filtro nativo Odoo: `res.partner.user_id` e `sale.order.user_id` = utente Odoo di Silvano.
- Risoluzione salesperson nelle API:
  1. `odooUserId` dal JWT se ruolo `agente`;
  2. fallback `SILVANO_ODOO_USER_ID` (env / config) finché Silvano non è onboardato;
  3. override admin `?sp=<id>` per anteprima/test in staging.
- Pronto per più venditori in futuro (stessa app, salesperson dal token).

---

## 3. Pagine (App Router, `app/silvano/`)

| Route | Cosa fa |
|---|---|
| `/silvano` (Catalogo) | Selezione cliente in alto → griglia prodotti (foto, disponibilità, in arrivo, prezzo listino). Filtri (ricerca, solo disponibili). Pulsante **"Prodotti già comprati"** dal cliente. Click prodotto → **popup**: descrizione + **prezzo con margine live** (slider/input da `floor` in su) + quantità + "Aggiungi". Carrello laterale → **Crea preventivo** (sale.order draft con i prezzi scelti). |
| `/silvano/clienti` | Lista dei suoi clienti → click → **scheda cliente** (azienda + sotto-contatti `child_ids` + indirizzi consegna + fatture). Read-only (le modifiche passano dall'assistente/bot). |
| `/silvano/ordini` | Default **ordini di domani**, pulsante **oggi**, **calendario** per data. Click ordine → dettaglio righe (qty ordinata/consegnata, prezzo, totale, **suo margine**). Pulsante **PDF**. |
| `/silvano/dashboard` | Suoi KPI: fatturato, margine, **provvigioni maturate**, andamento clienti (+/−), top clienti, fatture (sue da incassare in futuro). |
| `/silvano/mappa` | Mappa dei suoi clienti (coordinate `partner_latitude/longitude`). |

Layout comune: nav superiore Catalogo · Clienti · Ordini · Dashboard · Mappa (stile glassmorphism Tailwind già in uso). Protezione via middleware (`/silvano` richiede token).

---

## 4. API (`app/api/silvano/`) — tutte server-side con `callOdooAsAdmin`, filtrate per salesperson

| Endpoint | Funzione |
|---|---|
| `GET catalog` | Prodotti vendibili + (se `clientId`) prezzo listino cliente, costo, floor, quota, disponibilità, in arrivo. |
| `GET clienti` | Clienti del venditore (`user_id`). |
| `GET cliente/[id]` | Scheda: anagrafica, `child_ids`, indirizzi consegna, fatture (`account.move`). |
| `GET prodotti-cliente/[id]` | Prodotti già acquistati dal cliente (storico righe ordine). |
| `POST crea-ordine` | Crea `sale.order` draft con righe e `price_unit` = prezzo scelto (≥ floor), `user_id` = salesperson, chatter. |
| `GET ordini` | Ordini per data (domani/oggi/range), filtrati salesperson. |
| `GET ordine/[id]` | Dettaglio righe con margine per riga + totale margine. |
| `GET dashboard` | KPI + provvigioni del periodo. |
| `GET mappa` | Clienti con lat/long. |
| `GET ordine/[id]/pdf` | PDF ordine (riusa report Odoo). |

Riuso: `lib/odoo/admin-session.ts` (`callOdooAsAdmin`), pattern da `app/api/catalogo-venditori/*`, calcolo costo/listino da `order-prices`.

---

## 5. Motore margine condiviso — `lib/silvano/`

- `config.ts` — `SHARE`, `SILVANO_ODOO_USER_ID`, costanti (company_id=1).
- `margin.ts` — `computeFloor`, `computeMargin`, `enrichLineWithMargin` (pure, testabili).
- `odoo.ts` — helper: `resolveSalesperson(req)`, `getClientPricelistPrices`, `getClienti`, ecc. su `callOdooAsAdmin`.

---

## 6. Cosa NON facciamo in v1 (YAGNI)
- L'assistente/bot dedicato (tipo Diana) — progetto separato.
- Emissione fattura provvigione di Silvano verso LAPA — per ora solo "provvigioni maturate" calcolate.
- Modifica anagrafica cliente da parte di Silvano — read-only.

---

## 7. Deploy
- Build locale (`npm run build`) per validare.
- Worktree da `origin/staging` (mai da main locale), copia file nuovi, commit, push `staging` → Vercel builda `staging.hub.lapa.ch`.
- Card "Venditore — Silvano [S]" aggiunta al registro app.
