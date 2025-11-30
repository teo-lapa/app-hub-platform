# Portale Clienti - Mobile Optimization Report

## OBIETTIVO
Ottimizzare TUTTE le pagine del Portale Clienti per dispositivi mobile (Android principalmente), seguendo le dimensioni delle card del Catalogo LAPA come riferimento.

## RIFERIMENTO
**Catalogo LAPA**: `app/catalogo-lapa/page.tsx`
- Grid: `grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8`
- Gap: `gap-2` (compatto per mobile)
- Card padding: `p-2` (compatto)
- Font sizes: `text-xs`, `text-[10px]`, `text-[9px]` per badge

## PATTERN DI OTTIMIZZAZIONE APPLICATO

### Grid Layouts
- **Mobile First**: `grid-cols-2` come base (2 colonne su mobile)
- **Scale up**: `sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`
- **Gap responsivo**: `gap-2 sm:gap-3 md:gap-4 lg:gap-6`

### Padding & Spacing
- **Mobile**: `p-3` (ridotto da `p-6`)
- **Small**: `sm:p-4`
- **Medium**: `md:p-6`
- **Margin**: `mb-3 sm:mb-4 md:mb-6`

### Typography
- **Titoli H1**: `text-xl sm:text-2xl md:text-3xl`
- **Titoli H2**: `text-base sm:text-lg md:text-xl`
- **Testi body**: `text-sm sm:text-base`
- **Testi small**: `text-xs sm:text-sm`
- **Badge/labels**: `text-[10px] sm:text-xs`

### Icone
- **Mobile**: `h-4 w-4` o `h-5 w-5`
- **Desktop**: `sm:h-5 sm:w-5` o `sm:h-6 sm:w-6`

### Buttons
- **Padding**: `px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2`
- **Font**: `text-xs sm:text-sm`
- **Touch-friendly**: min 44px height garantito

## FILE MODIFICATI

### ✅ 1. Dashboard Page (`app/portale-clienti/page.tsx`)
**Modifiche**:
- Container padding: `p-3 sm:p-4 md:p-6` (era `p-6`)
- Spacing: `space-y-3 sm:space-y-4 md:space-y-6` (era `space-y-6`)
- Header layout: `flex-col sm:flex-row` (mobile stacked, desktop inline)
- Header titolo: `text-xl sm:text-2xl md:text-3xl` (era `text-3xl`)
- Header subtitle: `text-xs sm:text-sm md:text-base` (era fisso)
- Pulsante Indietro: `text-xs sm:text-sm` con icone `h-4 w-4 sm:h-5 sm:w-5`
- Pulsante Aggiorna: labels mobili `"Agg."` vs desktop `"Aggiorna"`
- Timestamp: testo responsivo con abbreviazioni mobile

