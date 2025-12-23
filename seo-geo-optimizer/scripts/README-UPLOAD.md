# 📚 GUIDA UPLOAD ARTICOLI SU ODOO

## 🎯 SCRIPT DA USARE

### Script Principale (Singolo Articolo)
**`upload-article-final.ts`** - Carica UN articolo con traduzioni

```bash
npx tsx scripts/upload-article-final.ts data/new-articles/article-02-burrata-andria-dop.json
```

**Cosa fa:**
- Crea articolo in italiano (blog_id: 4)
- Aggiunge meta fields per tutte le lingue (de_CH, fr_CH, en_US)
- Traduce automaticamente i segmenti con matching intelligente
- Raggiunge 38-97% di traduzione (media 70-75%)

**Strategie di matching:**
1. Table cells (matching posizionale)
2. Headings (matching posizionale)
3. List items (matching posizionale)
4. Inline tags `<strong>`, `<em>`, etc. (matching posizionale)
5. Paragraphs (matching posizionale + fuzzy)

---

### Script per Caricamento Multiplo
**`upload-all-articles-final.ts`** - Carica TUTTI gli articoli

```bash
npx tsx scripts/upload-all-articles-final.ts
```

**Cosa fa:**
- Cerca tutti i file `article-*.json` in `data/new-articles/`
- Li carica uno per uno usando `upload-article-final.ts`
- Mostra riepilogo finale con ID e percentuali

---

## 📊 PERCENTUALI DI TRADUZIONE

Le percentuali variano in base alla struttura HTML dell'articolo:

- **88-97%**: Articoli con struttura semplice (tabelle, liste ben definite)
- **66-80%**: Articoli con struttura media (mix di paragrafi e liste)
- **38-64%**: Articoli con struttura complessa (paragrafi lunghi, nested HTML)

**Perché non 100%?**
1. Odoo normalizza alcuni segmenti dopo l'update delle traduzioni
2. Alcuni segmenti sono identici in tutte le lingue (numeri, date, nomi propri)
3. Paragrafi complessi con HTML nested sono difficili da matchare perfettamente

---

## ✅ DOPO IL CARICAMENTO

1. **Controlla su Odoo**: Gli articoli sono in BOZZA (non pubblicati)
2. **Verifica traduzioni**: Controlla manualmente le percentuali
3. **Revisiona contenuto**: Controlla che tutto sia corretto
4. **Pubblica**: Imposta `is_published = true` quando pronto

---

## 🗑️ SCRIPT ELIMINATI

Ho rimosso tutti gli script di test (v1-v10). Gli unici script necessari sono:

- ✅ `upload-article-final.ts` - Upload singolo
- ✅ `upload-all-articles-final.ts` - Upload multiplo
- ✅ `analyze-untranslated.cjs` - Debug (opzionale)

---

## 📝 NOTE TECNICHE

### Limiti di Odoo
- Il sistema di traduzione di Odoo usa segmenti
- Scrivere il campo `content` per ogni lingua NON funziona (sovrascrive tutto)
- L'unico modo funzionante è `update_field_translations`

### Perché questo approccio
Dopo 10 versioni di test (v1-v10), questo è l'approccio migliore:
- V8-perfect (ora `final`) usa matching intelligente con 6 strategie
- V10 (write full content) NON funziona - Odoo sovrascrive tutto
- 70-75% medio è il massimo raggiungibile con questo sistema

---

**Data ultima modifica:** 22 Dicembre 2024
**Versione:** FINALE (post 10 iterazioni di test)
