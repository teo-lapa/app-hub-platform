/**
 * Configurazione Area Venditore (Silvano Barbera).
 * Parametri "giocabili" centralizzati qui.
 */

// Quota del margine LAPA che spetta al venditore (Paul: "20% di quel ~32%").
// Modificabile senza toccare il resto dell'app.
export const SHARE = Number(process.env.SILVANO_MARGIN_SHARE || 0.2);

// Utente Odoo (res.users.id) di Silvano. Quando logga come agente arriva dal JWT
// (odooUserId); questo è il fallback per admin/anteprima. È 450 (silvano@lapa.ch)
// così non si calcola MAI su tutta l'azienda per sbaglio (timeout dashboard).
export const SILVANO_ODOO_USER_ID = Number(process.env.SILVANO_ODOO_USER_ID || 450);

// LAPA - finest italian food GmbH
export const LAPA_COMPANY_ID = 1;