### ✅ 2. KPICards Component (`app/portale-clienti/components/KPICards.tsx`)
**Modifiche**:
- **Grid**: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` (era `md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`)
- **Gap**: `gap-3 sm:gap-4 md:gap-6` (era `gap-6`)
- **Card padding**: `p-3 sm:p-4 md:p-6` (era `p-6`)
- **Icone**: `h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6` (era fisso `h-6 w-6`)
- **Icon container padding**: `p-2 sm:p-2.5 md:p-3` (era `p-3`)
- **Titolo**: `text-xs sm:text-sm` (era `text-sm`)
- **Value**: `text-base sm:text-xl md:text-2xl` (era `text-2xl`)
- **Subtitle**: `text-[10px] sm:text-xs` (era `text-xs`)
- **Alert indicator**: `text-[10px] sm:text-xs` con testi condizionali mobile/desktop
- **Spacing**: `mb-2 sm:mb-3 md:mb-4` (era fisso `mb-4`)

**Impatto**: Le KPI cards ora mostrano 2 colonne su mobile (invece di 1), occupando meglio lo spazio disponibile.

### ✅ 3. QuickActions Component (`app/portale-clienti/components/QuickActions.tsx`)
**Modifiche**:
- **Container padding**: `p-3 sm:p-4 md:p-6` (era `p-6`)
- **Titolo**: `text-base sm:text-lg md:text-xl` (era `text-xl`)
- **Titolo margin**: `mb-3 sm:mb-4 md:mb-6` (era `mb-6`)
- **Grid**: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (MANTENUTO corretto)
- **Gap**: `gap-2 sm:gap-3 md:gap-4` (era `gap-4`)
- **Card padding**: `p-2 sm:p-3 md:p-4` (era `p-4`)
- **Icon container padding**: `p-2 sm:p-2.5 md:p-3` (era `p-3`)
- **Icone**: `h-5 w-5` con responsive per desktop (era `h-6 w-6`)
- **Action title**: `text-xs sm:text-sm` (era `text-sm`)
- **Action description**: `text-[10px] sm:text-xs` (era `text-xs`)
- **Spacing**: `mb-2 sm:mb-2.5 md:mb-3` (era `mb-3`)

**Impatto**: Azioni rapide ora più compatte su mobile, 2 colonne su phone.

### ✅ 4. RecentOrders Component (`app/portale-clienti/components/RecentOrders.tsx`)
**Modifiche**:
- **Container padding**: `p-3 sm:p-4 md:p-6` in tutti gli stati (loading, empty, normal)
- **Header spacing**: `mb-3 sm:mb-4 md:mb-6`
- **Header titolo**: `text-base sm:text-lg md:text-xl` con testi condizionali ("Ordini" mobile, "Ultimi Ordini" desktop)
- **Icone header**: `h-5 w-5 sm:h-6 sm:w-6`
- **Pulsante "Vedi tutti"**: `px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm` con label mobile "Tutti"
- **Lista spacing**: `space-y-2 sm:space-y-3 md:space-y-4`
- **Item padding**: `pl-2 sm:pl-3 md:pl-4 py-2 sm:py-2.5 md:py-3`
- **Nome ordine**: `text-sm sm:text-base` con `truncate` per overflow
- **Data**: `text-xs sm:text-sm` con icona `h-3 w-3 sm:h-3.5 sm:w-3.5`
- **Prezzo**: `text-sm sm:text-base` con icona `h-3 w-3 sm:h-4 sm:w-4`
- **Badge stato**: `text-[10px] sm:text-xs px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1`
- **Footer button**: `py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm`
- **Empty state**: icona `h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16` con padding `py-8 sm:py-10 md:py-12`

**Impatto**: Liste ordini molto più compatte e leggibili su mobile, con overflow gestito tramite truncate.

### 🔄 5. ActiveDeliveries Component (`app/portale-clienti/components/ActiveDeliveries.tsx`)
**Modifiche da applicare** (seguono lo stesso pattern di RecentOrders):
- Container padding: `p-3 sm:p-4 md:p-6`
- Header spacing e font sizes responsive
- Card padding ridotto per mobile
- Badge e icone scalate
- Testi condizionali per label mobile/desktop

### 🔄 6. OpenInvoices Component (`app/portale-clienti/components/OpenInvoices.tsx`)
**Modifiche da applicare**:
- Container padding: `p-3 sm:p-4 md:p-6`
- Alert box responsive
- Lista fatture con spacing compatto
- Currency amounts leggibili su mobile
- Badge stati ottimizzati

### 🔄 7. Lista Ordini (`app/portale-clienti/ordini/page.tsx`)
**Modifiche da applicare**:
- Container padding: `px-3 sm:px-4 md:px-6 lg:px-8`
- Header titolo: `text-xl sm:text-2xl md:text-3xl`
- Filtri grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` con gap ridotto
- Form inputs: sizing mobile-friendly
- Button heights: touch-friendly (min 44px)
- OrderCard spacing: `space-y-3 sm:space-y-4`

### 🔄 8. OrderCard Component (`components/portale-clienti/OrderCard.tsx`)
**Modifiche da applicare**:
- Card padding: `p-3 sm:p-4 md:p-6`
- Layout: `flex-col sm:flex-row` per mobile stacked
- Nome ordine: `text-base sm:text-lg` con truncate
- Badge: `text-xs` compatto
- Icone: `h-3.5 w-3.5 sm:h-4 sm:w-4`
- Button actions: `text-xs sm:text-sm px-2.5 sm:px-3 py-1 sm:py-1.5`
- Totale: `text-xl sm:text-2xl`
- Actions: stack verticale su mobile, inline su desktop

### 🔄 9. Catalogo Prodotti (`app/portale-clienti/catalogo/page.tsx`)
**Modifiche da applicare**:
- Header sticky padding: `px-3 sm:px-4 py-3 sm:py-4`
- Titolo: `text-xl sm:text-2xl`
- Cartbadge: sizing mobile
- Sidebar filtri: collapsible su mobile con toggle
- Main grid: **GIA OTTIMIZZATO** `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3`
- Pagination: buttons responsive con icone

### ✅ 10. ProductCard (GIA OTTIMIZZATO)
Il ProductCard nel catalogo segue già il pattern LAPA:
- Layout compatto con `p-2`
- Badge piccolissimi `text-[9px]`
- Prezzi `text-sm`
- Codice `text-[10px]`
- **NO MODIFICHE NECESSARIE**

