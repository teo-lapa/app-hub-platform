/**
 * USER LANGUAGE UTILITY
 *
 * Reads the user's Odoo language preference from the cookie
 * set at login (odoo_user_lang) and injects it into Odoo RPC calls.
 */

import { cookies } from 'next/headers';

const DEFAULT_LANG = 'it_IT';

/**
 * Get user's Odoo language from the cookie set at login.
 * Falls back to 'it_IT' if not available.
 */
export function getUserLang(): string {
  try {
    const cookieStore = cookies();
    return cookieStore.get('odoo_user_lang')?.value || DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/**
 * Inject context.lang into kwargs if not already present.
 * Does NOT override explicitly set lang.
 */
export function injectLangContext(kwargs: any, lang?: string): any {
  const userLang = lang || getUserLang();
  if (!kwargs) kwargs = {};
  if (!kwargs.context) kwargs.context = {};
  if (!kwargs.context.lang) {
    kwargs.context.lang = userLang;
  }
  return kwargs;
}
