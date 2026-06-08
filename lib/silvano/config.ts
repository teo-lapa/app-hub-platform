/**
 * Configurazione Area Venditore (Silvano Barbera).
 * Parametri "giocabili" centralizzati qui.
 */

// Quota del margine LAPA che spetta al venditore (Paul: "20% di quel ~32%").
// Modificabile senza toccare il resto dell'app.
export const SHARE = Number(process.env.SILVANO_MARGIN_SHARE || 0.2);

// Utente Odoo (res.users.id) di Silvano. Finché non è onboardato resta il fallback;
// quando esiste, il salesperson viene preso dal JWT (odooUserId) del login agente.
export const SILVANO_ODOO_USER_ID = Number(process.env.SILVANO_ODOO_USER_ID || 0);

// LAPA - finest italian food GmbH
export const LAPA_COMPANY_ID = 1;