### 🔄 11. Dettaglio Ordine (`app/portale-clienti/ordini/[id]/page.tsx`)
**Modifiche da applicare**:
- Container padding: `px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8`
- Breadcrumb: `text-xs sm:text-sm`
- Header card padding: `p-4 sm:p-5 md:p-6`
- Titolo ordine: `text-2xl sm:text-3xl`
- Info grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` con gap ridotto
- Grid principale: `grid-cols-1 lg:grid-cols-3` (single column mobile)
- Tabella prodotti: responsive table → cards su mobile
- Timeline: spacing ridotto
- Fatture/consegne cards: padding compatto
- Action buttons: `flex-col sm:flex-row` stacked mobile

### 🔄 12. Lista Consegne (`app/portale-clienti/consegne/page.tsx`)
**Modifiche da applicare**:
- Container padding: `px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8`
- Header: `text-2xl sm:text-3xl`
- Stats cards grid: `grid-cols-1 sm:grid-cols-3` con gap ridotto
- Stats card padding: `p-4 sm:p-5 md:p-6`
- Stats icone: `w-10 h-10 sm:w-12 sm:h-12`
- Stats value: `text-xl sm:text-2xl`
- Filter buttons: flex wrap su mobile
- Delivery cards: padding ridotto, layout responsive
- Delivery info grid: `grid-cols-1 sm:grid-cols-2`

### 🔄 13. Profilo Cliente (`app/portale-clienti/profilo/page.tsx`)
**Modifiche da verificare e applicare**:
- Stesso pattern di responsiveness
- Form layouts mobile-friendly
- Info cards compatte

## PATTERN TAILWIND MOBILE-FIRST

### Breakpoints
```
Default (no prefix) = mobile (<640px)
sm: ≥640px
md: ≥768px
lg: ≥1024px
xl: ≥1280px
2xl: ≥1536px
```

### Grid Columns Standard
```tsx
// KPI Cards / Stats: 2 colonne mobile
grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5

// Product Cards: 2 colonne mobile, scale up
grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6

// Lists/Forms: single column mobile
grid-cols-1 sm:grid-cols-2 md:grid-cols-3

// Two-column layout: stack mobile
grid-cols-1 lg:grid-cols-2
```

### Spacing Standard
```tsx
// Padding container
p-3 sm:p-4 md:p-6

// Margin bottom
mb-2 sm:mb-3 md:mb-4 lg:mb-6

// Gap
gap-2 sm:gap-3 md:gap-4 lg:gap-6
```

### Typography Standard
```tsx
// H1 Page Title
text-xl sm:text-2xl md:text-3xl

// H2 Section Title
text-base sm:text-lg md:text-xl

// H3 Card Title
text-sm sm:text-base

// Body Text
text-sm sm:text-base

// Small Text
text-xs sm:text-sm

// Tiny Badge/Label
text-[10px] sm:text-xs

// Micro Badge
text-[9px] (mobile only, per badge categorie)
```

### Icons Standard
```tsx
// Small icons
h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4

// Medium icons
h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6

// Large icons (stats, empty states)
h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16
```

### Buttons Standard
```tsx
// Primary Button
px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm

// Small Button
px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs
```

## REGOLE MOBILE-FIRST

1. **Default = Mobile**: Classi senza prefisso sono per mobile
2. **Scale Up**: Aggiungi `sm:` `md:` `lg:` per schermi più grandi
3. **Touch Targets**: Min 44x44px per pulsanti e link cliccabili
4. **Truncate Long Text**: Usa `truncate` o `line-clamp-N` per evitare overflow
5. **Stack su Mobile**: Layout `flex-col sm:flex-row` per stack verticale
6. **Hide Optional Text**: Usa `hidden sm:inline` per testi non essenziali
7. **Conditional Labels**: Versioni abbreviate su mobile ("Agg." vs "Aggiorna")
8. **Responsive Icons**: Icone più piccole su mobile per risparmiare spazio

## STATUS IMPLEMENTAZIONE

### ✅ Completati (100%)
1. Dashboard page
2. KPICards component
3. QuickActions component
4. RecentOrders component

### 🚧 In Progress (Prossimi)
5. ActiveDeliveries component
6. OpenInvoices component
7. Lista Ordini page
8. OrderCard component

### 📋 TODO
9. Catalogo Prodotti page (già 80% fatto)
10. Dettaglio Ordine page
11. Lista Consegne page
12. Profilo Cliente page
13. Altri componenti condivisi (DeliveryCard, CartItemCard, etc.)

## TESTING RACCOMANDATO

### Device Testing
- **iPhone SE** (375px): Card piccolissime, 2 colonne
- **iPhone 12/13** (390px): Standard mobile
- **Samsung Galaxy** (360-412px): Android reference
- **iPad Mini** (744px): Tablet portrait
- **iPad Pro** (1024px): Tablet landscape

### Checklist UI/UX
- [ ] Testi leggibili (min 12px font size)
- [ ] Pulsanti touch-friendly (min 44x44px)
- [ ] Layout non overflow orizzontale
- [ ] Scroll verticale fluido
- [ ] Immagini non pixelate
- [ ] Badge/label leggibili
- [ ] Form inputs accessibili
- [ ] Spacing consistente
- [ ] Transizioni smooth

## NOTE IMPLEMENTAZIONE

- **Non committare**: Solo modifiche ai file, nessun commit git
- **Backup Recommended**: Snapshot prima di applicare tutte le modifiche
- **Incremental Testing**: Testare ogni component dopo modifica
- **Consistency**: Seguire SEMPRE il pattern stabilito
- **Dark Mode**: Tutte le classi mantengono dark: variants

---

**Data Report**: 26 Ottobre 2025
**Status**: In Progress (40% completato)
**Next Steps**: Completare componenti rimanenti seguendo il pattern stabilito
