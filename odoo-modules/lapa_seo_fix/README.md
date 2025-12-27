# LAPA SEO Fix Module

## Problema Risolto
Odoo genera automaticamente i meta tag SEO per le pagine prodotto, ignorando i valori personalizzati inseriti nei campi:
- `website_meta_title`
- `website_meta_description`
- `website_meta_keywords`

Questo modulo forza Odoo a usare i valori personalizzati quando sono compilati.

## Installazione

### Metodo 1: Upload diretto in Odoo
1. Comprimi la cartella `lapa_seo_fix` in un file ZIP
2. Vai in Odoo → Apps → Upload module
3. Carica il file ZIP
4. Installa il modulo "LAPA SEO Fix"

### Metodo 2: Via filesystem (server Odoo)
1. Copia la cartella `lapa_seo_fix` nella directory `addons` di Odoo
2. Riavvia il servizio Odoo
3. Vai in Apps → Aggiorna lista moduli
4. Cerca e installa "LAPA SEO Fix"

### Metodo 3: Via Odoo.sh
1. Aggiungi la cartella al repository Git del tuo progetto Odoo.sh
2. Fai commit e push
3. Installa il modulo dalla lista Apps

## Funzionamento

### Meta Description
- **Se `website_meta_description` è compilato**: usa quel valore
- **Se è vuoto**: genera automaticamente con il pattern:
  ```
  Acquista [Nome Prodotto Pulito] da LAPA, grossista prodotti italiani in Svizzera. [Categoria]. Consegna rapida, qualità garantita.
  ```

### Meta Title
- **Se `website_meta_title` è compilato**: usa quel valore
- **Se è vuoto**: genera automaticamente:
  ```
  [Nome Prodotto Pulito] | LAPA Svizzera
  ```

### Keywords
- **Se `website_meta_keywords` è compilato**: usa quel valore
- **Se è vuoto**: genera dalle parole del nome prodotto + keywords LAPA base

## Compatibilità
- Odoo 17.0
- Richiede: `website_sale`

## Note Tecniche
Il modulo:
1. Estende `product.template` per override di `_default_website_meta()`
2. Estende `product.public.category` per le categorie
3. Override del controller `WebsiteSale._prepare_product_values()` per le pagine prodotto

## Autore
LAPA SA - https://www.lapa.ch
