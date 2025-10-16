/**
 * SUPPLIER NORMALIZATION UTILITIES
 *
 * Funzioni condivise per normalizzare nomi e P.IVA dei fornitori
 * Usate da: identify-supplier, find-reception, e altri endpoint
 */

/**
 * NORMALIZE VAT NUMBER
 * Rimuove spazi, trattini, punti e prefissi paese (IT, CHE-, etc.)
 *
 * Esempi:
 * - "IT00895100709" -> "00895100709"
 * - "CHE-105.968.205 MWST" -> "105968205"
 * - "CHE-105.968.205" -> "105968205"
 * - "01613660743" -> "01613660743"
 */
export function normalizeVat(vat: string | null | undefined): string {
  if (!vat) return '';

  return vat
    .toUpperCase()
    .replace(/^IT/i, '')           // Rimuovi prefisso IT
    .replace(/^CHE-?/i, '')        // Rimuovi prefisso CHE o CHE-
    .replace(/\s+/g, '')           // Rimuovi spazi
    .replace(/-/g, '')             // Rimuovi trattini
    .replace(/\./g, '')            // Rimuovi punti
    .replace(/MWST$/i, '')         // Rimuovi suffisso MWST
    .trim();
}

/**
 * NORMALIZE NAME
 * Normalizza nomi di aziende italiane
 * - Case insensitive
 * - Rimuove forme societarie comuni (S.r.l., S.p.A., etc.)
 * - Rimuove punteggiatura
 * - Normalizza spazi
 *
 * Esempi:
 * - "BAGNOLI GROUP S.R.L." -> "bagnoli group"
 * - "Frantoio Oleario Fratelli Santoro S.r.l." -> "frantoio oleario fratelli santoro"
 * - "INNOVACTION S.R.L." -> "innovaction"
 * - "La bottega del caffè GmbH" -> "la bottega del caffe gmbh"
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';

  return name
    .trim()
    .toLowerCase()
    // Rimuovi forme societarie italiane comuni
    .replace(/\bs\.?r\.?l\.?\b/gi, '')    // S.r.l., Srl, S.R.L., s.r.l.
    .replace(/\bs\.?p\.?a\.?\b/gi, '')    // S.p.A., SpA, S.P.A., s.p.a.
    .replace(/\bs\.?a\.?s\.?\b/gi, '')    // S.a.s., Sas, S.A.S., s.a.s.
    .replace(/\bs\.?n\.?c\.?\b/gi, '')    // S.n.c., Snc, S.N.C., s.n.c.
    .replace(/\bsrl\b/gi, '')             // srl standalone
    .replace(/\bspa\b/gi, '')             // spa standalone
    .replace(/\bsas\b/gi, '')             // sas standalone
    .replace(/\bsnc\b/gi, '')             // snc standalone
    // Rimuovi forme societarie internazionali
    .replace(/\bgmbh\b/gi, '')            // GmbH (tedesco)
    .replace(/\bltd\b/gi, '')             // Ltd (inglese)
    .replace(/\bllc\b/gi, '')             // LLC (americano)
    .replace(/\binc\b/gi, '')             // Inc (americano)
    .replace(/\bcorp\b/gi, '')            // Corp (americano)
    .replace(/\bs\.?a\.?\b/gi, '')        // S.A. (varie lingue)
    // Rimuovi punteggiatura
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    // Normalizza spazi multipli
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * EXTRACT KEYWORDS FROM NAME
 * Estrae le parole chiave principali dal nome di un fornitore
 * Rimuove forme societarie e parole comuni
 *
 * Esempi:
 * - "BAGNOLI GROUP S.R.L." -> "BAGNOLI GROUP"
 * - "La bottega del caffè GmbH" -> "bottega caffè"
 */
export function extractKeywords(name: string): string {
  // Prima normalizza
  const normalized = normalizeName(name);

  // Rimuovi articoli e preposizioni comuni
  const withoutCommonWords = normalized
    .replace(/\b(il|lo|la|i|gli|le|un|uno|una|del|della|dello|degli|delle|di|da|in|con|su|per|tra|fra)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutCommonWords;
}

/**
 * FUZZY MATCH SCORE
 * Calcola un punteggio di similarità tra due nomi normalizzati
 * Ritorna un valore tra 0 (nessuna corrispondenza) e 1 (match perfetto)
 *
 * Algoritmo semplice basato su:
 * 1. Match esatto = 1.0
 * 2. Uno contiene l'altro = 0.8
 * 3. Parole in comune = 0.5-0.7
 */
export function fuzzyMatchScore(name1: string, name2: string): number {
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);

  // Match esatto
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Uno contiene l'altro
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.85;
  }

  // Confronta parole
  const words1 = normalized1.split(' ').filter(w => w.length > 2);
  const words2 = normalized2.split(' ').filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) {
    return 0;
  }

  // Conta quante parole sono in comune
  const commonWords = words1.filter(w => words2.includes(w));
  const score = commonWords.length / Math.max(words1.length, words2.length);

  return score;
}
