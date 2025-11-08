# Analisi Prodotto - UI Description

## Layout Generale

### Color Scheme
```css
Background: gradient-to-br from-slate-900 via-blue-900 to-slate-900
Form Background: white/10 backdrop-blur-lg
Cards: white/10 backdrop-blur-lg
Borders: white/20
Text Primary: white
Text Secondary: blue-200
Accent: blue-500 to purple-500
```

## Componenti UI

### 1. Header
```
┌─────────────────────────────────────────────────────────┐
│  [TrendingUp Icon] Analisi Prodotto    [← Dashboard]   │
│  Analizza vendite, clienti e stock di un prodotto      │
└─────────────────────────────────────────────────────────┘
```

**Elementi:**
- Icona TrendingUp (w-10 h-10) blu
- Titolo H1 (text-4xl) bianco bold
- Sottotitolo (text-blue-200)
- Bottone Dashboard (destra, white/10 bg)

**Animazione:**
- Fade in from top (y: -20 → 0)
- Durata: 300ms

---

### 2. Search Form (Sticky)
```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────┬──────────┬──────────┬────────┐       │
│  │  Prodotto    │ Da       │ A        │        │       │
│  │  [🔍 Search] │ [📅 Date]│ [📅 Date]│ [Analiz]│       │
│  │     ▼        │          │          │        │       │
│  │  Suggestions │          │          │        │       │
│  └──────────────┴──────────┴──────────┴────────┘       │
│  ⚠️ La data di fine deve essere >= data inizio         │
└─────────────────────────────────────────────────────────┘
```

**Grid Layout:**
```css
md:grid-cols-12
- Prodotto: col-span-5 (autocomplete)
- Data Da: col-span-3 (date picker)
- Data A: col-span-3 (date picker)
- Bottone: col-span-1 (analizza)
```

**Autocomplete Dropdown:**
```
┌──────────────────────────────────┐
│ [📦] Pomodori Ciliegini         │ ← hover:bg-white/10
│     POM-001                      │
├──────────────────────────────────┤
│ [📦] Pomodori Datterini          │
│     POM-002                      │
├──────────────────────────────────┤
│ [📦] Pomodori San Marzano        │
│     POM-003                      │
└──────────────────────────────────┘
```

**Features:**
- Search icon left (absolute left-3)
- Spinner right durante ricerca (absolute right-3)
- Clear X button quando selezionato
- Dropdown absolute con z-20
- Max height 80vh con scroll

---

### 3. Loading State
```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│                    [⚙️ Spinner]                         │
│                 Analisi in corso...                     │
│       Recupero dati da Odoo e calcolo statistiche       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Elementi:**
- Loader2 icon (w-16 h-16) spinning
- Testo principale (text-xl) bianco
- Sottotesto (text-sm) blu-300
- Centered verticalmente

---

### 4. Error State
```
┌─────────────────────────────────────────────────────────┐
│  [⚠️] Errore durante l'analisi                          │
│       Prodotto "XYZ" non trovato in Odoo                │
└─────────────────────────────────────────────────────────┘
```

**Style:**
- Background: red-500/20
- Border: red-400/30
- Icon: AlertCircle red-400 (w-6 h-6)
- Testo: red-400 (heading), red-300 (body)

---

### 5. Empty State
```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│                  [📈 TrendingUp Circle]                 │
│                                                          │
│                 Inizia un'analisi                       │
│    Seleziona un prodotto e un periodo per              │
│    visualizzare statistiche dettagliate                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Elementi:**
- Cerchio bg-white/5 (p-8 rounded-full)
- Icon TrendingUp blu-400 (w-16 h-16)
- Heading text-2xl bianco
- Testo text-blue-300 centrato

---

### 6. Dashboard - Header
```
┌─────────────────────────────────────────────────────────┐
│  Pomodori Ciliegini Bio 500g                            │
│  [📦 Stock: 150 KG] [💰 CHF 5.50/KG] [Fornitore: ABC]  │
│  📅 01/08/2024 - 01/11/2024 (92 giorni)    [PDF][Excel]│
└─────────────────────────────────────────────────────────┘
```

