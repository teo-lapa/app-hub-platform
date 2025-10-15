# Sistema Logo Dinamico LAPA

## Overview
La piattaforma LAPA utilizza un sistema di logo dinamico che cambia automaticamente ogni giorno della settimana.

## Configurazione

### Logo Fisso (Esterno - PWA)
- **File**: `/public/logos/logo-monday.png` (Tech Globo Oro)
- **Uso**: Icona della PWA installata, favicon, app icons
- **Motivo**: Logo con scritta dorata più professionale e riconoscibile

### Logo Dinamico (Interno - Piattaforma)
Il logo cambia automaticamente in base al giorno della settimana:

| Giorno | Logo | File | Stile |
|--------|------|------|-------|
| Lunedì | Tech Globo Oro | `logo-monday.png` | Mappamondo tech con scritta dorata |
| Martedì | Tech Globo | `logo-tuesday.png` | Mappamondo tech standard |
| Mercoledì | Classico | `logo-wednesday.png` | Disegno tradizionale |
| Giovedì | Moderno Colorato | `logo-thursday.png` | Stile artistico moderno |
| Venerdì | Minimalista | `logo-friday.png` | Design pulito e minimalista |
| Sabato | Tech Neon | `logo-saturday.png` | Effetto neon ciano |
| Domenica | Elegante Oro | `logo-sunday.png` | Premium con dettagli oro |

## Utilizzo

### Componente DynamicLogo
```tsx
import DynamicLogo from '@/app/components/DynamicLogo';

// Logo che cambia automaticamente ogni giorno
<DynamicLogo size={120} className="my-logo" />
```

### LogoShowcase
```tsx
import LogoShowcase from '@/app/components/LogoShowcase';

// Galleria interattiva di tutti i loghi
<LogoShowcase />
```

## Features
- ✅ Cambio automatico giornaliero
- ✅ Animazioni smooth di entrata
- ✅ Effetti hover interattivi
- ✅ Click per selezionare manualmente
- ✅ Dimensioni uniformi
- ✅ Responsive su tutti i dispositivi
- ✅ Performance ottimizzate (Next.js Image)

## Aggiornare le Icone PWA
Per usare il logo di lunedì come icona fissa:

1. Aprire `/generate-pwa-icons.html` nel browser
2. Scaricare tutte le dimensioni (72x72 fino a 512x512)
3. Sostituire i file in `/public/icons/`
4. Rebuild della PWA

## File Locations
- Loghi: `/public/logos/`
- Componenti: `/app/components/DynamicLogo.tsx` e `LogoShowcase.tsx`
- CSS Animazioni: `/app/globals.css`
- Manifest PWA: `/public/manifest.json`
