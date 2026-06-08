/**
 * Motore margine del venditore Silvano.
 *
 *   costo   = product.standard_price (merce + dazio)
 *   base    = prezzo del listino del cliente
 *   quota   = SHARE * (base - costo)        fetta piena del venditore
 *   floor   = base - quota                  prezzo minimo (sotto NON si scende)
 *   margine = prezzo - floor                guadagno del venditore al prezzo scelto
 */
import { SHARE } from './config';

export interface MarginInfo {
  cost: number;
  base: number;        // prezzo di listino del cliente (prezzo di partenza)
  share: number;       // SHARE usato
  quota: number;       // margine pieno del venditore a prezzo = base
  floor: number;       // prezzo minimo
  anomaly: boolean;    // base <= costo: listino sotto/uguale al costo
}

export function computeMarginInfo(base: number, cost: number, share: number = SHARE): MarginInfo {
  const b = Number(base) || 0;
  const c = Number(cost) || 0;
  const anomaly = b <= c;
  // Se il listino è sotto/uguale al costo, niente quota e floor = costo.
  const quota = anomaly ? 0 : share * (b - c);
  const floor = anomaly ? c : b - quota;
  return { cost: c, base: b, share, quota, floor, anomaly };
}

/** Margine del venditore a un certo prezzo di vendita (mai negativo nella pratica). */
export function marginAtPrice(price: number, floor: number): number {
  return (Number(price) || 0) - (Number(floor) || 0);
}

/** Prezzo valido se >= floor (con tolleranza di arrotondamento). */
export function isPriceAllowed(price: number, floor: number): boolean {
  return (Number(price) || 0) >= (Number(floor) || 0) - 0.001;
}