**Layout:**
- Background: gradient slate-800 to slate-900
- Padding: p-6
- Border: white/10
- Rounded: 2xl

**Export Buttons:**
- PDF: gradient red-500 to pink-500
- Excel: gradient green-500 to emerald-500
- Icons: Download (w-4 h-4)
- Hover: darker gradient

---

### 7. KPI Cards
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ [🛒]    +15%│ [💰]    +15%│ [👥]        │ [⚠️]        │
│ 450 KG      │ CHF 2,475   │ 25          │ 21 giorni   │
│ Qtà Venduta │ Revenue Tot │ Clienti     │ Giorni Stock│
│ 5 KG/giorno │ 27.5 CHF/gg │ Top: Mario  │ ADEQUATE    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Grid:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

**Card Style:**
- Background: gradient (blue/green/purple/orange)
- Padding: p-6
- Rounded: xl
- Shadow: lg
- Text: white

**Trend Badge:**
- Position: top-right
- Icon + percentage
- Color: green (up) / red (down)

**Layout per Card:**
```
┌──────────────────────┐
│ [Icon]         [+15%]│  ← Top row
│                      │
│ 450 KG              │  ← Value (text-3xl)
│ Quantità Venduta    │  ← Label (text-sm)
│ 5 KG/giorno         │  ← Subtitle (text-xs)
└──────────────────────┘
```

---

### 8. View Selector
```
┌─────────────────────────────────────────────────────────┐
│  [Panoramica] [Clienti] [Timeline]                      │
└─────────────────────────────────────────────────────────┘
```

**Style:**
- Active: bg-blue-600 text-white
- Inactive: bg-white/10 text-blue-200 hover:bg-white/20
- Rounded: lg
- Padding: px-4 py-2
- Font: semibold

---

### 9. Vista Panoramica
```
┌────────────────────┬────────────────────┐
│ Analisi Stock      │ Performance Vendite│
│ ────────────────── │ ────────────────── │
│ Stock: 150 KG      │ Tot: 450 KG        │
│ Giorni: 21         │ Media: 5 KG/gg     │
│ Riordino: 100 KG   │ Revenue: 2,475 CHF │
│ Suggerito: 150 KG  │ [Trend +15%] ▲     │
│ [STATUS: ADEQUATE] │                    │
└────────────────────┴────────────────────┘
```

**Grid:** `grid-cols-1 md:grid-cols-2`

**Status Badge:**
```css
critical: gradient red-500 to red-600
low: gradient orange-500 to orange-600
adequate: gradient green-500 to green-600
high: gradient blue-500 to blue-600
```

---

### 10. Vista Clienti
```
┌─────────────────────────────────────────────────────────┐
│  Top Clienti (10)                                       │
│  ───────────────────────────────────────────────────    │
│  [1] Ristorante Da Mario                    120 KG     │
│      5 ordini                               CHF 660.00  │
│  ───────────────────────────────────────────────────    │
│  [2] Hotel Bellavista                       80 KG      │
│      3 ordini                               CHF 440.00  │
│  ───────────────────────────────────────────────────    │
│  [3] Pizzeria Napoli                        65 KG      │
│      4 ordini                               CHF 357.50  │
└─────────────────────────────────────────────────────────┘
```

**Customer Card:**
- Background: white/5 hover:white/10
- Padding: p-4
- Rounded: xl
- Transition: all

**Number Badge:**
- Size: w-10 h-10
- Background: gradient blue-500 to purple-500
- Text: white bold
- Rounded: full
- Centered: flex items-center justify-center

**Layout:**
```
┌──────────────────────────────────────────┐
│  [1]  Nome Cliente           120 KG     │
│       5 ordini               CHF 660    │
└──────────────────────────────────────────┘
```

---

### 11. Vista Timeline
```
┌─────────────────────────────────────────────────────────┐
│  Timeline Vendite Giornaliere                           │
│  ───────────────────────────────────────────────────    │
│  01/11/24  ████████████████ 6 KG        CHF 33   2 ord │
│  02/11/24  ██████████ 4.5 KG            CHF 24.7  1 ord │
│  03/11/24  ██████████████████████ 7 KG  CHF 38.5  3 ord │
└─────────────────────────────────────────────────────────┘
```

**Bar Layout:**
```
┌───────┬──────────────────────────┬────────┬────────┐
│ Date  │ Bar Graph                │ Revenue│ Orders │
│ w-28  │ flex-1                   │ w-32   │ w-20   │
└───────┴──────────────────────────┴────────┴────────┘
```

**Bar Style:**
- Background container: blue-500/20 rounded-full h-8
- Bar fill: gradient blue-500 to purple-500
- Width: dynamic based on max value
- Animation: width from 0 to final
- Text inside: quantity + uom (white, right-aligned)

**Date Format:** DD/MM/YY (Italian)

---

### 12. Toast Notifications
```
┌─────────────────────────────────────┐
│  ✅ Analisi completata con successo│  ← Success
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ❌ Errore durante l'analisi        │  ← Error
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ℹ️  Seleziona un prodotto         │  ← Info
└─────────────────────────────────────┘
```

**Position:** top-center
**Duration:** 3000ms
**Style:** react-hot-toast default

---

## Responsive Breakpoints

### Desktop (lg+)
```
Header: 1 row
Form: 12-col grid (5-3-3-1)
KPIs: 4 columns
Dashboard: 2 columns
Timeline: Full width bars
```

### Tablet (md)
```
Header: 1 row
Form: 12-col grid stacked
KPIs: 2 columns (2x2 grid)
Dashboard: 2 columns
Timeline: Shorter bars
```

### Mobile (sm)
```
Header: Stacked
Form: Single column (stacked)
KPIs: 1 column (4 rows)
Dashboard: 1 column
Timeline: Scrollable horizontal
```

## Animations

### Page Load
```typescript
Form: fade-in + slide-from-top (y: -20)
Cards: staggered (delay: index * 0.05)
```

### State Transitions
```typescript
Loading → Success: fade-in
Error: shake animation
Empty → Dashboard: slide-up
```

### Interactions
```typescript
Hover buttons: scale(1.05)
Hover cards: bg-white/10 + scale(1.02)
Click ripple: none (simple color change)
```

### Charts
```typescript
Bars: width animation (0 → 100%)
Duration: 500ms
Easing: ease-out
Delay: index * 0.02s (stagger)
```

## Accessibility

### Keyboard Navigation
```
Tab: Focus visibile (ring-2 ring-blue-500)
Enter: Submit form / Select item
Escape: Close dropdown
Arrows: Navigate suggestions
```

### Screen Readers
```
Labels: Semantic <label> tags
ARIA: aria-label on icons
Role: role="button" on clickables
Alt: Alt text on images/icons
```

### Colors
```
Contrast: WCAG AA compliant
Focus: 2px blue ring
Error: Red with icon
Success: Green with icon
```

## Performance

### Optimizations
```
Debounce: 300ms on search
Lazy render: Dropdown only when open
Memo: None (components simple)
Virtualization: None (small lists)
```

### Load Times
```
Form render: < 100ms
Search query: ~300ms
API response: 2-10s
Dashboard render: < 200ms
Chart animation: 500ms
```

## Print View (Future)
```css
@media print {
  .no-print { display: none; }
  .bg-gradient-* { background: white; }
  .text-white { color: black; }
  .border-white { border: black; }
}
```

---

## Color Reference

### Backgrounds
```css
Page: from-slate-900 via-blue-900 to-slate-900
Glass: white/10 backdrop-blur-lg
Card: white/5
Hover: white/20
```

### Text
```css
Primary: white
Secondary: blue-200
Muted: blue-300
Disabled: white/50
```

### Status Colors
```css
Success: green-400
Warning: orange-400
Error: red-400
Info: blue-400
```

### Gradients
```css
Primary: from-blue-500 to-purple-500
Success: from-green-500 to-emerald-500
Error: from-red-500 to-pink-500
Warning: from-orange-500 to-yellow-500
```

---

**Last Updated**: 2024-11-03
**Version**: 1.0.0
**Design System**: Tailwind CSS + Custom Gradients
